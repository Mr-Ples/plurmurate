CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  x_user_id text NOT NULL UNIQUE,
  username text,
  display_name text,
  profile_image_url text,
  followers_count integer NOT NULL DEFAULT 0,
  x_access_token_encrypted text,
  x_refresh_token_encrypted text,
  last_profile_sync_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  expires_at text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id text NOT NULL REFERENCES users(id),
  role_id text NOT NULL REFERENCES roles(id),
  assigned_by_user_id text REFERENCES users(id),
  assignment_source text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE IF NOT EXISTS nominations (
  id text PRIMARY KEY NOT NULL,
  creator_user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  status text NOT NULL,
  text text,
  target_tweet_url text,
  target_tweet_id text,
  rationale text,
  tweet_avatar_media_id text,
  nomination_media_id text,
  published_tweet_id text,
  published_tweet_url text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  qualified_at text,
  approved_at text,
  sent_at text,
  hidden_at text
);
CREATE INDEX IF NOT EXISTS nominations_status_idx ON nominations(status);
CREATE INDEX IF NOT EXISTS nominations_creator_idx ON nominations(creator_user_id);
CREATE TABLE IF NOT EXISTS votes (
  id text PRIMARY KEY NOT NULL,
  nomination_id text NOT NULL REFERENCES nominations(id),
  user_id text NOT NULL REFERENCES users(id),
  value text NOT NULL,
  comment text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS votes_nomination_user_unique ON votes(nomination_id, user_id);
CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(id),
  nomination_id text REFERENCES nominations(id),
  kind text NOT NULL,
  storage_key text NOT NULL,
  public_url text,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  width integer,
  height integer,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS external_tweets (
  tweet_id text PRIMARY KEY NOT NULL,
  url text NOT NULL,
  author_username text,
  author_id text,
  text_preview text,
  fetched_at text,
  fetch_status text NOT NULL,
  raw_json text
);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY NOT NULL,
  value_json text NOT NULL,
  updated_by_user_id text REFERENCES users(id),
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS role_assignment_rules (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  enabled integer NOT NULL DEFAULT 0,
  rule_type text NOT NULL,
  config_json text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS publish_attempts (
  id text PRIMARY KEY NOT NULL,
  nomination_id text NOT NULL REFERENCES nominations(id),
  workflow text NOT NULL,
  actor_user_id text REFERENCES users(id),
  x_operation text NOT NULL,
  request_json text NOT NULL,
  response_json text,
  status text NOT NULL,
  error_message text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY NOT NULL,
  actor_user_id text REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata_json text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO roles (id, name) VALUES
  ('role_spectator', 'spectator'),
  ('role_voter', 'voter'),
  ('role_admin', 'admin');
