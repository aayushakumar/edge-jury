# EdgeJury

> **One-line pitch:** A “multi-LLM council” web app that gets *multiple* model opinions, forces *structured critique*, runs an automatic *verification pass*, and ships a final “Chairman” answer — all on Cloudflare’s edge.

---

## 0) TL;DR

**Build stack (all Cloudflare):**

* **Compute/API:** Cloudflare Workers (global edge) — Free plan has **100,000 requests/day** ([Cloudflare Docs][1])
* **Inference:** Workers AI — Free includes **10,000 Neurons/day** ([Cloudflare Docs][2])
* **DB:** D1 (SQLite) + KV (sessions/cache). D1 Free includes **10 databases**, **500MB/db**, **5GB/account** ([Cloudflare Docs][3])
* **Prod polish:** AI Gateway for **caching, rate limiting, retries, model fallback, analytics/logging** ([Cloudflare Docs][4])
* **Optional “memory/RAG”:** Vectorize (Cloudflare vector DB) w/ free prototyping tier ([Cloudflare Docs][5])

**Core differentiator vs “LLM Council”:** add **Stage 4: Verification** (claim checks + citations + confidence labeling).

---

## 1) Goals, Non-Goals, Success Criteria

### Goals

* Deliver **higher correctness** than single-model chat via:

  1. diverse first opinions
  2. structured cross-critique
  3. chairman synthesis
  4. verification & uncertainty labeling
* Feel like a **real product**: fast, cheap, reliable, abuse-resistant, observable.
* Keep the **default** mode within free tier for personal usage.

### Non-Goals (for MVP)

* No full “agent OS” (tools, browsing, plugins) on day 1.
* No heavy long-term storage of big files (PDFs, images) in MVP.
* No “perfect truth”—instead: *clear verified vs unverified separation*.

### Success criteria (MVP)

* P95 **< 3–6s** for typical prompts (with caching).
* “Verified mode” produces **citations + confidence badges** for factual queries.
* Users can:

  * compare model answers
  * see disagreements highlighted
  * understand why chairman chose final output

---

## 2) Product UX

### Main screens

1. **Chat (Council Mode)**

   * User asks question
   * Tabs: *Model A / Model B / Model C / Model D*
   * “Disagreements” panel (auto-extracted)
   * “Chairman answer”
   * “Verification report”

2. **Conversation History**

   * list of chats (title, date, tags)
   * open conversation, resume

3. **Settings**

   * choose council size (2–6)
   * choose models
   * toggle “Verification mode”
   * safety toggles (PII redact, strict mode)
   * budget controls (daily neuron guardrails)

### “Cooler” UI details (must-have)

* **Disagreement Highlighter**

  * show 5–15 “contention points” (bulleted)
  * each point links to the exact spans in model outputs
* **Confidence badges**

  * ✅ Verified
  * ⚠️ Plausible (not verified)
  * ❌ Contradicted
* **Chairman rationale (short)**

  * “Picked A for X, B for Y; rejected C because …”

---

## 3) End-to-End Flow (Pipeline)

### Stage 0: Pre-processing

* Normalize input (trim, collapse whitespace)
* Detect intent:

  * “coding” vs “factual” vs “creative” vs “planning”
* Create **trace_id** for observability

### Stage 1: First Opinions (Parallel)

* Send the same user prompt to **N models** (N=3–5 default)
* Each model gets a role prompt:

  * Model 1: *Direct answerer*
  * Model 2: *Edge-cases & counterexamples*
  * Model 3: *Step-by-step explainer*
  * Model 4: *Pragmatic implementer* (if coding)
* Store raw responses

### Stage 2: Structured Cross-Review

* Each model reviews others **anonymized**:

  * rank by *correctness*, *completeness*, *clarity*
  * list concrete flaws & missing checks
  * produce “best elements” summary
* Output: a **ranking matrix** + critique bullets

### Stage 3: Chairman Synthesis

