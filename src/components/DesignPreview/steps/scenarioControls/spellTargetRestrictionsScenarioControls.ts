// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 17:54:17
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import mindSliverSpellData from '@/data/spells/level-0/mind-sliver.json';
import guidanceSpellData from '@/data/spells/level-0/guidance.json';
import lightSpellData from '@/data/spells/level-0/light.json';
import holdPersonSpellData from '@/data/spells/level-2/hold-person.json';
import bladeWardSpellData from '@/data/spells/level-0/blade-ward.json';
import blessSpellData from '@/data/spells/level-1/bless.json';
import type {
  CombatCharacter,
  PlayerCharacter,
  SpellSlots,
} from '../../../../types';
import type { TargetableMapObject } from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { validateSpellTargetSelection } from '../../../../systems/spells/targeting/SpellTargetSelectionValidator';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

/**
 * This file builds and controls the Spell Target Restrictions sandbox fixture.
 *
 * The generic expanded scenario does not include the different target kinds
 * needed to prove spell restrictions. This module adds canonical spell abilities,
 * a hostile creature, a willing ally, and a loose object to the real combat
 * character and map records. Each switch changes exactly one fact read by the
 * production TargetResolver; spell metadata itself is never copied or rewritten.
 *
 * Called by: the Tactical Sandbox scenario-control registry and preview page.
 * Depends on: real spell JSON, createAbilityFromSpell, and the shared control contract.
 */

// ============================================================================
// Stable Scenario Identities and Positions
// ============================================================================
// These ids match the generic expanded scenario and add two stable fixture
// identities. All targets stay on the player side of the authored wall so line
// of sight cannot hide the metadata restriction currently under review.
// ============================================================================

const TESTER_ID = 'spell_target_restrictions-tester';
const RESTRICTION_TARGET_ID = 'spell_target_restrictions-target';
const WILLING_ALLY_ID = 'spell-target-restrictions-willing-ally';
const PRACTICE_OBJECT_ID = 'spell-target-restrictions-practice-object';

const TESTER_POSITION = { x: 3, y: 5 } as const;
const RESTRICTION_TARGET_POSITION = { x: 6, y: 5 } as const;
const WILLING_ALLY_POSITION = { x: 3, y: 6 } as const;
const PRACTICE_OBJECT_POSITION = { x: 4, y: 5 } as const;

const DEFAULT_CREATURE_TYPES = ['Humanoid'];
const REJECTED_CREATURE_TYPES = ['Undead'];

type WillingCombatCharacter = CombatCharacter & {
  isWilling?: boolean;
};

interface SpellTargetRestrictionsFixture {
  mapData: NonNullable<PreviewCombatScenarioControlSnapshot['mapData']>;
  characters: CombatCharacter[];
}

// ============================================================================
// Canonical Spell Ability Fixture
// ============================================================================
// The four source spells each exercise a different restriction: enemy relation,
// Humanoid taxonomy, willing consent, and loose-object eligibility. The normal
// spell factory translates their committed JSON into the same Ability records
// used by production combat, preserving metadata parity for the sandbox.
// ============================================================================

const CANONICAL_RESTRICTION_SPELLS = [
  mindSliverSpellData,
  holdPersonSpellData,
  guidanceSpellData,
  lightSpellData,
  bladeWardSpellData,
  blessSpellData,
] as unknown as Spell[];

const MIND_SLIVER = mindSliverSpellData as unknown as Spell;
const GUIDANCE = guidanceSpellData as unknown as Spell;
const LIGHT = lightSpellData as unknown as Spell;
const BLADE_WARD = bladeWardSpellData as unknown as Spell;
const BLESS = blessSpellData as unknown as Spell;
const STABLE_CAST_EVENT_ID = 'spell-target-restrictions-stable-cast';

const CANONICAL_RESTRICTION_SPELL_IDS = new Set(
  CANONICAL_RESTRICTION_SPELLS.map(spell => spell.id),
);

