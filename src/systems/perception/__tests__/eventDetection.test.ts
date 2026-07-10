/**
 * @file src/systems/perception/__tests__/eventDetection.test.ts
 * Tests for the reusable per-event detection mechanic.
 */

import { describe, it, expect } from 'vitest';
import {
  eventDCForBand,
  EVENT_DIFFICULTY_DCS,
  passivePerceptionOf,
  resolveEventDetection,
  type DetectionObserver,
} from '../eventDetection';
import { SeededRandom } from '../../../utils/random/seededRandom';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A plain NPC with a precomputed passive perception. */
function npc(id: string, passivePerception: number): DetectionObserver {
  return { id, passivePerception };
}

/** A RichNPC-style observer carrying passive perception under `stats`. */
function richNpc(id: string, passivePerception: number): DetectionObserver {
  return { id, stats: { passivePerception } };
}

/**
 * A PlayerCharacter-style observer.
 * Passive perception is computed: 10 + Wisdom mod (+ proficiency if Perception-proficient).
 */
function pc(
  id: string,
  wisdom: number,
  opts: { perceptionProficient?: boolean; level?: number; proficiencyBonus?: number } = {}
): DetectionObserver {
  return {
    id,
    finalAbilityScores: { Wisdom: wisdom },
    skills: opts.perceptionProficient ? [{ id: 'perception' }] : [],
    level: opts.level,
    proficiencyBonus: opts.proficiencyBonus,
  };
}

// ---------------------------------------------------------------------------
// passivePerceptionOf
// ---------------------------------------------------------------------------

