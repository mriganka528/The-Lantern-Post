export interface DatabaseConfiguration {
  url: string;
  migrationUrl: string;
  shadowDatabaseUrl?: string;
}

function parseDatabaseUrl(value: unknown, name: string): URL {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required. Set DATABASE_URL in server/.env.`);
  }
  let url: URL;
  try { url = new URL(value); } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1 || url.hash) {
    throw new Error(`${name} must identify a PostgreSQL host and database without a URL fragment.`);
  }
  if (isNeon(url)) {
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode && !['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      throw new Error(`${name} must require TLS for Neon (sslmode=require or stricter).`);
    }
    if (!sslMode) url.searchParams.set('sslmode', 'require');
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  }
  return url;
}

function isNeon(url: URL): boolean {
  return url.hostname.endsWith('.neon.tech');
}

function directHostname(url: URL): string {
  return isNeon(url) ? url.hostname.replace(/-pooler(?=\.)/, '') : url.hostname;
}

function databaseIdentity(url: URL): string {
  // Pooling, credentials, and query parameters do not make a database distinct.
  // This also prevents using another schema in the live database as a shadow.
  return `${directHostname(url)}:${url.port || '5432'}${url.pathname}`;
}

export function databaseConfiguration(input: Record<string, unknown>): DatabaseConfiguration {
  const runtime = parseDatabaseUrl(input.DATABASE_URL, 'DATABASE_URL');
  if (isNeon(runtime) && !runtime.searchParams.has('connection_limit')) runtime.searchParams.set('connection_limit', '5');

  const directValue = typeof input.DIRECT_URL === 'string' ? input.DIRECT_URL.trim() : input.DIRECT_URL;
  const migration = directValue ? parseDatabaseUrl(directValue, 'DIRECT_URL') : new URL(runtime);
  if (isNeon(runtime)) {
    if (databaseIdentity(migration) !== databaseIdentity(runtime) ||
      (migration.searchParams.get('schema') || 'public') !== (runtime.searchParams.get('schema') || 'public')) {
      throw new Error('DIRECT_URL must point to the same Neon endpoint, database, and schema as DATABASE_URL.');
    }
    if (directValue && migration.hostname.includes('-pooler.')) {
      throw new Error('DIRECT_URL must be the unpooled Neon connection URL.');
    }
    // Neon publishes pooled and direct connections with the same endpoint,
    // database, and credentials; only the documented -pooler host label differs.
    migration.hostname = directHostname(runtime);
  }

  const shadowValue = typeof input.SHADOW_DATABASE_URL === 'string' ? input.SHADOW_DATABASE_URL.trim() : input.SHADOW_DATABASE_URL;
  let shadow: URL | undefined;
  if (shadowValue) {
    shadow = parseDatabaseUrl(shadowValue, 'SHADOW_DATABASE_URL');
    if (databaseIdentity(shadow) === databaseIdentity(runtime) || databaseIdentity(shadow) === databaseIdentity(migration)) {
      throw new Error('SHADOW_DATABASE_URL must use a separate database or Neon branch, never the application database.');
    }
    shadow.hostname = directHostname(shadow);
  }

  return {
    url: runtime.toString(),
    migrationUrl: migration.toString(),
    ...(shadow ? { shadowDatabaseUrl: shadow.toString() } : {}),
  };
}
