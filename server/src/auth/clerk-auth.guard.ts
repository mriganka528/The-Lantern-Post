import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { IdentityRequest } from './auth.identity';
import { ClerkTokenVerifier } from './clerk-token-verifier.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly tokens: ClerkTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' ? /^Bearer ([^\s,]+)$/i.exec(authorization) : null;
    const token = match?.[1];
    if (!token) throw new UnauthorizedException('Sign in to continue.');
    request.lanternPostIdentity = await this.tokens.verify(token);
    return true;
  }
}
