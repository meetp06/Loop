import { Sparkles, Brain, MessageSquare } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../constants';
import useReveal from '../hooks/useReveal';
import Eyebrow from './atoms/Eyebrow';

/**
 * LoopSection — the two-way loop (brief + update) explanation cards.
 */
export default function LoopSection() {
  const ref = useReveal();

  const cards = [
    {
      tag: 'Before the meeting',
      icon: Sparkles,
      title: 'Ask for a brief.',
      body: 'It parses the account, pulls past meetings, contacts and facts, reads the team\u2019s XTrace memories, and a Butterbase-routed model writes a sharp brief — back in Slack in seconds.',
      sample: 'Brief me on Acme',
    },
    {
      tag: 'After the meeting',
      icon: Brain,
      title: 'Tell it what happened.',
      body: 'In plain English. It extracts structured facts, writes to XTrace + Butterbase at once, and rewires the shared memory graph live — so every rep\u2019s next brief reflects it.',
      sample: 'Meeting done. Acme pushed to Q3, budget cut 20%, Mark is now DM',
    },
  ];

  return (
    <section
      id="product"
      ref={ref}
      className="relative z-20 px-5 sm:px-8 max-w-6xl mx-auto"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
      <div className="reveal flex items-end justify-between flex-wrap gap-4">
        <div>
          <Eyebrow>The two-way loop</Eyebrow>
          <h2
            className="text-white"
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(1.6rem,3.6vw,2.6rem)',
              letterSpacing: '-0.02em',
              marginTop: 16,
            }}
          >
            A memory loop, not a query tool.
          </h2>
        </div>
        <span
          className="text-white/40"
          style={{ fontFamily: MONO, fontSize: 12, maxWidth: 240 }}
        >
          Both sides of the conversation handled in the one place you already
          work.
        </span>
      </div>

      <div className="reveal grid md:grid-cols-2 gap-4" style={{ marginTop: 36 }}>
        {cards.map((c) => (
          <div
            key={c.tag}
            className="rounded-2xl p-7 flex flex-col"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
                style={{
                  backgroundColor: 'rgba(124,255,178,0.1)',
                  border: '1px solid rgba(124,255,178,0.2)',
                }}
              >
                <c.icon size={17} color={ACCENT} />
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {c.tag}
              </span>
            </div>

            <h3
              className="text-white"
              style={{
                fontFamily: FONT,
                fontSize: '1.45rem',
                letterSpacing: '-0.01em',
                marginTop: 22,
              }}
            >
              {c.title}
            </h3>

            <p
              className="text-white/55"
              style={{
                fontFamily: FONT,
                fontSize: '.96rem',
                lineHeight: 1.65,
                marginTop: 12,
                flex: 1,
              }}
            >
              {c.body}
            </p>

            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{
                marginTop: 22,
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <MessageSquare
                size={13}
                color="rgba(255,255,255,0.35)"
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.5,
                }}
              >
                {c.sample}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
