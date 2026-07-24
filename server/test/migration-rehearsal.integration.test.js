const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { Pool } = require('pg');
const { runMigrations } = require('../migrations/run');
const { importMigration } = require('../migration-tooling/import');
const { verifyMigration } = require('../migration-tooling/verify');

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
function quote(value) { return `"${value.replaceAll('"','""')}"`; }
async function isolated() {
  const schema = `migration_${crypto.randomUUID().replaceAll('-','')}`;
  const admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` }); await runMigrations({ pool });
  return { pool, async cleanup() { await pool.end(); await admin.query(`DROP SCHEMA ${quote(schema)} CASCADE`); await admin.end(); } };
}

function fixture() {
  const user = '11111111-1111-4111-8111-111111111111';
  const meal = '22222222-2222-4222-8222-222222222222';
  return { formatVersion: 1, exportedAt: '2026-01-02T00:00:00.000Z', source: { kind: 'supabase-postgresql', identityHash: 'a'.repeat(64), readOnlySnapshot: true }, audit: { weightUnits: ['KGS'] }, tables: {
    authUsers: [{ id:user,email:' Test@Example.com ',email_confirmed_at:'2025-01-01T00:00:00Z',created_at:'2024-01-01T00:00:00Z',updated_at:'2025-01-01T00:00:00Z',last_sign_in_at:'2025-12-01T00:00:00Z' }],
    profiles: [{ user_id:user,display_name:'Test',dob:'1990-01-01',gender:'unspecified',height_cm:175,weight_kg:65,activity_level:'sedentary',goal_weight_intent:'maintain',goal_muscle_intent:'maintain',calorie_goal:2000,target_weight_kg:65,target_body_fat_pct:null,pref_show_calories:true,pref_show_macros:true,pref_show_micros:false,pref_show_exercise:true,pref_show_weight:true,setup_completed:true,setup_last_step:null,setup_draft:{},created_at:'2024-01-01T00:00:00Z',updated_at:'2025-01-01T00:00:00Z' }],
    meals: [{ id:meal,user_id:user,title:'Oats',type:'meal',created_at:'2025-02-01T00:00:00Z',kcal_per_100g:100,protein_g_per_100g:4,carbs_g_per_100g:20,fat_g_per_100g:2,unit_conversions:{serving_size:{qty:100,unit:'g'},macros:{fiber:5,sugar:1,cholesterol:0},micros:{sodium:{value:10},potassium:{value:20},calcium:{value:30},iron:{value:2},vitaminA:{value:3},vitaminC:{value:4}}},food_id:'oats' }],
    mealLogs: [{ id:'33333333-3333-4333-8333-333333333333',user_id:user,meal_id:meal,food_id:'oats',qty:1,unit_code:'g',grams_resolved:50,logged_at:'2025-03-01T23:30:00Z',kcal:50,protein_g:2,carbs_g:10,fat_g:1 }],
    weights: [{ id:'44444444-4444-4444-8444-444444444444',user_id:user,date:'2025-03-02',value:70,unit:'KGS',created_at:'2025-03-02T12:00:00Z' }],
    exerciseTypes: [{ id:'custom-lift',user_id:user,name:'Custom Lift',created_at:'2025-01-01T00:00:00Z' },{ id:'run',user_id:user,name:'Running',created_at:'2025-01-01T00:00:00Z' }],
    exerciseLogs: [{ id:'55555555-5555-4555-8555-555555555555',user_id:user,type_id:'custom-lift',minutes:30,timestamp_iso:'2025-03-03T10:00:00Z',created_at:'2025-03-03T10:00:00Z' }],
  } };
}

integrationTest('six disposable migration rehearsal scenarios are repeatable, transactional, repairable, partial-safe, verified, and dry', async () => {
  const data = fixture();
  const empty = await isolated();
  try {
    const first = await importMigration({ pool:empty.pool,data });
    assert.equal(first.status,'committed');
    assert.equal((await verifyMigration({ pool:empty.pool,data })).status,'verified');
    const replay = await importMigration({ pool:empty.pool,data });
    assert.equal(replay.counts.users.existingMatching,1);
    assert.equal((await empty.pool.query('SELECT count(*)::int count FROM meal_logs')).rows[0].count,1);
    assert.equal((await verifyMigration({ pool:empty.pool,data })).status,'verified');
  } finally { await empty.cleanup(); }

  const interrupted = await isolated();
  try {
    await assert.rejects(importMigration({ pool:interrupted.pool,data,failAfter:'catalog' }), /Deliberate rehearsal failure/);
    assert.equal((await interrupted.pool.query('SELECT count(*)::int count FROM users')).rows[0].count,0);
    assert.equal((await verifyMigration({ pool:interrupted.pool,data })).status,'review-required');
    assert.equal((await importMigration({ pool:interrupted.pool,data })).status,'committed');
    assert.equal((await verifyMigration({ pool:interrupted.pool,data })).status,'verified');
  } finally { await interrupted.cleanup(); }

  const partial = await isolated();
  try {
    const user=data.tables.authUsers[0]; await partial.pool.query(`INSERT INTO users(id,email,password_hash,must_reset_password,created_at,updated_at) VALUES($1,$2,NULL,true,$3,$4)`,[user.id,'test@example.com',user.created_at,user.updated_at]);
    await partial.pool.query(`INSERT INTO weights(user_id,date,value,unit) VALUES($1,'2025-03-02',70,'kg')`,[user.id]);
    const imported=await importMigration({pool:partial.pool,data}); assert.equal(imported.counts.users.existingMatching,1);
    assert.equal(imported.counts.weights.deduplicatedInitialProfileWeight,1);
    assert.equal((await partial.pool.query('SELECT count(*)::int count FROM weights WHERE user_id=$1',[user.id])).rows[0].count,1);
    assert.equal((await verifyMigration({pool:partial.pool,data})).status,'verified');
    const before=(await partial.pool.query('SELECT count(*)::int count FROM users')).rows[0].count;
    const dry=await importMigration({pool:partial.pool,data,dryRun:true}); assert.equal(dry.status,'dry-run-rolled-back');
    assert.equal((await partial.pool.query('SELECT count(*)::int count FROM users')).rows[0].count,before);
    assert.equal((await verifyMigration({pool:partial.pool,data})).status,'verified');
  } finally { await partial.cleanup(); }
});
