import { verifyToken } from '@clerk/backend';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CLERK_VERIFY_TOKEN, ClerkTokenVerifier } from './clerk-token-verifier.service';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: CLERK_VERIFY_TOKEN, useValue: verifyToken },
    ClerkTokenVerifier,
    ClerkAuthGuard,
  ],
  exports: [ClerkAuthGuard, ClerkTokenVerifier],
})
export class AuthModule {}
