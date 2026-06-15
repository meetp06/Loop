import {
  Sparkles, Database, Brain, ArrowUpRight,
  MessageSquare, Share2, Check,
} from 'lucide-react';

/* ------------------------------------------------------------------ *
 *  Pipeline node definitions & brief data for the interactive demo
 * ------------------------------------------------------------------ */

export const BRIEF_PIPE = [
  { id: 'parse',   label: 'Parse account name',          sub: '→ "Acme Corp"',                       icon: Sparkles },
  { id: 'account', label: 'GET /account/Acme Corp',      sub: 'account · contacts · meetings · facts', icon: Database },
  { id: 'memory',  label: 'GET /memory/Acme Corp',       sub: 'active XTrace team memories',           icon: Brain },
  { id: 'ai',      label: 'POST Butterbase AI Gateway',  sub: '"write a sharp pre-meeting brief"',     icon: Sparkles },
  { id: 'return',  label: 'Return brief → Photon',       sub: 'formatted for Slack',                   icon: ArrowUpRight },
];

export const UPDATE_PIPE = [
  { id: 'recv',     label: 'Receive freeform update',      sub: 'plain-English message',                icon: MessageSquare },
  { id: 'extract',  label: 'POST Butterbase AI Gateway',   sub: 'extract JSON: timeline · budget · DM · risks', icon: Sparkles },
  { id: 'memwrite', label: 'POST /memory/update',          sub: 'XTrace + Butterbase, simultaneously',  icon: Database },
  { id: 'graph',    label: 'POST /graph/update',           sub: 'graph rewires live →',                 icon: Share2, hot: true },
  { id: 'confirm',  label: 'Return confirmation → Photon', sub: 'diff summary',                         icon: Check },
];

// Default fallback brief objects for the standardized demo sequence
export const BRIEF_V1 = {
  version: 1,
  last: 'Last meeting (May 12): agreed on Q2 pilot. Sarah (CTO) requested a security audit before sign-off — action item on our side still open.',
  contacts: [
    { n: 'Sarah Chen', r: 'CTO · decision maker' },
    { n: 'Mark Liu', r: 'Champion' },
  ],
  contract: 'Net-30 terms. Clause 4.2 flags auto-renewal — worth raising if they push on pricing.',
  risk: 'Security audit not delivered yet. Open commitment → address first.',
  deal: '$180K ARR · pilot phase',
  changed: {},
};

export const BRIEF_V2 = {
  version: 2,
  last: 'Meeting on Jun 5: account pushed everything to Q3 and cut budget 20%. Sarah has left; Mark is now the decision maker.',
  contacts: [{ n: 'Mark Liu', r: 'CTO · decision maker', hot: true }],
  contract: 'Net-30 terms. Clause 4.2 flags auto-renewal — worth raising if they push on pricing.',
  risk: 'New decision maker mid-cycle. Re-confirm the audit commitment with Mark before Q3.',
  deal: '$144K ARR · pilot phase',
  changed: { last: true, contacts: true, risk: true, deal: true },
};

/**
 * Builds the initial knowledge graph nodes and links.
 */
export function buildInitialGraph() {
  const nodes = [{ id: 'acme', type: 'account', label: 'Acme Corp' }];
  const links = [];

  const add = (id, type, label, parent) => {
    nodes.push({ id, type, label });
    if (parent) links.push({ source: parent, target: id });
  };

  // Contacts
  add('sarah', 'contact', 'Sarah Chen', 'acme');
  add('mark', 'contact', 'Mark Liu', 'acme');
  add('dana', 'contact', 'Dana Reyes', 'acme');

  // Meetings
  add('mtg_may', 'meeting', 'May 12', 'acme');
  add('mtg_apr', 'meeting', 'Apr 3', 'acme');
  add('mtg_mar', 'meeting', 'Mar 10', 'acme');
  add('mtg_feb', 'meeting', 'Feb 20', 'acme');

  // Facts
  add('f_arr', 'fact', '$180K ARR', 'acme');
  add('f_pilot', 'fact', 'Q2 pilot', 'acme');
  add('f_net30', 'fact', 'Net-30', 'acme');
  add('f_clause', 'fact', 'Clause 4.2', 'acme');
  add('f_audit', 'fact', 'Security audit', 'acme');

  // Memories
  add('m1', 'memory', 'prefers async demos', 'acme');
  add('m2', 'memory', 'board approved budget', 'acme');
  add('m3', 'memory', 'evaluating Globex', 'acme');
  add('m4', 'memory', 'Sarah ex-Stripe', 'sarah');
  add('m5', 'memory', 'wants SOC2', 'acme');
  add('m6', 'memory', 'slow on legal', 'acme');
  add('m7', 'memory', 'Mark owns infra', 'mark');
  add('m8', 'memory', 'price-sensitive', 'acme');
  add('m9', 'memory', 'renewal in Nov', 'acme');
  add('m10', 'memory', 'champion: Mark', 'mark');
  add('m11', 'memory', 'EU data concerns', 'acme');
  add('m12', 'memory', 'intro via RevOps', 'dana');
  add('m13', 'memory', 'QBR cadence', 'acme');

  return { nodes, links };
}

/**
 * Basic client-side keyword rule parser for Offline Simulation Mode.
 * Takes the text message and current nodes, returns graph changes.
 */
