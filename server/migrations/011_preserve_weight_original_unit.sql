ALTER TABLE weights
  ADD COLUMN original_unit text;

ALTER TABLE weights
  ADD CONSTRAINT weights_original_unit_check
    CHECK (
      original_unit IS NULL OR
      (original_unit = btrim(original_unit) AND char_length(original_unit) BETWEEN 1 AND 32)
    );

COMMENT ON COLUMN weights.original_unit IS
  'Exact source unit spelling retained by migration tooling; unit remains the normalized application value.';
