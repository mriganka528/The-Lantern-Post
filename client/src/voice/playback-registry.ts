const players = new Set<() => void>();
export const pauseVoicePlayback = () => players.forEach(pause => { try { pause(); } catch { /* A released native player is already silent. */ } });
export const registerVoicePlayer = (pause: () => void) => { players.add(pause); return () => { players.delete(pause); }; };
