import type {
  CoachingInfo,
  DailyUpdateItem,
  DailyUpdateMediaType,
  EnquiryItem,
  FeedbackRatingItem,
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

  return merged.slice(-8).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

function omitUndefinedKeys<T extends object>(obj?: Partial<T>): Partial<T> {
  if (!obj) return {};
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export function mergeSiteDataPreserveExisting(
  base: SiteData,
  incoming: Partial<SiteData>,
): SiteData {
  const safeCoaching = omitUndefinedKeys<CoachingInfo>(incoming.coaching);
  const safeSocials = omitUndefinedKeys<SocialLinks>(incoming.socialLinks);
  const safeTeacher = omitUndefinedKeys<TeacherProfile>(incoming.teacher);

  const mergedCoaching: CoachingInfo = {
    ...base.coaching,
    ...safeCoaching,
    name: incoming.coaching?.name?.trim() || base.coaching.name,
    tagline: incoming.coaching?.tagline?.trim() || base.coaching.tagline,
    address: incoming.coaching?.address?.trim() || base.coaching.address,
    googleMapsUrl: incoming.coaching?.googleMapsUrl?.trim() || base.coaching.googleMapsUrl,
  };

  const mergedSocials: SocialLinks = {
    ...base.socialLinks,
    ...safeSocials,
    whatsapp: incoming.socialLinks?.whatsapp?.trim() || base.socialLinks.whatsapp,
    instagram: incoming.socialLinks?.instagram?.trim() || base.socialLinks.instagram,
    facebook: incoming.socialLinks?.facebook?.trim() || base.socialLinks.facebook,
    youtube: incoming.socialLinks?.youtube?.trim() || base.socialLinks.youtube,
  };

  const mergedTeacher: TeacherProfile = {
    ...base.teacher,
    ...safeTeacher,
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

  const incomingUpdates = Array.isArray(incoming.dailyUpdates) ? incoming.dailyUpdates : [];
  const baseUpdates = Array.isArray(base.dailyUpdates) ? base.dailyUpdates : [];
  const incomingUpdMap = new Map(incomingUpdates.map((u) => [u.id, u]));
  const mergedUpdates = sortDailyUpdatesByDate([
    ...incomingUpdates,
    ...baseUpdates.filter((u) => !incomingUpdMap.has(u.id)),
  ]);

  const incomingFeedbacks = Array.isArray(incoming.feedbacks) ? incoming.feedbacks : [];
  const baseFeedbacks = Array.isArray(base.feedbacks) ? base.feedbacks : [];
  const incomingFbMap = new Map(incomingFeedbacks.map((f) => [f.id, f]));
  const mergedFeedbacks = [
    ...incomingFeedbacks,
    ...baseFeedbacks.filter((f) => !incomingFbMap.has(f.id)),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return normalizeSiteBrandData({
    coaching: mergedCoaching,
    socialLinks: mergedSocials,
    teacher: mergedTeacher,
    gallery: mergedGallery,
    learningHub: mergedHub,
    dailyUpdates: mergedUpdates,
    enquiries: mergedEnquiries,
    feedbacks: mergedFeedbacks,
  });
}

export function replaceLegacyCoachingBrand(value: string): string {
  if (!value) return value;
  return value.replace(/advice\s+mission\s+point/gi, 'Advice Coaching Classes');
}

export function normalizeSiteBrandData(data: SiteData): SiteData {
  return {
    ...data,
    coaching: {
      ...data.coaching,
      name: replaceLegacyCoachingBrand(data.coaching.name),
      tagline: replaceLegacyCoachingBrand(data.coaching.tagline),
      welcomeHeadline: replaceLegacyCoachingBrand(data.coaching.welcomeHeadline),
      welcomeSubtitle: replaceLegacyCoachingBrand(data.coaching.welcomeSubtitle),
      aboutHeading: replaceLegacyCoachingBrand(data.coaching.aboutHeading),
      aboutDescription: replaceLegacyCoachingBrand(data.coaching.aboutDescription),
      classesRangeText: replaceLegacyCoachingBrand(data.coaching.classesRangeText),
      address: replaceLegacyCoachingBrand(data.coaching.address),
      officeHours: replaceLegacyCoachingBrand(data.coaching.officeHours),
      heroCaptionTitle:
        typeof data.coaching.heroCaptionTitle === 'string'
          ? replaceLegacyCoachingBrand(data.coaching.heroCaptionTitle)
          : undefined,
      heroCaptionText:
        typeof data.coaching.heroCaptionText === 'string'
          ? replaceLegacyCoachingBrand(data.coaching.heroCaptionText)
          : undefined,
    },
    teacher: {
      ...data.teacher,
      name: replaceLegacyCoachingBrand(data.teacher.name),
      roleTitle: replaceLegacyCoachingBrand(data.teacher.roleTitle),
      photoCaption:
        typeof data.teacher.photoCaption === 'string'
          ? replaceLegacyCoachingBrand(data.teacher.photoCaption)
          : undefined,
      introduction: replaceLegacyCoachingBrand(data.teacher.introduction),
      qualifications: replaceLegacyCoachingBrand(data.teacher.qualifications),
      experience: replaceLegacyCoachingBrand(data.teacher.experience),
      classesTaught: replaceLegacyCoachingBrand(data.teacher.classesTaught),
      skills: (data.teacher.skills || []).map(replaceLegacyCoachingBrand),
      subjectsTaught: (data.teacher.subjectsTaught || []).map(replaceLegacyCoachingBrand),
    },
    gallery: (data.gallery || []).map((item) => ({
      ...item,
      title: replaceLegacyCoachingBrand(item.title),
      caption: replaceLegacyCoachingBrand(item.caption),
    })),
    learningHub: (data.learningHub || []).map((res) => ({
      ...res,
      title: replaceLegacyCoachingBrand(res.title),
      summary: replaceLegacyCoachingBrand(res.summary),
      content: replaceLegacyCoachingBrand(res.content),
    })),
    dailyUpdates: (data.dailyUpdates || []).map((upd) => ({
      ...upd,
      title: replaceLegacyCoachingBrand(upd.title),
      description: replaceLegacyCoachingBrand(upd.description),
    })),
  };
}

export function isTransientGeminiApiError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${(error as { status?: unknown; code?: unknown }).status ?? ''} ${(error as { code?: unknown }).code ?? ''} ${error.message}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error ?? '');
  const lower = raw.toLowerCase();
  if (!lower.trim()) return false;

  // Never retry invalid auth / bad model / bad request errors
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('invalid_argument') ||
    lower.includes('not_found') ||
    lower.includes('404') ||
    /\b400\b/.test(lower)
  ) {
    return false;
  }

  return (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('abort') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('empty model response')
  );
}

export function isGeminiKeyAuthError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${(error as { status?: unknown; code?: unknown }).status ?? ''} ${error.message}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('access_token_scope_insufficient') ||
    /\b403\b/.test(lower)
  );
}

