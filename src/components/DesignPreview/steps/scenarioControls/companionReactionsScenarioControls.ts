// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:58:54
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic controls for Companion Reactions.
 *
 * The board contains an owner, two owned guardian companions, a protected ally,
 * and a hostile attacker. The adapter changes only real combat facts, then uses
 * the production allied-responder window that normal DamageCommand calls.
 * Explicit choice, duplicate delivery, and actor-local turn reset remain visible
 * without teaching this scenario a parallel Interception rule.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: the production companion-protection transaction and combat state.
 */

import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { applyDamageAndCheckDowned } from '../../../../utils/combat/deathSaveUtils';
import {
  INTERCEPTION_RANGE_FEET,
  INTERCEPTION_STYLE_DESCRIPTION,
  INTERCEPTION_STYLE_NAME,
} from '../../../../systems/combat/reactions/companionProtectionReaction';
import {
  getAlliedProtectionClaimId,
  resolveAlliedProtectionReactionSelection,
} from '../../../../systems/combat/reactions/alliedProtectionReaction';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

export {
  INTERCEPTION_RANGE_FEET,
  INTERCEPTION_STYLE_DESCRIPTION,
  INTERCEPTION_STYLE_NAME,
};

// ============================================================================
// Stable Board Facts
// ============================================================================
// These ids and positions bind the thin adapter to five mounted actors. Both
// companions begin five feet from the ally; the wrong-sight case places Total
// Cover between protectors and attacker while keeping the ally adjacent.
// ============================================================================

export const COMPANION_REACTIONS_OWNER_ID = 'companion_reactions-owner';
export const COMPANION_REACTIONS_COMPANION_ID = 'companion_reactions-companion';
export const COMPANION_REACTIONS_SECOND_COMPANION_ID = 'companion_reactions-second-companion';
export const COMPANION_REACTIONS_ALLY_ID = 'companion_reactions-protected-ally';
export const COMPANION_REACTIONS_ATTACKER_ID = 'companion_reactions-hostile-attacker';

export const COMPANION_REACTIONS_OWNER_START = { x: 2, y: 3 } as const;
export const COMPANION_REACTIONS_COMPANION_START = { x: 5, y: 5 } as const;
export const COMPANION_REACTIONS_SECOND_COMPANION_START = { x: 5, y: 6 } as const;
export const COMPANION_REACTIONS_ALLY_START = { x: 6, y: 5 } as const;
export const COMPANION_REACTIONS_ALLY_OUT_OF_RANGE = { x: 8, y: 5 } as const;
export const COMPANION_REACTIONS_ATTACKER_START = { x: 11, y: 5 } as const;
export const COMPANION_REACTIONS_SIGHT_WALL_X = 8;

export const COMPANION_REACTIONS_INCOMING_DAMAGE = 14;
export const COMPANION_REACTIONS_ALLY_MAX_HP = 30;

export type CompanionReactionCase =
  | 'qualifying_attack'
  | 'multiple_responders'
  | 'wrong_attacker_sight'
  | 'out_of_range'
  | 'companion_incapacitated'
  | 'companion_reaction_spent'
  | 'missing_equipment'
  | 'missing_feature'
  | 'attack_missed'
  | 'zero_damage'
  | 'duplicate_event'
  | 'nonqualifying_attack';

export type CompanionReactionChoice = 'accept_primary' | 'accept_secondary' | 'decline';
export type CompanionReactionTurnReset = 'owner' | 'primary_companion' | 'secondary_companion';

interface CompanionReactionActors {
  owner: CombatCharacter;
  companion: CombatCharacter;
  secondCompanion: CombatCharacter;
  protectedAlly: CombatCharacter;
  attacker: CombatCharacter;
}

// ============================================================================
// Actor And Map Preparation
// ============================================================================
// Reset restores only scenario-owned facts. Ownership uses summonMetadata so
// initiative, commands, the text probe, and this reaction all read one source.
// ============================================================================

function findActors(characters: CombatCharacter[]): CompanionReactionActors | null {
  const owner = characters.find(character => character.id === COMPANION_REACTIONS_OWNER_ID);
  const companion = characters.find(character => character.id === COMPANION_REACTIONS_COMPANION_ID);
  const secondCompanion = characters.find(character => character.id === COMPANION_REACTIONS_SECOND_COMPANION_ID);
  const protectedAlly = characters.find(character => character.id === COMPANION_REACTIONS_ALLY_ID);
  const attacker = characters.find(character => character.id === COMPANION_REACTIONS_ATTACKER_ID);
  return owner && companion && secondCompanion && protectedAlly && attacker
    ? { owner, companion, secondCompanion, protectedAlly, attacker }
    : null;
}

