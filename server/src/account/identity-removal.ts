import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { Environment } from '../config/environment';
@Injectable()
export class IdentityRemoval {
  constructor(private config: ConfigService<Environment, true>) {}
  async remove(subject: string) {
    const secretKey = this.config.get('CLERK_SECRET_KEY');
    if (!secretKey) throw Error('IDENTITY_UNAVAILABLE');
    try { await createClerkClient({ secretKey }).users.deleteUser(subject); }
    catch (error) { if (!error || typeof error !== 'object' || !('status' in error) || error.status !== 404) throw Error('IDENTITY_UNAVAILABLE'); }
  }
}
