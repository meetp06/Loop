import { ArrowRight } from 'lucide-react';
import { FONT, MONO } from '../constants';
import useReveal from '../hooks/useReveal';

/**
 * CTA — final call-to-action with gradient border card.
 */
export default function CTA() {
  const ref = useReveal();

  return (
    <section
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-5xl mx-auto"
      style={{ paddingTop: 60, paddingBottom: 80 }}
    >
      <div
        className="reveal rounded-3xl px-8 py-14 text-center"
        style={{
          background:
            'linear-gradient(160deg, rgba(124,255,178,0.08), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h2
          className="text-white"
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.8rem,4vw,3rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
          }}
        >
          Stop starting from scratch.
        </h2>
        <p
          className="text-white/55"
          style={{
            fontFamily: MONO,
            fontSize: 14,
            marginTop: 18,
            maxWidth: 440,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
          }}
        >
          A brief before. A memory after. Right where you already work.
        </p>
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{ marginTop: 32 }}
        >
          <button
            className="flex items-center gap-2 px-7 py-3.5 rounded-full text-black text-sm font-medium hover:opacity-80 transition group"
            style={{ fontFamily: FONT, backgroundColor: '#fff' }}
          >
            Join the waitlist{' '}
            <ArrowRight
              size={15}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </button>
          <a
            href="#demo"
            className="px-7 py-3.5 rounded-full text-white/80 hover:text-white text-sm transition"
            style={{ fontFamily: FONT, border: '1px solid rgba(255,255,255,0.16)' }}
          >
            Replay the demo
          </a>
        </div>
      </div>
    </section>
  );
}
