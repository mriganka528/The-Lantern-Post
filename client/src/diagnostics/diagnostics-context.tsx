import { createContext, useContext } from 'react';
import type { DiagnosticsInput } from '@lantern-post/shared-types';
export interface DiagnosticAction { name: DiagnosticsInput['name']; requestId?: string; code?: DiagnosticsInput['code']; }
export interface DiagnosticsContextValue { enabled: boolean; ready: boolean; busy: boolean; error: boolean; configure(enabled: boolean): Promise<void>; retry(): Promise<void>; track(action: DiagnosticAction, once?: string): void; }
export const DiagnosticsContext = createContext<DiagnosticsContextValue>({ enabled: false, ready: false, busy: false, error: false, configure: async () => {}, retry: async () => {}, track: () => {} });
export const useDiagnostics = () => useContext(DiagnosticsContext);
