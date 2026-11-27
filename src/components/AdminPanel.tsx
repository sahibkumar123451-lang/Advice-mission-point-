import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Film,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  CoachingInfo,
  DailyUpdateItem,
  DailyUpdateMediaType,
  EnquiryItem,
  GalleryCategory,
  GalleryItem,
  LearningResource,
  MediaType,
  SiteData,
  SocialLinks,
  TeacherProfile,
} from '../types/coaching';
import {
  type AdminDraftSnapshot,
  buildSiteDataWithDraftEdits,
  clearAdminDraftFromStorage,
  detectUploadCategoryAndType,
  filterAdminGalleryItems,
  filterAdminLearningResources,
  formatDisplayDate,
  formatFirebaseAdminError,
  formatTitleFromFilename,
  isPdfFileOrUrl,
  isVideoFileOrUrl,
  loadAdminDraftFromStorage,
  mergeSiteDataPreserveExisting,
  normalizeExternalUrl,
  normalizeSafeMediaOrExternalUrl,
  normalizeSiteBrandData,
  normalizeWhatsAppUrl,
  saveAdminDraftToStorage,
  validateCoachingInfo,
  validateGalleryInput,
  validateLearningResourceInput,
  validateTeacherProfile,
  verifyAdminPasscodeHash,
} from '../utils/coachingLogic';
import {
  deleteDailyUpdateFromCloud,
  deleteFeedbackFromCloud,
  deleteGalleryItemFromCloud,
  deleteLearningResourceFromCloud,
  loadAllAdminSiteDataFromFirestore,
  refreshAdminAuthSession,
  saveCoachingAndSocialsToCloud,
  saveDailyUpdateToCloud,
  saveGalleryItemToCloud,
  saveLearningResourceToCloud,
  saveTeacherToCloud,
  signInAdminWithGoogle,
  signOutFirebaseAdmin,
  subscribeToAuthChanges,
  syncSiteDataToCloudNonDestructive,
} from '../utils/firebaseClient';
import { compressImageToDataUrl, readSmallPdfAsDataUrl } from '../utils/mediaHelpers';
import { DEFAULT_SITE_DATA } from '../utils/seedData';
import { ResilientImage } from './ResilientImage';
import { AdminDailyUpdatesTab } from './admin/AdminDailyUpdatesTab';
import { AdminFeedbackTab } from './admin/AdminFeedbackTab';

export type AdminTab =
  | 'coaching'
  | 'teacher'
  | 'updates'
  | 'gallery'
  | 'hub'
  | 'feedback'
  | 'enquiries';

interface AdminPanelProps {
  isOpen: boolean;
  initialTab?: AdminTab;
  onClose: () => void;
  onSiteUpdated: () => Promise<void>;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL_CLASS = 'block text-xs font-semibold text-slate-300 mb-1';

export function AdminPanel({ isOpen, initialTab, onClose, onSiteUpdated }: AdminPanelProps) {
  const [passcode, setPasscode] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || 'coaching');
  const [adminData, setAdminData] = useState<SiteData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [hasRetryAction, setHasRetryAction] = useState(false);
  const retryCallbackRef = useRef<(() => Promise<void>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshingFeedbacks, setRefreshingFeedbacks] = useState(false);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [hasLocalPendingDraft, setHasLocalPendingDraft] = useState(false);
  const [savedDraftNotice, setSavedDraftNotice] = useState<AdminDraftSnapshot | null>(null);

  // Coaching & Social form state
  const [coachingForm, setCoachingForm] = useState<CoachingInfo | null>(null);
  const [socialForm, setSocialForm] = useState<SocialLinks | null>(null);

  // Teacher form state
  const [teacherForm, setTeacherForm] = useState<TeacherProfile | null>(null);
  const [skillsText, setSkillsText] = useState('');
  const [subjectsText, setSubjectsText] = useState('');

  // Gallery add-form & bulk upload state
  const [galTitle, setGalTitle] = useState('');
  const [galCaption, setGalCaption] = useState('');
  const [galCategory, setGalCategory] = useState<GalleryCategory>('coaching');
  const [galMediaType, setGalMediaType] = useState<MediaType>('image');
  const [galMediaUrl, setGalMediaUrl] = useState('');
  const [galThumbUrl, setGalThumbUrl] = useState('');
  const [galPublished, setGalPublished] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [bulkGalleryCategory, setBulkGalleryCategory] = useState<GalleryCategory>('coaching');
  const [bulkUploadProgress, setBulkUploadProgress] = useState<string | null>(null);
  const [isGalleryDragOver, setIsGalleryDragOver] = useState(false);
  const [galFilterType, setGalFilterType] = useState<'all' | 'image' | 'video' | 'pdf'>('all');
  const [galSearchQuery, setGalSearchQuery] = useState('');

  // Inline gallery item editor state
  const [inlineGalId, setInlineGalId] = useState<string | null>(null);
  const [inlineGalTitle, setInlineGalTitle] = useState('');
  const [inlineGalCaption, setInlineGalCaption] = useState('');
  const [inlineGalCategory, setInlineGalCategory] = useState<GalleryCategory>('coaching');
  const [inlineGalMediaType, setInlineGalMediaType] = useState<MediaType>('image');
  const [inlineGalMediaUrl, setInlineGalMediaUrl] = useState('');
  const [inlineGalThumbUrl, setInlineGalThumbUrl] = useState('');
  const [inlineGalPublished, setInlineGalPublished] = useState(true);

  // Learning Hub add-form & filter state
  const [hubTitle, setHubTitle] = useState('');
  const [hubTopic, setHubTopic] = useState('');
  const [hubSummary, setHubSummary] = useState('');
  const [hubContent, setHubContent] = useState('');
  const [hubLang, setHubLang] = useState('Hindi + English Bilingual');
  const [hubFormulasText, setHubFormulasText] = useState('');
  const [hubPdfUrl, setHubPdfUrl] = useState('');
  const [hubPdfName, setHubPdfName] = useState('');
  const [hubPublished, setHubPublished] = useState(true);
  const [bulkPdfTopic, setBulkPdfTopic] = useState('Study Notes & PDFs');
  const [isHubDragOver, setIsHubDragOver] = useState(false);
  const [hubSearchQuery, setHubSearchQuery] = useState('');

