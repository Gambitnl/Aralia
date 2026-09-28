// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 01:22:49
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
 * This file owns the deterministic Sustain Actions & Ongoing Control board.
 *
 * It prepares a visible Witch Bolt controller and affected target, then asks
 * the production Witch Bolt resolver to cast, activate, skip, or end the arc.
 * Character HP, Action and Bonus Action ledgers, concentration, owner-linked
 * status and active effects, map range/cover, and cleanup are the only truth.
 * The controls merely choose an auditable input and narrate the returned state.
 *
 * Called by: the Tactical Sandbox control registry and scenario host.
 * Depends on: canonical Witch Bolt and Mage Armor data plus live combat state.
 */

import mageArmorData from '@/data/spells/level-1/mage-armor.json';
import type { CombatCharacter } from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import {
  establishWitchBoltLink,
  resolveWitchBoltInitialCast,
  resolveWitchBoltLaterTurn,
  WITCH_BOLT_DURATION_ROUNDS,
  WITCH_BOLT_RANGE_FEET,
  type WitchBoltReason,
  type WitchBoltResolution,
} from '../../../../systems/spells/mechanics/witchBoltOngoingResolution';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Board Facts
// ============================================================================
// The actors begin 30 feet apart on a straight lightning lane. The reset board
// shows the established arc at the start of the first later turn: the initial
// Action/slot have been paid, HP reflects 2d12, and the Bonus Action is ready.
// ============================================================================

const MAGE_ARMOR = mageArmorData as unknown as Spell;

export const SUSTAIN_ACTIONS_CASTER_ID = 'sustain_actions_ongoing_control-caster';
export const SUSTAIN_ACTIONS_TARGET_ID = 'sustain_actions_ongoing_control-target';
export const SUSTAIN_ACTIONS_CASTER_START = { x: 3, y: 5 } as const;
export const SUSTAIN_ACTIONS_TARGET_START = { x: 9, y: 5 } as const;
export const SUSTAIN_ACTIONS_TOTAL_COVER_TILE = { x: 6, y: 5 } as const;
export const SUSTAIN_ACTIONS_OUT_OF_RANGE_CASTER = { x: 2, y: 5 } as const;
export const SUSTAIN_ACTIONS_OUT_OF_RANGE_TARGET = { x: 15, y: 5 } as const;

export const SUSTAIN_ACTIONS_STARTED_TURN = 3;
export const SUSTAIN_ACTIONS_LATER_TURN = 4;
export const SUSTAIN_ACTIONS_TARGET_MAX_HP = 60;
export const SUSTAIN_ACTIONS_INITIAL_DAMAGE = 12;
export const SUSTAIN_ACTIONS_REPEAT_DAMAGE = 6;
export const SUSTAIN_ACTIONS_LINKED_HP = (
  SUSTAIN_ACTIONS_TARGET_MAX_HP - SUSTAIN_ACTIONS_INITIAL_DAMAGE
);

const FIXED_ATTACK_D20 = 15;
const BREAK_CONTROL_ID = 'arc-break-condition';

type ArcBreakChoice =
  | 'clear'
  | 'out_of_range'
  | 'total_cover'
  | 'concentration_lost'
  | 'duration_expired';

interface SustainActionsActors {
  caster: CombatCharacter;
  target: CombatCharacter;
}

// ============================================================================
// Repeatable Actor Construction
// ============================================================================
// Each proof starts from the same canonical linked baseline. Rebuilding only
// these two actors makes buttons independently comparable and preserves every
// unrelated bystander supplied by the mounted host or a focused test.
// ============================================================================

function requireActors(characters: CombatCharacter[]): SustainActionsActors | null {
  const caster = characters.find(character => character.id === SUSTAIN_ACTIONS_CASTER_ID);
  const target = characters.find(character => character.id === SUSTAIN_ACTIONS_TARGET_ID);
  return caster && target ? { caster, target } : null;
}