function removeScenarioCondition(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    conditions: (character.conditions ?? []).filter(condition => (
      !['Incapacitated', 'Unconscious'].includes(condition.name)
    )),
    statusEffects: character.statusEffects.filter(effect => (
      !['Incapacitated', 'Unconscious'].includes(effect.name)
    )),
  };
}

function withAuditableNames(actors: CompanionReactionActors): CompanionReactionActors {
  return {
    owner: {
      ...actors.owner,
      name: `Ranger Owner · Reaction ${actors.owner.actionEconomy.reaction.used ? 'spent' : 'ready'}`,
    },
    companion: {
      ...actors.companion,
      name: `Guardian Companion · owned by Ranger · Reaction ${actors.companion.actionEconomy.reaction.used ? 'spent' : 'ready'}`,
    },
    secondCompanion: {
      ...actors.secondCompanion,
      name: `Second Guardian · owned by Ranger · Reaction ${actors.secondCompanion.actionEconomy.reaction.used ? 'spent' : 'ready'}`,
    },
    protectedAlly: {
      ...actors.protectedAlly,
      name: `Protected Ally · HP ${actors.protectedAlly.currentHP}/${actors.protectedAlly.maxHP}`,
    },
    attacker: {
      ...actors.attacker,
      name: actors.attacker.team === 'player'
        ? 'Nonqualifying Friendly Attacker'
        : 'Hostile Attacker · 14 Slashing',
    },
  };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: CompanionReactionActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.owner.id, actors.owner],
    [actors.companion.id, actors.companion],
    [actors.secondCompanion.id, actors.secondCompanion],
    [actors.protectedAlly.id, actors.protectedAlly],
    [actors.attacker.id, actors.attacker],
  ]);
  return characters.map(character => replacements.get(character.id) ?? character);
}

export function prepareCompanionReactionsCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const found = findActors(characters);
  if (!found) return characters;

  const owner = resetEconomy({
    ...removeScenarioCondition(found.owner),
    position: { ...COMPANION_REACTIONS_OWNER_START },
    team: 'player',
  });
  const companion = resetEconomy({
    ...removeScenarioCondition(found.companion),
    position: { ...COMPANION_REACTIONS_COMPANION_START },
    team: 'player',
    level: 5,
    isSummon: true,
    summonMetadata: {
      casterId: owner.id,
      spellId: 'primal-companion',
      entityType: 'beast',
      formName: 'Guardian Companion',
      sourceName: 'Primal Companion',
      persistent: true,
      commandCost: 'none',
      commandsPerTurn: 0,
      commandsUsedThisTurn: 0,
      control: {
        entityType: 'companion',
        source: 'Primal Companion',
        allegiance: 'Ranger Owner',
        obedience: 'owned companion',
        initiative: 'shared after owner',
      },
      initiativePolicy: 'shared',
    },
    feats: Array.from(new Set([...(found.companion.feats ?? []), 'interception_style'])),
    equipment: {
      ...found.companion.equipment,
      shield: {
        itemId: 'guardian-companion-shield',
        itemName: 'Guardian Shield',
        slot: 'OffHand',
        magicStatus: 'nonmagical',
        properties: ['shield'],
        armorClassBonus: 2,
      },
    },
  });
  const secondCompanion = resetEconomy({
    ...removeScenarioCondition(found.secondCompanion),
    position: { ...COMPANION_REACTIONS_SECOND_COMPANION_START },
    team: 'player',
    level: 5,
    isSummon: true,
    summonMetadata: {
      casterId: owner.id,
      spellId: 'primal-companion-second',
      entityType: 'beast',
      formName: 'Second Guardian',
      sourceName: 'Primal Companion',
      persistent: true,
      commandCost: 'none',
      commandsPerTurn: 0,
      commandsUsedThisTurn: 0,
      control: {
        entityType: 'companion',
        source: 'Primal Companion',
        allegiance: 'Ranger Owner',
        obedience: 'owned companion',
        initiative: 'shared after owner',
      },
      initiativePolicy: 'shared',
    },
    // The second owned actor begins ineligible so the default case has one
    // responder. The multiple-responder case grants the same canonical style.
    feats: (found.secondCompanion.feats ?? []).filter(feat => feat !== 'interception_style'),
    equipment: {
      ...found.secondCompanion.equipment,
      shield: {
        itemId: 'second-guardian-shield',
        itemName: 'Second Guardian Shield',
        slot: 'OffHand',
        magicStatus: 'nonmagical',
        properties: ['shield'],
        armorClassBonus: 2,
      },
    },
  });
  const protectedAlly = resetEconomy({
    ...removeScenarioCondition(found.protectedAlly),
    position: { ...COMPANION_REACTIONS_ALLY_START },
    team: 'player',
    currentHP: COMPANION_REACTIONS_ALLY_MAX_HP,
    maxHP: COMPANION_REACTIONS_ALLY_MAX_HP,
  });
  const attacker = resetEconomy({
    ...removeScenarioCondition(found.attacker),
    position: { ...COMPANION_REACTIONS_ATTACKER_START },
    team: 'enemy',
  });

  return replaceActors(characters, withAuditableNames({
    owner,
    companion,
    secondCompanion,
    protectedAlly,
    attacker,
  }));
}

