// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 03:30:52
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the four deterministic controls for Shove & Knock Prone.
 *
 * Three action buttons resolve a successful save, a failed-save push, or a
 * failed-save Prone choice through the shared shove utility. One setup selector
 * chooses Strength or Dexterity and authors the blocked or too-large edge cases.
 * Every action receives the host's live turn and finite action ledger, so the
 * returned combatants are the same state rendered by both sandbox views.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the canonical shove resolver and the production initial context.
 */

import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
} from '../../../../types/combat';
import { initialGameState } from '../../../../state/initialState';
import { resolveShoveAttempt } from '../../../../utils/combat/shoveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Board Facts
// ============================================================================
// The target begins adjacent to the shover on a horizontal sand lane. The next
// square is the exact five-foot push destination; the host also places a hazard
// beyond it and a permanent wall beside it so 2D and 3D keep the test readable.
// ============================================================================

export const SHOVE_PRONE_SHOVER_ID = 'shove_prone-tester';
export const SHOVE_PRONE_TARGET_ID = 'shove_prone-target';
export const SHOVE_PRONE_SHOVER_START = { x: 6, y: 5 } as const;
export const SHOVE_PRONE_TARGET_START = { x: 7, y: 5 } as const;
export const SHOVE_PRONE_DESTINATION = { x: 8, y: 5 } as const;
export const SHOVE_PRONE_DESTINATION_TILE_ID = '8-5';

const SUCCESSFUL_SAVE_RNG = (): number => 0.89;
const FAILED_SAVE_RNG = (): number => 0.01;

type ShoveSetup = 'open_strength' | 'open_dexterity' | 'blocked_destination' | 'too_large';

// ============================================================================
// Repeatable Scenario Setup
// ============================================================================
// Setup choices restore authored positions, size, and terrain without touching
// active conditions or action resources. Only Reset Board or canonical combat
// actions such as Stand Up may clear Prone or refresh the finite attack budget.
// ============================================================================

function prepareCharacters(
  characters: CombatCharacter[],
  targetSize: CombatCharacter['stats']['size'] = 'Medium',
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === SHOVE_PRONE_SHOVER_ID) {
      return {
        ...character,
        position: { ...SHOVE_PRONE_SHOVER_START },
        stats: { ...character.stats, strength: 16, size: 'Medium' },
      };
    }

    if (character.id === SHOVE_PRONE_TARGET_ID) {
      return {
        ...character,
        name: `Shove Target (${targetSize ?? 'Medium'})`,
        position: { ...SHOVE_PRONE_TARGET_START },
        stats: {
          ...character.stats,
          // Unequal scores make the defender's selected modifier visible in
          // the deterministic save total without changing the save engine.
          strength: 14,
          dexterity: 8,
          size: targetSize,
        },
      };
    }

    return character;
  });
}

function setDestinationBlocked(
  mapData: BattleMapData,
  blocked: boolean,
): BattleMapData {
  const destination = mapData.tiles.get(SHOVE_PRONE_DESTINATION_TILE_ID);

  if (!destination) {
    return mapData;
  }

  const tiles = new Map<string, BattleMapTile>(mapData.tiles);
  tiles.set(SHOVE_PRONE_DESTINATION_TILE_ID, {
    ...destination,
    terrain: blocked ? 'wall' : 'sand',
    movementCost: 5,
    blocksLoS: blocked,
    blocksMovement: blocked,
    decoration: null,
  });

  return { ...mapData, tiles };
}

function prepareSnapshot(
  snapshot: PreviewCombatScenarioControlSnapshot,
  setup: ShoveSetup,
): { mapData: BattleMapData | null; characters: CombatCharacter[] } {
  return {
    mapData: snapshot.mapData
      ? setDestinationBlocked(snapshot.mapData, setup === 'blocked_destination')
      : null,
    characters: prepareCharacters(
      snapshot.characters,
      setup === 'too_large' ? 'Huge' : 'Medium',
    ),
  };
}

export function getShoveProneInitiativeTotal(character: CombatCharacter): number {
  // The sandbox always opens on the shover's turn. Fixed legal totals remove
  // random initiative without bypassing the production sorter or turn manager.
  return character.id === SHOVE_PRONE_SHOVER_ID ? 18 : 12;
}

// ============================================================================
// Combat-State Bridge
// ============================================================================
// MovementCommand consumes the normal CombatState envelope. The sandbox adds
// only the current board facts it already owns; the production initial context
// satisfies command metadata that physical push does not otherwise inspect.
// ============================================================================

