CREATE TABLE exercise_definitions (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id text NOT NULL,
  user_id uuid,
  is_shared boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text,
  estimated_calories_per_hour numeric(10,2),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exercise_definitions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT exercise_definitions_owner_check
    CHECK ((is_shared AND user_id IS NULL) OR (NOT is_shared AND user_id IS NOT NULL)),
  CONSTRAINT exercise_definitions_id_check
    CHECK (id = btrim(id) AND char_length(id) BETWEEN 1 AND 100 AND id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  CONSTRAINT exercise_definitions_name_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT exercise_definitions_description_check
    CHECK (description IS NULL OR char_length(description) <= 1000),
  CONSTRAINT exercise_definitions_calorie_estimate_check
    CHECK (estimated_calories_per_hour IS NULL OR estimated_calories_per_hour BETWEEN 0 AND 5000),
  CONSTRAINT exercise_definitions_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE UNIQUE INDEX exercise_definitions_shared_id_unique
  ON exercise_definitions (id) WHERE is_shared;
CREATE UNIQUE INDEX exercise_definitions_user_id_unique
  ON exercise_definitions (user_id, id) WHERE NOT is_shared;
CREATE UNIQUE INDEX exercise_definitions_user_name_unique
  ON exercise_definitions (user_id, lower(name)) WHERE NOT is_shared AND archived_at IS NULL;
CREATE INDEX exercise_definitions_visibility_idx
  ON exercise_definitions (user_id, is_shared, archived_at, lower(name));

CREATE TRIGGER exercise_definitions_set_updated_at
BEFORE UPDATE ON exercise_definitions
FOR EACH ROW EXECUTE FUNCTION calorie_canvas_set_updated_at();

INSERT INTO exercise_definitions (id, user_id, is_shared, name) VALUES
  ('walk', NULL, true, 'Walking'),
  ('run', NULL, true, 'Running'),
  ('cycle', NULL, true, 'Cycling'),
  ('yoga', NULL, true, 'Yoga'),
  ('swim', NULL, true, 'Swimming');

CREATE TABLE exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  definition_id text NOT NULL,
  definition_snapshot jsonb NOT NULL,
  duration_minutes integer NOT NULL,
  occurred_at timestamptz NOT NULL,
  log_date date NOT NULL,
  timezone_offset_minutes smallint NOT NULL,
  sets integer,
  repetitions integer,
  resistance_value numeric(12,4),
  resistance_unit text,
  distance_value numeric(12,4),
  distance_unit text,
  calories_burned numeric(12,2),
  calorie_source text NOT NULL DEFAULT 'none',
  notes text,
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exercise_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT exercise_logs_definition_id_check
    CHECK (char_length(definition_id) BETWEEN 1 AND 100),
  CONSTRAINT exercise_logs_snapshot_object_check
    CHECK (jsonb_typeof(definition_snapshot) = 'object' AND pg_column_size(definition_snapshot) <= 32768),
  CONSTRAINT exercise_logs_duration_check CHECK (duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT exercise_logs_date_check CHECK (log_date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  CONSTRAINT exercise_logs_timezone_offset_check CHECK (timezone_offset_minutes BETWEEN -840 AND 840),
  CONSTRAINT exercise_logs_sets_check CHECK (sets IS NULL OR sets BETWEEN 1 AND 10000),
  CONSTRAINT exercise_logs_repetitions_check CHECK (repetitions IS NULL OR repetitions BETWEEN 1 AND 1000000),
  CONSTRAINT exercise_logs_resistance_check CHECK (
    (resistance_value IS NULL AND resistance_unit IS NULL) OR
    (resistance_value BETWEEN 0 AND 5000 AND resistance_unit IN ('kg', 'lb'))
  ),
  CONSTRAINT exercise_logs_distance_check CHECK (
    (distance_value IS NULL AND distance_unit IS NULL) OR
    (distance_value > 0 AND distance_value <= 100000 AND distance_unit IN ('m', 'km', 'mi', 'yd'))
  ),
  CONSTRAINT exercise_logs_calories_check CHECK (calories_burned IS NULL OR calories_burned BETWEEN 0 AND 10000),
  CONSTRAINT exercise_logs_calorie_source_check CHECK (calorie_source IN ('none', 'user', 'estimate', 'definition')),
  CONSTRAINT exercise_logs_calorie_state_check CHECK (
    (calories_burned IS NULL AND calorie_source = 'none') OR
    (calories_burned IS NOT NULL AND calorie_source <> 'none')
  ),
  CONSTRAINT exercise_logs_notes_check CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT exercise_logs_source_record_id_check CHECK (
    source_record_id IS NULL OR
    (source_record_id = btrim(source_record_id) AND char_length(source_record_id) BETWEEN 1 AND 200)
  ),
  CONSTRAINT exercise_logs_timestamp_order_check CHECK (updated_at >= created_at)
);

CREATE UNIQUE INDEX exercise_logs_user_source_unique
  ON exercise_logs (user_id, source_record_id) WHERE source_record_id IS NOT NULL;
CREATE INDEX exercise_logs_user_occurred_idx
  ON exercise_logs (user_id, occurred_at DESC, id DESC);
CREATE INDEX exercise_logs_user_date_idx
  ON exercise_logs (user_id, log_date, occurred_at, id);
CREATE INDEX exercise_logs_definition_idx
  ON exercise_logs (user_id, definition_id);

CREATE TRIGGER exercise_logs_set_updated_at
BEFORE UPDATE ON exercise_logs
FOR EACH ROW EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TABLE exercise_sync_operations (
  user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  request_digest char(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_sync_operations_pkey PRIMARY KEY (user_id, operation_id),
  CONSTRAINT exercise_sync_operations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT exercise_sync_operations_digest_check CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT exercise_sync_operations_result_object_check CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX exercise_sync_operations_created_at_idx ON exercise_sync_operations (created_at);
