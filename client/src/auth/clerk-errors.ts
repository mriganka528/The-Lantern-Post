import { GoogleSignInError } from './google-flow';
import { NativeGoogleError } from './native-google-state';

export function clerkErrorMessage(error: unknown): string {
  if (error instanceof GoogleSignInError || error instanceof NativeGoogleError) return error.message;
  let code: unknown;
  if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors)) {
    const first: unknown = error.errors[0];
    if (first && typeof first === 'object' && 'code' in first) code = first.code;
  }
  switch (code) {
    case 'form_identifier_not_found': return 'We could not find that account. Create an account to get started.';
    case 'form_identifier_exists': return 'An account already uses this email. Sign in instead.';
    case 'form_code_incorrect': return 'That code did not match. Please try again.';
    case 'verification_expired': return 'That code has expired. Request another code.';
    case 'too_many_requests': return 'Please wait a little before trying again.';
    default: return 'We could not complete that step. Please try again.';
  }
}
