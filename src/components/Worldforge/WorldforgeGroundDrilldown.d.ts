/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 21:43:47
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { type AtlasGroundDrilldown } from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';
/**
 * This file renders the ground-level continuation of an Atlas drilldown.
 *
 * It accepts the exact Region and Local objects retained by Atlas, verifies their seed
 * lineage against the navigation receipt, and gives those objects to the shared World3D
 * loader. It also owns the visible return control so ascending restores the preserved map.
 */
interface Props {
    drilldown: AtlasGroundDrilldown;
    onAscend: () => void;
}
declare const WorldforgeGroundDrilldown: React.FC<Props>;
export default WorldforgeGroundDrilldown;
