-- Evaluation runs logging table
-- Stores per-request JSONL traces for research analysis

CREATE TABLE IF NOT EXISTS eval_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    timestamp TEXT NOT NULL,
    colo TEXT,                           -- Edge location (Cloudflare colo code)
    user_id TEXT,
    session_id TEXT,
    
    -- Request configuration
    question TEXT NOT NULL,
    council_size INTEGER NOT NULL,
    enable_cross_review INTEGER NOT NULL, -- 0/1
    verification_mode TEXT NOT NULL,
    
    -- Stage data (JSON)
    stages_json TEXT,                    -- Array of stage timing objects
    stage1_json TEXT,                    -- Stage 1 results
    stage2_json TEXT,                    -- Stage 2 results  
    stage3_json TEXT,                    -- Stage 3 result
    stage4_json TEXT,                    -- Stage 4 result
    
    -- Aggregates
    total_latency_ms INTEGER,
    total_tokens INTEGER,
    cache_hit INTEGER,                   -- 0/1
    error TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_eval_runs_timestamp ON eval_runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_eval_runs_colo ON eval_runs(colo);
CREATE INDEX IF NOT EXISTS idx_eval_runs_verification_mode ON eval_runs(verification_mode);
