import { Clock, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { CoachingInfo } from '../types/coaching';

interface AboutSectionProps {
  coaching: CoachingInfo;
}

export function AboutSection({ coaching }: AboutSectionProps) {
  return (
    <section id="about" className="py-16 lg:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Narrative & Academic Pillars */}
          <div className="lg:col-span-7">
            <p className="text-sm font-semibold text-amber-700">
              About Coaching
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance">
              {coaching.aboutHeading}
            </h2>

            <p className="mt-5 text-base sm:text-lg text-slate-700 leading-relaxed">
              {coaching.aboutDescription}
            </p>

            <div className="mt-6 p-5 rounded-xl bg-[#FAF9F6] border border-slate-200">
              <p className="text-base font-semibold text-slate-900">
                {coaching.classesRangeText}
              </p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Whether a student is building early school fundamentals in primary grades or preparing for board examinations in secondary and senior secondary grades, batches focus on clear daily explanation, regular revision, and individual attention.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  01. Conceptual Clarity
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Every chapter is taught from basic principles in simple Hindi and English so no learner falls behind.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  02. Regular Assessments
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Weekly practice sheets, answer-writing feedback, and guided revision keep students exam-ready.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  03. Continuous Doubt Help
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Direct classroom mentorship supported round-the-clock by Advice Mission AI and Learning Hub notes.
                </p>
              </div>
            </div>
          </div>

          {/* Location & Maps Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-[#FAF9F6] border border-slate-200 p-6 sm:p-8">
              <h3 className="text-xl font-bold text-slate-950">
                Coaching Location &amp; Timings
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Visit the centre in person or open directions directly on Google Maps.
              </p>

              <dl className="mt-6 space-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-slate-900">Coaching Address</dt>
                    <dd className="mt-0.5 text-slate-700">{coaching.address}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-slate-900">Class &amp; Office Hours</dt>
                    <dd className="mt-0.5 text-slate-700 font-mono tabular-nums text-xs sm:text-sm">
                      {coaching.officeHours}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-slate-900">Phone</dt>
                    <dd className="mt-0.5 text-slate-700 font-mono tabular-nums text-xs sm:text-sm">
                      {coaching.phone}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-slate-900">Email</dt>
                    <dd className="mt-0.5 text-slate-700 break-all">{coaching.email}</dd>
                  </div>
                </div>
              </dl>

              <div className="mt-7 pt-6 border-t border-slate-200 flex flex-wrap gap-3">
                <a
                  href={coaching.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Send Enquiry
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
