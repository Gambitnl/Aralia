// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/06/2026, 14:49:00
 * Dependents: App.tsx, commands/effects/SummoningCommand.ts, data/adapters/runtimeMonsterRegistry.ts, hooks/data/useBestiary.ts, services/geminiServiceFallback.ts, utils/world/bestiaryEncounterGenerator.ts, utils/world/encounterUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { MonsterData } from '../types/ui';

// ============================================================================
// Monster Data Registry
// ============================================================================
// This file is the single source of truth for all monsters available in the
// game. The combat encounter generator (combatUtils.ts), the AI fallback
// encounter system (geminiServiceFallback.ts), and the bounty hunter crime
// system all pull from MONSTERS_DATA when they need to spawn a creature.
//
// Previously, every monster was hand-written inline in this file with
// hardcoded stats and abilities. Now the data comes from 5etools bestiary
// JSON files via an automated ingestion pipeline:
//
//   vendor/5etools-src/  →  scripts/ingestMonsters.ts  →  monsters.generated.ts
//
// This file re-exports that generated data. If you need to add a manual
// override or a custom monster that doesn't exist in 5etools, you can spread
// additional entries into the MONSTERS_DATA object below.
//
// Called by: constants.ts (re-export), combatUtils.ts, BountyHunterSystem.ts
// Depends on: monsters.generated.ts (auto-generated from 5etools)
// ============================================================================

// The main monster registry. Initially empty to break the static dependency chain
// to monsters.generated.ts during the initial page paint and Main Menu phase.
// It is populated in-place via Object.assign once loadMonstersData resolves.
export const MONSTERS_DATA: Record<string, MonsterData> = {};

let loadPromise: Promise<Record<string, MonsterData>> | null = null;

/**
 * Dynamically loads the generated monster dataset.
 * Populates MONSTERS_DATA in-place to ensure references remain correct once loaded.
 * 
 * DESIGN DECISION: Mutating MONSTERS_DATA in-place allows synchronous lookups
 * in gameplay code to proceed unchanged once background loading completes.
 */
export function loadMonstersData(): Promise<Record<string, MonsterData>> {
  if (loadPromise) return loadPromise;

  loadPromise = import('./monsters.generated').then(({ INGESTED_MONSTERS }) => {
    Object.assign(MONSTERS_DATA, INGESTED_MONSTERS);
    return MONSTERS_DATA;
  });

  return loadPromise;
}