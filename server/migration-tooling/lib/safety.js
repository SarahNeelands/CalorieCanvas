const crypto = require('node:crypto');

function parseDatabaseUrl(value, name) {
  if (!value) throw new Error(`${name} is required.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid PostgreSQL URL.`); }
  if (!new Set(['postgres:', 'postgresql:']).has(url.protocol)) {
    throw new Error(`${name} must use postgres:// or postgresql://.`);
  }
  if (!url.hostname || !url.pathname.slice(1)) throw new Error(`${name} must include a host and database name.`);
  return url;
}

function databaseIdentity(value) {
  const url = parseDatabaseUrl(value, 'Database URL');
  const identity = `${url.hostname.toLowerCase()}:${url.port || '5432'}/${url.pathname.slice(1).toLowerCase()}`;
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function appearsProduction(url, environment = process.env) {
  const database = url.pathname.slice(1).toLowerCase();
  const host = url.hostname.toLowerCase();
  return environment.NODE_ENV === 'production'
    || environment.MIGRATION_ENVIRONMENT === 'production'
    || /(^|[-_])(prod|production)([-_]|$)/.test(database)
    || host.includes('supabase.co')
    || host === '178.156.250.200';
}

function assertDestinationSafety({ destinationUrl, sourceUrl, sourceIdentity, confirmProduction = false, environment }) {
  const destination = parseDatabaseUrl(destinationUrl, 'MIGRATION_DESTINATION_DATABASE_URL');
  const destinationIdentity = databaseIdentity(destinationUrl);
  if (destination.hostname.toLowerCase().includes('supabase.co')) {
    throw new Error('A Supabase-hosted database cannot be used as the migration destination.');
  }
  if (sourceUrl && destinationIdentity === databaseIdentity(sourceUrl)) {
    throw new Error('Destination database resolves to the configured Supabase source database.');
  }
  if (sourceIdentity && destinationIdentity === sourceIdentity) {
    throw new Error('Destination database identity matches the exported source database.');
  }
  if (appearsProduction(destination, environment) && !confirmProduction) {
    throw new Error('Destination appears to be production. Re-run with --confirm-production only after explicit approval.');
  }
  return { destination, destinationIdentity };
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function option(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  const value = argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

module.exports = {
  appearsProduction,
  assertDestinationSafety,
  databaseIdentity,
  hasFlag,
  option,
  parseDatabaseUrl,
};
