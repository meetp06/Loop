import { Hash } from 'lucide-react';
import { MONO, ACCENT } from '../../constants';

/**
 * SlackChip — small pill that reads "# lives in Slack".
 */
export default function SlackChip() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{
        fontFamily: MONO,
        color: 'rgba(255,255,255,0.7)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Hash size={12} color={ACCENT} />
      lives in Slack
    </span>
  );
}
