/**
 * @file townScale.ts — the ONE population→physical-size rule for towns.
 *
 * 2026-07-22 town-scale lift (Remy: "increase the entire TOWN size"). The old
 * rule (`sqrt(people) × 6`, floor 800 ft) bottomed every town under ~18,000
 * people out at a 244 m square — ~330 people per hectare, roughly 3× denser
 * than a real medieval town — which squeezed wards, streets, and houses to
 * doll-house scale even though people, doors, and storeys were all authored
 * correctly. This module is shared by the canonical town generator (plan
 * placement scale) and the region pass (envelope: flattening pad + gates) so
 * the two can never disagree about how much ground a town claims.
 *
 * Calibration: span ∝ sqrt(people) keeps AREA linear in population, and the
 * multiplier sets the density. The fully history-honest value is ~30
 * (≈105 people/ha), but plot sizes are currently WARD-PROPORTIONAL fractions
 * (townEngine packs plots as a share of ward span, not at a fixed physical
 * frontage), so house size scales linearly with this multiplier: at 30 an
 * 18k-person city grew 23 m mansion footprints and overflowed the 914 m
 * ground window. 12 is the sweet spot until plot packing is physically
 * anchored (a townEngine change, owned by the building-generator campaign):
 * towns roughly double linearly, houses land at 10–13 m (real rowhouse
 * scale), and an 18k-person city spans ~490 m — inside the window.
 *   ≤10,000 people       → floor 1,200 ft (366 m; was 244 m)
 *   18,000 people (city) → 1,610 ft (491 m; was 244 m!)
 *   cap 6,000 ft (1.8 km) — the pre-existing large-city overflow policy.
 */
/**
 * People per FMG population point (FMG `populationRate`, default 1000 — see
 * generateWorld.ts). FMG stores burg `population` in POINTS (~0.01–60); every
 * physical-size and typology rule expects real PEOPLE, so conversions route
 * through this one constant. (Moved here from canonicalTown.ts so the region
 * pass can share it without importing the whole town generator.)
 */
export declare const POPULATION_RATE = 1000;
/** Feet of town span per sqrt(person) — the town-size knob (see header note
 * on why this sits below the history-honest ~30 for now). */
export declare const TOWN_SPAN_FT_PER_SQRT_PERSON = 12;
/** Smallest physical town span (ft) — a loose hamlet, not a shed cluster. */
export declare const TOWN_SPAN_FT_MIN = 1200;
/** Largest physical town span (ft) — unchanged large-city cap; a metropolis
 * already overflows the 3,000 ft ground window by design. */
export declare const TOWN_SPAN_FT_MAX = 6000;
/** Physical town span (feet) for a real population (people, not FMG points). */
export declare function townSpanFtForPeople(people: number): number;
/**
 * Region-pass town envelope HALF-extent (feet): half the physical span plus a
 * working apron (outskirts, gates, the flattened build pad's shoulder). Kept
 * here so the envelope can never again be smaller than the town it must hold.
 */
export declare const TOWN_ENVELOPE_APRON_FT = 200;
export declare function townEnvelopeHalfFtForPeople(people: number): number;
