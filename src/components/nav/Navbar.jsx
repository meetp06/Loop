import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { FONT, ACCENT, NAV_ITEMS } from '../../constants';
import HamburgerButton from './HamburgerButton';
import MobileMenu from './MobileMenu';

/**
 * Navbar — fixed, glass-blur on scroll, pill-style desktop links.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 lg:px-10 lg:py-5"
        style={{
          transition: 'all .4s',
          backgroundColor: scrolled ? 'rgba(6,6,6,0.7)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid transparent',
        }}
      >
        {/* Logo */}
        <a
          href="#top"
          className="flex items-center gap-2 text-white text-xl font-semibold tracking-tight"
          style={{ fontFamily: FONT }}
        >
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md"
            style={{ border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <RefreshCw size={13} color={ACCENT} strokeWidth={2} />
          </span>
          loop
        </a>

        {/* Desktop nav pills */}
        <div
          className="hidden lg:flex items-center gap-1 rounded-full px-2 py-1.5"
          style={{
            backgroundColor: '#0C0C0C',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
              className="text-white/70 hover:text-white text-sm px-4 py-1.5 rounded-full hover:bg-white/10 transition-all duration-200"
              style={{ fontFamily: FONT }}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <HamburgerButton open={open} onClick={() => setOpen((v) => !v)} />
          <button
            className="hidden lg:flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded-full text-black hover:opacity-80 transition-all duration-300"
            style={{ fontFamily: FONT, backgroundColor: '#fff' }}
          >
            Join the waitlist
          </button>
        </div>
      </nav>

      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
