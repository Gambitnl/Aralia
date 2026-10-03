/**
 * This file proves the Opportunity Attacks sandbox controls change real combat facts.
 *
 * The tests exercise the module through the shared scenario-control contract, then
 * pass its character patches into the production OpportunityAttackSystem. This guards
 * against attractive switches that change labels without changing reaction eligibility,
 * Disengage prevention, or the threatened-reach boundary used by actual movement.
 *
 * Called by: focused Vitest scenario-control checks.
 * Depends on: reactionScenarioControlModule and OpportunityAttackSystem.
 */

import { describe, expect, it } from 'vitest';
import { OpportunityAttackSystem } from '../../../../../systems/combat/reactions/OpportunityAttackSystem';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';
import { reactionScenarioControlModule } from '../reactionScenarioControls';

// ============================================================================
// Scenario Snapshot Fixture
// ============================================================================
// The two stable ids and positions match the live reaction scenario. Tests keep
// an unrelated bystander as well, so every control must prove that it changes
// only its intended actor rather than rebuilding the whole combat roster.
// ============================================================================

function createReactionSnapshot(): PreviewCombatScenarioControlSnapshot {
  const fighter = createMockCombatCharacter({
    id: 'player-fighter',
    name: 'Player Fighter',
    team: 'player',
    position: { x: 3, y: 5 },
  });
  const guard = createMockCombatCharacter({
    id: 'orc-guard',
    name: 'Orc Guard',
    team: 'enemy',
    position: { x: 4, y: 5 },
  });
  const bystander = createMockCombatCharacter({
    id: 'unrelated-bystander',
    name: 'Unrelated Bystander',
    team: 'neutral',
    position: { x: 10, y: 10 },
  });

  return {
    mapData: null,
    characters: [fighter, guard, bystander],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

// Apply one switch through the same public contract used by the sandbox page.
// Character-focused tests require a character patch, so a missing patch is a
// useful hard failure rather than silently falling back to the old snapshot.
function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] } {
  const patch = reactionScenarioControlModule.applyControl({
    controlId,
    value,
    snapshot,
  });

  expect(patch.characters).toBeDefined();
  return patch as PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] };
}

// Find one authored actor in a returned patch. Throwing here keeps failures tied
// to a missing scenario identity instead of producing an unclear property error.
function findCharacter(characters: CombatCharacter[], characterId: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);

  if (!character) {
    throw new Error(`Expected reaction scenario character ${characterId}.`);
  }

  return character;
}

// Ask the production detector whether the fighter's next one-tile move provokes.
// The destination deliberately moves left, directly away from the guard, so only
// readiness, Disengage, and the starting reach boundary can affect the result.
function detectMoveAway(characters: CombatCharacter[]) {
  const fighter = findCharacter(characters, 'player-fighter');
  const guard = findCharacter(characters, 'orc-guard');
  const destination = { x: fighter.position.x - 1, y: fighter.position.y };

  return new OpportunityAttackSystem().checkOpportunityAttacks(
    fighter,
    fighter.position,
    destination,
    [guard],
  );
}

// ============================================================================
// Shared Module Description
// ============================================================================
// These assertions protect the player-facing registry contract, including the
// authored defaults restored when the scenario opens or Reset Board is pressed.
// ============================================================================

