// @dependencies-start
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
// @dependencies-end

import React from 'react';
import type { TerrainEffect } from '../../types/spells';
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

const TERRAIN_LABELS: Record<string, string> = {
  difficult: 'Difficult',
  damaging: 'Hazard',
  obscuring: 'Obscuring',
  wall: 'Wall',
  blocking: 'Blocking'
};

const titleCaseSpellId = (spellId: string): string => (
  spellId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
);

const describeArea = (zone: ActiveSpellZone): string => {
  // Area metadata is preserved from targeting. When it is absent, keep the
  // summary honest instead of inventing a shape that may not match the spell.
  if (!zone.areaOfEffect) {
    return 'Persistent terrain area';
  }

  return `${zone.areaOfEffect.size}-foot ${zone.areaOfEffect.shape}`;
};

const summarizeTerrainZone = (zone: ActiveSpellZone): TerrainZoneSummary | null => {
  const terrainEffects = zone.effects.filter((effect): effect is TerrainEffect => effect.type === 'TERRAIN');

  if (terrainEffects.length === 0) {
    return null;
  }

  // Collapse duplicate terrain rows into one compact badge set. Spike Growth,
  // for example, has both hazard and difficult-terrain rows and should show
  // both without listing every raw effect object.
  const terrainLabels = Array.from(new Set(
    terrainEffects.map(effect => TERRAIN_LABELS[effect.terrainType] ?? titleCaseSpellId(effect.terrainType))
  ));

  return {
    id: zone.id,
    name: titleCaseSpellId(zone.spellId),
    area: describeArea(zone),
    expiresAtRound: zone.expiresAtRound,
    terrainLabels
  };
};

export const buildMaplessTerrainSummaries = (spellZones: ActiveSpellZone[]): TerrainZoneSummary[] => (
  spellZones
    .map(summarizeTerrainZone)
    .filter((summary): summary is TerrainZoneSummary => summary !== null)
);

export const MaplessTerrainSummary: React.FC<MaplessTerrainSummaryProps> = ({ spellZones }) => {
  const summaries = buildMaplessTerrainSummaries(spellZones);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="mapless-terrain-summary"
      className="w-full max-w-xl rounded-lg border border-amber-500/40 bg-slate-950/90 p-4 text-left shadow-lg"
      aria-label="Active terrain effects"
    >
      <div className="mb-3 text-xs font-black uppercase tracking-wide text-amber-200">Active Terrain</div>
      <div className="space-y-3">
        {summaries.map(summary => (
          <article key={summary.id} className="rounded border border-slate-700 bg-slate-900/85 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-50">{summary.name}</h2>
              <span className="text-xs font-semibold text-slate-300">{summary.area}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.terrainLabels.map(label => (
                <span key={label} className="rounded border border-amber-300/70 bg-amber-950 px-2 py-1 text-[11px] font-black uppercase text-amber-100">
                  {label}
                </span>
              ))}
              {summary.expiresAtRound !== undefined && (
                <span className="rounded border border-sky-300/70 bg-sky-950 px-2 py-1 text-[11px] font-black uppercase text-sky-100">
                  Round {summary.expiresAtRound}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MaplessTerrainSummary;
