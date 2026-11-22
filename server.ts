import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type {
  CoachingInfo,
  EnquiryItem,
  GalleryItem,
  LearningResource,
  SiteData,
  SocialLinks,
  TeacherProfile,
} from './src/types/coaching.ts';
import {
  ADMIN_PASSCODE_HASH,
  ADMIN_PASSCODE_SALT,
  isPdfFileOrUrl,
  isVideoFileOrUrl,
  mergeSiteDataPreserveExisting,
  normalizeExternalUrl,
  normalizeSafeMediaOrExternalUrl,
  normalizeWhatsAppUrl,
  validateCoachingInfo,
  validateEnquiryInput,
  validateGalleryInput,
  validateLearningResourceInput,
  validateTeacherProfile,
} from './src/utils/coachingLogic.ts';
import { DEFAULT_SITE_DATA } from './src/utils/seedData.ts';

const PORT = Number(process.env.PORT || 3000);
const adminSessions = new Set<string>();

function verifyAdminPasscode(input: string): boolean {
  const digest = crypto
    .createHash('sha256')
    .update(`${ADMIN_PASSCODE_SALT}:${input}`)
    .digest();
  const expected = Buffer.from(ADMIN_PASSCODE_HASH, 'hex');
  return digest.length === expected.length && crypto.timingSafeEqual(digest, expected);
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'coaching-store.json');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function ensureStorageDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_SITE_DATA, null, 2), 'utf-8');
  }
}

function readStore(): SiteData {
  ensureStorageDirs();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SiteData>;
    return {
      coaching: { ...DEFAULT_SITE_DATA.coaching, ...(parsed.coaching || {}) },
      socialLinks: { ...DEFAULT_SITE_DATA.socialLinks, ...(parsed.socialLinks || {}) },
      teacher: { ...DEFAULT_SITE_DATA.teacher, ...(parsed.teacher || {}) },
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : DEFAULT_SITE_DATA.gallery,
      learningHub: Array.isArray(parsed.learningHub)
        ? parsed.learningHub
        : DEFAULT_SITE_DATA.learningHub,
      enquiries: Array.isArray(parsed.enquiries) ? parsed.enquiries : [],
    };
  } catch {
    return structuredClone(DEFAULT_SITE_DATA);
  }
}

function writeStore(next: SiteData): void {
  ensureStorageDirs();
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-admin-token') || '';
  if (!token || !adminSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized. Please sign in to the Admin Panel.' });
    return;
  }
  next();
}

function isSupportedMediaUpload(filename: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/pdf') {
    return true;
  }
  const cleanExt = path.extname(filename).toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic|mp4|webm|mov|m4v|avi|mkv|3gp|pdf)$/.test(cleanExt);
}

