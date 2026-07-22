ALTER TABLE weights
  ALTER COLUMN value TYPE numeric(14,6),
  ADD COLUMN value_kg numeric(14,6)
    GENERATED ALWAYS AS (
      CASE
        WHEN unit = 'kg' THEN value
        WHEN unit = 'lb' THEN value * 0.45359237
        ELSE NULL
      END
    ) STORED,
  ADD COLUMN source_record_id text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE weights
  DROP CONSTRAINT weights_date_check,
  DROP CONSTRAINT weights_value_check,
  DROP CONSTRAINT weights_unit_check,
  ADD CONSTRAINT weights_date_check
    CHECK (date >= DATE '1900-01-01' AND date <= CURRENT_DATE + 1),
  ADD CONSTRAINT weights_value_check
    CHECK (value > 0 AND value <= 2000),
  ADD CONSTRAINT weights_unit_check
    CHECK (unit IN ('kg', 'lb')),
  ADD CONSTRAINT weights_value_kg_check
    CHECK (value_kg BETWEEN 20 AND 500),
  ADD CONSTRAINT weights_source_record_id_check
    CHECK (
      source_record_id IS NULL OR
      (source_record_id = btrim(source_record_id) AND char_length(source_record_id) BETWEEN 1 AND 200)
    ),
  ADD CONSTRAINT weights_timestamp_order_check
    CHECK (updated_at >= created_at);

CREATE UNIQUE INDEX weights_user_source_record_unique
  ON weights (user_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE TRIGGER weights_set_updated_at
BEFORE UPDATE ON weights
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TABLE weight_import_operations (
  user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  request_digest char(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weight_import_operations_pkey PRIMARY KEY (user_id, operation_id),
  CONSTRAINT weight_import_operations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT weight_import_operations_digest_check
    CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT weight_import_operations_result_object_check
    CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX weight_import_operations_created_at_idx
  ON weight_import_operations (created_at);
