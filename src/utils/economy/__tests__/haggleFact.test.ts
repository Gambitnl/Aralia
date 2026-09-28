/**
 * @file src/utils/economy/__tests__/haggleFact.test.ts
 * Locks the `recent_haggle` fact contract shared by the merchant action handler
 * and MerchantModal. These are the assertions that make the two surfaces agree:
 * the same text is written, parsed, expired, and priced the same way.
 */
import { describe, it, expect } from 'vitest';
import type { KnownFact } from '../../../types/world';
import {
  HAGGLE_COOLDOWN_MS,
  RECENT_HAGGLE_MARKER,
  activeHagglePriceMultiplier,
  buildHaggleFactText,
  findActiveHaggleFact,
  getPriceMultiplierFromHaggleFactText,
  isHaggleFactText,
  roundToCopper,
} from '../haggleFact';

const fact = (text: string, timestamp: number, lifespan = HAGGLE_COOLDOWN_MS): KnownFact => ({
  id: 'recent_haggle',
  text,
  source: 'direct',
  isPublic: false,
  timestamp,
  strength: 1,
  lifespan,
});

describe('haggle fact text format', () => {
  it('keeps the recent_haggle marker and a parseable priceMultiplier token', () => {
    const text = buildHaggleFactText(0.8, 1_000);
    expect(text.startsWith(RECENT_HAGGLE_MARKER)).toBe(true);
    expect(text).toContain('priceMultiplier=0.8');
    expect(isHaggleFactText(text)).toBe(true);
    expect(getPriceMultiplierFromHaggleFactText(text)).toBe(0.8);
  });

  it('makes two haggles at different times distinct texts (GG-136 dedupes on text)', () => {
    expect(buildHaggleFactText(0.9, 1_000)).not.toBe(buildHaggleFactText(0.9, 2_000));
  });

  it('still parses the pre-2026-09-09 text, which had no at= stamp', () => {
    expect(getPriceMultiplierFromHaggleFactText('recent_haggle priceMultiplier=1.1')).toBe(1.1);
  });

  it('returns undefined rather than NaN for missing or malformed text', () => {
    expect(getPriceMultiplierFromHaggleFactText(undefined)).toBeUndefined();
    expect(getPriceMultiplierFromHaggleFactText('recent_haggle')).toBeUndefined();
    expect(getPriceMultiplierFromHaggleFactText('recent_haggle priceMultiplier=abc')).toBeUndefined();
  });
});

describe('findActiveHaggleFact', () => {
  it('finds a fact whose lifespan has not elapsed', () => {
    const memory = { knownFacts: [fact(buildHaggleFactText(0.9, 0), 0)] };
    expect(findActiveHaggleFact(memory, HAGGLE_COOLDOWN_MS - 1)?.text).toContain('0.9');
  });

  it('ignores an expired fact, so the cooldown really lifts', () => {
    const memory = { knownFacts: [fact(buildHaggleFactText(0.9, 0), 0)] };
    expect(findActiveHaggleFact(memory, HAGGLE_COOLDOWN_MS)).toBeUndefined();
    expect(activeHagglePriceMultiplier(memory, HAGGLE_COOLDOWN_MS)).toBe(1);
  });

  it('ignores non-haggle facts and an absent memory', () => {
    expect(findActiveHaggleFact({ knownFacts: [fact('player owes me coin', 0)] }, 1)).toBeUndefined();
    expect(findActiveHaggleFact(undefined, 1)).toBeUndefined();
  });

  it('prefers the newest active fact when a save accumulated several', () => {
    const memory = {
      knownFacts: [
        fact(buildHaggleFactText(1.1, 0), 0),
        fact(buildHaggleFactText(0.8, 100), 100),
      ],
    };
    expect(activeHagglePriceMultiplier(memory, 200)).toBe(0.8);
  });

  it('falls back to full price when nothing is active', () => {
    expect(activeHagglePriceMultiplier({ knownFacts: [] }, 0)).toBe(1);
  });
});

describe('roundToCopper', () => {
  it('rounds a haggled price to two decimal places', () => {
    expect(roundToCopper(10 * 0.9)).toBe(9);
    expect(roundToCopper(3.333 * 0.8)).toBe(2.67);
  });
});
