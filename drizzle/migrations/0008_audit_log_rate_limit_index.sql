CREATE INDEX IF NOT EXISTS audit_logs_actor_action_created_idx ON audit_logs(actor_user_id, action, created_at);
