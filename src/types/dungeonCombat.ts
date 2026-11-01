/** Serializable source and return receipt for one real generated-dungeon battle. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 09:01:33
 * Dependents: systems/worldforge/dungeon/world/dungeonCombat.ts, types/combat/map.ts, types/state.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {Cell} from '../systems/worldforge/dungeon/types';
import type {DungeonIdentity} from '../systems/worldforge/dungeon/world/dungeonIdentity';

export interface DungeonCombatContext {
  rootIdentity: DungeonIdentity;
  levelIdentity: DungeonIdentity;
  depth: number;
  entranceKind: 'ruin-door' | 'cave-mouth' | 'temple-stair' | 'sewer-grate';
  encounterId: string;
  combatantId: string;
  monsterKey: string;
  playerCell: Cell;
  cropOrigin: Cell;
  partySpawns: Cell[];
  enemySpawn: Cell;
  /** Partial enemy health survives a tactical retreat while this visit remains open. */
  enemyHP?: number;
  returnContext: {
    worldSeed: number; cellId: number; tileX: number; tileY: number;
    xM: number; zM: number; yM?: number;
  };
}
