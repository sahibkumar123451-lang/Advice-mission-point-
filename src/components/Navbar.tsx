import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  coachingName: string;
  onOpenAdminClick: () => void;
}

export function Navbar({
  coachingName,
  onOpenAdminClick,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'About', href: '#about' },
    { label: 'Faculty', href: '#faculty' },
    { label: 'Daily Updates', href: '#daily-updates' },
    { label: 'Learning Hub', href: '#learning-hub' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Feedback', href: '#feedback' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#09090B]/95 backdrop-blur-md border-b border-zinc-800/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Brand Logo & Title */}
        <a
          href="#home"
          className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md px-1"
        >
          <img
            src="/assets/aistudio/file_0000000044288211baf6fb7b37cffbd8_c0748120.png"
            alt={`${coachingName} profile logo`}
            className="w-9 h-9 rounded-full object-cover border border-red-500/60 bg-white shrink-0"
          />
          <span className="truncate max-w-[190px] sm:max-w-none">{coachingName}</span>
        </a>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-300"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-white hover:underline underline-offset-4 decoration-blue-500 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Aligned Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAdminClick}
            className="hidden sm:inline-flex items-center justify-center h-10 px-4 text-sm font-semibold text-red-300 bg-[#141720] border border-red-500/40 hover:bg-red-500/15 hover:text-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Admin
          </button>

          <a
            href="#contact"
            className="hidden sm:inline-flex items-center justify-center h-10 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
          >
            Contact Us
          </a>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-800 text-slate-200 hover:bg-zinc-900 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-zinc-800 bg-[#0D0F14] px-4 py-4 space-y-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm sm:text-base font-medium text-slate-200 hover:bg-zinc-800/80 hover:text-white rounded-lg"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 mt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdminClick();
              }}
              className="inline-flex items-center justify-center h-11 px-4 text-sm font-semibold text-red-300 bg-[#141720] border border-red-500/40 hover:bg-red-500/15 rounded-lg cursor-pointer"
            >
              Admin Panel
            </button>
            <a
              href="#contact"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center h-11 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              Contact Us
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
