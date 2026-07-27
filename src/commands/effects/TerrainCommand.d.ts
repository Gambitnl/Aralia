/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:50:27
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { TerrainEffect } from '@/types/spells';
import { CombatState } from '@/types/combat';
/**
 * Applies terrain spell effects to battle-map tiles and records the result in the combat log.
 *
 * Map-present encounters are handled here because this command owns tile mutation. When no
 * battle map exists, `useAbilitySystem` preserves the same terrain effects as an
 * `ActiveSpellZone` through `createTerrainSpellZoneFromAoEParams`, keeping mapless terrain
 * durable without creating a second persistence system inside this command.
 *
 * Called by: SpellCommandFactory and ReactiveEffectCommand.
 * Depends on: shared area geometry, combat-map tile state, and spell effect definitions.
 */
export declare class TerrainCommand extends BaseEffectCommand {
    constructor(effect: TerrainEffect, context: CommandContext);
    execute(state: CombatState): CombatState;
    /**
     * Applies the terrain effect to a single map tile.
     * Updates properties like movement cost, elevation, and environmental effects.
     */
    private applyTerrainChange;
    private applyDifficultTerrain;
    private removeDifficultTerrain;
    private recalculateMovementCost;
    private addEnvironmentalEffect;
    private hasIntentionalManipulation;
    private mapDamageToEnvType;
    private resolveDuration;
    private createEnvironmentalStatusEffect;
    /**
     * Handles structured terrain manipulation from spells like Mold Earth.
     * Creates appropriate log entries based on manipulation type.
     */
    private executeManipulation;
    private recordMoldEarthSurfaceMark;
    private getCurrentTurn;
    private resolveExpiryRound;
    private calculateTerrainArea;
    /**
     * Use the caster as the default origin; if a target is present we assume the AoE is centered there.
     * This keeps terrain spells like Wall of Fire or Spike Growth deterministic even without UI input.
     */
    private resolveOrigin;
    private resolveSelectedTerrainPoint;
    private buildAoEParams;
    get description(): string;
}
