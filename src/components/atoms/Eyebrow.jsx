import { MONO, ACCENT } from '../../constants';

/**
 * Eyebrow — small uppercase section label with a green dot.
 */
export default function Eyebrow({ children }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em]"
      style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.45)' }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: ACCENT,
          display: 'inline-block',
        }}
      />
      {children}
    </span>
  );
}
