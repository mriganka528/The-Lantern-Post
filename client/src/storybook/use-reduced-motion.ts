import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useMotionPreference() {
  // Start still until the accessibility preference has been read.
  const [preference, setPreference] = useState({ reduced: true, ready: false });
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => setPreference({ reduced, ready: true }));
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => { if (active) setPreference({ reduced, ready: true }); })
      .catch(() => { if (active) setPreference({ reduced: true, ready: true }); });
    return () => { active = false; subscription.remove(); };
  }, []);
  return preference;
}

export function useReducedMotion() { return useMotionPreference().reduced; }
