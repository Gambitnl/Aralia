/**
 * This file owns the interactive starting facts for the Opportunity Attacks sandbox.
 *
 * Testers can make the guard's reaction ready or spent, give the fighter Disengage
 * protection, and place the fighter inside or outside threatened reach. Each switch
 * updates the same CombatCharacter records consumed by the production movement and
 * reaction systems, so the sandbox demonstrates real rules instead of a parallel mock.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: PreviewCombatScenarioControlTypes and production combat-character state.
 */

import type { CombatCharacter, StatusEffect } from '../../../../types/combat';
import { OpportunityAttackSystem } from '../../../../systems/combat/reactions/OpportunityAttackSystem';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Facts
// ============================================================================
// The reaction board already gives its two actors stable ids. These constants
// keep every control aimed at those authored actors and make the two reach
// positions readable without changing unrelated combatants in the snapshot.
// ============================================================================

const PLAYER_FIGHTER_ID = 'player-fighter';
const ORC_GUARD_ID = 'orc-guard';
const SECOND_ORC_GUARD_ID = 'orc-guard-second';
const SANDBOX_DISENGAGE_SOURCE = 'Tactical Sandbox reaction control';
const OPPORTUNITY_MOVEMENT_EVENT_ID = 'reaction-opportunity-move-1';

const INSIDE_THREATENED_REACH_POSITION = { x: 3, y: 5 } as const;
const OUTSIDE_THREATENED_REACH_POSITION = { x: 2, y: 5 } as const;
const MOVEMENT_DESTINATION = { x: 2, y: 5 } as const;
const SECOND_GUARD_POSITION = { x: 4, y: 6 } as const;

// The moving fighter owns the first turn, followed by each possible responder.
// The detector receives this same visible sequence, so mounted prompts and pure
// ordering tests agree even when the character roster was authored differently.
export function getReactionInitiativeTotal(character: CombatCharacter): number {
  if (character.id === PLAYER_FIGHTER_ID) return 20;
  if (character.id === ORC_GUARD_ID) return 15;
  if (character.id === SECOND_ORC_GUARD_ID) return 10;
  return 5;
}

// The sandbox-owned marker uses the same canonical id and name as the real
// Disengage action because OpportunityAttackSystem reads those production facts.
// Its distinct source lets the Off switch remove only the teaching fixture and
// preserve Disengage granted by an actual player action.
const SANDBOX_DISENGAGE_EFFECT: StatusEffect = {
  id: 'disengage',
  name: 'Disengage',
  type: 'buff',
  description: 'Sandbox starting fact: this fighter does not provoke opportunity attacks this turn.',
  duration: 1,
  source: SANDBOX_DISENGAGE_SOURCE,
  effect: { type: 'condition' },
  icon: 'shield',
};

// ============================================================================
// Pure Character Updates
// ============================================================================
// Each helper returns a new character only for the actor whose controlled fact
// changed. The supplied snapshot and every unrelated character remain untouched,
// which lets React and focused tests compare states without hidden mutation.
// ============================================================================

function setGuardReactionReady(
  character: CombatCharacter,
  ready: boolean,
): CombatCharacter {
  if (character.id !== ORC_GUARD_ID) {
    return character;
  }

  // Ready means the round's one reaction is unspent. The companion remaining
  // count stays aligned so every action-economy display reports the same fact.
  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      reaction: {
        ...character.actionEconomy.reaction,
        used: !ready,
        remaining: ready ? 1 : 0,
      },
    },
  };
}

function setFighterDisengageProtection(
  character: CombatCharacter,
  protectedByDisengage: boolean,
): CombatCharacter {
  if (character.id !== PLAYER_FIGHTER_ID) {
    return character;
  }

  // Enabling the fact avoids duplicate Disengage markers when either this
  // control or the real action has already protected the fighter.
  if (protectedByDisengage) {
    const alreadyProtected = character.statusEffects.some(effect =>
      effect.id === 'disengage' || effect.name === 'Disengage'
    );

    if (alreadyProtected) {
      return character;
    }

    return {
      ...character,
      statusEffects: [...character.statusEffects, SANDBOX_DISENGAGE_EFFECT],
    };
  }

  // Disabling the fact removes only the marker created by this control. A real
  // Disengage action remains authoritative until the normal turn lifecycle ends it.
  const statusEffects = character.statusEffects.filter(effect =>
    !(effect.id === 'disengage' && effect.source === SANDBOX_DISENGAGE_SOURCE)
  );

  if (statusEffects.length === character.statusEffects.length) {
    return character;
  }

  return {
    ...character,
    statusEffects,
  };
}