function createCombatState(
  application: PreviewCombatScenarioControlApplication,
  mapData: BattleMapData,
  characters: CombatCharacter[],
): CombatState {
  return {
    isActive: true,
    characters,
    turnState: application.snapshot.turnState ?? {
      currentTurn: 0,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: null,
      phase: 'action',
      actionsThisTurn: [],
    },
    selectedCharacterId: SHOVE_PRONE_SHOVER_ID,
    selectedAbilityId: 'unarmed-strike-shove',
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: application.snapshot.reactiveTriggers,
    activeLightSources: application.snapshot.activeLightSources,
    mapData,
  };
}

function readSelectedSetup(
  application: PreviewCombatScenarioControlApplication,
): ShoveSetup {
  const selected = application.snapshot.controlValues?.['edge-case'];
  return selected === 'open_dexterity'
    || selected === 'blocked_destination'
    || selected === 'too_large'
    ? selected
    : 'open_strength';
}

function resolveCurrentShove(
  application: PreviewCombatScenarioControlApplication,
  choice: 'push' | 'prone',
  rng: () => number,
): PreviewCombatScenarioControlPatch {
  const setup = readSelectedSetup(application);

  if (!application.snapshot.mapData) {
    return {
      logMessage: 'Shove control stopped because the authored battle map is unavailable.',
    };
  }

  const result = resolveShoveAttempt({
    state: createCombatState(
      application,
      application.snapshot.mapData,
      application.snapshot.characters,
    ),
    gameState: initialGameState,
    shoverId: SHOVE_PRONE_SHOVER_ID,
    targetId: SHOVE_PRONE_TARGET_ID,
    choice,
    saveAbility: setup === 'open_dexterity' ? 'Dexterity' : 'Strength',
    rng,
  });

  return {
    characters: result.state.characters,
    logMessage: result.message,
  };
}

// ============================================================================
// Control Resolution
// ============================================================================
// Action defaults are false and therefore inert during Reset Board. The select
// default restores the clear Medium-target baseline; its other values resolve
// the requested validation case immediately and log the exact rejection reason.
// ============================================================================

function applyShoveProneControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === 'edge-case') {
    if (
      application.value !== 'open_strength'
      && application.value !== 'open_dexterity'
      && application.value !== 'blocked_destination'
      && application.value !== 'too_large'
    ) {
      return { logMessage: 'Shove setup requires Strength, Dexterity, blocked destination, or too large.' };
    }

    const edgeCase = application.value;
    const prepared = prepareSnapshot(application.snapshot, edgeCase);
    const saveChoice = edgeCase === 'open_dexterity' ? 'Dexterity' : 'Strength';
    const edgeSummary = edgeCase === 'blocked_destination'
      ? 'blocked five-foot destination'
      : edgeCase === 'too_large'
        ? 'Huge ineligible target'
        : 'Medium target and clear five-foot destination';
    return {
      ...(prepared.mapData ? { mapData: prepared.mapData } : {}),
      characters: prepared.characters,
      logMessage: `Shove setup ready: ${saveChoice} defense, ${edgeSummary}. No attack spent.`,
    };
  }

  // False is the shared action button's reset value. Any other non-true value
  // is malformed and remains a visible, state-preserving no-op.
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Shove control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'save-succeeds') {
    return resolveCurrentShove(application, 'push', SUCCESSFUL_SAVE_RNG);
  }
  if (application.controlId === 'push-away') {
    return resolveCurrentShove(application, 'push', FAILED_SAVE_RNG);
  }
  if (application.controlId === 'knock-prone') {
    return resolveCurrentShove(application, 'prone', FAILED_SAVE_RNG);
  }

  return { logMessage: `Unknown Shove & Knock Prone control: ${application.controlId}.` };
}

// ============================================================================
// Registry Module
// ============================================================================
// Four controls cover both defender abilities, both save outcomes, both shove
// choices, size eligibility, and blocked movement within the compact budget.
// ============================================================================

const shoveProneScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'shove_prone',
  controls: [
    {
      id: 'save-succeeds',
      label: 'Target Saves',
      description: 'Spend one Attack-action attack and roll a fixed 18 through the selected save path.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'push-away',
      label: 'Fail Save: Push Away',
      description: 'Spend one attack, roll a fixed 1, then push through canonical collision checks.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'knock-prone',
      label: 'Fail Save: Knock Prone',
      description: 'Spend one attack, roll a fixed 1, and apply Prone until Stand Up removes it.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'edge-case',
      label: 'Defense / Edge Case',
      description: 'Choose Strength or Dexterity, or prepare blocked and too-large rejection boards.',
      kind: 'select',
      defaultValue: 'open_strength',
      options: [
        { value: 'open_strength', label: 'Strength / Open lane' },
        { value: 'open_dexterity', label: 'Dexterity / Open lane' },
        { value: 'blocked_destination', label: 'Strength / Blocked destination' },
        { value: 'too_large', label: 'Strength / Huge target' },
      ],
    },
  ],
  applyControl: applyShoveProneControl,
};

export default shoveProneScenarioControls;
