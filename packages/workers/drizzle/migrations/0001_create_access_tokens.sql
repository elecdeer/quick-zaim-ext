-- Migration: Create access_tokens table
CREATE TABLE IF NOT EXISTS access_tokens (
  sub TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  access_token_secret TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