function setFighterThreatenedPosition(
  character: CombatCharacter,
  startsInsideReach: boolean,
): CombatCharacter {
  if (character.id !== PLAYER_FIGHTER_ID) {
    return character;
  }

  // The guard remains at the scenario's authored {4,5} tile. These two fighter
  // positions therefore mean exactly one tile (inside) or two tiles (outside)
  // away, which isolates the boundary-crossing rule from pathfinding noise.
  const position = startsInsideReach
    ? INSIDE_THREATENED_REACH_POSITION
    : OUTSIDE_THREATENED_REACH_POSITION;

  return {
    ...character,
    position: { ...position },
  };
}

function setEligibilityCase(
  characters: CombatCharacter[],
  eligibilityCase: string,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === PLAYER_FIGHTER_ID) {
      // Hidden is a target-side visibility fact. Remove only this sandbox-owned
      // marker when another eligibility case is selected.
      const withoutSandboxHidden = character.statusEffects.filter(effect => (
        !(effect.id === 'reaction-sandbox-hidden' && effect.source === SANDBOX_DISENGAGE_SOURCE)
      ));
      return {
        ...character,
        position: { ...INSIDE_THREATENED_REACH_POSITION },
        statusEffects: eligibilityCase === 'hidden'
          ? [...withoutSandboxHidden, {
              id: 'reaction-sandbox-hidden',
              name: 'Hidden',
              type: 'buff' as const,
              duration: 1,
              source: SANDBOX_DISENGAGE_SOURCE,
            }]
          : withoutSandboxHidden,
      };
    }

    if (character.id === ORC_GUARD_ID || character.id === SECOND_ORC_GUARD_ID) {
      // Moving the observer away proves the ineligible-reach branch. The
      // incapacitated branch uses the canonical status name read by canTakeReaction.
      const withoutSandboxIncapacitated = character.statusEffects.filter(effect => (
        !(effect.id === 'reaction-sandbox-incapacitated' && effect.source === SANDBOX_DISENGAGE_SOURCE)
      ));
      return {
        ...character,
        position: eligibilityCase === 'outside_reach'
          ? { x: character.id === ORC_GUARD_ID ? 7 : 7, y: character.id === ORC_GUARD_ID ? 5 : 6 }
          : character.id === ORC_GUARD_ID
            ? { x: 4, y: 5 }
            : { ...SECOND_GUARD_POSITION },
        statusEffects: eligibilityCase === 'incapacitated'
          ? [...withoutSandboxIncapacitated, {
              id: 'reaction-sandbox-incapacitated',
              name: 'Incapacitated',
              type: 'debuff' as const,
              duration: 1,
              source: SANDBOX_DISENGAGE_SOURCE,
            }]
          : withoutSandboxIncapacitated,
      };
    }

    return character;
  });
}

function setMultipleResponders(
  characters: CombatCharacter[],
  enabled: boolean,
): CombatCharacter[] {
  const withoutSecondGuard = characters.filter(character => character.id !== SECOND_ORC_GUARD_ID);
  if (!enabled) {
    return withoutSecondGuard;
  }

  const primaryGuard = characters.find(character => character.id === ORC_GUARD_ID);
  if (!primaryGuard) {
    return characters;
  }

  // Clone the complete authored guard so the second responder carries the same
  // legal melee option and independent Reaction ledger. Only identity, position,
  // and initiative differ; no partial fake combatant is introduced.
  const secondGuard: CombatCharacter = {
    ...primaryGuard,
    id: SECOND_ORC_GUARD_ID,
    name: 'Orc Guard Two',
    position: { ...SECOND_GUARD_POSITION },
    initiative: 10,
    actionEconomy: {
      ...primaryGuard.actionEconomy,
      reaction: { ...primaryGuard.actionEconomy.reaction },
    },
    statusEffects: [...primaryGuard.statusEffects],
    conditions: [...(primaryGuard.conditions ?? [])],
  };
  return [...withoutSecondGuard, secondGuard];
}

