import { useMemo, useState } from 'react';
import { Calendar, Mail, RefreshCw, Search, Star, Trash2, User } from 'lucide-react';
import type { FeedbackRatingItem } from '../../types/coaching';
import {
  computeFeedbackStats,
  filterAdminFeedbacks,
  formatDisplayDateTime,
} from '../../utils/coachingLogic';

interface AdminFeedbackTabProps {
  feedbacks: FeedbackRatingItem[];
  onDeleteFeedback: (id: string) => Promise<void>;
  onRefreshFeedbacks: () => Promise<void>;
  refreshing?: boolean;
}

export function AdminFeedbackTab({
  feedbacks,
  onDeleteFeedback,
  onRefreshFeedbacks,
  refreshing = false,
}: AdminFeedbackTabProps) {
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => computeFeedbackStats(feedbacks), [feedbacks]);
  const filtered = useMemo(
    () => filterAdminFeedbacks(feedbacks, starFilter, searchQuery),
    [feedbacks, starFilter, searchQuery],
  );

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">
            User Feedback &amp; Ratings
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Private feedback, complaints, suggestions, and star ratings visible strictly to Coaching Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="px-3.5 py-2 rounded-lg bg-[#141720] border border-zinc-800 text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Total Reviews
            </div>
            <div className="text-base font-bold text-white tabular-nums">
              {stats.total}
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-[#141720] border border-zinc-800 text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Avg. Rating
            </div>
            <div className="inline-flex items-center gap-1 text-base font-bold text-amber-400 tabular-nums">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span>{stats.total > 0 ? `${stats.average} / 5` : '—'}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void onRefreshFeedbacks()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search & Star Rating Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 5, 4, 3, 2, 1] as const).map((starVal) => (
            <button
              key={String(starVal)}
              type="button"
              onClick={() => setStarFilter(starVal)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                starFilter === starVal
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0D0F14] text-slate-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {starVal === 'all' ? 'All Ratings' : `${starVal} ★`}
            </button>
          ))}
        </div>

        <div className="relative md:w-72">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            id="admin-fb-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, or feedback..."
            aria-label="Search user feedback and ratings"
            className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Feedback List */}
      {filtered.length === 0 ? (
        <div className="p-8 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
          {feedbacks.length === 0
            ? 'No user feedback or star ratings submitted yet.'
            : 'No feedback entries match your selected star rating or search query.'}
        </div>
      ) : (
        <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
          {filtered.map((fb) => (
            <div
              key={fb.id}
              className="p-4 sm:p-5 bg-[#111318] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                    <User className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                    <span>{fb.fullName}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 break-all">
                    <Mail className="w-3.5 h-3.5 text-red-400 shrink-0" aria-hidden="true" />
                    <span>{fb.email}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex items-center gap-1"
                    aria-label={`${fb.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= fb.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-700'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                    <span className="ml-1.5 text-xs font-bold text-amber-400 tabular-nums">
                      {fb.rating} / 5
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-mono tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>{formatDisplayDateTime(fb.createdAt)}</span>
                  </span>
                </div>

                <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed pt-1">
                  {fb.feedback}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void onDeleteFeedback(fb.id)}
                aria-label={`Delete feedback from ${fb.fullName}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer shrink-0 self-start"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
