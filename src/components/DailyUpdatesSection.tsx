import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Play,
  Search,
  X,
} from 'lucide-react';
import type { DailyUpdateItem, DailyUpdateMediaType } from '../types/coaching';
import {
  filterDailyUpdates,
  formatDisplayDate,
  getYouTubeEmbedUrl,
  isPdfFileOrUrl,
  isVideoFileOrUrl,
} from '../utils/coachingLogic';
import { ResilientImage } from './ResilientImage';

interface DailyUpdatesSectionProps {
  updates: DailyUpdateItem[];
  onManageUpdatesClick?: () => void;
}

const FILTER_TABS: Array<{ id: 'all' | DailyUpdateMediaType; label: string }> = [
  { id: 'all', label: 'All Updates' },
  { id: 'image', label: 'Photos' },
  { id: 'video', label: 'Videos' },
  { id: 'pdf', label: 'PDF Documents' },
  { id: 'none', label: 'Notices' },
];

const MEDIA_LABELS: Record<DailyUpdateMediaType, string> = {
  image: 'Photo Update',
  video: 'Video Update',
  pdf: 'PDF Document',
  none: 'Coaching Notice',
};

export function DailyUpdatesSection({
  updates,
  onManageUpdatesClick,
}: DailyUpdatesSectionProps) {
  const [filterType, setFilterType] = useState<'all' | DailyUpdateMediaType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUpdate, setSelectedUpdate] = useState<DailyUpdateItem | null>(null);
  const [showInlinePdf, setShowInlinePdf] = useState(true);

  const visibleUpdates = useMemo(
    () => filterDailyUpdates(updates, filterType, searchQuery, false),
    [updates, filterType, searchQuery],
  );

  const resolveItemMediaType = (item: DailyUpdateItem): DailyUpdateMediaType => {
    if (!item.mediaUrl?.trim() || item.mediaType === 'none') return 'none';
    if (item.mediaType === 'pdf' || isPdfFileOrUrl(item.mediaUrl)) return 'pdf';
    if (item.mediaType === 'video' || isVideoFileOrUrl(item.mediaUrl) || getYouTubeEmbedUrl(item.mediaUrl)) {
      return 'video';
    }
    return 'image';
  };

  const selectedMediaType = selectedUpdate ? resolveItemMediaType(selectedUpdate) : 'none';
  const selectedYoutubeUrl =
    selectedUpdate?.mediaUrl ? getYouTubeEmbedUrl(selectedUpdate.mediaUrl) : null;

  return (
    <section
      id="daily-updates"
      className="py-16 lg:py-24 bg-[#0D0F14] border-b border-zinc-800/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-red-400 tracking-wide uppercase">
              Daily Campus &amp; Study Board
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
              Daily Updates
            </h2>
            <p className="mt-2 text-base text-slate-300 leading-relaxed">
              Daily notices, classroom photos, study videos, and downloadable PDF sheets uploaded by Advice Coaching Classes — organized by date with all past updates preserved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-80">
            <div className="w-full">
              <label htmlFor="daily-updates-search" className="sr-only">
                Search Daily Updates
              </label>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="daily-updates-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search updates by title or date..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#141720] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {onManageUpdatesClick && (
              <button
                type="button"
                onClick={onManageUpdatesClick}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-[#141720] border border-zinc-700 hover:border-blue-500/60 hover:bg-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                <span>Manage Daily Updates</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filterType === tab.id
                  ? 'bg-blue-600 text-white border border-blue-500'
                  : 'bg-[#141720] text-slate-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visibleUpdates.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#141720] p-10 text-center">
            <Bell className="w-8 h-8 text-blue-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-base font-semibold text-white">
              No updates match your current filter.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Clear the search filter or check back soon for new coaching photos, videos, PDFs, and notices.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleUpdates.map((item) => {
              const kind = resolveItemMediaType(item);
              const isYoutube = item.mediaUrl ? Boolean(getYouTubeEmbedUrl(item.mediaUrl)) : false;

              return (
                <article
                  key={item.id}
                  className="group rounded-2xl border border-zinc-800 bg-[#141720] hover:border-blue-500/50 transition-colors overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlinePdf(true);
                      setSelectedUpdate(item);
                    }}
                    aria-label={`Open update: ${item.title}`}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-[#09090B] text-left cursor-pointer border-b border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {kind === 'image' && item.mediaUrl ? (
                      <ResilientImage
                        src={item.mediaUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : kind === 'video' && item.mediaUrl ? (
                      <div className="relative w-full h-full bg-[#09090B] flex items-center justify-center">
                        {!isYoutube && item.mediaUrl.startsWith('/uploads/') ? (
                          <video
                            src={item.mediaUrl}
                            className="w-full h-full object-cover opacity-80"
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#09090B] via-[#121826] to-[#1A1216] flex flex-col items-center justify-center p-5 text-center">
                            <Film className="w-9 h-9 text-blue-400 mb-2" aria-hidden="true" />
                            <span className="text-xs font-semibold text-slate-300 line-clamp-2 max-w-[230px]">
                              {item.title}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 ml-0.5 fill-current" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    ) : kind === 'pdf' ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#0B1120] via-[#111827] to-[#1A1318] p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mb-3">
                          <FileText className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
                          PDF Update
                        </span>
                        <span className="mt-1 text-sm font-semibold text-white line-clamp-2 max-w-[230px]">
                          {item.fileName || item.title}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0D1321] via-[#141720] to-[#16121A] p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-3">
                          <Bell className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-mono uppercase tracking-wider text-red-400">
                          Coaching Notice
                        </span>
                        <span className="mt-1 text-sm font-semibold text-white line-clamp-2 max-w-[230px]">
                          {item.title}
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-semibold ${
                            kind === 'pdf' || kind === 'video'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          }`}
                        >
                          {kind === 'image' && <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                          {kind === 'video' && <Film className="w-3.5 h-3.5" aria-hidden="true" />}
                          {kind === 'pdf' && <FileText className="w-3.5 h-3.5" aria-hidden="true" />}
                          {kind === 'none' && <Bell className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span>{MEDIA_LABELS[kind]}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 text-slate-400 font-mono tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>{formatDisplayDate(item.date)}</span>
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-white leading-snug">
                        {item.title}
                      </h3>

                      {item.description && (
                        <p className="mt-2 text-sm text-slate-300 leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlinePdf(true);
                          setSelectedUpdate(item);
                        }}
                        className="text-xs sm:text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        {kind === 'image'
                          ? 'Open Photo →'
                          : kind === 'video'
                            ? 'Watch Video →'
                            : kind === 'pdf'
                              ? 'View / Download PDF →'
                              : 'Read Full Notice →'}
                      </button>

                      {kind === 'pdf' && item.mediaUrl && (
                        <a
                          href={item.mediaUrl}
                          download={item.fileName || `${item.title}.pdf`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white"
                        >
                          <Download className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                          <span>PDF</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Media & Notice Modal */}
      {selectedUpdate && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-update-modal-title"
        >
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111318] border border-zinc-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-800 bg-[#09090B]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-red-400">
                    {MEDIA_LABELS[selectedMediaType]}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-slate-400 font-mono tabular-nums">
                    {formatDisplayDate(selectedUpdate.date)} ({selectedUpdate.date})
                  </span>
                </div>
                <h3
                  id="daily-update-modal-title"
                  className="mt-1 text-lg sm:text-xl font-bold text-white leading-snug"
                >
                  {selectedUpdate.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedMediaType === 'pdf' && selectedUpdate.mediaUrl && (
                  <>
                    <a
                      href={selectedUpdate.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open</span>
                    </a>
                    <a
                      href={selectedUpdate.mediaUrl}
                      download={selectedUpdate.fileName || `${selectedUpdate.title}.pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PDF</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Close update viewer"
                  onClick={() => setSelectedUpdate(null)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {selectedMediaType === 'image' && selectedUpdate.mediaUrl && (
              <div className="bg-black flex items-center justify-center max-h-[65vh]">
                <ResilientImage
                  src={selectedUpdate.mediaUrl}
                  alt={selectedUpdate.title}
                  className="max-h-[65vh] w-auto object-contain"
                />
              </div>
            )}

            {selectedMediaType === 'video' && selectedUpdate.mediaUrl && (
              <div className="bg-black flex items-center justify-center">
                {selectedYoutubeUrl ? (
                  <iframe
                    src={selectedYoutubeUrl}
                    title={selectedUpdate.title}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={selectedUpdate.mediaUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[65vh]"
                  />
                )}
              </div>
            )}

            {selectedMediaType === 'pdf' && selectedUpdate.mediaUrl && (
              <div className="bg-[#09090B] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-300 truncate max-w-md">
                    {selectedUpdate.fileName || `${selectedUpdate.title}.pdf`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInlinePdf((prev) => !prev)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    {showInlinePdf ? 'Hide PDF Preview' : 'Show PDF Preview'}
                  </button>
                </div>
                {showInlinePdf && (
                  <iframe
                    src={selectedUpdate.mediaUrl}
                    title={selectedUpdate.fileName || selectedUpdate.title}
                    className="w-full h-[60vh] rounded-xl border border-zinc-800 bg-white"
                  />
                )}
              </div>
            )}

            {selectedUpdate.description && (
              <div className="p-6 bg-[#141720] border-t border-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Update Details
                </div>
                <p className="text-sm sm:text-base text-slate-200 whitespace-pre-line leading-relaxed">
                  {selectedUpdate.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
