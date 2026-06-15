import { FileText, AlertTriangle } from 'lucide-react';
import { FONT, MONO, ACCENT, AMBER } from '../../constants';
import Field from './Field';

/**
 * BriefCard — pre-meeting brief rendered inside the Slack chat.
 */
export default function BriefCard({ data }) {
  if (!data) return null;

  // Defensive mappings to prevent crashes on malformed/missing LLM outputs
  const changed = data.changed || {};
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const last = data.last || '';
  const contract = data.contract || '';
  const risk = data.risk || '';
  const deal = data.deal || '';

  return (
    <div
      className="msg-in"
      style={{
        fontFamily: FONT,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#0d0d0d',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span
          className="flex items-center gap-2 text-white"
          style={{ fontWeight: 600, fontSize: 13 }}
        >
          <FileText size={14} color={ACCENT} /> Acme — Pre-Meeting Brief
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
          v{data.version || 1}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-3" style={{ fontSize: 13 }}>
        <Field label="Recap">
          <span
            style={{
              color: changed.last ? AMBER : 'rgba(255,255,255,0.75)',
              padding: changed.last ? '1px 5px' : 0,
              borderRadius: 4,
              background: changed.last ? 'rgba(255,197,107,0.08)' : 'transparent',
            }}
          >
            {last}
          </span>
        </Field>

        <Field label="Contacts">
          <span className="flex flex-col gap-1">
            {contacts.map((c, i) => (
              <span key={c.n || i} style={{ color: c.hot ? AMBER : 'rgba(255,255,255,0.8)' }}>
                <strong style={{ fontWeight: 600 }}>{c.n}</strong>{' '}
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>— {c.r}</span>
                {c.hot ? '  ← new' : ''}
              </span>
            ))}
          </span>
        </Field>

        <Field label="Contract">
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{contract}</span>
        </Field>

        <Field label="Risk">
          <span
            className="flex items-start gap-1.5"
            style={{ color: changed.risk ? AMBER : 'rgba(255,255,255,0.8)' }}
          >
            <AlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            {risk}
          </span>
        </Field>

        <Field label="Open deal">
          <span
            style={{
              fontFamily: MONO,
              color: changed.deal ? AMBER : 'rgba(255,255,255,0.85)',
            }}
          >
            {deal}
          </span>
        </Field>
      </div>
    </div>
  );
}
