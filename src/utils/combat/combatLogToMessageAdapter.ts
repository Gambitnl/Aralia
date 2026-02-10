/**
 * @file combatLogToMessageAdapter.ts
 * @created 2026-02-10
 *
 * Bridge adapter that converts simple CombatLogEntry objects into rich CombatMessage objects.
 * This allows the existing combat system (which emits CombatLogEntry via onLogEntry callbacks
 * in useTurnManager, useCombatEngine, and useActionExecutor) to feed the rich messaging system
 * without modifying any of those combat hooks.
 *
 * The adapter is called from CombatView.handleLogEntry, which intercepts every log entry at the
 * component level and produces a parallel rich message for the CombatLog's enhanced display mode.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */

// --- Imports ---
// CombatLogEntry: The simple log entry structure emitted by the existing combat hooks.
//   Contains: id, timestamp, type ('action'|'damage'|'heal'|'status'|'turn_start'|'turn_end'),
//   message (string), characterId, targetIds, and a flexible data bag (CombatLogData).
// CombatCharacter: The full character model used during combat, needed here to look up
//   entity IDs by name when the log entry only provides a name string (e.g. data.source).
import type { CombatLogEntry, CombatCharacter } from '../../types/combat';

// Enums imported as values (not just types) because we use them to construct MessageMapping objects.
// CombatMessageType: 25+ enum values categorizing combat events (DAMAGE_DEALT, KILLING_BLOW, etc.)
// MessagePriority: LOW | MEDIUM | HIGH | CRITICAL — controls visual emphasis and display channels.
// MessageChannel: COMBAT_LOG | NOTIFICATION | VISUAL_EFFECT | AUDIO_CUE — declares where a message
//   should be routed. Currently only COMBAT_LOG is consumed; the others are populated for future use.
import {
  CombatMessageType,
  MessagePriority,
  MessageChannel,
} from '../../types/combatMessages';

// Type-only imports for the output structures we build.
// CombatMessage: The rich message object consumed by useCombatMessaging and CombatLog.
// BaseMessageData: Minimal data payload (rawValue, formattedValue) used as fallback.
// DamageMessageData: Typed payload for damage events (damageType, isCritical, etc.).
// HealMessageData: Typed payload for healing events (healType, isCritical, etc.).
// StatusMessageData: Typed payload for status/condition events (statusName, statusType, isResisted).
import type {
  CombatMessage,
  BaseMessageData,
  DamageMessageData,
  HealMessageData,
  StatusMessageData,
} from '../../types/combatMessages';

// --- Internal Types ---

/**
 * MessageMapping is the intermediate result of classifying a CombatLogEntry.
 * It captures which CombatMessageType, priority level, and output channels
 * should be assigned to the resulting CombatMessage, before we build the
 * title, description, or data payload.
 */
