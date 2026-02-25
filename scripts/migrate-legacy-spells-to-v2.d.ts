/**
 * Migration script: Convert legacy spell JSONs (old flat schema) into V2 spell schema,
 * and move them into `public/data/spells/level-{N}/{id}.json`.
 *
 * Legacy schema typically looks like:
 * { id, name, level, school, castingTime: "1 Action", range: "150 feet", components: {...}, duration: "Instantaneous", description: "..." }
 */
export {};
