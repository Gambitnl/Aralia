/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:57:31
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import type { ActiveSpellZone } from '../../systems/spells/effects/triggerHandler';
/**
 * This component gives theater-of-the-mind combat a visible terrain ledger.
 *
 * Terrain spells normally mutate battle-map tiles. When no map exists, the
 * ability system keeps those areas as active spell zones instead; this panel
 * turns that durable state into a readable player-facing summary so Grease,
 * Spike Growth, Fog Cloud, and similar spells do not disappear into the log.
 */
interface MaplessTerrainSummaryProps {
    spellZones: ActiveSpellZone[];
}
interface TerrainZoneSummary {
    id: string;
    name: string;
    area: string;
    expiresAtRound?: number;
    terrainLabels: string[];
}
export declare const buildMaplessTerrainSummaries: (spellZones: ActiveSpellZone[]) => TerrainZoneSummary[];
export declare const MaplessTerrainSummary: React.FC<MaplessTerrainSummaryProps>;
export default MaplessTerrainSummary;
