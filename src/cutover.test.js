const fs = require('node:fs');
const path = require('node:path');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

test('the React runtime contains no Supabase client, mode switch, or browser database credentials', () => {
  const files = sourceFiles(path.resolve(__dirname))
    .filter((file) => !file.endsWith('cutover.test.js'));
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const prohibited of [
    '@supabase/supabase-js',
    'supabaseClient',
    'REACT_APP_SUPABASE',
    'REACT_APP_AUTH_MODE',
    'SUPABASE_SOURCE_DATABASE_URL',
  ]) expect(source).not.toContain(prohibited);
});
