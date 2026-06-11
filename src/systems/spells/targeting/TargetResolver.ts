// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/06/2026, 22:07:45
 * Dependents: hooks/useAbilitySystem.ts, systems/spells/targeting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SpellTargeting, TargetFilter, TargetConditionFilter, CombatCharacter, CombatState, Position } from '@/types'

import { hasLineOfSight } from '../../../utils/lineOfSight'
import { TargetValidationUtils } from './TargetValidationUtils'
import { canInteract, canSeeTarget } from '../../../utils/planarTargeting'
import { TargetAllocator } from './TargetAllocator'
import type { AllocationResult, AllocatorContext } from './TargetAllocator'

/**
 * Minimal runtime shape for object spell targets.
 *
 * Aralia does not yet have a first-class combat object registry, but spell data
 * already describes object targeting. This envelope lets callers validate an
 * object candidate without pretending it is a CombatCharacter.
 */
export interface TargetableObject {
  id: string
  name: string
  position: Position
  size?: string
  weightPounds?: number
  isWornOrCarried?: boolean
  isMagical?: boolean
  isFixedToSurface?: boolean
}

export interface TargetCandidateSet {
  creatures: CombatCharacter[]
  objects: TargetableObject[]
}

export interface TargetResolutionResult extends AllocationResult {
  /** Every creature that passed normal range, sight, plane, and filter checks before final allocation. */
  candidateTargets: CombatCharacter[]
  /** Whether an explicit targeting allocation rule changed the final target list. */
  allocationApplied: boolean
}

