import {
  Clock,
  ExternalLink,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Youtube,
} from 'lucide-react';
import type { CoachingInfo, SocialLinks } from '../types/coaching';

interface ContactSectionProps {
  coaching: CoachingInfo;
  socialLinks: SocialLinks;
}

export function ContactSection({ coaching, socialLinks }: ContactSectionProps) {
  const socials = [
    {
      name: 'WhatsApp',
      subtitle: 'Quick Doubts & Updates',
      href: socialLinks.whatsapp,
      icon: MessageCircle,
    },
    {
      name: 'Instagram',
      subtitle: 'Campus Highlights & Updates',
      href: socialLinks.instagram,
      icon: Instagram,
    },
    {
      name: 'Facebook',
      subtitle: 'Community Notices & Events',
      href: socialLinks.facebook,
      icon: Facebook,
    },
    {
      name: 'YouTube',
      subtitle: 'Video Lectures & Study Tips',
      href: socialLinks.youtube,
      icon: Youtube,
    },
  ];

  return (
    <section id="contact" className="py-16 lg:py-24 bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">
            Connect With Us
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
            Social Media &amp; Contact Information
          </h2>
          <p className="mt-3 text-base text-slate-300 leading-relaxed">
            Reach Advice Coaching Classes in {coaching.address}, or connect directly through our official social channels.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Direct Address, Contact & Maps */}
          <div className="lg:col-span-6">
            <div className="h-full rounded-2xl bg-[#111318] border border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-white">Coaching Location</div>
                    <div className="text-sm text-slate-300 mt-0.5">{coaching.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-white">Phone Number</div>
                    <div className="text-sm text-slate-300 mt-0.5 font-mono tabular-nums">
                      {coaching.phone}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-white">Email Address</div>
                    <div className="text-sm text-slate-300 mt-0.5 break-all">{coaching.email}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-white">Class &amp; Office Timings</div>
                    <div className="text-sm text-slate-300 mt-0.5 font-mono tabular-nums">
                      {coaching.officeHours}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-zinc-800">
                <a
                  href={coaching.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>View Coaching Location on Google Maps</span>
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Official Social Media Channels */}
          <div className="lg:col-span-6">
            <div className="h-full rounded-2xl bg-[#111318] border border-zinc-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-white">Official Social Channels</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Follow Advice Coaching Classes for announcements, video classes, and student updates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 content-start">
                {socials.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#09090B] border border-zinc-800 hover:border-blue-500/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#111318] border border-zinc-700 text-blue-400 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white">
                            {social.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {social.subtitle}
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
