CREATE TABLE app_data_seeds (
  name text PRIMARY KEY,
  checksum char(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_data_seeds_name_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT app_data_seeds_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$')
);
