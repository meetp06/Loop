/**
 * Atmosphere — ambient background with drifting gradient blobs and a subtle grid.
 */
export default function Atmosphere() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: '#060606' }}>
      {/* Green blob — top-left */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(124,255,178,0.10), rgba(124,255,178,0) 60%)',
          filter: 'blur(40px)',
          animation: 'drift1 24s ease-in-out infinite',
        }}
      />
      {/* Purple blob — bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-15%',
          width: '70vw',
          height: '70vw',
          background: 'radial-gradient(circle, rgba(120,100,255,0.10), rgba(120,100,255,0) 62%)',
          filter: 'blur(50px)',
          animation: 'drift2 30s ease-in-out infinite',
        }}
      />
      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
        }}
      />
    </div>
  );
}
