const crypto = require('node:crypto');
const { loadSharedCatalog } = require('../migration-tooling/lib/sharedCatalog');

const SEED_NAME = 'shared_catalog_v1';

function seedChecksum(items) {
  return crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

async function seedSharedCatalog(poolOrClient) {
  const items = loadSharedCatalog();
  const checksum = seedChecksum(items);
  const isConnectedClient = typeof poolOrClient.release === 'function';
  const client = isConnectedClient ? poolOrClient : await poolOrClient.connect();
  const shouldRelease = client !== poolOrClient;
  try {
    await client.query('BEGIN');
    const applied = await client.query('SELECT checksum FROM app_data_seeds WHERE name=$1 FOR UPDATE', [SEED_NAME]);
    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error('The authoritative shared catalog changed after shared_catalog_v1 was applied; add a new reviewed seed version.');
      }
      await client.query('COMMIT');
      return { applied: false, count: items.length, checksum };
    }
    for (const item of items) {
      await client.query(
        `INSERT INTO shared_catalog_items (
           id,title,type,created_at,updated_at,kcal_per_100g,protein_g_per_100g,
           carbs_g_per_100g,fat_g_per_100g,unit_conversions,food_id
         ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT (id) DO UPDATE SET
           title=EXCLUDED.title,type=EXCLUDED.type,created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at,kcal_per_100g=EXCLUDED.kcal_per_100g,
           protein_g_per_100g=EXCLUDED.protein_g_per_100g,
           carbs_g_per_100g=EXCLUDED.carbs_g_per_100g,fat_g_per_100g=EXCLUDED.fat_g_per_100g,
           unit_conversions=EXCLUDED.unit_conversions,food_id=EXCLUDED.food_id`,
        [
          item.id, item.title, item.type, item.created_at, item.kcal_per_100g,
          item.protein_g_per_100g, item.carbs_g_per_100g, item.fat_g_per_100g,
          JSON.stringify(item.unit_conversions || {}), item.food_id ?? null,
        ]
      );
    }
    await client.query('INSERT INTO app_data_seeds(name,checksum) VALUES($1,$2)', [SEED_NAME, checksum]);
    await client.query('COMMIT');
    return { applied: true, count: items.length, checksum };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (shouldRelease) client.release();
  }
}

module.exports = { SEED_NAME, seedChecksum, seedSharedCatalog };
