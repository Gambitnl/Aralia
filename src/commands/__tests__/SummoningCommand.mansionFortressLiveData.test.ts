import { describe, expect, it } from 'vitest'
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { SummoningCommand } from '../effects/SummoningCommand'
import {
  UtilityCommand,
  applyMightyFortressSectionDamage,
  advanceMightyFortressPermanence,
  crumbleMightyFortress,
  expireMansionExtradimensionalSpace
} from '../effects/UtilityCommand'
import type { CombatCharacter, CombatState } from '@/types/combat'
import type { Spell, SummoningEffect, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import mordenkainensMagnificentMansion from '../../../public/data/spells/level-7/mordenkainens-magnificent-mansion.json'
import mightyFortress from '../../../public/data/spells/level-8/mighty-fortress.json'

/**
 * This file proves the live Mansion and Fortress packets keep their servant
 * and deferred-space boundary facts visible in runtime-facing state.
 *
 * The goal is narrow on purpose: the summons should stay structured actors
 * instead of becoming generic combat creatures, and the utility-side payloads
 * should keep the authored extradimensional / fortress metadata intact.
 */

// ============================================================================
// Live Spell Packet Proofs
// ============================================================================
// These tests use the real JSON spell packets and the normal command factories.
// That keeps the proof tied to the same data and command surfaces that gameplay
// uses instead of proving a hand-built mock object.
// ============================================================================

describe('SummoningCommand live Mansion and Fortress boundary bridge', () => {
  it('preserves Mordenkainen\'s Magnificent Mansion servant control and extradimensional space metadata', async () => {
    // Use the live packet so the proof fails if future data drops the servant
    // control contract or the extradimensional-space summary.
    const spell = mordenkainensMagnificentMansion as Spell
    const summonEffect = spell.effects.find((effect): effect is SummoningEffect => effect.type === 'SUMMONING')
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(summonEffect).toBeDefined()
    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'mansion-caster',
      name: 'Mansion Caster',
      position: { x: 8, y: 8 },
      initiative: 15
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster]
    })

    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      [],
      7,
      createMockGameState()
    )

    const summonCommand = commands.find((command): command is SummoningCommand => command instanceof SummoningCommand)
    const utilityCommand = commands.find((command): command is UtilityCommand => command instanceof UtilityCommand)

    expect(summonCommand).toBeDefined()
    expect(utilityCommand).toBeDefined()

    const afterSummon = summonCommand!.execute(state)
    const servants = afterSummon.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === spell.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(servants.length).toBeGreaterThan(0)
    expect(servants[0]?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'creature',
      commandCost: 'none',
      commandsPerTurn: 1,
      dismissable: false,
      formName: 'Near-transparent servant',
      initiativePolicy: 'shared',
      control: expect.objectContaining({
        entityType: 'mansion_servants',
        count: 100,
        appearance: 'near-transparent',
        invulnerable: true,
        location: 'inside mansion only',
        obeyCommands: true,
        cannotAttack: true,
        cannotDirectlyHarm: true,
        cannotLeaveDwelling: true
      })
    }))
    expect(servants.every(servant => (servant.abilities || []).length === 0)).toBe(true)

    const afterUtility = utilityCommand!.execute(afterSummon)
    const mansionBoundaryEntry = afterUtility.combatLog.find(entry =>
      entry.data?.utilityEffect?.description === utilityEffect?.description
    )

    expect(mansionBoundaryEntry?.data?.utilityEffect?.createdResource).toEqual(expect.objectContaining({
      food: 'sufficient_for_nine_course_banquet_for_up_to_100_people',
      servants: '100_near_transparent_servants_can_serve_food_and_pour_wine',
      scope: 'exists_only_inside_extradimensional_mansion',
      duration: '24_hours'
    }))
  })

  it('creates a Mansion entrance and expels recorded occupants when the spell ends', async () => {
    const spell = mordenkainensMagnificentMansion as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'mansion-caster',
      name: 'Mansion Caster',
      position: { x: 8, y: 8 },
      initiative: 15
    }) as CombatCharacter
    const designatedGuest = createMockCombatCharacter({
      id: 'designated-guest',
      name: 'Designated Guest',
      position: { x: 10, y: 8 },
      initiative: 12
    }) as CombatCharacter
    const occupant = createMockCombatCharacter({
      id: 'inside-mansion',
      name: 'Inside Mansion',
      position: { x: 99, y: 99 },
      initiative: 10
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster, designatedGuest, occupant]
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 7,
      caster,
      targets: [designatedGuest],
      selectedSpellTargets: [{ kind: 'point', position: { x: 12, y: 8 }, purpose: 'mansion_entrance' }],
      gameState: createMockGameState(),
      effectDuration: spell.duration
    })

    const afterCast = command.execute(state)
    const mansion = afterCast.activeExtradimensionalSpaces?.find(space => space.spellId === spell.id)

    expect(mansion).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      kind: 'magnificent_mansion',
      entrancePosition: { x: 12, y: 8 },
      entranceDimensions: { widthFeet: 5, heightFeet: 10 },
      doorState: 'open',
      imperceptibleWhenClosed: true,
      designatedCreatureIds: [designatedGuest.id],
      floorPlan: expect.objectContaining({
        maxCubes: 50,
        cubeSizeFeet: 10,
        contiguous: true
      }),
      expulsion: expect.objectContaining({
        trigger: 'mansion_spell_ends_with_creatures_or_objects_inside',
        destinationPreference: 'unoccupied_spaces_nearest_to_entrance',
        requiresUnoccupiedSpace: true,
        appliesTo: ['creatures', 'objects']
      })
    }))

    const withOccupant = {
      ...afterCast,
      activeExtradimensionalSpaces: afterCast.activeExtradimensionalSpaces?.map(space =>
        space.id === mansion?.id
          ? {
              ...space,
              occupants: {
                creatureIds: [occupant.id],
                objectIds: ['banquet-table']
              }
            }
          : space
      )
    }

    const afterEnd = expireMansionExtradimensionalSpace(withOccupant, mansion!.id)
    const expelledOccupant = afterEnd.characters.find(character => character.id === occupant.id)

    expect(afterEnd.activeExtradimensionalSpaces?.some(space => space.id === mansion?.id)).toBe(false)
    expect(expelledOccupant?.position).toEqual({ x: 12, y: 8 })
    expect(afterEnd.combatLog.some(entry =>
      entry.data?.expulsionSurface === 'mordenkainens_magnificent_mansion' &&
      entry.data?.expelledCreatureIds?.includes(occupant.id) &&
      entry.data?.expelledObjectIds?.includes('banquet-table') &&
      entry.data?.destinationPreference === 'unoccupied_spaces_nearest_to_entrance'
    )).toBe(true)
  })

  it('preserves Mighty Fortress invisible servant command metadata and fortress lifecycle state', async () => {
    // Use the live packet so the proof fails if future data drops the fortress
    // servant contract or the deferred-structure lifecycle summary.
    const spell = mightyFortress as Spell
    const summonEffect = spell.effects.find((effect): effect is SummoningEffect => effect.type === 'SUMMONING')
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(summonEffect).toBeDefined()
    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'fortress-caster',
      name: 'Fortress Caster',
      position: { x: 12, y: 12 },
      initiative: 14
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster]
    })

    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      [],
      8,
      createMockGameState()
    )

    const summonCommand = commands.find((command): command is SummoningCommand => command instanceof SummoningCommand)
    const utilityCommand = commands.find((command): command is UtilityCommand => command instanceof UtilityCommand)

    expect(summonCommand).toBeDefined()
    expect(utilityCommand).toBeDefined()

    const afterSummon = summonCommand!.execute(state)
    const servants = afterSummon.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === spell.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(servants.length).toBeGreaterThan(0)
    expect(servants[0]?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'servant',
      commandCost: 'free',
      commandsPerTurn: 1,
      dismissable: false,
      formName: 'Invisible servants that function as if created by unseen servant and obey designated creatures.'
    }))

    // The fortress servants should keep a visible command surface. Executing
    // one command proves the summon runtime is not flattening them into
    // ordinary combat actors without the spell-authored cadence.
    const commandableServant = servants[0]
    const commandAbility = commandableServant?.abilities?.find(ability =>
      ability.name === 'Follow Command'
    )

    expect(commandAbility).toBeDefined()

    const commandExecutable = AbilityCommandFactory.createCommands(
      commandAbility!,
      commandableServant!,
      [commandableServant!],
      {} as never
    )

    expect(commandExecutable).toHaveLength(1)

    const afterCommand = commandExecutable[0].execute(afterSummon)
    const updatedServant = afterCommand.characters.find(character => character.id === servants[0]?.id)

    expect(updatedServant?.summonMetadata?.commandsUsedThisTurn).toBe(1)
    expect(afterCommand.combatLog.some(entry =>
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true)

    const afterUtility = utilityCommand!.execute(afterCommand)
    const fortressBoundaryEntry = afterUtility.combatLog.find(entry =>
      entry.data?.utilityEffect?.description === utilityEffect?.description
    )

    expect(fortressBoundaryEntry?.data?.utilityEffect).toEqual(expect.objectContaining({
      createdObjects: expect.arrayContaining([
        expect.objectContaining({
          kind: 'stone_fortress_structure',
          footprint: '120_foot_square_area_must_have_no_buildings_or_structures',
          permanence: 'casting_every_7_days_for_1_year_makes_fortress_permanent'
        })
      ]),
      structureLifecycle: expect.objectContaining({
        expiresAfter: '7_days_unless_recast_chain_completed',
        permanenceCounter: 'same_location_cast_every_7_days_for_1_year',
        removedContents: 'created_furnishings_food_and_objects_crumble_to_dust_when_removed',
        reusableBoundary: 'fortress_is_created_structure_not_a_runtime_map_builder_yet'
      })
    }))
  })

  it('creates Mighty Fortress structure state and resolves section damage, crumble, and permanence', async () => {
    const spell = mightyFortress as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'fortress-caster',
      name: 'Fortress Caster',
      position: { x: 12, y: 12 },
      initiative: 14
    }) as CombatCharacter
    const liftedCreature = createMockCombatCharacter({
      id: 'lifted-guest',
      name: 'Lifted Guest',
      position: { x: 20, y: 20 },
      initiative: 10
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster, liftedCreature]
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 8,
      caster,
      targets: [liftedCreature],
      selectedSpellTargets: [{ kind: 'point', position: { x: 30, y: 30 }, purpose: 'fortress_footprint' }],
      gameState: createMockGameState(),
      effectDuration: spell.duration
    })

    const afterCast = command.execute(state)
    const fortress = afterCast.activeSpellStructures?.find(structure => structure.spellId === spell.id)

    expect(fortress).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      kind: 'mighty_fortress',
      originPosition: { x: 30, y: 30 },
      footprint: expect.objectContaining({
        shape: 'square',
        sizeFeet: 120,
        placementRequirement: '120_foot_square_area_must_have_no_buildings_or_structures'
      }),
      harmlessRiseCreatureIds: [liftedCreature.id],
      sectionDurability: expect.objectContaining({
        armorClass: 15,
        hitPointsPerInch: 30,
        sectionSizeFeet: { width: 10, height: 10 },
        damageImmunities: ['poison', 'psychic'],
        collapseOnZeroHp: true
      }),
      lifecycle: expect.objectContaining({
        durationDays: 7,
        crumblesSafely: true,
        permanenceRequiredSameLocationCasts: 52,
        permanenceCadenceDays: 7,
        sameLocationRequired: true
      })
    }))

    const damaged = applyMightyFortressSectionDamage(afterCast, fortress!.id, {
      sectionId: 'outer-wall-north-1',
      damageAmount: 30,
      damageType: 'bludgeoning',
      thicknessInches: 1
    })
    const damagedFortress = damaged.activeSpellStructures?.find(structure => structure.id === fortress?.id)

    expect(damagedFortress?.sections?.[0]).toEqual(expect.objectContaining({
      id: 'outer-wall-north-1',
      currentHitPoints: 0,
      destroyed: true,
      collapseRisk: 'connected_sections_may_buckle_at_dm_discretion'
    }))
    expect(damaged.combatLog.some(entry =>
      entry.data?.structureSurface === 'mighty_fortress' &&
      entry.data?.sectionDestroyed === true &&
      entry.data?.damageType === 'bludgeoning'
    )).toBe(true)

    const immuneDamage = applyMightyFortressSectionDamage(damaged, fortress!.id, {
      sectionId: 'outer-wall-north-2',
      damageAmount: 99,
      damageType: 'poison',
      thicknessInches: 1
    })
    const immuneFortress = immuneDamage.activeSpellStructures?.find(structure => structure.id === fortress?.id)

    expect(immuneFortress?.sections?.find(section => section.id === 'outer-wall-north-2')).toEqual(expect.objectContaining({
      currentHitPoints: 30,
      destroyed: false
    }))
    expect(immuneDamage.combatLog.some(entry =>
      entry.data?.structureSurface === 'mighty_fortress' &&
      entry.data?.damageIgnored === true &&
      entry.data?.damageType === 'poison'
    )).toBe(true)

    const permanent = Array.from({ length: 52 }).reduce(
      nextState => advanceMightyFortressPermanence(nextState, fortress!.id, { x: 30, y: 30 }),
      immuneDamage
    )
    const permanentFortress = permanent.activeSpellStructures?.find(structure => structure.id === fortress?.id)

    expect(permanentFortress?.permanent).toBe(true)
    expect(permanentFortress?.lifecycle.sameLocationCastCount).toBe(52)

    const crumbled = crumbleMightyFortress(permanent, fortress!.id, 'duration_expired')

    expect(crumbled.activeSpellStructures?.some(structure => structure.id === fortress?.id)).toBe(false)
    expect(crumbled.combatLog.some(entry =>
      entry.data?.structureSurface === 'mighty_fortress' &&
      entry.data?.crumbleReason === 'duration_expired' &&
      entry.data?.removedStructureId === fortress?.id
    )).toBe(true)
  })
})
