// Live integer game-hour context for the interior building subtree.
//
// Windows and hearths are tagged at bake time with a `lightRole` but carry NO
// baked emissive. The renderer decides emissive live from the building's hourly
// schedule (`litHours` / `hearthHours`) against the current game hour. This
// module publishes that hour as an INTEGER (0-23) so the subtree re-renders
// only on the hour boundary, not per frame, and exposes the pure per-part
// emissive resolver both the material and its tests use.
import React, { createContext, useContext, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { WINDOW_GLOW_HEX, HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

/** The live integer game hour (0-23) for the building subtree. */
export const InteriorHourContext = createContext<number>(12);
export const useInteriorHour = (): number => useContext(InteriorHourContext);

const DARK = { emissive: '#000000', emissiveIntensity: 0 } as const;

/**
 * Pure: emissive props for a `lightRole` part at an hour, given its schedule.
 * A window glows only during its `litHours`; a hearth only during its
 * `hearthHours`; everything else stays dark. Hours wrap into 0-23 so a
 * fractional or out-of-range clock resolves cleanly.
 */
export function emissiveForPart(
  role: 'window' | 'hearth' | undefined,
  hour: number,
  litHours?: boolean[],
  hearthHours?: boolean[],
): { emissive: string; emissiveIntensity: number } {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (role === 'window') {
    return litHours?.[h] ? { emissive: WINDOW_GLOW_HEX, emissiveIntensity: 1.1 } : { ...DARK };
  }
  if (role === 'hearth') {
    return hearthHours?.[h] ? { emissive: HEARTH_GLOW_HEX, emissiveIntensity: 1.1 } : { ...DARK };
  }
  return { ...DARK };
}

/**
 * Publishes the live INTEGER hour to the building subtree. Reads the clock each
 * frame (from `window.__wfAgentClock`, else the `clock` prop, else noon) but
 * re-renders the subtree ONLY when the integer hour changes — lighting is a
 * declarative re-render on the hour boundary, never a per-frame churn.
 */
export const InteriorHourProvider: React.FC<{ clock?: number; children: React.ReactNode }> = ({
  clock,
  children,
}) => {
  const [hour, setHour] = useState<number>(() => Math.floor((((clock ?? 12) % 24) + 24) % 24));
  const last = useRef(hour);
  useFrame(() => {
    const src = (window as { __wfAgentClock?: number }).__wfAgentClock ?? clock ?? 12;
    const h = Math.floor(((src % 24) + 24) % 24);
    if (h !== last.current) {
      last.current = h;
      setHour(h);
    }
  });
  return <InteriorHourContext.Provider value={hour}>{children}</InteriorHourContext.Provider>;
};
