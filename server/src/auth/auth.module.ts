import { verifyToken } from '@clerk/backend';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CLERK_VERIFY_TOKEN, ClerkTokenVerifier } from './clerk-token-verifier.service';
import { AccountAccessModule } from '../account/account-access';

@Module({
  imports: [ConfigModule, AccountAccessModule],
  providers: [
    { provide: CLERK_VERIFY_TOKEN, useValue: verifyToken },
    ClerkTokenVerifier,
    ClerkAuthGuard,
  ],
  exports: [ClerkAuthGuard, ClerkTokenVerifier, AccountAccessModule],
})
export class AuthModule {}
