const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  listMigrationFiles,
  validateMigrationFiles,
  verifyAppliedMigrations,
} = require('../migrations/run');

test('migration discovery returns the complete deterministic sequence', async () => {
  assert.deepEqual(await listMigrationFiles(), [
    { version: 1, name: '001_create_users.sql' },
    { version: 2, name: '002_create_sessions.sql' },
    { version: 3, name: '003_create_password_reset_tokens.sql' },
    { version: 4, name: '004_create_email_verification_tokens.sql' },
    { version: 5, name: '005_add_updated_at_triggers.sql' },
    { version: 6, name: '006_create_profiles_and_weights.sql' },
    { version: 7, name: '007_create_catalog.sql' },
    { version: 8, name: '008_create_meal_logs.sql' },
    { version: 9, name: '009_extend_weights.sql' },
    { version: 10, name: '010_create_exercises.sql' },
    { version: 11, name: '011_preserve_weight_original_unit.sql' },
    { version: 12, name: '012_create_data_seed_ledger.sql' },
    { version: 13, name: '013_create_food_usuals.sql' },
    { version: 14, name: '014_require_native_accounts.sql' },
    { version: 15, name: '015_add_usuals_dashboard_preference.sql' },
  ]);
});

test('migration validation rejects gaps, duplicates, and invalid names', () => {
  assert.throws(
    () => validateMigrationFiles(['001_first.sql', '003_third.sql']),
    /not contiguous/
  );
  assert.throws(
    () => validateMigrationFiles(['001_first.sql', '001_duplicate.sql']),
    /not contiguous/
  );
  assert.throws(
    () => validateMigrationFiles(['1_missing_padding.sql']),
    /Invalid migration filename/
  );
});

test('applied migration verification rejects reordered or modified files', () => {
  const available = [
    { version: 1, name: '001_first.sql', checksum: 'expected' },
    { version: 2, name: '002_second.sql', checksum: 'expected-2' },
  ];

  assert.throws(
    () => verifyAppliedMigrations(available, [
      { version: 2, name: '002_second.sql', checksum: 'expected-2' },
    ]),
    /order does not match/
  );
  assert.throws(
    () => verifyAppliedMigrations(available, [
      { version: 1, name: '001_first.sql', checksum: 'changed' },
    ]),
    /has changed/
  );
});
