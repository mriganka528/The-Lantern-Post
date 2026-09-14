export interface AuthIdentity {
  readonly subject: string;
  readonly sessionId: string;
  readonly expiresAt?: number;
}

export interface IdentityRequest {
  headers: { authorization?: string | string[] };
  lanternPostIdentity?: AuthIdentity;
}
