/**
 * This script makes implicit spell range/area units explicit in the runtime spell JSON files.
 *
 * It exists because the spell model now supports unit-bearing geometry, but a large part of
 * the live corpus still relies on older numeric fields like `range.distance = 60` or
 * `areaOfEffect.size = 20` without saying whether those numbers are feet, miles, or inches.
 * The glossary and gate checker render from the JSON layer, so the runtime corpus has to carry
 * those units directly instead of relying on formatter assumptions.
 *
 * Called manually during spell-truth normalization.
 * Reads from the spell reference markdown tree in `docs/spells/reference` for
 * structured/canonical unit hints.
 * Writes to the spell JSON tree in `public/data/spells` by adding only missing unit fields.
 */
export {};
