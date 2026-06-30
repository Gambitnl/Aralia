// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/06/2026, 03:48:43
 * Dependents: hooks/combat/useTargetValidator.ts, hooks/useAbilitySystem.ts, systems/spells/targeting/ObjectTargetRegistry.ts, systems/spells/targeting/index.ts
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

export interface TargetRejectionReason {
  code: string
  message: string
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
    return this.getTargetRejectionReason(targeting, caster, target, gameState) === null
  }

  /**
   * Explain why a creature target cannot be selected.
   *
   * The older API only returned true or false, which meant spell data could be
   * correct while the player, AI, and combat log had no shared language for an
   * illegal target. This method keeps the boolean API stable and adds a narrow
   * reason bridge for UI and runtime callers that need visible feedback.
   */
  static getTargetRejectionReason(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    target: CombatCharacter,
    gameState: CombatState
  ): TargetRejectionReason | null {
    // Self-targeting
    if (targeting.type === 'self') {
      return target.id === caster.id ? null : {
        code: 'requires_self',
        message: 'This spell can only target the caster.'
      }
    }

    // Single/Multi/Area targeting
    if (
      targeting.type === 'single' ||
      targeting.type === 'multi' ||
      targeting.type === 'area'
    ) {
      // Check range
      const distance = this.getDistance(caster.position, target.position)
      if (distance > targeting.range) {
        return {
          code: 'out_of_range',
          message: `Target is ${Math.round(distance)} feet away, beyond this spell's ${targeting.range}-foot range.`
        }
      }

      // Check planar interaction (e.g. Blink / Etherealness)
      if (!canInteract(caster, target, gameState)) {
        return {
          code: 'planar_blocked',
          message: 'The target cannot be affected from the caster\'s current plane or phase.'
        }
      }

      // Check line of sight (now including planar visibility)
      if (targeting.lineOfSight) {
        const canUseHearingRoute = this.canUseHearingAcquisition(targeting, caster, target)
        if (!canUseHearingRoute && !canSeeTarget(caster, target, gameState)) {
          return {
            code: 'not_visible',
            message: 'The caster cannot see or otherwise acquire this target.'
          }
        }
        if (!canUseHearingRoute && !this.hasLineOfSight(caster.position, target.position, gameState)) {
          return {
            code: 'line_of_sight_blocked',
            message: 'Line of sight to this target is blocked or unavailable, and this target is not audible to the caster.'
          }
        }
      }

      // Check detailed target filter (e.g. creature type constraints)
      if (targeting.filter) {
        if (!TargetValidationUtils.matchesFilter(target, targeting.filter)) {
          return {
            code: 'target_filter_failed',
            message: 'This target does not match the spell\'s required creature restrictions.'
          }
        }
      }

      // Check target filter
      return this.getTargetFilterRejectionReason(targeting.validTargets, caster, target)
    }

    return {
      code: 'unsupported_targeting_type',
      message: `Targeting type "${targeting.type}" cannot select a creature target here.`
    }
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
    return this.getObjectTargetRejectionReason(targeting, caster, targetObject, gameState) === null
  }

  /**
   * Explain why a non-creature object candidate cannot be selected.
   *
   * Object-targeting spells often fail because of weight, size, ownership, or
   * map-sight rules. Returning a reason here gives the combat UI and AI a
   * shared rejection contract while preserving the existing boolean validator.
   */
  static getObjectTargetRejectionReason(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    targetObject: TargetableObject,
    gameState: CombatState
  ): TargetRejectionReason | null {
    if (
      targeting.type !== 'single' &&
      targeting.type !== 'multi' &&
      targeting.type !== 'area'
    ) {
      return {
        code: 'unsupported_targeting_type',
        message: `Targeting type "${targeting.type}" cannot select an object target here.`
      }
    }

    if (!targeting.validTargets.includes('objects')) {
      return {
        code: 'objects_not_allowed',
        message: 'This spell does not allow object targets.'
      }
    }

    const distance = this.getDistance(caster.position, targetObject.position)
    if (distance > targeting.range) {
      return {
        code: 'out_of_range',
        message: `Object is ${Math.round(distance)} feet away, beyond this spell's ${targeting.range}-foot range.`
      }
    }

    if (targeting.lineOfSight && !this.hasLineOfSight(caster.position, targetObject.position, gameState)) {
      return {
        code: 'line_of_sight_blocked',
        message: 'Line of sight to this object is blocked or unavailable.'
      }
    }

    return this.getObjectEligibilityRejectionReason(targeting.filter?.objectEligibility, targetObject)
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

  private static canUseHearingAcquisition(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    target: CombatCharacter
  ): boolean {
    // Most spells that set `lineOfSight: true` must still prove a visual path.
    // Only spells with the explicit sight-or-hearing acquisition mode can use
    // the auditory route, and only when combat state says this caster can hear
    // the specific target.
    if (targeting.acquisition?.mode !== 'sight_or_hearing') {
      return false
    }

    return target.audibleTo?.includes(caster.id) ?? false
  }

  /**
   * Check if target matches any of the valid filters
   */
  private static matchesTargetFilters(
    filters: TargetFilter[],
    caster: CombatCharacter,
    target: CombatCharacter
  ): boolean {
    return this.getTargetFilterRejectionReason(filters, caster, target) === null
  }

  private static getTargetFilterRejectionReason(
    filters: TargetFilter[],
    caster: CombatCharacter,
    target: CombatCharacter
  ): TargetRejectionReason | null {
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
      return {
        code: 'creatures_not_allowed',
        message: 'This spell does not allow creature targets.'
      }
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
          if (!this.isAlly(caster, target)) {
            return {
              code: 'requires_ally',
              message: 'This spell can only target allies.'
            }
          }
          break;
        case 'enemies':
          if (this.isAlly(caster, target)) {
            return {
              code: 'requires_enemy',
              message: 'This spell can only target enemies.'
            }
          }
          break;
        case 'self':
          if (target.id !== caster.id) {
            return {
              code: 'requires_self',
              message: 'This spell can only target the caster.'
            }
          }
          break;
        case 'point':
           // Points are handled by area/position targeting, not by this
           // character resolver. Mixed creature/point spells can still target
           // creatures through the `creatures` category guard above.
           break;
      }
    }
    return null;
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
    return this.getObjectEligibilityRejectionReason(eligibility, targetObject) === null
  }

  private static getObjectEligibilityRejectionReason(
    eligibility: TargetConditionFilter['objectEligibility'],
    targetObject: TargetableObject
  ): TargetRejectionReason | null {
    if (!eligibility) {
      return null
    }

    if (eligibility.wornOrCarried === 'excluded' && targetObject.isWornOrCarried) {
      return {
        code: 'object_worn_or_carried',
        message: 'This spell cannot target an object that is worn or carried.'
      }
    }

    if (eligibility.magicalStatus === 'nonmagical' && targetObject.isMagical) {
      return {
        code: 'object_must_be_nonmagical',
        message: 'This spell can only target nonmagical objects.'
      }
    }

    if (eligibility.fixedToSurface === 'excluded' && targetObject.isFixedToSurface) {
      return {
        code: 'object_fixed_to_surface',
        message: 'This spell cannot target an object fixed to a surface.'
      }
    }

    // Object targeting data exists in both an older flat shape and a newer
    // grouped shape. Read both so spells such as Catapult-style object picks
    // keep their weight gate even when the JSON uses `weightLimit`.
    const groupedEligibility = eligibility as typeof eligibility & {
      sizeLimit?: { maxSize?: unknown }
      weightLimit?: { maxWeightPounds?: unknown }
    }
    const maxWeightPounds = typeof groupedEligibility.maxWeightPounds === 'number'
      ? groupedEligibility.maxWeightPounds
      : typeof groupedEligibility.weightLimit?.maxWeightPounds === 'number'
        ? groupedEligibility.weightLimit.maxWeightPounds
        : undefined

    if (
      typeof maxWeightPounds === 'number' &&
      typeof targetObject.weightPounds === 'number' &&
      targetObject.weightPounds > maxWeightPounds
    ) {
      return {
        code: 'object_too_heavy',
        message: `Object weighs ${targetObject.weightPounds} pounds, above this spell's ${maxWeightPounds}-pound limit.`
      }
    }

    // Size limits went through the same migration as weight limits. Accept the
    // grouped `sizeLimit.maxSize` form and the older direct `maxSize` form so
    // object-targeting spells do not accidentally allow oversized objects.
    const maxSize = typeof groupedEligibility.maxSize === 'string'
      ? groupedEligibility.maxSize
      : typeof groupedEligibility.sizeLimit?.maxSize === 'string'
        ? groupedEligibility.sizeLimit.maxSize
        : undefined

    if (
      maxSize &&
      maxSize !== 'not_applicable' &&
      targetObject.size &&
      !this.isObjectSizeAllowed(targetObject.size, maxSize)
    ) {
      return {
        code: 'object_too_large',
        message: `Object size ${targetObject.size} is larger than this spell's ${maxSize} limit.`
      }
    }

    return null
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
