/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 21:36:50
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/PreviewTowns.tsx, components/MapPane.tsx, devtools/buildingIdentityLab/BuildingIdentityLab.tsx
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { TownPlan } from '../../systems/worldforge/town/townEngine';
import { type ClimateClass, type StyleFamily } from '../../systems/worldforge/town/architectureStyle';
import { type SeedPath } from '../../systems/worldforge/seedPath';
export interface TownPlanViewProps {
    plan: TownPlan;
    width?: number;
    height?: number;
    /** Town seed-path — enables naming the household living in a hovered home. */
    seedPath?: SeedPath;
    /** Per-save scope for the town layer toggles (pass the world seed). */
    prefsScope?: string | number;
    /**
     * Regional architecture family from the burg's FMG culture type. When set,
     * building fills, facade patterns, roof outlines, and role-motif evidence use
     * the same layered resolver as the production 3D building bridge.
     */
    styleFamily?: StyleFamily;
    /** Exact production settlement key (`burg:<id>`) for 2D/3D style parity. */
    settlementKey?: string;
    /** Atlas climate used by the same patina resolver as generated 3D buildings. */
    climate?: ClimateClass;
    /** Callback fired when a building plot is clicked. */
    onSelectPlot?: (plotId: number) => void;
    /** Currently selected building plot ID (stamped with a visual highlight). */
    selectedPlotId?: number;
    /** Authoritative artifact plan, containing exact plot IDs and oriented quads. */
    artifactPlan?: import('../../systems/worldforge/artifacts').TownPlan;
    /**
     * Inherited water polylines in the SAME frame as the plan (the polylines fed
     * to `generateTownPlan`). Drawn as a river channel so the docks, bridges, and
     * water-gates the generator seats against them are visibly IN water.
     */
    water?: Pt[][];
}
/**
 * SP3/SP-T leaf renderer: draws a generated `TownPlan` — footprint, Voronoi
 * wards, party-wall + interior building plots, main streets, defensive walls +
 * gatehouses, and civic anatomy (plaza/temple/keep/citadel/docks/bridges) — with
 * fit-to-view + manual pan/zoom. Hovering a building or civic structure highlights
 * it and shows an inspector tooltip. This is the deepest 2D tier the drill reaches.
 */
declare const TownPlanView: React.FC<TownPlanViewProps>;
export default TownPlanView;
