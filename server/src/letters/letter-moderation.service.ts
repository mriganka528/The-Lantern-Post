import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import type { ContentDecision } from './content-review';

// Automated moderation is disabled for the current release at the user's
// request. NOT_REQUIRED permits delivery without pretending a check occurred.
// Required mode stays unavailable until a real provider is implemented later.
@Injectable()
export class LetterModerationService {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  get disabled(): boolean { return this.config.get('MODERATION_MODE') === 'disabled'; }
  get available(): boolean { return this.config.get('MODERATION_MODE') === 'disabled'; }
  get voiceAvailable(): boolean { return this.available; }
  async check(_text: string, signal?: AbortSignal): Promise<ContentDecision> {
    signal?.throwIfAborted();
    if (this.available) return 'NOT_REQUIRED';
    throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable. Your letter has not been delivered.' });
  }
  async checkVoice(_voice: { bytes: Uint8Array; mimeType: string; durationMs: number }, signal?: AbortSignal): Promise<ContentDecision> {
    signal?.throwIfAborted();
    if (this.voiceAvailable) return 'NOT_REQUIRED';
    throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The voice-letter check is unavailable.' });
  }
}