describe('reactionScenarioControlModule', () => {
  it('describes the expected movement, choice, eligibility, responder, replay, and setup controls', () => {
    expect(reactionScenarioControlModule.scenarioId).toBe('reaction');
    expect(reactionScenarioControlModule.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'enemy-reaction-ready',
        label: 'Enemy reaction ready',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'disengage-protection',
        label: 'Disengage protection',
        kind: 'toggle',
        defaultValue: false,
      }),
      expect.objectContaining({
        id: 'start-inside-threatened-reach',
        label: 'Start inside threatened reach',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'reaction-decision',
        label: 'Reaction decision',
        kind: 'select',
        defaultValue: 'accept',
      }),
      expect.objectContaining({
        id: 'movement-case',
        label: 'Movement case',
        kind: 'select',
        defaultValue: 'voluntary',
      }),
      expect.objectContaining({
        id: 'eligibility-case',
        label: 'Range and sight',
        kind: 'select',
        defaultValue: 'eligible',
      }),
      expect.objectContaining({
        id: 'multiple-responders',
        label: 'Multiple responders',
        kind: 'toggle',
        defaultValue: false,
      }),
      expect.objectContaining({
        id: 'resolve-movement',
        label: 'Resolve movement',
        kind: 'action',
      }),
      expect.objectContaining({
        id: 'replay-movement',
        label: 'Replay stable movement event',
        kind: 'action',
      }),
    ]));
  });

  it('authors one stable normal Move request with deterministic accept or decline decisions', () => {
    const snapshot = {
      ...createReactionSnapshot(),
      turnState: {
        currentTurn: 1,
      phase: 'action', actionsThisTurn: [],
        turnOrder: ['player-fighter', 'orc-guard'],
        currentCharacterId: 'player-fighter',
      },
      controlValues: {
        'reaction-decision': 'decline',
        'movement-case': 'voluntary',
        'eligibility-case': 'eligible',
        'multiple-responders': false,
      },
    } as PreviewCombatScenarioControlSnapshot;

    const resolved = reactionScenarioControlModule.applyControl({
      controlId: 'resolve-movement',
      value: true,
      snapshot,
    });
    const replayed = reactionScenarioControlModule.applyControl({
      controlId: 'replay-movement',
      value: true,
      snapshot,
    });

    expect(resolved.combatActionExecution).toMatchObject({
      id: 'reaction-opportunity-move-1',
      characterId: 'player-fighter',
      type: 'move',
      targetPosition: { x: 2, y: 5 },
      movementPath: [{ x: 3, y: 5 }, { x: 2, y: 5 }],
      cost: { type: 'movement-only', movementCost: 5 },
      opportunityAttackDecisions: {
        'orc-guard': { decision: 'decline', attackRoll: 14, damageRoll: 6 },
      },
    });
    expect(replayed.combatActionExecution?.id).toBe('reaction-opportunity-move-1');
  });

  // ========================================================================
  // Enemy Reaction Availability
  // ========================================================================
  // Spending the guard's reaction must block the real detector, while restoring
  // readiness must make the same boundary-crossing move eligible again.
  // ========================================================================

  it('switches the guard between a ready and spent reaction without mutating the snapshot', () => {
    const snapshot = createReactionSnapshot();
    const originalGuard = findCharacter(snapshot.characters, 'orc-guard');
    const originalBystander = findCharacter(snapshot.characters, 'unrelated-bystander');

    const spentPatch = applyControl(snapshot, 'enemy-reaction-ready', false);
    const spentGuard = findCharacter(spentPatch.characters, 'orc-guard');

    expect(spentGuard.actionEconomy.reaction).toEqual({ used: true, remaining: 0 });
    expect(detectMoveAway(spentPatch.characters)).toHaveLength(0);
    expect(originalGuard.actionEconomy.reaction.used).toBe(false);
    expect(findCharacter(spentPatch.characters, 'unrelated-bystander')).toBe(originalBystander);

    const readyPatch = applyControl(
      { ...snapshot, characters: spentPatch.characters },
      'enemy-reaction-ready',
      true,
    );
    const readyGuard = findCharacter(readyPatch.characters, 'orc-guard');

    expect(readyGuard.actionEconomy.reaction).toEqual({ used: false, remaining: 1 });
    expect(detectMoveAway(readyPatch.characters)).toHaveLength(1);
  });

  // ========================================================================
  // Disengage Protection
  // ========================================================================
  // The control uses the canonical Disengage marker read by the production
  // detector. Its Off state removes only the marker owned by this teaching UI.
  // ========================================================================

  it('adds sandbox-owned Disengage protection and removes only that owned marker', () => {
    const snapshot = createReactionSnapshot();
    const protectedPatch = applyControl(snapshot, 'disengage-protection', true);
    const protectedFighter = findCharacter(protectedPatch.characters, 'player-fighter');

    expect(protectedFighter.statusEffects).toContainEqual(expect.objectContaining({
      id: 'disengage',
      name: 'Disengage',
      source: 'Tactical Sandbox reaction control',
    }));
    expect(detectMoveAway(protectedPatch.characters)).toHaveLength(0);
    expect(findCharacter(snapshot.characters, 'player-fighter').statusEffects).toHaveLength(0);

    // A real player action can coexist with sandbox setup. Turning the setup
    // switch off must not cancel protection earned through that production path.
    const fighterWithRealDisengage = {
      ...protectedFighter,
      statusEffects: [
        ...protectedFighter.statusEffects,
        {
          id: 'disengage',
          name: 'Disengage',
          type: 'buff' as const,
          duration: 1,
          source: 'Disengage action',
        },
      ],
    };
    const mixedSnapshot = {
      ...snapshot,
      characters: protectedPatch.characters.map(character =>
        character.id === fighterWithRealDisengage.id ? fighterWithRealDisengage : character
      ),
    };
    const exposedPatch = applyControl(mixedSnapshot, 'disengage-protection', false);
    const exposedFighter = findCharacter(exposedPatch.characters, 'player-fighter');

    expect(exposedFighter.statusEffects).toEqual([
      expect.objectContaining({ source: 'Disengage action' }),
    ]);
    expect(detectMoveAway(exposedPatch.characters)).toHaveLength(0);
  });

  // ========================================================================
  // Threatened-Reach Starting Position
  // ========================================================================
  // Adjacent movement crosses the five-foot boundary and provokes. Starting two
  // tiles away means the same one-tile move remains outside and cannot provoke.
  // ========================================================================

  it('places the fighter inside or outside reach and changes boundary timing', () => {
    const snapshot = createReactionSnapshot();
    const insidePatch = applyControl(snapshot, 'start-inside-threatened-reach', true);
    const insideFighter = findCharacter(insidePatch.characters, 'player-fighter');

    expect(insideFighter.position).toEqual({ x: 3, y: 5 });
    expect(detectMoveAway(insidePatch.characters)).toEqual([
      expect.objectContaining({
        attackerId: 'orc-guard',
        targetId: 'player-fighter',
        triggerPosition: { x: 3, y: 5 },
        triggerReach: 1,
      }),
    ]);

    const outsidePatch = applyControl(snapshot, 'start-inside-threatened-reach', false);
    const outsideFighter = findCharacter(outsidePatch.characters, 'player-fighter');

    expect(outsideFighter.position).toEqual({ x: 2, y: 5 });
    expect(detectMoveAway(outsidePatch.characters)).toHaveLength(0);
    expect(findCharacter(snapshot.characters, 'player-fighter').position).toEqual({ x: 3, y: 5 });
  });

  it.each([
    ['outside_reach', 'orc-guard'],
    ['hidden', 'player-fighter'],
    ['incapacitated', 'orc-guard'],
  ])('makes the %s eligibility fixture reject before reaction payment', (eligibilityCase, changedActorId) => {
    const snapshot = createReactionSnapshot();
    const patch = applyControl(snapshot, 'eligibility-case', eligibilityCase);

    expect(findCharacter(patch.characters, changedActorId)).not.toBe(
      findCharacter(snapshot.characters, changedActorId),
    );
    expect(detectMoveAway(patch.characters)).toHaveLength(0);
    expect(findCharacter(patch.characters, 'orc-guard').actionEconomy.reaction)
      .toEqual({ used: false, remaining: 1 });
  });

  it('adds an independent second responder and authors decisions in deterministic order', () => {
    const snapshot = createReactionSnapshot();
    const multiPatch = applyControl(snapshot, 'multiple-responders', true);
    const fighter = findCharacter(multiPatch.characters, 'player-fighter');
    const guards = multiPatch.characters.filter(character => character.id.startsWith('orc-guard'));

    expect(guards.map(guard => guard.id)).toEqual(['orc-guard', 'orc-guard-second']);
    expect(guards[0].actionEconomy.reaction).not.toBe(guards[1].actionEconomy.reaction);
    const windows = new OpportunityAttackSystem().checkOpportunityAttacks(
      fighter,
      fighter.position,
      { x: 2, y: 5 },
      [...guards].reverse(),
      null,
      { turnOrder: ['player-fighter', 'orc-guard', 'orc-guard-second'] },
    );
    expect(windows.map(window => window.attackerId)).toEqual(['orc-guard', 'orc-guard-second']);

    const actionPatch = reactionScenarioControlModule.applyControl({
      controlId: 'resolve-movement',
      value: true,
      snapshot: {
        ...snapshot,
        characters: multiPatch.characters,
        controlValues: {
          'reaction-decision': 'accept',
          'movement-case': 'voluntary',
          'eligibility-case': 'eligible',
          'multiple-responders': true,
        },
      },
    });
    expect(Object.keys(actionPatch.combatActionExecution?.opportunityAttackDecisions ?? {}))
      .toEqual(['orc-guard', 'orc-guard-second']);
  });

  it.each(['forced', 'teleport'] as const)(
    'reports the production %s prevention gate without fabricating a movement transaction',
    movementCase => {
      const snapshot = createReactionSnapshot();
      const patch = reactionScenarioControlModule.applyControl({
        controlId: 'resolve-movement',
        value: true,
        snapshot: {
          ...snapshot,
          controlValues: {
            'reaction-decision': 'accept',
            'movement-case': movementCase,
            'eligibility-case': 'eligible',
            'multiple-responders': false,
          },
        },
      });
      expect(patch.combatActionExecution).toBeUndefined();
      expect(patch.characters).toBeUndefined();
      expect(snapshot.characters).toEqual(createReactionSnapshot().characters);
      expect(patch.logMessage).toContain('Opportunity Attack windows 0');
      expect(patch.logMessage).toContain('no movement, Reaction, HP, or log-owning transaction was fabricated');
    },
  );

  it('uses the canonical Disengage marker while preserving the normal Move request', () => {
    const snapshot = createReactionSnapshot();
    const disengaged = applyControl(snapshot, 'movement-case', 'disengage');
    const fighter = findCharacter(disengaged.characters, 'player-fighter');
    expect(detectMoveAway(disengaged.characters)).toHaveLength(0);

    const resolved = reactionScenarioControlModule.applyControl({
      controlId: 'resolve-movement',
      value: true,
      snapshot: {
        ...snapshot,
        characters: disengaged.characters,
        controlValues: {
          'reaction-decision': 'accept',
          'movement-case': 'disengage',
          'eligibility-case': 'eligible',
          'multiple-responders': false,
        },
      },
    });
    expect(fighter.statusEffects.map(effect => effect.id)).toContain('disengage');
    expect(resolved.combatActionExecution).toMatchObject({
      id: 'reaction-opportunity-move-1',
      type: 'move',
    });
  });

  // ========================================================================
  // Defensive No-Op Behavior
  // ========================================================================
  // Invalid values and stale ids must stay visible in the required log message
  // while leaving canonical combat state completely untouched.
  // ========================================================================

  it('leaves the snapshot untouched for invalid values and unknown control ids', () => {
    const snapshot = createReactionSnapshot();
    const invalidValuePatch = reactionScenarioControlModule.applyControl({
      controlId: 'enemy-reaction-ready',
      value: 'ready',
      snapshot,
    });
    const unknownControlPatch = reactionScenarioControlModule.applyControl({
      controlId: 'stale-control-id',
      value: true,
      snapshot,
    });

    expect(invalidValuePatch.characters).toBeUndefined();
    expect(invalidValuePatch.logMessage).toContain('ignored invalid value');
    expect(unknownControlPatch.characters).toBeUndefined();
    expect(unknownControlPatch.logMessage).toContain('ignored unknown control');
    expect(snapshot.characters).toEqual(createReactionSnapshot().characters);
  });
});
