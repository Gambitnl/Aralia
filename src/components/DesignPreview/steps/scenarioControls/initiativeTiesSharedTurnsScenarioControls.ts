// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 08:34:21
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic facts for Initiative Ties & Shared Turns.
 *
 * The board contains three combatants on initiative 15, including a summon
 * whose production metadata forms one initiative group with its caster, plus a
 * later initiative-11 guard. A tester can swap Aralia's house tie-break input,
 * apply an Incapacitated member case, or remove the shared member through the
 * live manager. End Turn and Reset then prove group/member ownership boundaries.
 *
 * Called by: the Tactical Sandbox host and scenario-control registry.
 * Depends on: production CombatCharacter initiative, summon, economy, and
 * turn-boundary condition state.
 */

import type { CombatCharacter } from '../../../../types/combat';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Facts
// ============================================================================
// IDs, positions, totals, and tie-break inputs are exported so the host fixture,
// tests, initiative roller, and visible labels cannot drift independently.
// ============================================================================

export const INITIATIVE_TIES_CAPTAIN_ID = 'initiative_ties_shared_turns-captain';
export const INITIATIVE_TIES_SHARED_ECHO_ID = 'initiative_ties_shared_turns-shared-echo';
export const INITIATIVE_TIES_RIVAL_ID = 'initiative_ties_shared_turns-rival';
export const INITIATIVE_TIES_LATE_GUARD_ID = 'initiative_ties_shared_turns-late-guard';

export const INITIATIVE_TIES_CAPTAIN_START = { x: 5, y: 5 };
export const INITIATIVE_TIES_SHARED_ECHO_START = { x: 7, y: 5 };
export const INITIATIVE_TIES_RIVAL_START = { x: 10, y: 5 };
export const INITIATIVE_TIES_LATE_GUARD_START = { x: 12, y: 7 };

export const INITIATIVE_TIES_TIED_TOTAL = 15;
export const INITIATIVE_TIES_LATE_TOTAL = 11;
export const INITIATIVE_TIES_CAPTAIN_DEXTERITY = 16;
export const INITIATIVE_TIES_BASELINE_RIVAL_DEXTERITY = 14;
export const INITIATIVE_TIES_ALTERNATE_RIVAL_DEXTERITY = 18;
export const INITIATIVE_TIES_SPENT_MOVEMENT_FEET = 15;
export const INITIATIVE_TIES_TURN_MARKER = 'Own-Turn Marker';

const TIE_BREAK_INPUT_CONTROL_ID = 'tie-break-input';
const SHARED_MEMBER_CASE_CONTROL_ID = 'shared-member-case';
const APPLY_MEMBER_CASE_CONTROL_ID = 'apply-member-case';
const REMOVE_SHARED_MEMBER_CONTROL_ID = 'remove-shared-member';

export type InitiativeTiesTieBreakInput = 'captain_first' | 'rival_first';
export type InitiativeTiesSharedMemberCase = 'ready' | 'incapacitated';

// ============================================================================
// Live Initiative And Turn-Boundary Preparation
// ============================================================================
// Each combatant begins with spent Action, Reaction, and movement plus an
// own-turn marker. When End Turn moves to the next actor, useTurnManager resets
// only that new actor and expires only the actor whose turn just ended.
// ============================================================================

function createSpentTurnState(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      action: { used: true, remaining: 0 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: true, remaining: 0 },
      legendary: { ...character.actionEconomy.legendary },
      movement: {
        used: INITIATIVE_TIES_SPENT_MOVEMENT_FEET,
        // Quick test characters can omit speed even though production actors
        // always carry it. Preserve the existing live movement ceiling in that
        // narrow fixture case instead of publishing an undefined resource.
        total: character.stats.speed ?? character.actionEconomy.movement.total,
      },
      freeActions: 0,
    },
    conditions: [
      ...(character.conditions ?? []).filter(condition => (
        condition.name !== INITIATIVE_TIES_TURN_MARKER
      )),
      {
        name: INITIATIVE_TIES_TURN_MARKER,
        duration: { type: 'until_end_of_current_turn' },
        appliedTurn: 1,
        turnEndEventsRemaining: 1,
        source: 'Initiative Ties & Shared Turns proof',
      },
    ],
  };
}

