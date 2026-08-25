const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateUsualInput } = require('../utils/usualValidation');

test('usual validation accepts personal portions without accepting browser ownership', () => {
  assert.deepEqual(validateUsualInput({
    meal_id: 'seed-cheetos',
    default_qty: 25,
    unit_code: 'g',
    position: 0,
  }), {
    meal_id: 'seed-cheetos',
    default_qty: 25,
    unit_code: 'g',
    position: 0,
  });
  assert.throws(() => validateUsualInput({
    meal_id: 'seed-cheetos',
    default_qty: 25,
    unit_code: 'g',
    user_id: '00000000-0000-4000-8000-000000000000',
  }), /ownership is derived/);
  assert.throws(() => validateUsualInput({
    meal_id: 'seed-cheetos',
    default_qty: 0,
    unit_code: 'g',
  }), /outside the allowed range/);
});