function createInitialSpellSlots(existing: SpellSlots | undefined): SpellSlots {
  // The generated fighter may have no usable second-level slot. Hold Person
  // needs one, so initial fixture installation grants two while preserving any
  // stronger existing resource values. Later toggle clicks do not refill slots.
  const levelTwoCurrent = Math.max(existing?.level_2.current ?? 0, 2);
  const levelTwoMaximum = Math.max(existing?.level_2.max ?? 0, levelTwoCurrent);

  return {
    level_1: existing?.level_1 ?? { current: 0, max: 0 },
    level_2: { current: levelTwoCurrent, max: levelTwoMaximum },
    level_3: existing?.level_3 ?? { current: 0, max: 0 },
    level_4: existing?.level_4 ?? { current: 0, max: 0 },
    level_5: existing?.level_5 ?? { current: 0, max: 0 },
    level_6: existing?.level_6 ?? { current: 0, max: 0 },
    level_7: existing?.level_7 ?? { current: 0, max: 0 },
    level_8: existing?.level_8 ?? { current: 0, max: 0 },
    level_9: existing?.level_9 ?? { current: 0, max: 0 },
  };
}

function installCanonicalSpellAbilities(
  tester: CombatCharacter,
  fixtureAlreadyInstalled: boolean,
): CombatCharacter {
  // CombatCharacter is the battle copy of a PlayerCharacter. The spell factory
  // reads fields shared by both shapes, so the scenario can use the live caster
  // snapshot without inventing a second player record or hand-building spells.
  const caster = tester as unknown as PlayerCharacter;
  const restrictionAbilities = CANONICAL_RESTRICTION_SPELLS.map(spell =>
    createAbilityFromSpell(spell, caster),
  );

  // Replace only older copies of these four spells. Generated attacks and any
  // unrelated abilities remain available around the proof fixture.
  const abilities = [
    ...tester.abilities.filter(ability =>
      !CANONICAL_RESTRICTION_SPELL_IDS.has(ability.id),
    ),
    ...restrictionAbilities,
  ];

  return {
    ...tester,
    name: 'Spell Restriction Tester',
    position: { ...TESTER_POSITION },
    // The authored tester wins initialization deterministically so mounted
    // Resolve can prove payment rather than being rejected by random initiative.
    initiative: 40,
    stats: {
      ...tester.stats,
      dexterity: 20,
      baseInitiative: 30,
    },
    abilities,
    spellSlots: fixtureAlreadyInstalled
      ? tester.spellSlots
      : createInitialSpellSlots(tester.spellSlots),
  };
}

// ============================================================================
// Creature, Ally, and Object Fixture
// ============================================================================
// Initial installation turns the generic enemy into a known Humanoid, clones a
// passive adjacent ally from that complete combat shape, and publishes a visible
// loose object. Once installed, later control clicks preserve the other three
// controlled facts instead of silently resetting neighboring switches.
// ============================================================================

function createRestrictionTarget(
  source: CombatCharacter,
  fixtureAlreadyInstalled: boolean,
): CombatCharacter {
  // The migration-era combat model reads taxonomy from both the top-level and
  // legacy stats locations. Keeping them synchronized makes the toggle prove
  // the real compatibility path instead of leaving a stale Humanoid label behind.
  const currentCreatureTypes = fixtureAlreadyInstalled
    ? source.creatureTypes ?? source.stats.creatureTypes ?? DEFAULT_CREATURE_TYPES
    : DEFAULT_CREATURE_TYPES;

  return {
    ...source,
    name: 'Restriction Target',
    position: { ...RESTRICTION_TARGET_POSITION },
    team: fixtureAlreadyInstalled ? source.team : 'enemy',
    creatureTypes: [...currentCreatureTypes],
    stats: {
      ...source.stats,
      creatureTypes: [...currentCreatureTypes],
    },
    abilities: [],
    initiative: fixtureAlreadyInstalled ? source.initiative : 1,
  };
}

// ============================================================================
// Expected-First Selection Cases
// ============================================================================
// These selectors assemble rich production target envelopes. The shared
// validator owns legality; the scenario only chooses controlled facts and turns
// its receipt into readable evidence before the mounted executor can pay.
// ============================================================================

type TargetCase =
  | 'hostile_creature'
  | 'ally_creature'
  | 'self'
  | 'willing_ally'
  | 'unwilling_ally'
  | 'loose_object'
  | 'carried_object'
  | 'multi_unique'
  | 'multi_duplicate'
  | 'multi_over_cap';

