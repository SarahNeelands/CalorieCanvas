/*
 * Paste this entire file into the browser developer console while signed in to
 * Calorie Canvas. It downloads a copy and deliberately leaves localStorage unchanged.
 * Treat the resulting JSON as sensitive user data.
 */
(() => {
  const keys = [
    'cc.weights',
    'exercise_page_state_v3',
    'pending_catalog_sync_v1',
    'local_catalog_items_v1',
    'local_meal_logs_v1',
  ];
  const records = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try { records[key] = JSON.parse(raw); }
    catch { records[key] = { parseError: true, rawValuePreserved: raw }; }
  }
  const payload = {
    formatVersion: 1,
    kind: 'calorie-canvas-browser-data',
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    records,
  };
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `calorie-canvas-browser-data-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  console.info(`Exported ${Object.keys(records).length} localStorage records. Nothing was deleted.`);
})();
