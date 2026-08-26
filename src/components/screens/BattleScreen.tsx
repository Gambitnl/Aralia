// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:56:26
 * Dependents: components/screens/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the combat phase screen (Battle Screen).
 *
 * When the party enters tactical combat (random encounter, scripted ambush, or boss fight),
 * this screen hosts the battle container. It manages biome resolution, tactical camera,
 * 2D pixel board / 3D WebGPU scene switching, turn order, combat HUD, action economy,
 * and battle resolution (victory, defeat, flee).
 *
 * Called by: App.tsx (when GamePhase is COMBAT)
 * Depends on: CombatView.tsx for tactical battle orchestration, ErrorBoundary for safety
 */

// ============================================================================
// Imports
// ============================================================================
// React core library and lazy loading utilities
import React, { lazy, Suspense } from 'react';
// Error boundary component to catch and isolate combat render exceptions
import ErrorBoundary from '../ui/ErrorBoundary';
// Loading spinner displayed while tactical battle assets are being loaded
import { LoadingSpinner } from '../ui/LoadingSpinner';
// Character, inventory, and enemy types
import type { PlayerCharacter } from '../../types';
// Combat biomes and battle map biome definitions
import { BATTLE_MAP_BIOMES, type BattleMapBiome } from '../../types/combat';
// Utility to check if developer tools / url parameters are available
import { canUseDevTools } from '../../utils/core';

// Lazy-load the CombatView component to prevent pulling 3D/canvas math onto cold startup
const CombatView = lazy(() =>
  import('../Combat').then((module) => ({
    default: module.CombatView,
  }))
);

// ============================================================================
// Props & Types
// ============================================================================
// Defines the parameters and handlers needed to initialize and run a battle
export interface BattleScreenProps {
  // The player's active adventuring party
  party: PlayerCharacter[];
  // The active list of enemy combatants facing the party
  enemies: any[];
  // Optional current world location biome identifier to determine battle arena style
  currentLocationBiomeId?: string;
  // Callback when a combat round elapses, advancing world/turn time
  onRoundElapsed?: (seconds: number) => void;
  // Callback when battle ends with result (victory/defeat/flee), loot, and surviving state
  onBattleEnd: (
    result: 'victory' | 'defeat' | 'flee',
    rewards?: any,
    finalPartyState?: any,
    finalEnemyState?: any
  ) => void;
}

// ============================================================================
// Main Component
// ============================================================================
// Container screen rendering the active tactical battle
export const BattleScreen: React.FC<BattleScreenProps> = ({
  party,
  enemies,
  currentLocationBiomeId,
  onRoundElapsed,
  onBattleEnd,
}) => {
  // Resolve tactical biome based on current location and optional developer query parameter
  const allowedBiomes: readonly BattleMapBiome[] = BATTLE_MAP_BIOMES;

  // Dev-only override (?biome=swamp) allows screenshot and test rigs to force specific biomes
  const devBiomeParam = canUseDevTools()
    ? new URLSearchParams(window.location.search).get('biome')
    : null;

  // Select the appropriate biome, falling back to 'forest' if unrecognized
  const combatBiome: BattleMapBiome =
    devBiomeParam &&
    allowedBiomes.includes(devBiomeParam as (typeof allowedBiomes)[number])
      ? (devBiomeParam as (typeof allowedBiomes)[number])
      : currentLocationBiomeId &&
          allowedBiomes.includes(
            currentLocationBiomeId as (typeof allowedBiomes)[number]
          )
        ? (currentLocationBiomeId as (typeof allowedBiomes)[number])
        : 'forest';

  return (
    // Isolate battle crashes so combat errors can be caught without blanking the game
    <ErrorBoundary fallbackMessage="An error occurred during Combat.">
      <Suspense fallback={<LoadingSpinner />}>
        <CombatView
          party={party}
          enemies={enemies || []}
          biome={combatBiome}
          onRoundElapsed={onRoundElapsed}
          onBattleEnd={onBattleEnd}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default BattleScreen;
