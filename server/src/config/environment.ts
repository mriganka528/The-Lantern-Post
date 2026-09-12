import { databaseConfiguration } from './database';
import { clerkConfiguration } from './clerk';

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  CLERK_ISSUER: string | undefined;
  CLERK_PUBLISHABLE_KEY: string | undefined;
  CLERK_SECRET_KEY: string | undefined;
  CLERK_AUTHORIZED_PARTIES: string[];
  WEB_ORIGINS: string[];
  EXPO_PUSH_ENABLED: boolean;
  EXPO_ACCESS_TOKEN: string | undefined;
}

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const nodeEnv = input.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(nodeEnv))) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const port = Number(input.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const database = databaseConfiguration(input);
  const pushEnabled = input.EXPO_PUSH_ENABLED ?? 'false';
  if (!['true', 'false'].includes(String(pushEnabled))) throw new Error('EXPO_PUSH_ENABLED must be true or false.');

  const clerk = clerkConfiguration(input);
  if (nodeEnv === 'production' && (!clerk.publishableKey || !clerk.secretKey)) {
    throw new Error('Clerk publishable and secret keys are required in production.');
  }

  const authorizedParties = optionalString(input.CLERK_AUTHORIZED_PARTIES, 'CLERK_AUTHORIZED_PARTIES')
    ?.split(',').map((party) => party.trim()).filter(Boolean) ?? [];

  const origins = optionalString(input.WEB_ORIGINS, 'WEB_ORIGINS')
    ?? (nodeEnv === 'production' ? '' : 'http://localhost:8081,http://127.0.0.1:8081');
  const webOrigins = origins.split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('WEB_ORIGINS must contain exact HTTP(S) origins.'); }
    const localDevelopment = nodeEnv !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!['http:', 'https:'].includes(url.protocol)) || (url.protocol === 'http:' && !localDevelopment) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('WEB_ORIGINS requires HTTPS origins, or HTTP loopback origins during development.');
    }
    return url.origin;
  });

  return {
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: port,
    DATABASE_URL: database.url,
    // Derived from trusted server configuration, never from an incoming token.
    CLERK_ISSUER: clerk.issuer,
    CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
    CLERK_SECRET_KEY: clerk.secretKey,
    CLERK_AUTHORIZED_PARTIES: [...new Set(authorizedParties)],
    WEB_ORIGINS: [...new Set(webOrigins)],
    EXPO_PUSH_ENABLED: String(pushEnabled) === 'true',
    EXPO_ACCESS_TOKEN: optionalString(input.EXPO_ACCESS_TOKEN, 'EXPO_ACCESS_TOKEN'),
  };
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  return value.trim() || undefined;
}