export function isGeminiModelNotFoundError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${(error as { status?: unknown; code?: unknown }).status ?? ''} ${error.message}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error ?? '');
  const lower = raw.toLowerCase();
  return lower.includes('not_found') || /\b404\b/.test(lower);
}

export interface MultiModelRouteSpec {
  model: string;
  label: string;
  thinkingLevel?: 'LOW' | 'MINIMAL';
  supportsThinkingLevel?: boolean;
  useCompactLiteParams: boolean;
  timeoutMs: number;
}

export interface MultiModelFallbackOptions<R extends MultiModelRouteSpec> {
  routes: R[];
  maxRetries?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldAbort?: () => boolean;
  onStatus?: (info: {
    attempt: number;
    route: R;
    reason: 'failover' | 'backoff';
    delayMs: number;
    error: unknown;
  }) => void;
}

export async function executeMultiModelWithFallback<T, R extends MultiModelRouteSpec>(
  routesToRun: (route: R, attemptIndex: number) => Promise<T>,
  options: MultiModelFallbackOptions<R>,
): Promise<{ result: T; route: R; attempt: number }> {
  const {
    routes,
    maxRetries = 4,
    maxAttempts: explicitMaxAttempts,
    baseDelayMs = 450,
    maxDelayMs = 3200,
    shouldAbort,
    onStatus,
  } = options;

  const totalTransientAttempts =
    typeof explicitMaxAttempts === 'number' && explicitMaxAttempts > 0
      ? explicitMaxAttempts
      : Math.max(1, maxRetries + 1);

  if (!routes.length) {
    throw new Error('No Gemini model routes configured.');
  }

  let lastError: unknown;
  let backoffRound = 0;
  let transientAttemptsUsed = 0;
  const skippedNotFoundModels = new Set<string>();
  const maxTotalIterations = totalTransientAttempts + routes.length;

  for (let iteration = 0, routeIdx = 0; iteration < maxTotalIterations; iteration += 1) {
    if (shouldAbort?.()) {
      throw lastError ?? new Error('Request cancelled.');
    }

    // Advance past models already discovered to be 404/unavailable in this call
    let foundCandidate = false;
    for (let probe = 0; probe < routes.length; probe += 1) {
      const candidate = routes[(routeIdx + probe) % routes.length];
      if (!skippedNotFoundModels.has(candidate.model)) {
        routeIdx = (routeIdx + probe) % routes.length;
        foundCandidate = true;
        break;
      }
    }
    if (!foundCandidate) {
      throw lastError ?? new Error('All configured Gemini models returned not found.');
    }

    const route = routes[routeIdx];
    try {
      const result = await routesToRun(route, transientAttemptsUsed);
      return { result, route, attempt: transientAttemptsUsed };
    } catch (error) {
      lastError = error;

      // Stop immediately on client disconnect or invalid API key / auth error
      if (shouldAbort?.() || isGeminiKeyAuthError(error)) {
        throw error;
      }

      const modelNotFound = isGeminiModelNotFoundError(error);
      if (modelNotFound) {
        skippedNotFoundModels.add(route.model);
        const hasRemainingModel = routes.some((r) => !skippedNotFoundModels.has(r.model));
        if (!hasRemainingModel) {
          throw error;
        }
        routeIdx = (routeIdx + 1) % routes.length;
        onStatus?.({
          attempt: transientAttemptsUsed + 1,
          route: routes[routeIdx],
          reason: 'failover',
          delayMs: 0,
          error,
        });
        continue;
      }

      transientAttemptsUsed += 1;
      const isLastAttempt = transientAttemptsUsed >= totalTransientAttempts;
      if (isLastAttempt) {
        throw error;
      }

      const nextIdx = (routeIdx + 1) % routes.length;
      const nextRoute = routes[nextIdx];
      const switchingToDistinctModel = nextRoute.model !== route.model;
      const canFailoverOrRetry =
        isTransientGeminiApiError(error) ||
        switchingToDistinctModel;

      if (!canFailoverOrRetry) {
        throw error;
      }

      // Instant failover (0ms wait) on the first switch to a distinct secondary model;
      // apply exponential backoff with random jitter on subsequent retry rounds.
      let delayMs = 0;
      let reason: 'failover' | 'backoff' = 'failover';

      if (backoffRound === 0 && transientAttemptsUsed === 1 && switchingToDistinctModel) {
        delayMs = 0;
        reason = 'failover';
      } else {
        const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, backoffRound));
        const maxJitter = Math.max(1, Math.min(350, Math.round(expDelay * 0.25)));
        const jitter = Math.floor(Math.random() * maxJitter);
        delayMs = expDelay + jitter;
        backoffRound += 1;
        reason = 'backoff';
      }

      routeIdx = nextIdx;
      onStatus?.({ attempt: transientAttemptsUsed, route: nextRoute, reason, delayMs, error });
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export interface MissionAiCacheEntry {
  answer: string;
  model?: string;
  cachedAt: number;
}

const MISSION_AI_CACHE_STORAGE_KEY = 'amp_mission_ai_response_cache_v1';
const MISSION_AI_CACHE_MAX_ENTRIES = 50;
const MISSION_AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const missionAiMemoryCache = new Map<string, MissionAiCacheEntry>();

export function buildMissionAiCacheKey(
  messages: Array<{ role: string; text: string }>,
  languagePreference = 'bilingual',
): string {
  const normalized = messages
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
      text: (m.text || '').trim().replace(/\s+/g, ' ').toLowerCase(),
    }))
    .filter((m) => m.text.length > 0);
  return `${languagePreference}::${JSON.stringify(normalized)}`;
}

