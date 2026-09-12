import { Injectable, ServiceUnavailableException } from '@nestjs/common';

// The user explicitly deferred the live provider while building the product.
// Tests replace this provider in an isolated Nest test module. There is no
// production allow-all flag, preview identity, or route that bypasses this gate.
@Injectable()
export class LetterModerationService {
  get available(): boolean { return false; }
  async check(_text: string): Promise<'APPROVED' | 'REJECTED'> {
    throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable. Your letter has not been delivered.' });
  }
}