function createMovementAction(
  snapshot: PreviewCombatScenarioControlApplication['snapshot'],
) {
  const fighter = snapshot.characters.find(character => character.id === PLAYER_FIGHTER_ID);
  const decision = snapshot.controlValues?.['reaction-decision'] === 'decline'
    ? 'decline' as const
    : 'accept' as const;
  const responders = snapshot.characters.filter(character => (
    character.id === ORC_GUARD_ID || character.id === SECOND_ORC_GUARD_ID
  ));

  if (!fighter) {
    return null;
  }

  // Pinned faces make the teaching receipt repeatable while attack bonuses,
  // AC comparison, damage ownership, Reaction payment, movement, and logs all
  // remain inside useActionExecutor's normal Move transaction.
  return {
    id: OPPORTUNITY_MOVEMENT_EVENT_ID,
    characterId: fighter.id,
    type: 'move' as const,
    targetPosition: { ...MOVEMENT_DESTINATION },
    movementPath: [{ ...fighter.position }, { ...MOVEMENT_DESTINATION }],
    cost: { type: 'movement-only' as const, movementCost: 5 },
    timestamp: 1,
    opportunityAttackDecisions: Object.fromEntries(responders.map(responder => [
      responder.id,
      { decision, attackRoll: 14, damageRoll: 6 },
    ])),
  };
}

// ============================================================================
// Shared Control Application
// ============================================================================
// The panel sends one control id and value at a time. This dispatcher validates
// that toggle values are genuinely boolean, applies only the requested fact,
// and supplies a short log message so the tester can see what setup changed.
// ============================================================================

function applyReactionControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { controlId, value, snapshot } = application;

  // Action and selector controls have their own value shapes. Dispatch those
  // before the boolean setup guard so legitimate inputs reach their owner.
  if (controlId === 'reaction-decision') {
    return {
      logMessage: value === 'decline'
        ? 'Reaction decision: every eligible Orc Guard will decline.'
        : 'Reaction decision: every eligible Orc Guard will accept.',
    };
  }

  if (controlId === 'movement-case') {
    if (!['voluntary', 'forced', 'teleport', 'disengage'].includes(String(value))) {
      return { logMessage: `Reaction sandbox ignored invalid movement case ${String(value)}.` };
    }
    return {
      characters: snapshot.characters.map(character => (
        setFighterDisengageProtection(character, value === 'disengage')
      )),
      logMessage: `Movement case: ${String(value)}.`,
    };
  }

  if (controlId === 'eligibility-case') {
    if (!['eligible', 'outside_reach', 'hidden', 'incapacitated'].includes(String(value))) {
      return { logMessage: `Reaction sandbox ignored invalid eligibility case ${String(value)}.` };
    }
    return {
      characters: setEligibilityCase(snapshot.characters, String(value)),
      logMessage: `Range and sight case: ${String(value).replace('_', ' ')}.`,
    };
  }

  if (controlId === 'resolve-movement' || controlId === 'replay-movement') {
    if (value !== true) {
      return { logMessage: '' };
    }
    const movementCase = String(snapshot.controlValues?.['movement-case'] ?? 'voluntary');
    const movementAction = createMovementAction(snapshot);
    if (!movementAction) {
      return { logMessage: 'Movement rejected atomically: Player Fighter is unavailable.' };
    }

    // Forced movement and teleportation never enter the voluntary Move/OA
    // transaction. The production detector owns that prevention fact. This
    // adapter deliberately does not relocate the token itself because doing so
    // would create a second movement resolver beside MovementCommand.
    if (movementCase === 'forced' || movementCase === 'teleport') {
      const fighter = snapshot.characters.find(character => character.id === PLAYER_FIGHTER_ID)!;
      const responders = snapshot.characters.filter(character => (
        character.id === ORC_GUARD_ID || character.id === SECOND_ORC_GUARD_ID
      ));
      const windows = new OpportunityAttackSystem()
        .checkOpportunityAttacks(
          fighter,
          fighter.position,
          MOVEMENT_DESTINATION,
          responders,
          snapshot.mapData,
          { movementKind: movementCase },
        );
      return {
        logMessage: `${movementCase} prevention check: Opportunity Attack windows ${windows.length}; no movement, Reaction, HP, or log-owning transaction was fabricated by the adapter.`,
      };
    }

    return {
      combatActionExecution: movementAction,
      logMessage: controlId === 'replay-movement'
        ? ''
        : `Resolve delivered stable movement event ${OPPORTUNITY_MOVEMENT_EVENT_ID} through the normal Move transaction.`,
    };
  }

  // A malformed registry or stale caller should not corrupt the board. The
  // contract has no error channel, so invalid values produce a deterministic
  // no-op message and leave every canonical snapshot reference untouched.
  if (typeof value !== 'boolean') {
    return {
      logMessage: `Reaction sandbox ignored invalid value for ${controlId}.`,
    };
  }

  if (controlId === 'enemy-reaction-ready') {
    return {
      characters: snapshot.characters.map(character =>
        setGuardReactionReady(character, value)
      ),
      logMessage: value
        ? 'Sandbox fact: Orc Guard reaction is ready.'
        : 'Sandbox fact: Orc Guard reaction is already spent.',
    };
  }

  if (controlId === 'disengage-protection') {
    return {
      characters: snapshot.characters.map(character =>
        setFighterDisengageProtection(character, value)
      ),
      logMessage: value
        ? 'Sandbox fact: Player Fighter has Disengage protection.'
        : 'Sandbox fact: Player Fighter can provoke opportunity attacks.',
    };
  }

  if (controlId === 'start-inside-threatened-reach') {
    return {
      characters: snapshot.characters.map(character =>
        setFighterThreatenedPosition(character, value)
      ),
      logMessage: value
        ? 'Sandbox fact: Player Fighter starts inside the Orc Guard\'s threatened reach.'
        : 'Sandbox fact: Player Fighter starts outside the Orc Guard\'s threatened reach.',
    };
  }

  if (controlId === 'multiple-responders') {
    return {
      characters: setMultipleResponders(snapshot.characters, value),
      logMessage: value
        ? 'Sandbox fact: two independent Orc Guards can respond in initiative and stable-id order.'
        : 'Sandbox fact: only the primary Orc Guard can respond.',
    };
  }

  // Unknown control ids can appear briefly when the shared registry and a hot
  // browser tab are on different revisions. A no-op keeps that mismatch visible
  // in the log without guessing which combat fact the stale id meant to change.
  return {
    logMessage: `Reaction sandbox ignored unknown control ${controlId}.`,
  };
}

