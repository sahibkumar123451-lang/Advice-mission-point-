import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRealtimeCloudUpdate,
  buildSiteDataWithDraftEdits,
  clearAdminDraftFromStorage,
  detectUploadCategoryAndType,
  filterAdminGalleryItems,
  filterAdminLearningResources,
  filterGalleryItems,
  filterLearningResources,
  formatFirebaseAdminError,
  formatFriendlyAiError,
  formatTitleFromFilename,
  getYouTubeEmbedUrl,
  isPdfFileOrUrl,
  isTransientFirebaseNetworkError,
  isVideoFileOrUrl,
  loadAdminDraftFromStorage,
  mergeSiteDataPreserveExisting,
  normalizeAiConversationHistory,
  normalizeExternalUrl,
  normalizeSafeMediaOrExternalUrl,
  normalizeWhatsAppUrl,
  retryWithExponentialBackoff,
  saveAdminDraftToStorage,
  validateCoachingInfo,
  validateEnquiryInput,
  validateGalleryInput,
  validateLearningResourceInput,
  validateTeacherProfile,
  verifyAdminPasscodeHash,
} from './coachingLogic';
import { DEFAULT_SITE_DATA } from './seedData';

test('normalizeExternalUrl blocks unsafe schemes and prepends https', () => {
  assert.equal(normalizeExternalUrl('javascript:alert(1)'), '');
  assert.equal(normalizeExternalUrl('data:text/html,hi'), '');
  assert.equal(normalizeExternalUrl('instagram.com/advicemission'), 'https://instagram.com/advicemission');
  assert.equal(normalizeExternalUrl('https://youtube.com/@amp'), 'https://youtube.com/@amp');
});

test('normalizeWhatsAppUrl converts 10-digit Indian phone numbers and preserves wa.me links', () => {
  assert.equal(normalizeWhatsAppUrl('9876543210'), 'https://wa.me/919876543210');
  assert.equal(normalizeWhatsAppUrl('+91 98765-43210'), 'https://wa.me/919876543210');
  assert.equal(normalizeWhatsAppUrl('https://wa.me/919800000000'), 'https://wa.me/919800000000');
});

test('getYouTubeEmbedUrl parses watch, short, and youtu.be URLs', () => {
  assert.equal(
    getYouTubeEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ'),
    'https://www.youtube.com/embed/abc123XYZ',
  );
  assert.equal(
    getYouTubeEmbedUrl('https://youtu.be/abc123XYZ'),
    'https://www.youtube.com/embed/abc123XYZ',
  );
  assert.equal(
    getYouTubeEmbedUrl('https://youtube.com/shorts/short99'),
    'https://www.youtube.com/embed/short99',
  );
  assert.equal(getYouTubeEmbedUrl('https://example.com/video.mp4'), null);
});

test('filterGalleryItems filters by category and published state', () => {
  const items = [
    ...DEFAULT_SITE_DATA.gallery,
    {
      id: 'draft-1',
      title: 'Unpublished Draft',
      caption: 'Hidden',
      category: 'events' as const,
      mediaType: 'image' as const,
      mediaUrl: '/test.jpg',
      published: false,
      createdAt: '2026-11-16T00:00:00.000Z',
    },
  ];
  assert.equal(filterGalleryItems(items, 'all', false).length, 5);
  assert.equal(filterGalleryItems(items, 'all', true).length, 6);
  assert.equal(filterGalleryItems(items, 'events', false).length, 1);
  assert.equal(filterGalleryItems(items, 'events', true).length, 2);
});

test('filterLearningResources filters by search query and topic area', () => {
  const results = filterLearningResources(DEFAULT_SITE_DATA.learningHub, 'newton', 'all', false);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'hub-1');

  const mathResults = filterLearningResources(DEFAULT_SITE_DATA.learningHub, '', 'Mathematics', false);
  assert.equal(mathResults.length, 1);
  assert.equal(mathResults[0].id, 'hub-2');
});

