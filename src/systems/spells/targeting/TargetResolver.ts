import type { SpellTargeting, TargetFilter , CombatCharacter, CombatState, Position } from '@/types'
import { hasLineOfSight } from '../../../utils/lineOfSight'

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
    gameState: CombatState
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

      // Check line of sight
      if (targeting.lineOfSight && !this.hasLineOfSight(caster.position, target.position, gameState)) {
        return false
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

    return allCharacters.filter(target =>
      this.isValidTarget(targeting, caster, target, gameState)
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
   * Check if there's line of sight between two positions
   */
  private static hasLineOfSight(
    pos1: Position,
    pos2: Position,
    gameState: CombatState
  ): boolean {
    if (!gameState.mapData) {
      // If map data is missing, assume clear LoS or handle as error?
      // For now, assuming clear to avoid blocking gameplay in incomplete states.
      return true
    }

    // Adapt Position to BattleMapTile-like structure expected by hasLineOfSight util
    // We only need coordinates for bresenham, but hasLineOfSight checks tile properties.
    // The util expects BattleMapTile objects.

    const startTileId = `${pos1.x}-${pos1.y}`
    const endTileId = `${pos2.x}-${pos2.y}`

    const startTile = gameState.mapData.tiles.get(startTileId)
    const endTile = gameState.mapData.tiles.get(endTileId)

    if (!startTile || !endTile) {
       // If start or end tiles don't exist in map data (e.g. out of bounds), assume blocked?
       // Or just return false.
       return false
    }

    return hasLineOfSight(startTile, endTile, gameState.mapData)
  }

  /**
   * Check if target matches any of the valid filters
   */
  private static matchesTargetFilters(
    filters: TargetFilter[],
    caster: CombatCharacter,
    target: CombatCharacter
  ): boolean {
    // If any filter matches, return true (OR logic)
    // Or is it AND? Usually "creatures" AND "enemies".
    // But 'validTargets' in spells.ts is TargetFilter[]
    // E.g. ['creatures', 'enemies'] -> Must be a creature AND an enemy?
    // Or ['objects', 'creatures'] -> Can be object OR creature?
    // D&D targeting usually says "A creature you can see".
    // If I say validTargets: ["creatures", "enemies"], I probably mean "Enemy Creatures".
    
    // Let's assume AND logic for now, or check specific combinations.
    // Actually, checking the types: "creatures", "objects", "allies", "enemies", "self", "point".
    // "creatures" + "enemies" = Enemy Creature.
    // "creatures" + "allies" = Ally Creature.
    // "self" -> Caster.
    
    // Let's iterate and ensure ALL conditions are met.
    // Wait, if I have ["creatures", "objects"], that would mean something must be BOTH? Impossible.
    // So it must be OR logic for categories (Creature/Object) but AND logic for Relations (Enemy/Ally)?
    // This is ambiguous in the type definition.
    
    // Let's look at standard 5e: "Each creature in a 20-foot sphere".
    // That would be ["creatures"].
    // "A creature you choose".
    // "An enemy".
    
    // Let's implement a check that passes if it matches ALL constraints.
    // But treat "creatures" and "objects" as categories.
    // If both are present, maybe it means "Creatures OR Objects".
    
    // Simpler approach: iterate filters.
    // If filter is 'enemies', target MUST be enemy.
    // If filter is 'allies', target MUST be ally.
    // If filter is 'creatures', target MUST be creature (all CombatCharacters are).
    // If filter is 'self', target MUST be caster.
    
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
