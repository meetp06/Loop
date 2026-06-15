import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ACCENT, PURPLE, MONO } from '../../constants';

/* ------------------------------------------------------------------ *
 *  MemoryGraph — d3-force driven knowledge graph
 *  Shows account nodes, contacts, meetings, facts, and memory nodes.
 *  Fully reactive: driven by `nodes` and `links` props.
 * ------------------------------------------------------------------ */

const GW = 920;
const GH = 420;
const PAD = 24;

const N_COLOR = {
  account: '#FFFFFF',
  contact: '#6EA8FF',
  meeting: 'rgba(255,255,255,0.55)',
  fact: ACCENT,
  memory: '#8E7BCB',
  newmem: PURPLE,
};

const N_R = {
  account: 14,
  contact: 9,
  meeting: 6,
  fact: 7,
  memory: 6,
  newmem: 10,
};

const N_GLOW = {
  account: '0 0 16px rgba(255,255,255,0.55)',
  contact: '0 0 12px rgba(110,168,255,0.55)',
  fact: `0 0 12px ${ACCENT}55`,
  memory: '0 0 10px rgba(142,123,203,0.45)',
  newmem: `0 0 18px ${PURPLE}AA`,
};

export default function MemoryGraph({ nodes: propsNodes, links: propsLinks, onStats }) {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [recentIds, setRecentIds] = useState(() => new Set());
  const simRef = useRef(null);
  const svgRef = useRef(null);
  const seenIds = useRef(new Set());
  const hasInitialized = useRef(false);
  const recentTimers = useRef(new Map());

  // Build / update simulation when props change
  useEffect(() => {
    if (!propsNodes || propsNodes.length === 0) return;

    // Preserve positions of existing nodes
    const prevById = new Map(nodes.map((n) => [n.id, n]));

    const freshIds = [];
    const simNodes = propsNodes.map((n) => {
      const prev = prevById.get(n.id);
      const isFresh = !seenIds.current.has(n.id);
      if (isFresh) {
        seenIds.current.add(n.id);
        // Only flag as fresh AFTER first mount; initial nodes are not "new"
        if (hasInitialized.current) freshIds.push(n.id);
      }
      return {
        ...n,
        x: prev ? prev.x : GW / 2 + (Math.random() - 0.5) * 200,
        y: prev ? prev.y : GH / 2 + (Math.random() - 0.5) * 150,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        justBorn: isFresh && hasInitialized.current,
      };
    });

    // Auto-show labels on newly added nodes for ~8s, then auto-hide
    if (freshIds.length) {
      // Cap to a visual budget if wrapper dumps a giant graph
      const visibleFresh = freshIds.slice(0, 30);
      setRecentIds((prev) => {
        const next = new Set(prev);
        visibleFresh.forEach((id) => next.add(id));
        return next;
      });
      visibleFresh.forEach((id) => {
        const old = recentTimers.current.get(id);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setRecentIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          recentTimers.current.delete(id);
        }, 8000);
        recentTimers.current.set(id, t);
      });
    }

    hasInitialized.current = true;

    // Anchor the account node in the center
    const acc = simNodes.find((n) => n.id === 'acme');
    if (acc) {
      acc.fx = GW / 2;
      acc.fy = GH / 2;
    }

    const simLinks = propsLinks.map((l) => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
      isNew: l.isNew,
    }));

    // Distance per source type so account sits with breathing room
    const linkDistance = (l) => {
      const t = typeof l.target === 'object' ? l.target.type : null;
      if (t === 'newmem') return 78;
      if (t === 'memory') return 70;
      if (t === 'fact') return 60;
      if (t === 'contact') return 70;
      if (t === 'meeting') return 64;
      return 60;
    };

    if (!simRef.current) {
      simRef.current = d3
        .forceSimulation(simNodes)
        .alphaDecay(0.025)
        .velocityDecay(0.42)
        .force(
          'link',
          d3.forceLink(simLinks).id((d) => d.id).distance(linkDistance).strength(0.5)
        )
        .force('charge', d3.forceManyBody().strength(-220).distanceMax(360))
        .force('collide', d3.forceCollide((d) => (N_R[d.type] || 6) + 8).strength(0.9))
        .force('x', d3.forceX(GW / 2).strength(0.04))
        .force('y', d3.forceY(GH / 2).strength(0.07))
        .on('tick', () => {
          const sim = simRef.current;
          if (!sim) return;
          // Keep nodes inside the viewport
          for (const n of sim.nodes()) {
            const r = N_R[n.type] || 6;
            n.x = Math.max(PAD + r, Math.min(GW - PAD - r, n.x));
            n.y = Math.max(PAD + r, Math.min(GH - PAD - r, n.y));
          }
          setNodes([...sim.nodes()]);
          setLinks([...sim.force('link').links()]);
        });
    } else {
      simRef.current.nodes(simNodes);
      simRef.current.force('link').links(simLinks).distance(linkDistance);
      simRef.current.alpha(0.9).restart();
    }

    if (onStats) {
      onStats({
        n: simNodes.length,
        e: simLinks.length,
        newCount: freshIds.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsNodes, propsLinks]);

  // Gentle ambient motion + cleanup
  useEffect(() => {
    const timersMap = recentTimers.current;
    const poll = setInterval(() => {
      if (simRef.current) simRef.current.alpha(0.04).restart();
    }, 3500);
    return () => {
      clearInterval(poll);
      if (simRef.current) simRef.current.stop();
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
    };
  }, []);

  // React-based drag (one handler per node). Avoids re-binding d3 on every tick.
  const dragId = useRef(null);
  const onPointerDown = (e, id) => {
    if (id === 'acme') return;
    dragId.current = id;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (simRef.current) simRef.current.alphaTarget(0.3).restart();
    const node = simRef.current?.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  };
  const onPointerMove = (e) => {
    const id = dragId.current;
    if (!id || !svgRef.current || !simRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    const node = simRef.current.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = svgP.x;
      node.fy = svgP.y;
    }
  };
  const onPointerUp = (e) => {
    const id = dragId.current;
    dragId.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (simRef.current) simRef.current.alphaTarget(0);
    if (!id || id === 'acme') return;
    const node = simRef.current?.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${GW} ${GH}`}
      width="100%"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ display: 'block', cursor: 'grab', touchAction: 'none' }}
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(201,166,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
        </linearGradient>
        <linearGradient id="linkGradNew" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`${PURPLE}33`} />
          <stop offset="100%" stopColor={`${PURPLE}CC`} />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <rect x="0" y="0" width={GW} height={GH} fill="url(#bgGlow)" />

      {/* Links */}
      <g>
        {links.map((l, i) => {
          const s = l.source;
          const t = l.target;
          if (typeof s !== 'object' || typeof t !== 'object') return null;
          return (
            <line
              key={`${s.id}-${t.id}-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={l.isNew ? 'url(#linkGradNew)' : 'url(#linkGrad)'}
              strokeWidth={l.isNew ? 1.6 : 1}
              strokeDasharray={l.isNew ? '4 3' : 'none'}
              style={{
                animation: l.isNew ? 'graphLinkDraw 0.9s ease both' : 'none',
              }}
            />
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((n) => {
          const r = N_R[n.type] || 6;
          const justBorn = n.justBorn;
          // Labels are hidden by default. Show on: new (recent), hover, or tapped.
          const showLabel =
            recentIds.has(n.id) || hover === n.id || selected === n.id;

          return (
            <g
              key={n.id}
              className="gnode"
              transform={`translate(${n.x}, ${n.y})`}
              onPointerDown={(e) => onPointerDown(e, n.id)}
              onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
              style={{
                cursor: 'grab',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: justBorn
                  ? 'graphNodePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both'
                  : 'none',
                filter:
                  n.type === 'newmem' || n.type === 'account' || hover === n.id
                    ? 'url(#softGlow)'
                    : 'none',
              }}
            >
              {/* Pulsing ring for new memory OR recently-added node */}
              {(n.type === 'newmem' || recentIds.has(n.id)) && (
                <>
                  <circle
                    r={r + 8}
                    fill="none"
                    stroke={`${PURPLE}88`}
                    strokeWidth={1.5}
                    style={{ animation: 'graphRingPulse 1.6s ease-out infinite' }}
                  />
                  <circle r={r + 5} fill={`${PURPLE}22`} />
                </>
              )}

              {/* Outer halo on hover */}
              {hover === n.id && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                />
              )}

              {/* Node body */}
              <circle
                r={r}
                fill={N_COLOR[n.type]}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
                style={{
                  boxShadow: N_GLOW[n.type],
                  transition: 'r 0.3s ease',
                }}
              >
                <title>{n.label}</title>
              </circle>

              {showLabel && (() => {
                const isNew = recentIds.has(n.id);
                const txt = (n.label || '').toString();
                const fontSize = isNew ? 12 : n.type === 'account' ? 12 : 10;
                const charW = fontSize * 0.62;
                const padX = 8;
                const padY = 4;
                const w = Math.min(220, txt.length * charW + padX * 2);
                const h = fontSize + padY * 2;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={-w / 2}
                      y={-r - h - 6}
                      width={w}
                      height={h}
                      rx={h / 2}
                      ry={h / 2}
                      fill={isNew ? `${PURPLE}E6` : 'rgba(15,15,18,0.92)'}
                      stroke={isNew ? PURPLE : 'rgba(255,255,255,0.18)'}
                      strokeWidth={1}
                    />
                    <text
                      y={-r - h / 2 - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{
                        fontFamily: MONO,
                        fontSize,
                        fontWeight: isNew ? 600 : 500,
                        fill: isNew ? '#fff' : 'rgba(255,255,255,0.92)',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {txt.length > 30 ? txt.slice(0, 28) + '…' : txt}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
