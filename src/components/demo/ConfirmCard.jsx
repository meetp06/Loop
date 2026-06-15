import { Check, ArrowRight } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../../constants';

/**
 * ConfirmCard — update confirmation with diff summary.
 */
export default function ConfirmCard({ diffs, text }) {
  // Fallback to default mock diffs if neither diffs nor text is supplied (for standard demo backward compatibility)
  const activeDiffs = diffs || (text ? null : [
    { l: 'Timeline',        a: 'Q2 pilot',    b: 'Q3' },
    { l: 'Budget',           a: '$180K',       b: '$144K ARR' },
    { l: 'Decision maker',   a: 'Sarah Chen',  b: 'Mark Liu' },
  ]);

  return (
    <div
      className="msg-in"
      style={{
        fontFamily: FONT,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(124,255,178,0.25)',
        background: 'rgba(124,255,178,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 text-white"
        style={{
          borderBottom: '1px solid rgba(124,255,178,0.15)',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <Check size={15} color={ACCENT} /> Acme team memory updated
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-2" style={{ fontSize: 13 }}>
        {activeDiffs ? (
          activeDiffs.map((d) => (
            <div
              key={d.l}
              className="flex items-center gap-2"
              style={{ fontFamily: MONO, fontSize: 12 }}
            >
              <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: 110 }}>{d.l}</span>
              {d.a && (
                <span style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'line-through' }}>
                  {d.a}
                </span>
              )}
              {d.a && <ArrowRight size={12} color="rgba(255,255,255,0.4)" />}
              <span style={{ color: ACCENT }}>{d.b}</span>
            </div>
          ))
        ) : (
          <p className="text-white/80" style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.5 }}>
            {text}
          </p>
        )}
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            marginTop: 4,
          }}
        >
          all reps will see this in their next brief →
        </span>
      </div>
    </div>
  );
}
