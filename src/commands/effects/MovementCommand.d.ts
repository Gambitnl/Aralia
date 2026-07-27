/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 19/07/2026, 23:22:31
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/combat/engine/useCombatEngine.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/commands/effects/MovementCommand.ts
 * Command for executing movement-based effects in combat.
 * Handles forced movement (push/pull), teleports, speed modifications, and collision detection.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { MovementEffect } from '@/types/spells';
import { CombatState } from '@/types/combat';
/**
 * Command responsible for applying movement effects to characters.
 *
 * This command handles:
 * - **Forced Movement**: Pushing or pulling targets relative to the caster (e.g., *Thunderwave*, *Thorn Whip*).
 * - **Teleportation**: Instantaneously moving a target to a new location (e.g., *Misty Step*, *Dimension Door*).
 * - **Speed Changes**: Buffing or debuffing movement speed (e.g., *Longstrider*, *Ray of Frost*).
 * - **Collision & Bounds**: Ensuring movement respects map boundaries and doesn't end in occupied spaces.
 *
 * @remarks
 * Movement calculations assume a standard 5-foot grid system.
 * Forced movement stops early if the path is blocked by terrain or other creatures.
 */
export declare class MovementCommand extends BaseEffectCommand {
    private static readonly RAY_OF_FROST_SLOW_NAME;
    private static readonly RAY_OF_FROST_SOURCE_NAMES;
    constructor(effect: MovementEffect, context: CommandContext);
    /**
     * Executes the movement effect on all valid targets.
     *
     * @param state - The current combat state.
     * @returns The new combat state with updated character positions or stats.
     */
    execute(state: CombatState): CombatState;
    /**
     * Pushes a target away from the caster.
     *
     * @remarks
     * Calculates a vector from caster to target and moves the target along that line.
     * Stops early if the target hits a wall or another creature.
     *
     * @param state - Current state.
     * @param target - The character being pushed.
     * @param effect - The movement effect containing distance.
     */
    private applyPush;
    /**
     * Pulls a target toward the caster.
     *
     * @remarks
     * Calculates a vector from target to caster.
     * Stops early if the target hits a wall, another creature, or would occupy the caster's space.
     *
     * @param state - Current state.
     * @param target - The character being pulled.
     * @param effect - The movement effect containing distance.
     */
    private applyPull;
    /**
     * Teleports a target to a specific or selected destination.
     *
     * @remarks
     * The fallback sequence for determining the destination is:
     * 1. Resolve: Check for an explicit destination in the effect.
     * 2. Clamp: Restrict destination to valid map bounds.
     * 3. Validate: Check if the destination is occupied.
     * 4. Fallback: If blocked, attempt to find the nearest available valid tile.
     *
     * @param state - Current state.
     * @param target - The character teleporting.
     * @param effect - The movement effect.
     */
    private applyTeleport;
    private applyTenserFloatingDiskMovementEndings;
    private getTenserFloatingDiskRemovals;
    /**
     * Modifies a target's movement speed.
     *
     * Used for buffs (Haste, Longstrider) or debuffs (Ray of Frost).
     */
    private applySpeedChange;
    /**
     * Ray of Frost uses a temporary speed rider instead of a permanent stat
     * delta so the slowdown can refresh cleanly and fall off at the caster's
     * next turn boundary.
     */
    private applyRayOfFrostSpeedChange;
    /**
     * Refreshes the Ray of Frost status mirror instead of letting repeated hits
     * stack multiple copies of the same slow.
     */
    private replaceRayOfFrostStatus;
    /**
     * Refreshes the Ray of Frost condition mirror so the duration stays tied to
     * a single source instead of creating duplicate cleanup records.
     */
    private replaceRayOfFrostCondition;
    /**
     * Applies a "Stop" effect, which can reduce speed to 0 OR force movement in a specific direction.
     *
     * Note: "Stop" is a legacy term here that encompasses generic forced movement instructions
     * that aren't strictly push/pull (e.g., Frightened condition causing movement "away").
     */
    private applyStop;
    /**
     * Resolves the target destination for a teleport action.
     *
     * @param state - Current combat state.
     * @param target - The character teleporting.
     * @param maxTiles - Maximum distance in tiles.
     * @param effect - The movement effect definition.
     * @returns The resolved position or null if no valid destination is found.
     */
    private resolveTeleportDestination;
    /**
     * Clamps a position to the boundaries of the current map.
     * Checks BattleMap first, then falls back to WorldMap data.
     */
    private clampToBounds;
    /**
     * Reports whether this command has real battlefield dimensions available.
     *
     * This exists so teleport logs can explain why a destination was not
     * clamped. Mapless spell execution is intentionally range-bounded and
     * coordinate-unclamped rather than using guessed board edges.
     */
    private hasMapBounds;
    /**
     * Checks if a position is valid:
     * 1. Within map bounds (if map data is available)
     * 2. Not occupied by another character
     *
     * @param state - Combat state.
     * @param position - The coordinate to check.
     * @param excludeCharacterId - Optional ID to ignore (e.g. self).
     */
    private validatePosition;
    private findAvailableDestination;
    private findRoutedForcedMovementDestination;
    /**
     * Applies terrain hazards after movement resolves onto a destination tile.
     *
     * The movement command already owns the final landing spot, so this is the
     * narrowest place to attach battle-map hazard resolution without inventing
     * a new movement pipeline. We preserve the existing compatibility overlay
     * and only attach effects when the tile registry says there is something to
     * apply.
     */
    private applyLandingTerrainEffects;
    /**
     * Produces a short log suffix for the landing tile so the existing move
     * message shows when the terrain helper mattered.
     */
    private describeLandingTerrain;
    get description(): string;
}
