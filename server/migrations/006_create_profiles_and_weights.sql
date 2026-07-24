CREATE TABLE profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  dob date,
  gender text,
  height_cm numeric(6,2),
  weight_kg numeric(6,2),
  activity_level text NOT NULL DEFAULT 'sedentary',
  goal_weight_intent text NOT NULL DEFAULT 'maintain',
  goal_muscle_intent text NOT NULL DEFAULT 'maintain',
  calorie_goal integer,
  target_weight_kg numeric(6,2),
  target_body_fat_pct numeric(5,2),
  pref_show_calories boolean NOT NULL DEFAULT true,
  pref_show_macros boolean NOT NULL DEFAULT true,
  pref_show_micros boolean NOT NULL DEFAULT false,
  pref_show_exercise boolean NOT NULL DEFAULT true,
  pref_show_weight boolean NOT NULL DEFAULT true,
  setup_completed boolean NOT NULL DEFAULT false,
  setup_last_step text,
  setup_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_display_name_length_check
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 100),
  CONSTRAINT profiles_dob_check
    CHECK (dob IS NULL OR (dob >= DATE '1900-01-01' AND dob <= CURRENT_DATE)),
  CONSTRAINT profiles_gender_length_check
    CHECK (gender IS NULL OR char_length(gender) BETWEEN 1 AND 50),
  CONSTRAINT profiles_height_check
    CHECK (height_cm IS NULL OR height_cm BETWEEN 50 AND 300),
  CONSTRAINT profiles_weight_check
    CHECK (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 500),
  CONSTRAINT profiles_activity_level_check
    CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete')),
  CONSTRAINT profiles_goal_weight_intent_check
    CHECK (goal_weight_intent IN ('rapid_loss', 'normal_loss', 'maintain', 'normal_gain', 'rapid_gain')),
  CONSTRAINT profiles_goal_muscle_intent_check
    CHECK (goal_muscle_intent IN ('build', 'maintain')),
  CONSTRAINT profiles_calorie_goal_check
    CHECK (calorie_goal IS NULL OR calorie_goal BETWEEN 800 AND 10000),
  CONSTRAINT profiles_target_weight_check
    CHECK (target_weight_kg IS NULL OR target_weight_kg BETWEEN 20 AND 500),
  CONSTRAINT profiles_target_body_fat_check
    CHECK (target_body_fat_pct IS NULL OR target_body_fat_pct BETWEEN 0 AND 70),
  CONSTRAINT profiles_setup_last_step_check
    CHECK (
      setup_last_step IS NULL OR setup_last_step IN (
        '/profile-setup', '/profile-setup-2', '/profile-setup-3', '/profile-setup-4'
      )
    ),
  CONSTRAINT profiles_setup_draft_object_check
    CHECK (jsonb_typeof(setup_draft) = 'object'),
  CONSTRAINT profiles_setup_draft_size_check
    CHECK (pg_column_size(setup_draft) <= 32768),
  CONSTRAINT profiles_setup_state_check
    CHECK (NOT setup_completed OR setup_last_step IS NULL),
  CONSTRAINT profiles_timestamp_order_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX idx_profiles_updated_at ON profiles (updated_at DESC);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION calorie_canvas_set_updated_at();

CREATE TABLE weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  value numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weights_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT weights_date_check
    CHECK (date >= DATE '1900-01-01' AND date <= CURRENT_DATE),
  CONSTRAINT weights_value_check
    CHECK (value > 0 AND value <= 2000),
  CONSTRAINT weights_unit_check
    CHECK (char_length(btrim(unit)) BETWEEN 1 AND 16)
);

CREATE INDEX idx_weights_user_date ON weights (user_id, date DESC, created_at DESC);
