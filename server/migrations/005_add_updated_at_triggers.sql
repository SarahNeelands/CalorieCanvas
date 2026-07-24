CREATE FUNCTION calorie_canvas_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TRIGGER sessions_set_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

ALTER TABLE sessions
  ADD CONSTRAINT sessions_sid_digest_format_check
  CHECK (sid ~ '^[0-9a-f]{64}$');
