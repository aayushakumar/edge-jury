-- Migration: Add user_id to conversations table
-- Run this on production DB after initial schema

-- Add user_id column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle errors gracefully
ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous';

-- Create index for efficient user filtering
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
