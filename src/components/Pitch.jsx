import { Quote } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../constants';
import useReveal from '../hooks/useReveal';

/**
 * Pitch — pull quote section.
 */
export default function Pitch() {
  const ref = useReveal();

  return (
    <section
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-4xl mx-auto text-center"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
      <div className="reveal">
        <Quote size={28} color={ACCENT} style={{ margin: '0 auto', opacity: 0.6 }} />
      </div>
      <p
        className="reveal text-white"
        style={{
          fontFamily: FONT,
          fontSize: 'clamp(1.3rem,3vw,2rem)',
          lineHeight: 1.35,
          letterSpacing: '-0.02em',
          marginTop: 24,
        }}
      >
        &ldquo;Wait — it actually{' '}
        <span style={{ color: ACCENT }}>remembered</span> and updated.&rdquo;
      </p>
      <p
        className="reveal text-white/45"
        style={{ fontFamily: MONO, fontSize: 13, marginTop: 18 }}
      >
        the room, at 0:50
      </p>
    </section>
  );
}
