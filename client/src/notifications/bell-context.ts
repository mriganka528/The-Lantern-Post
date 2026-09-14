import { createContext, useContext } from 'react';
export interface BellContextValue { unseen: number; openBell(): void; markItemSeen(id: string): void; }
export const BellContext = createContext<BellContextValue | null>(null);
export const usePalaceBell = () => useContext(BellContext);
