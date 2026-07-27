/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 04:59:05
 * Dependents: commands/effects/MovementCommand.ts, state/appState.ts, state/initialState.ts, state/reducers/worldReducer.ts, systems/world/WorldEventManager.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/environment/EnvironmentSystem.ts
 * Implements logic for environmental effects, including weather modifiers on spells
 * and terrain movement costs.
 */
import { WeatherState, TerrainRule, SpellModifier, EnvironmentalHazard } from '../../types/environment';
import { Spell } from '../../types/spells';
import { BattleMapTerrain } from '../../types/combat';
import { NATURAL_HAZARDS } from './hazards';
export { NATURAL_HAZARDS };
export * from './hazards';
/**
 * Battle-map compatibility terrain rules.
 *
 * TerrainSystem owns the canonical shared terrain registry. This overlay keeps
 * the legacy battle-map terrain surface intact where its semantics differ while
 * reusing canonical entries for matching keys.
 */
export declare const TERRAIN_RULES: Record<BattleMapTerrain, TerrainRule>;
/**
 * Calculates how weather conditions affect a specific spell.
 * @param weather The current weather state.
 * @param spell The spell being cast.
 * @returns Array of modifiers to apply to the spell.
 */
export declare function getWeatherModifiers(weather: WeatherState, spell: Spell): SpellModifier[];
/**
 * Gets the movement cost for a specific terrain type.
 */
export declare function getTerrainMovementCost(terrain: BattleMapTerrain): number;
/**
 * Determines cover provided by a terrain type.
 */
export declare function getTerrainCover(terrain: BattleMapTerrain): string;
/**
 * Gets the intrinsic hazards for a terrain type.
 */
export declare function getTerrainHazards(terrain: BattleMapTerrain): EnvironmentalHazard[];
/**
 * Default safe weather state.
 */
export declare const DEFAULT_WEATHER: WeatherState;
