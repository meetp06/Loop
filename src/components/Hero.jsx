import { ArrowRight } from 'lucide-react';
import { FONT, MONO } from '../constants';
import SlackChip from './atoms/SlackChip';

/**
 * Hero — headline, subtext, and two CTAs.
 */
export default function Hero() {
  return (
    <header
      id="top"
      className="relative z-20 flex flex-col items-center text-center px-5 sm:px-8"
      style={{ paddingTop: 150, paddingBottom: 80 }}
    >
      <div className="msg-in" style={{ animationDelay: '.05s' }}>
        <SlackChip />
      </div>

      <h1
        className="text-white font-normal max-w-4xl msg-in"
        style={{
          fontFamily: FONT,
          fontSize: 'clamp(2.1rem, 6vw, 4.2rem)',
          lineHeight: 1.06,
          letterSpacing: '-0.03em',
          marginTop: 28,
          animationDelay: '.12s',
        }}
      >
        Walk into every meeting
        <br className="hidden sm:block" /> already knowing{' '}
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>everything.</span>
      </h1>

      <p
        className="msg-in"
        style={{
          fontFamily: MONO,
          marginTop: 24,
          maxWidth: 560,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 'clamp(.85rem,1.6vw,1rem)',
          lineHeight: 1.7,
          letterSpacing: '0.01em',
          animationDelay: '.2s',
        }}
      >
        an agent that briefs you before, learns from you after — and rewrites
        the team&rsquo;s shared memory in real time, so nobody starts from
        scratch again.
      </p>

      <div
        className="flex flex-col sm:flex-row items-center gap-3 msg-in"
        style={{ marginTop: 36, animationDelay: '.28s' }}
      >
        <a
          href="#demo"
          className="flex items-center gap-2.5 px-6 py-3 rounded-full text-black text-sm font-medium hover:opacity-80 transition-all duration-300 group"
          style={{ fontFamily: FONT, backgroundColor: '#fff' }}
        >
          See the loop run{' '}
          <ArrowRight
            size={15}
            className="group-hover:translate-x-0.5 transition-transform"
          />
        </a>
        <a
          href="#how-it-works"
          className="flex items-center gap-2 px-6 py-3 rounded-full text-white/80 text-sm hover:text-white transition"
          style={{ fontFamily: FONT, border: '1px solid rgba(255,255,255,0.14)' }}
        >
          How it works
        </a>
      </div>

      <p
        className="msg-in"
        style={{
          fontFamily: MONO,
          marginTop: 28,
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
          animationDelay: '.36s',
        }}
      >
        no forms · no CRM updates · no dashboards to visit
      </p>
    </header>
  );
}
