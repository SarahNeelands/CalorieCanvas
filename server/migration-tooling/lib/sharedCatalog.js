const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSharedCatalog(sourcePath = path.resolve(__dirname, '../../../src/services/builtInIngredients.js')) {
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace('export const BUILT_IN_INGREDIENTS =', 'const BUILT_IN_INGREDIENTS =');
  const context = { result: null };
  vm.createContext(context);
  vm.runInContext(`${source}\nresult = BUILT_IN_INGREDIENTS;`, context, { filename: sourcePath, timeout: 1000 });
  if (!Array.isArray(context.result)) throw new Error('Authoritative built-in catalog did not produce an array.');
  return context.result.map((item) => ({
    ...item,
    unit_conversions: { ...(item.unit_conversions || {}), photo_data_url: undefined },
  }));
}

module.exports = { loadSharedCatalog };