interface MessageMapping {
  type: CombatMessageType;
  priority: MessagePriority;
  channels: MessageChannel[];
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * classifyEntry — Determines the CombatMessageType, priority, and channels for a log entry.
 *
 * This is the core mapping logic. It uses a two-level strategy:
 *   1. First, switch on the CombatLogEntry.type field ('damage', 'heal', 'status', etc.)
 *      to narrow down the broad category.
 *   2. Then, for ambiguous categories (especially 'status' and 'turn_start'), inspect
 *      the message text with string matching to refine into a specific CombatMessageType.
 *
 * The message text matching is case-insensitive (msg is lowercased at the top).
 * The order of checks within each case matters — more specific patterns are checked first
 * to avoid false matches on more general ones.
 *
 * @param entry - The CombatLogEntry to classify.
 * @returns A MessageMapping with the determined type, priority, and channels.
 */
function classifyEntry(entry: CombatLogEntry): MessageMapping {
  // Lowercase once for all subsequent string.includes() checks.
  const msg = entry.message.toLowerCase();

  switch (entry.type) {
    // --- DAMAGE ENTRIES ---
    // Emitted by useCombatEngine.handleDamage() and useActionExecutor (zone damage, reactive effects).
    // The data bag includes: damage (number), damageType (string), source (string), isDeath (boolean).
    case 'damage': {
      // If isDeath is true, the character was killed by this damage — map to KILLING_BLOW
      // with HIGH priority and three channels (log, notification, and visual effect).
      if (entry.data?.isDeath) {
        return {
          type: CombatMessageType.KILLING_BLOW,
          priority: MessagePriority.HIGH,
          channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
        };
      }
      // Standard damage — MEDIUM priority, log + notification channels.
      return {
        type: CombatMessageType.DAMAGE_DEALT,
        priority: MessagePriority.MEDIUM,
        channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
      };
    }

    // --- HEAL ENTRIES ---
    // Emitted by useCombatEngine.processEndOfTurnEffects() for heal_per_turn status effects.
    // Also emitted by useActionExecutor for zone-based healing.
    case 'heal':
      return {
        type: CombatMessageType.HEALING_RECEIVED,
        priority: MessagePriority.MEDIUM,
        channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
      };

    // --- STATUS ENTRIES ---
    // Emitted by several sources: processRepeatSaves, processTileEffects, useActionExecutor (zone conditions).
    // The message text varies widely, so we use string matching to determine the specific subtype.
    case 'status': {
      // "X succeeds on repeat save against Y!" — successful saving throw.
      // Check for 'succeeds' AND 'save' to distinguish from other status messages.
      if (msg.includes('succeeds') && msg.includes('save')) {
        return {
          type: CombatMessageType.STATUS_RESISTED,
          priority: MessagePriority.MEDIUM,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // "X fails repeat save against Y." — failed saving throw (condition persists).
      if (msg.includes('fails') && msg.includes('save')) {
        return {
          type: CombatMessageType.STATUS_APPLIED,
          priority: MessagePriority.MEDIUM,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // "X lost concentration on Fireball" or effects that have expired.
      // These indicate a buff/debuff ending, mapped to STATUS_EXPIRED.
      if (msg.includes('concentration') || msg.includes('expired')) {
        return {
          type: CombatMessageType.STATUS_EXPIRED,
          priority: MessagePriority.MEDIUM,
          channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
        };
      }
      // "X resists Y" — general resistance without a saving throw context.
      if (msg.includes('resists')) {
        return {
          type: CombatMessageType.STATUS_RESISTED,
          priority: MessagePriority.MEDIUM,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // "Environmental effects updated" — map-level status messages about terrain.
      if (msg.includes('environmental')) {
        return {
          type: CombatMessageType.ENVIRONMENTAL_DAMAGE,
          priority: MessagePriority.LOW,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // Default for all other status messages: "X is affected by Burning", "X is now Restrained", etc.
      return {
        type: CombatMessageType.STATUS_APPLIED,
        priority: MessagePriority.MEDIUM,
        channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
      };
    }

    // --- TURN START ENTRIES ---
    // Emitted by useTurnManager for combat initialization, turn changes, round transitions,
    // and characters joining mid-combat. The same CombatLogEntry type is used for all of these,
    // so we differentiate by message text.
    case 'turn_start': {
      // "Combat begins! Turn order: ..." — the very first log entry when combat initializes.
      if (msg.includes('combat begins')) {
        return {
          type: CombatMessageType.COMBAT_ENTER,
          priority: MessagePriority.HIGH,
          channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
        };
      }
      // "Round N begins!" — a new round boundary, low priority as it's routine.
      if (msg.includes('round')) {
        return {
          type: CombatMessageType.ROUND_START,
          priority: MessagePriority.LOW,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // "X joins the combat!" — a character entering mid-fight (e.g. summons, reinforcements).
      if (msg.includes('joins')) {
        return {
          type: CombatMessageType.COMBAT_ENTER,
          priority: MessagePriority.MEDIUM,
          channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
        };
      }
      // Default: "X's turn." — standard turn transition, low priority.
      return {
        type: CombatMessageType.TURN_START,
        priority: MessagePriority.LOW,
        channels: [MessageChannel.COMBAT_LOG],
      };
    }

    // --- TURN END ENTRIES ---
    // There is no TURN_END value in the CombatMessageType enum, so we reuse TURN_START
    // with LOW priority. These entries are rarely emitted (the engine mostly uses turn_start).
    case 'turn_end':
      return {
        type: CombatMessageType.TURN_START,
        priority: MessagePriority.LOW,
        channels: [MessageChannel.COMBAT_LOG],
      };

    // --- ACTION ENTRIES ---
    // Emitted by useActionExecutor for ability usage, opportunity attacks, sustain actions,
    // and "cannot perform" errors. The message text is the primary differentiator.
    case 'action': {
      // Opportunity attacks are distinguished from regular actions by their message text.
      // They include roll details like "(d20+5=18 vs AC 15)".
      if (msg.includes('opportunity attack')) {
        // "X hits Y with Opportunity Attack!" — successful opportunity attack.
        if (msg.includes('hits')) {
          return {
            type: CombatMessageType.DAMAGE_DEALT,
            priority: MessagePriority.HIGH,
            channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
          };
        }
        // "X misses Opportunity Attack against Y." — missed opportunity attack.
        if (msg.includes('misses')) {
          return {
            type: CombatMessageType.MISSED_ATTACK,
            priority: MessagePriority.LOW,
            channels: [MessageChannel.COMBAT_LOG],
          };
        }
      }
      // "X cannot perform this action" — resource/economy failure, low importance.
      if (msg.includes('cannot perform')) {
        return {
          type: CombatMessageType.DEFENDED,
          priority: MessagePriority.LOW,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // "X sustains Spell Name" — concentration maintenance, routine.
      if (msg.includes('sustains')) {
        return {
          type: CombatMessageType.ABILITY_USED,
          priority: MessagePriority.LOW,
          channels: [MessageChannel.COMBAT_LOG],
        };
      }
      // Default for all other action entries — general ability usage.
      return {
        type: CombatMessageType.ABILITY_USED,
        priority: MessagePriority.MEDIUM,
        channels: [MessageChannel.COMBAT_LOG],
      };
    }

    // --- FALLBACK ---
    // Safety net for any unexpected entry.type values. Should not normally be reached
    // since CombatLogEntry.type is a union literal, but guards against future additions.
    default:
      return {
        type: CombatMessageType.ABILITY_USED,
        priority: MessagePriority.LOW,
        channels: [MessageChannel.COMBAT_LOG],
      };
  }
}

// =============================================================================
// DATA PAYLOAD CONSTRUCTION
// =============================================================================

/**
 * buildDataPayload — Constructs a typed data payload from the loose CombatLogData bag.
 *
 * CombatLogEntry.data is a flexible object with optional fields (damage, damageType,
 * healAmount, statusEffectName, etc.) plus a catch-all index signature. This function
 * reads those fields and builds the appropriate discriminated union member
 * (DamageMessageData, HealMessageData, StatusMessageData, or BaseMessageData).
 *
 * The mapping.type (output of classifyEntry) determines which payload shape to build.
 * Multiple CombatMessageType values can map to the same payload shape — e.g. DAMAGE_DEALT,
 * CRITICAL_HIT, KILLING_BLOW, and ENVIRONMENTAL_DAMAGE all produce DamageMessageData.
 *
 * @param entry   - The original CombatLogEntry with its data bag.
 * @param mapping - The classification result that tells us which payload shape to build.
 * @returns A typed data payload matching one of the CombatMessageData union members.
 */
function buildDataPayload(
  entry: CombatLogEntry,
  mapping: MessageMapping
): DamageMessageData | HealMessageData | StatusMessageData | BaseMessageData {
  const data = entry.data;

  switch (mapping.type) {
    // --- Damage payloads ---
    // All damage-related message types share the DamageMessageData shape.
    // We extract the numeric damage and damage type string from the data bag.
    // The data bag uses two different field names for damage amount depending on the source:
    //   - handleDamage() writes `data.damage`
    //   - CombatLogData interface defines `data.damageAmount`
    // We check both with nullish coalescing, falling back to 0.
    case CombatMessageType.DAMAGE_DEALT:
    case CombatMessageType.CRITICAL_HIT:
    case CombatMessageType.KILLING_BLOW:
    case CombatMessageType.ENVIRONMENTAL_DAMAGE: {
      const damage = data?.damage as number ?? data?.damageAmount ?? 0;
      const damageType = (data?.damageType as string) ?? '';
      return {
        rawValue: damage,
        formattedValue: damageType ? `${damage} ${damageType}` : `${damage}`,
        damageType: damageType || 'untyped',
        // isCritical: Currently always false because the existing combat hooks don't pass
        // critical hit info through the CombatLogEntry.data bag. The combatEvents.emit for
        // unit_attack also hardcodes isCrit: false. This would need engine-level changes to fix.
        isCritical: false,
        isSneakAttack: false,
        resistanceApplied: false,
        vulnerabilityApplied: false,
      } satisfies DamageMessageData;
    }

    // --- Heal payloads ---
    // HealMessageData requires a healType discriminator. We default to 'hit_points' since
    // the existing log entries don't distinguish between HP heals, temp HP, or stat restores.
    // The heal amount also uses two field names: `healAmount` (canonical) and `heal` (legacy).
    case CombatMessageType.HEALING_RECEIVED: {
      const heal = data?.healAmount ?? data?.heal ?? 0;
      const source = (data?.source as string) ?? '';
      return {
        rawValue: heal as number,
        formattedValue: `${heal} HP`,
        healType: 'hit_points',
        isCritical: false,
        // If there's a source string (e.g. "Regeneration"), use it as the spellName.
        spellName: source || undefined,
      } satisfies HealMessageData;
    }

    // --- Status payloads ---
    // StatusMessageData captures the condition/effect name, type, and whether it was resisted.
    // The status name comes from either:
    //   1. data.statusEffectName (if the log entry included structured data), or
    //   2. extractStatusName() which regex-parses it out of the message text.
    case CombatMessageType.STATUS_APPLIED:
    case CombatMessageType.STATUS_RESISTED:
    case CombatMessageType.STATUS_EXPIRED:
    case CombatMessageType.CONDITION_CLEARED: {
      const statusName = (data?.statusEffectName as string) ?? extractStatusName(entry.message);
      return {
        rawValue: statusName,
        formattedValue: statusName,
        statusName,
        // Default to 'condition' since the log entry doesn't distinguish buff/debuff/condition.
        statusType: 'condition',
        // Mark isResisted based on whether we classified this as STATUS_RESISTED.
        isResisted: mapping.type === CombatMessageType.STATUS_RESISTED,
      } satisfies StatusMessageData;
    }

    // --- Fallback payload ---
    // For message types that don't have a specific data shape (TURN_START, ABILITY_USED, etc.),
    // we use BaseMessageData with the raw message text as both rawValue and formattedValue.
    default:
      return {
        rawValue: entry.message,
        formattedValue: entry.message,
      } satisfies BaseMessageData;
  }
}

// =============================================================================
// TEXT EXTRACTION HELPERS
// =============================================================================

/**
 * extractStatusName — Best-effort extraction of a status/effect name from log message text.
 *
 * The combat system doesn't always include a structured `statusEffectName` in the data bag,
 * especially for repeat saves and zone effects. In those cases we fall back to regex-parsing
 * the human-readable message string.
 *
 * The patterns are checked in order of specificity. Each regex targets a specific message
 * format produced by the combat hooks:
 *
 * @param message - The full log message string to parse.
 * @returns The extracted status/effect name, or 'unknown effect' if no pattern matched.
 */
function extractStatusName(message: string): string {
  // Pattern 1: "X succeeds on repeat save against Burning!"
  // Source: useCombatEngine.processRepeatSaves() — the status name follows "against".
  const againstMatch = message.match(/against (.+?)[\s!.]*$/i);
  if (againstMatch) return againstMatch[1];

  // Pattern 2: "X is affected by Poisoned for 3 rounds"
  // Source: useCombatEngine.processTileEffects() and useActionExecutor zone effects.
  // The status name sits between "affected by" and either "for" (duration) or end-of-string.
  const affectedMatch = message.match(/affected by (.+?)(?:\s+for|\s*[!.]|$)/i);
  if (affectedMatch) return affectedMatch[1];

  // Pattern 3: "X is now Restrained from zone effect!"
  // Source: useActionExecutor when a zone applies a condition.
  // The status name sits between "is now" and "from".
  const nowMatch = message.match(/is now (.+?)\s+from/i);
  if (nowMatch) return nowMatch[1];

  // Pattern 4: "X lost concentration on Fireball (failed to sustain)."
  // Source: useCombatEngine.processEndOfTurnEffects() for unsustained concentration.
  // The spell name sits between "concentration on" and the next whitespace or parenthesis.
  const concMatch = message.match(/concentration on (.+?)[\s(]/i);
  if (concMatch) return concMatch[1];

  // Fallback: no known pattern matched.
  return 'unknown effect';
}

/**
 * deriveTitle — Generates a concise title from the full log message.
 *
 * CombatMessage has separate `title` and `description` fields. The description holds
 * the full original message text (preserving all detail). The title is a shortened
 * version for compact display or notification headers.
 *
 * For well-known message types we produce a clean, purpose-built title.
 * For everything else we truncate the message to 40 characters.
 *
 * @param entry   - The original CombatLogEntry (for the message text).
 * @param mapping - The classification result (for the determined CombatMessageType).
 * @returns A short, human-readable title string.
 */
function deriveTitle(entry: CombatLogEntry, mapping: MessageMapping): string {
  switch (mapping.type) {
    // "X takes 15 fire damage from Y and is defeated!" → "X defeated!"
    // We split on " takes " to isolate the character name at the start.
    case CombatMessageType.KILLING_BLOW: {
      const name = entry.message.split(' takes ')[0] || entry.message.split(' ')[0];
      return `${name} defeated!`;
    }
    // "Combat begins! Turn order: A → B → C" → "Combat begins!"
    // "X joins the combat! (Init: 15)" → "X joins the combat!"
    case CombatMessageType.COMBAT_ENTER: {
      if (entry.message.toLowerCase().includes('combat begins')) return 'Combat begins!';
      return entry.message.split('!')[0] + '!';
    }
    // "Round 3 begins!" → "Round 3"
    case CombatMessageType.ROUND_START: {
      const roundMatch = entry.message.match(/Round (\d+)/i);
      return roundMatch ? `Round ${roundMatch[1]}` : 'New round';
    }
    // "Aeliana's turn." → "Aeliana's turn"
    case CombatMessageType.TURN_START: {
      const turnName = entry.message.replace("'s turn.", '').trim();
      return `${turnName}'s turn`;
    }
    // All missed attacks get a generic title since the details are in the description.
    case CombatMessageType.MISSED_ATTACK:
      return 'Attack missed';
    // For everything else, use the first 40 characters with an ellipsis if truncated.
    default:
      return entry.message.length > 40 ? entry.message.slice(0, 40) + '...' : entry.message;
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * convertLogEntryToMessage — The public API of this adapter module.
 *
 * Converts a single CombatLogEntry into a CombatMessage by:
 *   1. Classifying the entry (type, priority, channels) via classifyEntry().
 *   2. Building a typed data payload via buildDataPayload().
 *   3. Deriving a concise title via deriveTitle().
 *   4. Resolving source/target entity IDs from the characters array.
 *
 * Called from CombatView.handleLogEntry on every log entry emitted during combat.
 * The resulting CombatMessage is passed to useCombatMessaging.addMessage() and
 * ultimately rendered by the CombatLog component in rich display mode.
 *
 * @param entry      - The simple log entry from the combat system.
 * @param characters - The current combat characters array. Used to look up entity IDs
 *                     by name when the log entry only provides a name string (e.g. the
 *                     attacker name in damage entries is stored as data.source, not an ID).
 * @returns A fully populated CombatMessage ready for the messaging system.
 */
export function convertLogEntryToMessage(
  entry: CombatLogEntry,
  characters: CombatCharacter[]
): CombatMessage {
  // Step 1: Classify — determine the message type, priority, and channels.
  const mapping = classifyEntry(entry);

  // Step 2: Build data payload — extract structured data from the loose data bag.
  const dataPayload = buildDataPayload(entry, mapping);

  // Step 3: Derive title — generate a short title for compact display.
  const title = deriveTitle(entry, mapping);

  // Step 4: Resolve source/target entity IDs.
  // By default, characterId from the log entry is the "source" (who performed the action),
  // and targetIds[0] is the first target.
  let sourceEntityId = entry.characterId;
  let targetEntityId = entry.targetIds?.[0];

  // Special case for damage entries: the existing combat hooks use an inverted convention.
  // In handleDamage(), characterId is the TARGET (the character taking damage), and the
  // attacker's name is stored as a string in data.source (not as an ID).
  // We look up the attacker by name in the characters array to get their ID.
  if (entry.type === 'damage' && entry.data?.source) {
    const sourceName = entry.data.source as string;
    const sourceChar = characters.find(c => c.name === sourceName);
    targetEntityId = entry.characterId;       // The character taking damage is the target
    sourceEntityId = sourceChar?.id;           // The attacker is the source (may be undefined if name not found)
  }

  // Step 5: Assemble the final CombatMessage object.
  // We reuse the original entry.id so the CombatMessage and CombatLogEntry share the same ID,
  // making it easy to correlate between the two systems during debugging.
  return {
    id: entry.id,
    type: mapping.type,
    priority: mapping.priority,
    timestamp: entry.timestamp,
    channels: mapping.channels,
    title,
    description: entry.message,  // Full original message preserved as the description.
    sourceEntityId,
    targetEntityId,
    data: dataPayload,
  };
}
