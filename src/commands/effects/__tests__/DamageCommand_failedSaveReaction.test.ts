import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DamageCommand } from '../DamageCommand'
import { CombatState, CombatCharacter, RacialReaction } from '../../../types/combat'
import type { DamageEffect } from '../../../types/spellEffectTypes'
import { CommandContext } from '../../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/core/factories'

/**
 * agora-db71.12 — the consumer for `trigger: { type: 'on_failed_saving_throw' }`.
 *
 * `data/races/racialTraits.ts` has emitted that trigger for Harengon Lucky
 * Footwork since agora-4522, and nothing anywhere read it: the only racial
 * reaction offer in the engine filtered for `on_target_takes_damage`, so the d4
 * could never be added to the save it exists to rescue.
 *
 * These cases drive the real save path in `DamageCommand`, with the save
 * outcome pinned through the authored `saveOutcomeOverrides` seam so the only
 * variable left is whether the reaction was offered and taken.
 */

const LUCKY_FOOTWORK: RacialReaction = {
  id: 'harengon__lucky_footwork__reaction',
  name: 'Lucky Footwork',
  description:
    'When you fail a Dexterity saving throw, you can use your reaction to roll a d4 and add it to the save.',
  trigger: { type: 'on_failed_saving_throw' },
  // `condition` is untyped on RacialReaction (see racialTraits.ts), so it is
  // attached the same way the producer attaches it.
  ...({ condition: { type: 'save', saveType: 'Dexterity' } } as object),
  effect: {
    type: 'ATTACK_ROLL_MODIFIER',
    savingThrowModifier: {
      modifier: 'bonus',
      dice: '1d4',
      consumption: 'next_save',
      duration: { type: 'rounds', value: 1 }
    }
  } as RacialReaction['effect']
}

/**
 * A Dexterity-save damage effect whose save is DETERMINISTICALLY failed through
 * the production `saveOutcomeOverrides` seam: every target below is tagged as a
 * Plant, and `is_plant_creature` is an authored auto-failure. Pinning the
 * failure this way keeps the d20 out of the test while still running the real
 * save path the reaction hangs off.
 */
const dexSaveDamage = (dice: string): DamageEffect => ({
  type: 'DAMAGE',
  damage: { dice, type: 'Fire' },
  trigger: { type: 'immediate' },
  condition: {
    type: 'save',
    saveType: 'Dexterity',
    saveEffect: 'half',
    saveOutcomeOverrides: [{ outcome: 'auto_failure', effect: 'none', condition: 'is_plant_creature' }]
  }
}) as unknown as DamageEffect

/** Every defender is a Plant so the authored auto-failure override matches. */
const PLANT: string[] = ['Plant']

