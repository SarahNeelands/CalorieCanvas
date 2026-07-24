CREATE TABLE meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id text,
  catalog_source text NOT NULL,
  food_id text,
  item_snapshot jsonb NOT NULL,
  qty numeric(12,4) NOT NULL,
  unit_code text NOT NULL,
  grams_resolved numeric(12,4),
  logged_at timestamptz NOT NULL,
  log_date date NOT NULL,
  timezone_offset_minutes smallint NOT NULL,
  meal_type text NOT NULL DEFAULT 'other',
  position integer NOT NULL,
  kcal numeric(12,2) NOT NULL DEFAULT 0,
  protein_g numeric(12,2) NOT NULL DEFAULT 0,
  carbs_g numeric(12,2) NOT NULL DEFAULT 0,
  fat_g numeric(12,2) NOT NULL DEFAULT 0,
  fiber_g numeric(12,2) NOT NULL DEFAULT 0,
  sugar_g numeric(12,2) NOT NULL DEFAULT 0,
  cholesterol_mg numeric(12,2) NOT NULL DEFAULT 0,
  sodium_mg numeric(12,2) NOT NULL DEFAULT 0,
  potassium_mg numeric(12,2) NOT NULL DEFAULT 0,
  calcium_mg numeric(12,2) NOT NULL DEFAULT 0,
  iron_mg numeric(12,2) NOT NULL DEFAULT 0,
  vitamin_a_mcg numeric(12,2) NOT NULL DEFAULT 0,
  vitamin_c_mg numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meal_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT meal_logs_meal_id_length_check
    CHECK (meal_id IS NULL OR char_length(meal_id) BETWEEN 1 AND 200),
  CONSTRAINT meal_logs_catalog_source_check
    CHECK (catalog_source IN ('user', 'shared', 'ad_hoc', 'historical')),
  CONSTRAINT meal_logs_food_id_length_check
    CHECK (food_id IS NULL OR char_length(food_id) BETWEEN 1 AND 200),
  CONSTRAINT meal_logs_item_snapshot_object_check
    CHECK (jsonb_typeof(item_snapshot) = 'object'),
  CONSTRAINT meal_logs_item_snapshot_size_check
    CHECK (pg_column_size(item_snapshot) <= 131072),
  CONSTRAINT meal_logs_qty_check
    CHECK (qty > 0 AND qty <= 1000000),
  CONSTRAINT meal_logs_unit_code_check
    CHECK (unit_code IN ('mg', 'g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'quantity')),
  CONSTRAINT meal_logs_grams_check
    CHECK (grams_resolved IS NULL OR (grams_resolved >= 0 AND grams_resolved <= 100000000)),
  CONSTRAINT meal_logs_date_check
    CHECK (log_date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  CONSTRAINT meal_logs_timezone_offset_check
    CHECK (timezone_offset_minutes BETWEEN -840 AND 840),
  CONSTRAINT meal_logs_meal_type_check
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  CONSTRAINT meal_logs_position_check
    CHECK (position >= 0 AND position <= 1000000),
  CONSTRAINT meal_logs_nutrition_check
    CHECK (
      kcal BETWEEN 0 AND 1000000
      AND protein_g BETWEEN 0 AND 1000000
      AND carbs_g BETWEEN 0 AND 1000000
      AND fat_g BETWEEN 0 AND 1000000
      AND fiber_g BETWEEN 0 AND 1000000
      AND sugar_g BETWEEN 0 AND 1000000
      AND cholesterol_mg BETWEEN 0 AND 1000000
      AND sodium_mg BETWEEN 0 AND 1000000
      AND potassium_mg BETWEEN 0 AND 1000000
      AND calcium_mg BETWEEN 0 AND 1000000
      AND iron_mg BETWEEN 0 AND 1000000
      AND vitamin_a_mcg BETWEEN 0 AND 1000000
      AND vitamin_c_mg BETWEEN 0 AND 1000000
    ),
  CONSTRAINT meal_logs_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX idx_meal_logs_user_logged_at
  ON meal_logs (user_id, logged_at DESC, id DESC);
CREATE INDEX idx_meal_logs_user_day
  ON meal_logs (user_id, log_date, meal_type, position, id);
CREATE INDEX idx_meal_logs_catalog_reference
  ON meal_logs (user_id, meal_id)
  WHERE meal_id IS NOT NULL;

CREATE TRIGGER meal_logs_set_updated_at
BEFORE UPDATE ON meal_logs
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();
