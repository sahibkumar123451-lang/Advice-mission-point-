import { useMemo, useState } from 'react';
import { ArrowUpRight, BookMarked, Download, ExternalLink, FileText, FolderPlus, Search, X } from 'lucide-react';
import type { LearningResource } from '../types/coaching';
import { filterLearningResources, formatDisplayDate } from '../utils/coachingLogic';

interface LearningHubSectionProps {
  resources: LearningResource[];
  onAskAIAboutTopic: (topicTitle: string) => void;
  onManageHubClick?: () => void;
}

export function LearningHubSection({
  resources,
  onAskAIAboutTopic,
  onManageHubClick,
}: LearningHubSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [activeResource, setActiveResource] = useState<LearningResource | null>(null);
  const [showInlinePdf, setShowInlinePdf] = useState(false);

  const topicAreas = useMemo(() => {
    const unique = Array.from(new Set(resources.map((r) => r.topicArea)));
    return ['all', ...unique];
  }, [resources]);

  const filtered = useMemo(
    () => filterLearningResources(resources, searchQuery, selectedTopic, false),
    [resources, searchQuery, selectedTopic],
  );

  return (
    <section
      id="learning-hub"
      className="py-16 lg:py-24 bg-[#FAF9F6] border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-amber-700">
              Study Notes &amp; Concept Sheets
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance">
              Advice Mission Learning Hub
            </h2>
            <p className="mt-2 text-base text-slate-600 leading-relaxed">
              Curated bilingual study summaries, core formulas, and quick revision guides prepared for clear understanding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-80">
            <div className="w-full">
              <label htmlFor="hub-search" className="sr-only">
                Search Learning Hub notes
              </label>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="hub-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes or formulas..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
            </div>

            {onManageHubClick && (
              <button
                type="button"
                onClick={onManageHubClick}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                <span>Add / Edit Notes &amp; PDFs</span>
              </button>
            )}
          </div>
        </div>

        {/* Topic Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {topicAreas.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                selectedTopic === topic
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {topic === 'all' ? 'All Topics' : topic}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <BookMarked className="w-8 h-8 text-slate-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-900">
              No study guides match your search.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Clear the search filter or contact the coaching centre directly for help on this topic.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200 p-6 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="text-amber-700 font-semibold">{item.topicArea}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.languageNote}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDisplayDate(item.updatedAt)}</span>
                  </div>

                  <h3 className="mt-2.5 text-xl font-bold text-slate-950 leading-snug">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>

                  {item.keyFormulas.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs font-medium text-slate-500 mb-1.5">
                        Key Formulas / Patterns
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-800">
                        {item.keyFormulas.map((formula, idx) => (
                          <span key={idx}>{formula}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.pdfUrl && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <FileText className="w-4 h-4 text-amber-700" aria-hidden="true" />
                        <span>{item.pdfName || 'Study PDF Included'}</span>
                      </span>
                      <a
                        href={item.pdfUrl}
                        download={item.pdfName || `${item.title}.pdf`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline underline-offset-4"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlinePdf(false);
                      setActiveResource(item);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    <span>{item.pdfUrl ? 'Read Guide & PDF' : 'Read Study Guide'}</span>
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onAskAIAboutTopic(item.title)}
                    className="text-xs font-semibold text-amber-800 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Ask Mission AI
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Resource Reader Modal */}
      {activeResource && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-modal-title"
        >
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="text-amber-700 font-semibold">{activeResource.topicArea}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeResource.languageNote}</span>
                </div>
                <h3
                  id="hub-modal-title"
                  className="mt-1.5 text-2xl font-bold text-slate-950 leading-snug"
                >
                  {activeResource.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close study guide"
                onClick={() => setActiveResource(null)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm sm:text-base text-slate-800 whitespace-pre-line leading-relaxed">
              {activeResource.content}
            </div>

            {activeResource.keyFormulas.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-slate-500 mb-2">
                  Key Formulas &amp; Takeaways
                </h4>
                <ul className="space-y-1.5 font-mono text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  {activeResource.keyFormulas.map((formula, idx) => (
                    <li key={idx}>{formula}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeResource.pdfUrl && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileText className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[240px] sm:max-w-sm">
                      {activeResource.pdfName || `${activeResource.title}.pdf`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInlinePdf((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg cursor-pointer"
                    >
                      <span>{showInlinePdf ? 'Hide Preview' : 'Preview Inline'}</span>
                    </button>
                    <a
                      href={activeResource.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open</span>
                    </a>
                    <a
                      href={activeResource.pdfUrl}
                      download={activeResource.pdfName || `${activeResource.title}.pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PDF</span>
                    </a>
                  </div>
                </div>
                {showInlinePdf && (
                  <iframe
                    src={activeResource.pdfUrl}
                    title={activeResource.pdfName || activeResource.title}
                    className="w-full h-[380px] rounded-xl border border-slate-200 bg-white"
                  />
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const title = activeResource.title;
                  setActiveResource(null);
                  onAskAIAboutTopic(title);
                }}
                className="px-4 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer"
              >
                Ask Mission AI About This Topic
              </button>
              <button
                type="button"
                onClick={() => setActiveResource(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
