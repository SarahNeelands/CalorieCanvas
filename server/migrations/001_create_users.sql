CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text,
  must_reset_password boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  account_status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_email_normalized_check
    CHECK (email = lower(btrim(email))),
  CONSTRAINT users_email_shape_check
    CHECK (char_length(email) BETWEEN 3 AND 320 AND position('@' IN email) > 1),
  CONSTRAINT users_password_hash_not_blank_check
    CHECK (password_hash IS NULL OR char_length(password_hash) > 0),
  CONSTRAINT users_password_state_check
    CHECK (must_reset_password OR password_hash IS NOT NULL),
  CONSTRAINT users_account_status_check
    CHECK (account_status IN ('active', 'disabled', 'locked')),
  CONSTRAINT users_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE UNIQUE INDEX users_email_normalized_unique
  ON users (lower(email));

CREATE INDEX users_account_status_idx
  ON users (account_status);
