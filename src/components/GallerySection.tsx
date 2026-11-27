import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, FolderPlus, Image as ImageIcon, Play, X } from 'lucide-react';
import type { GalleryCategory, GalleryItem } from '../types/coaching';
import {
  filterGalleryItems,
  formatDisplayDate,
  getYouTubeEmbedUrl,
  isPdfFileOrUrl,
} from '../utils/coachingLogic';
import { ResilientImage } from './ResilientImage';

interface GallerySectionProps {
  items: GalleryItem[];
  onManageMediaClick?: () => void;
}

const CATEGORY_TABS: Array<{ id: GalleryCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'coaching', label: 'Coaching Photos' },
  { id: 'classroom', label: 'Classroom Photos' },
  { id: 'activities', label: 'Educational Activities' },
  { id: 'events', label: 'Events' },
  { id: 'videos', label: 'Videos' },
  { id: 'pdfs', label: 'Study PDFs & Notices' },
];

const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  coaching: 'Coaching Photos',
  classroom: 'Classroom Photos',
  activities: 'Educational Activities',
  events: 'Events',
  videos: 'Videos',
  pdfs: 'Study PDFs & Notices',
};

export function GallerySection({ items, onManageMediaClick }: GallerySectionProps) {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [showInlinePdf, setShowInlinePdf] = useState(false);

  const visibleItems = useMemo(
    () => filterGalleryItems(items, activeCategory, false),
    [items, activeCategory],
  );

  const youtubeEmbed = selectedItem ? getYouTubeEmbedUrl(selectedItem.mediaUrl) : null;
  const selectedIsPdf =
    selectedItem ? selectedItem.mediaType === 'pdf' || selectedItem.category === 'pdfs' || isPdfFileOrUrl(selectedItem.mediaUrl) : false;

  return (
    <section id="gallery" className="py-16 lg:py-24 bg-[#09090B] border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">
              Campus Life, Media &amp; PDFs
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
              Photo, Video &amp; PDF Gallery
            </h2>
            <p className="mt-2 text-base text-slate-300 leading-relaxed">
              Moments from our coaching campus, classroom lectures, student activities, events, educational videos, and downloadable PDFs.
            </p>
          </div>

          {onManageMediaClick && (
            <button
              type="button"
              onClick={onManageMediaClick}
              className="inline-flex items-center justify-center gap-2 h-[42px] px-4 text-xs sm:text-sm font-semibold text-slate-100 bg-[#111318] border border-zinc-700 hover:border-blue-500/60 hover:bg-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start md:self-auto"
            >
              <FolderPlus className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
              <span>Add / Edit Photos, Videos &amp; PDFs</span>
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`inline-flex items-center justify-center h-9 px-4 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-blue-600 text-white border border-blue-500'
                  : 'bg-[#111318] text-slate-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#111318] p-10 text-center">
            <ImageIcon className="w-8 h-8 text-blue-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-base font-semibold text-white">
              No media items published in this category yet.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Administrators can upload and publish photos, videos, or PDFs directly from the Admin Panel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleItems.map((item) => {
              const isPdf = item.mediaType === 'pdf' || item.category === 'pdfs' || isPdfFileOrUrl(item.mediaUrl);
              const isVideo = !isPdf && (item.mediaType === 'video' || item.category === 'videos');
              const previewSrc = isVideo
                ? item.thumbnailUrl || '/src/assets/images/gallery_classroom_lecture_1795115510111.jpg'
                : item.mediaUrl;

              return (
                <article
                  key={item.id}
                  className="group rounded-2xl border border-zinc-800 bg-[#111318] hover:border-blue-500/50 transition-colors overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlinePdf(false);
                      setSelectedItem(item);
                    }}
                    aria-label={`View ${item.title}`}
                    className="relative aspect-[4/3] w-full overflow-hidden bg-[#09090B] text-left cursor-pointer border-b border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {isPdf ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#0B1120] via-[#111318] to-[#1A1318] text-white p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mb-3">
                          <FileText className="w-7 h-7" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
                          PDF Document
                        </span>
                        <span className="mt-1 text-sm font-semibold text-white line-clamp-2 max-w-[220px]">
                          {item.title}
                        </span>
                      </div>
                    ) : isVideo && !item.thumbnailUrl && !getYouTubeEmbedUrl(item.mediaUrl) && item.mediaUrl.startsWith('/uploads/') ? (
                      <video
                        src={item.mediaUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <ResilientImage
                        src={previewSrc}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    )}

                    {isVideo && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 ml-0.5 fill-current" aria-hidden="true" />
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="text-blue-400 font-semibold">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">·</span>
                        <span className="tabular-nums">{formatDisplayDate(item.createdAt)}</span>
                      </div>
                      <h3 className="mt-1.5 text-lg font-bold text-white leading-snug">
                        {item.title}
                      </h3>
                      {item.caption && (
                        <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                          {item.caption}
                        </p>
                      )}
                    </div>

                    {isPdf && (
                      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowInlinePdf(false);
                            setSelectedItem(item);
                          }}
                          className="inline-flex items-center justify-center h-9 px-3.5 text-xs font-semibold text-blue-300 bg-blue-600/15 border border-blue-500/35 hover:bg-blue-600/25 rounded-lg transition-colors cursor-pointer"
                        >
                          View PDF
                        </button>
                        <a
                          href={item.mediaUrl}
                          download={`${item.title}.pdf`}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-200 bg-[#09090B] border border-zinc-700 hover:border-blue-500/60 hover:text-white rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-red-400 shrink-0" aria-hidden="true" />
                          <span>Download</span>
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox / Video / PDF Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-modal-title"
        >
          <div className="w-full max-w-4xl rounded-2xl bg-[#111318] border border-zinc-800 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800 bg-[#09090B]">
              <div>
                <div className="text-xs font-semibold text-blue-400">
                  {CATEGORY_LABELS[selectedItem.category]}
                </div>
                <h3 id="gallery-modal-title" className="text-lg font-bold text-white">
                  {selectedItem.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedIsPdf && (
                  <>
                    <a
                      href={selectedItem.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open</span>
                    </a>
                    <a
                      href={selectedItem.mediaUrl}
                      download={`${selectedItem.title}.pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PDF</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Close media viewer"
                  onClick={() => {
                    setSelectedItem(null);
                    setShowInlinePdf(false);
                  }}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-700 text-slate-300 hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`${selectedIsPdf ? 'bg-[#09090B]' : 'bg-black'} flex items-center justify-center max-h-[70vh]`}>
              {selectedIsPdf ? (
                showInlinePdf ? (
                  <iframe
                    src={selectedItem.mediaUrl}
                    title={selectedItem.title}
                    className="w-full h-[65vh] bg-white"
                  />
                ) : (
                  <div className="w-full py-12 px-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">{selectedItem.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        PDF Study Material &amp; Notice — Open in a new tab, preview inline, or download to your device.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <a
                        href={selectedItem.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        <span>Open PDF</span>
                      </a>
                      <a
                        href={selectedItem.mediaUrl}
                        download={`${selectedItem.title}.pdf`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span>Download PDF</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowInlinePdf(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-300 bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 rounded-lg cursor-pointer"
                      >
                        <span>Preview Inline</span>
                      </button>
                    </div>
                  </div>
                )
              ) : selectedItem.mediaType === 'video' || selectedItem.category === 'videos' ? (
                youtubeEmbed ? (
                  <iframe
                    src={youtubeEmbed}
                    title={selectedItem.title}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={selectedItem.mediaUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[65vh]"
                  />
                )
              ) : (
                <ResilientImage
                  src={selectedItem.mediaUrl}
                  alt={selectedItem.title}
                  className="max-h-[65vh] w-auto object-contain"
                />
              )}
            </div>

            {selectedItem.caption && (
              <div className="px-6 py-4 bg-[#141720] border-t border-zinc-800 text-sm text-slate-300">
                {selectedItem.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