function createMageArmorEffect(targetId: string) {
  return {
    id: 'sustain-actions-unrelated-mage-armor',
    spellId: MAGE_ARMOR.id,
    casterId: targetId,
    sourceName: MAGE_ARMOR.name,
    type: 'buff' as const,
    duration: MAGE_ARMOR.duration,
    startTime: 0,
    mechanics: { baseAC: 13, baseACFormula: '13 + Dexterity modifier' },
  };
}

function prepareUnlinkedActors(actors: SustainActionsActors): SustainActionsActors {
  const caster = resetEconomy({
    ...actors.caster,
    name: 'Storm Binder · INT +4 · L1 1/1 · Action ready',
    level: 5,
    position: { ...SUSTAIN_ACTIONS_CASTER_START },
    team: 'player',
    spellcastingAbility: 'intelligence',
    stats: { ...actors.caster.stats, intelligence: 18, baseInitiative: 20 },
    spellSlots: { level_1: { current: 1, max: 1 } },
    abilities: [],
    statusEffects: [],
    conditions: [],
    activeEffects: [],
    concentratingOn: undefined,
  });
  const target: CombatCharacter = {
    ...actors.target,
    name: 'Arc Target · 60/60 HP · Mage Armor',
    position: { ...SUSTAIN_ACTIONS_TARGET_START },
    team: 'enemy',
    currentHP: SUSTAIN_ACTIONS_TARGET_MAX_HP,
    maxHP: SUSTAIN_ACTIONS_TARGET_MAX_HP,
    tempHP: 0,
    armorClass: 15,
    baseAC: 15,
    abilities: [],
    statusEffects: [],
    conditions: [],
    activeEffects: [createMageArmorEffect(actors.target.id)],
    damagedThisTurn: false,
  };

  return { caster, target };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: SustainActionsActors,
): CombatCharacter[] {
  const replacementById = new Map<string, CombatCharacter>([
    [actors.caster.id, actors.caster],
    [actors.target.id, actors.target],
  ]);
  return characters.map(character => replacementById.get(character.id) ?? character);
}

function arcIsLinked(target: CombatCharacter): boolean {
  return target.statusEffects.some(effect => effect.sourceSpellId === 'witch-bolt')
    || (target.activeEffects ?? []).some(effect => effect.spellId === 'witch-bolt');
}

function mageArmorIsKept(target: CombatCharacter): boolean {
  return (target.activeEffects ?? []).some(effect => effect.spellId === MAGE_ARMOR.id);
}

function decorateCharacters(
  characters: CombatCharacter[],
  remainingRounds = WITCH_BOLT_DURATION_ROUNDS - 1,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === SUSTAIN_ACTIONS_CASTER_ID) {
      const arcState = character.concentratingOn?.spellId === 'witch-bolt'
        ? `Arc linked · ${remainingRounds} rounds`
        : 'Arc ended';
      const actionState = character.actionEconomy.action.used ? 'Action spent' : 'Action ready';
      const bonusState = character.actionEconomy.bonusAction.used ? 'BA spent' : 'BA ready';
      const slot = character.spellSlots?.level_1;
      return {
        ...character,
        name: `Storm Binder · ${arcState} · ${actionState} · ${bonusState} · L1 ${slot?.current ?? 0}/${slot?.max ?? 0}`,
      };
    }

    if (character.id === SUSTAIN_ACTIONS_TARGET_ID) {
      const arcState = arcIsLinked(character) ? 'Arc linked' : 'Arc ended';
      const armorState = mageArmorIsKept(character) ? 'Mage Armor kept' : 'Mage Armor missing';
      return {
        ...character,
        name: `Arc Target · ${character.currentHP}/${character.maxHP} HP · ${arcState} · ${armorState}`,
      };
    }

    return character;
  });
}

