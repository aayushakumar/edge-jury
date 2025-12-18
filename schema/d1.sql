-- EdgeJury Database Schema
-- Cloudflare D1 (SQLite)

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',  -- User email from Cloudflare Access
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'system', 'model', 'chairman', 'verifier')),
  model_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Council runs table
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_message_id TEXT NOT NULL,
  council_models TEXT NOT NULL,  -- JSON array of model IDs
  chairman_model_id TEXT NOT NULL,
  stage1_status TEXT DEFAULT 'pending',
  stage2_status TEXT DEFAULT 'pending',
  stage3_status TEXT DEFAULT 'pending',
  stage4_status TEXT DEFAULT 'pending',
  stage1_results TEXT,  -- JSON
  stage2_results TEXT,  -- JSON
  stage3_results TEXT,  -- JSON
  stage4_results TEXT,  -- JSON
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  neuron_cost INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_message_id) REFERENCES messages(id)
);

-- Reviews table (Stage 2 cross-reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  reviewer_model_id TEXT NOT NULL,
  rankings TEXT NOT NULL,  -- JSON
  critique TEXT NOT NULL,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Verifications table (Stage 4)
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('consistency', 'evidence')),
  claims TEXT NOT NULL,  -- JSON array of claims with labels
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Evidence cards table (for Mode B verification)
CREATE TABLE IF NOT EXISTS evidence_cards (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  fact TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_runs_conversation ON runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_run ON reviews(run_id);
CREATE INDEX IF NOT EXISTS idx_verifications_run ON verifications(run_id);
CREATE INDEX IF NOT EXISTS idx_evidence_category ON evidence_cards(category);
