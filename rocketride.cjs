/**
 * rocketride.js — RocketRide client wrapper for the Loop agent.
 *
 * Initializes a persistent RocketRideClient connection to RocketRide Cloud
 * (or a local/self-hosted engine) and exposes two functions:
 *   - runBriefPipeline(accountName)   → returns polished brief text
 *   - runUpdatePipeline(accountName, updateText) → returns polished confirmation text
 *
 * The client uses WebSocket + DAP protocol under the hood. Pipeline definitions
 * are loaded from ./pipelines/*.pipe (portable JSON).
 *
 * Env vars:
 *   ROCKETRIDE_URI     — Engine URI (default: ws://localhost:5565)
 *   ROCKETRIDE_APIKEY  — API key for RocketRide Cloud
 *   GROQ_API_KEY       — Passed into pipeline via env substitution
 *   GROQ_MODEL         — Model name (default: llama-3.3-70b-versatile)
 *   WRAPPER_BASE_URL   — Butterbase/XTrace wrapper URL
 */

const { RocketRideClient, Question } = require('rocketride');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROCKETRIDE_URI = process.env.ROCKETRIDE_URI || 'ws://localhost:5565';
const ROCKETRIDE_APIKEY = process.env.ROCKETRIDE_APIKEY || '';

const BRIEF_PIPE_PATH = path.join(__dirname, 'pipelines', 'brief.pipe');
const UPDATE_PIPE_PATH = path.join(__dirname, 'pipelines', 'update.pipe');

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let client = null;
let isConnected = false;

// Event listeners for pipeline status (consumed by dashboard)
const eventListeners = [];

function onPipelineEvent(callback) {
  eventListeners.push(callback);
  return () => {
    const idx = eventListeners.indexOf(callback);
    if (idx >= 0) eventListeners.splice(idx, 1);
  };
}

function emitEvent(event) {
  eventListeners.forEach((cb) => {
    try { cb(event); } catch (e) { console.error('Event listener error:', e); }
  });
}

async function getClient() {
  if (client && isConnected) return client;

  client = new RocketRideClient({
    auth: ROCKETRIDE_APIKEY,
    uri: ROCKETRIDE_URI,
    persist: true,
    maxRetryTime: 30000,
    requestTimeout: 60000,
    env: {
      ROCKETRIDE_APIKEY,
      ROCKETRIDE_URI,
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      WRAPPER_BASE_URL: process.env.WRAPPER_BASE_URL || 'https://submammary-correlatively-irma.ngrok-free.dev',
    },
    onConnected: async () => {
      isConnected = true;
      console.log('[RocketRide] Connected to', ROCKETRIDE_URI);
    },
    onDisconnected: async (reason) => {
      isConnected = false;
      console.log('[RocketRide] Disconnected:', reason);
    },
    onConnectError: (msg) => {
      console.error('[RocketRide] Connection error:', msg);
    },
    onEvent: async (event) => {
      emitEvent(event);
    },
  });

  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------
// Pipeline runners
// ---------------------------------------------------------------------------

/**
 * Run the Brief pipeline for a given account.
 *
 * @param {string} accountName — e.g. "Acme Corp"
 * @returns {Promise<string>} — polished brief text
 */
async function runBriefPipeline(accountName) {
  const c = await getClient();

  const { token } = await c.use({
    filepath: BRIEF_PIPE_PATH,
    // Non-ROCKETRIDE_* env is dropped by the client's env filter unless passed
    // explicitly here (use() does Object.assign(rocketEnv, env) after the filter).
    env: {
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      WRAPPER_BASE_URL: process.env.WRAPPER_BASE_URL || 'https://submammary-correlatively-irma.ngrok-free.dev',
    },
  });

  try {
    // Subscribe to status events for the dashboard
    await c.setEvents(token, [
      'apaevt_status_processing',
      'apaevt_status_upload',
    ]);

    // Send the account name as input to the webhook source
    const payload = JSON.stringify({ account_name: accountName });
    const result = await c.send(token, payload, { name: 'input.json' }, 'application/json');

    // Extract the brief text from the pipeline result
    if (result && result.data) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }

    // Fallback: poll for completion
    let status = await c.getTaskStatus(token);
    let attempts = 0;
    while (!status.completed && attempts < 60) {
      await new Promise((r) => setTimeout(r, 500));
      status = await c.getTaskStatus(token);
      attempts++;
    }

    return result?.data || result?.body?.text || 'No brief generated.';
  } finally {
    await c.terminate(token).catch(() => {});
  }
}

/**
 * Run the Update pipeline for a given account with freeform text.
 *
 * @param {string} accountName — e.g. "Acme Corp"
 * @param {string} updateText — freeform update message
 * @returns {Promise<string>} — polished confirmation text
 */
async function runUpdatePipeline(accountName, updateText) {
  const c = await getClient();

  const { token } = await c.use({
    filepath: UPDATE_PIPE_PATH,
    // Non-ROCKETRIDE_* env is dropped by the client's env filter unless passed
    // explicitly here (use() does Object.assign(rocketEnv, env) after the filter).
    env: {
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      WRAPPER_BASE_URL: process.env.WRAPPER_BASE_URL || 'https://submammary-correlatively-irma.ngrok-free.dev',
    },
  });

  try {
    // Subscribe to status events for the dashboard
    await c.setEvents(token, [
      'apaevt_status_processing',
      'apaevt_status_upload',
    ]);

    // Send account name + update text as input
    const payload = JSON.stringify({
      account_name: accountName,
      update_text: updateText,
    });
    const result = await c.send(token, payload, { name: 'input.json' }, 'application/json');

    // Extract the confirmation text from the pipeline result
    if (result && result.data) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }

    // Fallback: poll for completion
    let status = await c.getTaskStatus(token);
    let attempts = 0;
    while (!status.completed && attempts < 60) {
      await new Promise((r) => setTimeout(r, 500));
      status = await c.getTaskStatus(token);
      attempts++;
    }

    return result?.data || result?.body?.text || 'No confirmation generated.';
  } finally {
    await c.terminate(token).catch(() => {});
  }
}

/**
 * Get the current task status for a running pipeline.
 * Used by the dashboard to show pipeline progress.
 *
 * @param {string} token — task token from use()
 * @returns {Promise<object>} — task status object
 */
async function getTaskStatus(token) {
  const c = await getClient();
  return c.getTaskStatus(token);
}

/**
 * Disconnect from the RocketRide engine.
 * Call on server shutdown.
 */
async function disconnect() {
  if (client) {
    await client.disconnect().catch(() => {});
    client = null;
    isConnected = false;
  }
}

module.exports = {
  runBriefPipeline,
  runUpdatePipeline,
  getTaskStatus,
  disconnect,
  onPipelineEvent,
  getClient,
};
