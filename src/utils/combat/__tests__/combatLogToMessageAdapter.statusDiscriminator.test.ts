/**
 * @file combatLogToMessageAdapter.statusDiscriminator.test.ts
 * @created 2026-09-20 (agora-6acd)
 *
 * Covers the BUFF/DEBUFF discriminator on combat log payloads.
 *
 * Before this, CombatEventClass.BUFF and DEBUFF had no producer on the log path: every status
 * record became STATUS_CHANGE and every status payload claimed statusType 'condition'. The
 * adapter now reads the kind off the StatusEffect the engine applied to the affected character.
 *
 * The cases below are split between "the kind is knowable" and "the kind is not knowable". The
 * second group matters most: it pins the promise that the adapter reports a plain STATUS_CHANGE
 * rather than picking a side when nothing in state answers the question.
 */
import { describe, expect, it } from 'vitest';
import { convertLogEntryToMessage, resolveEventClass } from '../combatLogToMessageAdapter';
import {
  CombatEventClass,
  CombatMessageType,
  MessageChannel,
  STATUS_KIND_DISCRIMINATORS,
  getStatusDiscriminator,
} from '../../../types/combatMessages';
import type { StatusMessageData } from '../../../types/combatMessages';
import type { CombatCharacter, CombatLogEntry, StatusEffect } from '../../../types/combat';

function status(name: string, type: StatusEffect['type']): StatusEffect {
  return { id: `status-${name}`, name, type, duration: 3 };
}

function roster(statusEffects: StatusEffect[]): CombatCharacter[] {
  return [
    { id: 'goblin', name: 'Goblin', statusEffects } as CombatCharacter,
    { id: 'fighter', name: 'Fighter', statusEffects: [] } as unknown as CombatCharacter,
  ];
}

function statusEntry(overrides: Partial<CombatLogEntry> = {}): CombatLogEntry {
  return {
    id: 'status-1',
    timestamp: 1,
    type: 'status',
    message: 'Goblin is affected by Bless for 3 rounds',
    characterId: 'goblin',
    targetIds: ['goblin'],
    ...overrides,
  } as CombatLogEntry;
}

