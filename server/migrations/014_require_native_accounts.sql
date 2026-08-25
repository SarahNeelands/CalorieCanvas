DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE password_hash IS NULL OR must_reset_password) THEN
    RAISE EXCEPTION
      'Migration 014 requires a fresh-account database with no imported reset-only users.';
  END IF;
END;
$$;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN must_reset_password SET DEFAULT false;

ALTER TABLE users
  DROP CONSTRAINT users_password_state_check,
  ADD CONSTRAINT users_password_state_check
    CHECK (password_hash IS NOT NULL AND NOT must_reset_password);