function prepareCaptain(character: CombatCharacter): CombatCharacter {
  return createSpentTurnState({
    ...character,
    name: 'Tie Captain · Init 15 · DEX 16 · shared-group lead',
    position: { ...INITIATIVE_TIES_CAPTAIN_START },
    team: 'player',
    initiative: INITIATIVE_TIES_TIED_TOTAL,
    stats: {
      ...character.stats,
      dexterity: INITIATIVE_TIES_CAPTAIN_DEXTERITY,
      baseInitiative: 0,
    },
    abilities: [],
  });
}

function prepareSharedEcho(character: CombatCharacter): CombatCharacter {
  return createSpentTurnState({
    ...character,
    name: 'Shared Echo · Init 15 · immediately after Tie Captain',
    position: { ...INITIATIVE_TIES_SHARED_ECHO_START },
    team: 'player',
    initiative: INITIATIVE_TIES_TIED_TOTAL,
    stats: {
      ...character.stats,
      dexterity: 18,
      baseInitiative: 0,
    },
    abilities: [],
    isSummon: true,
    summonMetadata: {
      casterId: INITIATIVE_TIES_CAPTAIN_ID,
      spellId: 'initiative-ties-shared-turn-proof',
      sourceName: 'Initiative Ties & Shared Turns proof',
      initiativePolicy: 'shared',
      commandCost: 'none',
    },
  });
}

function prepareRival(
  character: CombatCharacter,
  tieBreakInput: InitiativeTiesTieBreakInput,
): CombatCharacter {
  const dexterity = tieBreakInput === 'rival_first'
    ? INITIATIVE_TIES_ALTERNATE_RIVAL_DEXTERITY
    : INITIATIVE_TIES_BASELINE_RIVAL_DEXTERITY;

  return createSpentTurnState({
    ...character,
    name: `Agile Rival · Init 15 · DEX ${dexterity}`,
    position: { ...INITIATIVE_TIES_RIVAL_START },
    team: 'enemy',
    initiative: INITIATIVE_TIES_TIED_TOTAL,
    stats: {
      ...character.stats,
      dexterity,
      baseInitiative: 0,
    },
    abilities: [],
  });
}

function prepareLateGuard(character: CombatCharacter): CombatCharacter {
  return createSpentTurnState({
    ...character,
    name: 'Late Guard · Init 11 · DEX 12',
    position: { ...INITIATIVE_TIES_LATE_GUARD_START },
    team: 'enemy',
    initiative: INITIATIVE_TIES_LATE_TOTAL,
    stats: {
      ...character.stats,
      dexterity: 12,
      baseInitiative: 0,
    },
    abilities: [],
  });
}

export function prepareInitiativeTiesSharedTurnsCharacters(
  characters: CombatCharacter[],
  tieBreakInput: InitiativeTiesTieBreakInput = 'captain_first',
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === INITIATIVE_TIES_CAPTAIN_ID) {
      return prepareCaptain(character);
    }
    if (character.id === INITIATIVE_TIES_SHARED_ECHO_ID) {
      return prepareSharedEcho(character);
    }
    if (character.id === INITIATIVE_TIES_RIVAL_ID) {
      return prepareRival(character, tieBreakInput);
    }
    if (character.id === INITIATIVE_TIES_LATE_GUARD_ID) {
      return prepareLateGuard(character);
    }
    return character;
  });
}

export function getInitiativeTiesSharedTurnsTotal(
  character: CombatCharacter,
): number {
  return character.id === INITIATIVE_TIES_LATE_GUARD_ID
    ? INITIATIVE_TIES_LATE_TOTAL
    : INITIATIVE_TIES_TIED_TOTAL;
}