* Chairman sees:

  * all answers
  * all critiques
  * ranking matrix
* Chairman produces:

  * final response
  * short rationale
  * asks 1–3 follow-ups only if necessary

### Stage 4: Verification (the upgrade)

* Extract claims from the chairman output:

  * numeric claims
  * named entities
  * “how-to” steps that can be wrong
* Run verification strategies:

  * **internal consistency checks** (no web browsing in MVP)
  * **citation mode** if you add RAG (Vectorize) or curated docs
  * **unit tests** for code snippets (optional later)
* Label each claim ✅/⚠️/❌ + attach supporting evidence snippet.

---

## 4) Model Roster (Workers AI)

Start with **3–4 text generation models** from Workers AI catalog ([Cloudflare Docs][6])

**Recommended default council (fast + cheap):**

* `@cf/meta/llama-3.1-8b-instruct-fast` (fast generalist) ([Cloudflare Docs][7])
* `@cf/meta/llama-3.1-8b-instruct` (quality generalist) ([Cloudflare Docs][8])
* One “different family” model from catalog (e.g., Mistral / Gemma if available in catalog list) ([Cloudflare Docs][6])
* Chairman: `@cf/meta/llama-3.1-8b-instruct` (or swap to a larger catalog model later)

> Note: Workers AI can be called directly from a Worker using `env.AI.run(model, …)` (Cloudflare’s own tutorial examples show this pattern). ([Cloudflare Docs][9])

---

## 5) Cloudflare Architecture

### Components

* **Frontend:** Cloudflare Pages (React/Vite)
* **API:** Cloudflare Worker (Hono or itty-router or native fetch handler)
* **Inference:** Workers AI binding (`env.AI`)
* **DB:** D1 for durable relational data
* **KV:** session tokens, short-term caches, rate-limit counters
* **AI Gateway:** route inference requests through Gateway for caching, rate limiting, retries, fallback ([Cloudflare Docs][4])

### Request flow

1. Browser → Worker `/api/chat`
2. Worker:

   * writes message to D1
   * triggers parallel council inference (with AI Gateway routing)
3. Worker streams results back (SSE) or returns once complete
4. Worker writes all outputs + critiques + chairman + verification report to D1

### Key constraints (design around these)

* Workers Free: **100k requests/day** and **10ms CPU time/request** (keep worker CPU work tiny; do IO + inference calls) ([Cloudflare Docs][1])
* Workers AI Free: **10k Neurons/day** (budget it with caching + shorter max tokens) ([Cloudflare Docs][2])

---

## 6) Data Model (D1)

### Tables (MVP)

**conversations**

* id (uuid)
* title (text)
* created_at
* updated_at

**messages**

* id (uuid)
* conversation_id (fk)
* role (`user|system|model|chairman|verifier`)
* model_id (text, nullable)
* content (text)
* created_at

**runs**

* id (uuid)
* conversation_id
* user_message_id
* council_models_json (text)
* chairman_model_id
* stage1_status, stage2_status, stage3_status, stage4_status
* tokens_in, tokens_out (optional estimate)
* neuron_cost_estimate (optional)
* created_at

**reviews**

* id
* run_id
* reviewer_model_id
* rankings_json
* critique_json
* created_at

**verifications**

* id
* run_id
* claims_json (list of claims + labels + evidence)
* created_at

### Why D1 + KV

* D1 = truth source, queryable history
* KV = fast cache:

  * `(model_id, prompt_hash) -> response` (TTL 1–24h)
  * rate-limit counters (`ip/day`, `user/day`)

D1 free-tier limits exist (keep DB small; prune old runs) ([Cloudflare Docs][3])

---

## 7) API Design (Worker)

### Endpoints

* `POST /api/chat`

  * body: `{ conversation_id?, message, settings }`
  * returns: `{ run_id }` or streams events

* `GET /api/runs/:run_id`

  * returns stage outputs (stage1 answers, reviews, chairman, verification)