function prepareLinkedCharacters(characters: CombatCharacter[]): CombatCharacter[] {
  const found = requireActors(characters);
  if (!found) return characters;

  const unlinked = prepareUnlinkedActors(found);
  const laterTurnCaster = resetEconomy({
    ...unlinked.caster,
    spellSlots: { level_1: { current: 0, max: 1 } },
  });
  const damagedTarget = {
    ...unlinked.target,
    currentHP: SUSTAIN_ACTIONS_LINKED_HP,
    damagedThisTurn: false,
  };
  const replaced = replaceActors(characters, {
    caster: laterTurnCaster,
    target: damagedTarget,
  });
  const linked = establishWitchBoltLink({
    characters: replaced,
    casterId: SUSTAIN_ACTIONS_CASTER_ID,
    targetId: SUSTAIN_ACTIONS_TARGET_ID,
    startedTurn: SUSTAIN_ACTIONS_STARTED_TURN,
  });

  return decorateCharacters(linked);
}

/**
 * Seeds the mounted 2D/3D board with the live later-turn Witch Bolt link.
 * Reset Board calls this same initializer, so it restores HP, concentration,
 * status, duration, spell inventory, positions, and both action ledgers.
 */
export function prepareSustainActionsOngoingControlCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return prepareLinkedCharacters(characters);
}

// ============================================================================
// Deterministic Canonical Dice
// ============================================================================
// A fixed d12 face keeps the initial 2d12 and repeat 1d12 results readable while
// still exercising the shared dice parser in the production resolver.
// ============================================================================

function fixedD12(face: number): () => number {
  return () => (face - 0.5) / 12;
}

// ============================================================================
// Initial Cast, Activate, And Skip Controls
// ============================================================================
// These controls rebuild only the two authored actors, then delegate all rule
// truth to the spell resolver. No label or log entry decides the outcome.
// ============================================================================

function castAndLink(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application.snapshot.characters);
  if (!found || !application.snapshot.mapData) {
    return { logMessage: 'Witch Bolt cast skipped because its actors or battle map are unavailable.' };
  }

  const unlinked = prepareUnlinkedActors(found);
  const baseline = replaceActors(application.snapshot.characters, unlinked);
  const result = resolveWitchBoltInitialCast({
    characters: baseline,
    mapData: application.snapshot.mapData,
    casterId: SUSTAIN_ACTIONS_CASTER_ID,
    targetId: SUSTAIN_ACTIONS_TARGET_ID,
    startedTurn: SUSTAIN_ACTIONS_STARTED_TURN,
    d20Roll: FIXED_ATTACK_D20,
    damageRng: fixedD12(6),
  });
  const characters = decorateCharacters(result.characters, WITCH_BOLT_DURATION_ROUNDS);
  const caster = requireActors(characters)?.caster;
  const target = requireActors(characters)?.target;

  return {
    characters,
    logMessage: result.outcome === 'established'
      ? `Witch Bolt initial Action: d20 ${FIXED_ATTACK_D20} + ${result.attack ? result.attack.total - FIXED_ATTACK_D20 : '?'} = ${result.attack?.total} hits; canonical 2d12 = ${result.damage} Lightning, target ${SUSTAIN_ACTIONS_TARGET_MAX_HP} → ${target?.currentHP} HP. Action and L1 slot spent; concentration owns the visible arc for ${result.remainingRounds} rounds; Bonus Action remains ready.`
      : `Witch Bolt initial cast rejected (${result.reason.replace(/_/g, ' ')}). ${caster?.name ?? 'Caster unavailable'}; no arc established.`,
  };
}

