/**
 * This file turns raw action results into rich narrative stories and game log events.
 *
 * When characters swing swords, cast spells, drink potions, or make skill checks, the game
 * calculates numbers and status changes. This file translates those raw mechanical results
 * (like critical hits, fumbles, partial saves, or healing surges) into immersive plain-English
 * prose. It also formats these events for both the tactical Combat Log and the permanent
 * Adventure Journal.
 *
 * Called by: useGameActions, combat executors, and event listeners.
 * Depends on: combat types, journal event definitions, and core ID generation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:29
 * Dependents: systems/actions/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  CombatLogEntryInput,
  CombatLogType
} from '../../types/combat';
import type { DamageType } from '../../types/spells';
import {
  JournalEvent,
  JournalEventType
} from '../../types/journal';
import { generateId } from '../../utils/core';

// ============================================================================
// Outcome Qualities & Data Contracts
// ============================================================================
// These types define the tiers of success or failure for an action, along with
// the structured payload containing actors, targets, damage, and context.
// ============================================================================

export type ActionOutcomeQuality =
  | 'critical_success'
  | 'success'
  | 'partial_success'
  | 'failure'
  | 'fumble';

export type ActionCategory =
  | 'attack'
  | 'spell'
  | 'heal'
  | 'skill_check'
  | 'item_use'
  | 'social'
  | 'exploration'
  | 'utility';

export interface ActionOutcomeDetails {
  /** Numerical roll or total score achieved (e.g. d20 roll + modifiers). */
  roll?: number;
  /** Target Difficulty Class (DC) or Armor Class (AC) tested against. */
  targetDC?: number;
  /** Amount of damage dealt, if applicable. */
  damage?: number;
  /** Type of damage inflicted (fire, slashing, radiant, etc.). */
  damageType?: DamageType | string;
  /** Amount of hit points restored, if applicable. */
  healing?: number;
  /** Name of status condition applied or removed (e.g. 'Stunned', 'Blessed'). */
  statusEffect?: string;
  /** Whether the target successfully passed a saving throw. */
  savePassed?: boolean;
  /** Specific tactical notes (e.g. 'knocked prone', 'disarmed', 'shield deflected'). */
  tacticalNote?: string;
}

export interface ActionOutcomePayload {
  /** Category of action being logged. */
  category: ActionCategory;
  /** Name of the action, spell, or item (e.g. 'Fireball', 'Longsword Strike'). */
  actionName: string;
  /** Quality tier of the outcome. */
  quality: ActionOutcomeQuality;
  /** Name and ID of the character performing the action. */
  actor: {
    id: string;
    name: string;
    classTitle?: string;
    isPlayer?: boolean;
  };
  /** Name and ID of the target(s) affected, if applicable. */
  target?: {
    id: string;
    name: string;
    isEnemy?: boolean;
  };
  /** Additional target IDs when multiple entities are affected (e.g. AoE spells). */
  additionalTargetIds?: string[];
  /** Detailed mechanical outcomes (damage, healing, rolls, etc.). */
  details?: ActionOutcomeDetails;
  /** Optional custom narrative override provided directly by the caller. */
  customNarrative?: string;
}

export interface ActionJournalContext {
  gameTime?: string;
  locationId?: string;
  questId?: string;
  xpGained?: number;
  goldChange?: number;
  itemIds?: string[];
}

// ============================================================================
// Narrative Templates & Prose Generators
// ============================================================================
// Plain-English sentence constructors tailored to the action category and
// quality tier. These produce immersive descriptions for the player.
// ============================================================================

// Generates prose for martial and weapon attacks
function generateAttackNarrative(payload: ActionOutcomePayload): string {
  const { actor, target, quality, details } = payload;
  const targetName = target?.name || 'the enemy';
  const dmg = details?.damage ? ` for ${details.damage} ${details.damageType || 'physical'} damage` : '';

  switch (quality) {
    case 'critical_success':
      return `With lethal precision, ${actor.name} lands a devastating critical blow upon ${targetName}${dmg}!`;
    case 'success':
      return `${actor.name} strikes ${targetName} cleanly with ${payload.actionName}${dmg}.`;
    case 'partial_success':
      return `${actor.name}'s attack grazes ${targetName}${dmg}, glancing off armor.`;
    case 'failure':
      return `${actor.name} swings ${payload.actionName} at ${targetName}, but misses as the target evades.`;
    case 'fumble':
      return `${actor.name} fumbles their attack with ${payload.actionName}, leaving themselves momentarily off-balance!`;
  }
}