test('media type & filename helpers detect photos, videos, and PDFs cleanly', () => {
  assert.equal(isPdfFileOrUrl('notes.PDF'), true);
  assert.equal(isPdfFileOrUrl('/uploads/doc', 'application/pdf'), true);
  assert.equal(isPdfFileOrUrl('/uploads/photo.jpg', 'image/jpeg'), false);

  assert.equal(isVideoFileOrUrl('lecture.mp4'), true);
  assert.equal(isVideoFileOrUrl('clip', 'video/webm'), true);
  assert.equal(isVideoFileOrUrl('photo.png', 'image/png'), false);

  assert.deepEqual(detectUploadCategoryAndType('physics.pdf', 'application/pdf', 'classroom'), {
    mediaType: 'pdf',
    category: 'pdfs',
  });
  assert.deepEqual(detectUploadCategoryAndType('batch_video.mp4', 'video/mp4', 'coaching'), {
    mediaType: 'video',
    category: 'videos',
  });
  assert.deepEqual(detectUploadCategoryAndType('campus.jpg', 'image/jpeg', 'classroom'), {
    mediaType: 'image',
    category: 'classroom',
  });

  assert.equal(formatTitleFromFilename('Class_10-Math_Notes.pdf'), 'Class 10 Math Notes');
});

test('validation helpers catch missing required fields and allow PDF resources', () => {
  assert.equal(validateTeacherProfile({ name: '' }).valid, false);
  assert.equal(validateTeacherProfile(DEFAULT_SITE_DATA.teacher).valid, true);

  assert.equal(
    validateCoachingInfo(DEFAULT_SITE_DATA.coaching, DEFAULT_SITE_DATA.socialLinks).valid,
    true,
  );
  assert.equal(
    validateCoachingInfo({ ...DEFAULT_SITE_DATA.coaching, googleMapsUrl: '' }, DEFAULT_SITE_DATA.socialLinks).valid,
    false,
  );

  assert.equal(validateGalleryInput({ title: 'Test', mediaUrl: '/x.jpg', category: 'coaching' }).valid, true);
  assert.equal(validateGalleryInput({ title: 'PDF Notes', mediaUrl: '/x.pdf', category: 'pdfs' }).valid, true);
  assert.equal(validateGalleryInput({ title: '', mediaUrl: '/x.jpg', category: 'coaching' }).valid, false);

  assert.equal(
    validateLearningResourceInput({
      title: 'Formula PDF',
      topicArea: 'Mathematics',
      pdfUrl: '/uploads/math.pdf',
      summary: '',
      content: '',
    }).valid,
    true,
  );
  assert.equal(
    validateLearningResourceInput({
      title: 'Empty Resource',
      topicArea: 'Mathematics',
      summary: '',
      content: '',
    }).valid,
    false,
  );

  assert.equal(
    validateEnquiryInput({ studentName: 'Aarav', phoneOrEmail: '9876543210', message: 'Class 10 enquiry' }).valid,
    true,
  );
  assert.equal(
    validateEnquiryInput({ studentName: '', phoneOrEmail: '9876543210', message: 'Hi' }).valid,
    false,
  );
});

test('filterAdminGalleryItems and filterAdminLearningResources support search and media-type tabs', () => {
  const items = [
    ...DEFAULT_SITE_DATA.gallery,
    {
      id: 'gal-pdf-1',
      title: 'Class 10 Trigonometry Sheet',
      caption: 'Important formulas PDF',
      category: 'pdfs' as const,
      mediaType: 'pdf' as const,
      mediaUrl: '/uploads/trig.pdf',
      published: false,
      createdAt: '2026-11-18T00:00:00.000Z',
    },
  ];

  assert.equal(filterAdminGalleryItems(items, 'all', '').length, 6);
  assert.equal(filterAdminGalleryItems(items, 'image', '').length, 4);
  assert.equal(filterAdminGalleryItems(items, 'video', '').length, 1);
  assert.equal(filterAdminGalleryItems(items, 'pdf', '').length, 1);
  assert.equal(filterAdminGalleryItems(items, 'all', 'trigonometry').length, 1);
  assert.equal(filterAdminGalleryItems(items, 'image', 'trigonometry').length, 0);

  const hubWithPdf = [
    ...DEFAULT_SITE_DATA.learningHub,
    {
      id: 'hub-pdf-1',
      title: 'Bihar Board Model Set',
      topicArea: 'Science',
      summary: 'Model questions with answers',
      content: 'Open PDF',
      languageNote: 'Hindi + English Bilingual',
      keyFormulas: [],
      pdfUrl: '/uploads/model-set.pdf',
      pdfName: 'bihar_model_2026.pdf',
      published: false,
      updatedAt: '2026-11-18T00:00:00.000Z',
    },
  ];
  assert.equal(filterAdminLearningResources(hubWithPdf, '').length, 5);
  assert.equal(filterAdminLearningResources(hubWithPdf, 'bihar_model').length, 1);
  assert.equal(filterAdminLearningResources(hubWithPdf, 'algebra').length, 1);
});