const OBJECT_SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

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

      // Check planar interaction (e.g. Blink / Etherealness)
      if (!canInteract(caster, target, gameState)) {
        return false
      }

      // Check line of sight (now including planar visibility)
      if (targeting.lineOfSight) {
        if (!canSeeTarget(caster, target, gameState)) {
          return false
        }
        if (!this.hasLineOfSight(caster.position, target.position, gameState)) {
          return false
        }
      }

      // Check detailed target filter (e.g. creature type constraints)
      if (targeting.filter) {
        // TODO(UI-INTEGRATION): Connect this validation failure to UI feedback (reason: "Target must be Humanoid")
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

    return allCharacters.filter(target =>
      this.isValidTarget(targeting, caster, target, gameState)
    )
  }

  /**
   * Resolve the final creature targets for a spell.
   *
   * `getValidTargets` intentionally remains a candidate query because UI panels
   * and previews still need to show every legal target. This method is the
   * cast-time bridge: it first gathers those legal candidates, then applies
   * targeting allocation rules such as Sleep's hit-point pool.
   */
  static resolveTargets(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    gameState: CombatState,
    allocationContext: AllocatorContext = {}
  ): TargetResolutionResult {
    const candidateTargets = this.getValidTargets(targeting, caster, gameState)

    return this.resolveTargetCandidates(targeting, candidateTargets, allocationContext)
  }

  /**
   * Resolve a caller-provided list of already-valid creature candidates.
   *
   * Combat UI code often knows more than this generic resolver, such as the
   * exact clicked area footprint. This bridge lets that UI-selected candidate
   * set keep its area/shape meaning while still sharing the same pool allocation
   * logic used by resolver-driven callers.
   */
  static resolveTargetCandidates(
    targeting: SpellTargeting,
    candidateTargets: CombatCharacter[],
    allocationContext: AllocatorContext = {}
  ): TargetResolutionResult {

    if (!targeting.allocation) {
      return {
        candidateTargets,
        selectedTargets: candidateTargets,
        allocationApplied: false,
        logs: ['No target allocation rule; all valid creature targets remain selected.']
      }
    }

    const allocation = TargetAllocator.allocateTargets(
      candidateTargets,
      targeting.allocation,
      allocationContext
    )

    return {
      ...allocation,
      candidateTargets,
      allocationApplied: true
    }
  }

  /**
   * Return valid creature and object candidates through one caller-facing API.
   *
   * Object discovery is intentionally dependency-injected for now. The spell
   * resolver should not invent battle-map objects from visual decorations, but
   * callers that already have object candidates can aggregate them with creature
   * targets through the same targeting rules.
   */
  static getValidTargetCandidates(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    gameState: CombatState,
    objectCandidates: TargetableObject[] = []
  ): TargetCandidateSet {
    return {
      creatures: this.getValidTargets(targeting, caster, gameState),
      objects: objectCandidates.filter(targetObject =>
        this.isValidObjectTarget(targeting, caster, targetObject, gameState)
      )
    }
  }

  /**
   * Validate a non-creature object candidate against spell targeting rules.
   *
   * This intentionally stays separate from `isValidTarget` because object
   * candidates do not have creature teams, planar state, conditions, HP, or
   * creature taxonomy. It gives object-aware callers a real bridge while keeping
   * the existing character-target path stable.
   */
  static isValidObjectTarget(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    targetObject: TargetableObject,
    gameState: CombatState
  ): boolean {
    if (
      targeting.type !== 'single' &&
      targeting.type !== 'multi' &&
      targeting.type !== 'area'
    ) {
      return false
    }

    if (!targeting.validTargets.includes('objects')) {
      return false
    }

    const distance = this.getDistance(caster.position, targetObject.position)
    if (distance > targeting.range) return false

    if (targeting.lineOfSight && !this.hasLineOfSight(caster.position, targetObject.position, gameState)) {
      return false
    }

    if (!this.matchesObjectEligibility(targeting.filter?.objectEligibility, targetObject)) {
      return false
    }

    return true
  }

  /**
   * Calculate distance between two positions (Euclidean)
   */
  private static getDistance(pos1: Position, pos2: Position): number {
    // TODO(SPELL-OVERHAUL): Account for elevation, sub-grid coordinates, and target size (see docs/tasks/spell-system-overhaul/TODO.md; if this block is moved/refactored/modularized, update the TODO entry path).
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
      // A spell that explicitly requires line of sight needs map evidence to
      // prove that sight line. The UI validator already rejects mapless LoS
      // checks, so the resolver now follows the same fail-closed policy instead
      // of letting runtime casts bypass the battle-map requirement.
      return false
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
    
    const categoryFilters = filters.filter(filter =>
      filter === 'creatures' || filter === 'objects' || filter === 'point'
    )

    // Category filters are an allowed-target-kind list, not a set of traits
    // that one runtime target must all satisfy. A CombatCharacter can satisfy
    // `creatures` even when the same spell also allows `objects`.
    if (categoryFilters.length > 0 && !categoryFilters.includes('creatures')) {
      return false
    }

    for (const filter of filters) {
      switch (filter) {
        case 'creatures':
          // All CombatCharacters are creatures
          break;
        case 'objects':
          // Objects are handled by isValidObjectTarget; do not reject creature
          // targets merely because this spell also permits objects.
          break;
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
           // Points are handled by area/position targeting, not by this
           // character resolver. Mixed creature/point spells can still target
           // creatures through the `creatures` category guard above.
           break;
      }
    }
    return true;
  }

  /**
   * Apply spell-data object gates to a runtime object envelope.
   *
   * Only concrete constraints are enforced. Missing or `not_applicable` fields
   * are treated as no restriction so partially specified legacy data remains
   * usable while structured spells can opt into stricter object gates.
   */
  private static matchesObjectEligibility(
    eligibility: TargetConditionFilter['objectEligibility'],
    targetObject: TargetableObject
  ): boolean {
    if (!eligibility) {
      return true
    }

    if (eligibility.wornOrCarried === 'excluded' && targetObject.isWornOrCarried) {
      return false
    }

    if (eligibility.magicalStatus === 'nonmagical' && targetObject.isMagical) {
      return false
    }

    if (eligibility.fixedToSurface === 'excluded' && targetObject.isFixedToSurface) {
      return false
    }

    if (
      typeof eligibility.maxWeightPounds === 'number' &&
      typeof targetObject.weightPounds === 'number' &&
      targetObject.weightPounds > eligibility.maxWeightPounds
    ) {
      return false
    }

    if (
      eligibility.maxSize &&
      eligibility.maxSize !== 'not_applicable' &&
      targetObject.size &&
      !this.isObjectSizeAllowed(targetObject.size, eligibility.maxSize)
    ) {
      return false
    }

    return true
  }

  private static isObjectSizeAllowed(size: string, maxSize: string): boolean {
    const normalizedSize = this.normalizeSizeLabel(size)
    const normalizedMaxSize = this.normalizeSizeLabel(maxSize)
    const sizeIndex = OBJECT_SIZE_ORDER.indexOf(normalizedSize)
    const maxSizeIndex = OBJECT_SIZE_ORDER.indexOf(normalizedMaxSize)

    if (sizeIndex < 0 || maxSizeIndex < 0) {
      return true
    }

    return sizeIndex <= maxSizeIndex
  }

  private static normalizeSizeLabel(size: string): string {
    const lower = size.toLowerCase()
    return OBJECT_SIZE_ORDER.find(candidate => candidate.toLowerCase() === lower) ?? size
  }

  /**
   * Check if two characters are allies
   */
  private static isAlly(char1: CombatCharacter, char2: CombatCharacter): boolean {
    return char1.team === char2.team
  }
}
