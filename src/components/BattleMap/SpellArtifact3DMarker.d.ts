/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:31:50
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import type { SpellMapArtifactMarker } from './spellMapArtifacts';
interface SpellArtifact3DMarkerProps {
    marker: SpellMapArtifactMarker;
    groundY: number;
    offsetIndex?: number;
}
/**
 * Small 3D handle for non-creature spell artifacts. BattleMap3D owns placement;
 * this component only renders the readable marker, optional radius, and label.
 */
export declare const SpellArtifact3DMarker: React.FC<SpellArtifact3DMarkerProps>;
export {};
