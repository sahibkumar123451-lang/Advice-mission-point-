import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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
  executeMultiModelWithFallback,
  formatFriendlyAiError,
  isPdfFileOrUrl,
  isTransientGeminiApiError,
  isVideoFileOrUrl,
  mergeSiteDataPreserveExisting,
  normalizeAiConversationHistory,
  normalizeExternalUrl,
  normalizeSafeMediaOrExternalUrl,
  normalizeWhatsAppUrl,
  validateCoachingInfo,
  validateEnquiryInput,
  validateGalleryInput,
  validateLearningResourceInput,
  validateTeacherProfile,
  type MultiModelRouteSpec,
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

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

  function buildMissionAiPromptContext(
    messages: Array<{ role?: string; text?: string }> | undefined,
    languagePreference?: 'bilingual' | 'english' | 'hindi',
  ) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return { error: 'Please enter a question or doubt first.' };
    }
    const latest = messages[messages.length - 1];
    if (!latest?.text?.trim()) {
      return { error: 'Question cannot be empty.' };
    }
    const normalizedTurns = normalizeAiConversationHistory(messages);
    if (normalizedTurns.length === 0) {
      return { error: 'Please enter a valid question or doubt first.' };
    }

    const store = readStore();
    const publishedTopics = store.learningHub
      .filter((item) => item.published)
      .slice(0, 8)
      .map((item) => `${item.title} (${item.topicArea})`)
      .join('; ');

    const langDirective =
      languagePreference === 'hindi'
        ? 'Respond primarily in simple, clear Hindi (Devanagari) with key technical terms in English brackets.'
        : languagePreference === 'english'
          ? 'Respond in simple, clear student-friendly English, adding brief Hindi meaning for difficult terms when helpful.'
          : 'Respond in clear, simple bilingual Hindi and English (easy-to-read English paired with simple Hindi explanation, or Hinglish/Devanagari where natural) so school students from Class 1 to 12 understand effortlessly.';

    const systemInstruction = `You are "Mission AI", the official AI assistant for "Advice Mission Point".

Knowledge Base (use strictly when relevant to the user's question):
- Website / Institute: ${store.coaching.name || 'Advice Mission Point'}
- Tagline: "${store.coaching.tagline || 'To Struggle, Take Success.'}"
- Owner / Founder: Surendra Sir
- Assistant Name: Mission AI
- Address: ${store.coaching.address || 'Ramauli, Darbhanga, Bihar, India 847101'}
- Classes: ${store.teacher.classesTaught || 'Class 1 to Class 12'}
- Timings: ${store.coaching.officeHours || 'Mon – Sat · 6:30 AM – 6:30 PM'}
- Subjects: ${(store.teacher.subjectsTaught || []).join(', ') || 'Mathematics, Science (Physics, Chemistry, Biology), English, Social Studies'}
- Contact Email: ${store.coaching.email || 'contact@advicemissionpoint.in'}
- Phone: ${store.coaching.phone || 'Available in Contact section'}
- Learning Hub Topics: ${publishedTopics || 'Newton Laws of Motion, Algebraic Identities, English Tenses, Photosynthesis'}

STRICT RESPONSE RULES:
1. Answer **exactly** what the user asks — clean, natural, accurate, and directly useful like Gemini.
2. Keep simple answers short and direct.
3. Do NOT add unnecessary introductions (do not introduce yourself unless asked) or unnecessary conclusions ("Feel free to ask", "How can I help today?", etc.).
4. Do NOT repeat greetings in every message. Only start with "नमस्ते!" (in Hindi Devanagari) if the user specifically greets you (e.g., "Hello", "Hi", "Namaste"), and never repeat greetings on study questions or follow-ups.
5. Do NOT add promotional content, coaching advertisements, or unrelated suggestions.
6. Do NOT repeat information already provided in the conversation.
7. Avoid filler words and meaningless sentences.
8. Give detailed explanations only when requested or needed for multi-step accuracy — never sacrifice accuracy just to make an answer shorter.
9. ${langDirective}
10. Use plain Unicode math symbols (×, ÷, ², √) instead of LaTeX $ dollar signs.`;

    return { normalizedTurns, systemInstruction };
  }

  const MISSION_AI_ROUTES: MultiModelRouteSpec[] = [
    {
      model: 'gemini-3.1-flash-lite',
      label: 'Primary Flash Lite',
      thinkingLevel: 'MINIMAL',
      useCompactLiteParams: true,
      timeoutMs: 12000,
    },
    {
      model: 'gemini-4-hydrogen',
      label: 'Secondary Flash',
      thinkingLevel: 'LOW',
      useCompactLiteParams: false,
      timeoutMs: 15000,
    },
  ];

  let stickyHealthyModel: string | null = null;
  let stickyHealthyUpdatedAt = 0;
  const STICKY_HEALTH_TTL_MS = 60_000;

  function getOrderedMissionAiRoutes(): MultiModelRouteSpec[] {
    if (
      stickyHealthyModel &&
      Date.now() - stickyHealthyUpdatedAt < STICKY_HEALTH_TTL_MS
    ) {
      const preferred = MISSION_AI_ROUTES.find((r) => r.model === stickyHealthyModel);
      if (preferred) {
        return [preferred, ...MISSION_AI_ROUTES.filter((r) => r.model !== stickyHealthyModel)];
      }
    }
    return MISSION_AI_ROUTES;
  }

  function recordHealthyMissionAiModel(model: string) {
    stickyHealthyModel = model;
    stickyHealthyUpdatedAt = Date.now();
  }

  function buildGeminiConfig(
    route: MultiModelRouteSpec,
    systemInstruction: string,
    abortSignal?: AbortSignal,
  ) {
    const level =
      route.thinkingLevel === 'MINIMAL' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
    if (route.useCompactLiteParams) {
      return {
        systemInstruction,
        thinkingConfig: { thinkingLevel: level },
        temperature: 0.5,
        maxOutputTokens: 512,
        abortSignal,
      };
    }
    return {
      systemInstruction,
      thinkingConfig: { thinkingLevel: level },
      abortSignal,
    };
  }

  async function runWithAbortTimeout<T>(
    timeoutMs: number,
    task: (controller: AbortController, clearInitialTimeout: () => void) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const clearInitialTimeout = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    try {
      return await Promise.race([
        task(controller, clearInitialTimeout),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => {
              reject(
                new Error(
                  timedOut
                    ? 'Request timeout (504) while waiting for AI model'
                    : 'Request aborted',
                ),
              );
            },
            { once: true },
          );
        }),
      ]);
    } finally {
      clearInitialTimeout();
    }
  }

  // Server-side GEMINI_API_KEY verification & optional live communication probe (never leaks secret)
  app.get('/api/mission-ai/health', async (req: Request, res: Response) => {
    const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
    const hasConfiguredKey = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY');
    if (!hasConfiguredKey) {
      res.status(503).json({
        configured: false,
        assistant: 'Mission AI',
        error: 'GEMINI_API_KEY is not configured in server environment.',
      });
      return;
    }

    if (req.query.probe !== '1') {
      res.json({
        configured: true,
        assistant: 'Mission AI',
        website: 'Advice Mission Point',
        owner: 'Surendra Sir',
        models: MISSION_AI_ROUTES.map((r) => r.model),
      });
      return;
    }

    const ai = getGeminiClient()!;
    const probeResults: Array<{
      model: string;
      ok: boolean;
      elapsedMs: number;
      preview?: string;
      error?: string;
    }> = [];

    for (const route of MISSION_AI_ROUTES) {
      const started = Date.now();
      try {
        const result = await runWithAbortTimeout(15000, (controller) =>
          ai.models.generateContent({
            model: route.model,
            contents: 'Who is the owner of Advice Mission Point? Reply in 1 short sentence.',
            config: buildGeminiConfig(
              route,
              'You are Mission AI, assistant of Advice Mission Point owned by Surendra Sir.',
              controller.signal,
            ),
          }),
        );
        probeResults.push({
          model: route.model,
          ok: Boolean(result.text?.trim()),
          elapsedMs: Date.now() - started,
          preview: result.text?.trim().slice(0, 140),
        });
      } catch (err) {
        probeResults.push({
          model: route.model,
          ok: false,
          elapsedMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const anyOk = probeResults.some((r) => r.ok);
    res.status(anyOk ? 200 : 503).json({
      configured: true,
      liveConnected: anyOk,
      assistant: 'Mission AI',
      probeResults,
    });
  });

  const handleMissionAiStream = async (req: Request, res: Response) => {
    const { messages, languagePreference } = req.body as {
      messages?: Array<{ role?: 'user' | 'assistant'; text?: string }>;
      languagePreference?: 'bilingual' | 'english' | 'hindi';
    };

    const ctx = buildMissionAiPromptContext(messages, languagePreference);
    if ('error' in ctx) {
      res.status(400).json({ error: ctx.error });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Mission AI is ready once GEMINI_API_KEY is configured in Settings > Secrets.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    const sendEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded && !clientDisconnected) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    let emittedAny = false;
    const routes = getOrderedMissionAiRoutes();

    try {
      const { route: winningRoute } = await executeMultiModelWithFallback(
        async (route, attemptIdx) => {
          if (clientDisconnected || res.writableEnded) {
            return;
          }

          const startedAt = Date.now();
          try {
            await runWithAbortTimeout(route.timeoutMs, async (controller, clearInitialTimeout) => {
              const stream = await ai.models.generateContentStream({
                model: route.model,
                contents: ctx.normalizedTurns,
                config: buildGeminiConfig(route, ctx.systemInstruction, controller.signal),
              });

              for await (const chunk of stream) {
                if (clientDisconnected || res.writableEnded) {
                  controller.abort();
                  break;
                }
                const delta = chunk.text;
                if (delta) {
                  if (!emittedAny) {
                    clearInitialTimeout();
                    emittedAny = true;
                  }
                  sendEvent({ delta });
                }
              }
            });

            if (!emittedAny && !clientDisconnected) {
              throw new Error('Empty model response.');
            }
          } catch (attemptErr) {
            const elapsed = Date.now() - startedAt;
            const detail =
              attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
            console.warn(
              `[MissionAI] stream attempt=${attemptIdx + 1} model=${route.model} failed in ${elapsed}ms: ${detail.slice(0, 180)}`,
            );
            throw attemptErr;
          }
        },
        {
          routes,
          maxAttempts: 4,
          baseDelayMs: 450,
          maxDelayMs: 2200,
          shouldAbort: () => emittedAny || clientDisconnected || res.writableEnded,
          onStatus: ({ reason }) => {
            sendEvent({
              status: reason,
              message:
                reason === 'failover'
                  ? 'Primary AI is busy — switching seamlessly to backup model...'
                  : 'High traffic detected — retrying gently in a moment...',
            });
          },
        },
      );

      recordHealthyMissionAiModel(winningRoute.model);
      sendEvent({ done: true, model: winningRoute.label });
      res.end();
    } catch (err) {
      if (emittedAny) {
        sendEvent({ done: true });
        res.end();
        return;
      }
      const rawMessage =
        err instanceof Error ? err.message : 'Unable to reach Gemini API right now.';
      sendEvent({ error: formatFriendlyAiError(rawMessage) });
      res.end();
    }
  };

  const handleMissionAiAsk = async (req: Request, res: Response) => {
    const { messages, languagePreference } = req.body as {
      messages?: Array<{ role?: 'user' | 'assistant'; text?: string }>;
      languagePreference?: 'bilingual' | 'english' | 'hindi';
    };

    const ctx = buildMissionAiPromptContext(messages, languagePreference);
    if ('error' in ctx) {
      res.status(400).json({ error: ctx.error });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Mission AI is ready once GEMINI_API_KEY is configured in Settings > Secrets.',
      });
      return;
    }

    const routes = getOrderedMissionAiRoutes();
    try {
      const { result: answer, route: winningRoute } = await executeMultiModelWithFallback(
        async (route, attemptIdx) => {
          const startedAt = Date.now();
          try {
            const response = await runWithAbortTimeout(
              route.timeoutMs,
              async (controller) =>
                ai.models.generateContent({
                  model: route.model,
                  contents: ctx.normalizedTurns,
                  config: buildGeminiConfig(route, ctx.systemInstruction, controller.signal),
                }),
            );

            const text = response.text?.trim();
            if (!text) {
              throw new Error('Empty model response.');
            }
            return text;
          } catch (attemptErr) {
            const elapsed = Date.now() - startedAt;
            const detail =
              attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
            console.warn(
              `[MissionAI] ask attempt=${attemptIdx + 1} model=${route.model} failed in ${elapsed}ms: ${detail.slice(0, 180)}`,
            );
            throw attemptErr;
          }
        },
        {
          routes,
          maxAttempts: 4,
          baseDelayMs: 450,
          maxDelayMs: 2200,
        },
      );

      recordHealthyMissionAiModel(winningRoute.model);
      res.json({ answer });
    } catch (err) {
      const rawMessage =
        err instanceof Error ? err.message : 'Unable to reach Gemini API right now.';
      const statusCode = isTransientGeminiApiError(err) ? 503 : 502;
      res.status(statusCode).json({
        error: formatFriendlyAiError(rawMessage),
      });
    }
  };

  app.post('/api/mission-ai/stream', handleMissionAiStream);
  app.post('/api/mission-ai/ask', handleMissionAiAsk);
  app.post('/api/ai/stream', handleMissionAiStream);
  app.post('/api/ai/ask', handleMissionAiAsk);

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
