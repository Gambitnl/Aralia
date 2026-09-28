import { describe, expect, it } from 'vitest';
import {
  convertLogEntryToMessage,
  deriveEventClass,
  resolveEventClass,
} from '../combatLogToMessageAdapter';
import { toNotificationDraft } from '../messageFactory';
import {
  COMBAT_EVENT_ROUTING,
  CombatEventClass,
  CombatMessageType,
  MessageChannel,
  MessagePriority,
  getEventRouting,
} from '../../../types/combatMessages';
import type { CombatCharacter, CombatLogEntry, CombatLogEntryInput } from '../../../types/combat';

const characters = [
  { id: 'fighter', name: 'Fighter' },
  { id: 'goblin', name: 'Goblin' },
] as CombatCharacter[];

describe('convertLogEntryToMessage', () => {
  it('classifies critical opportunity attacks from structured log data', () => {
    const entry: CombatLogEntry = {
      id: 'oa-crit',
      timestamp: 1,
      type: 'action',
      message: 'Fighter hits Goblin with Opportunity Attack using Longsword! (20+5=25 vs AC 13)',
      characterId: 'fighter',
      targetIds: ['goblin'],
      data: { isHit: true, isCrit: true, rollResult: 20 },
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.CRITICAL_HIT);
    expect(message.sourceEntityId).toBe('fighter');
    expect(message.targetEntityId).toBe('goblin');
    expect(message.data).toMatchObject({ isCritical: true });
  });

  it('keeps missed opportunity attacks as misses when structured data says no hit', () => {
    const entry: CombatLogEntry = {
      id: 'oa-miss',
      timestamp: 2,
      type: 'action',
      message: 'Fighter misses Opportunity Attack against Goblin using Longsword. (3+5=8 vs AC 13)',
      characterId: 'fighter',
      targetIds: ['goblin'],
      data: { isHit: false, isCrit: false, rollResult: 3 },
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.MISSED_ATTACK);
    expect(message.data).toMatchObject({ rawValue: entry.message });
  });

  it('normalizes canonical and legacy damage amount fields into the rich damage payload', () => {
    const canonicalEntry: CombatLogEntry = {
      id: 'damage-canonical',
      timestamp: 3,
      type: 'damage',
      message: 'Goblin takes 7 fire damage from Fighter.',
      characterId: 'goblin',
      data: { damageAmount: 7, damageType: 'fire', source: 'Fighter' },
    };
    const legacyEntry: CombatLogEntry = {
      id: 'damage-legacy',
      timestamp: 4,
      type: 'damage',
      message: 'Goblin takes 5 cold damage from Fighter.',
      characterId: 'goblin',
      data: { damage: 5, damageType: 'cold', source: 'Fighter' },
    };

    const canonicalMessage = convertLogEntryToMessage(canonicalEntry, characters);
    const legacyMessage = convertLogEntryToMessage(legacyEntry, characters);

    expect(canonicalMessage.type).toBe(CombatMessageType.DAMAGE_DEALT);
    expect(canonicalMessage.sourceEntityId).toBe('fighter');
    expect(canonicalMessage.targetEntityId).toBe('goblin');
    expect(canonicalMessage.data).toMatchObject({
      rawValue: 7,
      formattedValue: '7 fire',
      damageType: 'fire',
    });
    expect(legacyMessage.data).toMatchObject({
      rawValue: 5,
      formattedValue: '5 cold',
      damageType: 'cold',
    });
  });

  it('normalizes canonical and legacy healing amount fields into the rich healing payload', () => {
    const canonicalEntry: CombatLogEntry = {
      id: 'heal-canonical',
      timestamp: 5,
      type: 'heal',
      message: 'Fighter recovers 6 HP from Cure Wounds.',
      characterId: 'fighter',
      data: { healAmount: 6, source: 'Cure Wounds' },
    };
    const legacyEntry: CombatLogEntry = {
      id: 'heal-legacy',
      timestamp: 6,
      type: 'heal',
      message: 'Fighter recovers 4 HP from Second Wind.',
      characterId: 'fighter',
      data: { heal: 4, source: 'Second Wind' },
    };

    const canonicalMessage = convertLogEntryToMessage(canonicalEntry, characters);
    const legacyMessage = convertLogEntryToMessage(legacyEntry, characters);

    expect(canonicalMessage.type).toBe(CombatMessageType.HEALING_RECEIVED);
    expect(canonicalMessage.data).toMatchObject({
      rawValue: 6,
      formattedValue: '6 HP',
      spellName: 'Cure Wounds',
    });
    expect(legacyMessage.data).toMatchObject({
      rawValue: 4,
      formattedValue: '4 HP',
      spellName: 'Second Wind',
    });
  });

  it('accepts the existing movement record and keeps it as a routine ability message', () => {
    // `satisfies` checks the producer-facing category contract without widening
    // movement into a generic object before the log assigns its ID and timestamp.
    const input = {
      type: 'movement',
      message: 'Guardian moves to protect Fighter.',
      characterId: 'fighter',
      data: {
        guardianId: 'guardian',
        moveReason: 'intercept',
        position: { x: 3, y: 4 },
      },
    } satisfies CombatLogEntryInput;
    const entry: CombatLogEntry = {
      id: 'movement-entry',
      timestamp: 7,
      ...input,
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.ABILITY_USED);
    expect(message.sourceEntityId).toBe('fighter');
    expect(message.data).toMatchObject({ rawValue: input.message });
  });

  it('translates structured resistance and vulnerability metadata into the rich message payload', () => {
    const resistedEntry: CombatLogEntry = {
      id: 'damage-resisted',
      timestamp: 8,
      type: 'damage',
      message: 'Goblin takes 6 fire damage from Fighter [Resisted: Fire (-50%)].',
      characterId: 'goblin',
      data: {
        damageAmount: 6,
        damageType: 'fire',
        source: 'Fighter',
        isResisted: true,
        resistanceApplied: true,
        defenseTags: ['[Resisted: Fire (-50%)]'],
      },
    };

    const vulnerableEntry: CombatLogEntry = {
      id: 'damage-vulnerable',
      timestamp: 9,
      type: 'damage',
      message: 'Goblin takes 24 radiant damage from Fighter [Vulnerable: Radiant (+100%)].',
      characterId: 'goblin',
      data: {
        damageAmount: 24,
        damageType: 'radiant',
        source: 'Fighter',
        isVulnerable: true,
        vulnerabilityApplied: true,
        defenseTags: ['[Vulnerable: Radiant (+100%)]'],
      },
    };

    const resistedMessage = convertLogEntryToMessage(resistedEntry, characters);
    const vulnerableMessage = convertLogEntryToMessage(vulnerableEntry, characters);

    expect(resistedMessage.data).toMatchObject({
      rawValue: 6,
      damageType: 'fire',
      resistanceApplied: true,
      isResisted: true,
      defenseTags: ['[Resisted: Fire (-50%)]'],
    });

    expect(vulnerableMessage.data).toMatchObject({
      rawValue: 24,
      damageType: 'radiant',
      vulnerabilityApplied: true,
      isVulnerable: true,
      defenseTags: ['[Vulnerable: Radiant (+100%)]'],
    });
  });

  // CMB-GAP-002: useCombatEngine.handleDamage emits the defense flags without
  // baking tag text into the message. This guards the untagged path end to end,
  // so the CombatLog badge has metadata to render from.
  it('carries resistance metadata through even when the message text has no defense tags', () => {
    const entry: CombatLogEntry = {
      id: 'damage-resisted-untagged',
      timestamp: 11,
      type: 'damage',
      message: 'Goblin takes 6 fire damage from Fighter',
      characterId: 'goblin',
      data: {
        damageAmount: 6,
        damageType: 'fire',
        source: 'Fighter',
        isResisted: true,
        resistanceApplied: true,
        resistedDamageType: 'fire',
      },
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.DAMAGE_DEALT);
    expect(message.data).toMatchObject({
      isResisted: true,
      resistanceApplied: true,
      resistedDamageType: 'fire',
      isVulnerable: false,
      isImmune: false,
    });
    expect(message.description).not.toMatch(/\[Resisted:/i);
  });

  it('translates structured immunity metadata into the rich message payload', () => {
    const immuneEntry: CombatLogEntry = {
      id: 'damage-immune',
      timestamp: 10,
      type: 'damage',
      message: 'Goblin takes 0 poison damage from Fighter [Immune: Poison].',
      characterId: 'goblin',
      data: {
        damageAmount: 0,
        damageType: 'poison',
        source: 'Fighter',
        isImmune: true,
        immunityApplied: true,
        defenseTags: ['[Immune: Poison]'],
      },
    };

    const immuneMessage = convertLogEntryToMessage(immuneEntry, characters);

    expect(immuneMessage.data).toMatchObject({
      rawValue: 0,
      damageType: 'poison',
      isImmune: true,
      immunityApplied: true,
      defenseTags: ['[Immune: Poison]'],
    });
  });
});

describe('event classification (CMB-GAP-003)', () => {
  // One row per branch of the legacy string matcher, so a copy edit that breaks the
  // derivation shim fails here instead of silently downgrading events in the live log.
  const cases: Array<[string, CombatLogEntry, CombatEventClass, CombatMessageType]> = [
    [
      'ordinary damage',
      { id: 'd1', timestamp: 1, type: 'damage', message: 'Goblin takes 5 fire damage.', data: { damage: 5 } },
      CombatEventClass.DAMAGE,
      CombatMessageType.DAMAGE_DEALT,
    ],
    [
      'critical damage',
      { id: 'd2', timestamp: 1, type: 'damage', message: 'Goblin takes 12 damage.', data: { damage: 12, isCritical: true } },
      CombatEventClass.CRITICAL_DAMAGE,
      CombatMessageType.CRITICAL_HIT,
    ],
    [
      'killing blow',
      { id: 'd3', timestamp: 1, type: 'damage', message: 'Goblin takes 9 damage and is defeated!', data: { damage: 9, isDeath: true } },
      CombatEventClass.KILL,
      CombatMessageType.KILLING_BLOW,
    ],
    [
      'healing',
      { id: 'h1', timestamp: 1, type: 'heal', message: 'Fighter regains 4 HP.', data: { heal: 4 } },
      CombatEventClass.HEAL,
      CombatMessageType.HEALING_RECEIVED,
    ],
    [
      'death save',
      { id: 's0', timestamp: 1, type: 'status', message: 'Fighter succeeds on a death save.', data: { deathSaves: { successes: 1, failures: 0 } } },
      CombatEventClass.DEATH_SAVE,
      CombatMessageType.STATUS_APPLIED,
    ],
    [
      'successful repeat save',
      { id: 's1', timestamp: 1, type: 'status', message: 'Fighter succeeds on repeat save against Burning!' },
      CombatEventClass.STATUS_RESIST,
      CombatMessageType.STATUS_RESISTED,
    ],
    [
      'failed repeat save',
      { id: 's2', timestamp: 1, type: 'status', message: 'Fighter fails repeat save against Burning.' },
      CombatEventClass.STATUS_SAVE_FAILED,
      CombatMessageType.STATUS_APPLIED,
    ],
    [
      'lost concentration',
      { id: 's3', timestamp: 1, type: 'status', message: 'Wizard lost concentration on Fireball (failed to sustain).' },
      CombatEventClass.STATUS_EXPIRE,
      CombatMessageType.STATUS_EXPIRED,
    ],
    [
      'environmental update',
      { id: 's4', timestamp: 1, type: 'status', message: 'Environmental effects updated.' },
      CombatEventClass.ENVIRONMENTAL,
      CombatMessageType.ENVIRONMENTAL_DAMAGE,
    ],
    [
      'generic condition',
      { id: 's5', timestamp: 1, type: 'status', message: 'Goblin is affected by Burning for 3 rounds' },
      CombatEventClass.STATUS_CHANGE,
      CombatMessageType.STATUS_APPLIED,
    ],
    [
      'combat start',
      { id: 't1', timestamp: 1, type: 'turn_start', message: 'Combat begins! Turn order: Fighter, Goblin' },
      CombatEventClass.COMBAT_ENTER,
      CombatMessageType.COMBAT_ENTER,
    ],
    [
      'round boundary',
      { id: 't2', timestamp: 1, type: 'turn_start', message: 'Round 3 begins!' },
      CombatEventClass.ROUND_START,
      CombatMessageType.ROUND_START,
    ],
    [
      'mid-combat join',
      { id: 't3', timestamp: 1, type: 'turn_start', message: 'Wolf joins the combat! (Init: 15)' },
      CombatEventClass.COMBAT_JOIN,
      CombatMessageType.COMBAT_ENTER,
    ],
    [
      'turn transition',
      { id: 't4', timestamp: 1, type: 'turn_start', message: "Fighter's turn." },
      CombatEventClass.TURN_START,
      CombatMessageType.TURN_START,
    ],
    [
      'turn end',
      { id: 't5', timestamp: 1, type: 'turn_end', message: "Fighter's turn ends." },
      CombatEventClass.TURN_END,
      CombatMessageType.TURN_START,
    ],
    [
      'opportunity attack hit',
      { id: 'a1', timestamp: 1, type: 'action', message: 'Fighter hits Goblin with Opportunity Attack!', data: { isHit: true } },
      CombatEventClass.OPPORTUNITY_ATTACK_HIT,
      CombatMessageType.DAMAGE_DEALT,
    ],
    [
      'opportunity attack miss',
      { id: 'a2', timestamp: 1, type: 'action', message: 'Fighter misses Opportunity Attack against Goblin.' },
      CombatEventClass.MISS,
      CombatMessageType.MISSED_ATTACK,
    ],
    [
      'refused action',
      { id: 'a3', timestamp: 1, type: 'action', message: 'Fighter cannot perform this action.' },
      CombatEventClass.ACTION_BLOCKED,
      CombatMessageType.DEFENDED,
    ],
    [
      'sustained spell',
      { id: 'a4', timestamp: 1, type: 'action', message: 'Wizard sustains Witch Bolt.' },
      CombatEventClass.SPELL_SUSTAIN,
      CombatMessageType.ABILITY_USED,
    ],
    [
      'generic action',
      { id: 'a5', timestamp: 1, type: 'action', message: 'Fighter uses Second Wind.' },
      CombatEventClass.ABILITY,
      CombatMessageType.ABILITY_USED,
    ],
    [
      'movement',
      { id: 'm1', timestamp: 1, type: 'movement', message: 'Guardian moves to protect Fighter.' },
      CombatEventClass.MOVEMENT,
      CombatMessageType.ABILITY_USED,
    ],
    [
      'summon',
      { id: 'u1', timestamp: 1, type: 'summon', message: 'Wizard summons a Spectral Wolf.' },
      CombatEventClass.SUMMON,
      CombatMessageType.ABILITY_USED,
    ],
  ];

  it.each(cases)('derives %s into the expected event class and message type', (_label, entry, expectedClass, expectedType) => {
    expect(deriveEventClass(entry)).toBe(expectedClass);

    const message = convertLogEntryToMessage(entry, characters);
    expect(message.eventClass).toBe(expectedClass);
    expect(message.type).toBe(expectedType);
    expect(message.priority).toBe(COMBAT_EVENT_ROUTING[expectedClass].priority);
    expect(message.channels).toEqual(COMBAT_EVENT_ROUTING[expectedClass].channels);
  });

  it('prefers an eventClass stamped by the emitter over the message text', () => {
    // The text says "misses", which the derivation shim would read as a MISS. A stamped
    // class must win, otherwise emitters gain nothing by declaring their intent.
    const entry: CombatLogEntry = {
      id: 'stamped',
      timestamp: 1,
      type: 'action',
      message: 'Fighter misses Opportunity Attack against Goblin.',
      eventClass: CombatEventClass.CRITICAL_DAMAGE,
    };

    expect(deriveEventClass(entry)).toBe(CombatEventClass.MISS);
    expect(resolveEventClass(entry)).toBe(CombatEventClass.CRITICAL_DAMAGE);
    expect(convertLogEntryToMessage(entry, characters).type).toBe(CombatMessageType.CRITICAL_HIT);
  });

  it('falls back to the UNKNOWN routing row instead of throwing on an unrecognized class', () => {
    expect(getEventRouting(undefined)).toBe(COMBAT_EVENT_ROUTING[CombatEventClass.UNKNOWN]);
    expect(getEventRouting('not_a_real_class' as CombatEventClass).type).toBe(CombatMessageType.ABILITY_USED);
  });
});

describe('channel wiring (CMB-GAP-004/005)', () => {
  it('carries the visual effect and audio cue declared for the event class', () => {
    const critical: CombatLogEntry = {
      id: 'crit-channels',
      timestamp: 1,
      type: 'damage',
      message: 'Goblin takes 18 slashing damage.',
      data: { damage: 18, isCritical: true },
    };

    const message = convertLogEntryToMessage(critical, characters);

    expect(message.channels).toContain(MessageChannel.VISUAL_EFFECT);
    expect(message.channels).toContain(MessageChannel.AUDIO_CUE);
    expect(message.visualEffect).toBe('critical_flash');
    expect(message.soundCue).toBe('combat.critical_impact');
  });

  it('turns a high-priority notification-channel message into a toast draft', () => {
    const kill: CombatLogEntry = {
      id: 'kill-notify',
      timestamp: 1,
      type: 'damage',
      message: 'Goblin takes 9 damage from Fighter and is defeated!',
      data: { damage: 9, isDeath: true, source: 'Fighter' },
    };

    const draft = toNotificationDraft(convertLogEntryToMessage(kill, characters));

    expect(draft).not.toBeNull();
    expect(draft?.type).toBe('warning');
    expect(draft?.message).toBe(kill.message);
  });

  it('does not raise a toast for routine notification-channel traffic', () => {
    // Ordinary damage still declares the NOTIFICATION channel, but sits below the floor,
    // so a normal round does not bury the screen in toasts.
    const routine: CombatLogEntry = {
      id: 'routine-damage',
      timestamp: 1,
      type: 'damage',
      message: 'Goblin takes 3 piercing damage.',
      data: { damage: 3 },
    };

    const message = convertLogEntryToMessage(routine, characters);

    expect(message.channels).toContain(MessageChannel.NOTIFICATION);
    expect(message.priority).toBe(MessagePriority.MEDIUM);
    expect(toNotificationDraft(message)).toBeNull();
  });

  it('does not raise a toast for a log-only event', () => {
    const roundStart: CombatLogEntry = {
      id: 'round-notify',
      timestamp: 1,
      type: 'turn_start',
      message: 'Round 2 begins!',
    };

    expect(toNotificationDraft(convertLogEntryToMessage(roundStart, characters))).toBeNull();
  });

  it('routes every event class to at least the combat log channel', () => {
    for (const eventClass of Object.values(CombatEventClass)) {
      const routing = COMBAT_EVENT_ROUTING[eventClass];
      expect(routing, eventClass).toBeDefined();
      expect(routing.channels, eventClass).toContain(MessageChannel.COMBAT_LOG);
      // A declared channel must carry its payload, and a payload must not be declared
      // without its channel - that mismatch is what made the channel model decorative.
      expect(Boolean(routing.visualEffect), eventClass).toBe(routing.channels.includes(MessageChannel.VISUAL_EFFECT));
      expect(Boolean(routing.soundCue), eventClass).toBe(routing.channels.includes(MessageChannel.AUDIO_CUE));
    }
  });
});