function updateTile(
  mapData: BattleMapData,
  position: { x: number; y: number },
  update: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  const id = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(id);
  if (!tile) return mapData;
  const tiles = new Map(mapData.tiles);
  tiles.set(id, update(tile));
  return { ...mapData, tiles };
}

export function prepareCompanionReactionsMapData(mapData: BattleMapData): BattleMapData {
  let nextMap = mapData;
  for (const position of [
    COMPANION_REACTIONS_OWNER_START,
    COMPANION_REACTIONS_COMPANION_START,
    COMPANION_REACTIONS_SECOND_COMPANION_START,
    COMPANION_REACTIONS_ALLY_START,
    COMPANION_REACTIONS_ATTACKER_START,
  ]) {
    nextMap = updateTile(nextMap, position, tile => ({
      ...tile,
      terrain: 'sand',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      effects: ['companion-reaction-board-anchor'],
      environmentalEffects: [],
    }));
  }

  // Keep the authored sight corridor readable and unblocked until the explicit
  // wrong-sight case raises its Total Cover wall.
  for (let x = 5; x <= 11; x += 1) {
    for (let y = 4; y <= 6; y += 1) {
      nextMap = updateTile(nextMap, { x, y }, tile => ({
        ...tile,
        terrain: 'sand',
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
      }));
    }
  }
  return nextMap;
}

// ============================================================================
// Case Selection And Resolution
// ============================================================================
// Selecting a case starts from the authored baseline so previous damage or
// payment cannot leak into the next proof. The action then calls production.
// ============================================================================

function applyReactionCase(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const prepared = prepareCompanionReactionsCharacters(application.snapshot.characters);
  const found = findActors(prepared);
  if (!found) return { logMessage: 'Companion Reactions could not find all five authored actors.' };

  const choice = application.value as CompanionReactionCase;
  if (choice === 'multiple_responders') {
    found.secondCompanion = {
      ...found.secondCompanion,
      feats: Array.from(new Set([...(found.secondCompanion.feats ?? []), 'interception_style'])),
    };
  } else if (choice === 'out_of_range') {
    found.protectedAlly = { ...found.protectedAlly, position: { ...COMPANION_REACTIONS_ALLY_OUT_OF_RANGE } };
  } else if (choice === 'companion_incapacitated') {
    const incapacitate = (protector: CombatCharacter): CombatCharacter => ({
      ...protector,
      conditions: [...(protector.conditions ?? []), {
        name: 'Incapacitated',
        source: 'Companion Reactions case',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 0,
      }],
    });
    found.companion = incapacitate(found.companion);
    found.secondCompanion = incapacitate(found.secondCompanion);
  } else if (choice === 'companion_reaction_spent') {
    const spendReaction = (protector: CombatCharacter): CombatCharacter => ({
      ...protector,
      actionEconomy: {
        ...protector.actionEconomy,
        reaction: { used: true, remaining: 0 },
      },
    });
    found.companion = spendReaction(found.companion);
    found.secondCompanion = spendReaction(found.secondCompanion);
  } else if (choice === 'missing_equipment') {
    found.companion = { ...found.companion, equipment: {}, abilities: [] };
    found.secondCompanion = { ...found.secondCompanion, equipment: {}, abilities: [] };
  } else if (choice === 'missing_feature') {
    found.companion = {
      ...found.companion,
      feats: (found.companion.feats ?? []).filter(feat => feat !== 'interception_style'),
    };
    found.secondCompanion = {
      ...found.secondCompanion,
      feats: (found.secondCompanion.feats ?? []).filter(feat => feat !== 'interception_style'),
    };
  } else if (choice === 'nonqualifying_attack') {
    found.attacker = { ...found.attacker, team: 'player' };
  }

  let mapData = application.snapshot.mapData
    ? prepareCompanionReactionsMapData(application.snapshot.mapData)
    : undefined;
  if (choice === 'wrong_attacker_sight' && mapData) {
    for (let y = 0; y < mapData.dimensions.height; y += 1) {
      mapData = updateTile(mapData, { x: COMPANION_REACTIONS_SIGHT_WALL_X, y }, tile => ({
        ...tile,
        terrain: 'wall',
        movementCost: 0,
        blocksMovement: true,
        blocksLoS: true,
        effects: ['companion-reaction-total-cover'],
      }));
    }
  }

  return {
    characters: replaceActors(prepared, withAuditableNames(found)),
    mapData,
    logMessage: `Companion reaction case set to ${choice}. No attack, damage, or new Reaction payment has occurred.`,
  };
}

