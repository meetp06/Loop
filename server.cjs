const express = require('express');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const rocketride = require('./rocketride.cjs');

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

const WRAPPER_BASE_URL = process.env.WRAPPER_BASE_URL || 'https://submammary-correlatively-irma.ngrok-free.dev';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// NOTE: Groq system prompts and callGroqText/polishWithGroq have been moved
// into RocketRide pipeline nodes (llm_openai_api + prompt nodes in .pipe files).
// See pipelines/brief.pipe and pipelines/update.pipe for the prompt configs.

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
    await new Promise(r => setTimeout(r, 200));
    activePipeline.nodes.parse_account.status = 'completed';
    activePipeline.nodes.parse_account.duration = 200;

    // Nodes 2-4: Delegated to RocketRide pipeline (fetch data + LLM synthesis)
    activePipeline.nodes.fetch_account_data.status = 'running';
    activePipeline.nodes.fetch_account_data.log = `RocketRide pipeline: fetching account data...`;
    activePipeline.nodes.fetch_memory_data.status = 'running';
    activePipeline.nodes.fetch_memory_data.log = `RocketRide pipeline: fetching memory data...`;
    activePipeline.nodes.ai_gateway_synthesis.status = 'running';
    activePipeline.nodes.ai_gateway_synthesis.log = 'RocketRide pipeline: compiling brief via Groq LLM...';

    const pipeStart = Date.now();
    const polishedBrief = await rocketride.runBriefPipeline(accountName);
    const pipeDuration = Date.now() - pipeStart;

    // Mark intermediate nodes as completed
    activePipeline.nodes.fetch_account_data.status = 'completed';
    activePipeline.nodes.fetch_account_data.duration = Math.round(pipeDuration * 0.2);
    activePipeline.nodes.fetch_account_data.log = 'Account data fetched via RocketRide tool_http_request node.';

    activePipeline.nodes.fetch_memory_data.status = 'completed';
    activePipeline.nodes.fetch_memory_data.duration = Math.round(pipeDuration * 0.2);
    activePipeline.nodes.fetch_memory_data.log = 'Memory data fetched via RocketRide tool_http_request node.';

    activePipeline.nodes.ai_gateway_synthesis.status = 'completed';
    activePipeline.nodes.ai_gateway_synthesis.duration = Math.round(pipeDuration * 0.5);
    activePipeline.nodes.ai_gateway_synthesis.data = polishedBrief;
    activePipeline.nodes.ai_gateway_synthesis.log = 'Brief compiled + Groq polished via RocketRide llm_openai_api node.';

    // Node 5: Return Brief
    activePipeline.nodes.return_brief.status = 'running';
    activePipeline.nodes.return_brief.log = 'Sending payload back to Photon Slack listener...';
    await new Promise(r => setTimeout(r, 100));
    activePipeline.nodes.return_brief.status = 'completed';
    activePipeline.nodes.return_brief.duration = 100;

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
    await new Promise(r => setTimeout(r, 200));
    activePipeline.nodes.receive_update_text.status = 'completed';
    activePipeline.nodes.receive_update_text.duration = 200;

    // Nodes 2-4: Delegated to RocketRide pipeline (extraction + update + confirmation)
    activePipeline.nodes.ai_gateway_extraction.status = 'running';
    activePipeline.nodes.ai_gateway_extraction.log = 'RocketRide pipeline: extracting structured facts via Groq LLM...';
    activePipeline.nodes.update_memory_wrapper.status = 'running';
    activePipeline.nodes.update_memory_wrapper.log = `RocketRide pipeline: POST /memory/update for ${accountName}...`;

    const pipeStart = Date.now();
    const polishedConfirm = await rocketride.runUpdatePipeline(accountName, text);
    const pipeDuration = Date.now() - pipeStart;

    activePipeline.nodes.ai_gateway_extraction.status = 'completed';
    activePipeline.nodes.ai_gateway_extraction.duration = Math.round(pipeDuration * 0.3);
    activePipeline.nodes.ai_gateway_extraction.log = 'Facts extracted via RocketRide llm_openai_api + prompt nodes.';

    activePipeline.nodes.update_memory_wrapper.status = 'completed';
    activePipeline.nodes.update_memory_wrapper.duration = Math.round(pipeDuration * 0.3);
    activePipeline.nodes.update_memory_wrapper.log = 'Live Sync complete via RocketRide tool_http_request node.';

    // Node 4: Update Graph Server (POST) — still calls local/wrapper graph endpoint
    activePipeline.nodes.update_graph_server.status = 'running';
    activePipeline.nodes.update_graph_server.log = 'POST /graph/update: Broadcasting new nodes/edges to Graph Server...';

    // Fetch updated graph from wrapper
    let graphNodeCount = 0;
    let graphEdgeCount = 0;
    try {
      const graphServerRes = await requestWrapper('/graph/Acme%20Corp');
      graphNodeCount = graphServerRes.nodes?.length || 0;
      graphEdgeCount = graphServerRes.edges?.length || 0;

      // Also hit our local endpoint for logging
      await new Promise((resolve) => {
        const http = require('http');
        const req = http.request({
          hostname: 'localhost',
          port: PORT,
          path: '/graph/update',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, () => resolve());
        req.on('error', () => resolve());
        req.write(JSON.stringify({ account_name: accountName, updates: { source: 'rocketride_pipeline' } }));
        req.end();
      });
    } catch (graphErr) {
      console.error('Graph update failed (non-fatal):', graphErr.message);
    }

    await new Promise(r => setTimeout(r, 200));
    activePipeline.nodes.update_graph_server.status = 'completed';
    activePipeline.nodes.update_graph_server.duration = 200;
    activePipeline.nodes.update_graph_server.log = `Rewired visual graph: ${graphNodeCount} nodes and ${graphEdgeCount} edges compiled.`;

    // Node 5: Return Confirmation
    activePipeline.nodes.return_confirmation.status = 'running';
    activePipeline.nodes.return_confirmation.log = 'Formatting Slack confirmation reply from RocketRide pipeline...';
    await new Promise(r => setTimeout(r, 100));
    activePipeline.nodes.return_confirmation.status = 'completed';
    activePipeline.nodes.return_confirmation.duration = 100;
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
  console.log(`  RocketRide Engine: ${process.env.ROCKETRIDE_URI || 'ws://localhost:5565'}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`========================================================`);
});

// Graceful shutdown: disconnect RocketRide client
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await rocketride.disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await rocketride.disconnect();
  process.exit(0);
});
