CREATE TABLE food_usuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id text NOT NULL,
  item_snapshot jsonb NOT NULL,
  default_qty numeric(12,4) NOT NULL,
  unit_code text NOT NULL,
  custom_label text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT food_usuals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT food_usuals_user_meal_unique
    UNIQUE (user_id, meal_id),
  CONSTRAINT food_usuals_meal_id_length_check
    CHECK (char_length(meal_id) BETWEEN 1 AND 200),
  CONSTRAINT food_usuals_snapshot_object_check
    CHECK (jsonb_typeof(item_snapshot) = 'object'),
  CONSTRAINT food_usuals_snapshot_size_check
    CHECK (pg_column_size(item_snapshot) <= 131072),
  CONSTRAINT food_usuals_qty_check
    CHECK (default_qty > 0 AND default_qty <= 1000000),
  CONSTRAINT food_usuals_unit_check
    CHECK (unit_code IN ('mg', 'g', 'oz', 'lb', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'quantity')),
  CONSTRAINT food_usuals_label_length_check
    CHECK (custom_label IS NULL OR char_length(btrim(custom_label)) BETWEEN 1 AND 80),
  CONSTRAINT food_usuals_position_check
    CHECK (position >= 0 AND position <= 1000000),
  CONSTRAINT food_usuals_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX idx_food_usuals_user_position
  ON food_usuals (user_id, position, created_at, id);

CREATE TRIGGER food_usuals_set_updated_at
BEFORE UPDATE ON food_usuals
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();
