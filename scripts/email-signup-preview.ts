// Isolated UI rehearsal only; no Clerk account, code, password or session leaves
// the browser. The real sign-in screen is exercised against these SDK states.
const state = { activated: '', emailAttempts: 0, updates: 0 };
if (typeof window !== 'undefined') Object.assign(window, { __emailPreview: state });
const signup = {
  status: 'missing_requirements', createdSessionId: null as string | null,
  missingFields: ['password'], unverifiedFields: ['email_address'],
  verifications: { emailAddress: { status: 'unverified' } },
  async create() { return this; }, async prepareEmailAddressVerification() { return this; },
  async attemptEmailAddressVerification({ code }: { code: string }) {
    state.emailAttempts++;
    if (code !== '123456') throw { errors: [{ code: 'form_code_incorrect' }] };
    this.verifications.emailAddress.status = 'verified'; this.unverifiedFields = []; return this;
  },
  async update(input: { password?: string }) {
    state.updates++;
    if (!input.password || input.password.length < 8) throw { errors: [{ code: 'form_password_length_too_short' }] };
    this.missingFields = []; this.status = 'complete'; this.createdSessionId = 'synthetic-session'; return this;
  },
};
export const useSignUp = () => ({ isLoaded: true, signUp: signup, setActive: async ({ session }: { session: string }) => { state.activated = session; } });
export const useSignIn = () => ({ isLoaded: true, signIn: { authenticateWithRedirect: async () => {} }, setActive: async () => {} });
