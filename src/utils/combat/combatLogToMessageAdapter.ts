// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 09:05:55
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
//   Contains: id, timestamp, a discriminated type, message, actor/target ids,
//   and the category-checked payload selected by that type.
// CombatCharacter: The full character model used during combat, needed here to look up
//   entity IDs by name when the log entry only provides a name string (e.g. data.source).
import type { CombatLogEntry, CombatCharacter, StatusEffect } from '../../types/combat';

// Enums imported as values (not just types) because we use them to construct MessageMapping objects.
// CombatMessageType: 25+ enum values categorizing combat events (DAMAGE_DEALT, KILLING_BLOW, etc.)
// MessagePriority: LOW | MEDIUM | HIGH | CRITICAL — controls visual emphasis and display channels.
// MessageChannel: COMBAT_LOG | NOTIFICATION | VISUAL_EFFECT | AUDIO_CUE — declares where a message
//   should be routed. Currently only COMBAT_LOG is consumed; the others are populated for future use.
// CombatEventClass: the typed event taxonomy (CMB-GAP-003). Replaces the message-text
//   matching that used to decide a record's meaning.
// getEventRouting: the single lookup from an event class to its CombatMessageType,
//   MessagePriority, MessageChannel[], visual effect and sound cue.
// CombatMessageType is still imported as a value because buildDataPayload and deriveTitle
//   switch on the resulting presentation type.
import {
  CombatEventClass,
  CombatMessageType,
  getEventRouting,
  getStatusDiscriminator,
} from '../../types/combatMessages';

// Type-only imports for the output structures we build.
// CombatMessage: The rich message object consumed by useCombatMessaging and CombatLog.
// BaseMessageData: Minimal data payload (rawValue, formattedValue) used as fallback.
// DamageMessageData: Typed payload for damage events (damageType, isCritical, etc.).
// HealMessageData: Typed payload for healing events (healType, isCritical, etc.).
// StatusMessageData: Typed payload for status/condition events (statusName, statusType, isResisted).
import type {
  CombatEventRouting,
  CombatMessage,
  BaseMessageData,
  DamageMessageData,
  HealMessageData,
  StatusDiscriminator,
  StatusEffectKind,
  StatusMessageData,
} from '../../types/combatMessages';

// --- Status Kind Bridge (agora-6acd) ---

/**
 * STATUS_KIND_BY_DOMAIN_KIND — the compile-time guard between the domain's status kinds and
 * the messaging mirror of them.
 *
 * types/combatMessages.ts cannot import types/combat.ts (that module documents combatMessages
 * as importing nothing, so a back-import would make the note false), which leaves
 * StatusEffectKind a hand-written copy of StatusEffect['type']. This record keys on the DOMAIN
 * union and values in the MIRROR union, so adding a sixth kind to StatusEffect, or renaming one,
 * fails to compile here instead of quietly routing that kind as an unclassified status.
 *
 * It is not a lookup of convenience: resolveStatusKind() uses it to narrow a domain value into
 * the mirror union, so the guard sits on the real path and cannot rot into dead code.
 */
const STATUS_KIND_BY_DOMAIN_KIND: Record<StatusEffect['type'], StatusEffectKind> = {
  buff: 'buff',
  debuff: 'debuff',
  neutral: 'neutral',
  dot: 'dot',
  hot: 'hot',
};

/**
 * resolveStatusName — the one place this module decides what a status record is ABOUT.
 *
 * WHAT CHANGED (2026-09-20, agora-6acd): the name used to be resolved inside buildDataPayload
 * only. It is lifted out because the buff/debuff discriminator has to look the SAME status up
 * on the character; resolving the name twice would let the displayed name and the routed class
 * disagree about which effect a record describes.
 *
 * Structured data wins. extractStatusName() is the existing text shim, kept for the emitters
 * that only write the sentence.
 */
function resolveStatusName(entry: CombatLogEntry): string {
  const structured = entry.data?.statusEffectName ?? entry.data?.condition?.name;
  if (typeof structured === 'string' && structured.length > 0) return structured;
  return extractStatusName(entry.message);
}

/**
 * resolveStatusKind — reads the buff/debuff discriminator off LIVE combat state.
 *
 * WHY STATE AND NOT TEXT: "Goblin is affected by Bless" and "Goblin is affected by Bane" are
 * the same sentence. Only the applied StatusEffect knows which one helps, and it already says
 * so in its `type` field. The discriminator is therefore read from the record the engine
 * actually wrote onto the character, never inferred from the wording of the log line.
 *
 * WHY NOT FROM entry.data: a kind field on CommonCombatLogData would mean editing
 * types/combat.ts, which this packet does not own (PK-02), and every emitter would then have
 * to start setting it. Reading the applied status needs neither.
 *
 * FAILS HONESTLY: returns undefined when the record is not a status record, when no character
 * matches, or when no status of that name is on the character (an expiry has already removed
 * it). Undefined means STATUS_CHANGE, exactly as every status record behaved before this.
 */