function resolveAttack(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = findActors(application.snapshot.characters);
  if (!found || !application.snapshot.mapData) {
    return { logMessage: 'Companion Reactions cannot resolve without all actors and the live map.' };
  }

  const scenarioCase = (application.snapshot.controlValues?.reaction_case
    ?? 'qualifying_attack') as CompanionReactionCase;
  const response = (application.snapshot.controlValues?.responder_choice
    ?? 'accept_primary') as CompanionReactionChoice;
  const selectedOptionId = response === 'decline'
    ? null
    : response === 'accept_secondary'
      ? `interception:${found.secondCompanion.id}`
      : `interception:${found.companion.id}`;
  const attack = {
    isHit: scenarioCase !== 'attack_missed',
    damage: scenarioCase === 'zero_damage' ? 0 : COMPANION_REACTIONS_INCOMING_DAMAGE,
    damageType: 'Slashing',
  };
  const hitEventId = 'cs38-normal-hit-001';
  const baseInput = {
    characters: application.snapshot.characters,
    turnOrder: application.snapshot.turnState?.turnOrder
      ?? application.snapshot.characters.map(character => character.id),
    mapData: application.snapshot.mapData,
    attacker: found.attacker,
    protectedTarget: found.protectedAlly,
    hitEventId,
    claimedEventIds: new Set<string>(),
    attack,
    // A fixed face 6 makes 1d10 + level-5 proficiency 3 reduce 14 to 5.
    reductionRng: () => 0.55,
  };
  const first = resolveAlliedProtectionReactionSelection(baseInput, selectedOptionId);

  // DamageCommand owns this same ordering: selected reduction first, then one
  // HP application. The duplicate case immediately re-delivers the stable id
  // against the first result and proves the claim makes the second delivery a
  // complete no-op.
  const charactersAfterFirstDamage = first.outcome === 'duplicate_event' || !attack.isHit
    ? first.characters
    : first.characters.map(character => (
        character.id === found.protectedAlly.id
          ? applyDamageAndCheckDowned(character, first.finalDamage)
          : character
      ));
  const replay = scenarioCase === 'duplicate_event'
    ? resolveAlliedProtectionReactionSelection({
        ...baseInput,
        characters: charactersAfterFirstDamage,
        claimedEventIds: new Set([getAlliedProtectionClaimId(hitEventId)]),
      }, selectedOptionId)
    : null;
  const finalWindow = replay ?? first;
  const finalCharacters = replay ? replay.characters : charactersAfterFirstDamage;
  const finalActors = findActors(finalCharacters);
  if (!finalActors) return { logMessage: 'Companion Reactions lost an authored actor during resolution.' };
  const actors = withAuditableNames(finalActors);
  const mapData = first.outcome === 'resolved'
    ? updateTile(application.snapshot.mapData, found.protectedAlly.position, tile => ({
        ...tile,
        environmentalEffects: [{
          id: 'companion-interception-impact',
          type: 'hazard',
          duration: 2,
          effect: {
            id: 'companion-interception-impact-status',
            name: 'Interception Protected',
            type: 'neutral',
            duration: 2,
            description: `${first.totalReduction} damage prevented; ${first.finalDamage} reached HP.`,
          },
        }],
      }))
    : application.snapshot.mapData;

  return {
    characters: replaceActors(finalCharacters, actors),
    mapData,
    logMessage: replay
      ? `FIRST ${first.outcome}: ${first.summary} REPLAY ${finalWindow.outcome}: ${finalWindow.summary}`
      : `${first.outcome.toUpperCase()}: ${first.summary}`,
  };
}