function pruneMissionAiCacheEntries(
  entries: Record<string, MissionAiCacheEntry>,
  now = Date.now(),
  ttlMs = MISSION_AI_CACHE_TTL_MS,
  maxEntries = MISSION_AI_CACHE_MAX_ENTRIES,
): Record<string, MissionAiCacheEntry> {
  const valid = Object.entries(entries)
    .filter(([, val]) => val && typeof val.answer === 'string' && val.answer.trim() && now - val.cachedAt < ttlMs)
    .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    .slice(0, maxEntries);
  return Object.fromEntries(valid);
}

export function getCachedMissionAiResponse(
  cacheKey: string,
  options?: { ttlMs?: number; now?: number },
): MissionAiCacheEntry | null {
  if (!cacheKey) return null;
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? MISSION_AI_CACHE_TTL_MS;

  const memHit = missionAiMemoryCache.get(cacheKey);
  if (memHit && now - memHit.cachedAt < ttlMs && memHit.answer.trim()) {
    return memHit;
  }
  if (memHit) {
    missionAiMemoryCache.delete(cacheKey);
  }

  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(MISSION_AI_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, MissionAiCacheEntry>;
    const entry = parsed[cacheKey];
    if (entry && typeof entry.answer === 'string' && entry.answer.trim() && now - entry.cachedAt < ttlMs) {
      missionAiMemoryCache.set(cacheKey, entry);
      return entry;
    }
  } catch {
    // Ignore storage read errors in restricted browsers
  }
  return null;
}

