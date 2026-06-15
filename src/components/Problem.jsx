import { FONT, MONO, ACCENT } from '../constants';
import useReveal from '../hooks/useReveal';
import Eyebrow from './atoms/Eyebrow';

/**
 * Problem — "the problem" section with four pain-point rows.
 */
export default function Problem() {
  const ref = useReveal();

  const rows = [
    { k: 'Before', v: 'Knowledge is scattered across old emails, Slack threads, and someone\u2019s memory.' },
    { k: 'During', v: 'You reconstruct context on the fly — and miss the open commitment from last time.' },
    { k: 'After',  v: 'Nothing gets written down properly. The CRM stays empty.' },
    { k: 'Next time', v: 'You start from scratch. Again.' },
  ];

  return (
    <section
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-5xl mx-auto"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
      <div className="reveal">
        <Eyebrow>The problem</Eyebrow>
      </div>

      <h2
        className="reveal text-white"
        style={{
          fontFamily: FONT,
          fontSize: 'clamp(1.5rem,3.4vw,2.4rem)',
          lineHeight: 1.18,
          letterSpacing: '-0.02em',
          marginTop: 18,
          maxWidth: 640,
        }}
      >
        It isn&rsquo;t a tool problem. Every team has a CRM, a notes app, a wiki.
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {' '}
          Nobody has time to update them — and nobody can find anything when they
          need it.
        </span>
      </h2>

      <div
        className="reveal"
        style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-8 py-5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span
              style={{
                fontFamily: MONO,
                color: ACCENT,
                fontSize: 12,
                minWidth: 92,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {r.k}
            </span>
            <span
              className="text-white/70"
              style={{ fontFamily: FONT, fontSize: 'clamp(.95rem,2vw,1.15rem)' }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
