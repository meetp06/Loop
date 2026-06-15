import { Menu, X } from 'lucide-react';

/**
 * HamburgerButton — animated crossfade between Menu ↔ X icons.
 */
export default function HamburgerButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Toggle menu"
      className="lg:hidden relative w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300"
      style={{ backgroundColor: open ? '#1a1a1a' : 'transparent' }}
    >
      <span
        className="absolute"
        style={{
          transition: 'all .3s cubic-bezier(.23,1,.32,1)',
          opacity: open ? 0 : 1,
          transform: open ? 'rotate(-90deg) scale(.5)' : 'none',
        }}
      >
        <Menu size={20} color="white" strokeWidth={1.5} />
      </span>
      <span
        className="absolute"
        style={{
          transition: 'all .3s cubic-bezier(.23,1,.32,1)',
          opacity: open ? 1 : 0,
          transform: open ? 'none' : 'rotate(90deg) scale(.5)',
        }}
      >
        <X size={20} color="white" strokeWidth={1.5} />
      </span>
    </button>
  );
}
