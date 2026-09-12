export interface ClerkConfiguration {
  publishableKey: string | undefined;
  secretKey: string | undefined;
  issuer: string | undefined;
}

function setting(input: unknown, name: string): string | undefined {
  if (input === undefined || input === '') return undefined;
  if (typeof input !== 'string') throw new Error(`${name} must be a string.`);
  return input.trim() || undefined;
}

export function clerkConfiguration(input: Record<string, unknown>): ClerkConfiguration {
  const publishableKey = setting(input.CLERK_PUBLISHABLE_KEY, 'CLERK_PUBLISHABLE_KEY');
  const secretKey = setting(input.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY');
  let issuer: string | undefined;
  if (publishableKey) {
    const match = /^pk_(test|live)_([A-Za-z0-9_=-]+)$/.exec(publishableKey);
    if (!match?.[2]) throw new Error('CLERK_PUBLISHABLE_KEY must be a Clerk publishable key.');
    const decoded = Buffer.from(match[2], 'base64').toString('utf8');
    if (!/^[A-Za-z0-9.-]+\$$/.test(decoded)) throw new Error('CLERK_PUBLISHABLE_KEY has an invalid instance hostname.');
    const hostname = decoded.slice(0, -1);
    const url = new URL(`https://${hostname}`);
    if (url.hostname !== hostname || !hostname.includes('.')) throw new Error('CLERK_PUBLISHABLE_KEY has an invalid instance hostname.');
    issuer = url.origin;
  }
  if (secretKey && !/^sk_(test|live)_[A-Za-z0-9_-]+$/.test(secretKey)) {
    throw new Error('CLERK_SECRET_KEY must be a Clerk secret key stored only on the server.');
  }
  if (publishableKey && secretKey && publishableKey.split('_')[1] !== secretKey.split('_')[1]) {
    throw new Error('Clerk publishable and secret keys must use the same test/live mode.');
  }
  return { publishableKey, secretKey, issuer };
}
