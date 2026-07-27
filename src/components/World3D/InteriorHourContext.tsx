// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 21:14:26
 * Dependents: components/World3D/InteriorLights.tsx, components/World3D/InteriorOccupants.tsx, components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Live game-clock contexts for the interior building subtree.
//
// Windows and hearths are tagged at bake time with a `lightRole` but carry NO
// baked emissive. The renderer decides emissive live from the building's hourly
// schedule (`litHours` / `hearthHours`) against the current game hour. This
// module publishes the hour as an INTEGER (0-23) so the subtree re-renders only
// on hour boundaries, plus a fractional ref that moving residents can sample
// per frame without re-rendering the buildings. It also exposes the pure per-
// part emissive resolver used by the materials and tests.
import React, { createContext, useContext, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { WINDOW_GLOW_HEX, HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

/**
 * @file InteriorHourContext.tsx
 * Shares one live interior clock between static building lighting and moving
 * household figures. World3DScene mounts the provider; lights read the integer
 * hour, while occupant actors read the fractional ref for smooth travel.
 */

// ============================================================================
// Interior Clock Channels
// ============================================================================
// The integer channel protects the static building subtree from per-frame
// churn. The fractional channel is mutable and exists only for moving figures.
// ============================================================================

/** The live integer game hour (0-23) for the building subtree. */
export const InteriorHourContext = createContext<number>(12);
export const useInteriorHour = (): number => useContext(InteriorHourContext);

/**
 * The same live clock kept as a mutable fractional-hour value. Lighting only
 * needs the integer context above, but occupants need minutes as well so they
 * can walk between consecutive station slots without re-rendering the entire
 * building subtree every frame.
 */
const DEFAULT_INTERIOR_CLOCK_REF: React.MutableRefObject<number> = { current: 12 };
export const InteriorClockRefContext = createContext<React.MutableRefObject<number>>(
  DEFAULT_INTERIOR_CLOCK_REF,
);
export const useInteriorClockRef = (): React.MutableRefObject<number> =>
  useContext(InteriorClockRefContext);

const DARK = { emissive: '#000000', emissiveIntensity: 0 } as const;

// ============================================================================
// Live Lighting Resolution
// ============================================================================
// Tagged windows and hearths ask this pure resolver whether they glow at the
// current integer schedule slot.
// ============================================================================

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

// ============================================================================
// Shared Provider
// ============================================================================
// One frame reader keeps both clock channels synchronized with the game clock
// or the visual-test scrub override.
// ============================================================================

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
  // Keep the fractional clock in a ref so moving occupants can sample it on
  // each render frame without forcing windows, hearths, and static building
  // geometry through a React render for every in-game minute.
  const initialClock = (((clock ?? 12) % 24) + 24) % 24;
  const clockRef = useRef(initialClock);
  const [hour, setHour] = useState<number>(() => Math.floor(initialClock));
  const last = useRef(hour);
  // Run before resident/street frame readers. R3F otherwise allows a child
  // actor to sample the previous slot while GroundAgents already sees the new
  // window override, briefly giving both layers the same visible resident.
  useFrame(() => {
    const src = (window as { __wfAgentClock?: number }).__wfAgentClock ?? clock ?? 12;
    const wrapped = ((src % 24) + 24) % 24;
    clockRef.current = wrapped;
    const h = Math.floor(wrapped);
    if (h !== last.current) {
      last.current = h;
      setHour(h);
    }
  }, -100);
  return (
    <InteriorClockRefContext.Provider value={clockRef}>
      <InteriorHourContext.Provider value={hour}>{children}</InteriorHourContext.Provider>
    </InteriorClockRefContext.Provider>
  );
};
