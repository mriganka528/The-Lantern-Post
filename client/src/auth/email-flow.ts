export type SignupField = 'first_name' | 'last_name' | 'username' | 'password' | 'legal_accepted';
const fields: readonly string[] = ['first_name', 'last_name', 'username', 'password', 'legal_accepted'];
export class EmailFlowError extends Error {}
export interface SignupResult {
  status: string | null; createdSessionId: string | null;
  missingFields: readonly string[]; unverifiedFields: readonly string[];
  verifications: { emailAddress: { status: string | null } };
}
export function signupNextStep(attempt: SignupResult): { kind: 'complete'; sessionId: string } | { kind: 'details'; fields: SignupField[] } {
  if (attempt.status === 'complete' && attempt.createdSessionId) return { kind: 'complete', sessionId: attempt.createdSessionId };
  if (attempt.status === 'complete') throw new EmailFlowError('Your account was created. Return to sign-in and request an email code to open it.');
  if (attempt.verifications.emailAddress.status !== 'verified') throw new EmailFlowError('Your email has not been verified yet. Request a fresh code and try again.');
  if (attempt.status === 'missing_requirements' && attempt.missingFields.length && attempt.missingFields.every(field => fields.includes(field)) && attempt.unverifiedFields.length === 0) return { kind: 'details', fields: [...attempt.missingFields] as SignupField[] };
  throw new EmailFlowError('Your email is verified, but this account needs another verification method. Return to sign-in and continue with Google.');
}
