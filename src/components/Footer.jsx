import { RefreshCw } from 'lucide-react';
import { FONT, MONO, ACCENT } from '../constants';

/**
 * Footer — bottom bar with logo and sponsor credits.
 */
export default function Footer() {
  return (
    <footer
      className="relative z-20 px-5 sm:px-10 max-w-6xl mx-auto"
      style={{
        paddingTop: 30,
        paddingBottom: 50,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <span
          className="flex items-center gap-2 text-white"
          style={{ fontFamily: FONT, fontWeight: 600 }}
        >
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded"
            style={{ border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <RefreshCw size={11} color={ACCENT} />
          </span>
          loop
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Meeting Brief &amp; De-brief Agent · RocketRide · Butterbase · XTrace · Photon
        </span>
      </div>
    </footer>
  );
}
