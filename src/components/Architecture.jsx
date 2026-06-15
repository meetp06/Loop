import { MessageSquare, Workflow, Database, Share2 } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../constants';
import useReveal from '../hooks/useReveal';
import Eyebrow from './atoms/Eyebrow';

/**
 * Architecture — four-step architecture cards.
 */
export default function Architecture() {
  const ref = useReveal();

  const stages = [
    {
      n: '01',
      t: 'Photon receives',
      d: 'A Slack message hits the Spectrum messaging layer, which authenticates the channel and POSTs to the RocketRide webhook with text, user and channel.',
      icon: MessageSquare,
    },
    {
      n: '02',
      t: 'RocketRide routes',
      d: '"Brief me" → Brief Pipeline. "Meeting done" → Update Pipeline. Each is a visible, multi-node, multi-source workflow — not a single model call.',
      icon: Workflow,
    },
    {
      n: '03',
      t: 'Butterbase + XTrace',
      d: 'Butterbase handles auth, storage and the AI gateway; XTrace holds the shared, self-revising team memory written on every update.',
      icon: Database,
    },
    {
      n: '04',
      t: 'Graph rewires live',
      d: 'POST /graph/update fires new purple memory nodes into the graph and reflows it on screen — the room watches memory change in real time.',
      icon: Share2,
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-6xl mx-auto"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
      <div className="reveal">
        <Eyebrow>Architecture</Eyebrow>
        <h2
          className="text-white"
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.6rem,3.6vw,2.6rem)',
            letterSpacing: '-0.02em',
            marginTop: 16,
          }}
        >
          One message in. A real workflow behind it.
        </h2>
      </div>

      <div
        className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-px"
        style={{
          marginTop: 36,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {stages.map((s) => (
          <div
            key={s.n}
            className="p-6 flex flex-col"
            style={{ background: '#0a0a0a', minHeight: 220 }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: MONO, fontSize: 12, color: ACCENT }}>{s.n}</span>
              <s.icon size={16} color="rgba(255,255,255,0.4)" />
            </div>
            <h3
              className="text-white"
              style={{
                fontFamily: FONT,
                fontSize: '1.05rem',
                fontWeight: 600,
                marginTop: 28,
                letterSpacing: '-0.01em',
              }}
            >
              {s.t}
            </h3>
            <p
              className="text-white/50"
              style={{ fontFamily: FONT, fontSize: '.88rem', lineHeight: 1.6, marginTop: 10 }}
            >
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
