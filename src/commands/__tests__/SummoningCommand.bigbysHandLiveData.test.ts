import { describe, expect, it } from 'vitest'
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { UtilityCommand, recordBigbysHandDamage } from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import bigbysHand from '../../../public/data/spells/level-5/bigbys-hand.json'

/**
 * Bigby's Hand is a damageable controlled force object, not a creature summon.
 * This proof keeps its position, durability, command modes, and concentration
 * cleanup in combat state so the spell is not only structured prose.
 */
describe("Bigby's Hand live controlled force bridge", () => {
  it('records active hand state, command metadata, durability, and concentration cleanup', () => {
    const spell = bigbysHand as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()
    expect(utilityEffect?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'Large force hand',
      combatEntity: false,
      moveDistanceFeet: 60,
      actionModes: expect.arrayContaining([
        'Clenched Fist',
        'Forceful Hand',
        'Grasping Hand',
        'Interposing Hand'
      ])
    }))

    const caster = createMockCombatCharacter({
      id: 'bigby-caster',
      name: 'Bigby Caster',
      position: { x: 4, y: 4 },
      maxHP: 68,
      currentHP: 52,
      initiative: 14,
      concentratingOn: {
        spellId: spell.id,
        spellName: spell.name,
        spellLevel: 5,
        startedTurn: 4,
        effectIds: [],
        canDropAsFreeAction: true
      }
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 4,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    const afterCast = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 10, y: 6 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    const force = afterCast.activeSpellForces?.find(record => record.spellId === spell.id)
    const hand = force as typeof force & {
      size?: string;
      occupiesSpace?: boolean;
      placement?: { requiresUnoccupiedSpace?: boolean };
      durability?: {
        armorClass?: number;
        maxHitPoints?: number;
        currentHitPoints?: number;
        endsSpellAtZeroHitPoints?: boolean;
      };
      abilityScores?: { strength?: number; dexterity?: number };
      commandModes?: string[];
      forcedMovement?: { kind?: string; distance?: string; follow?: string };
    }

    expect(hand).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'bigbys_hand',
      position: { x: 10, y: 6 },
      size: 'Large',
      occupiesSpace: false,
      moveAction: 'Bonus Action when cast and on later turns',
      moveDistanceFeet: 60,
      active: true,
      createdTurn: 4,
      expiresAtRound: 14
    }))
    expect(hand?.placement).toEqual({
      requiresUnoccupiedSpace: true,
      lineOfSightRequired: true,
      rangeAnchor: 'within_spell_range'
    })
    expect(hand?.durability).toEqual({
      armorClass: 20,
      maxHitPoints: 68,
      currentHitPoints: 68,
      endsSpellAtZeroHitPoints: true
    })
    expect(hand?.abilityScores).toEqual({
      strength: 26,
      dexterity: 10
    })
    expect(hand?.commandModes).toEqual([
      'Clenched Fist',
      'Forceful Hand',
      'Grasping Hand',
      'Interposing Hand'
    ])
    expect(hand?.forcedMovement).toEqual(expect.objectContaining({
      kind: 'forceful_hand_push',
      distance: '5_feet_plus_5_times_spellcasting_ability_modifier',
      follow: 'hand_moves_with_target_to_remain_within_5_feet'
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellForceSurface === 'bigbys_hand' &&
      (entry.data?.spellForce as { id?: string } | undefined)?.id === hand?.id
    )).toBe(true)

    const afterBreak = new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: createMockGameState()
    }).execute(afterCast)

    expect(afterBreak.activeSpellForces?.some(record => record.id === hand?.id)).toBe(false)
  })

  it('removes the active hand when damage drops it to 0 hit points', () => {
    const spell = bigbysHand as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')
    const caster = createMockCombatCharacter({
      id: 'bigby-damage-caster',
      name: 'Bigby Damage Caster',
      position: { x: 2, y: 2 },
      maxHP: 45,
      currentHP: 45
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 8,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })
    const afterCast = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 3, y: 2 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    const hand = afterCast.activeSpellForces?.find(record => record.spellId === spell.id)

    expect(hand).toBeDefined()

    const afterPartialDamage = recordBigbysHandDamage(afterCast, hand!.id, 20)
    const damagedHand = afterPartialDamage.activeSpellForces?.find(record => record.id === hand?.id)

    expect(damagedHand?.durability?.currentHitPoints).toBe(25)

    const afterDestroyingDamage = recordBigbysHandDamage(afterPartialDamage, hand!.id, 25)

    expect(afterDestroyingDamage.activeSpellForces?.some(record => record.id === hand?.id)).toBe(false)
    expect(afterDestroyingDamage.combatLog.some(entry =>
      entry.data?.destroyedSpellForceId === hand?.id &&
      entry.data?.spellForceSurface === 'bigbys_hand' &&
      entry.data?.endReason === 'created_entity_drops_to_0_hp'
    )).toBe(true)
  })
})