type SpatialCase = 'clear' | 'out_of_range' | 'blocked_sight' | 'total_cover';

function readCase<T extends string>(
  snapshot: PreviewCombatScenarioControlSnapshot,
  id: string,
  fallback: T,
): T {
  const value = snapshot.controlValues?.[id];
  return typeof value === 'string' ? value as T : fallback;
}

function applySpatialCase(
  fixture: SpellTargetRestrictionsFixture,
  spatialCase: SpatialCase,
): SpellTargetRestrictionsFixture {
  const targetPosition = spatialCase === 'out_of_range'
    ? { x: 15, y: 5 }
    : RESTRICTION_TARGET_POSITION;
  const characters = setCharacterFact(
    fixture.characters,
    RESTRICTION_TARGET_ID,
    character => ({ ...character, position: targetPosition }),
  );

  // A sight blocker and Total Cover both stop line of sight in production. The
  // Total Cover case also publishes the cover classification for the renderer.
  const blockerId = '4-5';
  const tiles = new Map(fixture.mapData.tiles);
  const existing = tiles.get(blockerId);
  if (existing) {
    tiles.set(blockerId, {
      ...existing,
      terrain: spatialCase === 'blocked_sight' || spatialCase === 'total_cover'
        ? 'wall'
        : 'floor',
      blocksMovement: spatialCase === 'blocked_sight' || spatialCase === 'total_cover',
      blocksLoS: spatialCase === 'blocked_sight' || spatialCase === 'total_cover',
      providesCover: spatialCase === 'total_cover',
    });
  }

  return {
    characters,
    mapData: { ...fixture.mapData, tiles },
  };
}

function prepareExpectedSelection(
  application: PreviewCombatScenarioControlApplication,
): {
  fixture: SpellTargetRestrictionsFixture;
  spell: Spell;
  targetIds: string[];
  selectedTargets: import('../../../../types/combat').SelectedSpellTarget[];
} | null {
  const installed = installRestrictionFixture(application.snapshot);
  if (!installed) return null;

  const targetCase = readCase<TargetCase>(application.snapshot, 'target_case', 'hostile_creature');
  const spatialCase = readCase<SpatialCase>(application.snapshot, 'spatial_case', 'clear');
  let fixture = applySpatialCase(installed, spatialCase);

  if (targetCase === 'unwilling_ally') {
    fixture = {
      ...fixture,
      characters: setCharacterFact(fixture.characters, WILLING_ALLY_ID, character => ({
        ...character,
        isWilling: false,
      }) as WillingCombatCharacter),
    };
  }
  if (targetCase === 'carried_object') {
    fixture = setObjectLooseFact(fixture, false);
  }

  if (spatialCase !== 'clear') {
    return {
      fixture,
      spell: BLESS,
      targetIds: [RESTRICTION_TARGET_ID],
      selectedTargets: [{ kind: 'creature', id: RESTRICTION_TARGET_ID }],
    };
  }

  if (targetCase === 'self') {
    return {
      fixture,
      spell: BLADE_WARD,
      targetIds: [TESTER_ID],
      selectedTargets: [{ kind: 'creature', id: TESTER_ID }],
    };
  }
  if (targetCase === 'ally_creature' || targetCase === 'willing_ally' || targetCase === 'unwilling_ally') {
    return {
      fixture,
      spell: GUIDANCE,
      targetIds: [WILLING_ALLY_ID],
      selectedTargets: [{ kind: 'creature', id: WILLING_ALLY_ID }],
    };
  }
  if (targetCase === 'loose_object' || targetCase === 'carried_object') {
    const object = fixture.mapData.targetableObjects?.find(candidate => candidate.id === PRACTICE_OBJECT_ID)!;
    return {
      fixture,
      spell: LIGHT,
      targetIds: [],
      selectedTargets: [{
        kind: 'object',
        id: object.id,
        name: object.name,
        position: object.position,
        object,
      }],
    };
  }
  if (targetCase.startsWith('multi_')) {
    const ids = targetCase === 'multi_duplicate'
      ? [TESTER_ID, WILLING_ALLY_ID, WILLING_ALLY_ID]
      : targetCase === 'multi_over_cap'
        ? [TESTER_ID, RESTRICTION_TARGET_ID, WILLING_ALLY_ID, 'fourth-target']
        : [TESTER_ID, RESTRICTION_TARGET_ID, WILLING_ALLY_ID];
    return {
      fixture,
      spell: BLESS,
      targetIds: ids,
      selectedTargets: ids.map(id => ({ kind: 'creature' as const, id })),
    };
  }

  return {
    fixture,
    spell: MIND_SLIVER,
    targetIds: [RESTRICTION_TARGET_ID],
    selectedTargets: [{ kind: 'creature', id: RESTRICTION_TARGET_ID }],
  };
}

