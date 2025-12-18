# EdgeJury 🧑‍⚖️

> A multi-LLM council web app that gets multiple model opinions, forces structured critique, runs verification, and synthesizes a final "Chairman" answer — all on Cloudflare's edge.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 🎯 What is EdgeJury?

EdgeJury runs your question through a **council of AI models**, each with a different perspective:

| Model Role | Purpose |
|------------|---------|
| **Direct Answerer** | Clear, concise, accurate answer |
| **Edge Case Finder** | Identifies problems and exceptions |
| **Step-by-Step Explainer** | Breaks down complex topics |
| **Pragmatic Implementer** | Focuses on practical solutions |

Then a **Chairman** synthesizes the best elements into a final answer, with a **Verification** stage to check consistency.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Cloudflare Account** (free tier works) — [Sign up](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI** — installed with npm

### 1. Clone and Install

```bash
git clone https://github.com/aayushakumar/edge-jury.git
cd edge-jury

# Install worker dependencies
cd worker && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Cloudflare Setup

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create edge-jury-db

# Copy the database_id from output to worker/wrangler.toml
```

Update `worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "edge-jury-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← paste here
```

### 3. Initialize Database

```bash
cd worker
npm run db:init
```

### 4. Run Locally

```bash
# Terminal 1: Start worker (API)
cd worker && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## 📁 Project Structure

```
edge-jury/
├── frontend/                 # React/Vite frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── Chat/         # Chat panel
│   │   │   ├── Council/      # Council model views
│   │   │   ├── Verification/ # Claim verification
│   │   │   ├── History/      # Conversation sidebar
│   │   │   └── Settings/     # Settings modal
│   │   ├── hooks/            # React hooks
│   │   └── styles/           # Global CSS
│   └── package.json
│
├── worker/                   # Cloudflare Worker backend
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   │   ├── chat.ts       # POST /api/chat
│   │   │   ├── conversations.ts
│   │   │   └── runs.ts
│   │   ├── services/         # Business logic
│   │   │   ├── council.ts    # Stage 1: First opinions
│   │   │   ├── review.ts     # Stage 2: Cross-review
│   │   │   ├── chairman.ts   # Stage 3: Synthesis
│   │   │   └── verify.ts     # Stage 4: Verification
│   │   ├── prompts/          # LLM system prompts
│   │   ├── utils/            # Utilities
│   │   └── types.ts          # TypeScript types
│   ├── tests/                # Vitest unit tests
│   ├── wrangler.toml         # Cloudflare config
│   └── package.json
│
└── schema/
    └── d1.sql                # Database schema
```

---

## 🔧 Configuration

### Environment Variables (`worker/wrangler.toml`)

```toml
[vars]
COUNCIL_SIZE = "3"           # Number of models (1-4)
MAX_TOKENS_STAGE1 = "400"    # First opinions
MAX_TOKENS_STAGE2 = "300"    # Cross-review
MAX_TOKENS_STAGE3 = "600"    # Chairman synthesis
MAX_TOKENS_STAGE4 = "400"    # Verification
```

### Available Models

| Model | ID |
|-------|-----|
| Llama 3.1 8B Fast | `@cf/meta/llama-3.1-8b-instruct-fast` |
| Llama 3.1 8B | `@cf/meta/llama-3.1-8b-instruct` |
| Llama 3.2 3B | `@cf/meta/llama-3.2-3b-instruct` |
| Mistral 7B | `@cf/mistral/mistral-7b-instruct-v0.1` |

---

## 🧪 Testing

```bash
cd worker

# Run tests
npm run test

# Run tests in watch mode
npm run test -- --watch
```

**Test coverage:**
- `council.test.ts` — Model selection and role assignment
- `utils.test.ts` — UUID generation

---

## 🌐 API Reference

### `POST /api/chat`

Start a council run.

**Request:**
```json
{
  "message": "How do I sort an array in JavaScript?",
  "conversation_id": "optional-uuid",
  "settings": {
    "council_size": 3,
    "verification_mode": "consistency",
    "enable_cross_review": true,
    "anonymize_reviews": true
  }
}
```

**Response:** Server-Sent Events (SSE)

```
event: stage1.model_result
data: {"model_id": "...", "role": "direct_answerer", "response": "..."}

event: stage3.chairman_result
data: {"final_answer": "...", "rationale": [...], "disagreements": [...]}

event: stage4.verification_result
data: {"mode": "consistency", "claims": [...]}

event: done
data: {"run_id": "...", "conversation_id": "...", "latency_ms": 2500}
```

### `GET /api/conversations`

List all conversations.

### `GET /api/conversations/:id`

Get conversation with messages.

### `GET /api/runs/:id`

Get full run details (all stage results).

---

## 🌍 Live Demo

| Component | URL |
|-----------|-----|
| **Frontend** | https://e9cecaa7.edge-jury.pages.dev |
| **API** | https://edge-jury-worker.aayushakumars.workers.dev |

---

## 🚢 Deployment

### Prerequisites

1. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Create D1 Database:**
   ```bash
   npx wrangler d1 create edge-jury-db
   ```
   Copy the `database_id` from output to `worker/wrangler.toml`.

3. **Create KV Namespace:**
   ```bash
   cd worker
   npx wrangler kv namespace create KV
   ```
   Copy the `id` from output to `worker/wrangler.toml`.

4. **Initialize Production Database:**
   ```bash
   cd worker
   npx wrangler d1 execute edge-jury-db --remote --file=../schema/d1.sql
   ```

### Deploy Worker (API)

```bash
cd worker
npm run deploy
```

Your worker will be available at: `https://<worker-name>.<account>.workers.dev`

### Deploy Frontend (Cloudflare Pages)

1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Pages:**
   ```bash
   npx wrangler pages deploy dist --project-name=edge-jury
   ```

   Your frontend will be available at: `https://<hash>.edge-jury.pages.dev`

### Environment Variables

Create `frontend/.env.production` with your worker URL:
```
VITE_API_URL=https://your-worker.workers.dev
```

---

## ⚙️ How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Question                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: First Opinions (Parallel)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Model A  │ │ Model B  │ │ Model C  │ │ Model D  │            │
│  │ (Direct) │ │ (Edge)   │ │ (Steps)  │ │(Pragmatic│            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: Cross-Review                                          │
│  Each model reviews others anonymously (A, B, C, D)              │
│  → Rankings, Issues, Best Bits                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: Chairman Synthesis                                     │
│  Merges best elements, resolves disagreements                    │
│  → Final Answer + Rationale                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: Verification                                           │
│  Extracts claims, checks consistency across models               │
│  → ✅ Verified | ⚠️ Uncertain | ❌ Contradicted                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Free Tier Limits

| Resource | Limit |
|----------|-------|
| Workers Requests | 100,000/day |
| Workers AI Neurons | 10,000/day |
| D1 Storage | 5 GB total |
| D1 Rows Read | 5M/day |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit using conventional commits: `git commit -m "feat: add amazing feature"`
4. Push: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE)
