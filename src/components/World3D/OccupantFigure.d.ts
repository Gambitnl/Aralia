/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:30:27
 * Dependents: components/World3D/InteriorOccupants.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
export interface OccupantFigureProps {
    /** Stable per-member id — seeds the deterministic body. */
    occupantId: number;
    /** Age band ('child' | 'adult' | 'elder'). */
    ageBand?: string;
    /** Ancestry group name (raceGroups display name); absent on older bakes. */
    race?: string;
    /** Scene-space position of the figure's FEET (floor surface). */
    position: [number, number, number];
    /** Facing yaw about +Y, radians. */
    rotationY?: number;
    /**
     * Optional live movement signal owned by the placement layer. A ref keeps
     * the generated body's gait in sync with per-frame travel without asking
     * React to rebuild the expensive figure on every clock tick.
     */
    motionRef?: React.MutableRefObject<{
        moving: boolean;
    }>;
}
/**
 * Render one occupant. The entity's feet are at the group origin so `position`
 * places it directly on the floor (surfaceY + storey elevation).
 */
declare const OccupantFigure: React.FC<OccupantFigureProps>;
export default OccupantFigure;