function resolveLaterTurnChoice(
  application: PreviewCombatScenarioControlApplication,
  choice: 'activate' | 'skip',
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Witch Bolt later turn skipped because no battle map is loaded.' };
  }

  const baseline = prepareLinkedCharacters(application.snapshot.characters);
  const result = resolveWitchBoltLaterTurn({
    characters: baseline,
    mapData: application.snapshot.mapData,
    casterId: SUSTAIN_ACTIONS_CASTER_ID,
    targetId: SUSTAIN_ACTIONS_TARGET_ID,
    currentTurn: SUSTAIN_ACTIONS_LATER_TURN,
    choice,
    damageRng: fixedD12(6),
  });
  const characters = decorateCharacters(
    result.characters,
    result.remainingRounds ?? WITCH_BOLT_DURATION_ROUNDS - 1,
  );
  const target = requireActors(characters)?.target;

  if (result.reason === 'repeat_damage') {
    return {
      characters,
      logMessage: `Later turn: Bonus Action spent; Witch Bolt automatically deals canonical 1d12 = ${result.damage} Lightning with no new attack roll. Target ${SUSTAIN_ACTIONS_LINKED_HP} → ${target?.currentHP} HP; Action remains ready; concentration and the ${result.remainingRounds}-round arc stay linked.`,
    };
  }

  return {
    characters,
    logMessage: `Later turn: optional Witch Bolt Bonus Action skipped. No action resource or HP changed; the target remains ${target?.currentHP}/${target?.maxHP} HP and the linked arc continues with ${result.remainingRounds} rounds because skipping is not an ending condition.`,
  };
}

// ============================================================================
// Break-Condition Selector
// ============================================================================
// One selector independently proves every canonical maintenance boundary. It
// changes live position, map cover, concentration, or elapsed turn state, then
// asks the same later-turn resolver to evaluate and clean the arc.
// ============================================================================

function withTotalCover(
  application: PreviewCombatScenarioControlApplication,
  blocksLoS: boolean,
) {
  const mapData = application.snapshot.mapData;
  if (!mapData) return null;

  const tileId = `${SUSTAIN_ACTIONS_TOTAL_COVER_TILE.x}-${SUSTAIN_ACTIONS_TOTAL_COVER_TILE.y}`;
  const tile = mapData.tiles.get(tileId);
  if (!tile) return null;

  const tiles = new Map(mapData.tiles);
  tiles.set(tileId, {
    ...tile,
    terrain: blocksLoS ? 'wall' : 'rock',
    movementCost: blocksLoS ? 0 : 5,
    blocksMovement: blocksLoS,
    blocksLoS,
    decoration: blocksLoS ? 'high_wall' : null,
    effects: blocksLoS ? ['witch-bolt-total-cover'] : ['witch-bolt-arc-link'],
  });
  return { ...mapData, tiles };
}

function breakReasonText(reason: WitchBoltReason): string {
  const textByReason: Partial<Record<WitchBoltReason, string>> = {
    target_out_of_range: `target moved to 65 feet, beyond the canonical ${WITCH_BOLT_RANGE_FEET}-foot range`,
    target_has_total_cover: 'a wall granted Total Cover and broke line of sight',
    concentration_lost: 'the caster lost concentration',
    duration_expired: `the one-minute (${WITCH_BOLT_DURATION_ROUNDS}-round) duration expired`,
  };
  return textByReason[reason] ?? reason.replace(/_/g, ' ');
}

function cleanupSummary(result: WitchBoltResolution): string {
  return `${result.cleanup.statusEffects} visible status, ${result.cleanup.activeEffects} active effect, and ${result.cleanup.concentrationLinks} concentration link removed`;
}

