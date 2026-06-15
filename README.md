# 🔁 Loop — Meeting Brief & De-brief Agent

> An AI agent that **briefs you before every meeting**, **learns from you after**, and **rewrites the team's shared memory in real time** — right inside Slack.

Built at **HackWithBay3** 🚀

---

## 🧠 What is Loop?

Sales teams drown in stale CRM notes, scattered Slack threads, and forgotten meeting context. **Loop** solves this by acting as an always-on memory layer for your accounts:

- **Pre-Meeting Briefs** — `/loop brief Acme` instantly generates a structured brief with deal snapshot, key contacts, recent activity, risks, and recommended next steps.
- **Post-Meeting De-briefs** — `/loop Acme deal pushed to Q3, budget cut to 100K` extracts structured facts, updates the shared memory, and confirms what changed.
- **Live Knowledge Graph** — A D3-powered interactive graph visualizes every account's relationships — contacts, meetings, facts, and memory connections in real time.

Every update flows through a **5-node agent pipeline** visible in the developer dashboard, so you always know what the AI is doing.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Slack Bot   │────▶│  Express Server  │────▶│  Wrapper API     │
│  (Socket     │     │  (Photon Entry)  │     │  (Butterbase DB  │
│   Mode)      │◀────│                  │◀────│   + XTrace Mem)  │
└─────────────┘     └───────┬──────────┘     └──────────────────┘
                            │
                    ┌───────▼──────────┐
                    │  Groq LLM        │
                    │  (Polish Layer)  │
                    └──────────────────┘
                            │
                    ┌───────▼──────────┐
                    │  React Dashboard │
                    │  + D3 Graph Viz  │
                    └──────────────────┘
```

### Pipeline Flows

**Brief Pipeline (5 Nodes):**
1. `parse_account` → Extract account name from query
2. `fetch_account_data` → Query Butterbase DB via wrapper
3. `fetch_memory_data` → Query XTrace team memories
4. `ai_gateway_synthesis` → Compile & polish brief with Groq
5. `return_brief` → Deliver to Slack

**Update Pipeline (5 Nodes):**
1. `receive_update_text` → Parse incoming message
2. `ai_gateway_extraction` → Extract structured facts
3. `update_memory_wrapper` → Persist to wrapper API
4. `update_graph_server` → Broadcast to graph visualization
5. `return_confirmation` → Confirm changes in Slack

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4 |
| **Visualization** | D3.js (force-directed knowledge graph) |
| **Backend** | Express 5 (Node.js) |
| **AI/LLM** | Groq API (LLaMA 3.3 70B) |
| **Chat Integration** | Slack Bolt (Socket Mode) |
| **Database** | Butterbase (via wrapper API) |
| **Memory** | XTrace (episodic + fact memory) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A **Slack workspace** with a bot app configured
- **Groq API** key (free at [console.groq.com](https://console.groq.com))

### 1. Clone the repo

```bash
git clone https://github.com/meetp06/hackwithbay3.git
cd hackwithbay3
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the root:

```env
# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# AI Provider
GROQ_API_KEY=gsk_your-groq-api-key
```

### 4. Run the app

```bash
# Terminal 1 — Start the backend server
npm start

# Terminal 2 — Start the frontend dev server
npm run dev
```

- **Dashboard**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:3000](http://localhost:3000)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Fetch live account data + memories |
| `GET` | `/api/graph/:account` | Get knowledge graph for an account |
| `GET` | `/api/active-pipeline` | Current pipeline execution status |
| `POST` | `/api/message` | Trigger brief or update pipeline |
| `POST` | `/api/reset` | Reset pipeline state |
| `POST` | `/slack/command` | Slack slash command handler |
| `POST` | `/slack/events` | Slack Events API webhook |

---

## 💬 Slack Usage

### Slash Command
```
/loop brief Acme           → Generate pre-meeting brief
/loop Acme deal pushed to Q3, budget cut to 100K  → Update account memory
```

### @Mention
```
@Loop brief Acme Corp      → Same as slash command
@Loop Sarah is now the decision maker  → Update contacts
```

---

## 📁 Project Structure

```
├── server.cjs              # Express backend + Slack integration + pipelines
├── index.html              # Vite entry HTML
├── vite.config.js          # Vite + Tailwind + proxy config
├── package.json            # Dependencies and scripts
├── public/                 # Static assets (favicon, icons)
├── data/                   # Seed data (Butterbase + XTrace JSON)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root component
    ├── index.css           # Global styles
    ├── constants/          # Design tokens (fonts, colors)
    ├── hooks/              # Custom hooks (useReveal)
    └── components/
        ├── Hero.jsx        # Landing hero section
        ├── Problem.jsx     # Problem statement section
        ├── LoopSection.jsx # Product feature walkthrough
        ├── Architecture.jsx# System architecture diagram
        ├── Stack.jsx       # Tech stack showcase
        ├── Pitch.jsx       # Pitch section
        ├── CTA.jsx         # Call to action
        ├── Footer.jsx      # Footer
        ├── Atmosphere.jsx  # Background visual effects
        ├── nav/            # Navigation bar
        ├── atoms/          # Reusable UI primitives
        └── demo/
            ├── DemoSection.jsx  # Interactive live demo
            ├── MemoryGraph.jsx  # D3 knowledge graph
            ├── Pipeline.jsx     # Pipeline visualizer
            ├── BriefCard.jsx    # Brief output card
            ├── ConfirmCard.jsx  # Confirmation card
            └── demoData.js      # Demo mock data
```

---

## 👥 Team

Built with ☕ and 🧠 at HackWithBay3

---

## 📄 License

MIT
