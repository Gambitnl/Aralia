import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import starryWisp from '../../../../public/data/spells/level-0/starry-wisp.json'
import fireBolt from '../../../../public/data/spells/level-0/fire-bolt.json'
import createBonfire from '../../../../public/data/spells/level-0/create-bonfire.json'
import chillTouch from '../../../../public/data/spells/level-0/chill-touch.json'
import eldritchBlast from '../../../../public/data/spells/level-0/eldritch-blast.json'
import primalSavagery from '../../../../public/data/spells/level-0/primal-savagery.json'
import { HealingEffect, Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import * as combatUtils from '@/utils/combatUtils'
import { BreakConcentrationCommand } from '@/commands/effects/ConcentrationCommands'
import { HealingCommand } from '@/commands/effects/HealingCommand'

vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>()
  return {
    ...actual,
    rollD20: vi.fn()
  }
})

/**
 * This file proves spell-attack spells that should roll to hit before their
 * hit-conditioned spell effects run.
 *
 * Starry Wisp is the first cantrip covered here because it has both damage and
 * a non-damage hit rider. A miss must skip both halves, while a hit must route
 * damage, target light, and anti-Invisible state through the normal command
 * executors.
 *
 * Called by: focused Spells G54 proof.
 * Depends on: live Starry Wisp JSON, SpellCommandFactory, and combat factories.
 */
