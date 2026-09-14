import type { WelcomeResult } from './welcome-notification';
export const welcomeAvailable = () => false;
export const ensureWelcome = async (_manual = false): Promise<WelcomeResult> => 'unavailable';
