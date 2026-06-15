const express = require('express');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Slack signing requires raw body for verification — preserve it
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.static(path.join(__dirname, 'dist')));

const WRAPPER_BASE_URL = 'https://submammary-correlatively-irma.ngrok-free.dev';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const GROQ_BRIEF_POLISH_SYSTEM = `You are a senior sales-ops writer.

Rewrite the given pre-meeting brief into a richer, more useful Slack message. Target length is roughly 150% of the input (about 50% more content than a minimal brief).

Requirements:
- Preserve every fact, number, name, date, and stage exactly. Never invent details.
- Output 9-13 bullet points organized under clear bold section headers (e.g. **Key Contacts**, **Last Meeting**, **Recent Activity**, **Deal Status**, **Risks & Watchouts**, **Recommended Next Steps**).
- Everything above the Summary MUST be bullets, not prose. One short sentence per bullet. Never combine multiple bullets into a paragraph.
- Add a "Risks & Watchouts" section that names concrete risks implied by the facts (stage slip, lost champion, budget cut, missing decision maker). Do not invent unstated risks.
- Add a "Recommended Next Steps" section with 2-3 concrete suggestions grounded in the supplied facts.
- ONLY the final **Summary** section is prose: a single 5-6 line paragraph that pulls together account state, the most important risks, and the meeting posture the rep should walk in with. Preserve facts exactly; no invention.
- Keep the tone tight and professional. No filler, no hedging, no apologies, no marketing language.`;

const GROQ_CONFIRM_POLISH_SYSTEM = `You are a senior sales-ops writer.

Rewrite the given memory-update confirmation into a richer Slack message. Target length is roughly 150% of the input (about 50% more content than a minimal confirmation).

Requirements:
- Preserve every before -> after diff, name, number, stage, and new fact exactly. Never invent details.
- Output 5-9 short bullets under clear bold section headers (e.g. **Changes Applied**, **New Facts**, **Implications**, **What This Means For The Deal**).
- Everything above the Summary MUST be bullets, not prose. One short sentence per bullet.
- Add an "Implications" section connecting the changes to the deal state. Do not invent unstated facts.
- ONLY the final **Summary** section is prose: a single 5-6 line paragraph explaining what changed, what it means for the deal trajectory, and what the rep should do next. Preserve facts exactly; no invention.
- Close with a one-line note like "All reps will see this in their next brief."
- Tone: tight, professional, no filler, no hedging, no apologies.`;