// ============================================================================
// Opportunity Attacks Control Module
// ============================================================================
// This is the one public value consumed by the shared registry. Defaults recreate
// the current authored board: a ready guard, an exposed fighter, and a fighter
// beginning adjacent to the guard so moving away crosses five-foot reach.
// ============================================================================

export const reactionScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'reaction',
  controls: [
    {
      id: 'enemy-reaction-ready',
      label: 'Enemy reaction ready',
      description: 'Switch whether the Orc Guard still has its reaction available this round.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'disengage-protection',
      label: 'Disengage protection',
      description: 'Switch whether the Player Fighter starts protected from opportunity attacks this turn.',
      kind: 'toggle',
      defaultValue: false,
    },
    {
      id: 'start-inside-threatened-reach',
      label: 'Start inside threatened reach',
      description: 'Switch whether the Player Fighter begins adjacent to the Orc Guard or already outside its reach.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'reaction-decision',
      label: 'Reaction decision',
      description: 'Choose whether each eligible observer accepts or declines before the fighter leaves reach.',
      kind: 'select',
      defaultValue: 'accept',
      options: [
        { value: 'accept', label: 'Accept' },
        { value: 'decline', label: 'Decline' },
      ],
    },
    {
      id: 'movement-case',
      label: 'Movement case',
      description: 'Compare voluntary movement with forced movement, teleportation, or Disengage protection.',
      kind: 'select',
      defaultValue: 'voluntary',
      options: [
        { value: 'voluntary', label: 'Voluntary Move' },
        { value: 'forced', label: 'Forced movement' },
        { value: 'teleport', label: 'Teleportation' },
        { value: 'disengage', label: 'Disengage then Move' },
      ],
    },
    {
      id: 'eligibility-case',
      label: 'Range and sight',
      description: 'Keep the observer eligible, move it outside reach, hide the mover, or make the observer Incapacitated.',
      kind: 'select',
      defaultValue: 'eligible',
      options: [
        { value: 'eligible', label: 'Eligible' },
        { value: 'outside_reach', label: 'Outside reach' },
        { value: 'hidden', label: 'Mover Hidden' },
        { value: 'incapacitated', label: 'Observer Incapacitated' },
      ],
    },
    {
      id: 'multiple-responders',
      label: 'Multiple responders',
      description: 'Add a second eligible Orc Guard with its own Reaction and deterministic response order.',
      kind: 'toggle',
      defaultValue: false,
    },
    {
      id: 'resolve-movement',
      label: 'Resolve movement',
      description: 'Deliver the stable movement event through the production Move and Opportunity Attack path.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay-movement',
      label: 'Replay stable movement event',
      description: 'Redeliver the same event id to prove movement, Reaction, HP, and logs do not change twice.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyReactionControl,
};

// The shared registry loads every scenario module through its default export.
// Keeping the named export as well gives focused tests an explicit, readable name
// while both paths still refer to this single authoritative module object.
export default reactionScenarioControlModule;