export function mockNLPUpdate(text, currentNodes) {
  const normalized = text.toLowerCase();
  const nodesToAdd = [];
  const nodesToRemove = [];
  let agentMessage = "I've processed that update.";

  // 1. Check for budget / revenue updates
  const budgetMatch = text.match(/(?:budget|arr|\$)\s*(?:cut|decreased|to|is|worth)?\s*\$?([0-9]+k?)/i);
  if (budgetMatch) {
    const amount = budgetMatch[1];
    nodesToAdd.push({
      id: `u_budget_${Date.now()}`,
      type: 'newmem',
      label: `Budget: $${amount.toUpperCase()}`,
      parent: 'acme'
    });
    // Remove old ARR fact if present
    const oldArr = currentNodes.find(n => n.id === 'f_arr');
    if (oldArr) nodesToRemove.push(oldArr.id);
    agentMessage = `Updated Acme's budget/ARR details to $${amount.toUpperCase()} in their profile.`;
  }

  // 2. Check for Sarah leaving / Mark becoming decision maker
  if (normalized.includes('sarah') && (normalized.includes('leave') || normalized.includes('left') || normalized.includes('out') || normalized.includes('departed'))) {
    const sarahNode = currentNodes.find(n => n.id === 'sarah');
    if (sarahNode) {
      nodesToRemove.push('sarah');
      // Also remove Sarah's specific memory nodes
      currentNodes.forEach(n => {
        if (n.parent === 'sarah') nodesToRemove.push(n.id);
      });
      agentMessage = "Removed Sarah Chen from the active contacts list and cleaned up linked notes.";
    }
  }

  if (normalized.includes('mark') && (normalized.includes('decision') || normalized.includes('maker') || normalized.includes('cto') || normalized.includes('head') || normalized.includes('lead'))) {
    nodesToAdd.push({
      id: `u_mark_role_${Date.now()}`,
      type: 'newmem',
      label: 'Mark Liu: Decision Maker',
      parent: 'mark'
    });
    agentMessage = (agentMessage.includes('Removed Sarah') ? agentMessage + ' ' : '') + "Promoted Mark Liu to Decision Maker in the knowledge graph.";
  }

  // 3. Check for timeline shift
  const qMatch = text.match(/q[1-4]/i);
  if (qMatch) {
    const qName = qMatch[0].toUpperCase();
    nodesToAdd.push({
      id: `u_time_${Date.now()}`,
      type: 'newmem',
      label: `Timeline: ${qName}`,
      parent: 'acme'
    });
    agentMessage = (agentMessage.includes('Promoted') || agentMessage.includes('Removed') ? agentMessage + ' ' : '') + `Shifted target timeline to ${qName}.`;
  }

  // 4. Fallback if no rules matched
  if (nodesToAdd.length === 0 && nodesToRemove.length === 0) {
    // Attempt to extract a short memory snippet
    let phrase = text;
    if (phrase.length > 30) {
      phrase = phrase.substring(0, 27) + '...';
    }
    nodesToAdd.push({
      id: `u_mem_${Date.now()}`,
      type: 'newmem',
      label: phrase,
      parent: 'acme'
    });
    agentMessage = `Added new team memory node: "${phrase}" to Acme Corp.`;
  }

  return { nodesToAdd, nodesToRemove, agentMessage };
}

/**
 * Standard Google Gemini system prompt instructions
 */
export const GEMINI_UPDATE_SYSTEM_PROMPT = `
You are a structured entity extractor for "loop", a meeting brief AI agent. Your job is to extract new entities, relationships, or deletions from a text update about a company called 'Acme Corp'.

The current set of nodes in the knowledge graph is provided in the prompt.
Given the text message, output a JSON object representing the modifications to make to the graph, containing:
1. "nodesToAdd": An array of new node objects. Each node has:
   - "id": a unique string (e.g. 'u_' + random characters)
   - "type": must be 'newmem' (for general memories) or 'contact' (if a new person is mentioned)
   - "label": a short summary phrase (e.g., 'Budget: $150K', 'John Doe: CTO', 'prefers Zoom')
   - "parent": the ID of the node it connects to (typically 'acme', or 'mark' / 'sarah' if it's about a specific contact)
2. "nodesToRemove": An array of node IDs (e.g. 'sarah', 'f_arr') that should be deleted because they are outdated.
3. "agentMessage": A friendly one-sentence confirmation summarizing the changes (e.g. "I've recorded that Sarah has left and Mark is the new decision maker.").

Respond strictly with valid JSON. Do not include markdown code block formatting like \`\`\`json.
`;

export const GEMINI_BRIEF_SYSTEM_PROMPT = `
You are "loop", a pre-meeting brief assistant. Generate a brief card for the company "Acme Corp" based on the current state of the knowledge graph.
You will be given the list of nodes and links.

Synthesize this data into a structured brief. Try to note what has changed recently (nodes of type 'newmem' contain the latest updates).

Format your response as a JSON object matching this schema:
{
  "last": "One sentence summarizing the latest updates/status of the account.",
  "contacts": [
     { "n": "Contact Name", "r": "Role / Details" }
  ],
  "contract": "One sentence summarizing contract/pricing facts.",
  "risk": "One sentence highlighting current risks (e.g., new decision maker, security audit outstanding).",
  "deal": "Short description of the deal (e.g., '$144K ARR · pilot phase')."
}

Respond strictly with valid JSON. Do not include markdown code block formatting like \`\`\`json.
`;