// ============================================================================
// Player-Facing Controls
// ============================================================================
// The native toolbar already owns End Turn and Reset Board. These two controls
// change the tie input and document the exact supported shared-turn boundary.
// ============================================================================

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: TIE_BREAK_INPUT_CONTROL_ID,
    label: 'Aralia House Tie-Break',
    description: 'Swap the tied rival between DEX 14 and DEX 18 under Aralia’s deterministic house policy; this is not a canonical 5e tie ladder.',
    kind: 'select',
    defaultValue: 'captain_first',
    options: [
      { value: 'captain_first', label: 'Captain DEX 16 before Rival DEX 14' },
      { value: 'rival_first', label: 'Rival DEX 18 before Captain DEX 16' },
    ],
  },
  {
    id: SHARED_MEMBER_CASE_CONTROL_ID,
    label: 'Shared Member Case',
    description: 'Choose whether Shared Echo starts its member phase ready or Incapacitated; it keeps a timing boundary in both cases.',
    kind: 'select',
    defaultValue: 'ready',
    options: [
      { value: 'ready', label: 'Ready member' },
      { value: 'incapacitated', label: 'Incapacitated member' },
    ],
  },
  {
    id: APPLY_MEMBER_CASE_CONTROL_ID,
    label: 'Apply Member Case',
    description: 'Apply the selected state to Shared Echo without rebuilding initiative or touching another member’s economy.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: REMOVE_SHARED_MEMBER_CONTROL_ID,
    label: 'Remove Shared Member',
    description: 'Remove Shared Echo through the production turn manager; if active, the completed group advances exactly once.',
    kind: 'action',
    defaultValue: false,
  },
];

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === TIE_BREAK_INPUT_CONTROL_ID) {
    const tieBreakInput: InitiativeTiesTieBreakInput = application.value === 'rival_first'
      ? 'rival_first'
      : 'captain_first';
    const characters = prepareInitiativeTiesSharedTurnsCharacters(
      application.snapshot.characters,
      tieBreakInput,
    );
    const rivalDexterity = tieBreakInput === 'rival_first'
      ? INITIATIVE_TIES_ALTERNATE_RIVAL_DEXTERITY
      : INITIATIVE_TIES_BASELINE_RIVAL_DEXTERITY;

    return {
      characters,
      reinitializeCombat: true,
      logMessage: tieBreakInput === 'rival_first'
        ? `TIE ORDER REBUILT: Agile Rival DEX ${rivalDexterity} precedes Tie Captain DEX ${INITIATIVE_TIES_CAPTAIN_DEXTERITY}; Shared Echo remains immediately after its caster; Late Guard stays on 11.`
        : `TIE ORDER REBUILT: Tie Captain DEX ${INITIATIVE_TIES_CAPTAIN_DEXTERITY} precedes Agile Rival DEX ${rivalDexterity}; Shared Echo remains immediately after its caster; Late Guard stays on 11.`,
    };
  }

  if (application.controlId === SHARED_MEMBER_CASE_CONTROL_ID) {
    // The selector itself records only player intent. Apply Member Case owns
    // the explicit transaction so a tester can compare before and after.
    return {
      logMessage: `Shared member case selected: ${application.value}. Use Apply Member Case to change live combat state.`,
    };
  }

  if (application.controlId === APPLY_MEMBER_CASE_CONTROL_ID) {
    const selectedCase: InitiativeTiesSharedMemberCase = application.snapshot.controlValues?.[SHARED_MEMBER_CASE_CONTROL_ID] === 'incapacitated'
      ? 'incapacitated'
      : 'ready';
    const characters = application.snapshot.characters.map(character => {
      if (character.id !== INITIATIVE_TIES_SHARED_ECHO_ID) return character;
      const remainingConditions = (character.conditions ?? []).filter(condition => (
        condition.name !== 'Incapacitated'
      ));
      return {
        ...character,
        conditions: selectedCase === 'incapacitated'
          ? [
              ...remainingConditions,
              {
                name: 'Incapacitated',
                duration: { type: 'permanent' as const },
                source: 'Initiative Ties & Shared Turns member case',
              },
            ]
          : remainingConditions,
      };
    });
    return {
      characters,
      logMessage: selectedCase === 'incapacitated'
        ? 'GROUP MEMBER CASE: Shared Echo is Incapacitated. It keeps its own start/end effect boundary, but cannot spend Action or Reaction; no other member resource changed.'
        : 'GROUP MEMBER CASE: Shared Echo is ready. Its Action, movement, Reaction, and effects remain independently owned.',
    };
  }

  if (application.controlId === REMOVE_SHARED_MEMBER_CONTROL_ID) {
    return {
      removeCharacterFromCombatId: INITIATIVE_TIES_SHARED_ECHO_ID,
      logMessage: 'GROUP MEMBER REMOVAL REQUESTED: production turn state will remove Shared Echo and continue from the next eligible member without reinitializing combat.',
    };
  }

  return {
    logMessage: `Initiative Ties control ignored unknown control "${application.controlId}".`,
  };
}

const initiativeTiesSharedTurnsScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'initiative_ties_shared_turns',
  controls,
  applyControl,
};

export default initiativeTiesSharedTurnsScenarioControls;
