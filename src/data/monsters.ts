// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 07/05/2026, 00:03:13
 * Dependents: constants.ts, systems/crime/BountyHunterSystem.ts, utils/combat/combatUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

import { MonsterData } from '../types';
import { INGESTED_MONSTERS } from './monsters.generated';

// The main monster registry. Spread the auto-generated monsters from 5etools.
// Additional manual monsters can be added below the spread if needed.
export const MONSTERS_DATA: Record<string, MonsterData> = {
    ...INGESTED_MONSTERS
};