describe('SpellCommandFactory spell attack execution', () => {
  const spell = starryWisp as unknown as Spell

  const caster = createMockCombatCharacter({
    id: 'starry-caster',
    name: 'Druid',
    level: 1,
    spellcastingAbility: 'wisdom',
    stats: {
      ...createMockCombatCharacter().stats,
      wisdom: 16
    }
  })

  const target = createMockCombatCharacter({
    id: 'starry-target',
    name: 'Invisible Goblin',
    armorClass: 10,
    currentHP: 20,
    maxHP: 20,
    statusEffects: [],
    conditions: [{
      name: 'Invisible',
      duration: { type: 'rounds', value: 10 },
      appliedTurn: 1
    }]
  })

  beforeEach(() => {
    vi.mocked(combatUtils.rollD20).mockReset()
  })

  describe('Primal Savagery bridge', () => {
    const primalSpell = primalSavagery as unknown as Spell
    const primalCaster = createMockCombatCharacter({
      id: 'primal-caster',
      name: 'Druid',
      level: 1,
      spellcastingAbility: 'wisdom',
      stats: {
        ...createMockCombatCharacter().stats,
        wisdom: 16
      }
    })
    const primalTarget = createMockCombatCharacter({
      id: 'primal-target',
      name: 'Training Dummy',
      armorClass: 10,
      currentHP: 30,
      maxHP: 30,
      statusEffects: []
    })

    const createPrimalState = (caster = primalCaster, target = primalTarget) => createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 2,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    it('resolves as a melee spell attack and applies acid damage on hit', async () => {
      vi.mocked(combatUtils.rollD20).mockReturnValue(12)
      const commands = await SpellCommandFactory.createCommands(primalSpell, primalCaster, [primalTarget], 0, createMockGameState())
      const result = await commands[0].execute(createPrimalState())
      const targetAfterHit = result.characters.find(character => character.id === primalTarget.id)
      const attackLog = result.combatLog.find(entry => entry.data?.spellId === 'primal-savagery' && entry.data?.attackType === 'spell')
      const transformationLogs = result.combatLog.filter(entry => entry.data?.transientTransformation === 'primal_savagery_sharpened')

      expect(commands).toHaveLength(1)
      expect(targetAfterHit?.currentHP).toBeLessThan(primalTarget.currentHP)
      expect(attackLog?.data).toMatchObject({
        weaponType: 'melee',
        isHit: true,
        primalSavageryDamageDice: '1d10'
      })
      expect(result.combatLog.some(entry => entry.type === 'damage' && entry.data?.type === 'Acid')).toBe(true)
      expect(transformationLogs.map(entry => entry.data?.active)).toEqual([true, false])
      expect(targetAfterHit?.statusEffects.some(status => status.source === 'Primal Savagery')).toBe(false)
    })

    it('skips acid damage on miss and still reverts the transient sharpening', async () => {
      vi.mocked(combatUtils.rollD20).mockReturnValue(2)
      const commands = await SpellCommandFactory.createCommands(primalSpell, primalCaster, [primalTarget], 0, createMockGameState())
      const result = await commands[0].execute(createPrimalState())
      const targetAfterMiss = result.characters.find(character => character.id === primalTarget.id)
      const attackLog = result.combatLog.find(entry => entry.data?.spellId === 'primal-savagery' && entry.data?.attackType === 'spell')
      const transformationLogs = result.combatLog.filter(entry => entry.data?.transientTransformation === 'primal_savagery_sharpened')

      expect(targetAfterMiss?.currentHP).toBe(primalTarget.currentHP)
      expect(attackLog?.data).toMatchObject({
        weaponType: 'melee',
        isHit: false,
        primalSavageryDamageDice: '1d10'
      })
      expect(result.combatLog.some(entry => entry.type === 'damage' && entry.data?.type === 'Acid')).toBe(false)
      expect(transformationLogs.map(entry => entry.data?.active)).toEqual([true, false])
    })

    it.each([
      [5, '2d10'],
      [11, '3d10'],
      [17, '4d10']
    ])('scales Primal Savagery damage dice at character level %i', async (casterLevel, expectedDice) => {
      vi.mocked(combatUtils.rollD20).mockReturnValue(12)
      const leveledCaster = {
        ...primalCaster,
        level: casterLevel
      }
      const commands = await SpellCommandFactory.createCommands(primalSpell, leveledCaster, [primalTarget], 0, createMockGameState())
      const result = await commands[0].execute(createPrimalState(leveledCaster, primalTarget))
      const attackLog = result.combatLog.find(entry => entry.data?.spellId === 'primal-savagery' && entry.data?.attackType === 'spell')

      expect(attackLog?.data?.primalSavageryDamageDice).toBe(expectedDice)
    })
  })

  it('executes Starry Wisp damage, dim light, and anti-Invisible rider only after a hit', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 0, createMockGameState())
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)
    const targetAfterHit = result.characters.find(character => character.id === target.id)
    const starryLight = result.activeLightSources.find(light => light.sourceSpellId === 'starry-wisp')
    const suppression = targetAfterHit?.statusEffects.find(status =>
      status.source === 'Starry Wisp' &&
      status.suppressedConditionBenefit === 'Invisible'
    )

    // A hit should run both effect rows from the live Starry Wisp JSON: radiant
    // damage plus the target-attached glow/anti-Invisible utility rider.
    expect(commands).toHaveLength(1)
    expect(targetAfterHit?.currentHP).toBeLessThan(target.currentHP)
    expect(starryLight).toMatchObject({
      casterId: caster.id,
      brightRadius: 0,
      dimRadius: 10,
      attachedTo: 'target',
      attachedToCharacterId: target.id,
      expiresAtRound: 4
    })
    expect(suppression).toMatchObject({
      source: 'Starry Wisp',
      sourceCasterId: caster.id,
      suppressedConditionBenefit: 'Invisible',
      duration: 1
    })
    expect(result.combatLog.some(entry => entry.data?.spellId === 'starry-wisp' && entry.data?.isHit === true)).toBe(true)
  })

  it('skips Starry Wisp damage, dim light, and anti-Invisible rider after a miss', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 0, createMockGameState())
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)
    const targetAfterMiss = result.characters.find(character => character.id === target.id)

    // A miss keeps Starry Wisp from applying either hit-conditioned row. The
    // combat log still records the failed attack so the player can see why
    // nothing else happened.
    expect(commands).toHaveLength(1)
    expect(targetAfterMiss?.currentHP).toBe(target.currentHP)
    expect(result.activeLightSources.filter(light => light.sourceSpellId === 'starry-wisp')).toHaveLength(0)
    expect(targetAfterMiss?.statusEffects.some(status => status.suppressedConditionBenefit === 'Invisible')).toBe(false)
    expect(result.combatLog.some(entry => entry.data?.spellId === 'starry-wisp' && entry.data?.isHit === false)).toBe(true)
  })

  it('records Starry Wisp object damage and object-position dim light after an object hit', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const selectedObjectTarget = {
      kind: 'object' as const,
      id: 'glowing-statue',
      name: 'Glowing Statue',
      position: { x: 8, y: 4 },
      object: {
        id: 'glowing-statue',
        name: 'Glowing Statue',
        position: { x: 8, y: 4 },
        size: 'Medium',
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: false
      }
    }
    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [selectedObjectTarget]
    )
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)
    const impact = result.spellObjectImpacts?.find(entry => entry.objectId === 'glowing-statue')
    const light = result.activeLightSources.find(entry => entry.sourceSpellId === 'starry-wisp')

    // Object targets do not have creature HP, so the command stores structured
    // object-impact evidence and attaches Starry Wisp's glow to the object's
    // map position instead of fabricating a creature record.
    expect(commands).toHaveLength(1)
    expect(impact).toMatchObject({
      objectId: 'glowing-statue',
      objectName: 'Glowing Statue',
      position: { x: 8, y: 4 },
      sourceSpellId: 'starry-wisp',
      sourceSpellName: 'Starry Wisp',
      casterId: caster.id,
      damage: {
        dice: '1d8',
        type: 'Radiant'
      },
      expiresAtRound: 4
    })
    expect(light).toMatchObject({
      sourceSpellId: 'starry-wisp',
      casterId: caster.id,
      brightRadius: 0,
      dimRadius: 10,
      attachedTo: 'point',
      position: { x: 8, y: 4 },
      expiresAtRound: 4
    })
  })

  it('skips Starry Wisp object damage and object-position light after an object miss', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
    const selectedObjectTarget = {
      kind: 'object' as const,
      id: 'missed-statue',
      name: 'Missed Statue',
      position: { x: 8, y: 4 }
    }
    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [selectedObjectTarget]
    )
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)

    expect(commands).toHaveLength(1)
    expect(result.spellObjectImpacts || []).toHaveLength(0)
    expect(result.activeLightSources.filter(light => light.sourceSpellId === 'starry-wisp')).toHaveLength(0)
    expect(result.combatLog.some(entry => entry.data?.spellId === 'starry-wisp' && entry.data?.isHit === false)).toBe(true)
  })

  it('records Fire Bolt object ignition only after a hit on an unattended object', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const selectedObjectTarget = {
      kind: 'object' as const,
      id: 'dry-crate',
      name: 'Dry Crate',
      position: { x: 5, y: 2 },
      object: {
        id: 'dry-crate',
        name: 'Dry Crate',
        position: { x: 5, y: 2 },
        isWornOrCarried: false
      }
    }
    const commands = await SpellCommandFactory.createCommands(
      fireBolt as unknown as Spell,
      caster,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [selectedObjectTarget]
    )
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 4,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)
    const fireEffect = result.activeFireEffects?.find(effect => effect.objectId === 'dry-crate')

    // Fire Bolt's ignition rider lives on its damage row. The spell-attack
    // bridge should materialize it only after the object attack hits, without
    // pretending object HP or fire spread already exist.
    expect(fireEffect).toMatchObject({
      spellId: 'fire-bolt',
      kind: 'ignited_object',
      objectId: 'dry-crate',
      objectName: 'Dry Crate',
      position: { x: 5, y: 2 },
      damage: {
        dice: '1d10',
        type: 'Fire'
      },
      ignitesTouchedObjects: true,
      excludesWornOrCarriedObjects: true
    })
  })

  it('ends Friends early when its caster makes a spell attack roll', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
    const friendsCaster = createMockCombatCharacter({
      id: 'friends-caster',
      name: 'Warlock',
      level: 1,
      spellcastingAbility: 'charisma',
      concentratingOn: {
        spellId: 'friends',
        spellName: 'Friends',
        spellLevel: 0,
        startedTurn: 1,
        effectIds: ['friends-charm-status'],
        canDropAsFreeAction: true
      },
      stats: {
        ...createMockCombatCharacter().stats,
        charisma: 16
      }
    })
    const charmedTarget = createMockCombatCharacter({
      id: 'friends-target',
      name: 'Charmed Local',
      conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: friendsCaster.id }],
      statusEffects: [{
        id: 'friends-charm-status',
        name: 'Charmed',
        type: 'debuff',
        duration: 10,
        source: 'Friends',
        sourceCasterId: friendsCaster.id,
        socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
      }]
    })
    const attackTarget = createMockCombatCharacter({
      id: 'attack-target',
      name: 'Training Dummy',
      armorClass: 20,
      currentHP: 20,
      maxHP: 20
    })
    const commands = await SpellCommandFactory.createCommands(
      fireBolt as unknown as Spell,
      friendsCaster,
      [attackTarget],
      0,
      createMockGameState()
    )
    const state = createMockCombatState({
      characters: [friendsCaster, charmedTarget, attackTarget],
      turnState: {
        currentTurn: 2,
        turnOrder: [friendsCaster.id, charmedTarget.id, attackTarget.id],
        currentCharacterId: friendsCaster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    })

    const result = await commands[0].execute(state)
    const updatedCaster = result.characters.find(character => character.id === friendsCaster.id)
    const updatedCharmedTarget = result.characters.find(character => character.id === charmedTarget.id)

    // Friends ends when the caster makes an attack roll, even if that attack
    // misses. The shared concentration cleanup removes the charm and records
    // that the target knows who charmed them.
    expect(updatedCaster?.concentratingOn).toBeUndefined()
    expect(updatedCharmedTarget?.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false)
    expect(updatedCharmedTarget?.socialAwareness?.some(entry =>
      entry.sourceSpellId === 'friends' &&
      entry.casterId === friendsCaster.id
    )).toBe(true)
    expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'caster_makes_attack_roll')).toBe(true)
    expect(result.combatLog.some(entry => entry.data?.spellId === 'fire-bolt' && entry.data?.isHit === false)).toBe(true)
  })

  it('suppresses Fire Bolt object ignition when the hit object is worn or carried', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const selectedObjectTarget = {
      kind: 'object' as const,
      id: 'worn-cloak',
      name: 'Worn Cloak',
      position: { x: 5, y: 2 },
      object: {
        id: 'worn-cloak',
        name: 'Worn Cloak',
        position: { x: 5, y: 2 },
        isWornOrCarried: true
      }
    }
    const commands = await SpellCommandFactory.createCommands(
      fireBolt as unknown as Spell,
      caster,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [selectedObjectTarget]
    )
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 4,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)

    expect(result.activeFireEffects || []).toHaveLength(0)
    expect(result.combatLog.some(entry =>
      entry.data?.spellId === 'fire-bolt' &&
      (entry.data?.suppressedFireEffect as { reason?: string } | undefined)?.reason === 'worn_or_carried'
    )).toBe(true)
  })

  it('records Create Bonfire as a concentration-owned fire hazard and removes it on concentration break', async () => {
    const pointTarget = {
      kind: 'point' as const,
      position: { x: 3, y: 4 },
      purpose: 'ground_target'
    }
    const commands = await SpellCommandFactory.createCommands(
      createBonfire as unknown as Spell,
      caster,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [pointTarget]
    )
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 7,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    let result = state
    for (const command of commands) {
      result = await command.execute(result)
    }

    const fireEffect = result.activeFireEffects?.find(effect => effect.spellId === 'create-bonfire')
    const concentratingCaster = result.characters.find(character => character.id === caster.id)

    expect(fireEffect).toMatchObject({
      spellId: 'create-bonfire',
      kind: 'hazard',
      position: { x: 3, y: 4 },
      createdTurn: 7,
      expiresAtRound: 17,
      damage: {
        dice: '1d8',
        type: 'Fire'
      },
      area: {
        shape: 'Cube',
        sizeFeet: 5
      },
      ignitesTouchedObjects: true,
      excludesWornOrCarriedObjects: true
    })
    expect(concentratingCaster?.concentratingOn?.spellId).toBe('create-bonfire')

    const breakCommand = new BreakConcentrationCommand({
      spellId: 'create-bonfire',
      spellName: 'Create Bonfire',
      caster,
      targets: [],
      gameState: createMockGameState(),
      castAtLevel: 0
    })
    const cleaned = breakCommand.execute(result)

    expect(cleaned.activeFireEffects || []).toHaveLength(0)
  })

  it('applies Chill Touch damage and healing lockout only after a melee spell hit', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const chillCaster = createMockCombatCharacter({
      id: 'chill-caster',
      name: 'Necromancer',
      level: 1,
      spellcastingAbility: 'intelligence',
      stats: {
        ...createMockCombatCharacter().stats,
        intelligence: 16
      }
    })
    const chillTarget = createMockCombatCharacter({
      id: 'chill-target',
      name: 'Wounded Knight',
      armorClass: 10,
      currentHP: 12,
      maxHP: 20,
      statusEffects: [],
      conditions: []
    })
    const commands = await SpellCommandFactory.createCommands(
      chillTouch as unknown as Spell,
      chillCaster,
      [chillTarget],
      0,
      createMockGameState()
    )
    const state = createMockCombatState({
      characters: [chillCaster, chillTarget],
      turnState: {
        currentTurn: 9,
        turnOrder: [chillCaster.id, chillTarget.id],
        currentCharacterId: chillCaster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const hitState = await commands[0].execute(state)
    const lockedTarget = hitState.characters.find(character => character.id === chillTarget.id)
    const lockoutStatus = lockedTarget?.statusEffects.find(status =>
      status.hitPointState?.mode === 'healing_lockout'
    )

    // Chill Touch's JSON leaves `attackType` blank, but its targeting is melee.
    // This proof keeps that existing data shape and verifies the factory still
    // routes the spell through a hit/miss attack gate before applying riders.
    expect(commands).toHaveLength(1)
    expect(lockedTarget?.currentHP).toBeLessThan(chillTarget.currentHP)
    expect(lockoutStatus).toMatchObject({
      name: 'No Healing',
      source: 'Chill Touch',
      sourceCasterId: chillCaster.id,
      duration: 1,
      hitPointState: {
        mode: 'healing_lockout',
        preventsHitPointRegain: true
      }
    })

    const healingEffect: HealingEffect = {
      type: 'HEALING',
      healing: { dice: '1d8' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }
    const healingCommand = new HealingCommand(healingEffect, {
      spellId: 'cure-wounds',
      spellName: 'Cure Wounds',
      castAtLevel: 1,
      caster: chillCaster,
      targets: [chillTarget],
      gameState: createMockGameState()
    })
    const blockedHealingState = healingCommand.execute(hitState)
    const stillLockedTarget = blockedHealingState.characters.find(character => character.id === chillTarget.id)

    expect(stillLockedTarget?.currentHP).toBe(lockedTarget?.currentHP)
    expect(blockedHealingState.combatLog.some(entry =>
      entry.type === 'heal' &&
      entry.data?.value === 0
    )).toBe(true)

    const unlockedState = {
      ...blockedHealingState,
      characters: blockedHealingState.characters.map(character =>
        character.id === chillTarget.id
          ? { ...character, statusEffects: [], conditions: [] }
          : character
      )
    }
    const healedState = healingCommand.execute(unlockedState)
    const healedTarget = healedState.characters.find(character => character.id === chillTarget.id)

    expect(healedTarget?.currentHP).toBeGreaterThan(stillLockedTarget?.currentHP ?? 0)
  })

  it('skips Chill Touch damage and healing lockout after a miss', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
    const chillCaster = createMockCombatCharacter({
      id: 'miss-caster',
      name: 'Necromancer',
      level: 1,
      spellcastingAbility: 'intelligence',
      stats: {
        ...createMockCombatCharacter().stats,
        intelligence: 16
      }
    })
    const chillTarget = createMockCombatCharacter({
      id: 'miss-target',
      name: 'Guard',
      armorClass: 18,
      currentHP: 12,
      maxHP: 20,
      statusEffects: [],
      conditions: []
    })
    const commands = await SpellCommandFactory.createCommands(
      chillTouch as unknown as Spell,
      chillCaster,
      [chillTarget],
      0,
      createMockGameState()
    )
    const state = createMockCombatState({
      characters: [chillCaster, chillTarget],
      turnState: {
        currentTurn: 9,
        turnOrder: [chillCaster.id, chillTarget.id],
        currentCharacterId: chillCaster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const missedState = await commands[0].execute(state)
    const targetAfterMiss = missedState.characters.find(character => character.id === chillTarget.id)

    expect(commands).toHaveLength(1)
    expect(targetAfterMiss?.currentHP).toBe(chillTarget.currentHP)
    expect(targetAfterMiss?.statusEffects.some(status =>
      status.hitPointState?.mode === 'healing_lockout'
    )).toBe(false)
    expect(missedState.combatLog.some(entry => entry.data?.spellId === 'chill-touch' && entry.data?.isHit === false)).toBe(true)
  })

  it('applies Chill Touch caster-scoped attack disadvantage only to Undead hit targets', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const chillCaster = createMockCombatCharacter({
      id: 'undead-rider-caster',
      name: 'Necromancer',
      level: 1,
      spellcastingAbility: 'intelligence',
      stats: {
        ...createMockCombatCharacter().stats,
        intelligence: 16
      }
    })
    const undeadTarget = createMockCombatCharacter({
      id: 'undead-target',
      name: 'Skeleton',
      armorClass: 10,
      currentHP: 20,
      maxHP: 20,
      creatureTypes: ['Undead'],
      statusEffects: [],
      conditions: [],
      activeEffects: []
    })
    const livingTarget = createMockCombatCharacter({
      id: 'living-target',
      name: 'Bandit',
      armorClass: 10,
      currentHP: 20,
      maxHP: 20,
      creatureTypes: ['Humanoid'],
      statusEffects: [],
      conditions: [],
      activeEffects: []
    })

    const undeadCommands = await SpellCommandFactory.createCommands(
      chillTouch as unknown as Spell,
      chillCaster,
      [undeadTarget],
      0,
      createMockGameState()
    )
    const livingCommands = await SpellCommandFactory.createCommands(
      chillTouch as unknown as Spell,
      chillCaster,
      [livingTarget],
      0,
      createMockGameState()
    )
    const state = createMockCombatState({
      characters: [chillCaster, undeadTarget, livingTarget],
      turnState: {
        currentTurn: 12,
        turnOrder: [chillCaster.id, undeadTarget.id, livingTarget.id],
        currentCharacterId: chillCaster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const undeadHitState = await undeadCommands[0].execute(state)
    const livingHitState = await livingCommands[0].execute(state)
    const affectedUndead = undeadHitState.characters.find(character => character.id === undeadTarget.id)
    const affectedLiving = livingHitState.characters.find(character => character.id === livingTarget.id)
    const undeadRider = affectedUndead?.activeEffects?.find(effect =>
      effect.spellId === 'chill-touch' &&
      effect.mechanics?.attackRollModifier === 'disadvantage'
    )

    // Chill Touch's Undead-only rider is a real combat rule: the Undead has
    // Disadvantage only when it attacks the caster who landed the spell. A
    // living target should still receive the healing lockout, but not this
    // Undead-specific attack rider.
    expect(undeadRider).toMatchObject({
      casterId: chillCaster.id,
      sourceName: 'Chill Touch',
      mechanics: {
        attackRollDirection: 'outgoing',
        attackRollModifier: 'disadvantage',
        attackRollKind: 'any',
        attackRollConsumption: 'while_active',
        attackRollTargetId: chillCaster.id
      }
    })
    expect(affectedLiving?.activeEffects?.some(effect =>
      effect.spellId === 'chill-touch' &&
      effect.mechanics?.attackRollModifier === 'disadvantage'
    )).toBe(false)
  })

  it('resolves a level 1 Eldritch Blast as one ranged spell attack beam', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const warlock = createMockCombatCharacter({
      id: 'eldritch-caster-level-1',
      name: 'Warlock',
      level: 1,
      spellcastingAbility: 'charisma',
      stats: {
        ...createMockCombatCharacter().stats,
        charisma: 16
      }
    })
    const goblin = createMockCombatCharacter({
      id: 'eldritch-goblin',
      name: 'Goblin',
      armorClass: 10,
      currentHP: 20,
      maxHP: 20
    })
    const commands = await SpellCommandFactory.createCommands(
      eldritchBlast as unknown as Spell,
      warlock,
      [goblin],
      0,
      createMockGameState()
    )
    const state = createMockCombatState({
      characters: [warlock, goblin],
      turnState: {
        currentTurn: 1,
        turnOrder: [warlock.id, goblin.id],
        currentCharacterId: warlock.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    })

    const result = await commands[0].execute(state)
    const targetAfterHit = result.characters.find(character => character.id === goblin.id)
    const attackLogs = result.combatLog.filter(entry => entry.data?.spellId === 'eldritch-blast' && entry.data?.attackType === 'spell')

    expect(commands).toHaveLength(1)
    expect(combatUtils.rollD20).toHaveBeenCalledTimes(1)
    expect(targetAfterHit?.currentHP).toBeLessThan(goblin.currentHP)
    expect(attackLogs).toHaveLength(1)
    expect(attackLogs[0].data).toMatchObject({
      spellAttackInstanceIndex: 0,
      spellAttackInstanceCount: 1,
      spellAttackInstanceType: 'beam',
      isHit: true
    })
  })

  it('lets a level 5 Eldritch Blast place both beams on the same creature', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const warlock = createMockCombatCharacter({
      id: 'eldritch-caster-level-5',
      name: 'Warlock',
      level: 5,
      spellcastingAbility: 'charisma',
      stats: {
        ...createMockCombatCharacter().stats,
        charisma: 16
      }
    })
    const ogre = createMockCombatCharacter({
      id: 'eldritch-ogre',
      name: 'Ogre',
      armorClass: 10,
      currentHP: 40,
      maxHP: 40
    })
    const commands = await SpellCommandFactory.createCommands(
      eldritchBlast as unknown as Spell,
      warlock,
      [ogre],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [{ kind: 'creature', id: ogre.id }]
    )
    const state = createMockCombatState({
      characters: [warlock, ogre],
      turnState: {
        currentTurn: 2,
        turnOrder: [warlock.id, ogre.id],
        currentCharacterId: warlock.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    })

    const result = await commands[0].execute(state)
    const targetAfterHits = result.characters.find(character => character.id === ogre.id)
    const attackLogs = result.combatLog.filter(entry => entry.data?.spellId === 'eldritch-blast' && entry.data?.attackType === 'spell')

    expect(combatUtils.rollD20).toHaveBeenCalledTimes(2)
    expect(targetAfterHits?.currentHP).toBeLessThan(ogre.currentHP)
    expect(attackLogs).toHaveLength(2)
    expect(attackLogs.map(entry => entry.data?.spellAttackInstanceIndex)).toEqual([0, 1])
    expect(attackLogs.every(entry => entry.targetIds.includes(ogre.id))).toBe(true)
    expect(attackLogs.every(entry => entry.data?.spellAttackInstanceCount === 2)).toBe(true)
  })

  it('resolves level 5 Eldritch Blast split targets with independent hit and miss outcomes', async () => {
    vi.mocked(combatUtils.rollD20)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(2)
    const warlock = createMockCombatCharacter({
      id: 'eldritch-split-caster',
      name: 'Warlock',
      level: 5,
      spellcastingAbility: 'charisma',
      stats: {
        ...createMockCombatCharacter().stats,
        charisma: 16
      }
    })
    const firstTarget = createMockCombatCharacter({
      id: 'eldritch-first-target',
      name: 'Cultist',
      armorClass: 10,
      currentHP: 20,
      maxHP: 20
    })
    const secondTarget = createMockCombatCharacter({
      id: 'eldritch-second-target',
      name: 'Imp',
      armorClass: 20,
      currentHP: 20,
      maxHP: 20
    })
    const commands = await SpellCommandFactory.createCommands(
      eldritchBlast as unknown as Spell,
      warlock,
      [firstTarget, secondTarget],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [
        { kind: 'creature', id: firstTarget.id },
        { kind: 'creature', id: secondTarget.id }
      ]
    )
    const state = createMockCombatState({
      characters: [warlock, firstTarget, secondTarget],
      turnState: {
        currentTurn: 3,
        turnOrder: [warlock.id, firstTarget.id, secondTarget.id],
        currentCharacterId: warlock.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    })

    const result = await commands[0].execute(state)
    const firstAfter = result.characters.find(character => character.id === firstTarget.id)
    const secondAfter = result.characters.find(character => character.id === secondTarget.id)
    const attackLogs = result.combatLog.filter(entry => entry.data?.spellId === 'eldritch-blast' && entry.data?.attackType === 'spell')

    expect(combatUtils.rollD20).toHaveBeenCalledTimes(2)
    expect(firstAfter?.currentHP).toBeLessThan(firstTarget.currentHP)
    expect(secondAfter?.currentHP).toBe(secondTarget.currentHP)
    expect(attackLogs).toHaveLength(2)
    expect(attackLogs.map(entry => entry.targetIds[0])).toEqual([firstTarget.id, secondTarget.id])
    expect(attackLogs.map(entry => entry.data?.isHit)).toEqual([true, false])
  })

  it('records Eldritch Blast object damage after an object beam hit', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(10)
    const warlock = createMockCombatCharacter({
      id: 'eldritch-object-caster',
      name: 'Warlock',
      level: 1,
      spellcastingAbility: 'charisma',
      stats: {
        ...createMockCombatCharacter().stats,
        charisma: 16
      }
    })
    const selectedObjectTarget = {
      kind: 'object' as const,
      id: 'force-cracked-door',
      name: 'Force-Cracked Door',
      position: { x: 6, y: 7 }
    }
    const commands = await SpellCommandFactory.createCommands(
      eldritchBlast as unknown as Spell,
      warlock,
      [],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [selectedObjectTarget]
    )
    const state = createMockCombatState({
      characters: [warlock],
      turnState: {
        currentTurn: 4,
        turnOrder: [warlock.id],
        currentCharacterId: warlock.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    })

    const result = await commands[0].execute(state)
    const impact = result.spellObjectImpacts?.find(entry => entry.objectId === selectedObjectTarget.id)
    const attackLogs = result.combatLog.filter(entry => entry.data?.spellId === 'eldritch-blast' && entry.data?.attackType === 'spell')

    expect(combatUtils.rollD20).toHaveBeenCalledTimes(1)
    expect(attackLogs).toHaveLength(1)
    expect(impact).toMatchObject({
      objectId: 'force-cracked-door',
      objectName: 'Force-Cracked Door',
      position: { x: 6, y: 7 },
      sourceSpellId: 'eldritch-blast',
      sourceSpellName: 'Eldritch Blast',
      casterId: warlock.id,
      damage: {
        dice: '1d10',
        type: 'Force'
      },
      expiresAtRound: 5
    })
  })
})
