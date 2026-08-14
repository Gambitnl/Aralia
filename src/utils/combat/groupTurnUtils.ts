// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 08:34:21
 * Dependents: hooks/combat/useTurnManager.ts, hooks/combat/useTurnOrder.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines how one initiative count can contain several combatants.
 *
 * A group has a deterministic member order and one active member at a time.
 * The group owns scheduling only: each member keeps independent Actions,
 * movement, Reactions, start effects, and end effects. Ordinary combatants are
 * represented as one-member groups, so the same scheduler preserves existing
 * individual turns without a parallel fallback path.
 *
 * Called by: useTurnOrder and group-turn tests.
 * Depends on: canonical initiative ordering and CombatCharacter turn facts.
 */

import type {
  ActiveCombatTurnGroup,
  CombatCharacter,
  CombatTurnGroup,
  TurnState,
} from '../../types/combat';

// ============================================================================
// Public transition receipt
// ============================================================================
// The turn manager uses this receipt to distinguish a member hand-off from a
// completed group or round. That prevents group completion from accidentally
// ticking member effects or resetting another member's resources twice.
// ============================================================================

export interface GroupTurnTransition {
  previousCharacterId: string | null;
  nextCharacterId: string | null;
  previousGroupId: string | null;
  nextGroupId: string | null;
  isGroupCompleted: boolean;
  isNewRound: boolean;
  skippedMemberIds: string[];
}

export interface GroupTurnAdvanceResult {
  state: TurnState;
  transition: GroupTurnTransition;
}

const GROUP_ID_PREFIX = 'initiative-group';

// ============================================================================
// Group construction
// ============================================================================
// Shared-policy summons join their caster's group recursively. All other
// actors become single-member groups in the already-sorted initiative order.
// ============================================================================

function isAnchoredSharedMember(
  character: CombatCharacter,
  availableIds: ReadonlySet<string>,
): boolean {
  return Boolean(
    character.isSummon
      && character.summonMetadata?.initiativePolicy === 'shared'
      && availableIds.has(character.summonMetadata.casterId),
  );
}

export function buildCombatTurnGroups(
  orderedCharacters: CombatCharacter[],
): CombatTurnGroup[] {
  const availableIds = new Set(orderedCharacters.map(character => character.id));
  const followersByOwner = new Map<string, CombatCharacter[]>();

  // Record shared followers in their canonical authored order. Orphaned shared
  // actors deliberately remain ordinary singleton groups so they never vanish.
  for (const character of orderedCharacters) {
    if (!isAnchoredSharedMember(character, availableIds)) continue;
    const ownerId = character.summonMetadata!.casterId;
    followersByOwner.set(ownerId, [
      ...(followersByOwner.get(ownerId) ?? []),
      character,
    ]);
  }

  const groups: CombatTurnGroup[] = [];
  const groupedIds = new Set<string>();

  const appendMemberTree = (character: CombatCharacter, memberIds: string[]): void => {
    if (groupedIds.has(character.id)) return;
    groupedIds.add(character.id);
    memberIds.push(character.id);
    for (const follower of followersByOwner.get(character.id) ?? []) {
      appendMemberTree(follower, memberIds);
    }
  };

  for (const character of orderedCharacters) {
    if (groupedIds.has(character.id)) continue;
    const memberIds: string[] = [];
    appendMemberTree(character, memberIds);
    groups.push({
      id: `${GROUP_ID_PREFIX}:${character.id}`,
      initiative: character.initiative,
      memberIds,
    });
  }

  return groups;
}

export function createActiveCombatTurnGroup(
  group: CombatTurnGroup,
  activeMemberId: string,
  completedMemberIds: string[] = [],
): ActiveCombatTurnGroup {
  return {
    groupId: group.id,
    memberIds: [...group.memberIds],
    activeMemberId,
    completedMemberIds: [...completedMemberIds],
    actionOwnership: 'member',
    movementOwnership: 'member',
    reactionOwnership: 'member',
    effectTiming: 'member_start_and_end',
  };
}

// ============================================================================
// Eligibility and compatibility
// ============================================================================
// Missing and dead members cannot hold the active pointer. Incapacitated
// members do keep a member boundary because their own start/end effects and
// recovery saves still happen; action execution remains responsible for
// enforcing what Incapacitated permits during that member phase.
// ============================================================================

export function isCombatTurnMemberEligible(
  character: CombatCharacter | undefined,
): boolean {
  if (!character) return false;
  const deadPlayer = character.team === 'player'
    && (character.deathSaves?.failures ?? 0) >= 3;
  const downedLivingPlayer = character.team === 'player'
    && character.currentHP === 0
    && !deadPlayer;
  return character.currentHP > 0 || downedLivingPlayer;
}

function normalizedGroups(turnState: TurnState): CombatTurnGroup[] {
  if (turnState.turnGroups?.length) {
    return turnState.turnGroups.map(group => ({
      ...group,
      memberIds: [...group.memberIds],
    }));
  }

  // Old saves and focused fixtures predate group state. Treat every legacy id
  // as a singleton so loading them preserves the exact individual-turn order.
  return turnState.turnOrder.map(characterId => ({
    id: `${GROUP_ID_PREFIX}:${characterId}`,
    initiative: 0,
    memberIds: [characterId],
  }));
}

function emptyTransition(turnState: TurnState): GroupTurnTransition {
  return {
    previousCharacterId: turnState.currentCharacterId,
    nextCharacterId: null,
    previousGroupId: turnState.activeGroup?.groupId ?? null,
    nextGroupId: null,
    isGroupCompleted: false,
    isNewRound: false,
    skippedMemberIds: [],
  };
}

