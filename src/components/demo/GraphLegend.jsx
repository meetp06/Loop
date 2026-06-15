import { MONO, ACCENT, PURPLE } from '../../constants';

/**
 * GraphLegend — color legend row for the memory graph.
 */
export default function GraphLegend() {
  const items = [
    ['Account', '#fff'],
    ['Contact', '#6EA8FF'],
    ['Fact', ACCENT],
    ['Memory', '#8E7BCB'],
    ['New memory', PURPLE],
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map(([l, c]) => (
        <span
          key={l}
          className="flex items-center gap-1.5"
          style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: c,
              display: 'inline-block',
            }}
          />
          {l}
        </span>
      ))}
    </div>
  );
}
