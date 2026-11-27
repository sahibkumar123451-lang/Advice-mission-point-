import { ArrowRight, MapPin } from 'lucide-react';
import type { CoachingInfo } from '../types/coaching';
import { resolveHeroCaptionDisplay } from '../utils/coachingLogic';
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
  const heroCaption = resolveHeroCaptionDisplay(coaching);

  return (
    <section
      id="home"
      className="relative border-b border-zinc-800/80 bg-[#09090B] pt-10 pb-14 lg:pt-16 lg:pb-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Editorial Column */}
          <div className={`${hasHeroMedia ? 'lg:col-span-6' : 'lg:col-span-10'} flex flex-col justify-center`}>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-blue-400 mb-4">
              <MapPin className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
              <span>{coaching.address}</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span className="text-slate-300">Class 1 to Class 12</span>
            </div>

            <div className="flex items-center gap-4">
              <img
                src="/assets/aistudio/file_0000000044288211baf6fb7b37cffbd8_c0748120.png"
                alt={`${coaching.name} official coaching profile emblem`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-red-500/70 bg-white shadow-md shrink-0"
              />
              <div>
                <h1 className="text-3xl sm:text-5xl lg:text-[3.2rem] font-extrabold tracking-tight text-white leading-[1.08] text-balance">
                  {coaching.name}
                </h1>
                <p className="mt-1.5 text-lg sm:text-2xl font-semibold text-red-400 tracking-tight">
                  {coaching.tagline}
                </p>
              </div>
            </div>

            <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              {coaching.welcomeHeadline}
            </p>

            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              {coaching.welcomeSubtitle}
            </p>

            <div className="mt-8 grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-3">
              <a
                href="#daily-updates"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm sm:text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
              >
                <span>Daily Updates</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>

              <a
                href="#learning-hub"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm sm:text-base font-semibold text-slate-100 bg-[#141720] border border-zinc-700 hover:border-red-500/60 hover:bg-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Explore Learning Hub
              </a>

              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm sm:text-base font-semibold text-slate-200 bg-[#111318] border border-zinc-800 hover:border-zinc-600 hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Contact Us
              </a>
            </div>

            <div className="mt-10 pt-6 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="text-xs font-medium text-slate-400">Classes Covered</div>
                <div className="mt-1 text-base font-bold text-white tabular-nums">
                  Class 1 – 12
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">Instruction</div>
                <div className="mt-1 text-base font-bold text-white">
                  Hindi &amp; English
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">Doubt Support</div>
                <div className="mt-1 text-base font-bold text-blue-400">
                  Classroom &amp; Notes
                </div>
              </div>
            </div>
          </div>

          {/* Right Media Column */}
          {hasHeroMedia && (
            <div className="lg:col-span-6 flex">
              <div className="relative w-full min-h-[300px] sm:min-h-[380px] lg:min-h-full rounded-2xl overflow-hidden border border-zinc-800 bg-[#111318] shadow-2xl">
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
                {heroCaption.visible && (
                  <div
                    data-testid="hero-photo-caption"
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-6 text-white"
                  >
                    {heroCaption.title && (
                      <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                        {heroCaption.title}
                      </p>
                    )}
                    {heroCaption.text && (
                      <p
                        className={`${
                          heroCaption.title ? 'mt-1 ' : ''
                        }text-sm sm:text-base font-semibold text-slate-100 leading-snug`}
                      >
                        {heroCaption.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
