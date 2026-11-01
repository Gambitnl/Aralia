/**
 * @file fire.ts
 * Keeps fire artifacts and object ignition state shared by spell attacks and area casts.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/factory/spell/scrying.ts, commands/factory/spell/spellAttack.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect, CreatedObject, isDamageEffect } from '@/types/spells'
import { ActiveFireEffect, CombatCharacter, CombatState } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { generateId } from '@/utils/combat'
import { applyScaling } from './scaling'

export class FireArtifactCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext,
    private readonly createdObject: CreatedObject,
    private readonly damage?: { dice: string; type: string }
  ) {
    this.description = `${spell.name} creates a fire artifact`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: [],
      effectType: 'fire_artifact',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    const point = this.context.selectedSpellTargets?.find(selectedTarget => selectedTarget.kind === 'point')
    const position = point?.position ?? this.caster.position
    const fireEffect = buildActiveFireEffect({
      spell: this.spell,
      caster: this.caster,
      createdObject: this.createdObject,
      position,
      currentTurn: state.turnState.currentTurn,
      kind: 'hazard',
      damage: this.damage
    })

    return {
      ...state,
      activeFireEffects: [
        ...(state.activeFireEffects || []),
        fireEffect
      ],
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${this.spell.name} creates ${this.createdObject.name} at (${position.x}, ${position.y}).`,
          characterId: this.caster.id,
          data: {
            spellId: this.spell.id,
            fireEffect
          }
        }
      ]
    }
  }
}



export function buildActiveFireEffect(args: {
  spell: Spell
  caster: CombatCharacter
  createdObject: CreatedObject
  position: { x: number; y: number }
  currentTurn: number
  kind: ActiveFireEffect['kind']
  objectId?: string
  objectName?: string
  damage?: { dice: string; type: string }
}): ActiveFireEffect {
  const { spell, caster, createdObject, position, currentTurn, kind, objectId, objectName, damage } = args
  const expiresAtRound = createdObject.expiresWithSpell
    ? currentTurn + resolveSpellDurationRounds(spell)
    : undefined

  return {
    id: generateId(),
    spellId: spell.id,
    sourceName: spell.name,
    casterId: caster.id,
    position,
    createdTurn: currentTurn,
    expiresAtRound,
    kind,
    objectId,
    objectName,
    objectType: createdObject.objectType,
    damage,
    area: {
      shape: createdObject.affectedVolumeShape,
      sizeFeet: createdObject.affectedVolumeSizeFeet
    },
    ignitesTouchedObjects: createdObject.ignitesTouchedObjects === true,
    excludesWornOrCarriedObjects: createdObject.excludesWornOrCarriedObjects === true
  }
}



export function resolveSpellDurationRounds(spell: Spell): number {
  if (spell.duration.type !== 'timed') {
    return 1
  }

  switch (spell.duration.unit) {
    case 'round':
      return spell.duration.value ?? 1
    case 'minute':
      return (spell.duration.value ?? 1) * 10
    default:
      return 1
  }
}



export function createFireArtifactCommand(
  spell: Spell,
  caster: CombatCharacter,
  context: CommandContext,
  activeEffects: SpellEffect[],
  effectiveCastLevel: number
): SpellCommand | null {
  for (const effect of activeEffects) {
    if (!isDamageEffect(effect)) {
      continue
    }

    const createdObject = effect.createdObjects?.find(object =>
      object.ignitesTouchedObjects === true &&
      object.appearsIn === 'spell_area'
    )

    if (!createdObject) {
      continue
    }

    const scaledEffect = applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
    const damage = isDamageEffect(scaledEffect) ? scaledEffect.damage : effect.damage

    return new FireArtifactCommand(spell, caster, context, createdObject, damage)
  }

  return null
}
