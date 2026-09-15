import { GoogleSignInError } from './google-flow';
import { NativeGoogleError } from './native-google-state';
import { EmailFlowError } from './email-flow';

export function clerkErrorMessage(error: unknown): string {
  if (error instanceof GoogleSignInError || error instanceof NativeGoogleError || error instanceof EmailFlowError) return error.message;
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
    case 'form_code_expired': return 'That code has expired. Request another code.';
    case 'form_password_pwned': return 'Choose a different password. This one has appeared in a known data breach.';
    case 'form_password_length_too_short': return 'Choose a longer password, with at least eight characters.';
    case 'form_password_validation_failed': return 'That password does not meet the account requirements. Please choose another.';
    case 'form_username_invalid_character': return 'Use letters, numbers and underscores for your username.';
    case 'form_username_length_too_short': return 'Choose a username with at least three characters.';
    case 'form_param_missing': return 'Complete the required account details to continue.';
    case 'too_many_requests': return 'Please wait a little before trying again.';
    default: return 'We could not complete that step. Please try again.';
  }
}
