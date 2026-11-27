import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Youtube,
} from 'lucide-react';
import type { CoachingInfo, SocialLinks } from '../types/coaching';
import { validateEnquiryInput } from '../utils/coachingLogic';

interface ContactSectionProps {
  coaching: CoachingInfo;
  socialLinks: SocialLinks;
}

export function ContactSection({ coaching, socialLinks }: ContactSectionProps) {
  const [studentName, setStudentName] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const socials = [
    {
      name: 'WhatsApp',
      subtitle: 'Quick Doubt & Admission Chat',
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

  async function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitted(false);

    const validation = validateEnquiryInput({ studentName, phoneOrEmail, message });
    if (!validation.valid) {
      setError(validation.error || 'Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, phoneOrEmail, message }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Unable to submit enquiry. Please try again.');
        return;
      }
      setStudentName('');
      setPhoneOrEmail('');
      setMessage('');
      setSubmitted(true);
    } catch {
      setError('Network error while sending enquiry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="py-16 lg:py-24 bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Social Media & Coaching Address */}
          <div className="lg:col-span-6">
            <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">
              Connect With Us
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
              Social Media &amp; Contact Information
            </h2>
            <p className="mt-3 text-base text-slate-300 leading-relaxed">
              Reach Advice Coaching Classes in {coaching.address}, or connect through our official social channels.
            </p>

            {/* Social Links Grid */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#111318] border border-zinc-800 hover:border-blue-500/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#09090B] border border-zinc-700 text-blue-400 flex items-center justify-center shrink-0">
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

            {/* Direct Address & Maps */}
            <div className="mt-7 rounded-2xl bg-[#111318] border border-zinc-800 p-6 space-y-4">
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
                  <div className="text-sm font-bold text-white">Phone &amp; Email</div>
                  <div className="text-sm text-slate-300 mt-0.5 font-mono tabular-nums">
                    {coaching.phone}
                  </div>
                  <div className="text-sm text-slate-400">{coaching.email}</div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={coaching.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 hover:underline underline-offset-4"
                >
                  <span>View Coaching Location on Google Maps</span>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Enquiry Form */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-[#111318] border border-zinc-800 p-6 sm:p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white">
                Admission &amp; General Enquiry
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Parents and students can send an enquiry for Class 1 to Class 12 batches or timings.
              </p>

              <form onSubmit={handleEnquirySubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="enquiry-name"
                    className="block text-sm font-semibold text-slate-200 mb-1.5"
                  >
                    Student or Parent Name
                  </label>
                  <input
                    id="enquiry-name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="enquiry-contact"
                    className="block text-sm font-semibold text-slate-200 mb-1.5"
                  >
                    Mobile Number or Email
                  </label>
                  <input
                    id="enquiry-contact"
                    type="text"
                    value={phoneOrEmail}
                    onChange={(e) => setPhoneOrEmail(e.target.value)}
                    placeholder="e.g. +91 98000 00000"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="enquiry-message"
                    className="block text-sm font-semibold text-slate-200 mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="enquiry-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask about batch timings, admission, or coaching guidance..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-400 font-medium">
                    {error}
                  </p>
                )}

                {submitted && (
                  <div
                    role="status"
                    className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/50 border border-blue-500/40 text-blue-200 text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                    <span>Enquiry submitted. Advice Coaching Classes will respond shortly.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{submitting ? 'Sending...' : 'Submit Enquiry'}</span>
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
