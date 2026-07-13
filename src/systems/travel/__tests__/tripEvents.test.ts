import { describe, it, expect } from 'vitest';
import { SeededRandom } from '@/utils/random';
import { TRAVEL_EVENTS } from '../../../data/travelEvents';
import { TRIP_EVENT_CHANCE } from '../../worldforge/mountains/mountainTunables';
import {
  bestPartyCheckTotal,
  governingTripBiome,
  rollTripEvent,
  type TripEventPartyMember,
} from '../tripEvents';

// ── Fixtures ─────────────────────────────────────────────────────────────────
// biomeIdOf maps cell → legacy biome id straight off a lookup table, mirroring
// how MapPane threads `(c) => biomeIdForCell(worldSeed, c)`.
const biomeMap = (ids: Array<string | undefined>) => (cell: number) => ids[cell];
const cells = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A partyCheckTotal stub that always succeeds / always fails, check-agnostic. */
const alwaysPass = () => 100;
const alwaysFail = () => -100;

// Real events the resolution tests pin against (trust the data file).
const whisperingDead = TRAVEL_EVENTS['forest_haunted'].find((e) => e.id === 'whispering_dead')!;
const stolenHour = TRAVEL_EVENTS['forest_fey'].find((e) => e.id === 'stolen_hour')!;

/**
 * Deterministically find a seed whose trip roll lands on the given event
 * (message starts with its description). The scan itself is deterministic, so
 * the test is stable; it just avoids hand-picking PRNG constants.
 */
function seedFor(
  descriptionPrefix: string,
  routeBiomes: string[],
  partyCheckTotal: (skill: string) => number,
  maxSeed = 4000,
): number {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const out = rollTripEvent(
      cells(routeBiomes.length),
      biomeMap(routeBiomes),
      partyCheckTotal,
      new SeededRandom(seed),
    );
    if (out && out.message.startsWith(descriptionPrefix)) return seed;
  }
  throw new Error(`no seed <= ${maxSeed} rolls an event starting with "${descriptionPrefix}"`);
}

// ── Governing biome id (drama priority scan) ────────────────────────────────
describe('governingTripBiome — drama priority', () => {
  it('mountain_crag beats forest_haunted regardless of route order', () => {
    expect(governingTripBiome([0, 1], biomeMap(['forest_haunted', 'mountain_crag']))).toBe('mountain_crag');
    expect(governingTripBiome([0, 1], biomeMap(['mountain_crag', 'forest_haunted']))).toBe('mountain_crag');
  });

  it('forest_haunted beats a non-drama biome (and "general")', () => {
    expect(governingTripBiome([0, 1, 2], biomeMap(['forest_temperate', 'forest_haunted', 'plains_prairie'])))
      .toBe('forest_haunted');
  });

  it('walks the full ordered list: glacier beats fey, fey beats wetland', () => {
    expect(governingTripBiome([0, 1], biomeMap(['forest_fey', 'mountain_glacier']))).toBe('mountain_glacier');
    expect(governingTripBiome([0, 1], biomeMap(['wetland_marsh', 'forest_fey']))).toBe('forest_fey');
  });
});

describe('governingTripBiome — most-frequent non-plains fallback', () => {
  it('picks the most-crossed non-plains id when no drama biome is on the route', () => {
    const route = ['plains_prairie', 'forest_temperate', 'forest_boreal', 'forest_temperate', 'plains_savanna'];
    expect(governingTripBiome(cells(route.length), biomeMap(route))).toBe('forest_temperate');
  });

  it('excludes plains_* even when plains dominate the route', () => {
    const route = ['plains_prairie', 'plains_prairie', 'plains_meadow', 'forest_boreal'];
    expect(governingTripBiome(cells(route.length), biomeMap(route))).toBe('forest_boreal');
  });

  it('falls all the way back to "general" on an all-plains route', () => {
    const route = ['plains_prairie', 'plains_meadow', 'plains_savanna'];
    expect(governingTripBiome(cells(route.length), biomeMap(route))).toBe('general');
  });

  it('a wetland route reaches the wetland pool, not just general (final-review fix)', () => {
    // wetland_marsh is the legacy Wetland id biomeForCell produces; the pool was
    // keyed `swamp` and never matched (substring match: wetland_marsh↔swamp
    // fails), so wetland trips silently drew only `general`. Renamed to `wetland`
    // so wetland_marsh.includes('wetland') hits the pool. seedFor throws if the
    // pool is unreachable, so finding a seed IS the proof.
    const thickFog = TRAVEL_EVENTS['wetland'].find((e) => e.id === 'thick_fog')!;
    const seed = seedFor(thickFog.description, ['wetland_marsh', 'wetland_marsh'], alwaysPass);
    const out = rollTripEvent(cells(2), biomeMap(['wetland_marsh', 'wetland_marsh']), alwaysPass, new SeededRandom(seed));
    expect(out?.message.startsWith(thickFog.description)).toBe(true);
  });

  it('ignores cells with unknown biomes (honest undefined) instead of crashing', () => {
    expect(governingTripBiome([0, 1, 2], biomeMap([undefined, 'mountain_alpine', undefined]))).toBe('mountain_alpine');
    expect(governingTripBiome([0, 1], biomeMap([undefined, undefined]))).toBe('general');
  });
});

