import { MONO } from '../../constants';

/**
 * Field — label + value row used inside BriefCard.
 */
export default function Field({ label, children }) {
  return (
    <div className="flex gap-3">
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          minWidth: 64,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ lineHeight: 1.55, flex: 1 }}>{children}</span>
    </div>
  );
}
