-- Migration: Create request_tokens table
CREATE TABLE IF NOT EXISTS request_tokens (
  oauth_token TEXT PRIMARY KEY,
  oauth_token_secret TEXT NOT NULL,
  created_at TEXT NOT NULL
);