export function setCachedMissionAiResponse(
  cacheKey: string,
  answer: string,
  model?: string,
  options?: { now?: number; ttlMs?: number; maxEntries?: number },
): void {
  const cleanAnswer = (answer || '').trim();
  if (!cacheKey || !cleanAnswer) return;

  const now = options?.now ?? Date.now();
  const entry: MissionAiCacheEntry = {
    answer: cleanAnswer,
    model,
    cachedAt: now,
  };

  missionAiMemoryCache.set(cacheKey, entry);
  if (missionAiMemoryCache.size > (options?.maxEntries ?? MISSION_AI_CACHE_MAX_ENTRIES)) {
    const oldestKey = missionAiMemoryCache.keys().next().value;
    if (oldestKey) missionAiMemoryCache.delete(oldestKey);
  }

  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(MISSION_AI_CACHE_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, MissionAiCacheEntry>) : {};
    existing[cacheKey] = entry;
    const pruned = pruneMissionAiCacheEntries(
      existing,
      now,
      options?.ttlMs ?? MISSION_AI_CACHE_TTL_MS,
      options?.maxEntries ?? MISSION_AI_CACHE_MAX_ENTRIES,
    );
    localStorage.setItem(MISSION_AI_CACHE_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Ignore localStorage quota / private browsing errors
  }
}