function resolveStatusKind(
  entry: CombatLogEntry,
  characters: CombatCharacter[] | undefined,
): StatusEffectKind | undefined {
  if (entry.type !== 'status' || !characters || characters.length === 0) return undefined;

  // Status records name the AFFECTED creature as characterId; targetIds[0] is that same
  // creature for the emitters that fill both. Either field identifies whose list to read.
  const affectedId = entry.characterId ?? entry.targetIds?.[0];
  if (!affectedId) return undefined;

  const affected = characters.find(character => character.id === affectedId);
  if (!affected) return undefined;

  const wanted = resolveStatusName(entry).trim().toLowerCase();
  // 'unknown effect' is extractStatusName's explicit "no pattern matched" answer, not a name.
  if (!wanted || wanted === 'unknown effect') return undefined;

  const status = affected.statusEffects?.find(
    effect => String(effect.name).trim().toLowerCase() === wanted,
  );
  if (!status) return undefined;

  return STATUS_KIND_BY_DOMAIN_KIND[status.type];
}

/**
 * refineStatusClass — upgrades a plain STATUS_CHANGE to BUFF or DEBUFF when the kind is known.
 *
 * Only STATUS_CHANGE is refined. A class that is already specific (STATUS_RESIST, DEATH_SAVE,
 * STATUS_EXPIRE, or anything an emitter stamped itself) states something the kind does not,
 * and is left exactly as it was.
 */
function refineStatusClass(
  eventClass: CombatEventClass,
  discriminator: StatusDiscriminator | undefined,
): CombatEventClass {
  if (eventClass !== CombatEventClass.STATUS_CHANGE || !discriminator) return eventClass;
  return discriminator.eventClass;
}

// --- Internal Types ---

/**
 * MessageMapping is the intermediate result of classifying a CombatLogEntry.
 * It captures which CombatMessageType, priority level, and output channels
 * should be assigned to the resulting CombatMessage, before we build the
 * title, description, or data payload.
 */
// MessageMapping is now simply the routing row for the record's event class, plus the
// class itself so the finished CombatMessage can carry it. The old hand-written shape
// (type/priority/channels) is preserved because CombatEventRouting declares exactly those
// fields, so buildDataPayload and deriveTitle keep reading `mapping.type` unchanged.
type MessageMapping = CombatEventRouting & { eventClass: CombatEventClass };

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * deriveEventClass — best-effort classification for records emitted WITHOUT an eventClass.
 *
 * WHAT CHANGED (2026-09-09, CMB-GAP-003): this is the old classifyEntry() string matcher,
 * demoted. It no longer decides message type, priority or channels — it only answers the one
 * question "which CombatEventClass is this?", and COMBAT_EVENT_ROUTING decides the rest.
 *
 * WHY IT IS STILL HERE: log records are emitted from dozens of hooks and systems
 * (useTurnManager, useCombatEngine, useActionExecutor, spell commands, zone effects). Deleting
 * the text fallback before those emitters stamp `entry.eventClass` would silently downgrade
 * every one of them to UNKNOWN. It is a migration shim, not the routing table.
 *
 * PRESERVED: every branch maps to the class whose routing row reproduces the exact
 * CombatMessageType, priority and channel set that branch produced before the enum existed.
 *
 * @param entry - The CombatLogEntry to classify.
 * @returns The inferred CombatEventClass.
 */
