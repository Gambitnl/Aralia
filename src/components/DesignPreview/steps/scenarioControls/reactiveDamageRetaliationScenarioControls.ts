// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:00:45
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic controls for Reactive Damage & Retaliation.
 *
 * The board stages a resolved weapon hit against a Hellish Rebuke caster, then
 * delegates the complete damage-to-reaction transaction to the production
 * resolver. Selectors change real positions, walls, defenses, conditions, HP,
 * and action economy. The action reports the production receipt and replays the
 * same event id once to prove duplicate delivery cannot deal damage twice.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: the production reactive-damage resolver and shared combat state.
 */

import hellishRebukeData from '@/data/spells/level-1/hellish-rebuke.json';
import type { PlayerCharacter, SpellSlots } from '../../../../types';
import type { Ability, BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import {
  HELLISH_REBUKE_RANGE_FEET,
} from '../../../../systems/spells/mechanics/reactiveDamageRetaliationResolution';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// Re-export the canonical range for the mounted readout so the UI never keeps
// a second numeric copy of Hellish Rebuke's targeting limit.
export { HELLISH_REBUKE_RANGE_FEET };

// ============================================================================
// Stable Board Facts
// ============================================================================
// These ids and positions connect the control module to the two actors built by
// the mounted host. Spell range, damage dice, save, and cost remain canonical.
// ============================================================================

export const REACTIVE_DAMAGE_ATTACKER_ID = 'reactive_damage_retaliation-attacker';
export const REACTIVE_DAMAGE_RETALIATOR_ID = 'reactive_damage_retaliation-retaliator';
export const REACTIVE_DAMAGE_EVENT_ID = 'reactive_damage_retaliation-event-1';

export const REACTIVE_DAMAGE_RETALIATOR_START = { x: 2, y: 5 } as const;
export const REACTIVE_DAMAGE_ATTACKER_START = { x: 7, y: 5 } as const;
export const REACTIVE_DAMAGE_ATTACKER_OUT_OF_RANGE = { x: 15, y: 5 } as const;
export const REACTIVE_DAMAGE_SIGHT_BLOCKER = { x: 4, y: 5 } as const;

export const REACTIVE_DAMAGE_TRIGGER_AMOUNT = 8;
export const REACTIVE_DAMAGE_RETALIATOR_MAX_HP = 36;
export const REACTIVE_DAMAGE_ATTACKER_MAX_HP = 30;
export const REACTIVE_DAMAGE_FRAGILE_ATTACKER_HP = 10;

const RETALIATION_DAMAGE_FACE = 6;
const RETALIATION_SAVE_FACE = 5;
const RETALIATION_SUCCESSFUL_SAVE_FACE = 18;

const HELLISH_REBUKE = hellishRebukeData as unknown as Spell;

export const REACTIVE_DAMAGE_ATTACK: Ability = {
  id: 'reactive-damage-normal-attack',
  name: 'Infernal Test Strike',
  description: 'A normal mounted attack whose DamageCommand publishes the post-HP reaction event.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 30,
  isProficient: true,
  attackBonus: 8,
  attackType: 'weapon',
  effects: [{ type: 'damage', dice: '8d1', damageType: 'slashing' }],
};

export type ReactiveDamageTriggerCase =
  | 'qualifying_hit'
  | 'attack_missed'
  | 'no_triggering_damage'
  | 'out_of_range'
  | 'blocked_line_of_sight'
  | 'reaction_spent'
  | 'empty_spell_slot'
  | 'retaliator_incapacitated'
  | 'retaliator_downed_by_hit';

export type ReactiveDamageAttackerDefense = 'failed_save' | 'successful_save' | 'resistance' | 'immunity' | 'fragile';

interface ReactiveDamageActors {
  attacker: CombatCharacter;
  retaliator: CombatCharacter;
}

export function createReactiveDamageRetaliationSpellSlots(): SpellSlots {
  // The current shared SpellSlots contract requires all nine inventory rows.
  // Only level 1 is stocked for this board; empty rows prevent a hidden slot
  // fallback while keeping the production action ledger structurally complete.
  return {
    level_1: { current: 1, max: 1 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

// ============================================================================
// Actor And Map Preparation
// ============================================================================
// Selector changes rebuild only these two actors and the one sight wall. This
// makes each result independent while leaving every unrelated character, tile,
// condition, defense, and map record untouched.
// ============================================================================

function findActors(characters: CombatCharacter[]): ReactiveDamageActors | null {
  const attacker = characters.find(character => character.id === REACTIVE_DAMAGE_ATTACKER_ID);
  const retaliator = characters.find(character => character.id === REACTIVE_DAMAGE_RETALIATOR_ID);
  return attacker && retaliator ? { attacker, retaliator } : null;
}

function removeNamedCondition(
  character: CombatCharacter,
  names: readonly string[],
): CombatCharacter {
  const lowerNames = new Set(names.map(name => name.toLowerCase()));
  return {
    ...character,
    statusEffects: character.statusEffects.filter(effect => !lowerNames.has(effect.name.toLowerCase())),
    conditions: (character.conditions ?? []).filter(condition => !lowerNames.has(condition.name.toLowerCase())),
  };
}

function removeDamageType(
  values: CombatCharacter['resistances'],
  damageType: string,
) {
  return (values ?? []).filter(value => value.toLowerCase() !== damageType.toLowerCase());
}

function readLevelOneSlot(character: CombatCharacter): string {
  const slot = character.spellSlots?.level_1;
  return slot ? `${slot.current}/${slot.max}` : 'unavailable';
}

function attackerDefenseLabel(attacker: CombatCharacter): string {
  if (attacker.immunities?.some(value => value.toLowerCase() === 'fire')) return 'Fire immune';
  if (attacker.resistances?.some(value => value.toLowerCase() === 'fire')) return 'Fire resistant';
  if (attacker.maxHP === REACTIVE_DAMAGE_FRAGILE_ATTACKER_HP) return 'fragile';
  return 'no Fire defense';
}

function withAuditableNames(actors: ReactiveDamageActors): ReactiveDamageActors {
  const authoredAttackState = actors.attacker.name.includes('authored miss')
    ? ' · authored miss'
    : '';
  const retaliatorState = actors.retaliator.currentHP <= 0
    ? 'Down'
    : actors.retaliator.conditions?.some(condition => condition.name === 'Incapacitated')
      ? 'Incapacitated'
      : 'Active';
  const attackerState = actors.attacker.currentHP <= 0 ? 'Down' : attackerDefenseLabel(actors.attacker);

  return {
    attacker: {
      ...actors.attacker,
      name: `Blade Initiate · HP ${actors.attacker.currentHP}/${actors.attacker.maxHP} · ${attackerState}${authoredAttackState}`,
    },
    retaliator: {
      ...actors.retaliator,
      name: `Infernal Adept · HP ${actors.retaliator.currentHP}/${actors.retaliator.maxHP} · Reaction ${actors.retaliator.actionEconomy.reaction.used ? 'spent' : 'ready'} · L1 ${readLevelOneSlot(actors.retaliator)} · ${retaliatorState}`,
    },
  };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: ReactiveDamageActors,
): CombatCharacter[] {
  const replacementById = new Map<string, CombatCharacter>([
    [actors.attacker.id, actors.attacker],
    [actors.retaliator.id, actors.retaliator],
  ]);
  return characters.map(character => replacementById.get(character.id) ?? character);
}

export function prepareReactiveDamageRetaliationCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const found = findActors(characters);
  if (!found) return characters;

  // Reset only scenario-owned condition and defense facts. Other damage types
  // remain intact so this adapter never becomes a broad character scrubber.
  const cleanAttacker = removeNamedCondition(found.attacker, ['Unconscious', 'Incapacitated']);
  const cleanRetaliator = removeNamedCondition(found.retaliator, ['Unconscious', 'Incapacitated']);
  const attacker = resetEconomy({
    ...cleanAttacker,
    name: 'Blade Initiate',
    position: { ...REACTIVE_DAMAGE_ATTACKER_START },
    team: 'player',
    // WeaponAttackCommand reads the class ID for Sneak Attack eligibility.
    // Quick sandbox actors omit it, so the scenario supplies an ordinary
    // non-Rogue class rather than letting test setup crash before damage.
    class: { ...cleanAttacker.class, id: 'fighter' },
    currentHP: REACTIVE_DAMAGE_ATTACKER_MAX_HP,
    maxHP: REACTIVE_DAMAGE_ATTACKER_MAX_HP,
    resistances: removeDamageType(cleanAttacker.resistances, 'Fire'),
    immunities: removeDamageType(cleanAttacker.immunities, 'Fire'),
    vulnerabilities: removeDamageType(cleanAttacker.vulnerabilities, 'Fire'),
  });
  attacker.stats.dexterity = 10;
  attacker.savingThrowProficiencies = [];

  const retaliator = resetEconomy({
    ...cleanRetaliator,
    name: 'Infernal Adept',
    position: { ...REACTIVE_DAMAGE_RETALIATOR_START },
    team: 'enemy',
    level: 5,
    currentHP: REACTIVE_DAMAGE_RETALIATOR_MAX_HP,
    maxHP: REACTIVE_DAMAGE_RETALIATOR_MAX_HP,
    spellcastingAbility: 'charisma',
    spellSlots: createReactiveDamageRetaliationSpellSlots(),
    resistances: removeDamageType(cleanRetaliator.resistances, 'Slashing'),
    immunities: removeDamageType(cleanRetaliator.immunities, 'Slashing'),
  });
  retaliator.stats.charisma = 16;
  retaliator.abilities = [
    ...(retaliator.abilities ?? []).filter(ability => ability.spell?.id !== HELLISH_REBUKE.id),
    createAbilityFromSpell(HELLISH_REBUKE, retaliator as unknown as PlayerCharacter),
  ];

  return replaceActors(characters, withAuditableNames({ attacker, retaliator }));
}

function updateTile(
  mapData: BattleMapData,
  position: { x: number; y: number },
  update: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  const tileId = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(tileId);
  if (!tile) return mapData;

  const tiles = new Map(mapData.tiles);
  tiles.set(tileId, update(tile));
  return { ...mapData, tiles };
}

export function prepareReactiveDamageRetaliationMapData(
  mapData: BattleMapData,
): BattleMapData {
  // The central sight tile returns to an open reaction lane. A selector can
  // promote this exact tile to a real Total Cover wall before resolution.
  let prepared = updateTile(mapData, REACTIVE_DAMAGE_SIGHT_BLOCKER, tile => ({
    ...tile,
    terrain: 'sand',
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: ['reactive-damage-trigger-lane'],
    environmentalEffects: [],
  }));

  // Clear only scenario-owned result cues from every tile. Reset and selector
  // changes therefore remove old fire impacts without touching other effects.
  const tiles = new Map(prepared.tiles);
  for (const [tileId, tile] of tiles) {
    const effects = (tile.effects ?? []).filter(effect => (
      !effect.startsWith('reactive-damage-result-')
      && !effect.startsWith('reactive-damage-event-')
    ));
    const environmentalEffects = (tile.environmentalEffects ?? []).filter(
      effect => !effect.id.startsWith('reactive-damage-result-'),
    );
    tiles.set(tileId, { ...tile, effects, environmentalEffects });
  }
  prepared = { ...prepared, tiles };

  return prepared;
}

// ============================================================================
// Selector State Encoding
// ============================================================================
// Every choice is represented by real board state: position, wall, resistance,
// immunity, HP, condition, or Reaction ledger. The only authored event fact is
// hit versus miss, which remains visible in the attacker name and result log.
// ============================================================================

function inferTriggerCase(
  actors: ReactiveDamageActors,
  mapData: BattleMapData | null,
): ReactiveDamageTriggerCase {
  if (actors.attacker.name.includes('authored miss')) return 'attack_missed';
  if (actors.retaliator.immunities?.some(value => value.toLowerCase() === 'slashing')) return 'no_triggering_damage';
  if (actors.attacker.position.x === REACTIVE_DAMAGE_ATTACKER_OUT_OF_RANGE.x) return 'out_of_range';
  if (mapData?.tiles.get(`${REACTIVE_DAMAGE_SIGHT_BLOCKER.x}-${REACTIVE_DAMAGE_SIGHT_BLOCKER.y}`)?.blocksLoS) return 'blocked_line_of_sight';
  if (actors.retaliator.actionEconomy.reaction.used) return 'reaction_spent';
  if ((actors.retaliator.spellSlots?.level_1.current ?? 0) <= 0) return 'empty_spell_slot';
  if (actors.retaliator.conditions?.some(condition => condition.name === 'Incapacitated')) return 'retaliator_incapacitated';
  if (actors.retaliator.maxHP === 6) return 'retaliator_downed_by_hit';
  return 'qualifying_hit';
}

function inferAttackerDefense(attacker: CombatCharacter): ReactiveDamageAttackerDefense {
  if (attacker.immunities?.some(value => value.toLowerCase() === 'fire')) return 'immunity';
  if (attacker.resistances?.some(value => value.toLowerCase() === 'fire')) return 'resistance';
  if (attacker.maxHP === REACTIVE_DAMAGE_FRAGILE_ATTACKER_HP) return 'fragile';
  return 'failed_save';
}

function applyAttackerDefense(
  actors: ReactiveDamageActors,
  defense: ReactiveDamageAttackerDefense,
): ReactiveDamageActors {
  const attacker = {
    ...actors.attacker,
    currentHP: defense === 'fragile'
      ? REACTIVE_DAMAGE_FRAGILE_ATTACKER_HP
      : REACTIVE_DAMAGE_ATTACKER_MAX_HP,
    maxHP: defense === 'fragile'
      ? REACTIVE_DAMAGE_FRAGILE_ATTACKER_HP
      : REACTIVE_DAMAGE_ATTACKER_MAX_HP,
    resistances: defense === 'resistance'
      ? [...removeDamageType(actors.attacker.resistances, 'Fire'), 'Fire' as const]
      : removeDamageType(actors.attacker.resistances, 'Fire'),
    immunities: defense === 'immunity'
      ? [...removeDamageType(actors.attacker.immunities, 'Fire'), 'Fire' as const]
      : removeDamageType(actors.attacker.immunities, 'Fire'),
  };

  return withAuditableNames({ ...actors, attacker });
}

function applyTriggerCase(
  actors: ReactiveDamageActors,
  mapData: BattleMapData,
  triggerCase: ReactiveDamageTriggerCase,
): { actors: ReactiveDamageActors; mapData: BattleMapData } {
  let attacker = { ...actors.attacker };
  let retaliator = { ...actors.retaliator };
  let nextMap = mapData;

  if (triggerCase === 'attack_missed') {
    attacker = { ...attacker, name: `${attacker.name} · authored miss` };
  } else if (triggerCase === 'no_triggering_damage') {
    retaliator = {
      ...retaliator,
      immunities: [...removeDamageType(retaliator.immunities, 'Slashing'), 'Slashing'],
    };
  } else if (triggerCase === 'out_of_range') {
    attacker = { ...attacker, position: { ...REACTIVE_DAMAGE_ATTACKER_OUT_OF_RANGE } };
  } else if (triggerCase === 'blocked_line_of_sight') {
    nextMap = updateTile(nextMap, REACTIVE_DAMAGE_SIGHT_BLOCKER, tile => ({
      ...tile,
      terrain: 'wall',
      movementCost: 0,
      blocksMovement: true,
      blocksLoS: true,
      effects: ['reactive-damage-total-cover'],
    }));
  } else if (triggerCase === 'reaction_spent') {
    retaliator = {
      ...retaliator,
      actionEconomy: {
        ...retaliator.actionEconomy,
        reaction: { ...retaliator.actionEconomy.reaction, used: true },
      },
    };
  } else if (triggerCase === 'empty_spell_slot') {
    retaliator = {
      ...retaliator,
      spellSlots: {
        ...retaliator.spellSlots!,
        level_1: { current: 0, max: 1 },
      },
    };
  } else if (triggerCase === 'retaliator_incapacitated') {
    retaliator = {
      ...retaliator,
      conditions: [
        ...(retaliator.conditions ?? []),
        {
          name: 'Incapacitated',
          duration: { type: 'rounds', value: 1 },
          appliedTurn: 1,
          source: 'Reactive Damage scenario input',
        },
      ],
    };
  } else if (triggerCase === 'retaliator_downed_by_hit') {
    retaliator = {
      ...retaliator,
      currentHP: 6,
      maxHP: 6,
    };
  }

  return {
    actors: withAuditableNames({ attacker, retaliator }),
    mapData: nextMap,
  };
}

// ============================================================================
// Mounted Production Transaction Requests
// ============================================================================
// The adapter chooses only deterministic inputs. useAbilitySystem runs the
// ordinary attack command, DamageCommand owns HP, and the post-damage queue
// opens the real ReactionPrompt before resolving Hellish Rebuke.
// ============================================================================

function fixedDie(face: number, sides: number): () => number {
  return () => (face - 0.5) / sides;
}

function resolveExchange(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = findActors(application.snapshot.characters);
  const mapData = application.snapshot.mapData;
  if (!found || !mapData) {
    return { logMessage: 'Reactive damage proof skipped because its two actors or board are unavailable.' };
  }

  const triggerCase = inferTriggerCase(found, mapData);
  const retaliationOutcome = String(
    application.snapshot.controlValues?.attacker_defense ?? inferAttackerDefense(found.attacker),
  ) as ReactiveDamageAttackerDefense;
  const attackRoll = triggerCase === 'attack_missed' ? 1 : 15;
  const saveRoll = retaliationOutcome === 'successful_save'
    ? RETALIATION_SUCCESSFUL_SAVE_FACE
    : RETALIATION_SAVE_FACE;

  return {
    abilityExecution: {
      ability: REACTIVE_DAMAGE_ATTACK,
      casterId: found.attacker.id,
      targetId: found.retaliator.id,
      attackRollRng: fixedDie(attackRoll, 20),
      // 8d1 always produces the authored triggering 8. The same source rolls
      // each Rebuke d10 as 6, making canonical 2d10 exactly 12.
      damageRng: fixedDie(RETALIATION_DAMAGE_FACE, 10),
      saveRng: fixedDie(saveRoll, 20),
    },
    logMessage: '',
  };
}

function replayLatestEvent(): PreviewCombatScenarioControlPatch {
  // The host finds the actual DamageCommand log entry and redelivers it through
  // useAbilitySystem. The production claimed-ID set owns the resulting no-op.
  return { replayLatestPostDamageEvent: true, logMessage: '' };
}

function updateTriggerCase(
  application: PreviewCombatScenarioControlApplication,
  triggerCase: ReactiveDamageTriggerCase,
): PreviewCombatScenarioControlPatch {
  const currentActors = findActors(application.snapshot.characters);
  const mapData = application.snapshot.mapData;
  if (!currentActors || !mapData) {
    return { logMessage: 'Reactive damage input skipped because its actors or board are unavailable.' };
  }

  const defense = inferAttackerDefense(currentActors.attacker);
  const preparedCharacters = prepareReactiveDamageRetaliationCharacters(application.snapshot.characters);
  const preparedActors = findActors(preparedCharacters);
  if (!preparedActors) {
    return { logMessage: 'Reactive damage input skipped because its reset actors are unavailable.' };
  }

  const defendedActors = applyAttackerDefense(preparedActors, defense);
  const applied = applyTriggerCase(
    defendedActors,
    prepareReactiveDamageRetaliationMapData(mapData),
    triggerCase,
  );
  const distanceFeet = Math.max(
    Math.abs(applied.actors.attacker.position.x - applied.actors.retaliator.position.x),
    Math.abs(applied.actors.attacker.position.y - applied.actors.retaliator.position.y),
  ) * 5;

  return {
    characters: replaceActors(preparedCharacters, applied.actors),
    mapData: applied.mapData,
    logMessage: `INPUT READY: ${triggerCase.replaceAll('_', ' ')}. Distance ${distanceFeet}/${HELLISH_REBUKE_RANGE_FEET} ft; Reaction ${applied.actors.retaliator.actionEconomy.reaction.used ? 'spent' : 'ready'}; resolve to test payment and effect.`,
  };
}

function updateAttackerDefense(
  application: PreviewCombatScenarioControlApplication,
  defense: ReactiveDamageAttackerDefense,
): PreviewCombatScenarioControlPatch {
  const currentActors = findActors(application.snapshot.characters);
  const mapData = application.snapshot.mapData;
  if (!currentActors || !mapData) {
    return { logMessage: 'Reactive damage defense skipped because its actors or board are unavailable.' };
  }

  const triggerCase = inferTriggerCase(currentActors, mapData);
  const preparedCharacters = prepareReactiveDamageRetaliationCharacters(application.snapshot.characters);
  const preparedActors = findActors(preparedCharacters);
  if (!preparedActors) {
    return { logMessage: 'Reactive damage defense skipped because its reset actors are unavailable.' };
  }

  const defendedActors = applyAttackerDefense(preparedActors, defense);
  const applied = applyTriggerCase(
    defendedActors,
    prepareReactiveDamageRetaliationMapData(mapData),
    triggerCase,
  );

  return {
    characters: replaceActors(preparedCharacters, applied.actors),
    mapData: applied.mapData,
    logMessage: `DEFENSE READY: ${defense}. Hellish Rebuke still resolves save first, then the shared Fire defense pipeline.`,
  };
}

// ============================================================================
// Registered Controls
// ============================================================================
// Two selectors choose the event and save/defense facts. Resolve Attack opens
// the real accept/decline modal; Replay proves stable IDs across invocations.
// ============================================================================

const reactiveDamageRetaliationScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'reactive_damage_retaliation',
  controls: [
    {
      id: 'trigger_case',
      label: 'Trigger Case',
      description: 'Choose the resolved attack/damage, range, sight, Reaction, or retaliator-state boundary.',
      kind: 'select',
      defaultValue: 'qualifying_hit',
      options: [
        { value: 'qualifying_hit', label: 'Qualifying Hit' },
        { value: 'attack_missed', label: 'Attack Missed' },
        { value: 'no_triggering_damage', label: 'No Damage Taken' },
        { value: 'out_of_range', label: 'Beyond 60 ft' },
        { value: 'blocked_line_of_sight', label: 'Total Cover' },
        { value: 'reaction_spent', label: 'Reaction Spent' },
        { value: 'empty_spell_slot', label: 'Empty Level-1 Slot' },
        { value: 'retaliator_incapacitated', label: 'Incapacitated' },
        { value: 'retaliator_downed_by_hit', label: 'Hit Downs Retaliator' },
      ],
    },
    {
      id: 'attacker_defense',
      label: 'Retaliation Result',
      description: 'Choose failed or successful Dexterity save, Fire defense, or fragile HP for attacker downing.',
      kind: 'select',
      defaultValue: 'failed_save',
      options: [
        { value: 'failed_save', label: 'Failed Save / Full' },
        { value: 'successful_save', label: 'Successful Save / Half' },
        { value: 'resistance', label: 'Fire Resistance' },
        { value: 'immunity', label: 'Fire Immunity' },
        { value: 'fragile', label: 'Fragile 10 HP' },
      ],
    },
    {
      id: 'resolve_exchange',
      label: 'Resolve Attack',
      description: 'Run the normal attack/damage path; accept or decline in the canonical reaction modal.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay_event',
      label: 'Replay Stable Event',
      description: 'Redeliver the latest post-HP log ID; it must be a no-op with no prompt or spending.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: application => {
    if (application.controlId === 'trigger_case') {
      return updateTriggerCase(application, String(application.value) as ReactiveDamageTriggerCase);
    }
    if (application.controlId === 'attacker_defense') {
      return updateAttackerDefense(application, String(application.value) as ReactiveDamageAttackerDefense);
    }
    if (application.controlId === 'resolve_exchange' && application.value === true) {
      return resolveExchange(application);
    }
    if (application.controlId === 'replay_event' && application.value === true) {
      return replayLatestEvent();
    }

    return { logMessage: '' };
  },
};

export default reactiveDamageRetaliationScenarioControls;
