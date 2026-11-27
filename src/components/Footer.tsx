import type { CoachingInfo, SocialLinks } from '../types/coaching';

interface FooterProps {
  coaching: CoachingInfo;
  socialLinks: SocialLinks;
  onOpenAdminClick: () => void;
}

export function Footer({
  coaching,
  socialLinks,
  onOpenAdminClick,
}: FooterProps) {
  return (
    <footer className="bg-[#050507] text-slate-300 border-t border-zinc-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-zinc-800">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3.5">
              <img
                src="/assets/aistudio/file_0000000044288211baf6fb7b37cffbd8_c0748120.png"
                alt={`${coaching.name} logo`}
                className="w-11 h-11 rounded-full object-cover border border-red-500/70 bg-white shrink-0"
              />
              <div>
                <div className="text-xl font-bold text-white tracking-tight">
                  {coaching.name}
                </div>
                <p className="mt-0.5 text-sm font-semibold text-red-400">
                  {coaching.tagline}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-sm">
              {coaching.address} · Class 1 to Class 12 academic guidance, Daily Updates, bilingual Learning Hub, and Campus Gallery.
            </p>
          </div>

          <div className="md:col-span-3 space-y-2 text-sm">
            <div className="font-semibold text-white mb-2">Explore</div>
            <div>
              <a href="#about" className="hover:text-blue-400 transition-colors">
                About Coaching
              </a>
            </div>
            <div>
              <a href="#faculty" className="hover:text-blue-400 transition-colors">
                Teacher Profile
              </a>
            </div>
            <div>
              <a href="#daily-updates" className="hover:text-blue-400 transition-colors">
                Daily Updates
              </a>
            </div>
            <div>
              <a href="#learning-hub" className="hover:text-blue-400 transition-colors">
                Advice Mission Learning Hub
              </a>
            </div>
            <div>
              <a href="#gallery" className="hover:text-blue-400 transition-colors">
                Photo &amp; Video Gallery
              </a>
            </div>
            <div>
              <a href="#feedback" className="hover:text-blue-400 transition-colors">
                User Rating &amp; Feedback
              </a>
            </div>
            <div>
              <a href="#contact" className="hover:text-blue-400 transition-colors">
                Contact &amp; Location
              </a>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3 text-sm">
            <div className="font-semibold text-white">Connect &amp; Manage</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                Instagram
              </a>
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                Facebook
              </a>
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                YouTube
              </a>
            </div>
            <div>
              <a
                href={coaching.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Open Campus Location in Google Maps
              </a>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenAdminClick}
                className="inline-flex items-center justify-center h-9 px-4 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/35 hover:bg-red-500/20 hover:text-red-200 rounded-lg transition-colors cursor-pointer"
              >
                Open Admin Panel
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {coaching.name}. All rights reserved.
          </div>
          <div>{coaching.address}</div>
        </div>
      </div>
    </footer>
  );
}