  // Inline Learning Hub editor state
  const [inlineHubId, setInlineHubId] = useState<string | null>(null);
  const [inlineHubTitle, setInlineHubTitle] = useState('');
  const [inlineHubTopic, setInlineHubTopic] = useState('');
  const [inlineHubSummary, setInlineHubSummary] = useState('');
  const [inlineHubContent, setInlineHubContent] = useState('');
  const [inlineHubLang, setInlineHubLang] = useState('Hindi + English Bilingual');
  const [inlineHubFormulasText, setInlineHubFormulasText] = useState('');
  const [inlineHubPdfUrl, setInlineHubPdfUrl] = useState('');
  const [inlineHubPdfName, setInlineHubPdfName] = useState('');
  const [inlineHubPublished, setInlineHubPublished] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCloudUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) {
      setActiveTab(initialTab);
    }
    setStatusMessage(null);
    clearErrorBanner();
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!authToken || !adminData || savedDraftNotice) return;
    if (!isOffline && !hasLocalPendingDraft) return;
    const timer = window.setTimeout(() => {
      persistCurrentDraft('network-error');
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    authToken,
    adminData,
    isOffline,
    hasLocalPendingDraft,
    savedDraftNotice,
    coachingForm,
    socialForm,
    teacherForm,
    skillsText,
    subjectsText,
    galTitle,
    galCaption,
    galMediaUrl,
    hubTitle,
    hubSummary,
    hubContent,
    hubPdfUrl,
  ]);

  function clearErrorBanner() {
    setErrorMessage(null);
    setErrorHint(null);
    retryCallbackRef.current = null;
    setHasRetryAction(false);
  }

  function buildLiveExportSiteData(extra?: {
    pendingItem?: GalleryItem;
    pendingHub?: LearningResource;
    pendingUpdate?: DailyUpdateItem;
  }): SiteData {
    const base: SiteData = adminData || structuredClone(DEFAULT_SITE_DATA);
    let combined = buildSiteDataWithDraftEdits(base, {
      coaching: coachingForm,
      socialLinks: socialForm,
      teacher: teacherForm,
      skillsText,
      subjectsText,
    });
    if (extra?.pendingItem) {
      combined = mergeSiteDataPreserveExisting(combined, {
        gallery: [extra.pendingItem],
      });
    }
    if (extra?.pendingHub) {
      combined = mergeSiteDataPreserveExisting(combined, {
        learningHub: [extra.pendingHub],
      });
    }
    if (extra?.pendingUpdate) {
      combined = mergeSiteDataPreserveExisting(combined, {
        dailyUpdates: [extra.pendingUpdate],
      });
    }
    return combined;
  }

  function persistCurrentDraft(
    reason: 'editing' | 'network-error',
    extra?: {
      pendingItem?: GalleryItem;
      pendingHub?: LearningResource;
      pendingUpdate?: DailyUpdateItem;
    },
  ) {
    const snapshotData = buildLiveExportSiteData(extra);
    if (extra?.pendingItem || extra?.pendingHub || extra?.pendingUpdate) {
      setAdminData(snapshotData);
    }
    saveAdminDraftToStorage({
      updatedAt: new Date().toISOString(),
      reason,
      siteData: snapshotData,
      skillsText,
      subjectsText,
      pendingGalleryDraft: galTitle.trim() || galMediaUrl.trim()
        ? {
            title: galTitle,
            caption: galCaption,
            category: galCategory,
            mediaType: galMediaType,
            mediaUrl: galMediaUrl,
            thumbnailUrl: galThumbUrl,
            published: galPublished,
          }
        : undefined,
      pendingHubDraft: hubTitle.trim() || hubContent.trim() || hubPdfUrl.trim()
        ? {
            title: hubTitle,
            topicArea: hubTopic,
            summary: hubSummary,
            content: hubContent,
            languageNote: hubLang,
            formulasText: hubFormulasText,
            pdfUrl: hubPdfUrl,
            pdfName: hubPdfName,
            published: hubPublished,
          }
        : undefined,
    });
    if (reason === 'network-error') {
      setHasLocalPendingDraft(true);
    }
  }

  function surfaceFirebaseOrNetworkError(
    error: unknown,
    retryFn?: () => Promise<void>,
    extraDraft?: {
      pendingItem?: GalleryItem;
      pendingHub?: LearningResource;
      pendingUpdate?: DailyUpdateItem;
    },
  ) {
    persistCurrentDraft('network-error', extraDraft);
    const formatted = formatFirebaseAdminError(error);
    setErrorMessage(formatted.message);
    setErrorHint(formatted.hint || null);
    if (retryFn && formatted.isRetryable) {
      retryCallbackRef.current = retryFn;
      setHasRetryAction(true);
    } else {
      retryCallbackRef.current = null;
      setHasRetryAction(false);
    }
  }

  async function handleRetryLastAction() {
    const fn = retryCallbackRef.current;
    if (!fn) return;
    clearErrorBanner();
    await fn();
  }

  function handleRestoreSavedDraft() {
    if (!savedDraftNotice) return;
    const draftSite = savedDraftNotice.siteData;
    setAdminData(draftSite);
    setCoachingForm(draftSite.coaching);
    setSocialForm(draftSite.socialLinks);
    setTeacherForm(draftSite.teacher);
    setSkillsText(
      savedDraftNotice.skillsText ?? draftSite.teacher.skills.join('\n'),
    );
    setSubjectsText(
      savedDraftNotice.subjectsText ?? draftSite.teacher.subjectsTaught.join(', '),
    );
    if (savedDraftNotice.pendingGalleryDraft) {
      const g = savedDraftNotice.pendingGalleryDraft;
      setGalTitle(g.title);
      setGalCaption(g.caption);
      setGalCategory(g.category);
      setGalMediaType(g.mediaType);
      setGalMediaUrl(g.mediaUrl);
      setGalThumbUrl(g.thumbnailUrl);
      setGalPublished(g.published);
    }
    if (savedDraftNotice.pendingHubDraft) {
      const h = savedDraftNotice.pendingHubDraft;
      setHubTitle(h.title);
      setHubTopic(h.topicArea);
      setHubSummary(h.summary);
      setHubContent(h.content);
      setHubLang(h.languageNote);
      setHubFormulasText(h.formulasText);
      setHubPdfUrl(h.pdfUrl);
      setHubPdfName(h.pdfName);
      setHubPublished(h.published);
    }
    setSavedDraftNotice(null);
    setHasLocalPendingDraft(true);
    clearErrorBanner();
    setStatusMessage(
      'Restored your saved local draft. Click Retry / Save to publish when ready, or export a JSON backup.',
    );
  }

  function handleDiscardSavedDraft() {
    clearAdminDraftFromStorage();
    setSavedDraftNotice(null);
    setHasLocalPendingDraft(false);
  }

  async function fetchAdminData(token: string) {
    let data: SiteData = structuredClone(DEFAULT_SITE_DATA);
    const isCloudSession = token === 'cloud-session';

    if (!isCloudSession) {
      try {
        const res = await fetch('/api/admin/data', {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const parsed = (await res.json()) as Partial<SiteData>;
          data = {
            ...DEFAULT_SITE_DATA,
            ...parsed,
            dailyUpdates: Array.isArray(parsed.dailyUpdates)
              ? parsed.dailyUpdates
              : DEFAULT_SITE_DATA.dailyUpdates,
            feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
          };
        }
      } catch {
        // Fall back to default + Firestore data if backend is unavailable
      }
    }

    try {
      const cloudData = await loadAllAdminSiteDataFromFirestore();
      const hasCloud = Boolean(
        cloudData.coaching ||
          cloudData.socialLinks ||
          cloudData.teacher ||
          (cloudData.gallery && cloudData.gallery.length > 0) ||
          (cloudData.learningHub && cloudData.learningHub.length > 0) ||
          (cloudData.dailyUpdates && cloudData.dailyUpdates.length > 0) ||
          (cloudData.feedbacks && cloudData.feedbacks.length > 0),
      );
      if (hasCloud) {
        data = mergeSiteDataPreserveExisting(data, cloudData);
        if (isCloudSession) {
          if (cloudData.gallery && cloudData.gallery.length > 0) {
            data.gallery = cloudData.gallery;
          }
          if (cloudData.learningHub && cloudData.learningHub.length > 0) {
            data.learningHub = cloudData.learningHub;
          }
          if (cloudData.dailyUpdates && cloudData.dailyUpdates.length > 0) {
            data.dailyUpdates = cloudData.dailyUpdates;
          }
          if (cloudData.feedbacks && cloudData.feedbacks.length > 0) {
            data.feedbacks = cloudData.feedbacks;
          }
        }
      }
    } catch {
      // Keep local/default data if Firestore isn't populated yet or offline
    }

    data = normalizeSiteBrandData(data);
    setAdminData(data);
    setCoachingForm(data.coaching);
    setSocialForm(data.socialLinks);
    setTeacherForm(data.teacher);
    setSkillsText(data.teacher.skills.join('\n'));
    setSubjectsText(data.teacher.subjectsTaught.join(', '));

    const existingDraft = loadAdminDraftFromStorage();
    if (existingDraft && existingDraft.reason === 'network-error') {
      setSavedDraftNotice(existingDraft);
      setHasLocalPendingDraft(true);
    }
  }

  async function ensureCloudWriterReady(
    retryFn?: () => Promise<void>,
    forceSessionRefresh = false,
  ): Promise<boolean> {
    if (cloudUser) {
      try {
        await refreshAdminAuthSession(forceSessionRefresh);
        return true;
      } catch (err) {
        surfaceFirebaseOrNetworkError(err, retryFn || handleConnectCloudSync);
        return false;
      }
    }
    try {
      const user = await signInAdminWithGoogle();
      setCloudUser(user);
      return true;
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, retryFn || handleConnectCloudSync);
      return false;
    }
  }

  async function handleConnectCloudSync() {
    setCloudBusy(true);
    clearErrorBanner();
    setStatusMessage(null);
    try {
      const user = cloudUser
        ? (await refreshAdminAuthSession(true)) || (await signInAdminWithGoogle())
        : await signInAdminWithGoogle();
      setCloudUser(user);
      const latestData = buildLiveExportSiteData();
      if (latestData) {
        await syncSiteDataToCloudNonDestructive(latestData);
      }
      if (authToken) {
        await fetchAdminData(authToken);
      }
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setSavedDraftNotice(null);
      setStatusMessage(
        `Cloud Sync connected as ${user.email}. All edits & updates will stay saved across publishes.`,
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, handleConnectCloudSync);
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleManualCloudSync() {
    if (!adminData) return;
    setCloudBusy(true);
    clearErrorBanner();
    setStatusMessage(null);
    try {
      await refreshAdminAuthSession(true);
      const latestData = buildLiveExportSiteData();
      await syncSiteDataToCloudNonDestructive(latestData);
      setAdminData(latestData);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setSavedDraftNotice(null);
      setStatusMessage('All current edits & Daily Updates safely synced to Cloud Firestore.');
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, handleManualCloudSync);
    } finally {
      setCloudBusy(false);
    }
  }

  function handleDownloadBackup(fromSavedNotice = false) {
    const sourceData =
      fromSavedNotice && savedDraftNotice
        ? savedDraftNotice.siteData
        : buildLiveExportSiteData();
    if (!sourceData) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      website: sourceData.coaching.name,
      data: {
        coaching: sourceData.coaching,
        socialLinks: sourceData.socialLinks,
        teacher: sourceData.teacher,
        gallery: sourceData.gallery,
        learningHub: sourceData.learningHub,
        dailyUpdates: sourceData.dailyUpdates || [],
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advice-mission-point-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage(
      'Local backup (.json) downloaded with your latest edits. You can restore it anytime.',
    );
  }

  async function handleRestoreBackupFile(file: File | undefined) {
    if (!file || !authToken) return;
    setCloudBusy(true);
    clearErrorBanner();
    setStatusMessage(null);
    let restoredData: SiteData | null = null;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { data?: Partial<SiteData> } & Partial<SiteData>;
      const backupData = parsed.data || parsed;

      if (authToken !== 'cloud-session') {
        try {
          const res = await fetch('/api/admin/restore', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({ data: backupData, mode: 'merge' }),
          });
          if (res.ok) {
            const body = (await res.json()) as { data?: SiteData; error?: string };
            if (body.data) restoredData = body.data;
          }
        } catch {
          // Fall back to direct cloud merge below
        }
      }

      if (!restoredData && adminData) {
        restoredData = mergeSiteDataPreserveExisting(adminData, backupData);
      }

      if (restoredData && (cloudUser || authToken === 'cloud-session')) {
        const ready = await ensureCloudWriterReady(() => handleRestoreBackupFile(file));
        if (!ready) {
          setAdminData(restoredData);
          setCoachingForm(restoredData.coaching);
          setSocialForm(restoredData.socialLinks);
          setTeacherForm(restoredData.teacher);
          setSkillsText(restoredData.teacher.skills.join('\n'));
          setSubjectsText(restoredData.teacher.subjectsTaught.join(', '));
          return;
        }
        await syncSiteDataToCloudNonDestructive(restoredData);
      }

      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setSavedDraftNotice(null);
      setStatusMessage('Backup merged cleanly — all previous and restored items are preserved.');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setErrorMessage('Invalid backup JSON file. Please select a valid Advice Coaching Classes backup.');
        setErrorHint(null);
      } else {
        surfaceFirebaseOrNetworkError(err, () => handleRestoreBackupFile(file));
      }
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoggingIn(true);
    try {
      let fallbackToCloudLogin = false;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const body = (await res.json()) as { ok?: boolean; token?: string; error?: string };
          if (body.token) {
            await fetchAdminData(body.token);
            setAuthToken(body.token);
            setPasscode('');
            return;
          }
        }

        if (res.status === 401) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setAuthError(body.error || 'Incorrect admin passcode.');
          return;
        }

        fallbackToCloudLogin = true;
      } catch {
        fallbackToCloudLogin = true;
      }

      if (fallbackToCloudLogin) {
        const valid = await verifyAdminPasscodeHash(passcode);
        if (!valid) {
          setAuthError('Incorrect admin passcode.');
          return;
        }
        await fetchAdminData('cloud-session');
        setAuthToken('cloud-session');
        setPasscode('');
      }
    } catch {
      setAuthError('Unable to verify admin passcode.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function uploadSelectedFile(file: File): Promise<string | null> {
    if (!authToken) return null;
    setUploadingFile(true);
    setErrorMessage(null);
    try {
      if (file.type.startsWith('image/')) {
        const compressed = await compressImageToDataUrl(file);
        if (compressed) {
          return compressed;
        }
      }
      const compactPdf = await readSmallPdfAsDataUrl(file);
      if (compactPdf) {
        return compactPdf;
      }

      if (authToken === 'cloud-session') {
        setErrorMessage(
          'Videos or large PDFs over 550 KB on static hosting should be added via YouTube / Google Drive link.',
        );
        return null;
      }

      const res = await fetch('/api/admin/upload-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-admin-token': authToken,
          'x-filename': encodeURIComponent(file.name),
          'x-mime-type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setErrorMessage(body.error || 'Upload failed.');
        return null;
      }
      return body.url;
    } catch {
      setErrorMessage('Could not upload the selected file.');
      return null;
    } finally {
      setUploadingFile(false);
    }
  }

  // Daily Updates Handlers
  async function handleCreateDailyUpdate(draft: {
    title: string;
    description: string;
    date: string;
    mediaType: DailyUpdateMediaType;
    mediaUrl?: string;
    fileName?: string;
    published: boolean;
  }): Promise<boolean> {
    if (!authToken) return false;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleCreateDailyUpdate(draft).then(() => undefined)))) {
      return false;
    }

    const now = new Date().toISOString();
    let itemToSync: DailyUpdateItem = {
      id: `upd-${crypto.randomUUID().slice(0, 8)}`,
      title: draft.title,
      description: draft.description,
      date: draft.date,
      mediaType: draft.mediaType,
      mediaUrl: draft.mediaUrl,
      fileName: draft.fileName,
      published: draft.published,
      createdAt: now,
      updatedAt: now,
    };

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        const res = await fetch('/api/admin/daily-updates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': authToken,
          },
          body: JSON.stringify(draft),
        });
        const body = (await res.json()) as { update?: DailyUpdateItem; error?: string };
        if (!res.ok) {
          setErrorMessage(body.error || 'Unable to publish daily update.');
          return false;
        }
        if (body.update) itemToSync = body.update;
      }

      if (cloudUser || isCloudOnly) {
        await saveDailyUpdateToCloud(itemToSync);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? `Daily Update "${itemToSync.title}" published LIVE everywhere!`
          : `Daily Update "${itemToSync.title}" saved to database.`,
      );
      return true;
    } catch (err) {
      surfaceFirebaseOrNetworkError(
        err,
        async () => {
          await handleCreateDailyUpdate(draft);
        },
        { pendingUpdate: itemToSync },
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEditDailyUpdate(
    id: string,
    next: {
      title: string;
      description: string;
      date: string;
      mediaType: DailyUpdateMediaType;
      mediaUrl?: string;
      fileName?: string;
      published: boolean;
    },
  ): Promise<boolean> {
    if (!authToken) return false;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleSaveEditDailyUpdate(id, next).then(() => undefined)))) {
      return false;
    }

    const existingItem = (adminData?.dailyUpdates || []).find((u) => u.id === id);
    let itemToSync: DailyUpdateItem = {
      id,
      title: next.title,
      description: next.description,
      date: next.date,
      mediaType: next.mediaType,
      mediaUrl: next.mediaUrl,
      fileName: next.fileName,
      published: next.published,
      createdAt: existingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        const res = await fetch(`/api/admin/daily-updates/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': authToken,
          },
          body: JSON.stringify({
            ...next,
            mediaUrl: next.mediaUrl ?? '',
            fileName: next.fileName ?? '',
          }),
        });
        const body = (await res.json()) as { update?: DailyUpdateItem; error?: string };
        if (!res.ok) {
          setErrorMessage(body.error || 'Unable to update daily update.');
          return false;
        }
        if (body.update) itemToSync = body.update;
      }

      if (cloudUser || isCloudOnly) {
        await saveDailyUpdateToCloud(itemToSync);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(`Updated Daily Update "${itemToSync.title}".`);
      return true;
    } catch (err) {
      surfaceFirebaseOrNetworkError(
        err,
        async () => {
          await handleSaveEditDailyUpdate(id, next);
        },
        { pendingUpdate: itemToSync },
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublishDailyUpdate(item: DailyUpdateItem): Promise<void> {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleTogglePublishDailyUpdate(item)))) {
      return;
    }

    let itemToSync: DailyUpdateItem = {
      ...item,
      published: !item.published,
      updatedAt: new Date().toISOString(),
    };
    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        const res = await fetch(`/api/admin/daily-updates/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': authToken,
          },
          body: JSON.stringify({ published: !item.published }),
        });
        if (res.ok) {
          const body = (await res.json()) as { update?: DailyUpdateItem };
          if (body.update) itemToSync = body.update;
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveDailyUpdateToCloud(itemToSync);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => handleTogglePublishDailyUpdate(item), {
        pendingUpdate: itemToSync,
      });
    }
  }

  async function handleDeleteDailyUpdate(id: string): Promise<void> {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleDeleteDailyUpdate(id)))) return;

    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        await fetch(`/api/admin/daily-updates/${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': authToken },
        });
      }
      if (cloudUser || isCloudOnly) {
        await deleteDailyUpdateFromCloud(id);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      setStatusMessage('Daily update deleted.');
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => handleDeleteDailyUpdate(id));
    }
  }

  // User Feedback & Ratings Handlers
  async function handleRefreshFeedbacks() {
    if (!authToken) return;
    setRefreshingFeedbacks(true);
    clearErrorBanner();
    try {
      await fetchAdminData(authToken);
    } finally {
      setRefreshingFeedbacks(false);
    }
  }

  async function handleDeleteFeedback(id: string) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleDeleteFeedback(id)))) return;

    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        try {
          await fetch(`/api/admin/feedback/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': authToken },
          });
        } catch {
          // Proceed to cloud deletion
        }
      }
      if (cloudUser || isCloudOnly) {
        await deleteFeedbackFromCloud(id);
      }
      await fetchAdminData(authToken);
      setStatusMessage('Feedback entry removed.');
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => handleDeleteFeedback(id));
    }
  }

  async function handleBulkGalleryUpload(files: FileList | null) {
    if (!authToken || !files || files.length === 0) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleBulkGalleryUpload(files)))) return;

    const fileArray = Array.from(files);
    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    let successCount = 0;

    try {
      for (let i = 0; i < fileArray.length; i += 1) {
        const file = fileArray[i];
        setBulkUploadProgress(`Uploading ${i + 1} of ${fileArray.length}: ${file.name}`);
        const uploadedUrl = await uploadSelectedFile(file);
        if (!uploadedUrl) continue;

        const detected = detectUploadCategoryAndType(
          file.name,
          file.type || '',
          bulkGalleryCategory,
        );
        const title = formatTitleFromFilename(file.name);
        let itemToSync: GalleryItem | null = null;

        if (!isCloudOnly) {
          try {
            const res = await fetch('/api/admin/gallery', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-token': authToken,
              },
              body: JSON.stringify({
                title,
                caption: '',
                category: detected.category,
                mediaType: detected.mediaType,
                mediaUrl: uploadedUrl,
                published: true,
              }),
            });
            if (res.ok) {
              const created = (await res.json()) as { item?: GalleryItem };
              itemToSync = created.item || null;
            }
          } catch {
            // Fall back to direct cloud creation below
          }
        }

        if (!itemToSync && (isCloudOnly || cloudUser)) {
          itemToSync = {
            id: `gal-${crypto.randomUUID().slice(0, 8)}`,
            title,
            caption: '',
            category: detected.category,
            mediaType: detected.mediaType,
            mediaUrl: uploadedUrl,
            published: true,
            createdAt: new Date().toISOString(),
          };
        }

        if (itemToSync) {
          if (cloudUser || isCloudOnly) {
            try {
              await saveGalleryItemToCloud(itemToSync);
            } catch (err) {
              surfaceFirebaseOrNetworkError(err, () => handleBulkGalleryUpload(files), {
                pendingItem: itemToSync,
              });
              return;
            }
          }
          successCount += 1;
        }
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser
          ? `${successCount} file${successCount === 1 ? '' : 's'} uploaded and synced LIVE everywhere.`
          : `${successCount} file${successCount === 1 ? '' : 's'} saved locally. Connect Cloud Sync above to publish live everywhere.`,
      );
    } finally {
      setBulkUploadProgress(null);
      setSaving(false);
    }
  }

  async function replaceGalleryItemMedia(item: GalleryItem, file: File) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => replaceGalleryItemMedia(item, file)))) {
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      const uploadedUrl = await uploadSelectedFile(file);
      if (!uploadedUrl) return;
      const detected = detectUploadCategoryAndType(file.name, file.type || '', item.category);
      const resolvedCategory: GalleryCategory =
        detected.mediaType === 'pdf'
          ? 'pdfs'
          : detected.mediaType === 'video'
            ? 'videos'
            : item.category === 'videos' || item.category === 'pdfs'
              ? 'coaching'
              : item.category;

      let updatedItem: GalleryItem | null = null;
      if (!isCloudOnly) {
        try {
          const res = await fetch(`/api/admin/gallery/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({
              mediaUrl: uploadedUrl,
              mediaType: detected.mediaType,
              category: resolvedCategory,
            }),
          });
          if (res.ok) {
            const updatedBody = (await res.json()) as { item?: GalleryItem };
            updatedItem = updatedBody.item || null;
          }
        } catch {
          // Fall back to direct cloud update
        }
      }

      if (!updatedItem && (isCloudOnly || cloudUser)) {
        updatedItem = {
          ...item,
          mediaUrl: uploadedUrl,
          mediaType: detected.mediaType,
          category: resolvedCategory,
        };
      }

      if (!updatedItem) {
        setErrorMessage('Could not replace media file.');
        return;
      }

      if (cloudUser || isCloudOnly) {
        try {
          await saveGalleryItemToCloud(updatedItem);
        } catch (err) {
          surfaceFirebaseOrNetworkError(err, () => replaceGalleryItemMedia(item, file), {
            pendingItem: updatedItem,
          });
          return;
        }
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser
          ? `Replaced media for "${item.title}" — live everywhere!`
          : `Replaced media for "${item.title}" locally.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkPdfUpload(files: FileList | null) {
    if (!authToken || !files || files.length === 0) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => handleBulkPdfUpload(files)))) return;

    const fileArray = Array.from(files);
    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    let successCount = 0;

    try {
      for (let i = 0; i < fileArray.length; i += 1) {
        const file = fileArray[i];
        setBulkUploadProgress(`Uploading PDF ${i + 1} of ${fileArray.length}: ${file.name}`);
        const uploadedUrl = await uploadSelectedFile(file);
        if (!uploadedUrl) continue;

        let resourceToSync: LearningResource | null = null;
        if (!isCloudOnly) {
          try {
            const res = await fetch('/api/admin/hub', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-token': authToken,
              },
              body: JSON.stringify({
                title: formatTitleFromFilename(file.name),
                topicArea: bulkPdfTopic.trim() || 'Study Notes & PDFs',
                summary: `Downloadable PDF notes: ${file.name}`,
                content: 'Click Open or Download PDF below to read this study sheet.',
                languageNote: 'Hindi + English Bilingual',
                keyFormulas: [],
                pdfUrl: uploadedUrl,
                pdfName: file.name,
                published: true,
              }),
            });
            if (res.ok) {
              const created = (await res.json()) as { resource?: LearningResource };
              resourceToSync = created.resource || null;
            }
          } catch {
            // Fall back to direct cloud creation
          }
        }

        if (!resourceToSync && (isCloudOnly || cloudUser)) {
          resourceToSync = {
            id: `hub-${crypto.randomUUID().slice(0, 8)}`,
            title: formatTitleFromFilename(file.name),
            topicArea: bulkPdfTopic.trim() || 'Study Notes & PDFs',
            summary: `Downloadable PDF notes: ${file.name}`,
            content: 'Click Open or Download PDF below to read this study sheet.',
            languageNote: 'Hindi + English Bilingual',
            keyFormulas: [],
            pdfUrl: uploadedUrl,
            pdfName: file.name,
            published: true,
            updatedAt: new Date().toISOString(),
          };
        }

        if (resourceToSync) {
          if (cloudUser || isCloudOnly) {
            try {
              await saveLearningResourceToCloud(resourceToSync);
            } catch (err) {
              surfaceFirebaseOrNetworkError(err, () => handleBulkPdfUpload(files), {
                pendingHub: resourceToSync,
              });
              return;
            }
          }
          successCount += 1;
        }
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser
          ? `${successCount} PDF${successCount === 1 ? '' : 's'} uploaded and synced LIVE everywhere.`
          : `${successCount} PDF${successCount === 1 ? '' : 's'} saved locally.`,
      );
    } finally {
      setBulkUploadProgress(null);
      setSaving(false);
    }
  }

  async function executeSaveCoachingAndSocials() {
    if (!authToken || !coachingForm || !socialForm) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(executeSaveCoachingAndSocials))) return;

    const rawHeroUrl = (coachingForm.heroMediaUrl || '').trim();
    const nextHeroUrl = rawHeroUrl ? normalizeSafeMediaOrExternalUrl(rawHeroUrl) : '';
    const nextCoaching: CoachingInfo = {
      ...coachingForm,
      heroMediaUrl: nextHeroUrl,
      heroMediaType:
        coachingForm.heroMediaType === 'video' || isVideoFileOrUrl(nextHeroUrl)
          ? 'video'
          : 'image',
      googleMapsUrl: normalizeExternalUrl(coachingForm.googleMapsUrl),
    };
    const nextSocial: SocialLinks = {
      whatsapp: normalizeWhatsAppUrl(socialForm.whatsapp),
      instagram: normalizeExternalUrl(socialForm.instagram),
      facebook: normalizeExternalUrl(socialForm.facebook),
      youtube: normalizeExternalUrl(socialForm.youtube),
    };

    const validation = validateCoachingInfo(nextCoaching, nextSocial);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please fill all required fields.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let savedCoaching = nextCoaching;
      let savedSocial = nextSocial;

      if (!isCloudOnly) {
        try {
          const res = await fetch('/api/admin/coaching', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({ coaching: nextCoaching, socialLinks: nextSocial }),
          });
          const body = (await res.json()) as {
            coaching?: CoachingInfo;
            socialLinks?: SocialLinks;
            error?: string;
          };
          if (!res.ok) {
            setErrorMessage(body.error || 'Failed to save coaching details.');
            return;
          }
          if (body.coaching) savedCoaching = body.coaching;
          if (body.socialLinks) savedSocial = body.socialLinks;
        } catch {
          // Proceed to cloud save if available
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveCoachingAndSocialsToCloud(savedCoaching, savedSocial);
      }

      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setSavedDraftNotice(null);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? 'Coaching info & links saved — live on the website everywhere!'
          : 'Saved on this server. Connect Cloud Sync above so changes appear live everywhere!',
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, executeSaveCoachingAndSocials);
    } finally {
      setSaving(false);
    }
  }

  async function saveCoachingAndSocials(e: React.FormEvent) {
    e.preventDefault();
    await executeSaveCoachingAndSocials();
  }

  async function executeSaveTeacherProfile() {
    if (!authToken || !teacherForm) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(executeSaveTeacherProfile))) return;

    const payload: TeacherProfile = {
      ...teacherForm,
      photoUrl: teacherForm.photoUrl
        ? normalizeSafeMediaOrExternalUrl(teacherForm.photoUrl)
        : '',
      skills: skillsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      subjectsTaught: subjectsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const validation = validateTeacherProfile(payload);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please fill all required teacher details.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let savedTeacher = payload;

      if (!isCloudOnly) {
        try {
          const res = await fetch('/api/admin/teacher', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify(payload),
          });
          const body = (await res.json()) as { teacher?: TeacherProfile; error?: string };
          if (!res.ok) {
            setErrorMessage(body.error || 'Failed to save teacher profile.');
            return;
          }
          if (body.teacher) savedTeacher = body.teacher;
        } catch {
          // Proceed to cloud save
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveTeacherToCloud(savedTeacher);
      }

      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setSavedDraftNotice(null);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? 'Teacher profile updated — live on the website everywhere!'
          : 'Saved on this server. Connect Cloud Sync above so changes appear live everywhere!',
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, executeSaveTeacherProfile);
    } finally {
      setSaving(false);
    }
  }

  async function saveTeacherProfile(e: React.FormEvent) {
    e.preventDefault();
    await executeSaveTeacherProfile();
  }

  function resetGalleryForm() {
    setGalTitle('');
    setGalCaption('');
    setGalCategory('coaching');
    setGalMediaType('image');
    setGalMediaUrl('');
    setGalThumbUrl('');
    setGalPublished(true);
  }

  function openInlineGalleryEdit(item: GalleryItem) {
    if (inlineGalId === item.id) {
      setInlineGalId(null);
      return;
    }
    setInlineGalId(item.id);
    setInlineGalTitle(item.title);
    setInlineGalCaption(item.caption);
    setInlineGalCategory(item.category);
    setInlineGalMediaType(item.mediaType);
    setInlineGalMediaUrl(item.mediaUrl);
    setInlineGalThumbUrl(item.thumbnailUrl || '');
    setInlineGalPublished(item.published);
  }

  async function executeSaveNewGalleryItem() {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(executeSaveNewGalleryItem))) return;

    const resolvedType: MediaType =
      galCategory === 'pdfs' || isPdfFileOrUrl(galMediaUrl)
        ? 'pdf'
        : galCategory === 'videos' || isVideoFileOrUrl(galMediaUrl)
          ? 'video'
          : galMediaType;

    const draftItem: GalleryItem = {
      id: `gal-${crypto.randomUUID().slice(0, 8)}`,
      title: galTitle.trim(),
      caption: galCaption.trim(),
      category: galCategory,
      mediaType: resolvedType,
      mediaUrl: galMediaUrl.trim(),
      thumbnailUrl: galThumbUrl.trim() || undefined,
      published: galPublished,
      createdAt: new Date().toISOString(),
    };
    const validation = validateGalleryInput(draftItem);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please provide valid gallery item details.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let itemToSync = draftItem;

      if (!isCloudOnly) {
        try {
          const res = await fetch('/api/admin/gallery', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({
              title: galTitle,
              caption: galCaption,
              category: galCategory,
              mediaType: resolvedType,
              mediaUrl: galMediaUrl,
              thumbnailUrl: galThumbUrl || undefined,
              published: galPublished,
            }),
          });
          const body = (await res.json()) as { item?: GalleryItem; error?: string };
          if (!res.ok) {
            setErrorMessage(body.error || 'Unable to save gallery item.');
            return;
          }
          if (body.item) itemToSync = body.item;
        } catch {
          // Proceed to cloud save
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveGalleryItemToCloud(itemToSync);
      }
      resetGalleryForm();
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? 'New photo, video, or PDF published LIVE everywhere!'
          : 'New item saved locally. Connect Cloud Sync above to publish everywhere.',
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, executeSaveNewGalleryItem, {
        pendingItem: draftItem,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveNewGalleryItem(e: React.FormEvent) {
    e.preventDefault();
    await executeSaveNewGalleryItem();
  }

  async function saveInlineGalleryEdit(id: string) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => saveInlineGalleryEdit(id)))) return;

    const resolvedType: MediaType =
      inlineGalCategory === 'pdfs' || isPdfFileOrUrl(inlineGalMediaUrl)
        ? 'pdf'
        : inlineGalCategory === 'videos' || isVideoFileOrUrl(inlineGalMediaUrl)
          ? 'video'
          : inlineGalMediaType;

    const existingItem = adminData?.gallery.find((g) => g.id === id);
    const nextItem: GalleryItem = {
      id,
      title: inlineGalTitle.trim(),
      caption: inlineGalCaption.trim(),
      category: inlineGalCategory,
      mediaType: resolvedType,
      mediaUrl: inlineGalMediaUrl.trim(),
      thumbnailUrl: inlineGalThumbUrl.trim() || undefined,
      published: inlineGalPublished,
      createdAt: existingItem?.createdAt || new Date().toISOString(),
    };
    const validation = validateGalleryInput(nextItem);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please provide valid gallery item details.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let itemToSync = nextItem;

      if (!isCloudOnly) {
        try {
          const res = await fetch(`/api/admin/gallery/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({
              title: inlineGalTitle,
              caption: inlineGalCaption,
              category: inlineGalCategory,
              mediaType: resolvedType,
              mediaUrl: inlineGalMediaUrl,
              thumbnailUrl: inlineGalThumbUrl || undefined,
              published: inlineGalPublished,
            }),
          });
          const body = (await res.json()) as { item?: GalleryItem; error?: string };
          if (!res.ok) {
            setErrorMessage(body.error || 'Unable to update gallery item.');
            return;
          }
          if (body.item) itemToSync = body.item;
        } catch {
          // Proceed to cloud save
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveGalleryItemToCloud(itemToSync);
      }
      setInlineGalId(null);
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? `Updated "${inlineGalTitle}" — live everywhere!`
          : `Updated "${inlineGalTitle}" locally.`,
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => saveInlineGalleryEdit(id), {
        pendingItem: nextItem,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleGalleryPublish(item: GalleryItem) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => toggleGalleryPublish(item)))) return;

    let itemToSync: GalleryItem = { ...item, published: !item.published };
    clearErrorBanner();

    try {
      if (!isCloudOnly) {
        try {
          const res = await fetch(`/api/admin/gallery/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({ published: !item.published }),
          });
          if (res.ok) {
            const body = (await res.json()) as { item?: GalleryItem };
            if (body.item) itemToSync = body.item;
          }
        } catch {
          // Proceed to cloud update
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveGalleryItemToCloud(itemToSync);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => toggleGalleryPublish(item), {
        pendingItem: itemToSync,
      });
    }
  }

  async function deleteGalleryItem(id: string) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => deleteGalleryItem(id)))) return;

    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        try {
          await fetch(`/api/admin/gallery/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': authToken },
          });
        } catch {
          // Proceed to cloud delete
        }
      }
      if (cloudUser || isCloudOnly) {
        await deleteGalleryItemFromCloud(id);
      }
      if (inlineGalId === id) {
        setInlineGalId(null);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      setStatusMessage('Gallery item deleted.');
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => deleteGalleryItem(id));
    }
  }

  function resetHubForm() {
    setHubTitle('');
    setHubTopic('');
    setHubSummary('');
    setHubContent('');
    setHubLang('Hindi + English Bilingual');
    setHubFormulasText('');
    setHubPdfUrl('');
    setHubPdfName('');
    setHubPublished(true);
  }

  function openInlineHubEdit(resource: LearningResource) {
    if (inlineHubId === resource.id) {
      setInlineHubId(null);
      return;
    }
    setInlineHubId(resource.id);
    setInlineHubTitle(resource.title);
    setInlineHubTopic(resource.topicArea);
    setInlineHubSummary(resource.summary);
    setInlineHubContent(resource.content);
    setInlineHubLang(resource.languageNote);
    setInlineHubFormulasText(resource.keyFormulas.join('\n'));
    setInlineHubPdfUrl(resource.pdfUrl || '');
    setInlineHubPdfName(resource.pdfName || '');
    setInlineHubPublished(resource.published);
  }

  async function executeSaveNewHubResource() {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(executeSaveNewHubResource))) return;

    const cleanPdfUrl = hubPdfUrl.trim() || undefined;
    const cleanPdfName = hubPdfName.trim() || undefined;
    const draftResource: LearningResource = {
      id: `hub-${crypto.randomUUID().slice(0, 8)}`,
      title: hubTitle.trim(),
      topicArea: hubTopic.trim(),
      summary:
        hubSummary.trim() ||
        (cleanPdfUrl ? 'Downloadable PDF study guide and reference notes.' : ''),
      content:
        hubContent.trim() ||
        (cleanPdfUrl ? 'Open or download the attached PDF document below to study this topic.' : ''),
      languageNote: hubLang.trim() || 'Hindi + English Bilingual',
      keyFormulas: hubFormulasText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
      pdfUrl: cleanPdfUrl,
      pdfName: cleanPdfName,
      published: hubPublished,
      updatedAt: new Date().toISOString(),
    };
    const validation = validateLearningResourceInput(draftResource);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please fill all required Learning Hub fields.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let resourceToSync = draftResource;

      if (!isCloudOnly) {
        try {
          const res = await fetch('/api/admin/hub', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({
              title: hubTitle,
              topicArea: hubTopic,
              summary: hubSummary,
              content: hubContent,
              languageNote: hubLang,
              keyFormulas: draftResource.keyFormulas,
              pdfUrl: hubPdfUrl,
              pdfName: hubPdfName,
              published: hubPublished,
            }),
          });
          const body = (await res.json()) as { resource?: LearningResource; error?: string };
          if (!res.ok) {
            setErrorMessage(body.error || 'Unable to save Learning Hub guide.');
            return;
          }
          if (body.resource) resourceToSync = body.resource;
        } catch {
          // Proceed to cloud save
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveLearningResourceToCloud(resourceToSync);
      }
      resetHubForm();
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? 'Study guide / PDF published LIVE everywhere!'
          : 'Study guide saved locally. Connect Cloud Sync above to publish everywhere.',
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, executeSaveNewHubResource, {
        pendingHub: draftResource,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveNewHubResource(e: React.FormEvent) {
    e.preventDefault();
    await executeSaveNewHubResource();
  }

  async function saveInlineHubEdit(id: string) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => saveInlineHubEdit(id)))) return;

    const nextResource: LearningResource = {
      id,
      title: inlineHubTitle.trim(),
      topicArea: inlineHubTopic.trim(),
      summary: inlineHubSummary.trim(),
      content: inlineHubContent.trim(),
      languageNote: inlineHubLang.trim() || 'Hindi + English Bilingual',
      keyFormulas: inlineHubFormulasText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
      pdfUrl: inlineHubPdfUrl.trim() || undefined,
      pdfName: inlineHubPdfName.trim() || undefined,
      published: inlineHubPublished,
      updatedAt: new Date().toISOString(),
    };
    const validation = validateLearningResourceInput(nextResource);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please fill all required Learning Hub fields.');
      setErrorHint(null);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    clearErrorBanner();
    try {
      let resourceToSync = nextResource;

      if (!isCloudOnly) {
        try {
          const res = await fetch(`/api/admin/hub/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({
              title: inlineHubTitle,
              topicArea: inlineHubTopic,
              summary: inlineHubSummary,
              content: inlineHubContent,
              languageNote: inlineHubLang,
              keyFormulas: nextResource.keyFormulas,
              pdfUrl: inlineHubPdfUrl,
              pdfName: inlineHubPdfName,
              published: inlineHubPublished,
            }),
          });
          const body = (await res.json()) as { resource?: LearningResource; error?: string };
          if (!res.ok) {
            setErrorMessage(body.error || 'Unable to update study guide.');
            return;
          }
          if (body.resource) resourceToSync = body.resource;
        } catch {
          // Proceed to cloud save
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveLearningResourceToCloud(resourceToSync);
      }
      setInlineHubId(null);
      await fetchAdminData(authToken);
      await onSiteUpdated();
      clearAdminDraftFromStorage();
      setHasLocalPendingDraft(false);
      setStatusMessage(
        cloudUser || isCloudOnly
          ? `Updated "${inlineHubTitle}" — live everywhere!`
          : `Updated "${inlineHubTitle}" locally.`,
      );
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => saveInlineHubEdit(id), {
        pendingHub: nextResource,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleHubPublish(resItem: LearningResource) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => toggleHubPublish(resItem)))) return;

    let resourceToSync: LearningResource = {
      ...resItem,
      published: !resItem.published,
      updatedAt: new Date().toISOString(),
    };
    clearErrorBanner();

    try {
      if (!isCloudOnly) {
        try {
          const res = await fetch(`/api/admin/hub/${resItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-token': authToken,
            },
            body: JSON.stringify({ published: !resItem.published }),
          });
          if (res.ok) {
            const body = (await res.json()) as { resource?: LearningResource };
            if (body.resource) resourceToSync = body.resource;
          }
        } catch {
          // Proceed to cloud update
        }
      }

      if (cloudUser || isCloudOnly) {
        await saveLearningResourceToCloud(resourceToSync);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => toggleHubPublish(resItem), {
        pendingHub: resourceToSync,
      });
    }
  }

  async function deleteHubResource(id: string) {
    if (!authToken) return;
    const isCloudOnly = authToken === 'cloud-session';
    if (isCloudOnly && !(await ensureCloudWriterReady(() => deleteHubResource(id)))) return;

    clearErrorBanner();
    try {
      if (!isCloudOnly) {
        try {
          await fetch(`/api/admin/hub/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': authToken },
          });
        } catch {
          // Proceed to cloud delete
        }
      }
      if (cloudUser || isCloudOnly) {
        await deleteLearningResourceFromCloud(id);
      }
      if (inlineHubId === id) {
        setInlineHubId(null);
      }
      await fetchAdminData(authToken);
      await onSiteUpdated();
      setStatusMessage('Study guide deleted.');
    } catch (err) {
      surfaceFirebaseOrNetworkError(err, () => deleteHubResource(id));
    }
  }

  async function deleteEnquiry(id: string) {
    if (!authToken || authToken === 'cloud-session') return;
    await fetch(`/api/admin/enquiries/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': authToken },
    });
    await fetchAdminData(authToken);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-heading"
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#111318] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Admin Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-800 bg-[#09090B] flex items-center justify-between gap-4">
          <div>
            <h2 id="admin-panel-heading" className="text-lg sm:text-xl font-bold text-white">
              Advice Coaching Classes — Admin Dashboard
            </h2>
            <p className="text-xs text-slate-400">
              Manage Daily Updates, User Feedback &amp; Ratings, teacher profile, gallery media, and Learning Hub notes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {authToken && (
              <button
                type="button"
                onClick={() => {
                  const tokenToRevoke = authToken;
                  setAuthToken(null);
                  setAdminData(null);
                  setPasscode('');
                  if (tokenToRevoke !== 'cloud-session') {
                    void fetch('/api/admin/logout', {
                      method: 'POST',
                      headers: { 'x-admin-token': tokenToRevoke },
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Close Admin Panel"
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {!authToken ? (
            <form onSubmit={handleLogin} autoComplete="off" className="max-w-md mx-auto py-10 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">Administrator Access</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Enter your coaching admin password to access Daily Updates, private User Feedback &amp; Ratings, and site controls.
                </p>
              </div>

              <div>
                <label
                  htmlFor="admin-passcode-input"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Admin Passcode
                </label>
                <input
                  id="admin-passcode-input"
                  type="password"
                  autoComplete="off"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter admin passcode"
                  className={INPUT_CLASS}
                />
              </div>

              {authError && (
                <p role="alert" className="text-sm text-red-400 font-medium">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loggingIn || !passcode.trim()}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {loggingIn ? 'Verifying...' : 'Unlock Admin Dashboard'}
              </button>
            </form>
          ) : (
            <div>
              {/* Admin Section Tabs */}
              <div className="flex flex-wrap gap-2 pb-5 border-b border-zinc-800 mb-6">
                {(
                  [
                    { id: 'coaching', label: 'Coaching & Hero Media' },
                    { id: 'teacher', label: 'Teacher Profile' },
                    {
                      id: 'updates',
                      label: `Daily Updates (${adminData?.dailyUpdates?.length || 0})`,
                    },
                    { id: 'gallery', label: 'Photos, Videos & PDFs' },
                    { id: 'hub', label: 'Learning Hub & PDFs' },
                    {
                      id: 'feedback',
                      label: `User Feedback & Ratings (${adminData?.feedbacks?.length || 0})`,
                    },
                    {
                      id: 'enquiries',
                      label: `Enquiries (${adminData?.enquiries?.length || 0})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setStatusMessage(null);
                      clearErrorBanner();
                    }}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white border border-blue-500'
                        : 'bg-[#0D0F14] text-slate-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Permanent Cloud Persistence & Backup Bar */}
              <div className="mb-5 p-3.5 sm:p-4 rounded-xl border border-zinc-800 bg-[#0D0F14] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Cloud
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      cloudUser ? 'text-blue-400' : 'text-red-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {cloudUser
                        ? `Permanent Cloud Sync Active (${cloudUser.email})`
                        : 'Permanent Cloud Sync & Publish Protection'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cloudUser
                        ? 'Your edits, Daily Updates, photos, PDFs, and private feedback stay synced in Cloud Firestore across publishes.'
                        : 'Connect Google Cloud Sync once so all published edits stay safe across updates, or download/merge a JSON backup anytime.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!cloudUser ? (
                    <button
                      type="button"
                      disabled={cloudBusy}
                      onClick={() => void handleConnectCloudSync()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{cloudBusy ? 'Connecting...' : 'Connect Cloud Sync'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => void handleManualCloudSync()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{cloudBusy ? 'Syncing...' : 'Sync All to Cloud'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void signOutFirebaseAdmin()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                      >
                        <span>Disconnect Cloud</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    <span>Download Backup</span>
                  </button>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                    <span>Restore / Merge</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleRestoreBackupFile(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {isOffline && (
                <div
                  role="status"
                  className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-white">
                        You appear to be offline — your edits stay safe locally.
                      </p>
                      <p className="text-xs text-amber-200/80 mt-0.5">
                        Check your internet, DNS, or VPN connection. You can download a local JSON backup now and click Retry once connected.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#141720] border border-amber-500/40 hover:bg-zinc-800 rounded-lg cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Save Backup JSON</span>
                  </button>
                </div>
              )}

              {savedDraftNotice && (
                <div
                  role="status"
                  className="mb-5 p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-100 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-white">
                        Saved local draft found from {formatDisplayDate(savedDraftNotice.updatedAt)}
                      </p>
                      <p className="text-xs text-blue-200/80 mt-0.5">
                        Your previous edits were preserved automatically during a connection interruption. Restore them to continue or export a JSON backup.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRestoreSavedDraft}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                    >
                      Restore Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Export Draft JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardSavedDraft}
                      className="px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-lg cursor-pointer"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {statusMessage && (
                <div
                  role="status"
                  className="mb-5 flex items-center gap-2 p-3 rounded-lg bg-blue-950/50 border border-blue-500/40 text-blue-100 text-sm font-medium"
                >
                  <Check className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 sm:p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-100 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{errorMessage}</p>
                    {errorHint && (
                      <p className="text-xs text-red-200/90 leading-relaxed">{errorHint}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {hasRetryAction && (
                      <button
                        type="button"
                        disabled={saving || cloudBusy}
                        onClick={() => void handleRetryLastAction()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{saving || cloudBusy ? 'Retrying...' : 'Retry'}</span>
                      </button>
                    )}
                    {hasLocalPendingDraft && (
                      <button
                        type="button"
                        onClick={() => handleDownloadBackup(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-red-500/40 hover:bg-zinc-800 rounded-lg cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Export Backup JSON</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 1: Coaching Info, Google Maps & Social Media */}
              {activeTab === 'coaching' && coachingForm && socialForm && (
                <form onSubmit={saveCoachingAndSocials} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admin-coaching-name" className={LABEL_CLASS}>
                        Coaching Name
                      </label>
                      <input
                        id="admin-coaching-name"
                        type="text"
                        value={coachingForm.name}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, name: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-coaching-tagline" className={LABEL_CLASS}>
                        Tagline
                      </label>
                      <input
                        id="admin-coaching-tagline"
                        type="text"
                        value={coachingForm.tagline}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, tagline: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-welcome-headline" className={LABEL_CLASS}>
                        Welcome Headline
                      </label>
                      <input
                        id="admin-welcome-headline"
                        type="text"
                        value={coachingForm.welcomeHeadline}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, welcomeHeadline: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-welcome-subtitle" className={LABEL_CLASS}>
                        Welcome Subtitle
                      </label>
                      <textarea
                        id="admin-welcome-subtitle"
                        rows={2}
                        value={coachingForm.welcomeSubtitle}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, welcomeSubtitle: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-about-desc" className={LABEL_CLASS}>
                        About Coaching Description
                      </label>
                      <textarea
                        id="admin-about-desc"
                        rows={3}
                        value={coachingForm.aboutDescription}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, aboutDescription: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-coaching-address" className={LABEL_CLASS}>
                        Coaching Address
                      </label>
                      <input
                        id="admin-coaching-address"
                        type="text"
                        value={coachingForm.address}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, address: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-google-maps-url" className={LABEL_CLASS}>
                        Google Maps Link
                      </label>
                      <input
                        id="admin-google-maps-url"
                        type="url"
                        value={coachingForm.googleMapsUrl}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, googleMapsUrl: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-coaching-phone" className={LABEL_CLASS}>
                        Phone Number
                      </label>
                      <input
                        id="admin-coaching-phone"
                        type="text"
                        value={coachingForm.phone}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, phone: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-coaching-email" className={LABEL_CLASS}>
                        Email Address
                      </label>
                      <input
                        id="admin-coaching-email"
                        type="email"
                        value={coachingForm.email}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, email: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-office-hours" className={LABEL_CLASS}>
                        Class &amp; Office Timings
                      </label>
                      <input
                        id="admin-office-hours"
                        type="text"
                        value={coachingForm.officeHours}
                        onChange={(e) =>
                          setCoachingForm({ ...coachingForm, officeHours: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <h3 className="text-sm font-bold text-white mb-3">
                      Social Media Links
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="admin-social-whatsapp" className={LABEL_CLASS}>
                          WhatsApp Link or Phone Number
                        </label>
                        <input
                          id="admin-social-whatsapp"
                          type="text"
                          value={socialForm.whatsapp}
                          onChange={(e) =>
                            setSocialForm({ ...socialForm, whatsapp: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-social-instagram" className={LABEL_CLASS}>
                          Instagram Link
                        </label>
                        <input
                          id="admin-social-instagram"
                          type="text"
                          value={socialForm.instagram}
                          onChange={(e) =>
                            setSocialForm({ ...socialForm, instagram: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-social-facebook" className={LABEL_CLASS}>
                          Facebook Link
                        </label>
                        <input
                          id="admin-social-facebook"
                          type="text"
                          value={socialForm.facebook}
                          onChange={(e) =>
                            setSocialForm({ ...socialForm, facebook: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-social-youtube" className={LABEL_CLASS}>
                          YouTube Link
                        </label>
                        <input
                          id="admin-social-youtube"
                          type="text"
                          value={socialForm.youtube}
                          onChange={(e) =>
                            setSocialForm({ ...socialForm, youtube: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <h3 className="text-sm font-bold text-white mb-3">
                      Homepage Hero Photo or Video (Replace or Remove Anytime)
                    </h3>
                    <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-[#0D0F14] border border-zinc-800">
                      <div className="w-32 h-24 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0 flex items-center justify-center">
                        {coachingForm.heroMediaUrl ? (
                          coachingForm.heroMediaType === 'video' ||
                          isVideoFileOrUrl(coachingForm.heroMediaUrl) ? (
                            <video
                              src={coachingForm.heroMediaUrl}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <ResilientImage
                              src={coachingForm.heroMediaUrl}
                              alt="Hero campus media"
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 text-center px-2">
                            Media Removed
                          </span>
                        )}
                      </div>
                      <div className="flex-1 w-full space-y-2.5">
                        <label
                          htmlFor="admin-hero-media-url"
                          className={LABEL_CLASS}
                        >
                          Hero Photo or Video URL
                        </label>
                        <input
                          id="admin-hero-media-url"
                          type="text"
                          value={coachingForm.heroMediaUrl ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCoachingForm({
                              ...coachingForm,
                              heroMediaUrl: val,
                              heroMediaType: isVideoFileOrUrl(val) ? 'video' : 'image',
                            });
                          }}
                          placeholder="Leave blank to remove hero media, or upload/paste a photo or video URL"
                          className={INPUT_CLASS}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer">
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {uploadingFile ? 'Uploading...' : 'Upload / Replace Photo or Video'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const uploadedUrl = await uploadSelectedFile(file);
                                if (uploadedUrl) {
                                  setCoachingForm({
                                    ...coachingForm,
                                    heroMediaUrl: uploadedUrl,
                                    heroMediaType: isVideoFileOrUrl(file.name, file.type)
                                      ? 'video'
                                      : 'image',
                                  });
                                }
                              }}
                            />
                          </label>
                          {coachingForm.heroMediaUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setCoachingForm({
                                  ...coachingForm,
                                  heroMediaUrl: '',
                                  heroMediaType: 'image',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Remove Hero Media</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || uploadingFile}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Coaching & Social Settings'}
                  </button>
                </form>
              )}

              {/* Tab 2: Teacher Profile */}
              {activeTab === 'teacher' && teacherForm && (
                <form onSubmit={saveTeacherProfile} className="space-y-5">
                  <div className="flex flex-col sm:flex-row items-start gap-5 p-4 rounded-xl bg-[#0D0F14] border border-zinc-800">
                    <div className="w-24 h-28 rounded-lg overflow-hidden border border-zinc-800 shrink-0 bg-[#09090B]">
                      <ResilientImage
                        src={teacherForm.photoUrl}
                        alt={teacherForm.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <label htmlFor="admin-teacher-photo" className={LABEL_CLASS}>
                        Teacher Photo URL or Upload Photo
                      </label>
                      <input
                        id="admin-teacher-photo"
                        type="text"
                        value={teacherForm.photoUrl}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, photoUrl: e.target.value })
                        }
                        placeholder="Paste image URL, upload below, or remove photo"
                        className={INPUT_CLASS}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer">
                          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{uploadingFile ? 'Uploading...' : 'Upload / Replace Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const uploadedUrl = await uploadSelectedFile(file);
                              if (uploadedUrl) {
                                setTeacherForm({ ...teacherForm, photoUrl: uploadedUrl });
                              }
                            }}
                          />
                        </label>
                        {teacherForm.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setTeacherForm({ ...teacherForm, photoUrl: '' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Remove Photo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admin-teacher-name" className={LABEL_CLASS}>
                        Teacher Name
                      </label>
                      <input
                        id="admin-teacher-name"
                        type="text"
                        value={teacherForm.name}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, name: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-teacher-role" className={LABEL_CLASS}>
                        Role / Designation
                      </label>
                      <input
                        id="admin-teacher-role"
                        type="text"
                        value={teacherForm.roleTitle}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, roleTitle: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-teacher-intro" className={LABEL_CLASS}>
                        Introduction
                      </label>
                      <textarea
                        id="admin-teacher-intro"
                        rows={3}
                        value={teacherForm.introduction}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, introduction: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-teacher-qualifications" className={LABEL_CLASS}>
                        Qualifications
                      </label>
                      <input
                        id="admin-teacher-qualifications"
                        type="text"
                        value={teacherForm.qualifications}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, qualifications: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-teacher-experience" className={LABEL_CLASS}>
                        Teaching Experience
                      </label>
                      <input
                        id="admin-teacher-experience"
                        type="text"
                        value={teacherForm.experience}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, experience: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-teacher-classes" className={LABEL_CLASS}>
                        Classes Taught
                      </label>
                      <input
                        id="admin-teacher-classes"
                        type="text"
                        value={teacherForm.classesTaught}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, classesTaught: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-teacher-subjects" className={LABEL_CLASS}>
                        Subjects Taught (comma-separated)
                      </label>
                      <input
                        id="admin-teacher-subjects"
                        type="text"
                        value={subjectsText}
                        onChange={(e) => setSubjectsText(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="admin-teacher-skills" className={LABEL_CLASS}>
                        Teaching Skills (one per line)
                      </label>
                      <textarea
                        id="admin-teacher-skills"
                        rows={4}
                        value={skillsText}
                        onChange={(e) => setSkillsText(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Teacher Profile'}
                  </button>
                </form>
              )}

              {/* Tab 3: Daily Updates Management */}
              {activeTab === 'updates' && (
                <AdminDailyUpdatesTab
                  updates={adminData?.dailyUpdates || []}
                  saving={saving}
                  uploadingFile={uploadingFile}
                  onUploadFile={uploadSelectedFile}
                  onCreateUpdate={handleCreateDailyUpdate}
                  onSaveEditUpdate={handleSaveEditDailyUpdate}
                  onTogglePublishUpdate={handleTogglePublishDailyUpdate}
                  onDeleteUpdate={handleDeleteDailyUpdate}
                  onValidationError={(msg) => {
                    setErrorMessage(msg);
                    setErrorHint(null);
                  }}
                />
              )}

              {/* Tab 4: Photo, Video & PDF Gallery Manager */}
              {activeTab === 'gallery' && (
                <div className="space-y-8">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsGalleryDragOver(true);
                    }}
                    onDragLeave={() => setIsGalleryDragOver(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsGalleryDragOver(false);
                      await handleBulkGalleryUpload(e.dataTransfer.files);
                    }}
                    className={`p-5 rounded-xl border-2 border-dashed transition-colors space-y-3 ${
                      isGalleryDragOver
                        ? 'bg-blue-950/50 border-blue-500'
                        : 'bg-[#0D0F14] border-zinc-700'
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Unlimited Upload Zone (Photos, Videos &amp; PDFs)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Drag &amp; drop or select as many photos, videos, or PDFs as you want at once — everything saves &amp; publishes automatically.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="sm:w-56">
                        <label htmlFor="admin-bulk-gal-cat" className="sr-only">
                          Default Photo Category
                        </label>
                        <select
                          id="admin-bulk-gal-cat"
                          value={bulkGalleryCategory}
                          onChange={(e) => setBulkGalleryCategory(e.target.value as GalleryCategory)}
                          className={INPUT_CLASS}
                        >
                          <option value="coaching">Photos → Coaching Photos</option>
                          <option value="classroom">Photos → Classroom Photos</option>
                          <option value="activities">Photos → Educational Activities</option>
                          <option value="events">Photos → Events</option>
                        </select>
                      </div>

                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                        <Upload className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {bulkUploadProgress
                            ? bulkUploadProgress
                            : 'Drag & Drop or Select Photos, Videos & PDFs'}
                        </span>
                        <input
                          id="admin-bulk-gal-input"
                          type="file"
                          multiple
                          accept="image/*,video/*,application/pdf,.pdf"
                          className="sr-only"
                          disabled={saving || uploadingFile}
                          onChange={async (e) => {
                            await handleBulkGalleryUpload(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <form
                    onSubmit={saveNewGalleryItem}
                    className="p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 space-y-4"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Add Single Gallery Item (by URL or File)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Add a YouTube link, external URL, or single photo/video/PDF with custom title and caption.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="admin-gal-title" className={LABEL_CLASS}>
                          Title
                        </label>
                        <input
                          id="admin-gal-title"
                          type="text"
                          value={galTitle}
                          onChange={(e) => setGalTitle(e.target.value)}
                          placeholder="e.g. Science Quiz Activity or Class 10 Notes PDF"
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-gal-category" className={LABEL_CLASS}>
                          Category
                        </label>
                        <select
                          id="admin-gal-category"
                          value={galCategory}
                          onChange={(e) => {
                            const cat = e.target.value as GalleryCategory;
                            setGalCategory(cat);
                            setGalMediaType(
                              cat === 'pdfs' ? 'pdf' : cat === 'videos' ? 'video' : 'image',
                            );
                          }}
                          className={INPUT_CLASS}
                        >
                          <option value="coaching">Coaching Photos</option>
                          <option value="classroom">Classroom Photos</option>
                          <option value="activities">Educational Activities</option>
                          <option value="events">Events</option>
                          <option value="videos">Videos</option>
                          <option value="pdfs">Study PDFs &amp; Notices</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="admin-gal-url" className={LABEL_CLASS}>
                          Media URL (Photo, Video, YouTube Link, or PDF File)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="admin-gal-url"
                            type="text"
                            value={galMediaUrl}
                            onChange={(e) => setGalMediaUrl(e.target.value)}
                            placeholder="https://... or upload a photo, video, or PDF"
                            className={`flex-1 ${INPUT_CLASS}`}
                          />
                          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{uploadingFile ? 'Uploading...' : 'Upload Photo / Video / PDF'}</span>
                            <input
                              type="file"
                              accept="image/*,video/*,application/pdf,.pdf"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const uploadedUrl = await uploadSelectedFile(file);
                                if (uploadedUrl) {
                                  setGalMediaUrl(uploadedUrl);
                                  if (!galTitle.trim()) {
                                    setGalTitle(formatTitleFromFilename(file.name));
                                  }
                                  const detected = detectUploadCategoryAndType(
                                    file.name,
                                    file.type || '',
                                    galCategory,
                                  );
                                  setGalMediaType(detected.mediaType);
                                  if (detected.mediaType === 'pdf' || detected.mediaType === 'video') {
                                    setGalCategory(detected.category);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="admin-gal-caption" className={LABEL_CLASS}>
                          Caption
                        </label>
                        <input
                          id="admin-gal-caption"
                          type="text"
                          value={galCaption}
                          onChange={(e) => setGalCaption(e.target.value)}
                          placeholder="Short description shown below the photo, video, or PDF"
                          className={INPUT_CLASS}
                        />
                      </div>

                      {galCategory === 'videos' && (
                        <div className="md:col-span-2">
                          <label htmlFor="admin-gal-thumb" className={LABEL_CLASS}>
                            Video Thumbnail Image URL (Optional)
                          </label>
                          <input
                            id="admin-gal-thumb"
                            type="text"
                            value={galThumbUrl}
                            onChange={(e) => setGalThumbUrl(e.target.value)}
                            placeholder="Optional thumbnail URL for video cards"
                            className={INPUT_CLASS}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={galPublished}
                          onChange={(e) => setGalPublished(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 bg-[#09090B]"
                        />
                        <span>Publish immediately on public gallery</span>
                      </label>

                      <button
                        type="submit"
                        disabled={saving || uploadingFile}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Add to Gallery</span>
                      </button>
                    </div>
                  </form>

                  {/* Search, Type Filter & Inline-Editable Gallery List */}
                  {(() => {
                    const allGallery = adminData?.gallery || [];
                    const filteredGallery = filterAdminGalleryItems(
                      allGallery,
                      galFilterType,
                      galSearchQuery,
                    );
                    const photoCount = filterAdminGalleryItems(allGallery, 'image', '').length;
                    const videoCount = filterAdminGalleryItems(allGallery, 'video', '').length;
                    const pdfCount = filterAdminGalleryItems(allGallery, 'pdf', '').length;

                    return (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-white">
                            All Gallery Items ({filteredGallery.length} of {allGallery.length})
                          </h3>
                          <div className="relative sm:w-64">
                            <Search
                              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                              aria-hidden="true"
                            />
                            <input
                              id="admin-gal-search"
                              type="text"
                              value={galSearchQuery}
                              onChange={(e) => setGalSearchQuery(e.target.value)}
                              placeholder="Search photos, videos, PDFs..."
                              aria-label="Search gallery items"
                              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              { id: 'all', label: `All (${allGallery.length})` },
                              { id: 'image', label: `Photos (${photoCount})` },
                              { id: 'video', label: `Videos (${videoCount})` },
                              { id: 'pdf', label: `PDFs (${pdfCount})` },
                            ] as const
                          ).map((tabBtn) => (
                            <button
                              key={tabBtn.id}
                              type="button"
                              onClick={() => setGalFilterType(tabBtn.id)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                galFilterType === tabBtn.id
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'bg-[#0D0F14] text-slate-300 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              {tabBtn.label}
                            </button>
                          ))}
                        </div>

                        {filteredGallery.length === 0 ? (
                          <div className="p-6 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
                            No gallery items match this filter or search query.
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                            {filteredGallery.map((item) => {
                              const itemIsPdf =
                                item.mediaType === 'pdf' ||
                                item.category === 'pdfs' ||
                                isPdfFileOrUrl(item.mediaUrl);
                              const itemIsVideo =
                                !itemIsPdf &&
                                (item.mediaType === 'video' ||
                                  item.category === 'videos' ||
                                  isVideoFileOrUrl(item.mediaUrl));
                              const isEditingThis = inlineGalId === item.id;

                              return (
                                <div key={item.id} className="bg-[#111318]">
                                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0 flex items-center justify-center">
                                        {itemIsPdf ? (
                                          <FileText className="w-6 h-6 text-red-400" aria-hidden="true" />
                                        ) : itemIsVideo && !item.thumbnailUrl ? (
                                          <Film className="w-6 h-6 text-blue-400" aria-hidden="true" />
                                        ) : (
                                          <ResilientImage
                                            src={item.thumbnailUrl || item.mediaUrl}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-sm font-bold text-white truncate">
                                          {item.title}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                          {item.category} · {item.published ? 'Published' : 'Draft'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                      <label
                                        aria-label={`Replace file for ${item.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 border border-zinc-700 rounded-lg hover:bg-zinc-800 cursor-pointer"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Replace</span>
                                        <input
                                          type="file"
                                          accept="image/*,video/*,application/pdf,.pdf"
                                          className="sr-only"
                                          disabled={saving || uploadingFile}
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            await replaceGalleryItemMedia(item, file);
                                            e.target.value = '';
                                          }}
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() => void toggleGalleryPublish(item)}
                                        aria-label={`${item.published ? 'Unpublish' : 'Publish'} ${item.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 border border-zinc-700 rounded-lg hover:bg-zinc-800 cursor-pointer"
                                      >
                                        {item.published ? (
                                          <>
                                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Unpublish</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Publish</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => openInlineGalleryEdit(item)}
                                        aria-label={`Edit ${item.title}`}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg cursor-pointer ${
                                          isEditingThis
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'text-slate-200 border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>{isEditingThis ? 'Close Edit' : 'Edit'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => void deleteGalleryItem(item.id)}
                                        aria-label={`Delete ${item.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>

                                  {isEditingThis && (
                                    <div className="px-4 pb-4 pt-3 border-t border-zinc-800 bg-[#0D0F14] space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <label
                                            htmlFor={`inline-gal-title-${item.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Title
                                          </label>
                                          <input
                                            id={`inline-gal-title-${item.id}`}
                                            type="text"
                                            value={inlineGalTitle}
                                            onChange={(e) => setInlineGalTitle(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>

                                        <div>
                                          <label
                                            htmlFor={`inline-gal-cat-${item.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Category
                                          </label>
                                          <select
                                            id={`inline-gal-cat-${item.id}`}
                                            value={inlineGalCategory}
                                            onChange={(e) => {
                                              const cat = e.target.value as GalleryCategory;
                                              setInlineGalCategory(cat);
                                              setInlineGalMediaType(
                                                cat === 'pdfs' ? 'pdf' : cat === 'videos' ? 'video' : 'image',
                                              );
                                            }}
                                            className={INPUT_CLASS}
                                          >
                                            <option value="coaching">Coaching Photos</option>
                                            <option value="classroom">Classroom Photos</option>
                                            <option value="activities">Educational Activities</option>
                                            <option value="events">Events</option>
                                            <option value="videos">Videos</option>
                                            <option value="pdfs">Study PDFs &amp; Notices</option>
                                          </select>
                                        </div>

                                        <div className="md:col-span-2">
                                          <label
                                            htmlFor={`inline-gal-url-${item.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Media URL / Uploaded File
                                          </label>
                                          <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                              id={`inline-gal-url-${item.id}`}
                                              type="text"
                                              value={inlineGalMediaUrl}
                                              onChange={(e) => setInlineGalMediaUrl(e.target.value)}
                                              className={`flex-1 ${INPUT_CLASS}`}
                                            />
                                            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                                              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                              <span>{uploadingFile ? 'Uploading...' : 'Replace File'}</span>
                                              <input
                                                type="file"
                                                accept="image/*,video/*,application/pdf,.pdf"
                                                className="sr-only"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  const uploadedUrl = await uploadSelectedFile(file);
                                                  if (uploadedUrl) {
                                                    setInlineGalMediaUrl(uploadedUrl);
                                                    const detected = detectUploadCategoryAndType(
                                                      file.name,
                                                      file.type || '',
                                                      inlineGalCategory,
                                                    );
                                                    setInlineGalMediaType(detected.mediaType);
                                                    if (
                                                      detected.mediaType === 'pdf' ||
                                                      detected.mediaType === 'video'
                                                    ) {
                                                      setInlineGalCategory(detected.category);
                                                    }
                                                  }
                                                }}
                                              />
                                            </label>
                                          </div>
                                        </div>

                                        <div className="md:col-span-2">
                                          <label
                                            htmlFor={`inline-gal-caption-${item.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Caption
                                          </label>
                                          <input
                                            id={`inline-gal-caption-${item.id}`}
                                            type="text"
                                            value={inlineGalCaption}
                                            onChange={(e) => setInlineGalCaption(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>

                                        {(inlineGalCategory === 'videos' || inlineGalMediaType === 'video') && (
                                          <div className="md:col-span-2">
                                            <label
                                              htmlFor={`inline-gal-thumb-${item.id}`}
                                              className={LABEL_CLASS}
                                            >
                                              Video Thumbnail URL (Optional)
                                            </label>
                                            <input
                                              id={`inline-gal-thumb-${item.id}`}
                                              type="text"
                                              value={inlineGalThumbUrl}
                                              onChange={(e) => setInlineGalThumbUrl(e.target.value)}
                                              className={INPUT_CLASS}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={inlineGalPublished}
                                            onChange={(e) => setInlineGalPublished(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-700 bg-[#09090B]"
                                          />
                                          <span>Published on gallery</span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setInlineGalId(null)}
                                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            disabled={saving || uploadingFile}
                                            onClick={() => void saveInlineGalleryEdit(item.id)}
                                            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                                          >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 5: Learning Hub & PDFs Manager */}
              {activeTab === 'hub' && (
                <div className="space-y-8">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsHubDragOver(true);
                    }}
                    onDragLeave={() => setIsHubDragOver(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsHubDragOver(false);
                      await handleBulkPdfUpload(e.dataTransfer.files);
                    }}
                    className={`p-5 rounded-xl border-2 border-dashed transition-colors space-y-3 ${
                      isHubDragOver
                        ? 'bg-blue-950/50 border-blue-500'
                        : 'bg-[#0D0F14] border-zinc-700'
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Unlimited Drag &amp; Drop Study PDFs
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Drag &amp; drop or select as many PDF files as you want at once — each PDF becomes a viewable &amp; downloadable card in Learning Hub.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="sm:w-56">
                        <label htmlFor="admin-bulk-pdf-topic" className="sr-only">
                          Topic Area for Bulk PDFs
                        </label>
                        <input
                          id="admin-bulk-pdf-topic"
                          type="text"
                          value={bulkPdfTopic}
                          onChange={(e) => setBulkPdfTopic(e.target.value)}
                          placeholder="Topic Area (e.g. Mathematics)"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                        <FileText className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {bulkUploadProgress
                            ? bulkUploadProgress
                            : 'Drag & Drop or Select Multiple PDFs'}
                        </span>
                        <input
                          id="admin-bulk-pdf-input"
                          type="file"
                          multiple
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          disabled={saving || uploadingFile}
                          onChange={async (e) => {
                            await handleBulkPdfUpload(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <form
                    onSubmit={saveNewHubResource}
                    className="p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 space-y-4"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Add Study Guide or PDF to Learning Hub
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Create a detailed study note or attach a single PDF with custom summary &amp; formulas.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="admin-hub-title" className={LABEL_CLASS}>
                          Title
                        </label>
                        <input
                          id="admin-hub-title"
                          type="text"
                          value={hubTitle}
                          onChange={(e) => setHubTitle(e.target.value)}
                          placeholder="e.g. Trigonometry Ratios Sheet"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-hub-topic" className={LABEL_CLASS}>
                          Topic Area
                        </label>
                        <input
                          id="admin-hub-topic"
                          type="text"
                          value={hubTopic}
                          onChange={(e) => setHubTopic(e.target.value)}
                          placeholder="e.g. Mathematics"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="admin-hub-pdf" className={LABEL_CLASS}>
                          Attach Study PDF (Optional)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="admin-hub-pdf"
                            type="text"
                            value={hubPdfUrl}
                            onChange={(e) => setHubPdfUrl(e.target.value)}
                            placeholder="Upload a PDF or paste PDF URL"
                            className={`flex-1 ${INPUT_CLASS}`}
                          />
                          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{uploadingFile ? 'Uploading...' : 'Upload PDF'}</span>
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const uploadedUrl = await uploadSelectedFile(file);
                                if (uploadedUrl) {
                                  setHubPdfUrl(uploadedUrl);
                                  setHubPdfName(file.name);
                                  if (!hubTitle.trim()) {
                                    setHubTitle(formatTitleFromFilename(file.name));
                                  }
                                }
                              }}
                            />
                          </label>
                          {hubPdfUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setHubPdfUrl('');
                                setHubPdfName('');
                              }}
                              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Remove PDF</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="admin-hub-summary" className={LABEL_CLASS}>
                          Short Summary
                        </label>
                        <input
                          id="admin-hub-summary"
                          type="text"
                          value={hubSummary}
                          onChange={(e) => setHubSummary(e.target.value)}
                          placeholder="1-sentence overview shown on the Learning Hub card"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="admin-hub-content" className={LABEL_CLASS}>
                          Full Study Notes (Hindi + English)
                        </label>
                        <textarea
                          id="admin-hub-content"
                          rows={4}
                          value={hubContent}
                          onChange={(e) => setHubContent(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-hub-lang" className={LABEL_CLASS}>
                          Language Note
                        </label>
                        <input
                          id="admin-hub-lang"
                          type="text"
                          value={hubLang}
                          onChange={(e) => setHubLang(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-hub-formulas" className={LABEL_CLASS}>
                          Key Formulas (one per line)
                        </label>
                        <textarea
                          id="admin-hub-formulas"
                          rows={2}
                          value={hubFormulasText}
                          onChange={(e) => setHubFormulasText(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hubPublished}
                          onChange={(e) => setHubPublished(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 bg-[#09090B]"
                        />
                        <span>Publish on Learning Hub</span>
                      </label>

                      <button
                        type="submit"
                        disabled={saving || uploadingFile}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Add Study Guide</span>
                      </button>
                    </div>
                  </form>

                  {/* Search & Inline-Editable Learning Hub List */}
                  {(() => {
                    const allHub = adminData?.learningHub || [];
                    const filteredHub = filterAdminLearningResources(allHub, hubSearchQuery);
                    return (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-white">
                            All Learning Hub Resources ({filteredHub.length} of {allHub.length})
                          </h3>
                          <div className="relative sm:w-64">
                            <Search
                              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                              aria-hidden="true"
                            />
                            <input
                              id="admin-hub-search"
                              type="text"
                              value={hubSearchQuery}
                              onChange={(e) => setHubSearchQuery(e.target.value)}
                              placeholder="Search study notes or PDFs..."
                              aria-label="Search learning hub items"
                              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500"
                            />
                          </div>
                        </div>

                        {filteredHub.length === 0 ? (
                          <div className="p-6 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
                            No study guides or PDFs match your search.
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                            {filteredHub.map((resItem) => {
                              const isEditingThis = inlineHubId === resItem.id;
                              return (
                                <div key={resItem.id} className="bg-[#111318]">
                                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">
                                          {resItem.title}
                                        </span>
                                        {resItem.pdfUrl && (
                                          <span className="text-[11px] font-mono font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                                            PDF
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {resItem.topicArea} · {resItem.published ? 'Published' : 'Draft'}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void toggleHubPublish(resItem)}
                                        aria-label={`${resItem.published ? 'Unpublish' : 'Publish'} ${resItem.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 border border-zinc-700 rounded-lg hover:bg-zinc-800 cursor-pointer"
                                      >
                                        {resItem.published ? (
                                          <>
                                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Unpublish</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Publish</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openInlineHubEdit(resItem)}
                                        aria-label={`Edit ${resItem.title}`}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg cursor-pointer ${
                                          isEditingThis
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'text-slate-200 border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>{isEditingThis ? 'Close Edit' : 'Edit'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deleteHubResource(resItem.id)}
                                        aria-label={`Delete ${resItem.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>

                                  {isEditingThis && (
                                    <div className="px-4 pb-4 pt-3 border-t border-zinc-800 bg-[#0D0F14] space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <label
                                            htmlFor={`inline-hub-title-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Title
                                          </label>
                                          <input
                                            id={`inline-hub-title-${resItem.id}`}
                                            type="text"
                                            value={inlineHubTitle}
                                            onChange={(e) => setInlineHubTitle(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            htmlFor={`inline-hub-topic-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Topic Area
                                          </label>
                                          <input
                                            id={`inline-hub-topic-${resItem.id}`}
                                            type="text"
                                            value={inlineHubTopic}
                                            onChange={(e) => setInlineHubTopic(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                        <div className="md:col-span-2">
                                          <label
                                            htmlFor={`inline-hub-pdf-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            PDF File / URL (Optional)
                                          </label>
                                          <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                              id={`inline-hub-pdf-${resItem.id}`}
                                              type="text"
                                              value={inlineHubPdfUrl}
                                              onChange={(e) => setInlineHubPdfUrl(e.target.value)}
                                              className={`flex-1 ${INPUT_CLASS}`}
                                            />
                                            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                                              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                              <span>
                                                {uploadingFile
                                                  ? 'Uploading...'
                                                  : inlineHubPdfUrl
                                                    ? 'Replace PDF'
                                                    : 'Upload PDF'}
                                              </span>
                                              <input
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                className="sr-only"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  const uploadedUrl = await uploadSelectedFile(file);
                                                  if (uploadedUrl) {
                                                    setInlineHubPdfUrl(uploadedUrl);
                                                    setInlineHubPdfName(file.name);
                                                  }
                                                }}
                                              />
                                            </label>
                                            {inlineHubPdfUrl && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setInlineHubPdfUrl('');
                                                  setInlineHubPdfName('');
                                                }}
                                                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer shrink-0"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>Remove PDF</span>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="md:col-span-2">
                                          <label
                                            htmlFor={`inline-hub-summary-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Short Summary
                                          </label>
                                          <input
                                            id={`inline-hub-summary-${resItem.id}`}
                                            type="text"
                                            value={inlineHubSummary}
                                            onChange={(e) => setInlineHubSummary(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                        <div className="md:col-span-2">
                                          <label
                                            htmlFor={`inline-hub-content-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Full Study Notes (Hindi + English)
                                          </label>
                                          <textarea
                                            id={`inline-hub-content-${resItem.id}`}
                                            rows={3}
                                            value={inlineHubContent}
                                            onChange={(e) => setInlineHubContent(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            htmlFor={`inline-hub-lang-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Language Note
                                          </label>
                                          <input
                                            id={`inline-hub-lang-${resItem.id}`}
                                            type="text"
                                            value={inlineHubLang}
                                            onChange={(e) => setInlineHubLang(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            htmlFor={`inline-hub-formulas-${resItem.id}`}
                                            className={LABEL_CLASS}
                                          >
                                            Key Formulas (one per line)
                                          </label>
                                          <textarea
                                            id={`inline-hub-formulas-${resItem.id}`}
                                            rows={2}
                                            value={inlineHubFormulasText}
                                            onChange={(e) => setInlineHubFormulasText(e.target.value)}
                                            className={INPUT_CLASS}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={inlineHubPublished}
                                            onChange={(e) => setInlineHubPublished(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-700 bg-[#09090B]"
                                          />
                                          <span>Published on Learning Hub</span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setInlineHubId(null)}
                                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            disabled={saving || uploadingFile}
                                            onClick={() => void saveInlineHubEdit(resItem.id)}
                                            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                                          >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 6: User Feedback & Ratings (Private Admin Review) */}
              {activeTab === 'feedback' && (
                <AdminFeedbackTab
                  feedbacks={adminData?.feedbacks || []}
                  onDeleteFeedback={handleDeleteFeedback}
                  onRefreshFeedbacks={handleRefreshFeedbacks}
                  refreshing={refreshingFeedbacks}
                />
              )}

              {/* Tab 7: Student / Parent Enquiries */}
              {activeTab === 'enquiries' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    Submitted Enquiries ({adminData?.enquiries?.length || 0})
                  </h3>
                  {(adminData?.enquiries || []).length === 0 ? (
                    <div className="p-8 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
                      No enquiries submitted yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
                      {(adminData?.enquiries || []).map((enq: EnquiryItem) => (
                        <div
                          key={enq.id}
                          className="p-4 bg-[#111318] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                        >
                          <div>
                            <div className="text-sm font-bold text-white">
                              {enq.studentName}
                            </div>
                            <div className="text-xs font-mono text-blue-400 mt-0.5">
                              {enq.phoneOrEmail} · {formatDisplayDate(enq.createdAt)}
                            </div>
                            <p className="mt-2 text-sm text-slate-300">{enq.message}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void deleteEnquiry(enq.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