export function clearCachedMissionAiResponses(): void {
  missionAiMemoryCache.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MISSION_AI_CACHE_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

export function formatFriendlyAiError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('gemini_api_key') ||
    lower.includes('not configured') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    return 'Gemini API key needs attention in Settings > Secrets (or Vercel Environment Variables) before Mission AI can answer.';
  }
  if (
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return 'Too many questions arrived at once — wait a couple of seconds and click Ask Again. Your question is saved right here (एक साथ कई प्रश्न आए हैं, कृपया कुछ सेकंड बाद Ask Again दबाएं).';
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return 'The AI service experienced heavy traffic across backup models. Your question is saved — click Ask Again to send it once more (उच्च ट्रैफ़िक के कारण उत्तर नहीं मिल सका, कृपया Ask Again दबाएं).';
  }
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('504') ||
    lower.includes('fetch') ||
    lower.includes('network')
  ) {
    return 'The reply took longer than expected due to a brief connection delay. Your question is saved — click Ask Again to continue (कनेक्शन में देरी हुई, कृपया Ask Again दबाएं).';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return 'The requested AI model is currently unavailable. Click Ask Again in a moment to try the backup model.';
  }
  return 'Could not finish this answer right now. Your question is saved right here — click Ask Again to continue.';
}


export const ADMIN_PASSCODE_SALT = 'amp-admin-rauli-v1';
export const ADMIN_PASSCODE_HASH =
  '37bf71c059da69581cfea52fa79cb0a43026cc8c86c02fa985640eda3d4ad6b4';

export async function verifyAdminPasscodeHash(input: string): Promise<boolean> {
  if (!input || !globalThis.crypto?.subtle) {
    return false;
  }
  const encoded = new TextEncoder().encode(`${ADMIN_PASSCODE_SALT}:${input}`);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const digestHex = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (digestHex.length !== ADMIN_PASSCODE_HASH.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < digestHex.length; i += 1) {
    mismatch |= digestHex.charCodeAt(i) ^ ADMIN_PASSCODE_HASH.charCodeAt(i);
  }
  return mismatch === 0;
}

export function applyRealtimeCloudUpdate(
  base: SiteData,
  cloud: Partial<SiteData>,
): SiteData {
  return normalizeSiteBrandData({
    coaching: cloud.coaching
      ? { ...base.coaching, ...omitUndefinedKeys<CoachingInfo>(cloud.coaching) }
      : base.coaching,
    socialLinks: cloud.socialLinks
      ? { ...base.socialLinks, ...omitUndefinedKeys<SocialLinks>(cloud.socialLinks) }
      : base.socialLinks,
    teacher: cloud.teacher
      ? { ...base.teacher, ...omitUndefinedKeys<TeacherProfile>(cloud.teacher) }
      : base.teacher,
    gallery: cloud.gallery !== undefined ? cloud.gallery : base.gallery,
    learningHub: cloud.learningHub !== undefined ? cloud.learningHub : base.learningHub,
    dailyUpdates: cloud.dailyUpdates !== undefined ? cloud.dailyUpdates : base.dailyUpdates,
    enquiries: base.enquiries,
    feedbacks: base.feedbacks,
  });
}

export function extractFirebaseErrorText(error: unknown): string {
  const parts: string[] = [];
  if (error && typeof error === 'object') {
    const maybe = error as { code?: unknown; message?: unknown };
    if (typeof maybe.code === 'string' && maybe.code.trim()) {
      parts.push(maybe.code.trim());
    }
    if (typeof maybe.message === 'string' && maybe.message.trim()) {
      const msg = maybe.message.trim();
      parts.push(msg);
      if (msg.startsWith('{')) {
        try {
          const parsed = JSON.parse(msg) as { error?: unknown };
          if (typeof parsed.error === 'string' && parsed.error.trim()) {
            parts.push(parsed.error.trim());
          }
        } catch {
          // Ignore non-JSON error strings
        }
      }
    }
  } else if (typeof error === 'string') {
    parts.push(error);
  } else if (error != null) {
    parts.push(String(error));
  }
  return parts.join(' ').trim();
}