function resolveExpectedSelection(
  application: PreviewCombatScenarioControlApplication,
  replay: boolean,
): PreviewCombatScenarioControlPatch {
  const prepared = prepareExpectedSelection(application);
  if (!prepared) {
    return { logMessage: 'Spell target attempt rejected because its authored fixture is unavailable.' };
  }

  const caster = prepared.fixture.characters.find(character => character.id === TESTER_ID)!;
  const rejection = validateSpellTargetSelection({
    spell: prepared.spell,
    caster,
    characters: prepared.fixture.characters,
    mapData: prepared.fixture.mapData,
    selectedTargets: prepared.selectedTargets,
    castLevel: prepared.spell.level,
  });
  if (rejection) {
    return {
      ...prepared.fixture,
      logMessage: `TARGET REJECTED (${rejection.code}): ${rejection.message} Action, slot, stable event, commands, and rolls were not started.`,
    };
  }

  // The shared host contract currently executes one creature at a time. Object
  // and multi-target selections still receive production validation here; their
  // legal payment remains on the normal map-selection route until the locked host
  // can carry the already-supported rich target envelope directly.
  if (prepared.targetIds.length !== 1) {
    return {
      ...prepared.fixture,
      logMessage: `TARGET VALID: ${prepared.spell.name} accepted ${prepared.selectedTargets.length} unique target(s) within its canonical cap; no sandbox payment was requested.`,
    };
  }

  const targetId = prepared.targetIds[0];
  const target = prepared.fixture.characters.find(character => character.id === targetId);
  if (!target) {
    return {
      ...prepared.fixture,
      logMessage: `TARGET VALID: ${prepared.spell.name} accepted the object target; no creature-only host payment was requested.`,
    };
  }

  return {
    ...prepared.fixture,
    abilityExecution: {
      ability: createAbilityFromSpell(prepared.spell, caster as unknown as PlayerCharacter),
      casterId: caster.id,
      targetId,
      executionEventId: STABLE_CAST_EVENT_ID,
      saveRng: () => 0.45,
      damageRng: () => 0.45,
    },
    logMessage: replay
      ? `REPLAY REQUESTED: ${STABLE_CAST_EVENT_ID}; production must return a no-op without another Action, slot, command, or roll.`
      : `TARGET VALID: ${prepared.spell.name} accepted ${target.name}; production payment now owns the stable cast event.`,
  };
}

function resetExpectedBoard(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const installed = installRestrictionFixture(application.snapshot);
  if (!installed) {
    return { logMessage: 'Spell target Reset skipped because its authored fixture is unavailable.' };
  }

  const characters = installed.characters.map(character => {
    if (character.id === TESTER_ID) {
      return resetEconomy({
        ...character,
        position: { ...TESTER_POSITION },
        spellSlots: createInitialSpellSlots(undefined),
      });
    }
    if (character.id === RESTRICTION_TARGET_ID) {
      return createRestrictionTarget(character, false);
    }
    if (character.id === WILLING_ALLY_ID) {
      return createWillingAlly(character, undefined);
    }
    return character;
  });

  return {
    characters,
    mapData: setObjectLooseFact({ ...installed, characters }, true).mapData,
    reinitializeCombat: true,
    logMessage: 'RESET EXACT: authored positions, teams, willingness, taxonomy, loose object, Action, slots, and turn initialization restored.',
  };
}

