export interface AuthIdentity {
  readonly subject: string;
  readonly sessionId: string;
}

export interface IdentityRequest {
  headers: { authorization?: string | string[] };
  lanternPostIdentity?: AuthIdentity;
}
