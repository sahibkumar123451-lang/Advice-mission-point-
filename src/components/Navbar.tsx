import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  coachingName: string;
  onAskDoubtClick: () => void;
  onOpenAdminClick: () => void;
}

export function Navbar({
  coachingName,
  onAskDoubtClick,
  onOpenAdminClick,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'About', href: '#about' },
    { label: 'Faculty', href: '#faculty' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Learning Hub', href: '#learning-hub' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#home"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-md px-1"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="32" height="32" rx="8" fill="#0F172A" />
            <path
              d="M8 22L16 8L24 22H20.4L16 14.2L11.6 22H8Z"
              fill="#F59E0B"
            />
            <circle cx="16" cy="21" r="2.2" fill="#FFFFFF" />
          </svg>
          <span>{coachingName}</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-slate-950 hover:underline underline-offset-4 decoration-amber-600 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={onOpenAdminClick}
            className="hover:text-slate-950 hover:underline underline-offset-4 decoration-amber-600 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            Admin
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onAskDoubtClick}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          >
            Ask Doubt
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-[#FAF9F6] px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenAdminClick();
            }}
            className="w-full text-left px-3 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Admin Panel
          </button>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onAskDoubtClick();
              }}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Ask Doubt — Advice Mission AI
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
