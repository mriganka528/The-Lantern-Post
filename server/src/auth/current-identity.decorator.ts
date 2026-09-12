import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthIdentity, IdentityRequest } from './auth.identity';

export const CurrentIdentity = createParamDecorator((_data: unknown, context: ExecutionContext): AuthIdentity => {
  const identity = context.switchToHttp().getRequest<IdentityRequest>().lanternPostIdentity;
  if (!identity) throw new UnauthorizedException('Sign in to continue.');
  return identity;
});