test('normalizeAiConversationHistory cleans leading assistant turns and merges consecutive user turns', () => {
  const turns = normalizeAiConversationHistory([
    { role: 'assistant', text: 'Welcome!' },
    { role: 'user', text: 'First question' },
    { role: 'user', text: 'Follow-up after error' },
    { role: 'assistant', text: 'Answer' },
    { role: 'user', text: '   ' },
  ]);

  assert.equal(turns.length, 2);
  assert.equal(turns[0].role, 'user');
  assert.equal(turns[0].parts[0].text, 'First question\n\nFollow-up after error');
  assert.equal(turns[1].role, 'model');
  assert.equal(turns[1].parts[0].text, 'Answer');
});

test('normalizeSafeMediaOrExternalUrl allows safe image/pdf data URLs and blocks unsafe schemes', () => {
  assert.equal(
    normalizeSafeMediaOrExternalUrl('data:image/jpeg;base64,abc123'),
    'data:image/jpeg;base64,abc123',
  );
  assert.equal(
    normalizeSafeMediaOrExternalUrl('data:application/pdf;base64,JVBERi0x'),
    'data:application/pdf;base64,JVBERi0x',
  );
  assert.equal(normalizeSafeMediaOrExternalUrl('data:text/html,<script>'), '');
  assert.equal(normalizeSafeMediaOrExternalUrl('javascript:alert(1)'), '');
  assert.equal(normalizeSafeMediaOrExternalUrl('/uploads/pic.jpg'), '/uploads/pic.jpg');
});

