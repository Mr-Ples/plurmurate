CREATE TABLE IF NOT EXISTS discord_notifications (
  id text PRIMARY KEY NOT NULL,
  kind text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at text,
  failed_at text,
  error_message text
);
CREATE UNIQUE INDEX IF NOT EXISTS discord_notifications_entity_kind_unique
  ON discord_notifications(kind, entity_type, entity_id);