function applyBreakCondition(
  application: PreviewCombatScenarioControlApplication,
  choice: ArcBreakChoice,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Witch Bolt break check skipped because no battle map is loaded.' };
  }

  let characters = prepareLinkedCharacters(application.snapshot.characters);
  let currentTurn = SUSTAIN_ACTIONS_LATER_TURN;
  const mapData = withTotalCover(application, choice === 'total_cover')
    ?? application.snapshot.mapData;

  if (choice === 'out_of_range') {
    characters = characters.map(character => {
      if (character.id === SUSTAIN_ACTIONS_CASTER_ID) {
        return { ...character, position: { ...SUSTAIN_ACTIONS_OUT_OF_RANGE_CASTER } };
      }
      if (character.id === SUSTAIN_ACTIONS_TARGET_ID) {
        return { ...character, position: { ...SUSTAIN_ACTIONS_OUT_OF_RANGE_TARGET } };
      }
      return character;
    });
  }

  if (choice === 'concentration_lost') {
    characters = characters.map(character => (
      character.id === SUSTAIN_ACTIONS_CASTER_ID
        ? { ...character, concentratingOn: undefined }
        : character
    ));
  }

  if (choice === 'duration_expired') {
    currentTurn = SUSTAIN_ACTIONS_STARTED_TURN + WITCH_BOLT_DURATION_ROUNDS;
  }

  const result = resolveWitchBoltLaterTurn({
    characters,
    mapData,
    casterId: SUSTAIN_ACTIONS_CASTER_ID,
    targetId: SUSTAIN_ACTIONS_TARGET_ID,
    currentTurn,
    choice: 'skip',
  });
  const decorated = decorateCharacters(
    result.characters,
    result.remainingRounds ?? 0,
  );

  if (choice === 'clear') {
    return {
      characters: decorated,
      mapData,
      logMessage: `Arc check clear: target is 30 feet away with open line of sight, concentration active, and ${result.remainingRounds} rounds remaining. Optional Bonus Action was skipped, so Witch Bolt stays linked and Mage Armor remains unrelated.`,
    };
  }

  return {
    characters: decorated,
    mapData,
    logMessage: `Witch Bolt ends before repeat damage or Bonus Action payment because ${breakReasonText(result.reason)}. ${cleanupSummary(result)}; unrelated ${MAGE_ARMOR.name} remains on the target.`,
  };
}

// ============================================================================
// Control Dispatch And Registration
// ============================================================================
// Three actions cover establishment, later-turn activation, and optional skip.
// One selector covers the four independent ending conditions plus clear reset.
// ============================================================================

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === BREAK_CONTROL_ID) {
    const choice = String(application.value) as ArcBreakChoice;
    const allowed: ArcBreakChoice[] = [
      'clear',
      'out_of_range',
      'total_cover',
      'concentration_lost',
      'duration_expired',
    ];
    return allowed.includes(choice)
      ? applyBreakCondition(application, choice)
      : { logMessage: `Unknown Witch Bolt arc break condition: ${choice}.` };
  }

  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Sustain Actions control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'cast-and-link') return castAndLink(application);
  if (application.controlId === 'activate-next-turn') {
    return resolveLaterTurnChoice(application, 'activate');
  }
  if (application.controlId === 'skip-next-turn') {
    return resolveLaterTurnChoice(application, 'skip');
  }

  return { logMessage: `Unknown Sustain Actions & Ongoing Control: ${application.controlId}.` };
}

const sustainActionsOngoingControlScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'sustain_actions_ongoing_control',
  controls: [
    {
      id: 'cast-and-link',
      label: 'Cast Witch Bolt · link arc',
      description: 'Pay the initial Action and level-1 slot, resolve 2d12, and establish concentration-owned ongoing control.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'activate-next-turn',
      label: 'Next turn · Bonus Action',
      description: 'Spend the canonical later-turn Bonus Action for automatic 1d12 Lightning damage.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'skip-next-turn',
      label: 'Next turn · skip sustain',
      description: 'Skip the optional Bonus Action: deal no damage, spend nothing, and keep the arc linked.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: BREAK_CONTROL_ID,
      label: 'Arc maintenance boundary',
      description: 'Compare clear range/LOS with range breach, Total Cover, concentration loss, or duration expiry.',
      kind: 'select',
      defaultValue: 'clear',
      options: [
        { value: 'clear', label: 'Clear · arc continues' },
        { value: 'out_of_range', label: '65 ft · arc ends' },
        { value: 'total_cover', label: 'Total Cover · arc ends' },
        { value: 'concentration_lost', label: 'Concentration lost · ends' },
        { value: 'duration_expired', label: '1 minute elapsed · ends' },
      ],
    },
  ],
  applyControl,
};

export default sustainActionsOngoingControlScenarioControls;
