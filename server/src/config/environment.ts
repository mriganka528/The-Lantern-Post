import { databaseConfiguration } from './database';
import { clerkConfiguration } from './clerk';
import type { S3Settings } from '../voice/s3-signing';
import { sentrySettings } from '../diagnostics/diagnostics-contract';
import type { SentrySettings } from '../diagnostics/diagnostics-contract';
import { driveSettings } from '../backups/drive-config';
import type { DriveSettings } from '../backups/drive-config';
import { supabaseVoiceSettings } from '../voice/supabase-settings';
import type { SupabaseVoiceSettings } from '../voice/supabase-settings';
import { webOrigins } from './web-origins';

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
  VOICE_STORAGE: S3Settings | undefined;
  SUPABASE_VOICE_STORAGE: SupabaseVoiceSettings | undefined;
  DIAGNOSTICS_SENTRY: SentrySettings | undefined;
  GOOGLE_DRIVE: DriveSettings | undefined;
  MODERATION_MODE: 'disabled' | 'required';
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
  const moderationMode = input.MODERATION_MODE ?? 'disabled';
  if (moderationMode !== 'disabled' && moderationMode !== 'required') throw new Error('MODERATION_MODE must be disabled or required.');
  const pushEnabled = input.EXPO_PUSH_ENABLED ?? 'false';
  if (!['true', 'false'].includes(String(pushEnabled))) throw new Error('EXPO_PUSH_ENABLED must be true or false.');

  const clerk = clerkConfiguration(input);
  const sentryDsn = optionalString(input.DIAGNOSTICS_SENTRY_DSN, 'DIAGNOSTICS_SENTRY_DSN');
  const voiceValues = ['VOICE_STORAGE_ENDPOINT', 'VOICE_STORAGE_BUCKET', 'VOICE_STORAGE_REGION', 'VOICE_STORAGE_ACCESS_KEY_ID', 'VOICE_STORAGE_SECRET_ACCESS_KEY'].map(key => optionalString(input[key], key));
  let voiceStorage: S3Settings | undefined;
  if (voiceValues.some(Boolean)) {
    if (voiceValues.some(value => !value)) throw new Error('Configure all VOICE_STORAGE settings, or leave all of them empty.');
    const [endpoint, bucket, region, accessKeyId, secretAccessKey] = voiceValues as [string, string, string, string, string];
    let parsed: URL;
    try { parsed = new URL(endpoint); } catch { throw new Error('VOICE_STORAGE_ENDPOINT must be a valid S3-compatible endpoint.'); }
    if ((parsed.protocol !== 'https:' && !(nodeEnv !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !/^[a-z0-9-]{1,32}$/.test(region)) throw new Error('VOICE_STORAGE requires a valid private S3-compatible endpoint, bucket and region.');
    voiceStorage = { endpoint: parsed.origin, bucket, region, accessKeyId, secretAccessKey };
  }
  const supabaseStorage=supabaseVoiceSettings(input,nodeEnv==='production');
  if(voiceStorage&&supabaseStorage)throw Error('Choose one voice-storage provider: Supabase or S3, not both.');
  if (nodeEnv === 'production' && (!clerk.publishableKey || !clerk.secretKey)) {
    throw new Error('Clerk publishable and secret keys are required in production.');
  }

  const authorizedParties = optionalString(input.CLERK_AUTHORIZED_PARTIES, 'CLERK_AUTHORIZED_PARTIES')
    ?.split(',').map((party) => party.trim()).filter(Boolean) ?? [];

  const allowedWebOrigins = webOrigins(nodeEnv === 'production',
    optionalString(input.WEB_ORIGINS, 'WEB_ORIGINS'),
    optionalString(input.DEVELOPMENT_WEB_ORIGINS, 'DEVELOPMENT_WEB_ORIGINS'));

  return {
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: port,
    DATABASE_URL: database.url,
    // Derived from trusted server configuration, never from an incoming token.
    CLERK_ISSUER: clerk.issuer,
    CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
    CLERK_SECRET_KEY: clerk.secretKey,
    CLERK_AUTHORIZED_PARTIES: [...new Set(authorizedParties)],
    WEB_ORIGINS: allowedWebOrigins,
    EXPO_PUSH_ENABLED: String(pushEnabled) === 'true',
    EXPO_ACCESS_TOKEN: optionalString(input.EXPO_ACCESS_TOKEN, 'EXPO_ACCESS_TOKEN'),
    VOICE_STORAGE: voiceStorage,
    SUPABASE_VOICE_STORAGE: supabaseStorage,
    DIAGNOSTICS_SENTRY: sentryDsn ? sentrySettings(sentryDsn) : undefined,
    GOOGLE_DRIVE: driveSettings(input, nodeEnv === 'production'),
    MODERATION_MODE: moderationMode,
  };
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  return value.trim() || undefined;
}
