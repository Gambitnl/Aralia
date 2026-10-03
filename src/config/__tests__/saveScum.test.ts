/**
 * @file src/config/__tests__/saveScum.test.ts
 * The save-scum setting (agora-f821.63).
 *
 * The four behaviors Remy's ruling asks for, stated as tests:
 *   1. OFF + the same actions after a reload -> the same rolls.
 *   2. OFF + a different action order -> different rolls.
 *   3. ON -> the dice stream is left exactly as it was (today's behavior).
 *   4. A save written before the setting existed -> ON.
 *
 * "Reload" here is `applyCampaignDiceStream(savedState)`, which is the single
 * call `loadGame` makes when a campaign comes back out of storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  DEFAULT_ALLOW_SAVE_SCUM,
  advanceDiceSaveCounter,
  applyCampaignDiceStream,
  deriveCampaignDiceSeed,
  getAllowSaveScum,
  getDiceSaveCounter,
} from '../saveScum';
import { DiceAuditLog } from '../../systems/dice/rollContract';

/** A saved campaign, reduced to the fields this module reads. */
const savedCampaign = (overrides: Partial<{
  allowSaveScum: boolean;
  diceSaveCounter: number;
  worldSeed: number;
}> = {}) => ({
  worldSeed: 424242,
  diceSaveCounter: 7,
  allowSaveScum: false,
  ...overrides,
});

/** Roll a fixed script of actions through the shared log and keep the totals. */
const rollScript = (notations: string[]): number[] =>
  notations.map((notation, i) =>
    DiceAuditLog.perform({ notation }, { mode: 'silent', context: `step-${i}` }).outcome.total,
  );

const ATTACK_SEQUENCE = ['1d20', '1d8+3', '1d20', '2d6', '1d20+5', '1d4'];

beforeEach(() => {
  DiceAuditLog.clear();
});

describe('getAllowSaveScum', () => {
  it('defaults an old save with no field to today’s behavior', () => {
    expect(DEFAULT_ALLOW_SAVE_SCUM).toBe(true);
    expect(getAllowSaveScum({})).toBe(true);
    expect(getAllowSaveScum(undefined)).toBe(true);
    expect(getAllowSaveScum(null)).toBe(true);
  });

  it('returns a stored choice unchanged', () => {
    expect(getAllowSaveScum({ allowSaveScum: false })).toBe(false);
    expect(getAllowSaveScum({ allowSaveScum: true })).toBe(true);
  });

  it('treats a non-boolean field as absent rather than truthy', () => {
    expect(getAllowSaveScum({ allowSaveScum: 0 as unknown as boolean })).toBe(true);
  });
});

describe('the per-save counter', () => {
  it('starts at zero for a save that predates the field', () => {
    expect(getDiceSaveCounter({})).toBe(0);
    expect(getDiceSaveCounter({ diceSaveCounter: -3 })).toBe(0);
    expect(getDiceSaveCounter({ diceSaveCounter: 1.5 })).toBe(0);
  });

  it('advances on every save', () => {
    expect(advanceDiceSaveCounter({})).toBe(1);
    expect(advanceDiceSaveCounter({ diceSaveCounter: 41 })).toBe(42);
  });

  it('gives two saves of one world different dice streams', () => {
    const first = deriveCampaignDiceSeed(9001, 1);
    const second = deriveCampaignDiceSeed(9001, 2);
    expect(first).not.toBe(second);
  });

  it('derives the same seed from the same world seed and counter', () => {
    expect(deriveCampaignDiceSeed(9001, 4)).toBe(deriveCampaignDiceSeed(9001, 4));
  });

  it('stays inside the range SeededRandom accepts', () => {
    for (let counter = 0; counter < 50; counter += 1) {
      const seed = deriveCampaignDiceSeed(123456789, counter);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThan(2147483647);
    }
  });
});

describe('save-scum OFF', () => {
  it('replays the same rolls for the same actions after a reload', () => {
    const save = savedCampaign();

    applyCampaignDiceStream(save);
    const firstPlaythrough = rollScript(ATTACK_SEQUENCE);

    // Reload the very same save and repeat the very same actions.
    DiceAuditLog.clear();
    applyCampaignDiceStream(save);
    const afterReload = rollScript(ATTACK_SEQUENCE);

    expect(afterReload).toEqual(firstPlaythrough);
  });

  it('gives different rolls when the player takes the actions in a different order', () => {
    const save = savedCampaign();

    applyCampaignDiceStream(save);
    const inOrder = rollScript(ATTACK_SEQUENCE);

    DiceAuditLog.clear();
    applyCampaignDiceStream(save);
    const reordered = rollScript([...ATTACK_SEQUENCE].reverse());

    // The d20s land at different indices in the stream, so the results move.
    expect(reordered).not.toEqual(inOrder);
  });

  it('gives a later save of the same campaign a different stream', () => {
    const earlier = savedCampaign({ diceSaveCounter: 7 });
    const later = savedCampaign({ diceSaveCounter: 8 });

    applyCampaignDiceStream(earlier);
    const fromEarlier = rollScript(ATTACK_SEQUENCE);

    DiceAuditLog.clear();
    applyCampaignDiceStream(later);
    const fromLater = rollScript(ATTACK_SEQUENCE);

    expect(fromLater).not.toEqual(fromEarlier);
  });

  it('installs the seed the world seed and counter derive', () => {
    const save = savedCampaign({ worldSeed: 555, diceSaveCounter: 3 });
    const installed = applyCampaignDiceStream(save);

    expect(installed).toBe(deriveCampaignDiceSeed(555, 3));
    const record = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' });
    expect(record.baseSeed).toBe(installed);
    expect(record.index).toBe(0);
  });

  it('two campaigns with different world seeds do not share dice', () => {
    applyCampaignDiceStream(savedCampaign({ worldSeed: 111 }));
    const worldA = rollScript(ATTACK_SEQUENCE);

    DiceAuditLog.clear();
    applyCampaignDiceStream(savedCampaign({ worldSeed: 222 }));
    const worldB = rollScript(ATTACK_SEQUENCE);

    expect(worldB).not.toEqual(worldA);
  });
});

describe('save-scum ON', () => {
  it('leaves the dice stream alone, so a reload rerolls', () => {
    // Pin a known stream, then "load" a save-scum-allowed campaign over it.
    DiceAuditLog.configure({ baseSeed: 1234 });
    const beforeLoad = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' }).baseSeed;

    const installed = applyCampaignDiceStream(savedCampaign({ allowSaveScum: true }));

    expect(installed).toBeNull();
    const afterLoad = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' });
    // Same base seed, and the index kept counting: nothing was reconfigured.
    expect(afterLoad.baseSeed).toBe(beforeLoad);
    expect(afterLoad.index).toBe(1);
  });

  it('is what a save written before the setting existed gets', () => {
    DiceAuditLog.configure({ baseSeed: 4321 });
    const legacySave = { worldSeed: 99 };

    expect(applyCampaignDiceStream(legacySave)).toBeNull();
    expect(DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' }).baseSeed).toBe(4321);
  });
});
