import { ArrowRight, MapPin } from 'lucide-react';
import type { CoachingInfo } from '../types/coaching';
import { ResilientImage } from './ResilientImage';

interface HeroSectionProps {
  coaching: CoachingInfo;
}

export function HeroSection({ coaching }: HeroSectionProps) {
  const defaultHeroImage = '/src/assets/images/hero_coaching_campus_1795115509590.jpg';
  const resolvedHeroUrl =
    coaching.heroMediaUrl !== undefined ? coaching.heroMediaUrl.trim() : defaultHeroImage;
  const hasHeroMedia = Boolean(resolvedHeroUrl);
  const isHeroVideo = coaching.heroMediaType === 'video' || /\.(mp4|webm|mov|m4v)$/i.test(resolvedHeroUrl);

  return (
    <section
      id="home"
      className="relative border-b border-slate-200/80 bg-[#FAF9F6] pt-10 pb-14 lg:pt-16 lg:pb-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Editorial Column */}
          <div className={`${hasHeroMedia ? 'lg:col-span-6' : 'lg:col-span-10'} flex flex-col justify-center`}>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-amber-800 mb-4">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{coaching.address}</span>
              <span aria-hidden="true">·</span>
              <span>Class 1 to Class 12</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight text-slate-950 leading-[1.08] text-balance">
              {coaching.name}
            </h1>

            <p className="mt-3 text-xl sm:text-2xl font-semibold text-amber-700 tracking-tight">
              {coaching.tagline}
            </p>

            <p className="mt-5 text-base sm:text-lg text-slate-700 leading-relaxed max-w-xl">
              {coaching.welcomeHeadline}
            </p>

            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              {coaching.welcomeSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#learning-hub"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm sm:text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
              >
                <span>Explore Learning Hub</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>

              <a
                href="#contact"
                className="inline-flex items-center gap-1.5 px-5 py-3 text-sm sm:text-base font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Send Enquiry
              </a>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="text-xs font-medium text-slate-500">Classes Covered</div>
                <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
                  Class 1 – 12
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Instruction</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  Hindi &amp; English
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Doubt Support</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  Classroom &amp; Notes
                </div>
              </div>
            </div>
          </div>

          {/* Right Media Column (Replaceable or Removable by Owner in Admin Panel) */}
          {hasHeroMedia && (
            <div className="lg:col-span-6 flex">
              <div className="relative w-full min-h-[300px] sm:min-h-[380px] lg:min-h-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {isHeroVideo ? (
                  <video
                    src={resolvedHeroUrl}
                    controls
                    playsInline
                    muted
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ResilientImage
                    src={resolvedHeroUrl}
                    alt={`${coaching.name} campus and classroom`}
                    className="w-full h-full object-cover lg:h-full"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-6 text-white">
                  <p className="text-xs font-medium text-amber-300">
                    Campus &amp; Classroom Mentorship
                  </p>
                  <p className="mt-1 text-sm sm:text-base font-semibold leading-snug">
                    {coaching.officeHours} · {coaching.address}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