function createWillingAlly(
  source: CombatCharacter,
  existing: WillingCombatCharacter | undefined,
): WillingCombatCharacter {
  // The ally reuses a complete generated combatant shape, but receives its own
  // stable identity and no attacks. Explicit willingness is the only field its
  // control changes; team, position, and Humanoid identity remain fixed.
  const base = existing ?? source;
  const isWilling = existing?.isWilling ?? true;

  return {
    ...base,
    id: WILLING_ALLY_ID,
    name: 'Willing Volunteer',
    position: { ...WILLING_ALLY_POSITION },
    team: 'player',
    creatureTypes: [...DEFAULT_CREATURE_TYPES],
    stats: {
      ...base.stats,
      creatureTypes: [...DEFAULT_CREATURE_TYPES],
    },
    abilities: [],
    isWilling,
  };
}

function createPracticeObject(
  existing: TargetableMapObject | undefined,
): TargetableMapObject {
  // Light accepts a nearby object but excludes one that is worn or carried.
  // All other facts are explicit and stable so this switch isolates that one
  // eligibility rule without weight, magic, attachment, or range ambiguity.
  return {
    id: PRACTICE_OBJECT_ID,
    name: 'Practice Lantern',
    position: { ...PRACTICE_OBJECT_POSITION },
    size: 'Tiny',
    weightPounds: 1,
    isWornOrCarried: existing?.isWornOrCarried ?? false,
    isMagical: false,
    isFixedToSurface: false,
  };
}

function installRestrictionFixture(
  snapshot: PreviewCombatScenarioControlSnapshot,
): SpellTargetRestrictionsFixture | null {
  const mapData = snapshot.mapData;
  const tester = snapshot.characters.find(character => character.id === TESTER_ID);
  const target = snapshot.characters.find(character =>
    character.id === RESTRICTION_TARGET_ID,
  );

  // The module only deepens its own authored scenario. If the registry calls it
  // before the board exists or against another board, it reports the problem
  // rather than fabricating replacement combatants.
  if (!mapData || !tester || !target) {
    return null;
  }

  const existingAlly = snapshot.characters.find(character =>
    character.id === WILLING_ALLY_ID,
  ) as WillingCombatCharacter | undefined;
  const existingObject = (mapData.targetableObjects ?? []).find(targetObject =>
    targetObject.id === PRACTICE_OBJECT_ID,
  );
  const fixtureAlreadyInstalled = Boolean(existingAlly && existingObject);

  const controlledTester = installCanonicalSpellAbilities(
    tester,
    fixtureAlreadyInstalled,
  );
  const controlledTarget = createRestrictionTarget(
    target,
    fixtureAlreadyInstalled,
  );
  const controlledAlly = createWillingAlly(controlledTarget, existingAlly);
  const controlledObject = createPracticeObject(existingObject);

  // Replace the three owned actor records in place and append the ally on first
  // installation. Every unrelated combatant retains both identity and order.
  const characters = snapshot.characters
    .filter(character => character.id !== WILLING_ALLY_ID)
    .map(character => {
      if (character.id === TESTER_ID) {
        return controlledTester;
      }
      if (character.id === RESTRICTION_TARGET_ID) {
        return controlledTarget;
      }
      return character;
    });
  characters.push(controlledAlly);

  // Replace only the practice object while retaining every object published by
  // the map or another scenario helper.
  const targetableObjects = (mapData.targetableObjects ?? [])
    .filter(targetObject => targetObject.id !== PRACTICE_OBJECT_ID);
  targetableObjects.push(controlledObject);

  return {
    mapData: {
      ...mapData,
      targetableObjects,
    },
    characters,
  };
}

// ============================================================================
// Narrow Fact Mutations
// ============================================================================
// These helpers operate on the freshly copied fixture and alter only the field
// named by one player-facing control. They never change spell JSON or mutate the
// snapshot supplied by React.
// ============================================================================

function setCharacterFact(
  characters: CombatCharacter[],
  characterId: string,
  change: (character: CombatCharacter) => CombatCharacter,
): CombatCharacter[] {
  // Unrelated actors are deliberately reused. Only the named scenario fixture
  // receives a fresh record for the changed controlled fact.
  return characters.map(character =>
    character.id === characterId ? change(character) : character,
  );
}

