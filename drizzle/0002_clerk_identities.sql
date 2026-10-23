-- Preserve application ownership across the Auth.js -> Clerk session cutover.
-- No wallet, activity, route or immutable point-event row is rewritten.
CREATE TABLE auth_identities (
  clerk_user_id TEXT PRIMARY KEY NOT NULL,
  app_user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