describe('passivePerceptionOf', () => {
  it('uses a plain NPC precomputed passivePerception directly', () => {
    expect(passivePerceptionOf(npc('guard', 14))).toBe(14);
  });

  it('uses a RichNPC stats.passivePerception directly', () => {
    expect(passivePerceptionOf(richNpc('elder', 17))).toBe(17);
  });

  it('computes a PC passive perception via the shared passive-score helper', () => {
    // Wisdom 16 => mod +3. Proficient in Perception at level 1 => prof +2.
    // Passive = 10 + 3 + 2 = 15.
    expect(passivePerceptionOf(pc('ranger', 16, { perceptionProficient: true, level: 1 }))).toBe(15);
  });

  it('omits proficiency for a PC without Perception proficiency', () => {
    // Wisdom 14 => mod +2. Not proficient => 10 + 2 + 0 = 12.
    expect(passivePerceptionOf(pc('scholar', 14, { perceptionProficient: false, level: 5 }))).toBe(12);
  });

  it('derives proficiency bonus from level when not supplied (level 5 => +3)', () => {
    // Wisdom 12 => mod +1. Proficient at level 5 => prof +3. Passive = 10 + 1 + 3 = 14.
    expect(passivePerceptionOf(pc('veteran', 12, { perceptionProficient: true, level: 5 }))).toBe(14);
  });

  it('prefers an explicit proficiencyBonus over the level-derived one', () => {
    // Wisdom 10 => mod 0. Explicit prof +4. Passive = 10 + 0 + 4 = 14.
    expect(
      passivePerceptionOf(pc('archmage', 10, { perceptionProficient: true, proficiencyBonus: 4 }))
    ).toBe(14);
  });

  it('throws when no path can resolve a passive perception', () => {
    expect(() => passivePerceptionOf({ id: 'ghost' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Named difficulty bands
// ---------------------------------------------------------------------------

describe('eventDCForBand', () => {
  it('maps bands to their tuned DC values and carries sense/label', () => {
    expect(eventDCForBand('easy')).toEqual({ dc: EVENT_DIFFICULTY_DCS.easy, sense: undefined, label: undefined });
    expect(eventDCForBand('hard', 'sound', 'chanting')).toEqual({ dc: 20, sense: 'sound', label: 'chanting' });
  });
});

// ---------------------------------------------------------------------------
// resolveEventDetection — passive-only mode
// ---------------------------------------------------------------------------

describe('resolveEventDetection (passive-only)', () => {
  it('auto-detects when passive perception >= DC', () => {
    const result = resolveEventDetection([npc('keen', 15)], { dc: 15 });
    expect(result.detections[0]).toMatchObject({ observerId: 'keen', detected: true, method: 'passive' });
    expect(result.detectors).toHaveLength(1);
  });

  it('misses (no roll) when passive perception is below DC', () => {
    const result = resolveEventDetection([npc('dull', 11)], { dc: 15 });
    expect(result.detections[0]).toMatchObject({ observerId: 'dull', detected: false, method: null });
    // No active roll happened in passive-only mode.
    expect(result.detections[0].roll).toBeUndefined();
    expect(result.detectors).toHaveLength(0);
  });

  it('uses an NPC passivePerception field directly to decide', () => {
    const result = resolveEventDetection([npc('sentry', 18)], 16);
    expect(result.detectors.map(d => d.observerId)).toEqual(['sentry']);
  });

  it('resolves a mixed party deterministically: some auto-detect, some miss', () => {
    const observers: DetectionObserver[] = [
      npc('owl', 16), // >= 14 -> detect
      npc('mole', 9), // < 14 -> miss
      richNpc('hawk', 14), // >= 14 -> detect
      pc('novice', 8, { perceptionProficient: false }), // pp = 10 - 1 = 9 -> miss
    ];
    const result = resolveEventDetection(observers, { dc: 14, sense: 'sound' });
    expect(result.detectors.map(d => d.observerId)).toEqual(['owl', 'hawk']);
    expect(result.detections.map(d => d.detected)).toEqual([true, false, true, false]);
  });
});

// ---------------------------------------------------------------------------
// resolveEventDetection — active mode
// ---------------------------------------------------------------------------

describe('resolveEventDetection (active mode)', () => {
  it('requires an rng in active mode', () => {
    expect(() => resolveEventDetection([npc('a', 10)], 15, undefined, { mode: 'active' })).toThrow();
  });

  it('still auto-detects passively before rolling when passive >= DC', () => {
    const rng = new SeededRandom(1);
    const result = resolveEventDetection([npc('keen', 16)], 15, rng, { mode: 'active' });
    expect(result.detections[0]).toMatchObject({ detected: true, method: 'passive' });
    // No roll consumed for an auto-detect.
    expect(result.detections[0].roll).toBeUndefined();
  });

  it('rolls d20 + perception modifier for below-passive observers', () => {
    const rng = new SeededRandom(42);
    // pp 11 -> active modifier +1. Below DC 15, so a roll is made.
    const result = resolveEventDetection([npc('searcher', 11)], 15, rng, { mode: 'active' });
    const det = result.detections[0];
    expect(det.roll).toBeGreaterThanOrEqual(1);
    expect(det.roll).toBeLessThanOrEqual(20);
    expect(det.total).toBe((det.roll ?? 0) + 1);
    expect(det.detected).toBe((det.total ?? 0) >= 15);
    if (det.detected) expect(det.method).toBe('active');
  });

  it('is seed-stable: same seed -> same detectors', () => {
    const observers = [npc('a', 10), npc('b', 12), npc('c', 8)];
    const runA = resolveEventDetection(observers, 15, new SeededRandom(1234), { mode: 'active' });
    const runB = resolveEventDetection(observers, 15, new SeededRandom(1234), { mode: 'active' });
    expect(runA.detectors.map(d => d.observerId)).toEqual(runB.detectors.map(d => d.observerId));
    expect(runA.detections.map(d => d.total)).toEqual(runB.detections.map(d => d.total));
  });

  it('different seeds can produce different detectors', () => {
    const observers = [npc('a', 10), npc('b', 11), npc('c', 12), npc('d', 13)];
    const totalsForSeed = (seed: number) =>
      resolveEventDetection(observers, 16, new SeededRandom(seed), { mode: 'active' })
        .detections.map(d => d.total);
    // Two seeds should not, in general, yield identical roll totals across the party.
    expect(totalsForSeed(1)).not.toEqual(totalsForSeed(9999));
  });
});