// ── Chance gate + determinism ────────────────────────────────────────────────
describe('rollTripEvent — chance gate and determinism', () => {
  const route = ['mountain_crag', 'mountain_alpine', 'forest_temperate'];

  it('fires exactly when the FIRST rng draw clears TRIP_EVENT_CHANCE (one stream)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const gateDraw = new SeededRandom(seed).next();
      const out = rollTripEvent(cells(route.length), biomeMap(route), alwaysPass, new SeededRandom(seed));
      expect(out !== undefined, `seed ${seed}`).toBe(gateDraw <= TRIP_EVENT_CHANCE);
    }
  });

  it('same world + trip → same outcome (pinned determinism)', () => {
    for (const seed of [3, 7, 42, 99, 1234]) {
      const a = rollTripEvent(cells(route.length), biomeMap(route), alwaysPass, new SeededRandom(seed));
      const b = rollTripEvent(cells(route.length), biomeMap(route), alwaysPass, new SeededRandom(seed));
      expect(a).toEqual(b);
    }
  });

  it('different seeds actually vary the outcome (RNG is consumed, not a constant)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const out = rollTripEvent(cells(route.length), biomeMap(route), alwaysPass, new SeededRandom(seed));
      if (out) seen.add(out.message);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('returns undefined for a zero-length or single-cell "trip" without consuming rng', () => {
    // Sea trips are caller-guarded in MapPane (hasSeaLeg); the unit-level guard
    // here is the degenerate no-trip route — no trip, no event, no rng draw.
    const rng = new SeededRandom(42);
    expect(rollTripEvent([], biomeMap([]), alwaysPass, rng)).toBeUndefined();
    expect(rollTripEvent([0], biomeMap(['mountain_crag']), alwaysPass, rng)).toBeUndefined();
    // The stream is untouched: the next draw equals a fresh seed-42 first draw.
    expect(rng.next()).toBe(new SeededRandom(42).next());
  });
});

// ── Skill-check resolution (real haunted fixture) ────────────────────────────
describe('rollTripEvent — skill-check resolution on a real forest_haunted event', () => {
  const route = ['forest_haunted', 'forest_haunted', 'forest_temperate'];
  // whispering_dead: religion DC 13, base effect delay 2h, successEffect delay 0.
  const seed = seedFor(whisperingDead.description, route, alwaysPass);

  it('success branch: message = description + successDescription, delay from successEffect (0h)', () => {
    const out = rollTripEvent(cells(route.length), biomeMap(route), alwaysPass, new SeededRandom(seed));
    expect(out).toBeDefined();
    expect(out!.message).toBe(`${whisperingDead.description} ${whisperingDead.skillCheck!.successDescription}`);
    expect(out!.extraSeconds).toBe(0);
  });

  it('failure branch: message = description + failureDescription, delay falls back to the base effect (2h)', () => {
    // Same seed → same event pick; only the check total differs (the stub does
    // not consume rng, mirroring how the real party-check shares the stream).
    const out = rollTripEvent(cells(route.length), biomeMap(route), alwaysFail, new SeededRandom(seed));
    expect(out).toBeDefined();
    expect(out!.message).toBe(`${whisperingDead.description} ${whisperingDead.skillCheck!.failureDescription}`);
    expect(out!.extraSeconds).toBe(2 * 3600);
  });

  it('the party check receives the event\'s own skill (religion for whispering_dead)', () => {
    const skillsAsked: string[] = [];
    rollTripEvent(
      cells(route.length),
      biomeMap(route),
      (skill) => { skillsAsked.push(skill); return 100; },
      new SeededRandom(seed),
    );
    expect(skillsAsked).toEqual(['religion']);
  });
});

