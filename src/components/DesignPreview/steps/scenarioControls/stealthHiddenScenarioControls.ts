/**
 * This file owns the deterministic Stealth & Hidden Tactical Sandbox controls.
 *
 * Testers choose real cover/light/sense facts, a live Perception profile, and
 * one Hide lifecycle step. Resolve and Replay send those facts through the
 * production stealth or attack path; the adapter stores no private detection
 * answer. Reset Board reapplies the same pure defaults used on first mount.
 *
 * Called by: the Tactical Sandbox scenario-control registry and host fixture.
 * Depends on: production stealth, action-economy, map, and combat types.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  StatusEffect,
} from '../../../../types/combat';
import { resolveHideAttempt, resolveHiddenMovement, resolveStealthObservation } from '../../../../systems/perception/stealthResolution';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Facts
// ============================================================================
// These ids and positions match the authored board. The target starts in the
// right bush; covered movement crosses to the left bush, while exposed movement
// steps into the bright center lane.
// ============================================================================

export const STEALTH_HIDDEN_OBSERVER_ID = 'stealth_hidden-tester';
export const STEALTH_HIDDEN_TARGET_ID = 'stealth_hidden-target';
export const STEALTH_HIDDEN_OWNER_ID = 'stealth-hidden-scenario';
export const STEALTH_HIDDEN_STATUS_ID = 'stealth-hidden-owned';

export const STEALTH_HIDDEN_OBSERVER_START = { x: 3, y: 5 } as const;
export const STEALTH_HIDDEN_TARGET_START = { x: 10, y: 5 } as const;
export const STEALTH_HIDDEN_COVERED_DESTINATION = { x: 5, y: 5 } as const;
export const STEALTH_HIDDEN_OPEN_DESTINATION = { x: 8, y: 5 } as const;

const FIXED_HIDE_RNG = (): number => 0.37; // d20 8; DEX 16 + proficiency = DC 14.
const FIXED_ATTACK_RNG = (): number => 0.575; // d20 12 on both Advantage dice.
const FIXED_DAMAGE_RNG = (): number => 0.5;
const ACTIVE_FAIL_SEED = 1;
const ACTIVE_SUCCESS_SEED = 42;

type EnvironmentCase = 'cover_bright' | 'open_bright' | 'open_dark' | 'open_dark_darkvision';
type PerceptionCase = 'passive_low' | 'passive_high' | 'active_fail' | 'active_success';
type StealthStep = 'apply_hide' | 'observe' | 'move_covered' | 'move_open' | 'attack';

const STEALTH_ATTACK: Ability = {
  id: 'stealth-hidden-shortbow',
  name: 'Hidden Shortbow',
  description: 'A deterministic attack that proves unseen-attacker Advantage and post-roll reveal timing.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 12,
  attackBonus: 5,
  isProficient: true,
  effects: [{ type: 'damage', value: 3, damageType: 'piercing' }],
};

// ============================================================================
// Exact Reset And Setup Preparation
// ============================================================================
// Preparation touches only scenario-owned statuses/events plus the declared
// stats, senses, positions, terrain, and economy. Other Hidden sources survive.
// ============================================================================

function isScenarioHidden(status: StatusEffect): boolean {
  return status.id === STEALTH_HIDDEN_STATUS_ID
    && status.stealth?.ownerId === STEALTH_HIDDEN_OWNER_ID;
}

function clearScenarioState(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    statusEffects: character.statusEffects.filter(status => !isScenarioHidden(status)),
    stealthEventIds: character.stealthEventIds?.filter(eventId => !eventId.startsWith('cs11-')),
  };
}

function setPerceptionProficiency(
  character: CombatCharacter,
  proficient: boolean,
): CombatCharacter {
  const existing = character.modifiers?.skillProficiencies ?? [];
  const withoutPerception = existing.filter(skill => skill.toLowerCase() !== 'perception');
  return {
    ...character,
    modifiers: {
      advantage: [], disadvantage: [], bonuses: [],
      ...character.modifiers,
      skillProficiencies: proficient ? [...withoutPerception, 'perception'] : withoutPerception,
    },
  };
}

export function prepareStealthHiddenCharacters(
  characters: CombatCharacter[],
  perceptionCase: PerceptionCase = 'passive_low',
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === STEALTH_HIDDEN_OBSERVER_ID) {
      const wisdom = perceptionCase === 'passive_high' ? 18 : 12;
      const observer = setPerceptionProficiency(clearScenarioState(character), false);
      return resetEconomy({
        ...observer,
        name: `Observer · WIS ${wisdom} · passive Perception ${wisdom === 18 ? 14 : 11}`,
        level: 5,
        team: 'player',
        position: { ...STEALTH_HIDDEN_OBSERVER_START },
        stats: {
          ...observer.stats,
          wisdom,
          senses: {
            ...(observer.stats.senses ?? { blindsight: 0, tremorsense: 0, truesight: 0 }),
            darkvision: 0,
          },
        },
      });
    }

    if (character.id === STEALTH_HIDDEN_TARGET_ID) {
      const target = setPerceptionProficiency(clearScenarioState(character), false);
      const existingSkills = target.modifiers?.skillProficiencies ?? [];
      return resetEconomy({
        ...target,
        name: 'Stealth Target · DEX 16 · Stealth +6',
        level: 5,
        team: 'enemy',
        position: { ...STEALTH_HIDDEN_TARGET_START },
        stats: { ...target.stats, dexterity: 16, speed: 30 },
        modifiers: {
          advantage: [], disadvantage: [], bonuses: [],
          ...target.modifiers,
          skillProficiencies: Array.from(new Set([...existingSkills, 'stealth'])),
        },
      });
    }

    return character;
  });
}

function setTileCover(
  mapData: BattleMapData,
  tileId: string,
  providesCover: boolean,
): BattleMapData {
  const tile = mapData.tiles.get(tileId);
  if (!tile) return mapData;
  const tiles = new Map<string, BattleMapTile>(mapData.tiles);
  tiles.set(tileId, {
    ...tile,
    terrain: 'grass',
    providesCover,
    blocksLoS: false,
    blocksMovement: false,
  });
  return { ...mapData, tiles };
}

export function prepareStealthHiddenMap(
  mapData: BattleMapData,
  environmentCase: EnvironmentCase = 'cover_bright',
): BattleMapData {
  const withTargetCover = setTileCover(
    mapData,
    `${STEALTH_HIDDEN_TARGET_START.x}-${STEALTH_HIDDEN_TARGET_START.y}`,
    environmentCase === 'cover_bright',
  );
  return {
    ...withTargetCover,
    theme: environmentCase === 'open_dark' || environmentCase === 'open_dark_darkvision'
      ? 'dungeon'
      : 'forest',
  };
}

export function getStealthHiddenInitiativeTotal(character: CombatCharacter): number {
  // The stealth target owns the first turn so Hide, movement, and attack use
  // the mounted production Action ledger without a private preview turn.
  return character.id === STEALTH_HIDDEN_TARGET_ID ? 18 : 12;
}

// ============================================================================
// Control Selection And Canonical Precondition Setup
// ============================================================================
// Selecting an operation prepares its legitimate starting state. Observe,
// movement, and attack begin after a prior successful Hide and with a fresh
// turn economy; their result still comes exclusively from production paths.
// ============================================================================

function readEnvironment(application: PreviewCombatScenarioControlApplication): EnvironmentCase {
  const value = application.snapshot.controlValues?.['environment-case'];
  return value === 'open_bright' || value === 'open_dark' || value === 'open_dark_darkvision'
    ? value
    : 'cover_bright';
}

function readPerception(application: PreviewCombatScenarioControlApplication): PerceptionCase {
  const value = application.snapshot.controlValues?.['perception-case'];
  return value === 'passive_high' || value === 'active_fail' || value === 'active_success'
    ? value
    : 'passive_low';
}

function readStep(application: PreviewCombatScenarioControlApplication): StealthStep {
  const value = application.snapshot.controlValues?.['stealth-step'];
  return value === 'observe' || value === 'move_covered' || value === 'move_open' || value === 'attack'
    ? value
    : 'apply_hide';
}

function findActor(characters: CombatCharacter[], id: string): CombatCharacter | undefined {
  return characters.find(character => character.id === id);
}

function addCanonicalHiddenPrecondition(
  snapshot: PreviewCombatScenarioControlSnapshot,
  characters: CombatCharacter[],
  mapData: BattleMapData,
  step: StealthStep,
): CombatCharacter[] {
  if (step === 'apply_hide') return characters;
  const observer = findActor(characters, STEALTH_HIDDEN_OBSERVER_ID);
  const target = findActor(characters, STEALTH_HIDDEN_TARGET_ID);
  if (!observer || !target) return characters;

  // A hidden precondition always starts from authored cover. Environment is
  // applied after Hide, so open/light controls can then prove reveal boundaries.
  const setupMap = prepareStealthHiddenMap(mapData, 'cover_bright');
  const hidden = resolveHideAttempt({
    hider: target,
    observer,
    characters,
    mapData: setupMap,
    activeLightSources: snapshot.activeLightSources,
    ownerId: STEALTH_HIDDEN_OWNER_ID,
    statusId: STEALTH_HIDDEN_STATUS_ID,
    eventId: `cs11-setup-${step}`,
    rng: FIXED_HIDE_RNG,
  }).character;
  const freshTurnHidden = resetEconomy(hidden);
  return characters.map(character => character.id === target.id ? freshTurnHidden : character);
}

function prepareSelectedState(
  application: PreviewCombatScenarioControlApplication,
  environmentCase: EnvironmentCase,
  perceptionCase: PerceptionCase,
  step: StealthStep,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Stealth setup stopped because the authored battle map is unavailable.' };
  }
  const baseCharacters = prepareStealthHiddenCharacters(
    application.snapshot.characters,
    perceptionCase,
  );
  const mapData = prepareStealthHiddenMap(application.snapshot.mapData, environmentCase);
  let characters = addCanonicalHiddenPrecondition(
    application.snapshot,
    baseCharacters,
    mapData,
    step,
  );

  // Darkvision is an actual observer sense, not a visibility label. All other
  // environment choices deliberately restore zero range.
  characters = characters.map(character => character.id === STEALTH_HIDDEN_OBSERVER_ID
    ? {
      ...character,
      stats: {
        ...character.stats,
        senses: {
          ...(character.stats.senses ?? { blindsight: 0, tremorsense: 0, truesight: 0 }),
          darkvision: environmentCase === 'open_dark_darkvision' ? 60 : 0,
        },
      },
    }
    : character);

  return {
    mapData,
    characters,
    logMessage: `STEALTH SETUP: ${environmentCase}; ${perceptionCase}; next ${step}. Exact scenario state restored.`,
  };
}

// ============================================================================
// Resolve And Replay
// ============================================================================
// Stable ids are derived only from the selected facts. Repeating Resolve or
// pressing Replay therefore re-delivers the same event atomically.
// ============================================================================

function resolveSelectedStep(
  application: PreviewCombatScenarioControlApplication,
  replay: boolean,
): PreviewCombatScenarioControlPatch {
  const environmentCase = readEnvironment(application);
  const perceptionCase = readPerception(application);
  const step = readStep(application);
  const observer = findActor(application.snapshot.characters, STEALTH_HIDDEN_OBSERVER_ID);
  const target = findActor(application.snapshot.characters, STEALTH_HIDDEN_TARGET_ID);
  const mapData = application.snapshot.mapData;
  if (!observer || !target || !mapData) {
    return { logMessage: 'Stealth resolution stopped because the authored actors or map are unavailable.' };
  }

  const eventId = `cs11-${step}-${environmentCase}-${perceptionCase}-001`;
  if (step === 'attack') {
    return {
      abilityExecution: {
        ability: STEALTH_ATTACK,
        casterId: target.id,
        targetId: observer.id,
        attackRollRng: FIXED_ATTACK_RNG,
        damageRng: FIXED_DAMAGE_RNG,
        executionEventId: eventId,
      },
      logMessage: `${replay ? 'STEALTH REPLAY' : 'STEALTH ATTACK'} REQUESTED: ${eventId}; production attack owns Advantage, Action, and post-roll reveal.`,
    };
  }

  const context = {
    mapData,
    characters: application.snapshot.characters,
    activeLightSources: application.snapshot.activeLightSources,
    observer,
  };
  const result = step === 'apply_hide'
    ? resolveHideAttempt({
      ...context,
      hider: target,
      ownerId: STEALTH_HIDDEN_OWNER_ID,
      statusId: STEALTH_HIDDEN_STATUS_ID,
      eventId,
      rng: FIXED_HIDE_RNG,
    })
    : step === 'observe'
      ? resolveStealthObservation({
        hidden: target,
        observer,
        ownerId: STEALTH_HIDDEN_OWNER_ID,
        eventId,
        mode: perceptionCase.startsWith('active') ? 'active' : 'passive',
        rng: perceptionCase === 'active_fail'
          ? new SeededRandom(ACTIVE_FAIL_SEED)
          : perceptionCase === 'active_success'
            ? new SeededRandom(ACTIVE_SUCCESS_SEED)
            : undefined,
      })
      : resolveHiddenMovement({
        ...context,
        hidden: target,
        ownerId: STEALTH_HIDDEN_OWNER_ID,
        destination: step === 'move_covered'
          ? STEALTH_HIDDEN_COVERED_DESTINATION
          : STEALTH_HIDDEN_OPEN_DESTINATION,
        eventId,
      });

  return {
    characters: application.snapshot.characters.map(character => (
      character.id === target.id ? result.character : character
    )),
    logMessage: `${replay ? 'STEALTH REPLAY' : 'STEALTH RESOLVE'} ${result.outcome.toUpperCase()}: ${result.reason}`,
  };
}

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === 'environment-case') {
    if (
      application.value !== 'cover_bright'
      && application.value !== 'open_bright'
      && application.value !== 'open_dark'
      && application.value !== 'open_dark_darkvision'
    ) {
      return { logMessage: 'Stealth environment requires a supported cover, light, and sense case.' };
    }
    return prepareSelectedState(
      application,
      application.value,
      readPerception(application),
      readStep(application),
    );
  }

  if (application.controlId === 'perception-case') {
    if (
      application.value !== 'passive_low'
      && application.value !== 'passive_high'
      && application.value !== 'active_fail'
      && application.value !== 'active_success'
    ) {
      return { logMessage: 'Stealth observer requires a supported passive or active Perception case.' };
    }
    return prepareSelectedState(
      application,
      readEnvironment(application),
      application.value,
      readStep(application),
    );
  }

  if (application.controlId === 'stealth-step') {
    if (
      application.value !== 'apply_hide'
      && application.value !== 'observe'
      && application.value !== 'move_covered'
      && application.value !== 'move_open'
      && application.value !== 'attack'
    ) {
      return { logMessage: 'Stealth step requires Hide, observe, movement, or attack.' };
    }
    return prepareSelectedState(
      application,
      readEnvironment(application),
      readPerception(application),
      application.value,
    );
  }

  if (application.controlId === 'resolve-step' || application.controlId === 'replay-step') {
    if (application.value === false) return { logMessage: '' };
    if (application.value !== true) {
      return { logMessage: `${application.controlId} requires an action trigger.` };
    }
    return resolveSelectedStep(application, application.controlId === 'replay-step');
  }

  return { logMessage: `Unknown Stealth & Hidden control: ${application.controlId}.` };
}

// ============================================================================
// Registry Module
// ============================================================================
// Three selectors expose controlled facts and lifecycle boundaries. Two action
// buttons prove deterministic first delivery and stable replay; the shared Reset
// Board remains the single exact-reset control.
// ============================================================================

const stealthHiddenScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'stealth_hidden',
  controls: [
    {
      id: 'environment-case',
      label: 'Cover / Light / Sense',
      description: 'Choose real target-tile cover, ambient theme, and observer Darkvision facts.',
      kind: 'select',
      defaultValue: 'cover_bright',
      options: [
        { value: 'cover_bright', label: 'Bush cover · Bright · No Darkvision' },
        { value: 'open_bright', label: 'Open · Bright · No Darkvision' },
        { value: 'open_dark', label: 'Open · Dark · No Darkvision' },
        { value: 'open_dark_darkvision', label: 'Open · Dark · Darkvision 60 ft' },
      ],
    },
    {
      id: 'perception-case',
      label: 'Observer Perception',
      description: 'Set live Wisdom for passive Perception or use a seeded active search.',
      kind: 'select',
      defaultValue: 'passive_low',
      options: [
        { value: 'passive_low', label: 'Passive 11 · Miss DC 14' },
        { value: 'passive_high', label: 'Passive 14 · Detect DC 14' },
        { value: 'active_fail', label: 'Active search · Seeded fail' },
        { value: 'active_success', label: 'Active search · Seeded success' },
      ],
    },
    {
      id: 'stealth-step',
      label: 'Hidden Lifecycle Step',
      description: 'Prepare Hide, observation, covered/exposed movement, or attack-reveal proof.',
      kind: 'select',
      defaultValue: 'apply_hide',
      options: [
        { value: 'apply_hide', label: 'Apply Hide' },
        { value: 'observe', label: 'Observer checks Hidden' },
        { value: 'move_covered', label: 'Move to covered bush' },
        { value: 'move_open', label: 'Move into open lane' },
        { value: 'attack', label: 'Attack then reveal' },
      ],
    },
    {
      id: 'resolve-step',
      label: 'Resolve Step',
      description: 'Resolve the selected transaction through production mechanics.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay-step',
      label: 'Replay Same Event',
      description: 'Re-deliver the same stable event id; state and resources must remain atomic.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl,
};

export default stealthHiddenScenarioControls;