export function deriveEventClass(entry: CombatLogEntry): CombatEventClass {
  // Lowercase once for all subsequent string.includes() checks.
  const msg = entry.message.toLowerCase();
  const isCritical = Boolean(entry.data?.isCritical ?? entry.data?.isCrit);

  switch (entry.type) {
    // --- DAMAGE ENTRIES ---
    // Emitted by useCombatEngine.handleDamage() and useActionExecutor (zone damage, reactive effects).
    case 'damage': {
      if (isCritical) return CombatEventClass.CRITICAL_DAMAGE;
      // isDeath means the character was killed by this damage.
      if (entry.data?.isDeath) return CombatEventClass.KILL;
      return CombatEventClass.DAMAGE;
    }

    // --- HEAL ENTRIES ---
    // Emitted by useCombatEngine.processEndOfTurnEffects() and zone healing in useActionExecutor.
    case 'heal':
      return CombatEventClass.HEAL;

    // --- STATUS ENTRIES ---
    // Emitted by processRepeatSaves, processTileEffects, useActionExecutor (zone conditions),
    // and the death-save resolver. Order matters: more specific patterns are tested first.
    case 'status': {
      // Death saves carry a structured deathSaves payload; the text check is the fallback for
      // emitters that only write the sentence. NEW in 2026-09-09: these used to land in the
      // generic save branches, which gave them no notification path at all.
      if (entry.data?.deathSaves !== undefined || msg.includes('death save') || msg.includes('death saving throw')) {
        return CombatEventClass.DEATH_SAVE;
      }
      // "X succeeds on repeat save against Y!" — successful saving throw.
      if (msg.includes('succeeds') && msg.includes('save')) return CombatEventClass.STATUS_RESIST;
      // "X fails repeat save against Y." — failed saving throw, the condition persists.
      if (msg.includes('fails') && msg.includes('save')) return CombatEventClass.STATUS_SAVE_FAILED;
      // "X lost concentration on Fireball" / effects that have expired.
      if (msg.includes('concentration') || msg.includes('expired')) return CombatEventClass.STATUS_EXPIRE;
      // "X resists Y" — resistance without a saving-throw context.
      if (msg.includes('resists')) return CombatEventClass.STATUS_RESIST;
      // "Environmental effects updated" — map-level terrain status.
      if (msg.includes('environmental')) return CombatEventClass.ENVIRONMENTAL;
      // Default: "X is affected by Burning", "X is now Restrained", etc.
      // BUFF/DEBUFF are still not guessed from TEXT here: the wording cannot tell Bless from
      // Bane. classifyEntry refines this afterwards from the applied status (agora-6acd).
      return CombatEventClass.STATUS_CHANGE;
    }

    // --- TURN START ENTRIES ---
    // useTurnManager reuses one record type for initialization, turn changes, round
    // transitions and mid-combat joins, so these are still separated by text.
    case 'turn_start': {
      if (msg.includes('combat begins')) return CombatEventClass.COMBAT_ENTER;
      if (msg.includes('round')) return CombatEventClass.ROUND_START;
      if (msg.includes('joins')) return CombatEventClass.COMBAT_JOIN;
      return CombatEventClass.TURN_START;
    }

    // --- TURN END ENTRIES ---
    case 'turn_end':
      return CombatEventClass.TURN_END;

    // --- ACTION ENTRIES ---
    // useActionExecutor emits ability usage, opportunity attacks, sustains and refusals.
    case 'action': {
      if (msg.includes('opportunity attack')) {
        if (msg.includes('hits')) {
          return isCritical ? CombatEventClass.CRITICAL_DAMAGE : CombatEventClass.OPPORTUNITY_ATTACK_HIT;
        }
        if (msg.includes('misses')) return CombatEventClass.MISS;
      }
      // "X cannot perform this action" — action-economy refusal.
      if (msg.includes('cannot perform')) return CombatEventClass.ACTION_BLOCKED;
      // "X sustains Spell Name" — concentration maintenance.
      if (msg.includes('sustains')) return CombatEventClass.SPELL_SUSTAIN;
      return CombatEventClass.ABILITY;
    }

    // Guardian and forced-movement systems already emit this runtime category.
    case 'movement':
      return CombatEventClass.MOVEMENT;

    // Creature and persistent-entity records.
    case 'summon':
      return CombatEventClass.SUMMON;

    // Safety net for future CombatLogType additions.
    default:
      return CombatEventClass.UNKNOWN;
  }
}

/**
 * resolveEventClass — the enum-first read of a record's class.
 *
 * Prefers what the emitter stamped; falls back to the text shim above. This is the ONLY place
 * that decides whether the shim runs, so as emitters adopt `eventClass` the shim quietly stops
 * being consulted without any other file changing.
 */
export function resolveEventClass(
  entry: CombatLogEntry,
  characters?: CombatCharacter[],
): CombatEventClass {
  const eventClass = entry.eventClass ?? deriveEventClass(entry);
  // agora-6acd: `characters` stays optional so the enum-first read can still be exercised on
  // its own. With the roster in hand, a plain STATUS_CHANGE becomes BUFF or DEBUFF when the
  // applied status says which it is.
  return refineStatusClass(eventClass, getStatusDiscriminator(resolveStatusKind(entry, characters)));
}

/**
 * classifyEntry — resolves the record's event class and looks up its routing row.
 *
 * WHAT CHANGED: this used to be a ~200 line switch that decided type, priority and channels
 * inline, with the channel set duplicated across a dozen return statements. Those decisions
 * now live once, as data, in COMBAT_EVENT_ROUTING (src/types/combatMessages.ts).
 */
function classifyEntry(
  entry: CombatLogEntry,
  characters: CombatCharacter[],
): { mapping: MessageMapping; discriminator: StatusDiscriminator | undefined } {
  // agora-6acd: the discriminator is resolved ONCE and handed to both consumers, so the
  // routed class and the payload's statusType always come from one reading of live state.
  const discriminator = getStatusDiscriminator(resolveStatusKind(entry, characters));
  const eventClass = refineStatusClass(entry.eventClass ?? deriveEventClass(entry), discriminator);
  return { mapping: { eventClass, ...getEventRouting(eventClass) }, discriminator };
}

