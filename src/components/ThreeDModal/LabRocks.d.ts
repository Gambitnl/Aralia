/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:56
 * Dependents: Scene3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
interface LabRocksProps {
    seed: number;
    enabled?: boolean;
    countPerType?: number;
    radius?: number;
    avoidCenter?: {
        x: number;
        z: number;
    };
    avoidRadius?: number;
}
declare const LabRocks: ({ seed, enabled, countPerType, radius, avoidCenter, avoidRadius, }: LabRocksProps) => import("react").JSX.Element;
export default LabRocks;
