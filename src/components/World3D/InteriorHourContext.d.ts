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
import React from 'react';
/**
 * @file InteriorHourContext.tsx
 * Shares one live interior clock between static building lighting and moving
 * household figures. World3DScene mounts the provider; lights read the integer
 * hour, while occupant actors read the fractional ref for smooth travel.
 */
/** The live integer game hour (0-23) for the building subtree. */
export declare const InteriorHourContext: React.Context<number>;
export declare const useInteriorHour: () => number;
export declare const InteriorClockRefContext: React.Context<React.MutableRefObject<number>>;
export declare const useInteriorClockRef: () => React.MutableRefObject<number>;
/**
 * Pure: emissive props for a `lightRole` part at an hour, given its schedule.
 * A window glows only during its `litHours`; a hearth only during its
 * `hearthHours`; everything else stays dark. Hours wrap into 0-23 so a
 * fractional or out-of-range clock resolves cleanly.
 */
export declare function emissiveForPart(role: 'window' | 'hearth' | undefined, hour: number, litHours?: boolean[], hearthHours?: boolean[]): {
    emissive: string;
    emissiveIntensity: number;
};
/**
 * Publishes the live INTEGER hour to the building subtree. Reads the clock each
 * frame (from `window.__wfAgentClock`, else the `clock` prop, else noon) but
 * re-renders the subtree ONLY when the integer hour changes — lighting is a
 * declarative re-render on the hour boundary, never a per-frame churn.
 */
export declare const InteriorHourProvider: React.FC<{
    clock?: number;
    children: React.ReactNode;
}>;