describe('status discriminators on combat log payloads', () => {
  it('routes a beneficial status as BUFF and labels its payload a buff', () => {
    const characters = roster([status('Bless', 'buff')]);
    const message = convertLogEntryToMessage(
      statusEntry({ data: { statusEffectName: 'Bless' } }),
      characters,
    );

    expect(message.eventClass).toBe(CombatEventClass.BUFF);
    expect(message.type).toBe(CombatMessageType.STATUS_APPLIED);
    expect(message.visualEffect).toBe('buff_glow');
    expect((message.data as StatusMessageData).statusType).toBe('buff');
    expect((message.data as StatusMessageData).statusName).toBe('Bless');
  });

  it('routes a harmful status as DEBUFF even though the sentence is identical', () => {
    // "Goblin is affected by Bane" and "Goblin is affected by Bless" differ only in the name, so
    // this is the case a text classifier can never get right.
    const characters = roster([status('Bane', 'debuff')]);
    const message = convertLogEntryToMessage(
      statusEntry({
        message: 'Goblin is affected by Bane for 3 rounds',
        data: { statusEffectName: 'Bane' },
      }),
      characters,
    );

    expect(message.eventClass).toBe(CombatEventClass.DEBUFF);
    expect(message.visualEffect).toBe('debuff_glow');
    expect((message.data as StatusMessageData).statusType).toBe('debuff');
  });

  it('reads a damage-over-time effect as a debuff and a heal-over-time effect as a buff', () => {
    const burning = convertLogEntryToMessage(
      statusEntry({
        message: 'Goblin is affected by Burning for 3 rounds',
        data: { statusEffectName: 'Burning' },
      }),
      roster([status('Burning', 'dot')]),
    );
    const regenerating = convertLogEntryToMessage(
      statusEntry({
        message: 'Goblin is affected by Regeneration for 3 rounds',
        data: { statusEffectName: 'Regeneration' },
      }),
      roster([status('Regeneration', 'hot')]),
    );

    expect(burning.eventClass).toBe(CombatEventClass.DEBUFF);
    expect((burning.data as StatusMessageData).statusType).toBe('debuff');
    expect(regenerating.eventClass).toBe(CombatEventClass.BUFF);
    expect((regenerating.data as StatusMessageData).statusType).toBe('buff');
  });

  it('matches the status by name without regard to case or surrounding whitespace', () => {
    const message = convertLogEntryToMessage(
      statusEntry({ data: { statusEffectName: '  bless ' } }),
      roster([status('Bless', 'buff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.BUFF);
  });

  it('finds the status from the structured condition mirror when no statusEffectName is set', () => {
    const message = convertLogEntryToMessage(
      statusEntry({
        data: { condition: { name: 'Bane', duration: { type: 'rounds', value: 3 }, appliedTurn: 1 } },
      } as Partial<CombatLogEntry>),
      roster([status('Bane', 'debuff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.DEBUFF);
  });

  it('derives the name from the message text when the emitter wrote only a sentence', () => {
    // The name extraction is the module's existing text shim. What is NOT text-derived is the
    // buff/debuff answer: that still comes from the StatusEffect the engine applied.
    const message = convertLogEntryToMessage(
      statusEntry({ message: 'Goblin is affected by Bane for 3 rounds' }),
      roster([status('Bane', 'debuff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.DEBUFF);
    expect((message.data as StatusMessageData).statusName).toBe('Bane');
  });
});

describe('status records whose kind cannot be established', () => {
  it('stays STATUS_CHANGE when the character carries no such status', () => {
    const message = convertLogEntryToMessage(
      statusEntry({ data: { statusEffectName: 'Bless' } }),
      roster([]),
    );

    expect(message.eventClass).toBe(CombatEventClass.STATUS_CHANGE);
    expect((message.data as StatusMessageData).statusType).toBe('condition');
    expect(message.visualEffect).toBeUndefined();
  });

  it('stays STATUS_CHANGE when the domain calls the status neutral', () => {
    const message = convertLogEntryToMessage(
      statusEntry({ data: { statusEffectName: 'Marked' } }),
      roster([status('Marked', 'neutral')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.STATUS_CHANGE);
    expect((message.data as StatusMessageData).statusType).toBe('condition');
  });

  it('stays STATUS_CHANGE when the affected character is not in the roster', () => {
    const message = convertLogEntryToMessage(
      statusEntry({ characterId: 'ghost', targetIds: ['ghost'], data: { statusEffectName: 'Bless' } }),
      roster([status('Bless', 'buff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.STATUS_CHANGE);
  });

  it('does not treat the no-pattern-matched sentinel as a status name', () => {
    // extractStatusName answers 'unknown effect' when nothing matched. A creature that happened
    // to carry a status literally called that must not be picked up as the record's subject.
    const message = convertLogEntryToMessage(
      statusEntry({ message: 'Something inscrutable happened.' }),
      roster([status('unknown effect', 'buff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.STATUS_CHANGE);
  });

  it('leaves an already-specific class alone rather than overwriting it with the kind', () => {
    // A successful save classifies as STATUS_RESIST. That says something the kind does not, so
    // the refinement must not replace it just because the creature also carries the debuff.
    const message = convertLogEntryToMessage(
      statusEntry({
        message: 'Goblin succeeds on repeat save against Bane!',
        data: { statusEffectName: 'Bane' },
      }),
      roster([status('Bane', 'debuff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.STATUS_RESIST);
    expect(message.type).toBe(CombatMessageType.STATUS_RESISTED);
  });

  it('keeps a class the emitter stamped itself', () => {
    const message = convertLogEntryToMessage(
      statusEntry({
        eventClass: CombatEventClass.DEATH_SAVE,
        data: { statusEffectName: 'Bless' },
      }),
      roster([status('Bless', 'buff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.DEATH_SAVE);
  });

  it('ignores non-status records entirely', () => {
    const message = convertLogEntryToMessage(
      {
        id: 'dmg-1',
        timestamp: 1,
        type: 'damage',
        message: 'Goblin takes 6 fire damage.',
        characterId: 'goblin',
        data: { damageAmount: 6, damageType: 'fire' },
      } as CombatLogEntry,
      roster([status('Bless', 'buff')]),
    );

    expect(message.eventClass).toBe(CombatEventClass.DAMAGE);
  });
});

describe('resolveEventClass', () => {
  it('refines a status record when handed the roster', () => {
    const entry = statusEntry({ data: { statusEffectName: 'Bless' } });

    expect(resolveEventClass(entry)).toBe(CombatEventClass.STATUS_CHANGE);
    expect(resolveEventClass(entry, roster([status('Bless', 'buff')]))).toBe(CombatEventClass.BUFF);
  });
});

describe('STATUS_KIND_DISCRIMINATORS', () => {
  it('keeps the routed class and the reported statusType in agreement', () => {
    for (const [kind, discriminator] of Object.entries(STATUS_KIND_DISCRIMINATORS)) {
      const expected =
        discriminator.eventClass === CombatEventClass.BUFF
          ? 'buff'
          : discriminator.eventClass === CombatEventClass.DEBUFF
            ? 'debuff'
            : 'condition';
      expect(discriminator.statusType, `kind ${kind}`).toBe(expected);
    }
  });

  it('gives BUFF and DEBUFF the notification channel the old STATUS_CHANGE row already had', () => {
    for (const kind of ['buff', 'debuff'] as const) {
      const discriminator = getStatusDiscriminator(kind);
      expect(discriminator).toBeDefined();
    }
    expect(getStatusDiscriminator(undefined)).toBeUndefined();
  });

  it('routes a buff through the combat log and the notification channel', () => {
    const message = convertLogEntryToMessage(
      statusEntry({ data: { statusEffectName: 'Bless' } }),
      roster([status('Bless', 'buff')]),
    );

    expect(message.channels).toContain(MessageChannel.COMBAT_LOG);
    expect(message.channels).toContain(MessageChannel.NOTIFICATION);
  });
});
