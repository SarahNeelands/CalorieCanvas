const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertDestinationSafety, databaseIdentity } = require('../migration-tooling/lib/safety');
const { loadSharedCatalog } = require('../migration-tooling/lib/sharedCatalog');
const { normalizeEmail, normalizeWeightUnit, stripEmbeddedMedia, validateProfile } = require('../migration-tooling/lib/transform');
const { TABLE_QUERIES, exportSupabase } = require('../migration-tooling/export-supabase');

test('destination safety rejects source identity, Supabase destinations, and unconfirmed production', () => {
  const source = 'postgresql://reader:secret@db.example.test:5432/source';
  assert.throws(() => assertDestinationSafety({ destinationUrl: source, sourceUrl: source }), /source database/);
  assert.throws(() => assertDestinationSafety({ destinationUrl: 'postgresql://x:y@abc.supabase.co/db', confirmProduction: true }), /cannot be used/);
  assert.throws(() => assertDestinationSafety({ destinationUrl: 'postgresql://x:y@178.156.250.200/db' }), /appears to be production/);
  assert.doesNotThrow(() => assertDestinationSafety({ destinationUrl: 'postgresql://x:y@127.0.0.1/rehearsal', sourceIdentity: databaseIdentity(source) }));
});

test('transformations are explicit and reject unknown or questionable values', () => {
  assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail('invalid'), null);
  assert.equal(normalizeWeightUnit('KILOGRAMS'), 'kg');
  assert.equal(normalizeWeightUnit('stone'), null);
  assert.deepEqual(validateProfile({ activity_level: 'unknown', setup_draft: {} }), ['invalid_activity_level']);
  const media = stripEmbeddedMedia({ photo_data_url: 'data:image/png;base64,AAAA', macros: { calories: 10 } });
  assert.equal(media.value.photo_data_url, undefined);
  assert.ok(media.removedPhotoBytes > 0);
});

test('Supabase auth export is metadata allowlisted and shared catalog uses stable IDs without photos', () => {
  const authQuery = TABLE_QUERIES.authUsers.toLowerCase();
  for (const prohibited of ['encrypted_password','confirmation_token','recovery_token','refresh_token']) assert.equal(authQuery.includes(prohibited), false);
  const catalog = loadSharedCatalog();
  assert.equal(catalog.length, 70);
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
  assert.ok(catalog.every((item) => item.id.startsWith('seed-vegetable-') && item.unit_conversions.photo_data_url === undefined));
});

test('Supabase export transaction is explicitly read-only and issues only allowlisted reads', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('SELECT')) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const result = await exportSupabase({
    pool: { async connect() { return client; } },
    sourceUrl: 'postgresql://reader:redacted@source.example.test/postgres',
  });
  assert.equal(statements[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.deepEqual(statements.slice(1, -1), Object.values(TABLE_QUERIES));
  assert.equal(statements.at(-1), 'COMMIT');
  assert.equal(result.source.readOnlySnapshot, true);
});
