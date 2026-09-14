import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import type { AuthIdentity } from './auth.identity';

export const CLERK_VERIFY_TOKEN = Symbol('CLERK_VERIFY_TOKEN');

export interface ClerkClaims {
  sub?: unknown;
  sid?: unknown;
  iss?: unknown;
  exp?: unknown;
  azp?: unknown;
  sts?: unknown;
}

export type VerifyClerkToken = (token: string, options: {
  secretKey: string;
  authorizedParties: string[];
  clockSkewInMs: number;
}) => Promise<ClerkClaims>;

@Injectable()
export class ClerkTokenVerifier {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    @Inject(CLERK_VERIFY_TOKEN) private readonly verifyToken: VerifyClerkToken,
  ) {}

  async verify(token: string): Promise<AuthIdentity> {
    const secretKey = this.config.get('CLERK_SECRET_KEY');
    const publishableKey = this.config.get('CLERK_PUBLISHABLE_KEY');
    const issuer = this.config.get('CLERK_ISSUER');
    if (!secretKey || !publishableKey || !issuer) {
      throw new ServiceUnavailableException('Sign-in is not configured.');
    }

    try {
      const parties = [...this.config.get('CLERK_AUTHORIZED_PARTIES'), ...this.config.get('WEB_ORIGINS')];
      // Clerk retrieves and caches this instance's signing keys through its
      // backend API. Neither the secret nor a PEM key belongs in the Expo app.
      const claims = await this.verifyToken(token, { secretKey, authorizedParties: parties, clockSkewInMs: 5000 });
      if (
        claims.iss !== issuer ||
        typeof claims.sub !== 'string' || !claims.sub.startsWith('user_') ||
        typeof claims.sid !== 'string' || !claims.sid.startsWith('sess_') ||
        typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 - 5 ||
        (claims.sts !== undefined && claims.sts !== 'active') ||
        (claims.azp !== undefined && (typeof claims.azp !== 'string' || !parties.includes(claims.azp)))
      ) {
        throw new Error('Invalid session claims');
      }
      return Object.freeze({ subject: claims.sub, sessionId: claims.sid, expiresAt: claims.exp * 1000 });
    } catch (error) {
      if (error && typeof error === 'object' && 'reason' in error &&
        ['jwk-remote-failed-to-load', 'secret-key-invalid'].includes(String(error.reason))) {
        throw new ServiceUnavailableException('Sign-in verification is temporarily unavailable.');
      }
      // Never return SDK errors, tokens, issuer details, or key material.
      throw new UnauthorizedException('Your session is not valid. Please sign in again.');
    }
  }
}
