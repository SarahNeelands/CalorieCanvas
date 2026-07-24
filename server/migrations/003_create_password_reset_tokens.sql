CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  token_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT password_reset_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT password_reset_tokens_digest_format_check
    CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT password_reset_tokens_expiration_check
    CHECK (expires_at > created_at),
  CONSTRAINT password_reset_tokens_consumed_order_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CONSTRAINT password_reset_tokens_revoked_order_check
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CONSTRAINT password_reset_tokens_terminal_state_check
    CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX password_reset_tokens_digest_unique
  ON password_reset_tokens (token_digest);

CREATE INDEX password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id);

CREATE INDEX password_reset_tokens_cleanup_idx
  ON password_reset_tokens (expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
