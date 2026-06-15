import { Workflow, Check } from 'lucide-react';
import { FONT, MONO, ACCENT, PURPLE } from '../../constants';
import { BRIEF_PIPE, UPDATE_PIPE } from './demoData';

/**
 * Pipeline — RocketRide pipeline visualizer with active/done node states.
 */
export default function Pipeline({ name, states }) {
  const nodes = name === 'update' ? UPDATE_PIPE : BRIEF_PIPE;
  const title =
    name === 'update'
      ? 'RocketRide · update pipeline'
      : 'RocketRide · brief pipeline';

  return (
    <div
      className="rounded-2xl p-5 h-full flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2">
        <Workflow size={15} color="rgba(255,255,255,0.5)" />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {title}
        </span>
      </div>

      <div className="flex flex-col gap-2 flex-1" style={{ marginTop: 16 }}>
        {nodes.map((n, i) => {
          const st = states[n.id] || 'idle';
          const active = st === 'active';
          const done = st === 'done';

          return (
            <div
              key={n.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{
                transition: 'all .3s',
                background: active
                  ? 'rgba(124,255,178,0.07)'
                  : done
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(255,255,255,0.012)',
                border: `1px solid ${
                  active
                    ? 'rgba(124,255,178,0.35)'
                    : done
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.05)'
                }`,
                animation: active ? 'pulseNode 1.4s infinite' : 'none',
                opacity: st === 'idle' ? 0.45 : 1,
              }}
            >
              {/* Step number */}
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  fontFamily: MONO,
                  fontSize: 10,
                  flexShrink: 0,
                  color: active || done ? '#000' : 'rgba(255,255,255,0.5)',
                  background: active || done ? ACCENT : 'rgba(255,255,255,0.06)',
                }}
              >
                {i + 1}
              </span>

              {/* Label + sub */}
              <div className="flex-1 min-w-0">
                <div
                  className="truncate"
                  style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}
                >
                  {n.label}
                </div>
                <div
                  className="truncate"
                  style={{
                    fontFamily: FONT,
                    fontSize: 10.5,
                    color: n.hot ? PURPLE : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {n.sub}
                </div>
              </div>

              {/* Status indicator */}
              {active && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: ACCENT,
                    animation: 'blink 1s infinite',
                  }}
                >
                  ···
                </span>
              )}
              {done && <Check size={13} color={ACCENT} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
