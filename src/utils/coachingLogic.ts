import type {
  CoachingInfo,
  EnquiryItem,
  GalleryCategory,
  GalleryItem,
  LearningResource,
  SiteData,
  SocialLinks,
  TeacherProfile,
} from '../types/coaching.ts';

export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return '';
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function normalizeWhatsAppUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (/^(https?:\/\/)?(wa\.me|api\.whatsapp\.com)/i.test(trimmed)) {
    return normalizeExternalUrl(trimmed);
  }
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return normalizeExternalUrl(trimmed);
  }
  const normalizedDigits = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalizedDigits}`;
}

export function getYouTubeEmbedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function filterGalleryItems(
  items: GalleryItem[],
  category: GalleryCategory | 'all',
  includeUnpublished = false,
): GalleryItem[] {
  return items.filter((item) => {
    if (!includeUnpublished && !item.published) {
      return false;
    }
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    return true;
  });
}

export function filterLearningResources(
  items: LearningResource[],
  searchQuery: string,
  topicArea: string,
  includeUnpublished = false,
): LearningResource[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (!includeUnpublished && !item.published) {
      return false;
    }
    if (topicArea !== 'all' && item.topicArea.toLowerCase() !== topicArea.toLowerCase()) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.topicArea.toLowerCase().includes(normalizedQuery) ||
      item.summary.toLowerCase().includes(normalizedQuery) ||
      item.content.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function filterAdminGalleryItems(
  items: GalleryItem[],
  mediaFilter: 'all' | 'image' | 'video' | 'pdf',
  query: string,
): GalleryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const isPdf = item.mediaType === 'pdf' || item.category === 'pdfs' || isPdfFileOrUrl(item.mediaUrl);
    const isVideo =
      !isPdf &&
      (item.mediaType === 'video' || item.category === 'videos' || isVideoFileOrUrl(item.mediaUrl));
    const resolvedType: 'image' | 'video' | 'pdf' = isPdf ? 'pdf' : isVideo ? 'video' : 'image';

    if (mediaFilter !== 'all' && resolvedType !== mediaFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.caption.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function filterAdminLearningResources(
  items: LearningResource[],
  query: string,
): LearningResource[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.topicArea.toLowerCase().includes(normalizedQuery) ||
      item.summary.toLowerCase().includes(normalizedQuery) ||
      (item.pdfName || '').toLowerCase().includes(normalizedQuery),
  );
}

export function validateTeacherProfile(profile: Partial<TeacherProfile>): {
  valid: boolean;
  error?: string;
} {
  if (!profile.name?.trim()) {
    return { valid: false, error: 'Teacher name is required.' };
  }
  if (!profile.introduction?.trim()) {
    return { valid: false, error: 'Teacher introduction is required.' };
  }
  if (!profile.qualifications?.trim()) {
    return { valid: false, error: 'Qualifications are required.' };
  }
  if (!profile.experience?.trim()) {
    return { valid: false, error: 'Teaching experience is required.' };
  }
  if (!profile.classesTaught?.trim()) {
    return { valid: false, error: 'Classes taught field is required.' };
  }
  return { valid: true };
}

export function validateCoachingInfo(
  coaching: Partial<CoachingInfo>,
  socialLinks: Partial<SocialLinks>,
): { valid: boolean; error?: string } {
  if (!coaching.name?.trim()) {
    return { valid: false, error: 'Coaching name is required.' };
  }
  if (!coaching.tagline?.trim()) {
    return { valid: false, error: 'Tagline is required.' };
  }
  if (!coaching.address?.trim()) {
    return { valid: false, error: 'Coaching address is required.' };
  }
  if (!coaching.googleMapsUrl?.trim()) {
    return { valid: false, error: 'Google Maps link is required.' };
  }
  if (
    !socialLinks.whatsapp?.trim() ||
    !socialLinks.instagram?.trim() ||
    !socialLinks.facebook?.trim() ||
    !socialLinks.youtube?.trim()
  ) {
    return { valid: false, error: 'All four social media links are required.' };
  }
  return { valid: true };
}

export function isPdfFileOrUrl(filenameOrUrl: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase() === 'application/pdf') {
    return true;
  }
  const clean = filenameOrUrl.split('?')[0].split('#')[0].trim().toLowerCase();
  return clean.endsWith('.pdf');
}

export function isVideoFileOrUrl(filenameOrUrl: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().startsWith('video/')) {
    return true;
  }
  const clean = filenameOrUrl.split('?')[0].split('#')[0].trim().toLowerCase();
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/.test(clean);
}

export function detectUploadCategoryAndType(
  filename: string,
  mimeType: string,
  preferredImageCategory: GalleryCategory = 'coaching',
): { mediaType: 'image' | 'video' | 'pdf'; category: GalleryCategory } {
  if (isPdfFileOrUrl(filename, mimeType)) {
    return { mediaType: 'pdf', category: 'pdfs' };
  }
  if (isVideoFileOrUrl(filename, mimeType)) {
    return { mediaType: 'video', category: 'videos' };
  }
  const safeImageCat =
    preferredImageCategory === 'videos' || preferredImageCategory === 'pdfs'
      ? 'coaching'
      : preferredImageCategory;
  return { mediaType: 'image', category: safeImageCat };
}

export function formatTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced || 'Coaching Media';
}

export function validateGalleryInput(input: Partial<GalleryItem>): {
  valid: boolean;
  error?: string;
} {
  if (!input.title?.trim()) {
    return { valid: false, error: 'Gallery item title is required.' };
  }
  if (!input.mediaUrl?.trim()) {
    return { valid: false, error: 'Please provide an image, video, or PDF URL/file.' };
  }
  const allowedCategories: GalleryCategory[] = [
    'coaching',
    'classroom',
    'activities',
    'events',
    'videos',
    'pdfs',
  ];
  if (!input.category || !allowedCategories.includes(input.category)) {
    return { valid: false, error: 'Please select a valid gallery category.' };
  }
  return { valid: true };
}

export function validateLearningResourceInput(input: Partial<LearningResource>): {
  valid: boolean;
  error?: string;
} {
  if (!input.title?.trim()) {
    return { valid: false, error: 'Resource title is required.' };
  }
  if (!input.topicArea?.trim()) {
    return { valid: false, error: 'Topic area is required.' };
  }
  const hasPdf = Boolean(input.pdfUrl?.trim());
  if (!hasPdf && (!input.summary?.trim() || !input.content?.trim())) {
    return { valid: false, error: 'Summary and detailed study notes (or a PDF file) are required.' };
  }
  return { valid: true };
}

export function validateEnquiryInput(
  input: Pick<Partial<EnquiryItem>, 'studentName' | 'phoneOrEmail' | 'message'>,
): { valid: boolean; error?: string } {
  if (!input.studentName?.trim() || input.studentName.trim().length < 2) {
    return { valid: false, error: 'Please enter the student or parent name.' };
  }
  if (!input.phoneOrEmail?.trim() || input.phoneOrEmail.trim().length < 5) {
    return { valid: false, error: 'Please enter a valid phone number or email.' };
  }
  if (!input.message?.trim() || input.message.trim().length < 5) {
    return { valid: false, error: 'Please enter a brief question or message.' };
  }
  return { valid: true };
}

export function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function normalizeSafeMediaOrExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return '';
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  if (
    lower.startsWith('data:image/') ||
    lower.startsWith('data:application/pdf;base64,')
  ) {
    return trimmed;
  }
  if (lower.startsWith('data:')) {
    return '';
  }
  return normalizeExternalUrl(trimmed);
}

export interface AiTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function normalizeAiConversationHistory(
  messages: Array<{ role?: string; text?: string }>,
): AiTurn[] {
  const cleaned = messages
    .map((m) => ({
      role: (m.role === 'assistant' || m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      text: (m.text || '').trim(),
    }))
    .filter((m) => m.text.length > 0);

  // Drop leading model turns because Gemini generateContent expects first turn to be 'user'
  while (cleaned.length > 0 && cleaned[0].role === 'model') {
    cleaned.shift();
  }

  // Merge consecutive turns of the same role to prevent turn-order errors
  const merged: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const item of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      prev.text = `${prev.text}\n\n${item.text}`;
    } else {
      merged.push({ ...item });
    }
  }

  return merged.slice(-12).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

export function mergeSiteDataPreserveExisting(
  base: SiteData,
  incoming: Partial<SiteData>,
): SiteData {
  const mergedCoaching: CoachingInfo = {
    ...base.coaching,
    ...(incoming.coaching || {}),
    name: incoming.coaching?.name?.trim() || base.coaching.name,
    tagline: incoming.coaching?.tagline?.trim() || base.coaching.tagline,
    address: incoming.coaching?.address?.trim() || base.coaching.address,
    googleMapsUrl: incoming.coaching?.googleMapsUrl?.trim() || base.coaching.googleMapsUrl,
  };

  const mergedSocials: SocialLinks = {
    ...base.socialLinks,
    ...(incoming.socialLinks || {}),
    whatsapp: incoming.socialLinks?.whatsapp?.trim() || base.socialLinks.whatsapp,
    instagram: incoming.socialLinks?.instagram?.trim() || base.socialLinks.instagram,
    facebook: incoming.socialLinks?.facebook?.trim() || base.socialLinks.facebook,
    youtube: incoming.socialLinks?.youtube?.trim() || base.socialLinks.youtube,
  };

  const mergedTeacher: TeacherProfile = {
    ...base.teacher,
    ...(incoming.teacher || {}),
    name: incoming.teacher?.name?.trim() || base.teacher.name,
    skills:
      Array.isArray(incoming.teacher?.skills) && incoming.teacher.skills.length > 0
        ? incoming.teacher.skills
        : base.teacher.skills,
    subjectsTaught:
      Array.isArray(incoming.teacher?.subjectsTaught) && incoming.teacher.subjectsTaught.length > 0
        ? incoming.teacher.subjectsTaught
        : base.teacher.subjectsTaught,
  };

  // Non-destructive union by id: incoming items update matching IDs & prepend new ones,
  // while existing items in base are preserved unless explicitly replaced by same ID.
  const incomingGallery = Array.isArray(incoming.gallery) ? incoming.gallery : [];
  const incomingGalleryMap = new Map(incomingGallery.map((g) => [g.id, g]));
  const mergedGallery: GalleryItem[] = [
    ...incomingGallery,
    ...base.gallery.filter((g) => !incomingGalleryMap.has(g.id)),
  ];

  const incomingHub = Array.isArray(incoming.learningHub) ? incoming.learningHub : [];
  const incomingHubMap = new Map(incomingHub.map((h) => [h.id, h]));
  const mergedHub: LearningResource[] = [
    ...incomingHub,
    ...base.learningHub.filter((h) => !incomingHubMap.has(h.id)),
  ];

  const incomingEnquiries = Array.isArray(incoming.enquiries) ? incoming.enquiries : [];
  const baseEnquiries = Array.isArray(base.enquiries) ? base.enquiries : [];
  const incomingEnqMap = new Map(incomingEnquiries.map((e) => [e.id, e]));
  const mergedEnquiries: EnquiryItem[] = [
    ...incomingEnquiries,
    ...baseEnquiries.filter((e) => !incomingEnqMap.has(e.id)),
  ];

  return {
    coaching: mergedCoaching,
    socialLinks: mergedSocials,
    teacher: mergedTeacher,
    gallery: mergedGallery,
    learningHub: mergedHub,
    enquiries: mergedEnquiries,
  };
}

export function formatFriendlyAiError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return 'Gemini API key is missing or invalid in Settings > Secrets. Please verify the API key and try again.';
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 'Advice Mission AI has reached its temporary request limit. Please wait a few seconds and click Retry (कृपया कुछ सेकंड प्रतीक्षा करें और पुनः प्रयास करें).';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand') || lower.includes('overloaded')) {
    return 'AI server is temporarily busy due to high demand. Please click Retry in a moment (सर्वर अभी व्यस्त है, कृपया कुछ सेकंड बाद पुनः प्रयास करें).';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return 'The requested AI model is currently unavailable. Please retry in a moment.';
  }
  return 'Advice Mission AI could not complete this answer right now. Please click Retry or rephrase your question.';
}