* `GET /api/conversations`

* `POST /api/conversations`

* `GET /api/conversations/:id`

### Streaming plan (recommended)

Use Server-Sent Events:

* event: `stage1.model_result`
* event: `stage2.review_result`
* event: `stage3.chairman_result`
* event: `stage4.verification_result`
* event: `done`

---

## 8) Prompting & Output Schemas

### System prompts (role-based)

**Common rules (all models)**

* be explicit about assumptions
* if unsure, say so
* no hallucinated citations

**Stage 2 review prompt (structured)**
Return JSON:

```json
{
  "rankings": [
    {"candidate":"A","accuracy":8,"insight":7,"clarity":6},
    {"candidate":"B","accuracy":6,"insight":9,"clarity":8}
  ],
  "issues": [
    {"candidate":"A","type":"factual_risk","detail":"..."},
    {"candidate":"B","type":"missing_edge_case","detail":"..."}
  ],
  "best_bits": [
    {"candidate":"B","extract":"..."}
  ]
}
```

**Chairman synthesis prompt**

* must merge “best_bits”
* must address top “issues”
* must output:

  * `final_answer`
  * `rationale` (3–6 bullets)
  * `open_questions` (0–3)

**Verifier prompt**
Return JSON:

```json
{
  "claims":[
    {"text":"...", "label":"verified|uncertain|contradicted", "evidence":"...", "note":"..."}
  ]
}
```

---

## 9) AI Gateway Configuration (Production-grade feel)

### Why AI Gateway

* One-liner integration, plus:

  * caching
  * rate limiting
  * request retries
  * model fallback
  * analytics/logging ([Cloudflare Docs][4])

### Concrete settings (MVP defaults)

* **Caching:** ON for Stage 1 (prompt_hash, model_id)

  * TTL 6–24h
  * bypass cache for prompts containing “today / latest / current” keywords
* **Retries:** 2 retries w/ jitter
* **Fallback:** if primary model errors/timeouts → fallback model
* **Rate limit:** per IP + per “anonymous session id” (KV-backed counters) ([Cloudflare Docs][10])

---

## 10) Optional: “Memory / RAG” (still Cloudflare-only)

If you want the app to feel *smarter over time*:

* Store conversation summaries + user notes as embeddings
* Query relevant memories during Stage 3 synthesis

Use **Vectorize**:

* Cloudflare’s vector DB designed for Workers ([Cloudflare Docs][5])
* Has a free tier for prototyping ([Cloudflare Docs][11])
* Free plan supports up to **100 indexes** and other limits ([Cloudflare Docs][12])
* Integrates with Workers AI embeddings ([Cloudflare Docs][13])

---

## 11) Cost & Budget Guardrails

### Free-tier budget math (practical)

* Hard ceilings to respect:

  * Workers AI: **10,000 Neurons/day** ([Cloudflare Docs][2])
  * Workers requests: **100k/day** ([Cloudflare Docs][1])

### Guardrails (implement day 1)

* Token caps:

  * Stage 1: max_output_tokens small (e.g., 200–400)
  * Stage 2: max_output_tokens small (JSON only)
  * Stage 3: moderate (400–800)
* Auto-shrink council size when close to daily neuron budget
* Cache aggressively via AI Gateway
* Provide a “Budget meter” in UI:

  * “~neurons used today”
  * “council size impact”

---

## 12) Security & Abuse Prevention

### Threat model (MVP)

* Prompt injection attempts
* abusive content / spam
* key leakage (API tokens)
* scraping the service

### Controls

* Cloudflare Turnstile (optional)
* Rate limiting via AI Gateway + KV counters ([Cloudflare Docs][10])
* Basic content filtering:

  * block obvious secrets patterns (keys, tokens)
  * PII redaction toggle

---

## 13) Observability & Debugging

### Must-have logs per run

