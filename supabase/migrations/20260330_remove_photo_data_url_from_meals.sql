-- Remove legacy OCR photo payloads from saved meals/snacks/ingredients.
-- This keeps extracted nutrition values while deleting embedded image data.

update public.meals
set unit_conversions = unit_conversions - 'photo_data_url'
where unit_conversions ? 'photo_data_url';