function startActorTurn(
  application: PreviewCombatScenarioControlApplication,
  actorId: string,
): PreviewCombatScenarioControlPatch {
  const found = findActors(application.snapshot.characters);
  if (!found) return { logMessage: 'Companion Reactions could not start the requested actor turn.' };

  const actor = application.snapshot.characters.find(character => character.id === actorId);
  if (!actor) return { logMessage: `Companion Reactions could not find turn actor ${actorId}.` };

  const resetActor = resetEconomy(actor);
  const characters = application.snapshot.characters.map(character => (
    character.id === actorId ? resetActor : character
  ));
  const renamed = findActors(characters);

  return {
    characters: renamed ? replaceActors(characters, withAuditableNames(renamed)) : characters,
    logMessage: `${resetActor.name.split(' · ')[0]}'s own turn starts: only that actor's Action, Bonus Action, Reaction, movement, and free interaction reset.`,
  };
}

// ============================================================================
// Visible Control Contract
// ============================================================================
// The native Reset Board control remains the full fixture reset. These four
// controls cover qualification, explicit decision/selection, stable delivery,
// and each actor's own turn-start scope.
// ============================================================================

export const companionReactionsScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'companion_reactions',
  controls: [
    {
      id: 'reaction_case',
      label: 'Reaction Case',
      description: 'Choose a qualifying hit, duplicate delivery, multi-responder case, or one exact rejection gate.',
      kind: 'select',
      defaultValue: 'qualifying_attack',
      options: [
        { value: 'qualifying_attack', label: 'Qualifying allied hit' },
        { value: 'multiple_responders', label: 'Two eligible responders' },
        { value: 'wrong_attacker_sight', label: 'Protector cannot see attacker' },
        { value: 'out_of_range', label: 'Ally beyond 5 ft' },
        { value: 'companion_incapacitated', label: 'Companion Incapacitated' },
        { value: 'companion_reaction_spent', label: 'Companion Reaction spent' },
        { value: 'missing_equipment', label: 'No weapon or shield' },
        { value: 'missing_feature', label: 'No Interception feature' },
        { value: 'attack_missed', label: 'Attack misses' },
        { value: 'zero_damage', label: 'Hit deals zero damage' },
        { value: 'duplicate_event', label: 'Replay same stable hit id' },
        { value: 'nonqualifying_attack', label: 'Non-hostile attacker' },
      ],
    },
    {
      id: 'responder_choice',
      label: 'Reaction Decision',
      description: 'Accept one exact ordered responder or decline without spending any Reaction.',
      kind: 'select',
      defaultValue: 'accept_primary',
      options: [
        { value: 'accept_primary', label: 'Accept Guardian Companion' },
        { value: 'accept_secondary', label: 'Accept Second Guardian' },
        { value: 'decline', label: 'Decline Interception' },
      ],
    },
    {
      id: 'resolve_attack',
      label: 'Deliver Normal Damage Hit',
      description: 'Run the production allied-responder window before applying this stable hit to HP.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'turn_reset_actor',
      label: 'Start Actor Turn',
      description: 'Start one actor’s own turn; only that actor’s independent economy resets.',
      kind: 'select',
      defaultValue: 'owner',
      options: [
        { value: 'owner', label: 'Start Owner turn' },
        { value: 'primary_companion', label: 'Start Guardian turn' },
        { value: 'secondary_companion', label: 'Start Second Guardian turn' },
      ],
    },
  ],
  applyControl(application) {
    if (application.controlId === 'reaction_case') return applyReactionCase(application);
    if (application.controlId === 'resolve_attack' && application.value === true) {
      return resolveAttack(application);
    }
    if (application.controlId === 'turn_reset_actor') {
      const actorId = application.value === 'primary_companion'
        ? COMPANION_REACTIONS_COMPANION_ID
        : application.value === 'secondary_companion'
          ? COMPANION_REACTIONS_SECOND_COMPANION_ID
          : COMPANION_REACTIONS_OWNER_ID;
      return startActorTurn(application, actorId);
    }
    return { logMessage: '' };
  },
};

export default companionReactionsScenarioControls;
