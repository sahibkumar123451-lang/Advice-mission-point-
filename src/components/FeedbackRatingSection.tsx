import { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Send, ShieldCheck, Star } from 'lucide-react';
import { normalizeFeedbackEmail, validateFeedbackInput } from '../utils/coachingLogic';
import { submitFeedbackToCloud } from '../utils/firebaseClient';

const SUBMITTED_EMAILS_STORAGE_KEY = 'amp_feedback_submitted_emails_v1';

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Urgent Attention (1/5)',
  2: 'Below Expectations (2/5)',
  3: 'Average / Good (3/5)',
  4: 'Very Good (4/5)',
  5: 'Excellent Experience (5/5)',
};

function readLocalSubmittedEmails(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(SUBMITTED_EMAILS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.map((v) => String(v).toLowerCase())) : new Set();
  } catch {
    return new Set();
  }
}

function recordLocalSubmittedEmail(email: string): void {
  try {
    const set = readLocalSubmittedEmails();
    set.add(normalizeFeedbackEmail(email));
    globalThis.localStorage?.setItem(
      SUBMITTED_EMAILS_STORAGE_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function FeedbackRatingSection() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const displayedRating = hoverRating || rating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittedSuccess(false);

    const validation = validateFeedbackInput({
      fullName,
      email,
      rating,
      feedback,
    });
    if (!validation.valid || !validation.normalizedEmail || !validation.rating) {
      setError(validation.error || 'Please fill in all required fields.');
      return;
    }

    const normalizedEmail = validation.normalizedEmail;
    const localSubmitted = readLocalSubmittedEmails();
    if (localSubmitted.has(normalizedEmail)) {
      setError(
        'Feedback and rating have already been submitted with this email address. Duplicate ratings from the same email are not allowed.',
      );
      return;
    }

    setSubmitting(true);
    try {
      let handledByServer = false;

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: normalizedEmail,
            rating: validation.rating,
            feedback: feedback.trim(),
          }),
        });

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (res.status === 409) {
            recordLocalSubmittedEmail(normalizedEmail);
            setError(
              data.error ||
                'Feedback and rating have already been submitted with this email address.',
            );
            return;
          }
          if (!res.ok) {
            setError(data.error || 'Unable to submit your feedback. Please check your entries.');
            return;
          }
          handledByServer = true;
          // Best-effort cloud sync as well so admin sees it across sessions
          void submitFeedbackToCloud({
            fullName: fullName.trim(),
            email: normalizedEmail,
            rating: validation.rating,
            feedback: feedback.trim(),
          });
        }
      } catch {
        // Static deployment or offline server — fall back directly to Firestore
      }

      if (!handledByServer) {
        const cloudResult = await submitFeedbackToCloud({
          fullName: fullName.trim(),
          email: normalizedEmail,
          rating: validation.rating,
          feedback: feedback.trim(),
        });
        if (!cloudResult.ok) {
          if (cloudResult.duplicate) {
            recordLocalSubmittedEmail(normalizedEmail);
          }
          setError(
            cloudResult.error ||
              'Unable to save your feedback right now. Please try again shortly.',
          );
          return;
        }
      }

      recordLocalSubmittedEmail(normalizedEmail);
      setFullName('');
      setEmail('');
      setRating(0);
      setHoverRating(0);
      setFeedback('');
      setSubmittedSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="feedback"
      className="py-16 lg:py-24 bg-[#0D0F14] border-b border-zinc-800/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Explanation & Privacy Assurance */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-sm font-semibold text-blue-400 tracking-wide uppercase">
                Student &amp; Parent Voice
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                Rate &amp; Share Your Feedback
              </h2>
              <p className="mt-3 text-base text-slate-300 leading-relaxed">
                Share your experience, suggestion, complaint, or praise with Advice Mission Point. Honest feedback helps Surendra Sir continuously improve classes, tests, and student support.
              </p>
            </div>

            <div className="rounded-2xl bg-[#141720] border border-zinc-800 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Private &amp; Admin-Only Review
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Your email address and personal feedback remain strictly private. Other visitors can never view your email, rating, or message — only the authorized Coaching Admin can review them.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    One Verified Rating Per Email
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    To keep feedback genuine and prevent duplicate submissions, each email address can submit one verified rating and feedback entry.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-[#141720] border border-zinc-800 p-6 sm:p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white">
                User Rating &amp; Feedback Form
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                All fields including Full Name, Email Address, 1–5 Star Rating, and Feedback are required.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="feedback-name"
                      className="block text-sm font-semibold text-slate-200 mb-1.5"
                    >
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="feedback-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="feedback-email"
                      className="block text-sm font-semibold text-slate-200 mb-1.5"
                    >
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 1 to 5 Star Rating */}
                <div>
                  <span className="block text-sm font-semibold text-slate-200 mb-2">
                    Star Rating (1 to 5 Stars) <span className="text-red-400">*</span>
                  </span>
                  <div
                    role="group"
                    aria-label="Select star rating from 1 to 5"
                    className="flex flex-wrap items-center gap-2"
                  >
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const active = starValue <= displayedRating;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onMouseEnter={() => setHoverRating(starValue)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(starValue)}
                          aria-label={`Rate ${starValue} out of 5 stars`}
                          aria-pressed={rating === starValue}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-red-500/15 border-red-500/60 text-amber-400'
                              : 'bg-[#09090B] border-zinc-700 text-slate-400 hover:border-zinc-600'
                          }`}
                        >
                          <Star
                            className={`w-4 h-4 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-bold tabular-nums">{starValue}</span>
                        </button>
                      );
                    })}

                    <span className="ml-1 text-xs font-medium text-slate-400">
                      {displayedRating > 0 ? RATING_LABELS[displayedRating] : 'Select 1 to 5 stars'}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="feedback-message"
                    className="block text-sm font-semibold text-slate-200 mb-1.5"
                  >
                    Feedback / अपनी बात <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="feedback-message"
                    rows={4}
                    required
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="अपनी परेशानी, शिकायत, सुझाव या अच्छी बात यहाँ लिखें (Write your feedback, complaint, suggestion, or appreciation)..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {submittedSuccess && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 p-3.5 rounded-lg bg-blue-950/50 border border-blue-500/40 text-blue-200 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      धन्यवाद! Your rating and feedback have been securely saved for Admin review.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>{submitting ? 'Submitting Feedback...' : 'Submit Feedback & Rating'}</span>
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