// Generates prose for magical spells and rituals
function generateSpellNarrative(payload: ActionOutcomePayload): string {
  const { actor, target, quality, details, actionName } = payload;
  const targetName = target?.name || 'the area';
  const dmg = details?.damage ? ` dealing ${details.damage} ${details.damageType || 'magical'} damage` : '';
  const status = details?.statusEffect ? ` applying the ${details.statusEffect} condition` : '';

  switch (quality) {
    case 'critical_success':
      return `Arcane energies surge as ${actor.name} unleashes an empowered ${actionName} upon ${targetName}${dmg}${status}!`;
    case 'success':
      return `${actor.name} casts ${actionName} on ${targetName}${dmg}${status}.`;
    case 'partial_success':
      return `${actor.name}'s ${actionName} envelops ${targetName}, though they partially resist its full force${dmg}.`;
    case 'failure':
      return `${actor.name} channels ${actionName}, but ${targetName} completely resists or avoids the magical weave.`;
    case 'fumble':
      return `${actor.name}'s casting of ${actionName} sputters as the arcane matrix collapses!`;
  }
}

// Generates prose for healing abilities and curative potions
function generateHealNarrative(payload: ActionOutcomePayload): string {
  const { actor, target, quality, details, actionName } = payload;
  const targetName = target ? (target.id === actor.id ? 'themselves' : target.name) : 'their ally';
  const healAmount = details?.healing ? `${details.healing} HP` : 'vitality';

  switch (quality) {
    case 'critical_success':
      return `A radiant burst of divine energy flows from ${actor.name}, restoring a massive ${healAmount} to ${targetName}!`;
    case 'success':
      return `${actor.name} uses ${actionName}, restoring ${healAmount} to ${targetName}.`;
    case 'partial_success':
      return `${actor.name}'s ${actionName} provides minimal relief, restoring ${healAmount} to ${targetName}.`;
    case 'failure':
      return `${actor.name} attempts to mend ${targetName} with ${actionName}, but the restorative power fails to take hold.`;
    case 'fumble':
      return `${actor.name} misjudges the remedy, failing to restore any vitality to ${targetName}.`;
  }
}

// Generates prose for skill checks (athletics, stealth, perception, etc.)
function generateSkillCheckNarrative(payload: ActionOutcomePayload): string {
  const { actor, quality, details, actionName } = payload;
  const rollText = details?.roll !== undefined && details?.targetDC !== undefined
    ? ` (Rolled ${details.roll} vs DC ${details.targetDC})`
    : '';

  switch (quality) {
    case 'critical_success':
      return `${actor.name} achieves extraordinary success on their ${actionName} check${rollText}!`;
    case 'success':
      return `${actor.name} successfully performs ${actionName}${rollText}.`;
    case 'partial_success':
      return `${actor.name} manages a strained partial success on their ${actionName} check${rollText}.`;
    case 'failure':
      return `${actor.name} fails their ${actionName} check${rollText}.`;
    case 'fumble':
      return `${actor.name} critically fails their ${actionName} check${rollText} with disastrous complications!`;
  }
}

// Generates fallback prose for items, social, and exploration actions
function generateGenericNarrative(payload: ActionOutcomePayload): string {
  const { actor, target, quality, actionName } = payload;
  const targetName = target?.name ? ` on ${target.name}` : '';

  switch (quality) {
    case 'critical_success':
      return `${actor.name} expertly executes ${actionName}${targetName} with outstanding results!`;
    case 'success':
      return `${actor.name} performs ${actionName}${targetName}.`;
    case 'partial_success':
      return `${actor.name} executes ${actionName}${targetName} with mixed results.`;
    case 'failure':
      return `${actor.name}'s attempt at ${actionName}${targetName} was unsuccessful.`;
    case 'fumble':
      return `${actor.name} completely bungled ${actionName}${targetName}!`;
  }
}

// ============================================================================
// ActionOutcomeLogger Core Engine
// ============================================================================
// The primary service class for generating narrative descriptions,
// combat log entries, and journal records from action outcomes.
// ============================================================================