describe('rollTripEvent — checkless event delay math (real forest_fey fixture)', () => {
  it('stolen_hour applies its flat 1h delay with no check consulted', () => {
    const route = ['forest_fey', 'forest_fey'];
    const skillsAsked: string[] = [];
    const spyCheck = (skill: string) => { skillsAsked.push(skill); return 0; };
    const seed = seedFor(stolenHour.description, route, spyCheck);
    skillsAsked.length = 0;
    const out = rollTripEvent(cells(route.length), biomeMap(route), spyCheck, new SeededRandom(seed));
    expect(out).toBeDefined();
    expect(out!.message).toBe(stolenHour.description);
    expect(out!.extraSeconds).toBe(3600);
    expect(skillsAsked).toEqual([]);
  });
});

// ── bestPartyCheckTotal (generalized partySurvivalModifier) ─────────────────
describe('bestPartyCheckTotal — d20 + the party\'s best modifier for the skill', () => {
  const d20 = (seed: number) => new SeededRandom(seed).nextInt(1, 21);

  it('takes the best member: ability mod + proficiency bonus when proficient', () => {
    const party: TripEventPartyMember[] = [
      // Wis 18 → +4, not proficient in survival.
      { finalAbilityScores: { Wisdom: 18 }, skills: [] },
      // Wis 14 → +2, proficient (+3) → +5: the best navigator leads.
      { finalAbilityScores: { Wisdom: 14 }, skills: [{ id: 'survival' }], proficiencyBonus: 3 },
    ];
    expect(bestPartyCheckTotal(party, 'survival', new SeededRandom(11))).toBe(d20(11) + 5);
  });

  it('maps the skill to its ability via the skills index (athletics → Strength)', () => {
    const party: TripEventPartyMember[] = [
      { finalAbilityScores: { Strength: 20, Wisdom: 3 }, skills: [] }, // Str +5
    ];
    expect(bestPartyCheckTotal(party, 'athletics', new SeededRandom(7))).toBe(d20(7) + 5);
  });

  it('prefers finalAbilityScores over abilityScores, falling back per member', () => {
    const party: TripEventPartyMember[] = [
      { finalAbilityScores: { Intelligence: 18 }, abilityScores: { Intelligence: 8 }, skills: [] }, // +4 (final wins)
    ];
    expect(bestPartyCheckTotal(party, 'arcana', new SeededRandom(5))).toBe(d20(5) + 4);
    const legacyParty: TripEventPartyMember[] = [
      { abilityScores: { Intelligence: 16 }, skills: [] }, // +3 via the abilityScores fallback
    ];
    expect(bestPartyCheckTotal(legacyParty, 'arcana', new SeededRandom(5))).toBe(d20(5) + 3);
  });

  it('defaults the proficiency bonus to 2 when the member carries none', () => {
    const party: TripEventPartyMember[] = [
      { finalAbilityScores: { Dexterity: 10 }, skills: [{ id: 'stealth' }] }, // +0 ability, +2 default prof
    ];
    expect(bestPartyCheckTotal(party, 'stealth', new SeededRandom(13))).toBe(d20(13) + 2);
  });

  it('preserves an honestly weak party (all-negative modifiers stay negative)', () => {
    const party: TripEventPartyMember[] = [
      { finalAbilityScores: { Wisdom: 6 }, skills: [] }, // −2
      { finalAbilityScores: { Wisdom: 4 }, skills: [] }, // −3
    ];
    expect(bestPartyCheckTotal(party, 'survival', new SeededRandom(3))).toBe(d20(3) - 2);
  });

  it('an empty party contributes a 0 modifier (bare d20), and a missing score reads as 10', () => {
    expect(bestPartyCheckTotal([], 'survival', new SeededRandom(21))).toBe(d20(21));
    const party: TripEventPartyMember[] = [{ skills: [] }]; // no scores at all → 10 → +0
    expect(bestPartyCheckTotal(party, 'perception', new SeededRandom(21))).toBe(d20(21));
  });

  it('consumes exactly one d20 draw from the shared trip stream', () => {
    const rng = new SeededRandom(17);
    bestPartyCheckTotal([], 'survival', rng);
    // The next value continues the seed-17 stream at position 2.
    const reference = new SeededRandom(17);
    reference.next();
    expect(rng.next()).toBe(reference.next());
  });
});
