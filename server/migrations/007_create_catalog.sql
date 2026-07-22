CREATE TABLE meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  kcal_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  protein_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  carbs_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  fat_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  unit_conversions jsonb NOT NULL DEFAULT '{}'::jsonb,
  food_id text,

  CONSTRAINT meals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT meals_title_length_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT meals_type_check
    CHECK (type IN ('meal', 'snack', 'ingredient')),
  CONSTRAINT meals_nutrients_check
    CHECK (
      kcal_per_100g BETWEEN 0 AND 100000
      AND protein_g_per_100g BETWEEN 0 AND 100000
      AND carbs_g_per_100g BETWEEN 0 AND 100000
      AND fat_g_per_100g BETWEEN 0 AND 100000
    ),
  CONSTRAINT meals_unit_conversions_object_check
    CHECK (jsonb_typeof(unit_conversions) = 'object'),
  CONSTRAINT meals_unit_conversions_size_check
    CHECK (pg_column_size(unit_conversions) <= 131072),
  CONSTRAINT meals_food_id_length_check
    CHECK (food_id IS NULL OR char_length(food_id) BETWEEN 1 AND 200)
);

CREATE INDEX idx_meals_user_type_created
  ON meals (user_id, type, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX idx_meals_user_updated
  ON meals (user_id, updated_at DESC);
CREATE INDEX idx_meals_user_food_id
  ON meals (user_id, food_id)
  WHERE food_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX idx_meals_title_search
  ON meals (user_id, type, lower(title) text_pattern_ops)
  WHERE archived_at IS NULL;

CREATE TRIGGER meals_set_updated_at
BEFORE UPDATE ON meals
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TABLE shared_catalog_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kcal_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  protein_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  carbs_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  fat_g_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  unit_conversions jsonb NOT NULL DEFAULT '{}'::jsonb,
  food_id text,

  CONSTRAINT shared_catalog_items_id_length_check
    CHECK (char_length(btrim(id)) BETWEEN 1 AND 200),
  CONSTRAINT shared_catalog_items_title_length_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT shared_catalog_items_type_check
    CHECK (type IN ('meal', 'snack', 'ingredient')),
  CONSTRAINT shared_catalog_items_nutrients_check
    CHECK (
      kcal_per_100g BETWEEN 0 AND 100000
      AND protein_g_per_100g BETWEEN 0 AND 100000
      AND carbs_g_per_100g BETWEEN 0 AND 100000
      AND fat_g_per_100g BETWEEN 0 AND 100000
    ),
  CONSTRAINT shared_catalog_items_unit_conversions_object_check
    CHECK (jsonb_typeof(unit_conversions) = 'object'),
  CONSTRAINT shared_catalog_items_unit_conversions_size_check
    CHECK (pg_column_size(unit_conversions) <= 131072),
  CONSTRAINT shared_catalog_items_food_id_length_check
    CHECK (food_id IS NULL OR char_length(food_id) BETWEEN 1 AND 200),
  CONSTRAINT shared_catalog_items_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX idx_shared_catalog_type_created
  ON shared_catalog_items (type, created_at DESC);
CREATE INDEX idx_shared_catalog_title_search
  ON shared_catalog_items (type, lower(title) text_pattern_ops);

CREATE TRIGGER shared_catalog_items_set_updated_at
BEFORE UPDATE ON shared_catalog_items
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TABLE catalog_sync_operations (
  user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  operation_kind text NOT NULL,
  request_digest character(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_sync_operations_pkey PRIMARY KEY (user_id, operation_id),
  CONSTRAINT catalog_sync_operations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT catalog_sync_operations_kind_check
    CHECK (operation_kind IN ('create', 'update', 'delete', 'archive')),
  CONSTRAINT catalog_sync_operations_digest_check
    CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT catalog_sync_operations_result_object_check
    CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX idx_catalog_sync_operations_created
  ON catalog_sync_operations (created_at);
CREATE INDEX idx_catalog_sync_operations_user_created
  ON catalog_sync_operations (user_id, created_at DESC);
