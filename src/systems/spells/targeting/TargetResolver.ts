import type { SpellTargeting, TargetFilter , CombatCharacter, CombatState, Position } from '@/types'
import { TargetValidationUtils } from './TargetValidationUtils'
import { VisibilitySystem, VisibilityTier } from '../../visibility'

/**
 * Resolves valid targets based on spell targeting rules
 */
export class TargetResolver {
  /**
   * Validate if a character can be targeted by this spell
   *
   * @param targeting - Spell targeting definition
   * @param caster - Character casting the spell
   * @param target - Potential target
   * @param gameState - Current combat state
   * @param cachedVisibilityMap - Optional pre-calculated visibility map for optimization
   * @returns true if target is valid
   *
   * @example
   * const canTarget = TargetResolver.isValidTarget(
   *   spell.targeting,
   *   caster,
   *   enemy,
   *   gameState
   * )
   */
  static isValidTarget(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    target: CombatCharacter,
    gameState: CombatState,
    cachedVisibilityMap?: Map<string, VisibilityTier>
  ): boolean {
    // Self-targeting
    if (targeting.type === 'self') {
      return target.id === caster.id
    }

    // Single/Multi/Area targeting
    if (
      targeting.type === 'single' ||
      targeting.type === 'multi' ||
      targeting.type === 'area'
    ) {
      // Check range
      const distance = this.getDistance(caster.position, target.position)
      if (distance > targeting.range) return false

      // Check visibility / line of sight
      if (targeting.lineOfSight) {
        if (!this.checkVisibility(caster, target, gameState, cachedVisibilityMap)) {
          return false;
        }
      }

      // Check detailed target filter (e.g. creature type constraints)
      if (targeting.filter) {
        if (!TargetValidationUtils.matchesFilter(target, targeting.filter)) {
          return false
        }
      }

      // Check target filter
      return this.matchesTargetFilters(targeting.validTargets, caster, target)
    }

    return false
  }

  /**
   * Get all valid targets in range
   *
   * @param targeting - Spell targeting definition
   * @param caster - Character casting the spell
   * @param gameState - Current combat state
   * @returns Array of valid target characters
   */
  static getValidTargets(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    gameState: CombatState
  ): CombatCharacter[] {
    const allCharacters = [
      ...gameState.characters // Use flat characters array from CombatState
    ]

    // Pre-calculate visibility map for optimization
    let visibilityMap: Map<string, VisibilityTier> | undefined;
    if (targeting.lineOfSight && gameState.mapData) {
      const lightLevels = VisibilitySystem.calculateLightLevels(gameState.mapData, gameState.activeLightSources);
      visibilityMap = VisibilitySystem.calculateVisibility(caster, gameState.mapData, lightLevels);
    }

    return allCharacters.filter(target =>
      this.isValidTarget(targeting, caster, target, gameState, visibilityMap)
    )
  }

  /**
   * Calculate distance between two positions (Euclidean)
   */
  private static getDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy) * 5 // Convert tiles to feet
  }

  /**
   * Check if the target is visible to the caster.
   * Considers walls (Line of Sight) AND Lighting (Darkness/Darkvision).
   */
  private static checkVisibility(
    caster: CombatCharacter,
    target: CombatCharacter,
    gameState: CombatState,
    cachedVisibilityMap?: Map<string, VisibilityTier>
  ): boolean {
    // If no map data, default to visible (legacy behavior/fail safe)
    if (!gameState.mapData) return true;

    const targetTileId = `${target.position.x}-${target.position.y}`;

    // 1. Use Cached Map if available
    if (cachedVisibilityMap) {
      const visibility = cachedVisibilityMap.get(targetTileId);
      // 'hidden' means blocked by wall OR blocked by darkness
      return visibility !== 'hidden';
    }

    // 2. Fallback: Calculate on the fly
    // Note: This is expensive if called in a loop, so getValidTargets uses the cache.
    // Optimization for future: implement VisibilitySystem.checkSingleTile(caster, targetTile, mapData, lights)
    // to avoid full map calculation for single checks.
    const lightLevels = VisibilitySystem.calculateLightLevels(gameState.mapData, gameState.activeLightSources);
    const visibilityMap = VisibilitySystem.calculateVisibility(caster, gameState.mapData, lightLevels);

    return visibilityMap.get(targetTileId) !== 'hidden';
  }

  /**
   * Check if target matches any of the valid filters
   */
  private static matchesTargetFilters(
    filters: TargetFilter[],
    caster: CombatCharacter,
    target: CombatCharacter
  ): boolean {
    // Iterate filters and ensure ALL conditions are met.
    for (const filter of filters) {
      switch (filter) {
        case 'creatures':
          // All CombatCharacters are creatures
          break;
        case 'objects':
          // CombatCharacters are NOT objects
          return false; 
        case 'allies':
          if (!this.isAlly(caster, target)) return false;
          break;
        case 'enemies':
          if (this.isAlly(caster, target)) return false;
          break;
        case 'self':
          if (target.id !== caster.id) return false;
          break;
        case 'point':
           // Points aren't Characters, so this resolver (which takes CombatCharacter) shouldn't handle points
           return false; 
      }
    }
    return true;
  }

  /**
   * Check if two characters are allies
   */
  private static isAlly(char1: CombatCharacter, char2: CombatCharacter): boolean {
    return char1.team === char2.team
  }
}
