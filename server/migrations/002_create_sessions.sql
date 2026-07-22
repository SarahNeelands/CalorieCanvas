CREATE TABLE sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sessions_sid_not_blank_check
    CHECK (char_length(sid) > 0),
  CONSTRAINT sessions_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX sessions_expire_idx
  ON sessions (expire);

CREATE INDEX sessions_user_id_idx
  ON sessions (user_id)
  WHERE user_id IS NOT NULL;