async function startServer() {
  ensureStorageDirs();
  const app = express();

  // Raw binary file upload endpoint (Photos, Videos, PDFs up to 250 MB per file, no base64 bloat)
  app.post(
    '/api/admin/upload-file',
    requireAdmin,
    express.raw({ type: '*/*', limit: '250mb' }),
    (req: Request, res: Response) => {
      const rawName = decodeURIComponent(req.header('x-filename') || 'upload.bin');
      const filename = path.basename(rawName) || 'upload.bin';
      const mimeType = req.header('x-mime-type') || req.header('content-type') || '';
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

      if (!buffer.length) {
        res.status(400).json({ error: 'Uploaded file is empty.' });
        return;
      }

      if (!isSupportedMediaUpload(filename, mimeType)) {
        res.status(400).json({ error: 'Only image, video, and PDF files are allowed.' });
        return;
      }

      const ext = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
      const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
      res.status(201).json({ url: `/uploads/${safeName}`, filename });
    },
  );

  app.use(express.json({ limit: '60mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Public site data (only published gallery & learning hub items, no private enquiries)
  app.get('/api/site', (_req: Request, res: Response) => {
    const data = readStore();
    res.json({
      coaching: data.coaching,
      socialLinks: data.socialLinks,
      teacher: data.teacher,
      gallery: data.gallery.filter((item) => item.published),
      learningHub: data.learningHub.filter((item) => item.published),
    });
  });

  // Public contact / enquiry submission
  app.post('/api/enquiries', (req: Request, res: Response) => {
    const body = req.body as Partial<EnquiryItem>;
    const validation = validateEnquiryInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const store = readStore();
    const enquiry: EnquiryItem = {
      id: `enq-${crypto.randomUUID().slice(0, 8)}`,
      studentName: body.studentName!.trim(),
      phoneOrEmail: body.phoneOrEmail!.trim(),
      message: body.message!.trim(),
      createdAt: new Date().toISOString(),
    };
    store.enquiries = [enquiry, ...(store.enquiries || [])];
    writeStore(store);
    res.status(201).json({ ok: true, enquiry });
  });

  // Admin Login Verification
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { passcode } = req.body as { passcode?: string };
    if (!passcode || !verifyAdminPasscode(passcode)) {
      res.status(401).json({ error: 'Incorrect admin passcode.' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.add(token);
    res.json({ ok: true, token });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const token = req.header('x-admin-token') || '';
    if (token) {
      adminSessions.delete(token);
    }
    res.json({ ok: true });
  });

  // Admin Full Data
  app.get('/api/admin/data', requireAdmin, (_req: Request, res: Response) => {
    res.json(readStore());
  });

  // Update Coaching Info + Google Maps + Social Links
  app.put('/api/admin/coaching', requireAdmin, (req: Request, res: Response) => {
    const { coaching, socialLinks } = req.body as {
      coaching?: Partial<CoachingInfo>;
      socialLinks?: Partial<SocialLinks>;
    };

    const store = readStore();
    const rawHeroUrl =
      coaching?.heroMediaUrl !== undefined ? coaching.heroMediaUrl.trim() : store.coaching.heroMediaUrl;
    const nextHeroUrl = rawHeroUrl ? normalizeSafeMediaOrExternalUrl(rawHeroUrl) : '';

    const nextCoaching: CoachingInfo = {
      ...store.coaching,
      ...(coaching || {}),
      heroMediaUrl: nextHeroUrl,
      heroMediaType:
        coaching?.heroMediaType === 'video' || isVideoFileOrUrl(nextHeroUrl || '')
          ? 'video'
          : 'image',
      googleMapsUrl: normalizeExternalUrl(coaching?.googleMapsUrl ?? store.coaching.googleMapsUrl),
    };
    const nextSocial: SocialLinks = {
      whatsapp: normalizeWhatsAppUrl(socialLinks?.whatsapp ?? store.socialLinks.whatsapp),
      instagram: normalizeExternalUrl(socialLinks?.instagram ?? store.socialLinks.instagram),
      facebook: normalizeExternalUrl(socialLinks?.facebook ?? store.socialLinks.facebook),
      youtube: normalizeExternalUrl(socialLinks?.youtube ?? store.socialLinks.youtube),
    };

    const validation = validateCoachingInfo(nextCoaching, nextSocial);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    store.coaching = nextCoaching;
    store.socialLinks = nextSocial;
    writeStore(store);
    res.json({ coaching: store.coaching, socialLinks: store.socialLinks });
  });

  // Update Teacher Profile
  app.put('/api/admin/teacher', requireAdmin, (req: Request, res: Response) => {
    const incoming = req.body as Partial<TeacherProfile>;
    const store = readStore();
    const nextTeacher: TeacherProfile = {
      ...store.teacher,
      ...incoming,
      photoUrl:
        incoming.photoUrl !== undefined
          ? normalizeSafeMediaOrExternalUrl(incoming.photoUrl) || store.teacher.photoUrl
          : store.teacher.photoUrl,
      skills: Array.isArray(incoming.skills)
        ? incoming.skills.map((s) => s.trim()).filter(Boolean)
        : store.teacher.skills,
      subjectsTaught: Array.isArray(incoming.subjectsTaught)
        ? incoming.subjectsTaught.map((s) => s.trim()).filter(Boolean)
        : store.teacher.subjectsTaught,
    };

    const validation = validateTeacherProfile(nextTeacher);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    store.teacher = nextTeacher;
    writeStore(store);
    res.json({ teacher: store.teacher });
  });

  // Restore / Merge Backup Data (non-destructive merge keeps previous items intact)
  app.post('/api/admin/restore', requireAdmin, (req: Request, res: Response) => {
    const { data, mode } = req.body as {
      data?: Partial<SiteData>;
      mode?: 'merge' | 'replace';
    };

    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Invalid backup file format.' });
      return;
    }

    const current = readStore();
    const nextStore: SiteData =
      mode === 'replace'
        ? mergeSiteDataPreserveExisting(DEFAULT_SITE_DATA, data)
        : mergeSiteDataPreserveExisting(current, data);

    const coachingCheck = validateCoachingInfo(nextStore.coaching, nextStore.socialLinks);
    if (!coachingCheck.valid) {
      res.status(400).json({ error: coachingCheck.error });
      return;
    }
    const teacherCheck = validateTeacherProfile(nextStore.teacher);
    if (!teacherCheck.valid) {
      res.status(400).json({ error: teacherCheck.error });
      return;
    }

    writeStore(nextStore);
    res.json({ ok: true, data: nextStore });
  });

  // File Upload Endpoint (Base64 fallback for Photos, Videos & PDFs)
  app.post('/api/admin/upload', requireAdmin, (req: Request, res: Response) => {
    const { filename, mimeType, dataBase64 } = req.body as {
      filename?: string;
      mimeType?: string;
      dataBase64?: string;
    };

    if (!filename || !dataBase64) {
      res.status(400).json({ error: 'Missing file upload fields.' });
      return;
    }

    if (!isSupportedMediaUpload(filename, mimeType || '')) {
      res.status(400).json({ error: 'Only image, video, and PDF files are allowed.' });
      return;
    }

    const base64Clean = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length > 50 * 1024 * 1024) {
      res.status(400).json({ error: 'Uploaded file must be under 50 MB for base64 upload.' });
      return;
    }

    const ext = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
    res.status(201).json({ url: `/uploads/${safeName}`, filename });
  });

  // Gallery CRUD
  app.post('/api/admin/gallery', requireAdmin, (req: Request, res: Response) => {
    const body = req.body as Partial<GalleryItem>;
    const validation = validateGalleryInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const resolvedMediaType: GalleryItem['mediaType'] =
      body.mediaType === 'pdf' || body.category === 'pdfs' || isPdfFileOrUrl(body.mediaUrl || '')
        ? 'pdf'
        : body.mediaType === 'video' || body.category === 'videos'
          ? 'video'
          : 'image';

    const store = readStore();
    const item: GalleryItem = {
      id: `gal-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title!.trim(),
      caption: (body.caption || '').trim(),
      category: body.category!,
      mediaType: resolvedMediaType,
      mediaUrl: body.mediaUrl!.trim(),
      thumbnailUrl: body.thumbnailUrl?.trim() || undefined,
      published: body.published ?? true,
      createdAt: new Date().toISOString(),
    };

    store.gallery = [item, ...store.gallery];
    writeStore(store);
    res.status(201).json({ item });
  });

  app.put('/api/admin/gallery/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as Partial<GalleryItem>;
    const store = readStore();
    const idx = store.gallery.findIndex((g) => g.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Gallery item not found.' });
      return;
    }

    const nextCategory = body.category ?? store.gallery[idx].category;
    const nextMediaUrl = (body.mediaUrl ?? store.gallery[idx].mediaUrl).trim();
    const resolvedMediaType: GalleryItem['mediaType'] =
      body.mediaType === 'pdf' || nextCategory === 'pdfs' || isPdfFileOrUrl(nextMediaUrl)
        ? 'pdf'
        : body.mediaType === 'video' || nextCategory === 'videos' || isVideoFileOrUrl(nextMediaUrl)
          ? 'video'
          : 'image';

    const updated: GalleryItem = {
      ...store.gallery[idx],
      ...body,
      id,
      category: nextCategory,
      mediaType: resolvedMediaType,
      title: (body.title ?? store.gallery[idx].title).trim(),
      caption: (body.caption ?? store.gallery[idx].caption).trim(),
      mediaUrl: nextMediaUrl,
    };

    const validation = validateGalleryInput(updated);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    store.gallery[idx] = updated;
    writeStore(store);
    res.json({ item: updated });
  });

  app.delete('/api/admin/gallery/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    const nextGallery = store.gallery.filter((g) => g.id !== id);
    if (nextGallery.length === store.gallery.length) {
      res.status(404).json({ error: 'Gallery item not found.' });
      return;
    }
    store.gallery = nextGallery;
    writeStore(store);
    res.json({ ok: true });
  });

  // Learning Hub CRUD
  app.post('/api/admin/hub', requireAdmin, (req: Request, res: Response) => {
    const body = req.body as Partial<LearningResource>;
    const validation = validateLearningResourceInput(body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const cleanPdfUrl = body.pdfUrl?.trim() || undefined;
    const cleanPdfName = body.pdfName?.trim() || undefined;

    const store = readStore();
    const resource: LearningResource = {
      id: `hub-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title!.trim(),
      topicArea: body.topicArea!.trim(),
      summary:
        (body.summary || '').trim() ||
        (cleanPdfUrl ? 'Downloadable PDF study guide and reference notes.' : ''),
      content:
        (body.content || '').trim() ||
        (cleanPdfUrl ? 'Open or download the attached PDF document below to study this topic.' : ''),
      languageNote: (body.languageNote || 'Hindi + English Bilingual').trim(),
      keyFormulas: Array.isArray(body.keyFormulas)
        ? body.keyFormulas.map((f) => f.trim()).filter(Boolean)
        : [],
      pdfUrl: cleanPdfUrl,
      pdfName: cleanPdfName,
      published: body.published ?? true,
      updatedAt: new Date().toISOString(),
    };

    store.learningHub = [resource, ...store.learningHub];
    writeStore(store);
    res.status(201).json({ resource });
  });

  app.put('/api/admin/hub/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as Partial<LearningResource>;
    const store = readStore();
    const idx = store.learningHub.findIndex((h) => h.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Learning resource not found.' });
      return;
    }

    const updated: LearningResource = {
      ...store.learningHub[idx],
      ...body,
      id,
      pdfUrl: body.pdfUrl !== undefined ? body.pdfUrl.trim() || undefined : store.learningHub[idx].pdfUrl,
      pdfName: body.pdfName !== undefined ? body.pdfName.trim() || undefined : store.learningHub[idx].pdfName,
      updatedAt: new Date().toISOString(),
    };
    const validation = validateLearningResourceInput(updated);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    store.learningHub[idx] = updated;
    writeStore(store);
    res.json({ resource: updated });
  });

  app.delete('/api/admin/hub/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    const nextHub = store.learningHub.filter((h) => h.id !== id);
    if (nextHub.length === store.learningHub.length) {
      res.status(404).json({ error: 'Learning resource not found.' });
      return;
    }
    store.learningHub = nextHub;
    writeStore(store);
    res.json({ ok: true });
  });

  app.delete('/api/admin/enquiries/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.enquiries = (store.enquiries || []).filter((e) => e.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  // Vite Middleware in Development / Static Dist in Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Advice Mission Point server running on http://localhost:${PORT}`);
  });
  httpServer.requestTimeout = 0;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