export function isTransientFirebaseNetworkError(error: unknown): boolean {
  const text = extractFirebaseErrorText(error).toLowerCase();
  if (!text) return false;

  // Non-retryable user/popup/auth-policy or permission failures
  if (
    text.includes('auth/popup-closed-by-user') ||
    text.includes('auth/cancelled-popup-request') ||
    text.includes('auth/popup-blocked') ||
    text.includes('auth/user-cancelled') ||
    text.includes('auth/unauthorized-domain') ||
    text.includes('permission-denied') ||
    text.includes('missing or insufficient permissions') ||
    text.includes('unauthenticated')
  ) {
    return false;
  }

  return (
    text.includes('auth/network-request-failed') ||
    text.includes('network-request-failed') ||
    text.includes('auth/timeout') ||
    text.includes('unavailable') ||
    text.includes('deadline-exceeded') ||
    text.includes('client is offline') ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network error') ||
    text.includes('err_network') ||
    text.includes('err_internet_disconnected') ||
    text.includes('err_name_not_resolved') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('enotfound')
  );
}

export interface RetryBackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryBackoffOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, options.maxRetries ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 4000);
  const shouldRetry = options.shouldRetry ?? isTransientFirebaseNetworkError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      options.onRetry?.(attempt + 1, delayMs, error);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export interface FormattedFirebaseAdminError {
  message: string;
  hint?: string;
  isNetworkError: boolean;
  isRetryable: boolean;
}

export function formatFirebaseAdminError(error: unknown): FormattedFirebaseAdminError {
  const text = extractFirebaseErrorText(error).toLowerCase();

  if (isTransientFirebaseNetworkError(error)) {
    return {
      message:
        'Connection to Firebase was interrupted before completing this request.',
      hint: 'Please check your internet connection, DNS settings, or disable any VPN/ad-blocker, then click Retry. Your unsaved edits remain safely preserved locally and can be exported as a JSON backup.',
      isNetworkError: true,
      isRetryable: true,
    };
  }

  if (text.includes('auth/popup-blocked')) {
    return {
      message: 'Google sign-in popup was blocked by your browser.',
      hint: 'Please allow popups for this site in your browser address bar and click Retry.',
      isNetworkError: false,
      isRetryable: true,
    };
  }

  if (
    text.includes('auth/popup-closed-by-user') ||
    text.includes('auth/cancelled-popup-request') ||
    text.includes('auth/user-cancelled')
  ) {
    return {
      message: 'Google sign-in was closed before finishing.',
      hint: 'Click Retry to sign in with your owner Google account. Your unsaved edits are still preserved.',
      isNetworkError: false,
      isRetryable: true,
    };
  }

  if (text.includes('auth/unauthorized-domain')) {
    return {
      message: 'This website domain is not yet authorized for Firebase Google Sign-In.',
      hint: 'Your edits are preserved locally—you can export a JSON backup while domain authorization is enabled in Firebase.',
      isNetworkError: false,
      isRetryable: false,
    };
  }

  if (
    text.includes('permission-denied') ||
    text.includes('missing or insufficient permissions')
  ) {
    return {
      message: 'Your Google account does not have owner write permission for Cloud Sync.',
      hint: 'Connect using the owner Google account, or download a JSON backup so your edits stay safe.',
      isNetworkError: false,
      isRetryable: true,
    };
  }

  if (text.includes('resource-exhausted') || text.includes('quota')) {
    return {
      message: 'Cloud database request quota was temporarily reached.',
      hint: 'Your edits are preserved locally. Download a JSON backup now and retry later.',
      isNetworkError: false,
      isRetryable: true,
    };
  }

  return {
    message: 'Could not complete the cloud request right now.',
    hint: 'Your unsaved edits are preserved locally. Please check your connection and click Retry, or export a JSON backup.',
    isNetworkError: false,
    isRetryable: true,
  };
}

