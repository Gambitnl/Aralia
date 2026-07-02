import { describe, expect, it } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import giantInsect from '../../../public/data/spells/level-4/giant-insect.json'

/**
 * Giant Insect is authored as a utility packet with nested summon metadata,
 * because the player chooses an insect form while the stat block scales from
 * the slot level.
 *
 * This proof protects that utility-side bridge: the live spell must create a
 * real allied insect actor, preserve the chosen form and slot-scaling facts,
 * and carry the free verbal command plus disappearance rules onto summon
 * metadata instead of leaving those rules in prose.
 */

describe('UtilityCommand live Giant Insect summon bridge', () => {
  it('creates an allied giant insect actor with form, scaling, command, and lifecycle metadata', () => {
    const utilityEffect = giantInsect.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'giant-insect-caster',
      name: 'Giant Insect Caster',
      team: 'player',
      position: { x: 2, y: 2 },
      initiative: 14
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster]
    })

    const afterCast = new UtilityCommand(utilityEffect!, buildContext(caster, 'Giant Spider')).execute(state)
    const insect = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === giantInsect.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(insect).toEqual(expect.objectContaining({
      name: 'Giant Spider',
      team: caster.team,
      position: { x: 3, y: 2 },
      currentHP: 30,
      maxHP: 30,
      creatureTypes: expect.arrayContaining(['Beast'])
    }))
    expect(insect?.stats).toEqual(expect.objectContaining({
      speed: 40,
      cr: 'giant_insect'
    }))
    expect(insect?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'giant_insect',
      formName: 'Giant Spider',
      sourceName: giantInsect.name,
      initiativePolicy: 'shared',
      commandCost: 'none',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      persistent: false,
      lifecycle: expect.objectContaining({
        zeroHpEnding: 'summoned giant insect disappears when it drops to 0 hit points',
        spellEnding: 'summoned giant insect disappears when the spell ends'
      }),
      control: expect.objectContaining({
        entityType: 'giant_insect',
        allegiance: 'ally',
        obedience: 'verbal commands with no caster action',
        noCommandBehavior: 'Dodge and avoid danger'
      }),
      formTraits: expect.arrayContaining([
        expect.objectContaining({
          name: 'Giant Insect Stat Scaling',
          notes: expect.stringContaining('AC 15; HP 30')
        }),
        expect.objectContaining({
          name: 'Spider Climb and Web Bolt',
          notes: expect.stringContaining('Ranged spell attack')
        })
      ])
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === giantInsect.id &&
      entry.data?.summonSurface === 'giant-insect' &&
      entry.data?.formName === 'Giant Spider'
    )).toBe(true)
  })
})

function buildContext(caster: CombatCharacter, playerInput: string): CommandContext {
  return {
    spellId: giantInsect.id,
    spellName: giantInsect.name,
    castAtLevel: giantInsect.level,
    caster,
    targets: [],
    playerInput,
    gameState: createMockGameState()
  } satisfies CommandContext
}