test('mergeSiteDataPreserveExisting preserves previous items while applying incoming edits', () => {
  const customOldItem = {
    id: 'gal-old-custom',
    title: 'Old Custom Photo',
    caption: 'Must not disappear',
    category: 'coaching' as const,
    mediaType: 'image' as const,
    mediaUrl: '/uploads/old.jpg',
    published: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
  const newItem = {
    id: 'gal-new-custom',
    title: 'New Custom Photo',
    caption: 'Newly added',
    category: 'events' as const,
    mediaType: 'image' as const,
    mediaUrl: '/uploads/new.jpg',
    published: true,
    createdAt: '2026-11-20T00:00:00.000Z',
  };

  const merged = mergeSiteDataPreserveExisting(
    { ...DEFAULT_SITE_DATA, gallery: [customOldItem, ...DEFAULT_SITE_DATA.gallery] },
    {
      teacher: { ...DEFAULT_SITE_DATA.teacher, name: 'Surendra Sir' },
      gallery: [newItem],
    },
  );

  assert.equal(merged.teacher.name, 'Surendra Sir');
  assert.ok(merged.gallery.some((g) => g.id === 'gal-old-custom'));
  assert.ok(merged.gallery.some((g) => g.id === 'gal-new-custom'));
  assert.ok(merged.gallery.some((g) => g.id === 'gal-1'));
});

test('formatFriendlyAiError hides raw JSON and explains transient 503 cleanly', () => {
  const msg = formatFriendlyAiError('{"error":{"code":503,"status":"UNAVAILABLE"}}');
  assert.equal(msg.includes('{'), false);
  assert.ok(msg.toLowerCase().includes('retry'));
});

test('verifyAdminPasscodeHash rejects empty and old/invalid passcodes', async () => {
  assert.equal(await verifyAdminPasscodeHash(''), false);
  assert.equal(await verifyAdminPasscodeHash('wrong-passcode'), false);
  assert.equal(await verifyAdminPasscodeHash('@surendra sir 9939'), false);
});

test('applyRealtimeCloudUpdate updates live fields and preserves unchanged sections', () => {
  const updated = applyRealtimeCloudUpdate(DEFAULT_SITE_DATA, {
    teacher: { ...DEFAULT_SITE_DATA.teacher, name: 'Hariom Sir' },
    gallery: [DEFAULT_SITE_DATA.gallery[0]],
  });

  assert.equal(updated.teacher.name, 'Hariom Sir');
  assert.equal(updated.coaching.name, DEFAULT_SITE_DATA.coaching.name);
  assert.equal(updated.gallery.length, 1);
  assert.equal(updated.learningHub.length, DEFAULT_SITE_DATA.learningHub.length);
});

test('isTransientFirebaseNetworkError identifies transient network failures and skips user/permission errors', () => {
  assert.equal(
    isTransientFirebaseNetworkError(new Error('Firebase: Error (auth/network-request-failed).')),
    true,
  );
  assert.equal(
    isTransientFirebaseNetworkError(
      new Error(JSON.stringify({ error: 'Firebase: Error (auth/network-request-failed).', path: 'teacherConfig/main' })),
    ),
    true,
  );
  assert.equal(
    isTransientFirebaseNetworkError(new Error('Failed to get document because the client is offline.')),
    true,
  );
  assert.equal(
    isTransientFirebaseNetworkError(new Error('Firebase: Error (auth/popup-closed-by-user).')),
    false,
  );
  assert.equal(
    isTransientFirebaseNetworkError(new Error('Missing or insufficient permissions.')),
    false,
  );
});

test('retryWithExponentialBackoff retries transient failures and stops immediately on non-transient errors', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await retryWithExponentialBackoff(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Firebase: Error (auth/network-request-failed).');
      }
      return 'connected';
    },
    {
      maxRetries: 3,
      baseDelayMs: 1,
      onRetry: (_attempt, delayMs) => delays.push(delayMs),
    },
  );
  assert.equal(result, 'connected');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1, 2]);

  let nonRetryAttempts = 0;
  await assert.rejects(
    retryWithExponentialBackoff(
      async () => {
        nonRetryAttempts += 1;
        throw new Error('Firebase: Error (auth/popup-closed-by-user).');
      },
      { maxRetries: 3, baseDelayMs: 1 },
    ),
  );
  assert.equal(nonRetryAttempts, 1);
});

test('formatFirebaseAdminError replaces raw auth/network-request-failed with clear DNS/VPN/internet guidance', () => {
  const formatted = formatFirebaseAdminError(new Error('Firebase: Error (auth/network-request-failed).'));
  assert.equal(formatted.isNetworkError, true);
  assert.equal(formatted.isRetryable, true);
  assert.equal(formatted.message.includes('auth/network-request-failed'), false);
  assert.ok(formatted.message.toLowerCase().includes('interrupted'));
  assert.ok((formatted.hint || '').toLowerCase().includes('internet'));
  assert.ok((formatted.hint || '').toLowerCase().includes('dns'));
  assert.ok((formatted.hint || '').toLowerCase().includes('vpn'));
});

test('buildSiteDataWithDraftEdits and draft storage preserve unsaved local edits cleanly', () => {
  const drafted = buildSiteDataWithDraftEdits(DEFAULT_SITE_DATA, {
    coaching: { ...DEFAULT_SITE_DATA.coaching, phone: '+91 99999 88888' },
    teacher: { ...DEFAULT_SITE_DATA.teacher, name: 'Updated Teacher' },
    skillsText: 'Physics\nMathematics',
    subjectsText: 'Physics, Maths',
  });

  assert.equal(drafted.coaching.phone, '+91 99999 88888');
  assert.equal(drafted.teacher.name, 'Updated Teacher');
  assert.deepEqual(drafted.teacher.skills, ['Physics', 'Mathematics']);
  assert.deepEqual(drafted.teacher.subjectsTaught, ['Physics', 'Maths']);

  const saved = saveAdminDraftToStorage({
    updatedAt: '2026-11-20T00:00:00.000Z',
    reason: 'network-error',
    siteData: drafted,
  });
  // In Node without window.localStorage, save returns false safely without throwing
  assert.equal(typeof saved, 'boolean');
  assert.equal(loadAdminDraftFromStorage(), null);
  clearAdminDraftFromStorage();
});


