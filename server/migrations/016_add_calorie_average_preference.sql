ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pref_show_calorie_average boolean NOT NULL DEFAULT true;