export function buildSiteDataWithDraftEdits(
  base: SiteData,
  drafts: {
    coaching?: CoachingInfo | null;
    socialLinks?: SocialLinks | null;
    teacher?: TeacherProfile | null;
    skillsText?: string;
    subjectsText?: string;
  },
): SiteData {
  const nextTeacher: TeacherProfile = drafts.teacher
    ? {
        ...drafts.teacher,
        skills:
          typeof drafts.skillsText === 'string'
            ? drafts.skillsText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            : drafts.teacher.skills,
        subjectsTaught:
          typeof drafts.subjectsText === 'string'
            ? drafts.subjectsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : drafts.teacher.subjectsTaught,
      }
    : base.teacher;

  return {
    coaching: drafts.coaching ? { ...base.coaching, ...drafts.coaching } : base.coaching,
    socialLinks: drafts.socialLinks
      ? { ...base.socialLinks, ...drafts.socialLinks }
      : base.socialLinks,
    teacher: nextTeacher,
    gallery: base.gallery,
    learningHub: base.learningHub,
    dailyUpdates: base.dailyUpdates,
    enquiries: base.enquiries,
    feedbacks: base.feedbacks,
  };
}

export const ADMIN_DRAFT_STORAGE_KEY = 'amp_admin_unsaved_draft_v1';

export interface AdminDraftSnapshot {
  updatedAt: string;
  reason: 'editing' | 'network-error';
  siteData: SiteData;
  skillsText?: string;
  subjectsText?: string;
  pendingGalleryDraft?: {
    title: string;
    caption: string;
    category: GalleryCategory;
    mediaType: 'image' | 'video' | 'pdf';
    mediaUrl: string;
    thumbnailUrl: string;
    published: boolean;
  };
  pendingHubDraft?: {
    title: string;
    topicArea: string;
    summary: string;
    content: string;
    languageNote: string;
    formulasText: string;
    pdfUrl: string;
    pdfName: string;
    published: boolean;
  };
}

export function saveAdminDraftToStorage(snapshot: AdminDraftSnapshot): boolean {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(ADMIN_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadAdminDraftFromStorage(): AdminDraftSnapshot | null {
  try {
    if (!globalThis.localStorage) return null;
    const raw = globalThis.localStorage.getItem(ADMIN_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminDraftSnapshot>;
    if (!parsed || !parsed.siteData || !parsed.updatedAt) return null;
    return parsed as AdminDraftSnapshot;
  } catch {
    return null;
  }
}

export function clearAdminDraftFromStorage(): void {
  try {
    globalThis.localStorage?.removeItem(ADMIN_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function formatDisplayDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeFeedbackEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  const normalized = normalizeFeedbackEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) && normalized.length <= 160;
}

export async function hashNormalizedEmail(email: string): Promise<string> {
  const normalized = normalizeFeedbackEmail(email);
  if (!normalized) return '';
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-char hex only if SubtleCrypto is unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.repeat(4);
}

export function validateFeedbackInput(input: {
  fullName?: string;
  email?: string;
  rating?: unknown;
  feedback?: string;
}): {
  valid: boolean;
  error?: string;
  normalizedEmail?: string;
  rating?: number;
} {
  const fullName = (input.fullName || '').trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return { valid: false, error: 'Please enter your full name (at least 2 characters).' };
  }
  const normalizedEmail = normalizeFeedbackEmail(input.email || '');
  if (!isValidEmailAddress(normalizedEmail)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  const numericRating = Number(input.rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { valid: false, error: 'Please select a star rating between 1 and 5.' };
  }
  const feedback = (input.feedback || '').trim();
  if (feedback.length < 5 || feedback.length > 2000) {
    return {
      valid: false,
      error: 'Please write your feedback, suggestion, or concern (at least 5 characters).',
    };
  }
  return { valid: true, normalizedEmail, rating: numericRating };
}

export function hasDuplicateFeedbackEmail(
  existing: FeedbackRatingItem[],
  email: string,
): boolean {
  const target = normalizeFeedbackEmail(email);
  if (!target) return false;
  return existing.some((item) => normalizeFeedbackEmail(item.email) === target);
}

export function filterAdminFeedbacks(
  items: FeedbackRatingItem[],
  starFilter: number | 'all',
  query: string,
): FeedbackRatingItem[] {
  const q = query.trim().toLowerCase();
  return [...items]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((item) => {
      if (starFilter !== 'all' && item.rating !== starFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.feedback.toLowerCase().includes(q)
      );
    });
}

export function computeFeedbackStats(items: FeedbackRatingItem[]): {
  total: number;
  average: number;
} {
  if (!items.length) return { total: 0, average: 0 };
  const sum = items.reduce((acc, item) => acc + (Number(item.rating) || 0), 0);
  return {
    total: items.length,
    average: Number((sum / items.length).toFixed(1)),
  };
}

export function sortDailyUpdatesByDate(items: DailyUpdateItem[]): DailyUpdateItem[] {
  return [...items].sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    const updatedDiff = (b.updatedAt || b.createdAt || '').localeCompare(
      a.updatedAt || a.createdAt || '',
    );
    return updatedDiff;
  });
}

export function filterDailyUpdates(
  items: DailyUpdateItem[],
  mediaFilter: 'all' | DailyUpdateMediaType,
  query: string,
  includeUnpublished = false,
): DailyUpdateItem[] {
  const q = query.trim().toLowerCase();
  return sortDailyUpdatesByDate(items).filter((item) => {
    if (!includeUnpublished && !item.published) return false;
    if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.date.toLowerCase().includes(q) ||
      (item.fileName || '').toLowerCase().includes(q)
    );
  });
}

export function validateDailyUpdateInput(input: Partial<DailyUpdateItem>): {
  valid: boolean;
  error?: string;
} {
  const title = (input.title || '').trim();
  if (title.length < 2 || title.length > 200) {
    return { valid: false, error: 'Update title is required (2–200 characters).' };
  }
  const dateStr = (input.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: 'Please select a valid date (YYYY-MM-DD).' };
  }
  const mediaType = input.mediaType || 'none';
  if (!['none', 'image', 'video', 'pdf'].includes(mediaType)) {
    return { valid: false, error: 'Invalid media type for update.' };
  }
  const hasMedia = Boolean((input.mediaUrl || '').trim());
  const desc = (input.description || '').trim();
  if (mediaType !== 'none' && !hasMedia) {
    return { valid: false, error: 'Please upload a file or paste a valid URL for this update.' };
  }
  if (!desc && mediaType === 'none') {
    return { valid: false, error: 'Please enter a description or attach a photo, video, or PDF.' };
  }
  if (desc.length > 4000) {
    return { valid: false, error: 'Description must be under 4000 characters.' };
  }
  return { valid: true };
}