function setObjectLooseFact(
  fixture: SpellTargetRestrictionsFixture,
  isLoose: boolean,
): SpellTargetRestrictionsFixture {
  // The positive UI label is "Object is loose", while the production object
  // field records the inverse worn-or-carried condition.
  return {
    ...fixture,
    mapData: {
      ...fixture.mapData,
      targetableObjects: (fixture.mapData.targetableObjects ?? []).map(targetObject =>
        targetObject.id === PRACTICE_OBJECT_ID
          ? { ...targetObject, isWornOrCarried: !isLoose }
          : targetObject,
      ),
    },
  };
}

function requireToggleValue(
  application: PreviewCombatScenarioControlApplication,
): boolean | null {
  // Strings such as "false" are not valid toggle facts. Rejecting them avoids
  // a truthy string silently producing the opposite game state.
  return typeof application.value === 'boolean'
    ? application.value
    : null;
}

// ============================================================================
// Shared Control Application
// ============================================================================
// Every recognized control first guarantees the complete canonical fixture,
// then changes its one target fact. The returned patch is the only output, so
// applying it remains deterministic and side-effect free.
// ============================================================================

function applySpellTargetRestrictionControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  // Selector controls prepare their fact through the next complete control-value
  // snapshot. They do not spend anything until Resolve is pressed.
  if (application.controlId === 'target_case' || application.controlId === 'spatial_case') {
    const prepared = prepareExpectedSelection(application);
    return prepared
      ? {
          ...prepared.fixture,
          logMessage: `Spell target input prepared: ${application.controlId} = ${String(application.value)}. Resolve Target Attempt will use production validation.`,
        }
      : { logMessage: 'Spell target input skipped because its authored fixture is unavailable.' };
  }

  // Action controls are inert while defaults load. A true click performs one
  // bounded transaction, replay request, or exact fixture restoration.
  if (
    application.controlId === 'resolve_target_attempt'
    || application.controlId === 'replay_target_attempt'
    || application.controlId === 'reset_targeting_board'
  ) {
    if (application.value === false) return { logMessage: '' };
    if (application.value !== true) {
      return { logMessage: `Spell Target Restrictions action ${application.controlId} requires a button trigger.` };
    }
    if (application.controlId === 'resolve_target_attempt') {
      return resolveExpectedSelection(application, false);
    }
    if (application.controlId === 'replay_target_attempt') {
      return resolveExpectedSelection(application, true);
    }
    return resetExpectedBoard(application);
  }

  const enabled = requireToggleValue(application);

  // Malformed values and stale ids must not install or alter scenario state.
  if (enabled === null) {
    return {
      logMessage: `Spell Target Restrictions control "${application.controlId}" requires an on/off value.`,
    };
  }

  const knownControl = spellTargetRestrictionsScenarioControlModule.controls.some(
    control => control.id === application.controlId,
  );
  if (!knownControl) {
    return {
      logMessage: `Unknown Spell Target Restrictions control: ${application.controlId}.`,
    };
  }

  const fixture = installRestrictionFixture(application.snapshot);
  if (!fixture) {
    return {
      logMessage: 'Spell Target Restrictions control skipped because its battle map, tester, or target is unavailable.',
    };
  }

  if (application.controlId === 'enemy_is_hostile') {
    // Mind Sliver reads team relation from the production target resolver.
    return {
      ...fixture,
      characters: setCharacterFact(
        fixture.characters,
        RESTRICTION_TARGET_ID,
        character => ({ ...character, team: enabled ? 'enemy' : 'player' }),
      ),
      logMessage: enabled
        ? 'Restriction Target now counts as an enemy for enemy-only spells.'
        : 'Restriction Target now counts as an ally, so enemy-only spells must reject it.',
    };
  }

  if (application.controlId === 'target_is_humanoid') {
    const creatureTypes = enabled
      ? DEFAULT_CREATURE_TYPES
      : REJECTED_CREATURE_TYPES;

    // Hold Person reads both taxonomy locations through TargetValidationUtils.
    return {
      ...fixture,
      characters: setCharacterFact(
        fixture.characters,
        RESTRICTION_TARGET_ID,
        character => ({
          ...character,
          creatureTypes: [...creatureTypes],
          stats: {
            ...character.stats,
            creatureTypes: [...creatureTypes],
          },
        }),
      ),
      logMessage: enabled
        ? 'Restriction Target is a Humanoid and is eligible for Hold Person.'
        : 'Restriction Target is Undead, so Hold Person must reject it.',
    };
  }

  if (application.controlId === 'ally_is_willing') {
    // Guidance's structured filter reads this explicit consent marker.
    return {
      ...fixture,
      characters: setCharacterFact(
        fixture.characters,
        WILLING_ALLY_ID,
        character => ({ ...character, isWilling: enabled }) as WillingCombatCharacter,
      ),
      logMessage: enabled
        ? 'Willing Volunteer consents to willing-creature spells such as Guidance.'
        : 'Willing Volunteer refuses consent, so willing-creature spells must reject them.',
    };
  }

  const objectFixture = setObjectLooseFact(fixture, enabled);

  // Light reads the object's worn-or-carried flag through TargetResolver. This
  // final branch is safe because every other declared control returned above.
  return {
    ...objectFixture,
    logMessage: enabled
      ? 'Practice Lantern is loose and can be considered by object-targeting spells.'
      : 'Practice Lantern is worn or carried, so Light must reject it.',
  };
}