// =============================================================================
// DATA PAYLOAD CONSTRUCTION
// =============================================================================
/**
 * buildDataPayload — Constructs a typed display payload from a combat-log record.
 *
 * CombatLogEntry.data is selected by CombatLogEntry.type. This function reads
 * the shared display fields and builds the appropriate discriminated union member
 * (DamageMessageData, HealMessageData, StatusMessageData, or BaseMessageData).
 *
 * The mapping.type (output of classifyEntry) determines which payload shape to build.
 * Multiple CombatMessageType values can map to the same payload shape — e.g. DAMAGE_DEALT,
 * CRITICAL_HIT, KILLING_BLOW, and ENVIRONMENTAL_DAMAGE all produce DamageMessageData.
 *
 * @param entry   - The original CombatLogEntry with its category-checked data.
 * @param mapping - The classification result that tells us which payload shape to build.
 * @returns A typed data payload matching one of the CombatMessageData union members.
 */
function buildDataPayload(
  entry: CombatLogEntry,
  mapping: MessageMapping,
  discriminator: StatusDiscriminator | undefined
): DamageMessageData | HealMessageData | StatusMessageData | BaseMessageData {
  const data = entry.data;

  switch (mapping.type) {
    // --- Damage payloads ---
    // All damage-related message types share the DamageMessageData shape.
    // We extract the numeric damage and damage type string from the data bag.
    // The data bag uses two different field names for damage amount depending on the source:
    //   - handleDamage() writes `data.damage`
    //   - DamageCombatLogData also accepts the canonical `data.damageAmount`
    // We check both with nullish coalescing, falling back to 0.
    case CombatMessageType.DAMAGE_DEALT:
    case CombatMessageType.CRITICAL_HIT:
    case CombatMessageType.KILLING_BLOW:
    case CombatMessageType.ENVIRONMENTAL_DAMAGE: {
      const damage = data?.damageAmount ?? data?.damage ?? 0;
      const damageType = data?.damageType ?? '';
      const isCritical = Boolean(data?.isCritical ?? data?.isCrit);
      const isResisted = Boolean(data?.resistanceApplied ?? data?.isResisted);
      const isVulnerable = Boolean(data?.vulnerabilityApplied ?? data?.isVulnerable);
      const isImmune = Boolean(data?.immunityApplied ?? data?.isImmune);
      const defenseTags = (data?.defenseTags as string[] | undefined) ?? [];

      return {
        rawValue: damage,
        formattedValue: damageType ? `${damage} ${damageType}` : `${damage}`,
        damageType: damageType || 'untyped',
        // Opportunity attack logs and newer damage producers can carry structured crit data.
        // Older logs omit it, so the adapter stays backward compatible by defaulting false.
        isCritical,
        isSneakAttack: false,
        resistanceApplied: isResisted,
        vulnerabilityApplied: isVulnerable,
        isResisted,
        isVulnerable,
        isImmune,
        immunityApplied: isImmune,
        resistedDamageType: data?.resistedDamageType,
        vulnerableDamageType: data?.vulnerableDamageType,
        immuneDamageType: data?.immuneDamageType,
        defenseTags: defenseTags.length > 0 ? defenseTags : undefined,
        defenseMultiplier: data?.defenseMultiplier,
      } satisfies DamageMessageData;
    }

    // --- Heal payloads ---
    // The heal amount also uses two field names: `healAmount` (canonical) and `heal` (legacy).
    case CombatMessageType.HEALING_RECEIVED: {
      const heal = data?.healAmount ?? data?.heal ?? 0;
      const source = data?.source ?? '';
      return {
        rawValue: heal,
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
      const statusName = resolveStatusName(entry);
      return {
        rawValue: statusName,
        formattedValue: statusName,
        statusName,
        // agora-6acd: 'condition' is now the honest "no kind was found" answer, not the only answer.
        statusType: discriminator?.statusType ?? 'condition',
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
  const { mapping, discriminator } = classifyEntry(entry, characters);

  // Step 2: Build data payload — extract the record's structured display fields.
  const dataPayload = buildDataPayload(entry, mapping, discriminator);

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
    const sourceName = entry.data.source;
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
    // CMB-GAP-003/004: the class is carried through so consumers can branch on the event
    // itself rather than re-deriving it, and the VISUAL_EFFECT / AUDIO_CUE channels now
    // ship a named payload instead of being an empty declaration.
    eventClass: mapping.eventClass,
    visualEffect: mapping.visualEffect,
    soundCue: mapping.soundCue,
  };
}
