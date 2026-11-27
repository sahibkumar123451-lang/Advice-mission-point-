import { useEffect, useMemo, useState } from 'react';
import { Check, Image as ImageIcon, Search, Trash2 } from 'lucide-react';
import type {
  CoachingInfo,
  DailyUpdateItem,
  GalleryItem,
  TeacherProfile,
} from '../../types/coaching';
import {
  isPdfFileOrUrl,
  isVideoFileOrUrl,
  resolveHeroCaptionDisplay,
} from '../../utils/coachingLogic';
import { ResilientImage } from '../ResilientImage';

type PhotoScopeFilter = 'all' | 'site' | 'gallery' | 'updates';

interface AdminPhotoDescriptionsTabProps {
  coaching: CoachingInfo;
  teacher: TeacherProfile;
  gallery: GalleryItem[];
  dailyUpdates: DailyUpdateItem[];
  saving: boolean;
  onSaveHeroDescription: (title: string, text: string) => Promise<boolean>;
  onSaveTeacherPhotoCaption: (caption: string) => Promise<boolean>;
  onSaveGalleryPhotoCaption: (item: GalleryItem, caption: string) => Promise<boolean>;
  onSaveDailyUpdatePhotoDescription: (
    item: DailyUpdateItem,
    description: string,
  ) => Promise<boolean>;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

export function AdminPhotoDescriptionsTab({
  coaching,
  teacher,
  gallery,
  dailyUpdates,
  saving,
  onSaveHeroDescription,
  onSaveTeacherPhotoCaption,
  onSaveGalleryPhotoCaption,
  onSaveDailyUpdatePhotoDescription,
}: AdminPhotoDescriptionsTabProps) {
  const [scopeFilter, setScopeFilter] = useState<PhotoScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const initialHero = resolveHeroCaptionDisplay(coaching);
  const [heroTitleDraft, setHeroTitleDraft] = useState(initialHero.title);
  const [heroTextDraft, setHeroTextDraft] = useState(initialHero.text);
  const [teacherCaptionDraft, setTeacherCaptionDraft] = useState(teacher.photoCaption ?? '');
  const [galleryDrafts, setGalleryDrafts] = useState<Record<string, string>>({});
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const resolved = resolveHeroCaptionDisplay(coaching);
    setHeroTitleDraft(resolved.title);
    setHeroTextDraft(resolved.text);
  }, [
    coaching.heroCaptionTitle,
    coaching.heroCaptionText,
    coaching.officeHours,
    coaching.address,
  ]);

  useEffect(() => {
    setTeacherCaptionDraft(teacher.photoCaption ?? '');
  }, [teacher.photoCaption]);

  const galleryPhotos = useMemo(
    () =>
      gallery.filter((item) => {
        if (!item.mediaUrl?.trim()) return false;
        const isPdf =
          item.mediaType === 'pdf' ||
          item.category === 'pdfs' ||
          isPdfFileOrUrl(item.mediaUrl);
        const isVideo =
          item.mediaType === 'video' ||
          item.category === 'videos' ||
          isVideoFileOrUrl(item.mediaUrl);
        return !isPdf && !isVideo;
      }),
    [gallery],
  );

  const updatePhotos = useMemo(
    () =>
      dailyUpdates.filter(
        (item) =>
          item.mediaType === 'image' &&
          Boolean(item.mediaUrl?.trim()) &&
          !isPdfFileOrUrl(item.mediaUrl || '') &&
          !isVideoFileOrUrl(item.mediaUrl || ''),
      ),
    [dailyUpdates],
  );

  useEffect(() => {
    setGalleryDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of galleryPhotos) {
        next[item.id] = prev[item.id] !== undefined && busyKey === `gal-${item.id}` ? prev[item.id] : item.caption || '';
      }
      return next;
    });
  }, [galleryPhotos, busyKey]);

  useEffect(() => {
    setUpdateDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of updatePhotos) {
        next[item.id] = prev[item.id] !== undefined && busyKey === `upd-${item.id}` ? prev[item.id] : item.description || '';
      }
      return next;
    });
  }, [updatePhotos, busyKey]);

  const heroImageUrl = coaching.heroMediaUrl?.trim() || '';
  const hasHeroPhoto = Boolean(
    heroImageUrl &&
      coaching.heroMediaType !== 'video' &&
      !isVideoFileOrUrl(heroImageUrl),
  );
  const hasTeacherPhoto = Boolean(teacher.photoUrl?.trim());

  const queryNorm = searchQuery.trim().toLowerCase();
  const matchesSearch = (...fields: Array<string | undefined>) => {
    if (!queryNorm) return true;
    return fields.some((f) => (f || '').toLowerCase().includes(queryNorm));
  };

  const showHeroCard =
    hasHeroPhoto &&
    (scopeFilter === 'all' || scopeFilter === 'site') &&
    matchesSearch(
      'Homepage Hero Campus Photo',
      heroTitleDraft,
      heroTextDraft,
      coaching.name,
    );

  const showTeacherCard =
    hasTeacherPhoto &&
    (scopeFilter === 'all' || scopeFilter === 'site') &&
    matchesSearch('Teacher Profile Photo', teacher.name, teacherCaptionDraft);

  const visibleGalleryPhotos =
    scopeFilter === 'all' || scopeFilter === 'gallery'
      ? galleryPhotos.filter((item) =>
          matchesSearch(item.title, item.caption, item.category, 'Gallery Photo'),
        )
      : [];

  const visibleUpdatePhotos =
    scopeFilter === 'all' || scopeFilter === 'updates'
      ? updatePhotos.filter((item) =>
          matchesSearch(item.title, item.description, item.date, 'Daily Update Photo'),
        )
      : [];

  const totalPhotoCount =
    (hasHeroPhoto ? 1 : 0) +
    (hasTeacherPhoto ? 1 : 0) +
    galleryPhotos.length +
    updatePhotos.length;

  const visibleCount =
    (showHeroCard ? 1 : 0) +
    (showTeacherCard ? 1 : 0) +
    visibleGalleryPhotos.length +
    visibleUpdatePhotos.length;

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              Manage Every Photo&apos;s Description ({totalPhotoCount} Website Photos)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Edit or manually remove the description shown on any photo across Homepage Hero, Teacher Profile, Gallery, and Daily Updates.
            </p>
          </div>

          <div className="relative sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="admin-photos-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search photo or description..."
              aria-label="Search photo descriptions"
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: `All Photos (${totalPhotoCount})` },
              {
                id: 'site',
                label: `Hero & Teacher (${(hasHeroPhoto ? 1 : 0) + (hasTeacherPhoto ? 1 : 0)})`,
              },
              { id: 'gallery', label: `Gallery Photos (${galleryPhotos.length})` },
              { id: 'updates', label: `Daily Update Photos (${updatePhotos.length})` },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setScopeFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                scopeFilter === btn.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#111318] text-slate-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {visibleCount === 0 ? (
        <div className="p-8 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
          <ImageIcon className="w-7 h-7 text-blue-400 mx-auto mb-2" aria-hidden="true" />
          No website photos match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Homepage Hero Photo */}
          {showHeroCard && (
            <div
              data-testid="photo-desc-card-hero"
              className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 flex flex-col md:flex-row gap-4"
            >
              <div className="w-full md:w-44 h-36 md:h-32 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0">
                <ResilientImage
                  src={heroImageUrl}
                  alt="Homepage Hero Campus Photo"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      Homepage Hero Photo
                    </span>
                    <h4 className="mt-1 text-sm font-bold text-white">
                      Main Hero Campus Photo Overlay
                    </h4>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      heroTitleDraft.trim() || heroTextDraft.trim()
                        ? 'text-blue-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {heroTitleDraft.trim() || heroTextDraft.trim()
                      ? 'Description Shown'
                      : 'Description Removed'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="photos-tab-hero-title"
                      className="block text-xs font-semibold text-slate-300 mb-1"
                    >
                      Small Heading Label (Optional)
                    </label>
                    <input
                      id="photos-tab-hero-title"
                      type="text"
                      value={heroTitleDraft}
                      onChange={(e) => setHeroTitleDraft(e.target.value)}
                      placeholder="Leave empty to hide label"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="photos-tab-hero-text"
                      className="block text-xs font-semibold text-slate-300 mb-1"
                    >
                      Hero Photo Description (Optional)
                    </label>
                    <input
                      id="photos-tab-hero-text"
                      type="text"
                      value={heroTextDraft}
                      onChange={(e) => setHeroTextDraft(e.target.value)}
                      placeholder="Write description or leave empty to hide"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || busyKey === 'hero'}
                    onClick={async () => {
                      setBusyKey('hero');
                      await onSaveHeroDescription(heroTitleDraft.trim(), heroTextDraft.trim());
                      setBusyKey(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{busyKey === 'hero' ? 'Saving...' : 'Save Description'}</span>
                  </button>

                  {(heroTitleDraft.trim() || heroTextDraft.trim() || resolveHeroCaptionDisplay(coaching).visible) && (
                    <button
                      type="button"
                      disabled={saving || busyKey === 'hero'}
                      onClick={async () => {
                        setBusyKey('hero');
                        setHeroTitleDraft('');
                        setHeroTextDraft('');
                        await onSaveHeroDescription('', '');
                        setBusyKey(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove Description</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Teacher Profile Photo */}
          {showTeacherCard && (
            <div
              data-testid="photo-desc-card-teacher"
              className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 flex flex-col md:flex-row gap-4"
            >
              <div className="w-full md:w-44 h-44 md:h-36 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0">
                <ResilientImage
                  src={teacher.photoUrl}
                  alt={teacher.name}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded bg-red-500/15 text-red-300 border border-red-500/30">
                      Teacher Profile Photo
                    </span>
                    <h4 className="mt-1 text-sm font-bold text-white">{teacher.name}</h4>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      teacherCaptionDraft.trim() ? 'text-blue-400' : 'text-slate-500'
                    }`}
                  >
                    {teacherCaptionDraft.trim() ? 'Description Shown' : 'No Description'}
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="photos-tab-teacher-caption"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Teacher Photo Description (Optional)
                  </label>
                  <textarea
                    id="photos-tab-teacher-caption"
                    rows={2}
                    value={teacherCaptionDraft}
                    onChange={(e) => setTeacherCaptionDraft(e.target.value)}
                    placeholder="Optional caption shown on Teacher Photo (leave blank to hide)"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || busyKey === 'teacher'}
                    onClick={async () => {
                      setBusyKey('teacher');
                      await onSaveTeacherPhotoCaption(teacherCaptionDraft.trim());
                      setBusyKey(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{busyKey === 'teacher' ? 'Saving...' : 'Save Description'}</span>
                  </button>

                  {(teacherCaptionDraft.trim() || teacher.photoCaption?.trim()) && (
                    <button
                      type="button"
                      disabled={saving || busyKey === 'teacher'}
                      onClick={async () => {
                        setBusyKey('teacher');
                        setTeacherCaptionDraft('');
                        await onSaveTeacherPhotoCaption('');
                        setBusyKey(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove Description</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gallery Photos */}
          {visibleGalleryPhotos.map((item) => {
            const draft = galleryDrafts[item.id] ?? item.caption ?? '';
            const cardBusy = busyKey === `gal-${item.id}`;
            return (
              <div
                key={item.id}
                data-testid={`photo-desc-card-gal-${item.id}`}
                className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 flex flex-col md:flex-row gap-4"
              >
                <div className="w-full md:w-44 h-36 md:h-32 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0">
                  <ResilientImage
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Gallery Photo · {item.category}
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-white">{item.title}</h4>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        draft.trim() ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    >
                      {draft.trim() ? 'Description Shown' : 'No Description'}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor={`photos-tab-gal-${item.id}`}
                      className="block text-xs font-semibold text-slate-300 mb-1"
                    >
                      Photo Description / Caption
                    </label>
                    <textarea
                      id={`photos-tab-gal-${item.id}`}
                      rows={2}
                      value={draft}
                      onChange={(e) =>
                        setGalleryDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Write description for this gallery photo, or leave blank to hide"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={saving || cardBusy}
                      onClick={async () => {
                        setBusyKey(`gal-${item.id}`);
                        await onSaveGalleryPhotoCaption(item, draft.trim());
                        setBusyKey(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{cardBusy ? 'Saving...' : 'Save Description'}</span>
                    </button>

                    {(draft.trim() || item.caption?.trim()) && (
                      <button
                        type="button"
                        disabled={saving || cardBusy}
                        onClick={async () => {
                          setBusyKey(`gal-${item.id}`);
                          setGalleryDrafts((prev) => ({ ...prev, [item.id]: '' }));
                          await onSaveGalleryPhotoCaption(item, '');
                          setBusyKey(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Remove Description</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Daily Updates Photos */}
          {visibleUpdatePhotos.map((item) => {
            const draft = updateDrafts[item.id] ?? item.description ?? '';
            const cardBusy = busyKey === `upd-${item.id}`;
            return (
              <div
                key={item.id}
                data-testid={`photo-desc-card-upd-${item.id}`}
                className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 flex flex-col md:flex-row gap-4"
              >
                <div className="w-full md:w-44 h-36 md:h-32 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0">
                  <ResilientImage
                    src={item.mediaUrl || ''}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded bg-red-500/15 text-red-300 border border-red-500/30">
                        Daily Update Photo · {item.date}
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-white">{item.title}</h4>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        draft.trim() ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    >
                      {draft.trim() ? 'Description Shown' : 'No Description'}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor={`photos-tab-upd-${item.id}`}
                      className="block text-xs font-semibold text-slate-300 mb-1"
                    >
                      Daily Update Photo Description
                    </label>
                    <textarea
                      id={`photos-tab-upd-${item.id}`}
                      rows={2}
                      value={draft}
                      onChange={(e) =>
                        setUpdateDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Write description for this daily update photo, or leave blank to hide"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={saving || cardBusy}
                      onClick={async () => {
                        setBusyKey(`upd-${item.id}`);
                        await onSaveDailyUpdatePhotoDescription(item, draft.trim());
                        setBusyKey(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{cardBusy ? 'Saving...' : 'Save Description'}</span>
                    </button>

                    {(draft.trim() || item.description?.trim()) && (
                      <button
                        type="button"
                        disabled={saving || cardBusy}
                        onClick={async () => {
                          setBusyKey(`upd-${item.id}`);
                          setUpdateDrafts((prev) => ({ ...prev, [item.id]: '' }));
                          await onSaveDailyUpdatePhotoDescription(item, '');
                          setBusyKey(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Remove Description</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