* trace_id, run_id
* council_models, chairman_model
* durations per stage
* cache hit/miss
* error codes per model call

AI Gateway gives analytics/logging visibility across requests ([Cloudflare Docs][4])

---

## 14) Repo Structure (suggested)

```
council-plus-plus/
  frontend/              # Pages (React + Vite)
  worker/                # Workers API
    src/
      routes/
      services/
        council.ts
        review.ts
        chairman.ts
        verify.ts
        storage.ts
      prompts/
      utils/
    wrangler.toml
  schema/
    d1.sql
  docs/
    architecture.md
    runbook.md
```

---

## 15) Milestones (ship fast)

### Milestone 1 — “Council MVP” (1–2 days)

* [ ] Chat UI + tabs for N model outputs
* [ ] Worker `/api/chat` + D1 storage
* [ ] Stage 1 parallel inference

### Milestone 2 — “Cross-review + Chairman” (2–4 days)

* [ ] Stage 2 anonymized reviews JSON
* [ ] Stage 3 chairman synthesis + rationale
* [ ] Disagreement extraction (simple heuristic)

### Milestone 3 — “Verification” (3–7 days)

* [ ] Claim extraction + verifier JSON
* [ ] Confidence badges
* [ ] “What’s verified” panel

### Milestone 4 — “Prod polish” (1–3 days)

* [ ] AI Gateway caching + rate limiting + fallback ([Cloudflare Docs][14])
* [ ] Budget meter + daily limits
* [ ] Basic abuse protection

---

## 16) Backlog Ideas (make it *insanely* cool later)

* “Debate mode”: models ask each other questions before chairman answers
* “Proof mode”: require the chairman to cite evidence from your own uploaded docs (Vectorize)
* “Code-runner mode”: execute tests in a sandbox (not on Workers; would need external runner)
* “Council presets”: *Research*, *Coding*, *Career*, *Legal-ish* (with stricter disclaimers)

---


[1]: https://developers.cloudflare.com/workers/platform/limits/?utm_source=chatgpt.com "Limits · Cloudflare Workers docs"
[2]: https://developers.cloudflare.com/workers-ai/platform/pricing/?utm_source=chatgpt.com "Pricing · Cloudflare Workers AI docs"
[3]: https://developers.cloudflare.com/d1/platform/limits/?utm_source=chatgpt.com "Limits · Cloudflare D1 docs"
[4]: https://developers.cloudflare.com/ai-gateway/?utm_source=chatgpt.com "Overview · Cloudflare AI Gateway docs"
[5]: https://developers.cloudflare.com/vectorize/?utm_source=chatgpt.com "Overview · Cloudflare Vectorize docs"
[6]: https://developers.cloudflare.com/workers-ai/models/?utm_source=chatgpt.com "Models · Cloudflare Workers AI docs"
[7]: https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/?utm_source=chatgpt.com "llama-3.1-8b-instruct-fast - Workers AI"
[8]: https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct/?utm_source=chatgpt.com "cf/meta/llama-3.1-8b-instruct - Workers AI"
[9]: https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/?utm_source=chatgpt.com "Build a Retrieval Augmented Generation (RAG) AI"
[10]: https://developers.cloudflare.com/ai-gateway/features/rate-limiting/?utm_source=chatgpt.com "Rate limiting - AI Gateway"
[11]: https://developers.cloudflare.com/vectorize/platform/pricing/?utm_source=chatgpt.com "Pricing · Cloudflare Vectorize docs"
[12]: https://developers.cloudflare.com/vectorize/platform/limits/?utm_source=chatgpt.com "Limits · Cloudflare Vectorize docs"
[13]: https://developers.cloudflare.com/vectorize/get-started/embeddings/?utm_source=chatgpt.com "Vectorize and Workers AI"
[14]: https://developers.cloudflare.com/ai-gateway/features/?utm_source=chatgpt.com "Features · Cloudflare AI Gateway docs"