// ============================================================================
// Registry Export
// ============================================================================
// All defaults are legal states. Reset Board applies them through this same
// pure function, recreating the canonical fixture without a parent-side special case.
// ============================================================================

export const spellTargetRestrictionsScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'spell_target_restrictions',
  controls: [
    {
      id: 'target_case',
      label: 'Target category / willingness',
      description: 'Choose canonical hostile, ally, self, willing, unwilling, object, or multi-target facts.',
      kind: 'select',
      defaultValue: 'hostile_creature',
      options: [
        { value: 'hostile_creature', label: 'Hostile creature · valid' },
        { value: 'ally_creature', label: 'Ally creature · valid' },
        { value: 'self', label: 'Self · valid' },
        { value: 'willing_ally', label: 'Willing ally · valid' },
        { value: 'unwilling_ally', label: 'Unwilling ally · reject' },
        { value: 'loose_object', label: 'Loose object · valid' },
        { value: 'carried_object', label: 'Carried object · reject' },
        { value: 'multi_unique', label: 'Bless · 3 unique' },
        { value: 'multi_duplicate', label: 'Bless · duplicate reject' },
        { value: 'multi_over_cap', label: 'Bless · 4 over cap' },
      ],
    },
    {
      id: 'spatial_case',
      label: 'Range / sight / cover',
      description: 'Keep the selection clear, move it beyond 30 feet, block sight, or add Total Cover.',
      kind: 'select',
      defaultValue: 'clear',
      options: [
        { value: 'clear', label: 'Clear and in range' },
        { value: 'out_of_range', label: 'Beyond 30 feet' },
        { value: 'blocked_sight', label: 'Sight blocked' },
        { value: 'total_cover', label: 'Total Cover' },
      ],
    },
    {
      id: 'enemy_is_hostile',
      label: 'Enemy is hostile',
      description: 'Switch the creature between enemy and ally relation for Mind Sliver.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'target_is_humanoid',
      label: 'Target is Humanoid',
      description: 'Switch the target between Humanoid and Undead taxonomy for Hold Person.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'ally_is_willing',
      label: 'Ally is willing',
      description: 'Switch explicit consent for Guidance and other willing-creature spells.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'object_is_loose',
      label: 'Object is loose',
      description: 'Switch the Practice Lantern between loose and worn-or-carried for Light.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'resolve_target_attempt',
      label: 'Resolve Target Attempt',
      description: 'Validate the complete selection before the stable event, Action, slot, commands, or dice.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay_target_attempt',
      label: 'Replay Stable Attempt',
      description: 'Redeliver the same legal event id; production must make it an atomic no-op.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reset_targeting_board',
      label: 'Reset Targeting Board',
      description: 'Restore exact authored facts, resources, positions, and turn initialization.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applySpellTargetRestrictionControl,
};

// The shared registry imports one default value per scenario. The named export
// exists only so focused tests can assert that both routes use the same module.
export default spellTargetRestrictionsScenarioControlModule;
