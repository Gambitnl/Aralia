import { SpellCommandFactory } from '../SpellCommandFactory'
import scrying from '../../../../public/data/spells/level-5/scrying.json'
import type { CombatCharacter, CombatState } from '@/types/combat'
import type { Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core'
import { buildSpellMapArtifactMarkers } from '@/components/BattleMap/spellMapArtifacts'

/**
 * This file proves the bounded Scrying creature-save bridge from live spell
 * data through command creation and execution.
 *
 * Called by: focused SpellCommandFactory Vitest runs.
 * Depends on: Scrying JSON, SpellCommandFactory, and combat test factories.
 */

const makeCharacter = (id: string, overrides: Partial<CombatCharacter> = {}): CombatCharacter =>
  createMockCombatCharacter({
    id,
    name: id,
    level: 5,
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '1'
    },
    ...overrides
  })

const makeState = (caster: CombatCharacter, target: CombatCharacter): CombatState =>
  createMockCombatState({
    characters: [caster, target],
    combatLog: []
  })

const runScrying = async (
  playerInput: string,
  caster: CombatCharacter,
  target: CombatCharacter,
  selectedSpellTargets?: Parameters<typeof SpellCommandFactory.createCommands>[8],
  initialState?: CombatState
) => {
  const commands = await SpellCommandFactory.createCommands(
    scrying as unknown as Spell,
    caster,
    [target],
    5,
    createMockGameState(),
    playerInput,
    undefined,
    undefined,
    selectedSpellTargets
  )
  const bridge = commands.find(command => command.metadata.effectType === 'scrying_save')
  expect(bridge).toBeDefined()
  return bridge!.execute(initialState ?? makeState(caster, target))
}

describe('Scrying live save resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies the authored knowledge and physical-connection modifiers', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const caster = makeCharacter('caster')
    const target = makeCharacter('target')

    const state = await runScrying(
      'Creature target;knowledge=Familiar;connection=Likeness or picture',
      caster,
      target
    )
    const saveLog = state.combatLog.find(entry => entry.data?.saveType === 'Wisdom')

    expect(saveLog?.data).toEqual(expect.objectContaining({
      spellId: 'scrying',
      saveType: 'Wisdom',
      saveSucceeded: true,
      modifiersApplied: [
        { source: 'Scrying knowledge: Familiar', value: -5 },
        { source: 'Scrying connection: Likeness or picture', value: -2 }
      ],
      saveOutcomeOverride: 'success_no_effect_24_hours'
    }))
  })

  it('resolves voluntary failure only when the target knows the spell is being cast', async () => {
    const caster = makeCharacter('caster')
    const target = makeCharacter('target')

    const state = await runScrying(
      'Creature target;knowledge=Firsthand;connection=Possession or garment;targetKnowsCasting=true;voluntaryFailure=true',
      caster,
      target
    )
    const saveLog = state.combatLog.find(entry => entry.data?.saveOutcomeOverride === 'voluntary_failure')

    expect(saveLog?.data).toEqual(expect.objectContaining({
      spellId: 'scrying',
      saveType: 'Wisdom',
      saveSucceeded: false,
      saveTotal: 0,
      modifiersApplied: [
        { source: 'Scrying knowledge: Firsthand', value: 0 },
        { source: 'Scrying connection: Possession or garment', value: -4 }
      ]
    }))
    expect(state.characters.find(character => character.id === caster.id)?.concentratingOn?.spellId).toBe('scrying')
  })

  it('persists a 24-hour successful-save lockout and rejects a retarget before rolling again', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const caster = makeCharacter('caster')
    const target = makeCharacter('target')

    const firstState = await runScrying('Creature target', caster, target)
    expect(firstState.activeSpellTargetLockouts).toEqual([
      expect.objectContaining({
        spellId: 'scrying',
        targetId: target.id,
        reason: expect.stringContaining('24 hours')
      })
    ])

    const secondState = await runScrying('Creature target', caster, target, undefined, firstState)
    const rejection = secondState.combatLog.find(entry => entry.data?.rejectedReason === 'target_locked_out_24_hours')
    expect(rejection?.data).toEqual(expect.objectContaining({
      spellId: 'scrying',
      lockoutExpiresAtTimestamp: expect.any(Number)
    }))
  })

  it('creates a following sensor and renders it at the target position after movement', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const caster = makeCharacter('caster')
    const target = makeCharacter('target', { position: { x: 2, y: 0 } })
    const state = await runScrying(
      'Creature target;knowledge=Familiar;connection=Likeness or picture',
      caster,
      target
    )
    const sensor = state.activeSpellHelpers?.find(helper => helper.kind === 'scrying_sensor')
    expect(sensor?.remoteSensor).toEqual(expect.objectContaining({
      mode: 'creature_following',
      targetId: target.id,
      followDistanceFeet: 10,
      senses: ['sight', 'hearing']
    }))

    const movedState = {
      ...state,
      characters: state.characters.map(character => character.id === target.id
        ? { ...character, position: { x: 6, y: 4 } }
        : character)
    }
    const marker = buildSpellMapArtifactMarkers(
      { helpers: movedState.activeSpellHelpers },
      movedState.characters
    ).find(candidate => candidate.id === `helper-${sensor?.id}`)
    expect(marker?.position).toEqual({ x: 6, y: 4 })
    expect(marker?.radiusFeet).toBe(10)
  })

  it('creates a stationary sensor from a selected location point', async () => {
    const caster = makeCharacter('caster')
    const target = makeCharacter('target')
    const state = await runScrying(
      'Location target',
      caster,
      target,
      [{ kind: 'point', position: { x: 8, y: 5 }, purpose: 'scrying_location' }]
    )
    const sensor = state.activeSpellHelpers?.find(helper => helper.kind === 'scrying_sensor')

    expect(sensor).toEqual(expect.objectContaining({
      position: { x: 8, y: 5 },
      remoteSensor: expect.objectContaining({
        mode: 'location_stationary',
        senses: ['sight', 'hearing']
      })
    }))
    expect(sensor?.remoteSensor?.targetId).toBeUndefined()
  })
})