export class ActionOutcomeLogger {
  /**
   * Generates a descriptive narrative sentence from an action outcome.
   *
   * @param payload - Structured details of the action and its results.
   * @returns A polished plain-English description suitable for narrative logs.
   */
  static describeOutcome(payload: ActionOutcomePayload): string {
    // If the caller supplied a bespoke narrative line, use it directly
    if (payload.customNarrative) {
      return payload.customNarrative;
    }

    switch (payload.category) {
      case 'attack':
        return generateAttackNarrative(payload);
      case 'spell':
        return generateSpellNarrative(payload);
      case 'heal':
        return generateHealNarrative(payload);
      case 'skill_check':
        return generateSkillCheckNarrative(payload);
      case 'item_use':
      case 'social':
      case 'exploration':
      case 'utility':
      default:
        return generateGenericNarrative(payload);
    }
  }

  /**
   * Translates an action outcome into a structured CombatLogEntryInput for combat history.
   *
   * @param payload - Structured outcome details.
   * @returns CombatLogEntryInput formatted for the combat log store.
   */
  static createCombatLogEntry(payload: ActionOutcomePayload): CombatLogEntryInput {
    const narrativeMessage = this.describeOutcome(payload);
    const targetIds: string[] = [];

    if (payload.target?.id) {
      targetIds.push(payload.target.id);
    }
    if (payload.additionalTargetIds?.length) {
      for (const id of payload.additionalTargetIds) {
        if (!targetIds.includes(id)) {
          targetIds.push(id);
        }
      }
    }

    // Determine the most specific combat log type
    let logType: CombatLogType = 'action';
    if (payload.details?.healing && payload.details.healing > 0) {
      logType = 'heal';
    } else if (payload.details?.damage && payload.details.damage > 0) {
      logType = 'damage';
    } else if (payload.details?.statusEffect) {
      logType = 'status';
    }

    return {
      type: logType,
      message: narrativeMessage,
      characterId: payload.actor.id,
      targetIds: targetIds.length > 0 ? targetIds : undefined,
      data: {
        actionName: payload.actionName,
        damage: payload.details?.damage,
        healing: payload.details?.healing,
        damageType: payload.details?.damageType as DamageType | undefined,
        statusEffect: payload.details?.statusEffect,
      }
    } as CombatLogEntryInput;
  }

  /**
   * Translates a notable action outcome into a permanent Adventure Journal event.
   *
   * @param payload - Structured outcome details.
   * @param context - World and quest context (game time, location, quest tags).
   * @returns JournalEvent formatted for the adventure journal system.
   */
  static createJournalEvent(
    payload: ActionOutcomePayload,
    context: ActionJournalContext = {}
  ): JournalEvent {
    const narrativeMessage = this.describeOutcome(payload);
    const id = `journal-event-${generateId()}`;
    const timestamp = Date.now();
    const gameTime = context.gameTime || 'Unknown In-Game Date';

    // Map the action category to the appropriate journal event category
    let journalType: JournalEventType = 'custom';
    if (payload.category === 'skill_check') {
      journalType = 'skill_check';
    } else if (payload.category === 'social') {
      journalType = 'npc_conversation';
    } else if (payload.category === 'item_use') {
      journalType = 'item_acquired';
    } else if (payload.category === 'attack' || payload.category === 'spell') {
      journalType = 'skill_check';
    }

    const title = `${payload.actionName} (${payload.quality.replace('_', ' ').toUpperCase()})`;

    return {
      id,
      type: journalType,
      timestamp,
      gameTime,
      title,
      description: narrativeMessage,
      locationId: context.locationId,
      questId: context.questId,
      npcId: payload.target?.id,
      itemIds: context.itemIds,
      xpGained: context.xpGained,
      goldChange: context.goldChange,
    };
  }

  /**
   * Convenience batch logger that formats narrative, combat log, and journal event together.
   *
   * @param payload - Action outcome details.
   * @param journalContext - Optional journal context metadata.
   * @returns An object containing the narrative prose, combat entry, and journal event.
   */
  static logOutcome(
    payload: ActionOutcomePayload,
    journalContext?: ActionJournalContext
  ): {
    narrative: string;
    combatLog: CombatLogEntryInput;
    journalEvent: JournalEvent;
  } {
    const narrative = this.describeOutcome(payload);
    const combatLog = this.createCombatLogEntry(payload);
    const journalEvent = this.createJournalEvent(payload, journalContext);

    return {
      narrative,
      combatLog,
      journalEvent,
    };
  }
}
