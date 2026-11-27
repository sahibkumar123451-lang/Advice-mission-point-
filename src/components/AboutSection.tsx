import { Clock, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { CoachingInfo } from '../types/coaching';

interface AboutSectionProps {
  coaching: CoachingInfo;
}

export function AboutSection({ coaching }: AboutSectionProps) {
  return (
    <section id="about" className="py-16 lg:py-24 bg-[#0D0F14] border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Narrative & Academic Pillars */}
          <div className="lg:col-span-7">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
              About Coaching
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
              {coaching.aboutHeading}
            </h2>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed">
              {coaching.aboutDescription}
            </p>

            <div className="mt-6 p-5 rounded-xl bg-[#141720] border border-zinc-800">
              <p className="text-base font-semibold text-white">
                {coaching.classesRangeText}
              </p>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                Whether a student is building early school fundamentals in primary grades or preparing for board examinations in secondary and senior secondary grades, batches focus on clear daily explanation, regular revision, and individual attention.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  <span className="text-red-400">01.</span> Conceptual Clarity
                </h3>
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  Every chapter is taught from basic principles in simple Hindi and English so no learner falls behind.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  <span className="text-blue-400">02.</span> Regular Assessments
                </h3>
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  Weekly practice sheets, answer-writing feedback, and guided revision keep students exam-ready.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  <span className="text-red-400">03.</span> Continuous Doubt Help
                </h3>
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  Direct classroom mentorship supported by our curated Learning Hub notes and Daily Updates whenever you study at home.
                </p>
              </div>
            </div>
          </div>

          {/* Location & Maps Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-[#141720] border border-zinc-800 p-6 sm:p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white">
                Coaching Location &amp; Timings
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Visit the centre in person or open directions directly on Google Maps.
              </p>

              <dl className="mt-6 space-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-white">Coaching Address</dt>
                    <dd className="mt-0.5 text-slate-300">{coaching.address}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-white">Class &amp; Office Hours</dt>
                    <dd className="mt-0.5 text-slate-300 font-mono tabular-nums text-xs sm:text-sm">
                      {coaching.officeHours}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-white">Phone</dt>
                    <dd className="mt-0.5 text-slate-300 font-mono tabular-nums text-xs sm:text-sm">
                      {coaching.phone}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="font-semibold text-white">Email</dt>
                    <dd className="mt-0.5 text-slate-300 break-all">{coaching.email}</dd>
                  </div>
                </div>
              </dl>

              <div className="mt-7 pt-6 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={coaching.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-11 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center h-11 px-4 text-sm font-semibold text-slate-200 bg-[#09090B] border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  Contact &amp; Socials
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