// ============================================================================
// Member and group advancement
// ============================================================================
// Finish the active member first. If another eligible member remains in the
// same group, hand control to it without starting a new initiative slot. Once
// the group is complete, find the next eligible group and advance the round
// only when the initiative sequence wraps.
// ============================================================================

export function advanceCombatGroupTurn(
  turnState: TurnState,
  characters: CombatCharacter[],
  excludedMemberIds: ReadonlySet<string> = new Set<string>(),
): GroupTurnAdvanceResult {
  const groups = normalizedGroups(turnState);
  const characterById = new Map(characters.map(character => [character.id, character]));
  const currentId = turnState.currentCharacterId;

  if (!currentId || groups.length === 0) {
    return { state: turnState, transition: emptyTransition(turnState) };
  }

  const currentGroupIndex = Math.max(0, groups.findIndex(group => (
    group.id === turnState.activeGroup?.groupId
      || group.memberIds.includes(currentId)
  )));
  const currentGroup = groups[currentGroupIndex];
  const currentMemberIndex = Math.max(0, currentGroup.memberIds.indexOf(currentId));
  const skippedMemberIds: string[] = [];

  const eligible = (memberId: string): boolean => {
    const canAct = !excludedMemberIds.has(memberId)
      && isCombatTurnMemberEligible(characterById.get(memberId));
    if (!canAct && memberId !== currentId) skippedMemberIds.push(memberId);
    return canAct;
  };

  // Continue inside the current group before another initiative count can act.
  const nextMemberInGroup = currentGroup.memberIds
    .slice(currentMemberIndex + 1)
    .find(eligible);
  const completedMemberIds = Array.from(new Set([
    ...(turnState.activeGroup?.completedMemberIds ?? []),
    currentId,
  ]));

  if (nextMemberInGroup) {
    return {
      state: {
        ...turnState,
        turnGroups: groups,
        currentCharacterId: nextMemberInGroup,
        activeGroup: createActiveCombatTurnGroup(
          currentGroup,
          nextMemberInGroup,
          completedMemberIds,
        ),
        actionsThisTurn: [],
      },
      transition: {
        previousCharacterId: currentId,
        nextCharacterId: nextMemberInGroup,
        previousGroupId: currentGroup.id,
        nextGroupId: currentGroup.id,
        isGroupCompleted: false,
        isNewRound: false,
        skippedMemberIds,
      },
    };
  }

  // Search later initiative groups, then wrap to the first group. A group with
  // no present/living member is skipped atomically and never receives effects.
  for (let offset = 1; offset <= groups.length; offset += 1) {
    const nextGroupIndex = (currentGroupIndex + offset) % groups.length;
    const nextGroup = groups[nextGroupIndex];
    const nextMemberId = nextGroup.memberIds.find(eligible);
    if (!nextMemberId) continue;
    const isNewRound = nextGroupIndex <= currentGroupIndex;

    return {
      state: {
        ...turnState,
        currentTurn: isNewRound ? turnState.currentTurn + 1 : turnState.currentTurn,
        turnGroups: groups,
        currentCharacterId: nextMemberId,
        activeGroup: createActiveCombatTurnGroup(nextGroup, nextMemberId),
        actionsThisTurn: [],
      },
      transition: {
        previousCharacterId: currentId,
        nextCharacterId: nextMemberId,
        previousGroupId: currentGroup.id,
        nextGroupId: nextGroup.id,
        isGroupCompleted: true,
        isNewRound,
        skippedMemberIds,
      },
    };
  }

  // No eligible member remains. Keep the round stable and clear the active
  // pointer so repeated End Turn requests are safe no-ops.
  return {
    state: {
      ...turnState,
      turnGroups: groups,
      currentCharacterId: null,
      activeGroup: null,
      actionsThisTurn: [],
    },
    transition: {
      ...emptyTransition(turnState),
      previousGroupId: currentGroup.id,
      isGroupCompleted: true,
      skippedMemberIds,
    },
  };
}

// ============================================================================
// Mid-turn removal
// ============================================================================
// Removing the active member advances from its exact place before deleting it
// from the definitions. Removing an inactive member only narrows its group; no
// unrelated member starts, ends, or resets as a side effect.
// ============================================================================

export function removeCombatTurnMember(
  turnState: TurnState,
  characterId: string,
  characters: CombatCharacter[],
): GroupTurnAdvanceResult {
  const groups = normalizedGroups(turnState);
  const removingActiveMember = turnState.currentCharacterId === characterId;
  const advanced = removingActiveMember
    ? advanceCombatGroupTurn(turnState, characters, new Set([characterId]))
    : { state: turnState, transition: emptyTransition(turnState) };
  const nextGroups = groups
    .map(group => ({
      ...group,
      memberIds: group.memberIds.filter(memberId => memberId !== characterId),
    }))
    .filter(group => group.memberIds.length > 0);
  const nextOrder = turnState.turnOrder.filter(memberId => memberId !== characterId);
  const activeGroupDefinition = advanced.state.activeGroup
    ? nextGroups.find(group => group.id === advanced.state.activeGroup!.groupId)
    : undefined;

  return {
    state: {
      ...advanced.state,
      turnOrder: nextOrder,
      turnGroups: nextGroups,
      activeGroup: advanced.state.activeGroup && activeGroupDefinition
        ? createActiveCombatTurnGroup(
            activeGroupDefinition,
            advanced.state.activeGroup.activeMemberId,
            advanced.state.activeGroup.completedMemberIds.filter(id => id !== characterId),
          )
        : null,
    },
    transition: advanced.transition,
  };
}