describe('DamageCommand — failed saving-throw reactions', () => {
  let caster: CombatCharacter
  let harengon: CombatCharacter
  let state: CombatState
  let context: CommandContext

  const buildContext = (
    target: CombatCharacter,
    requestReaction?: CommandContext['requestReaction']
  ): CommandContext => ({
    spellId: 'burning-hands',
    spellName: 'Burning Hands',
    caster,
    targets: [target],
    gameState: createMockGameState(),
    castAtLevel: 1,
    // The save outcome is pinned by the authored override, not by an rng.
    // Damage dice are pinned high so nothing else moves the numbers.
    damageRng: () => 0.999999,
    requestReaction
  } as unknown as CommandContext)

  beforeEach(() => {
    caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', team: 'enemy' })
    harengon = createMockCombatCharacter({
      id: 'harengon',
      name: 'Harengon',
      team: 'player',
      currentHP: 40,
      maxHP: 40,
      creatureTypes: PLANT,
      modifiers: { advantage: [], disadvantage: [], bonuses: [], reactions: [LUCKY_FOOTWORK] }
    })
    state = createMockCombatState({ characters: [caster, harengon], combatLog: [] })
    context = buildContext(harengon)
  })

  it('offers the reaction when the save fails and logs the rescued total', async () => {
    const requestReaction = vi.fn().mockResolvedValue(LUCKY_FOOTWORK.id)
    const command = new DamageCommand(dexSaveDamage('2d6'), buildContext(harengon, requestReaction))

    const next = await command.execute(state)

    expect(requestReaction).toHaveBeenCalledTimes(1)
    const offered = requestReaction.mock.calls[0][3] as Array<{ id: string }>
    expect(offered.map(option => option.id)).toEqual([LUCKY_FOOTWORK.id])

    const reactionLog = next.combatLog.find(entry => entry.message.includes('Lucky Footwork'))
    expect(reactionLog).toBeDefined()
    expect(reactionLog?.message).toContain('Dexterity save')

    // The Reaction is spent, so the same die cannot rescue every save this round.
    const reactor = next.characters.find(character => character.id === 'harengon')!
    expect(reactor.actionEconomy.reaction.used).toBe(true)
    expect(reactor.actionEconomy.reaction.remaining).toBe(0)
  })

  it('leaves the save untouched when the player declines', async () => {
    const requestReaction = vi.fn().mockResolvedValue(null)
    const command = new DamageCommand(dexSaveDamage('2d6'), buildContext(harengon, requestReaction))

    const next = await command.execute(state)

    expect(requestReaction).toHaveBeenCalledTimes(1)
    expect(next.combatLog.some(entry => entry.message.includes('Lucky Footwork'))).toBe(false)
    const reactor = next.characters.find(character => character.id === 'harengon')!
    expect(reactor.actionEconomy.reaction.used).toBe(false)
  })

  it('does not offer a reaction whose ability does not match the save', async () => {
    const wisdomOnly: RacialReaction = {
      ...LUCKY_FOOTWORK,
      ...({ condition: { type: 'save', saveType: 'Wisdom' } } as object)
    }
    const mismatched = createMockCombatCharacter({
      id: 'harengon',
      name: 'Harengon',
      team: 'player',
      currentHP: 40,
      maxHP: 40,
      creatureTypes: PLANT,
      modifiers: { advantage: [], disadvantage: [], bonuses: [], reactions: [wisdomOnly] }
    })
    const requestReaction = vi.fn().mockResolvedValue(wisdomOnly.id)
    const command = new DamageCommand(dexSaveDamage('2d6'), buildContext(mismatched, requestReaction))

    await command.execute(createMockCombatState({ characters: [caster, mismatched], combatLog: [] }))

    expect(requestReaction).not.toHaveBeenCalled()
  })

  it('does not offer a reaction the creature can no longer pay for', async () => {
    const spent = createMockCombatCharacter({
      id: 'harengon',
      name: 'Harengon',
      team: 'player',
      currentHP: 40,
      maxHP: 40,
      creatureTypes: PLANT,
      modifiers: { advantage: [], disadvantage: [], bonuses: [], reactions: [LUCKY_FOOTWORK] }
    })
    spent.actionEconomy = {
      ...spent.actionEconomy,
      reaction: { used: true, remaining: 0 }
    }
    const requestReaction = vi.fn().mockResolvedValue(LUCKY_FOOTWORK.id)
    const command = new DamageCommand(dexSaveDamage('2d6'), buildContext(spent, requestReaction))

    await command.execute(createMockCombatState({ characters: [caster, spent], combatLog: [] }))

    expect(requestReaction).not.toHaveBeenCalled()
  })

  it('does not offer anything to a creature with no racial reactions', async () => {
    const plain = createMockCombatCharacter({
      id: 'plain',
      name: 'Plain',
      team: 'player',
      currentHP: 40,
      maxHP: 40,
      creatureTypes: PLANT
    })
    const requestReaction = vi.fn().mockResolvedValue(LUCKY_FOOTWORK.id)
    const command = new DamageCommand(dexSaveDamage('2d6'), buildContext(plain, requestReaction))

    await command.execute(createMockCombatState({ characters: [caster, plain], combatLog: [] }))

    expect(requestReaction).not.toHaveBeenCalled()
  })

  // The command must never reach the prompt for context that cannot show one.
  it('is a no-op when no reaction prompt is available at all', async () => {
    const command = new DamageCommand(dexSaveDamage('2d6'), context)
    const next = await command.execute(state)
    expect(next.combatLog.some(entry => entry.message.includes('Lucky Footwork'))).toBe(false)
  })
})
