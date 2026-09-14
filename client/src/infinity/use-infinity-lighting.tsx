import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
type InfinityLighting = 'day' | 'night';
const LightingContext = createContext<{ lighting: InfinityLighting; setLighting: (value: InfinityLighting) => void }>({ lighting: 'night', setLighting: () => {} });
// Each visit starts at night. Changing the view affects only this visit and
// never changes the independent, persistent ambient-motion preference.
export function InfinityLightingProvider({ children }: PropsWithChildren) {
  const [lighting, setLighting] = useState<InfinityLighting>('night');
  const value = useMemo(() => ({ lighting, setLighting }), [lighting]);
  return <LightingContext.Provider value={value}>{children}</LightingContext.Provider>;
}
export const useInfinityLighting = () => useContext(LightingContext);
