import { create } from 'zustand';

interface OnboardingDraft {
  ageConfirmedForEmail: string | null;
  ageConfirmedForSessionId: string | null;
  confirmMinimumAge: (email: string) => void;
  confirmMinimumAgeForSession: (sessionId: string) => void;
  clearSessionConfirmation: (sessionId: string) => void;
  clear: () => void;
}

// UI state only, scoped to the email that explicitly confirmed its age. Never
// persist a birth date, access token, refresh token, or complete Clerk session.
export const useOnboardingDraft = create<OnboardingDraft>((set) => ({
  ageConfirmedForEmail: null,
  ageConfirmedForSessionId: null,
  confirmMinimumAge: (email) => set({ ageConfirmedForEmail: email.trim().toLowerCase() }),
  confirmMinimumAgeForSession: (sessionId) => set({ ageConfirmedForSessionId: sessionId }),
  clearSessionConfirmation: (sessionId) => set((state) => state.ageConfirmedForSessionId === sessionId ? { ageConfirmedForSessionId: null } : {}),
  clear: () => set({ ageConfirmedForEmail: null, ageConfirmedForSessionId: null }),
}));
