import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, Send, MessageSquare, Zap, RefreshCw,
} from 'lucide-react';
import { FONT, MONO, ACCENT, PURPLE } from '../../constants';
import Eyebrow from '../atoms/Eyebrow';
import { buildInitialGraph } from './demoData';
import BriefCard from './BriefCard';
import ConfirmCard from './ConfirmCard';
import Pipeline from './Pipeline';
import MemoryGraph from './MemoryGraph';
import GraphLegend from './GraphLegend';

/**
 * DemoSection — the interactive demo orchestrator.
 * Contains Slack-style chat, pipeline visualizer, and live memory graph.
 */
export default function DemoSection() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [pipe, setPipe] = useState('brief');
  const [pstates, setPstates] = useState({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ n: 26, e: 25, newCount: 0 });

  // Graph state: initialized from localStorage or defaults
  const [nodes, setNodes] = useState(() => {
    try {
      const s = localStorage.getItem('loop_graph_nodes');
      if (!s) return buildInitialGraph().nodes;
      const parsed = JSON.parse(s);
      const valid = Array.isArray(parsed) && parsed.length > 0 && parsed.every((n) => n && n.id && n.type);
      return valid ? parsed : buildInitialGraph().nodes;
    } catch {
      return buildInitialGraph().nodes;
    }
  });
  const [links, setLinks] = useState(() => {
    try {
      const s = localStorage.getItem('loop_graph_links');
      if (!s) return buildInitialGraph().links;
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : buildInitialGraph().links;
    } catch {
      return buildInitialGraph().links;
    }
  });

  const timers = useRef([]);
  const scroller = useRef(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const wait = (ms) => new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    timers.current.push(t);
  });

  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages]);

  const reset = useCallback(async () => {
    clearTimers();
    setMessages([]);
    const init = buildInitialGraph();
    setNodes(init.nodes);
    setLinks(init.links);
    localStorage.removeItem('loop_graph_nodes');
    localStorage.removeItem('loop_graph_links');
    setPipe('brief');
    setRunning(false);
    setDone(false);
    await fetch('/api/reset', { method: 'POST' }).catch(() => {});
  }, []);

  /**
   * Core agent: always SyncFlow (Express + wrapper LLM + Groq polish on backend).
   */
  const processMessageDirect = async (text) => {
    setMessages((p) => [...p, { role: 'user', text }]);

    const isBriefRequest = text.toLowerCase().includes('brief');
    setPipe(isBriefRequest ? 'brief' : 'update');
    setPstates({});

    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, user: 'Jordan', channel: 'deals-acme' }),
    });
    if (!res.ok) throw new Error(`SyncFlow server error (HTTP ${res.status})`);

    const initData = await res.json();
    const pipelineId = initData.pipelineId;

    let completed = false;
    let attempts = 0;
    const maxAttempts = 80;

    while (attempts < maxAttempts && !completed) {
      await wait(300);
      attempts++;

      const pollRes = await fetch('/api/active-pipeline');
      if (!pollRes.ok) continue;

      const pipeState = await pollRes.json();
      if (pipeState.pipelineId !== pipelineId) continue;

      const isBrief = pipeState.type === 'brief';
      const nodeKeys = isBrief
        ? ['parse_account', 'fetch_account_data', 'fetch_memory_data', 'ai_gateway_synthesis', 'return_brief']
        : ['receive_update_text', 'ai_gateway_extraction', 'update_memory_wrapper', 'update_graph_server', 'return_confirmation'];
      const uiStages = isBrief
        ? ['parse', 'account', 'memory', 'ai', 'return']
        : ['recv', 'extract', 'memwrite', 'graph', 'confirm'];

      const newPstates = {};
      for (let idx = 0; idx < nodeKeys.length; idx++) {
        const node = pipeState.nodes[nodeKeys[idx]];
        if (node) {
          if (node.status === 'completed') newPstates[uiStages[idx]] = 'done';
          else if (node.status === 'running') newPstates[uiStages[idx]] = 'active';
        }
      }
      setPstates(newPstates);

      if (pipeState.status === 'completed') {
        completed = true;

        if (isBrief) {
          const briefText = pipeState.nodes.ai_gateway_synthesis.data || 'No brief compiled.';
          setMessages((p) => [...p, { role: 'agent', text: briefText.replace(/###/g, '') }]);
        } else {
          const confirmText = pipeState.nodes.return_confirmation.data || 'Updated.';
          setMessages((p) => [...p, { role: 'agent', kind: 'confirm', text: confirmText }]);
        }

        // Pull rewired live graph
        try {
          const graphRes = await fetch('/api/graph/Acme%20Corp');
          if (graphRes.ok) {
            const graphData = await graphRes.json();
            const convertedNodes = (graphData.nodes || []).map((n) => ({
              id: n.id,
              type: n.type || (n.id === 'acme' ? 'account' : 'memory'),
              label: n.label || n.name || n.text || n.id,
            }));
            const convertedLinks = (graphData.edges || graphData.links || []).map((e) => ({
              source: typeof e.source === 'object' ? e.source.id : e.source,
              target: typeof e.target === 'object' ? e.target.id : e.target,
              isNew: e.isNew || false,
            }));
            setNodes(convertedNodes);
            setLinks(convertedLinks);
          }
        } catch (gErr) {
          console.error('Failed to query live D3 graph from backend:', gErr);
        }
      } else if (pipeState.status === 'error') {
        throw new Error('Backend pipeline failed.');
      }
    }

    if (!completed) throw new Error('Pipeline status polling timed out.');
  };

  /**
   * Submission handler for manual chat typing
   */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || running) return;

    const query = inputText;
    setInputText('');
    setRunning(true);

    try {
      await processMessageDirect(query);
    } catch (err) {
      console.error(err);
      setMessages((p) => [
        ...p,
        { role: 'agent', text: `⚠️ Connection Error: ${err.message}. Make sure server.js is running on port 3000.` }
      ]);
    } finally {
      setRunning(false);
    }
  };

  /**
   * Run the standard automated demonstration loop sequence
   */
  const run = useCallback(async () => {
    reset();
    setRunning(true);

    const delay = (ms) => new Promise((res) => {
      const t = setTimeout(res, ms);
      timers.current.push(t);
    });

    try {
      // 1. Initial Brief
      await processMessageDirect('Brief me on Acme');
      await delay(2200);

      // 2. Real-time update statement
      await processMessageDirect(
        'Meeting done. Acme pushed everything to Q3, budget cut 20%. Sarah is out — Mark is the new decision maker.'
      );
      await delay(2500);

      // 3. Re-brief request showing updated memory
      await processMessageDirect('Brief me on Acme');
      setDone(true);
    } catch (e) {
      console.error('Auto demo interrupted', e);
    } finally {
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  return (
    <section
      id="demo"
      className="relative z-20 px-5 sm:px-8 max-w-6xl mx-auto"
      style={{ paddingTop: 70, paddingBottom: 70 }}
    >
      <span id="memory" style={{ position: 'absolute', top: -80 }} />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Eyebrow>Live demo</Eyebrow>
          <h2
            className="text-white"
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(1.6rem,3.6vw,2.6rem)',
              letterSpacing: '-0.02em',
              marginTop: 16,
            }}
          >
            Watch the memory rewire itself.
          </h2>
          <p
            className="text-white/50"
            style={{
              fontFamily: FONT,
              fontSize: '.96rem',
              marginTop: 10,
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Brief → update in plain English → ask again. The second brief is
            different and the graph has new purple memories — nobody touched a
            database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-black text-sm font-medium transition-all duration-300"
            style={{
              fontFamily: FONT,
              backgroundColor: running ? 'rgba(255,255,255,0.4)' : '#fff',
              cursor: running ? 'default' : 'pointer',
            }}
          >
            {running ? (
              <>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: '#000',
                    animation: 'blink 1s infinite',
                    display: 'inline-block',
                  }}
                />
                running…
              </>
            ) : (
              <>
                <Zap size={15} /> {done ? 'Run again' : 'Run the loop'}
              </>
            )}
          </button>
          {(done || messages.length > 0) && !running && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white/70 hover:text-white text-sm transition"
              style={{ fontFamily: FONT, border: '1px solid rgba(255,255,255,0.14)' }}
            >
              <RefreshCw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Main grid: chat + pipeline */}
      <div className="grid lg:grid-cols-5 gap-4" style={{ marginTop: 36 }}>
        {/* Slack-style chat */}
        <div
          className="lg:col-span-3 rounded-2xl overflow-hidden flex flex-col justify-between"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            background: '#0a0a0a',
            minHeight: 520,
          }}
        >
          {/* Channel header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <Hash size={15} color="rgba(255,255,255,0.45)" />
            <span
              className="text-white/85 flex-1 font-semibold text-sm"
              style={{ fontFamily: FONT }}
            >
              deals-acme
            </span>

            <span
              className="text-[9px] uppercase tracking-wider font-semibold rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20 px-2 py-0.5"
              style={{ fontFamily: MONO }}
            >
              SYNCFLOW + GROQ LIVE
            </span>

            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              via Photon · Spectrum
            </span>
          </div>

          {/* Messages view list */}
          <div
            ref={scroller}
            className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto"
            style={{ maxHeight: 400, minHeight: 380 }}
          >
            {messages.length === 0 && (
              <div
                className="flex flex-col items-center justify-center text-center h-full gap-4 px-6"
                style={{ minHeight: 350 }}
              >
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <MessageSquare size={20} color="rgba(255,255,255,0.4)" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-white/80 font-medium"
                    style={{ fontFamily: FONT, fontSize: 14 }}
                  >
                    Interactive Sandbox Mode
                  </span>
                  <p
                    className="text-white/40 max-w-sm"
                    style={{ fontFamily: FONT, fontSize: 12, lineHeight: 1.5 }}
                  >
                    Ask for a brief or type plain-English updates to watch the memory rewire. Try the suggestions below or click "Run the loop".
                  </p>
                </div>
                
                {/* Suggestions chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {[
                    'Brief me on Acme',
                    'Sarah Chen has left the company',
                    'Budget cut to $120k',
                    'Mark is the new decision maker'
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInputText(s)}
                      disabled={running}
                      className="px-3 py-1.5 rounded-full text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition duration-200 cursor-pointer disabled:opacity-50"
                      style={{ fontFamily: MONO }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="flex gap-3 msg-in">
                <span
                  className="inline-flex items-center justify-center rounded-md"
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    color: m.role === 'user' ? '#fff' : '#000',
                    background: m.role === 'user' ? 'rgba(255,255,255,0.1)' : ACCENT,
                  }}
                >
                  {m.role === 'user' ? 'JD' : <RefreshCw size={15} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-white"
                      style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13 }}
                    >
                      {m.role === 'user' ? 'Jordan' : 'loop'}
                    </span>
                    {m.role === 'agent' && (
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9,
                          color: ACCENT,
                          background: 'rgba(124,255,178,0.1)',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        APP
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 5 }}>
                    {m.kind === 'brief' ? (
                      <BriefCard data={m.data} />
                    ) : m.kind === 'confirm' ? (
                      <ConfirmCard diffs={m.diffs} text={m.text} />
                    ) : (
                      <p
                        className="text-white/80 font-normal whitespace-pre-wrap leading-relaxed"
                        style={{ fontFamily: FONT, fontSize: 13.5 }}
                      >
                        {m.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form input bar */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={running}
              placeholder="Type an update (e.g. 'Sarah has left') or ask for a brief..."
              className="flex-1 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/20 transition-all"
              style={{
                fontFamily: FONT,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <button
              type="submit"
              disabled={running || !inputText.trim()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{
                background: inputText.trim() && !running ? ACCENT : 'rgba(255,255,255,0.05)',
                color: inputText.trim() && !running ? '#000' : 'rgba(255,255,255,0.4)',
                cursor: (running || !inputText.trim()) ? 'default' : 'pointer'
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Pipeline panel */}
        <div className="lg:col-span-2">
          <Pipeline name={pipe} states={pstates} />
        </div>
      </div>

      {/* Live memory graph */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          marginTop: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#080808',
        }}
      >
        <div
          className="flex items-center justify-between flex-wrap gap-3 px-5 py-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span className="flex items-center gap-2.5">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: ACCENT,
                display: 'inline-block',
                animation: 'blink 1.6s infinite',
              }}
            />
            <span
              className="text-white/85"
              style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14 }}
            >
              Acme — team memory graph
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              GET /graph/Acme Corp · every 3s
            </span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: stats.n > 26 ? PURPLE : 'rgba(255,255,255,0.7)' }}>
              {stats.n}
            </span>{' '}
            nodes ·{' '}
            <span style={{ color: stats.e > 25 ? PURPLE : 'rgba(255,255,255,0.7)' }}>
              {stats.e}
            </span>{' '}
            edges
            {stats.newCount > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: `${PURPLE}33`,
                  color: PURPLE,
                  fontWeight: 600,
                }}
              >
                +{stats.newCount} new
              </span>
            )}
          </span>
        </div>

        <div style={{ padding: '8px 8px 0' }}>
          <MemoryGraph nodes={nodes} links={links} onStats={setStats} />
        </div>

        <div
          className="px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <GraphLegend />
        </div>
      </div>

    </section>
  );
}