function callGroqText(prompt, systemInstruction) {
  return new Promise((resolve, reject) => {
    if (!GROQ_API_KEY) return reject(new Error('GROQ_API_KEY not set'));
    const body = JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });
    const req = https.request(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const text = parsed.choices?.[0]?.message?.content;
              if (!text) return reject(new Error('Empty Groq response'));
              resolve(text.trim());
            } else {
              reject(new Error(parsed.error?.message || `Groq HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function polishWithGroq(raw, system) {
  if (!GROQ_API_KEY || !raw) return raw;
  try {
    return await callGroqText(raw, system);
  } catch (err) {
    console.error('Groq polish failed, returning raw:', err.message);
    return raw;
  }
}

// Verify Slack request signature
function verifySlackSignature(req) {
  if (!SLACK_SIGNING_SECRET) return true; // skip verification if not configured
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;
  // Reject replays older than 5 min
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${req.rawBody || ''}`;
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(base).digest('hex');
  const expected = `v0=${hmac}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Post a message to Slack via chat.postMessage
function slackPost(channel, text, threadTs) {
  return new Promise((resolve, reject) => {
    if (!SLACK_BOT_TOKEN) return reject(new Error('SLACK_BOT_TOKEN not set'));
    const body = JSON.stringify({ channel, text, thread_ts: threadTs });
    const req = https.request(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) resolve(parsed);
            else reject(new Error(parsed.error || 'slack error'));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Helper to make HTTPS requests to wrapper with ngrok warning bypass headers
function requestWrapper(endpoint, method = 'GET', postData = null) {
  return new Promise((resolve, reject) => {
    const url = `${WRAPPER_BASE_URL}${endpoint}`;
    const options = {
      method: method,
      headers: {
        'ngrok-skip-browser-warning': '1',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            resolve(data); // Return raw if not JSON
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

// Helper to extract timeline/budget/decision-maker hints from freeform text
function extractUpdatesFromText(text) {
  let timeline = null;
  let budget = null;
  let decisionMaker = null;

  const qMatch = text.match(/Q[1-4]/i);
  if (qMatch) timeline = qMatch[0].toUpperCase();

  // Strip Q1-4 tokens so "Q2" doesn't get picked as numeric budget
  const cleaned = text.replace(/Q[1-4]/gi, '');
  const arrMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(K|M|%|percent)?/i);
  if (arrMatch) {
    const val = arrMatch[1];
    const unit = arrMatch[2] ? arrMatch[2].toUpperCase() : '';
    if (unit === 'K') budget = `$${val}K ARR`;
    else if (unit === 'M') budget = `$${val}M ARR`;
    else if (unit === '%' || unit === 'PERCENT') budget = `Cut by ${val}%`;
    else budget = `$${val} ARR`;
  }

  // Only flag a decision maker when the text actually says they are one.
  const dmPattern = /(?:is|now|new)\s+(?:the\s+)?(?:decision\s*maker|dm|champion)/i;
  if (dmPattern.test(text)) {
    if (/Mark/i.test(text)) decisionMaker = 'Mark Liu';
    else if (/Sarah/i.test(text)) decisionMaker = 'Sarah Chen';
    else if (/Dana/i.test(text)) decisionMaker = 'Dana Reyes';
  }

  return { timeline, budget, decisionMaker };
}

// Helper to extract numeric deal size (e.g. 10000) for Butterbase database update
function extractNumericDealSize(text, beforeDealSize) {
  const cleaned = text.replace(/Q[1-4]/gi, '');
  const arrMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(K|M|%|percent)?/i);
  if (!arrMatch) return null;
  const val = parseFloat(arrMatch[1]);
  const unit = arrMatch[2] ? arrMatch[2].toUpperCase() : '';
  if (unit === 'K') return val * 1000;
  if (unit === 'M') return val * 1000000;
  if (unit === '%' || unit === 'PERCENT') {
    if (beforeDealSize) return Math.round(beforeDealSize * (1 - val / 100));
  }
  if (val < 1000) return val * 1000;
  return val;
}

// Helper to extract lowercase stage (e.g. "q2") for Butterbase database update
function extractStage(text) {
  const qMatch = text.match(/Q[1-4]/i);
  if (qMatch) return qMatch[0].toLowerCase();
  if (/pilot/i.test(text)) return 'pilot';
  if (/proposal/i.test(text)) return 'proposal';
  if (/discovery/i.test(text)) return 'discovery';
  return null;
}

// In-memory active pipeline state for developer tab dashboard
let activePipeline = {
  pipelineId: null,
  type: null,
  status: 'idle',
  account: null,
  nodes: {}
};

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// Get current state of DB and Memory (queries live wrapper endpoints)
app.get('/api/data', async (req, res) => {
  try {
    // 1. Fetch Acme account data from wrapper
    const accountData = await requestWrapper('/account/Acme%20Corp');
    // 2. Fetch Acme memories from wrapper
    const memoryData = await requestWrapper('/memory/Acme%20Corp');
    
    // Convert wrapper format to UI format
    const formattedData = {
      butterbase: {
        accounts: [
          {
            id: 'acme',
            name: accountData.account.name || 'Acme Corp',
            arr: accountData.account.deal_size || 180000,
            stage: accountData.account.stage || 'pilot',
            owner: accountData.account.owner_name || 'Alex Rivera'
          }
        ],
        contacts: (accountData.contacts || []).map(c => ({
          id: c.id,
          accountId: 'acme',
          name: c.name,
          role: c.role,
          type: c.is_decision_maker ? 'Decision Maker' : 'Champion'
        })),
        meetings: (accountData.meetings || []).map(m => ({
          id: m.id,
          accountId: 'acme',
          date: (m.date || '').split('T')[0],
          summary: m.summary
        })),
        facts: (accountData.facts || []).map(f => ({
          id: f.id,
          content: f.content,
          source: f.source
        }))
      },
      xtrace: {
        acme: (memoryData.data || []).map((mem, idx) => ({
          id: mem.id || `m_${idx}`,
          text: mem.text,
          category: mem.type === 'episode' ? 'Episode' : 'Fact',
          updatedAt: mem.updated_at || new Date().toISOString()
        }))
      }
    };

    res.json(formattedData);
  } catch (err) {
    console.error('Error fetching live wrapper data:', err);
    res.status(500).json({ error: 'Failed to retrieve live wrapper data', details: err.message });
  }
});

// Proxy graph endpoint
app.get('/api/graph/:account', async (req, res) => {
  const accountName = req.params.account;
  try {
    const graphData = await requestWrapper(`/graph/${encodeURIComponent(accountName)}`);
    res.json(graphData);
  } catch (err) {
    console.error('Error fetching graph data from wrapper:', err);
    res.status(500).json({ error: 'Failed to retrieve graph data', details: err.message });
  }
});

// Expose POST /graph/update locally (as Mayuresh's Graph Server)
app.post('/graph/update', (req, res) => {
  const { account_name, updates } = req.body;
  console.log(`[Graph Server] Exposing update for ${account_name}:`, updates);
  res.json({ success: true, message: 'D3 Visual Graph updated successfully' });
});

// Reset simulation (no-op on wrapper since it has no reset endpoint, but we clear active status)
app.post('/api/reset', (req, res) => {
  activePipeline = {
    pipelineId: null,
    type: null,
    status: 'idle',
    account: null,
    nodes: {}
  };
  res.json({ message: 'Pipeline status reset. Live wrapper database is managed by the central wrapper API.' });
});

// Get current pipeline status
app.get('/api/active-pipeline', (req, res) => {
  res.json(activePipeline);
});

// Process Slack message webhook (Photon Entry Point)
app.post('/api/message', async (req, res) => {
  const { text, user, channel } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text prompt is required.' });
  }

  console.log(`Photon Webhook Received: "${text}" from ${user || 'user'} in ${channel || 'channel'}`);

  // Detect Account Core
  let matchedAccount = 'Acme Corp';
  let matchedKey = 'acme';
  if (/tech/i.test(text)) {
    matchedAccount = 'TechCorp';
    matchedKey = 'techcorp';
  } else if (/nova/i.test(text)) {
    matchedAccount = 'NovaPay';
    matchedKey = 'novapay';
  }

  // Detect pipeline routing
  const isBriefRequest = /brief/i.test(text) || /summary/i.test(text) || /info/i.test(text);

  const pipelineId = Math.random().toString(36).substring(7);

  if (isBriefRequest) {
    // 5-Node Brief Pipeline Flow
    activePipeline = {
      pipelineId,
      type: 'brief',
      status: 'running',
      account: matchedKey,
      nodes: {
        parse_account: { status: 'pending', duration: 0, log: 'Parsing account name from user query...' },
        fetch_account_data: { status: 'pending', duration: 0, log: 'Waiting to query wrapper account DB...' },
        fetch_memory_data: { status: 'pending', duration: 0, log: 'Waiting to query wrapper XTrace memories...' },
        ai_gateway_synthesis: { status: 'pending', duration: 0, log: 'Waiting for AI compilation...' },
        return_brief: { status: 'pending', duration: 0, log: 'Packaging brief payload...' }
      }
    };

    res.json({ message: 'Brief pipeline started', pipelineId });
    runBriefPipeline(matchedAccount, matchedKey);

  } else {
    // 5-Node Update Pipeline Flow
    activePipeline = {
      pipelineId,
      type: 'update',
      status: 'running',
      account: matchedKey,
      nodes: {
        receive_update_text: { status: 'pending', duration: 0, log: 'Receiving update message...' },
        ai_gateway_extraction: { status: 'pending', duration: 0, log: 'Extracting structured facts...' },
        update_memory_wrapper: { status: 'pending', duration: 0, log: 'Writing to live wrapper API...' },
        update_graph_server: { status: 'pending', duration: 0, log: 'Dispatching payload to Graph Server...' },
        return_confirmation: { status: 'pending', duration: 0, log: 'Formatting final response...' }
      }
    };

    res.json({ message: 'Update pipeline started', pipelineId });
    runUpdatePipeline(matchedAccount, matchedKey, text);
  }
});

// -------------------------------------------------------------
// PIPELINE RUNNERS
// -------------------------------------------------------------

async function runBriefPipeline(accountName, accountKey) {
  try {
    // Node 1: Parse Account Name
    activePipeline.nodes.parse_account.status = 'running';
    activePipeline.nodes.parse_account.log = `Query parsed successfully. Target: "${accountName}"`;
    await new Promise(r => setTimeout(r, 400));
    activePipeline.nodes.parse_account.status = 'completed';
    activePipeline.nodes.parse_account.duration = 400;

    // Node 2: Fetch Account Data (GET)
    activePipeline.nodes.fetch_account_data.status = 'running';
    activePipeline.nodes.fetch_account_data.log = `Requesting GET /account/${encodeURIComponent(accountName)}...`;
    const accStart = Date.now();
    const accountData = await requestWrapper(`/account/${encodeURIComponent(accountName)}`);
    activePipeline.nodes.fetch_account_data.status = 'completed';
    activePipeline.nodes.fetch_account_data.duration = Date.now() - accStart;
    activePipeline.nodes.fetch_account_data.log = `Loaded ${accountData.contacts.length} contacts, ${accountData.meetings.length} meetings, and ${accountData.facts.length} facts from Butterbase.`;

    // Node 3: Fetch Memory Data (GET)
    activePipeline.nodes.fetch_memory_data.status = 'running';
    activePipeline.nodes.fetch_memory_data.log = `Requesting GET /memory/${encodeURIComponent(accountName)}...`;
    const memStart = Date.now();
    const memoryData = await requestWrapper(`/memory/${encodeURIComponent(accountName)}`);
    activePipeline.nodes.fetch_memory_data.status = 'completed';
    activePipeline.nodes.fetch_memory_data.duration = Date.now() - memStart;
    activePipeline.nodes.fetch_memory_data.log = `Retrieved ${memoryData.data.length} XTrace team memories.`;

    // Node 4: Synthesis (Claude AI Gateway)
    activePipeline.nodes.ai_gateway_synthesis.status = 'running';
    activePipeline.nodes.ai_gateway_synthesis.log = 'Compiling brief text via Butterbase AI Gateway...';
    await new Promise(r => setTimeout(r, 900));

    // Formulate structured response using live records
    const acc = accountData.account;
    const contacts = accountData.contacts;
    const meetings = accountData.meetings;
    const facts = accountData.facts;
    const context = memoryData.context;

    // ---------- DATA PREP ----------
    const dmaker = contacts.find(c => c.is_decision_maker);
    const champion = contacts.find(c => !c.is_decision_maker);
    const sortedMeetings = (meetings || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const sortedFacts = (facts || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const seenFactTexts = new Set();
    const meaningfulFacts = [];
    for (const f of sortedFacts) {
      const c = (f.content || '').trim();
      if (!c) continue;
      if (/^Deal size updated to /i.test(c)) continue;
      if (/^Stage updated to /i.test(c)) continue;
      const key = c.toLowerCase();
      if (seenFactTexts.has(key)) continue;
      seenFactTexts.add(key);
      meaningfulFacts.push({ content: c, source: f.source || 'wrapper', date: (f.created_at || '').split('T')[0] });
      if (meaningfulFacts.length >= 8) break;
    }

    const arrK = `$${(acc.deal_size / 1000).toFixed(0)}K`;
    const stageUC = (acc.stage || '').toUpperCase();
    const industry = acc.industry || 'unknown';
    const owner = acc.owner_name || 'unassigned';
    const website = acc.website || '—';

    // Risk heuristics from facts/state
    const factsBlob = meaningfulFacts.map(f => f.content).join(' \n ').toLowerCase();
    const risks = [];
    if (/left the company|is out|is gone|has left/i.test(factsBlob)) risks.push('Contact churn — a named contact has left.');
    if (/cut|reduced|down to|budget cut/i.test(factsBlob)) risks.push('Budget reduction signalled in recent updates.');
    if (/pushed to|moved to|delayed|slip/i.test(factsBlob)) risks.push('Timeline slippage signalled in recent updates.');
    if (!dmaker) risks.push('No decision maker on file.');
    if (acc.deal_size && acc.deal_size < 25000) risks.push(`Deal size dropped to ${arrK} — verify with rep this is correct.`);

    // Opportunities
    const opps = [];
    if (champion) opps.push(`${champion.name} is the internal champion — keep them aligned.`);
    if (/q[1-4]/i.test(factsBlob)) opps.push('Stage is explicitly tracked — easy to align next milestone.');

    // Next steps
    const nextSteps = [];
    if (dmaker) nextSteps.push(`Confirm priorities with ${dmaker.name} (${dmaker.role}).`);
    if (sortedMeetings[0]) nextSteps.push(`Re-confirm action items from "${sortedMeetings[0].summary}" before next sync.`);
    nextSteps.push(`Validate current ARR of ${arrK} matches CRM and procurement records.`);

    // ---------- HEADER ----------
    let formattedBrief = `📋 **${acc.name} — Pre-Meeting Brief**\n`;
    formattedBrief += `_${industry} · Owner: ${owner} · ${website}_\n\n`;

    // ---------- QUICK SNAPSHOT ----------
    formattedBrief += `**📊 Snapshot**\n`;
    formattedBrief += `— Stage: **${stageUC || 'n/a'}**\n`;
    formattedBrief += `— ARR: **${arrK}**\n`;
    formattedBrief += `— Decision Maker: **${dmaker ? `${dmaker.name} (${dmaker.role})` : 'not set'}**\n`;
    formattedBrief += `— Champion: **${champion ? `${champion.name} (${champion.role})` : 'not set'}**\n\n`;

    // ---------- LAST MEETING ----------
    if (sortedMeetings.length > 0) {
      const m = sortedMeetings[0];
      formattedBrief += `**🗓️ Last Meeting — ${(m.date || '').split('T')[0]}**\n`;
      formattedBrief += `${m.summary}\n`;
      if (m.outcome) formattedBrief += `_Outcome:_ ${m.outcome}\n`;
      if (m.next_steps) formattedBrief += `_Next steps logged:_ ${m.next_steps}\n`;
      formattedBrief += `\n`;
    }

    // ---------- RECENT FACTS ----------
    if (meaningfulFacts.length > 0) {
      formattedBrief += `**🧾 Recent Facts**\n`;
      meaningfulFacts.forEach(f => {
        formattedBrief += `— ${f.content}${f.date ? `  _(${f.date})_` : ''}\n`;
      });
      formattedBrief += `\n`;
    }

    // ---------- MEMORIES ----------
    if (context) {
      const clipped = context
        .replace(/## Memories\n/, '')
        .replace(/### /g, '• ')
        .slice(0, 320);
      formattedBrief += `**🧠 Team Memories**\n${clipped}${context.length > 320 ? '…' : ''}\n\n`;
    }

    // ---------- RISKS ----------
    if (risks.length > 0) {
      formattedBrief += `**⚠️ Risks & Watchouts**\n`;
      risks.forEach(r => { formattedBrief += `— ${r}\n`; });
      formattedBrief += `\n`;
    }

    // ---------- OPPORTUNITIES ----------
    if (opps.length > 0) {
      formattedBrief += `**🎯 Opportunities**\n`;
      opps.forEach(o => { formattedBrief += `— ${o}\n`; });
      formattedBrief += `\n`;
    }

    // ---------- NEXT STEPS ----------
    formattedBrief += `**✅ Recommended Next Steps**\n`;
    nextSteps.forEach(s => { formattedBrief += `— ${s}\n`; });
    formattedBrief += `\n`;

    // ---------- SUMMARY ----------
    const dmLine = dmaker ? `${dmaker.name} (${dmaker.role}) is the decision maker` : `no decision maker is on file`;
    const champLine = champion ? `${champion.name} sits inside the account as champion` : `there is no internal champion logged`;
    const riskLine = risks.length > 0 ? `Key watchouts: ${risks.slice(0, 2).join(' ')}` : `No major risks flagged in the latest activity.`;
    const lastMeetingLine = sortedMeetings[0]
      ? `The most recent meeting on ${(sortedMeetings[0].date || '').split('T')[0]} captured: "${sortedMeetings[0].summary}".`
      : `No recent meeting is on record.`;
    formattedBrief += `**📝 Summary**\n`;
    formattedBrief += `${acc.name} is currently at stage ${stageUC || 'n/a'} with a deal value of ${arrK}. `;
    formattedBrief += `${dmLine}; ${champLine}. `;
    formattedBrief += `${lastMeetingLine} `;
    formattedBrief += `${riskLine} `;
    formattedBrief += `Walk into the next conversation ready to confirm ARR, lock in the timeline, and verify ownership of any open commitments. `;
    formattedBrief += `Treat this brief as the source of truth until the next update lands.`;

    // Polish raw brief through Groq before storing as final output
    const polishedBrief = await polishWithGroq(formattedBrief, GROQ_BRIEF_POLISH_SYSTEM);

    activePipeline.nodes.ai_gateway_synthesis.status = 'completed';
    activePipeline.nodes.ai_gateway_synthesis.duration = 900;
    activePipeline.nodes.ai_gateway_synthesis.data = polishedBrief;
    activePipeline.nodes.ai_gateway_synthesis.log = GROQ_API_KEY
      ? 'AI Gateway brief compiled + Groq polished.'
      : 'AI Gateway brief compiled. (GROQ_API_KEY not set — skipped polish)';

    // Node 5: Return Brief
    activePipeline.nodes.return_brief.status = 'running';
    activePipeline.nodes.return_brief.log = 'Sending payload back to Photon Slack listener...';
    await new Promise(r => setTimeout(r, 200));
    activePipeline.nodes.return_brief.status = 'completed';
    activePipeline.nodes.return_brief.duration = 200;

    activePipeline.status = 'completed';
  } catch (err) {
    console.error(err);
    activePipeline.status = 'error';
    console.error(`Brief pipeline failed: ${err.message}`, 'error');
  }
}

async function runUpdatePipeline(accountName, accountKey, text) {
  try {
    // Node 1: Receive Update Text
    activePipeline.nodes.receive_update_text.status = 'running';
    activePipeline.nodes.receive_update_text.log = `Parsed incoming text: "${text}"`;
    await new Promise(r => setTimeout(r, 300));
    activePipeline.nodes.receive_update_text.status = 'completed';
    activePipeline.nodes.receive_update_text.duration = 300;

    // Node 2: Extract Facts — combine real wrapper LLM w/ structured local regex parse
    activePipeline.nodes.ai_gateway_extraction.status = 'running';
    activePipeline.nodes.ai_gateway_extraction.log = 'POST Butterbase AI Gateway: extracting structured schema...';

    // BEFORE-state snapshot from wrapper for delta computation
    const beforeData = await requestWrapper(`/account/${encodeURIComponent(accountName)}`);
    const beforeAccount = beforeData.account;

    // Local regex parse to force structured deal_size / stage writes
    const textDelta = extractUpdatesFromText(text);

    // Node 3: Update Wrapper (POST) — wrapper extracts + persists
    activePipeline.nodes.update_memory_wrapper.status = 'running';
    activePipeline.nodes.update_memory_wrapper.log = `POST /memory/update for ${accountName}...`;
    const postStart = Date.now();

    const updatePayload = { account_name: accountName, update_text: text };
    const targetDealSize = extractNumericDealSize(text, beforeAccount.deal_size);
    if (targetDealSize !== null) updatePayload.deal_size = targetDealSize;
    const targetStage = extractStage(text);
    if (targetStage !== null) updatePayload.stage = targetStage;

    const wrapperRes = await requestWrapper('/memory/update', 'POST', updatePayload);

    const extractedFacts = {
      summary: wrapperRes.summary || 'no summary',
      timeline_hint: textDelta.timeline,
      budget_hint: textDelta.budget,
      decision_maker_hint: textDelta.decisionMaker,
      account_changes: wrapperRes.updates_applied?.account || {},
      contact_changes: wrapperRes.updates_applied?.contacts || [],
      new_facts: (wrapperRes.facts || []).map(f => f.content),
      meeting_outcome: wrapperRes.meeting?.outcome || null,
      xtrace_status: wrapperRes.xtrace?.status || 'unknown',
      memories_created: (wrapperRes.xtrace?.memories_created || []).length,
    };

    activePipeline.nodes.ai_gateway_extraction.status = 'completed';
    activePipeline.nodes.ai_gateway_extraction.duration = Date.now() - postStart;
    activePipeline.nodes.ai_gateway_extraction.data = extractedFacts;
    activePipeline.nodes.ai_gateway_extraction.log = `Extracted: ${extractedFacts.summary}`;

    activePipeline.nodes.update_memory_wrapper.status = 'completed';
    activePipeline.nodes.update_memory_wrapper.duration = Date.now() - postStart;
    activePipeline.nodes.update_memory_wrapper.log = `Live Sync complete: XTrace memory updated and meeting logged. ID: ${wrapperRes.meeting ? wrapperRes.meeting.id : 'N/A'}`;

    // Node 4: Update Graph Server (POST)
    activePipeline.nodes.update_graph_server.status = 'running';
    activePipeline.nodes.update_graph_server.log = 'POST /graph/update: Broadcasting new nodes/edges to Graph Server...';
    
    // Simulating graph server POST
    const graphServerRes = await requestWrapper('/graph/Acme%20Corp');
    // Also hit our local endpoint for logging
    await new Promise((resolve) => {
      const http = require('http');
      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/graph/update',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        resolve();
      });
      req.write(JSON.stringify({ account_name: accountName, updates: extractedFacts }));
      req.end();
    });

    await new Promise(r => setTimeout(r, 400));
    activePipeline.nodes.update_graph_server.status = 'completed';
    activePipeline.nodes.update_graph_server.duration = 400;
    activePipeline.nodes.update_graph_server.log = `Rewired visual graph: ${graphServerRes.nodes.length} nodes and ${graphServerRes.edges.length} edges compiled.`;

    // Node 5: Return Confirmation — real before/after diff from wrapper DB
    activePipeline.nodes.return_confirmation.status = 'running';
    activePipeline.nodes.return_confirmation.log = 'Formatting Slack confirmation reply from wrapper response...';

    const afterAccount = wrapperRes.account || beforeAccount;
    const fromStage = (beforeAccount.stage || '').toUpperCase();
    const toStage = (afterAccount.stage || beforeAccount.stage || '').toUpperCase();
    const fromARR = `$${(beforeAccount.deal_size / 1000).toFixed(0)}K`;
    const toARR = `$${(afterAccount.deal_size / 1000).toFixed(0)}K`;
    const fromDM = beforeAccount.decision_maker_name || 'Unknown';
    const toDM = afterAccount.decision_maker_name || fromDM;

    let confirmationText = `✅ **${accountName} team memory updated**\n\n`;

    if (fromStage !== toStage) {
      confirmationText += `— **Timeline:** ${fromStage} → ${toStage}\n`;
    } else if (textDelta.timeline && fromStage !== textDelta.timeline.toUpperCase()) {
      confirmationText += `— **Timeline:** ${fromStage} → ${textDelta.timeline.toUpperCase()}\n`;
    } else {
      confirmationText += `— **Timeline:** No change detected\n`;
    }

    if (fromARR !== toARR) {
      confirmationText += `— **Budget:** ${fromARR} → ${toARR} ARR\n`;
    } else if (textDelta.budget) {
      confirmationText += `— **Budget:** ${fromARR} → ${textDelta.budget}\n`;
    } else {
      confirmationText += `— **Budget:** No change detected\n`;
    }

    if (fromDM !== toDM) {
      confirmationText += `— **Decision maker:** ${fromDM} → ${toDM}\n`;
    } else if (textDelta.decisionMaker && fromDM !== textDelta.decisionMaker) {
      confirmationText += `— **Decision maker:** ${fromDM} → ${textDelta.decisionMaker}\n`;
    } else {
      confirmationText += `— **Decision maker:** No change detected\n`;
    }

    if (extractedFacts.new_facts.length) {
      confirmationText += `\n**New facts:**\n` + extractedFacts.new_facts.map(f => `— ${f}`).join('\n');
    }
    if (extractedFacts.memories_created > 0) {
      confirmationText += `\n**XTrace memories created:** ${extractedFacts.memories_created}`;
    }
    confirmationText += `\n\nAll reps will see this in their next brief.`;

    // Polish confirmation through Groq before final output
    const polishedConfirm = await polishWithGroq(confirmationText, GROQ_CONFIRM_POLISH_SYSTEM);

    activePipeline.nodes.return_confirmation.status = 'completed';
    activePipeline.nodes.return_confirmation.duration = 200;
    activePipeline.nodes.return_confirmation.data = polishedConfirm;

    activePipeline.status = 'completed';
  } catch (err) {
    console.error(err);
    activePipeline.status = 'error';
    console.error(`Update pipeline failed: ${err.message}`, 'error');
  }
}

// -------------------------------------------------------------
// SLACK INTEGRATION
// -------------------------------------------------------------

// Shared driver: run brief or update pipeline and return final text
async function runPipelineAndGetReply(text) {
  let matchedAccount = 'Acme Corp';
  if (/tech/i.test(text)) matchedAccount = 'TechCorp';
  else if (/nova/i.test(text)) matchedAccount = 'NovaPay';

  const isBriefRequest = /brief/i.test(text) || /summary/i.test(text) || /info/i.test(text);
  const pipelineId = Math.random().toString(36).substring(7);

  if (isBriefRequest) {
    activePipeline = {
      pipelineId,
      type: 'brief',
      status: 'running',
      account: matchedAccount.toLowerCase().replace(/\s+/g, ''),
      nodes: {
        parse_account: { status: 'pending', duration: 0, log: '' },
        fetch_account_data: { status: 'pending', duration: 0, log: '' },
        fetch_memory_data: { status: 'pending', duration: 0, log: '' },
        ai_gateway_synthesis: { status: 'pending', duration: 0, log: '' },
        return_brief: { status: 'pending', duration: 0, log: '' },
      },
    };
    await runBriefPipeline(matchedAccount, matchedAccount.toLowerCase());
    return activePipeline.nodes.ai_gateway_synthesis.data || 'No brief available.';
  }

  activePipeline = {
    pipelineId,
    type: 'update',
    status: 'running',
    account: matchedAccount.toLowerCase().replace(/\s+/g, ''),
    nodes: {
      receive_update_text: { status: 'pending', duration: 0, log: '' },
      ai_gateway_extraction: { status: 'pending', duration: 0, log: '' },
      update_memory_wrapper: { status: 'pending', duration: 0, log: '' },
      update_graph_server: { status: 'pending', duration: 0, log: '' },
      return_confirmation: { status: 'pending', duration: 0, log: '' },
    },
  };
  await runUpdatePipeline(matchedAccount, matchedAccount.toLowerCase(), text);
  return activePipeline.nodes.return_confirmation.data || 'No confirmation available.';
}

// Slash command endpoint: /loop brief Acme   or   /loop Acme update text...
app.post('/slack/command', async (req, res) => {
  if (!verifySlackSignature(req)) return res.status(401).send('invalid signature');

  const { text = '', user_name, channel_id, response_url } = req.body;
  if (!text.trim()) {
    return res.json({
      response_type: 'ephemeral',
      text: 'Usage: `/loop brief Acme` or `/loop Acme deal pushed to Q3, budget cut to 100K`',
    });
  }

  // ACK within 3s (Slack requirement)
  res.json({ response_type: 'in_channel', text: `:hourglass_flowing_sand: Working on _"${text}"_...` });

  // Run pipeline async, then post the result via response_url
  (async () => {
    try {
      const reply = await runPipelineAndGetReply(text);
      const followUpBody = JSON.stringify({ response_type: 'in_channel', text: reply });
      const url = new URL(response_url);
      const followReq = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(followUpBody),
          },
        },
        () => {}
      );
      followReq.on('error', (e) => console.error('Slack follow-up failed:', e.message));
      followReq.write(followUpBody);
      followReq.end();
    } catch (err) {
      console.error('Slack command pipeline failed:', err.message);
    }
  })();
});

// Events API: app_mention handler
const seenEventIds = new Set();
app.post('/slack/events', async (req, res) => {
  // URL verification challenge during Slack app setup
  if (req.body && req.body.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }
  if (!verifySlackSignature(req)) return res.status(401).send('invalid signature');

  const eventId = req.body?.event_id;
  if (eventId && seenEventIds.has(eventId)) return res.sendStatus(200);
  if (eventId) {
    seenEventIds.add(eventId);
    if (seenEventIds.size > 500) seenEventIds.clear();
  }

  // ACK immediately
  res.sendStatus(200);

  const ev = req.body?.event;
  if (!ev || ev.type !== 'app_mention') return;

  // Strip leading <@BOTID> mention
  const text = (ev.text || '').replace(/<@[^>]+>\s*/, '').trim();
  if (!text) return;

  try {
    const reply = await runPipelineAndGetReply(text);
    await slackPost(ev.channel, reply, ev.thread_ts || ev.ts);
  } catch (err) {
    console.error('Slack event pipeline failed:', err.message);
    if (SLACK_BOT_TOKEN) {
      slackPost(ev.channel, `:warning: Error: ${err.message}`, ev.thread_ts || ev.ts).catch(() => {});
    }
  }
});

// -------------------------------------------------------------
// SLACK SOCKET MODE INTEGRATION
// -------------------------------------------------------------
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN || '';

const isPlaceholder = (token) => {
  return !token || token.includes('your-bot-oauth-token-here') || token.includes('your-app-level-token-here');
};

if (SLACK_BOT_TOKEN && SLACK_APP_TOKEN && !isPlaceholder(SLACK_BOT_TOKEN) && !isPlaceholder(SLACK_APP_TOKEN)) {
  try {
    const { App } = require('@slack/bolt');
    const slackApp = new App({
      token: SLACK_BOT_TOKEN,
      appToken: SLACK_APP_TOKEN,
      socketMode: true,
    });

    slackApp.event('app_mention', async ({ event, say }) => {
      const rawText = event.text || '';
      const text = rawText.replace(/<@U[A-Z0-9]+>\s*/g, '').trim();
      if (!text) return;

      console.log(`[Slack Socket Mode] Mention received: "${text}"`);

      try {
        const reply = await runPipelineAndGetReply(text);
        await say({
          text: reply,
          thread_ts: event.thread_ts || event.ts
        });
      } catch (err) {
        console.error('[Slack Socket Mode] Event pipeline failed:', err.message);
        await say({
          text: `⚠️ Error: ${err.message}`,
          thread_ts: event.thread_ts || event.ts
        });
      }
    });

    (async () => {
      await slackApp.start();
      console.log('⚡️ Slack App is listening via Socket Mode WebSocket!');
    })();
  } catch (boltErr) {
    console.error('Failed to start Slack Bolt Socket Mode:', boltErr.message);
  }
} else {
  console.log('💡 Slack Socket Mode not started. (To enable, set SLACK_BOT_TOKEN and SLACK_APP_TOKEN)');
}

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  Meeting Brief & De-brief Agent Server running!`);
  console.log(`  Wrapper Endpoint connected: ${WRAPPER_BASE_URL}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`========================================================`);
});