export function getUploadLimitForMediaType(
  filename: string,
  mimeType: string,
): { kind: 'image' | 'video' | 'pdf' | 'unknown'; maxBytes: number; label: string } {
  if (isPdfFileOrUrl(filename, mimeType)) {
    return { kind: 'pdf', maxBytes: 25 * 1024 * 1024, label: '25 MB' };
  }
  if (isVideoFileOrUrl(filename, mimeType)) {
    return { kind: 'video', maxBytes: 100 * 1024 * 1024, label: '100 MB' };
  }
  const cleanExt = filename.split('.').pop()?.toLowerCase() || '';
  if (
    mimeType.toLowerCase().startsWith('image/') ||
    /^(png|jpe?g|gif|webp|svg|avif|bmp|heic)$/.test(cleanExt)
  ) {
    return { kind: 'image', maxBytes: 10 * 1024 * 1024, label: '10 MB' };
  }
  return { kind: 'unknown', maxBytes: 0, label: '0 MB' };
}

export function resolveHeroCaptionDisplay(coaching: CoachingInfo): {
  title: string;
  text: string;
  visible: boolean;
} {
  const hasExplicitCaptionFields =
    coaching.heroCaptionTitle !== undefined || coaching.heroCaptionText !== undefined;

  if (hasExplicitCaptionFields) {
    const title = (coaching.heroCaptionTitle ?? '').trim();
    const text = (coaching.heroCaptionText ?? '').trim();
    return {
      title,
      text,
      visible: Boolean(title || text),
    };
  }

  const title = 'Campus & Classroom Mentorship';
  const text = [coaching.officeHours, coaching.address]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' · ');

  return {
    title,
    text,
    visible: Boolean(title || text),
  };
}




