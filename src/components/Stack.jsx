import { Workflow, Database, Brain, MessageSquare } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../constants';
import useReveal from '../hooks/useReveal';
import Eyebrow from './atoms/Eyebrow';

/**
 * Stack — sponsor integration grid.
 */
export default function Stack() {
  const ref = useReveal();

  const items = [
    {
      id: 'rocketride',
      name: 'RocketRide',
      role: 'Orchestration engine',
      icon: Workflow,
      body: 'Two routed pipelines. Brief parses, fetches account + memory, and calls the AI gateway. Update extracts JSON facts, writes memory, and POSTs the graph rewire. Core to every flow.',
    },
    {
      id: 'butterbase',
      name: 'Butterbase',
      role: 'Backend infrastructure',
      icon: Database,
      body: 'Auth that gates which accounts you see, database + file storage for everything the brief needs, and an AI gateway that routes each task to the right model.',
    },
    {
      id: 'xtrace',
      name: 'XTrace',
      role: 'Persistent team memory',
      icon: Brain,
      body: 'Holds every fact learned about each account across all reps and revises it. /memory/update writes here and to Butterbase at once — so the next brief, for anyone, reflects it.',
    },
    {
      id: 'photon',
      name: 'Photon',
      role: 'Messaging + graph · Spectrum',
      icon: MessageSquare,
      body: 'The product lives in Slack. Photon receives, authenticates, routes to RocketRide, delivers the brief back — and serves the live graph that rewires on every update.',
    },
  ];

  return (
    <section
      id="stack"
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-6xl mx-auto"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
      <div className="reveal">
        <Eyebrow>The stack</Eyebrow>
        <h2
          className="text-white"
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.6rem,3.6vw,2.6rem)',
            letterSpacing: '-0.02em',
            marginTop: 16,
          }}
        >
          Four sponsors. Each with a real, on-screen moment.
        </h2>
      </div>

      <div className="reveal grid md:grid-cols-2 gap-4" style={{ marginTop: 36 }}>
        {items.map((it) => (
          <div
            key={it.id}
            className="rounded-2xl p-6"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <it.icon size={18} color={ACCENT} />
              </span>
              <div>
                <h3
                  className="text-white"
                  style={{ fontFamily: FONT, fontSize: '1.15rem', fontWeight: 600 }}
                >
                  {it.name}
                </h3>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {it.role}
                </span>
              </div>
            </div>
            <p
              className="text-white/55"
              style={{
                fontFamily: FONT,
                fontSize: '.92rem',
                lineHeight: 1.65,
                marginTop: 16,
              }}
            >
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
