import { ArrowRight } from 'lucide-react';
import { FONT, NAV_ITEMS } from '../../constants';

/**
 * MobileMenu — slide-down overlay with staggered link animations.
 */
export default function MobileMenu({ open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 lg:hidden"
        onClick={onClose}
        style={{
          transition: 'all .5s',
          backdropFilter: open ? 'blur(12px)' : 'blur(0)',
          backgroundColor: open ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 left-0 right-0 z-40 lg:hidden overflow-hidden"
        style={{
          maxHeight: open ? '440px' : '0px',
          transition: 'max-height .5s cubic-bezier(.23,1,.32,1)',
        }}
      >
        <div
          className="pt-20 pb-6 px-5"
          style={{
            backgroundColor: 'rgba(8,8,8,0.97)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item, i) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
                onClick={onClose}
                className="text-white/70 hover:text-white text-base py-3 px-3 rounded-xl hover:bg-white/5 flex items-center justify-between group"
                style={{
                  fontFamily: FONT,
                  opacity: open ? 1 : 0,
                  transform: open ? 'none' : 'translateY(-8px)',
                  transition: `opacity .4s cubic-bezier(.23,1,.32,1) ${i * 50 + 80}ms, transform .4s cubic-bezier(.23,1,.32,1) ${i * 50 + 80}ms, color .2s, background .2s`,
                }}
              >
                {item}
                <ArrowRight
                  size={14}
                  className="opacity-0 group-hover:opacity-40 transition-all"
                />
              </a>
            ))}
          </div>

          <div
            className="mt-5 pt-5"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              opacity: open ? 1 : 0,
              transform: open ? 'none' : 'translateY(-8px)',
              transition:
                'opacity .4s cubic-bezier(.23,1,.32,1) 360ms, transform .4s cubic-bezier(.23,1,.32,1) 360ms',
            }}
          >
            <button
              className="w-full py-3 rounded-full text-black text-sm font-medium hover:opacity-80 transition"
              style={{ fontFamily: FONT, backgroundColor: '#fff' }}
            >
              Join the waitlist
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
