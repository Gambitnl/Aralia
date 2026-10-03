/**
 * @file src/hooks/useUnderdarkLighting.ts
 * Hook to calculate current light levels based on inventory, active spells, and environment.
 *
 * What changed (agora-40bd): the hook used to read inventory only, with a note
 * standing in for the spell-light and cavern-bioluminescence checks. Both
 * checks are now real, and both read data the repo already ships:
 *   - spell light comes from the spell engine's own light records
 *     (`LightSource` in types/combat, written by the UTILITY light effect for
 *     Light, Dancing Lights, Daylight and any other light-granting spell),
 *   - bioluminescence comes from the Underdark biome table
 *     (`UNDERDARK_BIOMES[...].baseLightLevel`).
 *
 * What was preserved: the torch and lantern inventory checks, their radii and
 * durations, and the hook's return shape. The environment argument is
 * optional, so the previous single-argument call form still compiles.
 *
 * What is deliberately NOT here: Faerzress glow. `FaerzressSystem.emitsLight`
 * already owns magical-radiation light and `services/underdarkService` already
 * applies it; restating it here would give two answers to one question.
 *
 * What remains deferred: distance. Neither the old code nor this one checks how
 * far a source is from the party, so a carried bright source still reads as
 * bright light everywhere.
 */
import { Item } from '../types';
import { LightSource as SpellLightSource } from '../types/combat';
import { LightSource, UnderdarkBiomeId } from '../types/underdark';
import { UNDERDARK_BIOMES } from '../data/underdark/biomes';

/** One combat round is 6 seconds, so ten rounds make a minute. */
const ROUNDS_PER_MINUTE = 10;

/**
 * Stand-in duration for a light with no recorded expiry (a spell the engine
 * keeps until dispelled or until concentration breaks). Mirrors
 * `UNTIL_DISPELLED_ROUNDS` in utils/spells/outOfCombatCasting so the two
 * modules write "does not expire on a clock" the same way. A finite sentinel
 * rather than Infinity, because this value is stored and serialized.
 */
export const UNTIL_DISPELLED_MINUTES = 999999;

/**
 * Display names for the light-granting spells the rules call out. Any other
 * spell id that the engine gave a light record still counts as a light
 * source; only its label is derived from the id.
 */
const LIGHT_SPELL_NAMES: Record<string, string> = {
    'light': 'Light',
    'dancing-lights': 'Dancing Lights',
    'daylight': 'Daylight',
};

/**
 * Where each naturally lit Underdark biome's glow comes from. Only 'flora'
 * counts as bioluminescence; magical radiation and lava light a cavern too but
 * are not living light and belong to other systems. Biomes absent from this
 * map are dark (`baseLightLevel` 'darkness' or 'magical_darkness').
 *
 * This table belongs beside the biome data in `data/underdark/biomes.ts` once
 * that file grows a glow-origin field. It lives here for now because the biome
 * records carry no such field yet.
 */
const BIOME_GLOW_ORIGIN: Partial<Record<UnderdarkBiomeId, 'flora' | 'magic' | 'lava'>> = {
    'fungal_forest': 'flora', // Phosphorescent Zurkhwood caps
    'faerzress_pocket': 'magic', // FaerzressSystem owns this glow
    'magma_tube': 'lava', // Radiant heat, not living light
};

/** Ambient radius, in feet, of a bioluminescent cavern's dim glow. */
const BIOLUMINESCENCE_RADIUS = 30;

/**
 * Light source types that never produce a bright core. A cavern's fungal glow
 * lets the party see without ever reading as bright light.
 */
const DIM_ONLY_TYPES = new Set<LightSource['type']>(['bioluminescence']);

/**
 * Everything outside the pack that decides how lit the party is.
 * Every field is optional so callers can adopt the checks one at a time.
 */
export interface UnderdarkLightingEnvironment {
    /**
     * Light records written by the spell engine (`CombatState.activeLightSources`).
     * The engine deletes a record when its spell ends or concentration breaks,
     * so a record's presence here already means the spell is still running.
     */
    spellLightSources?: SpellLightSource[];
    /**
     * Current combat round, used to turn a spell light's `expiresAtRound` into
     * minutes remaining. Without it, a timed spell light's remaining time is
     * unknown, so the source is reported as lasting until dispelled.
     */
    currentRound?: number;
    /** Biome the party stands in; decides bioluminescent flora. */
    biomeId?: UnderdarkBiomeId;
}

/** Readable label for a spell light whose id is not in the name table. */
const labelForSpellId = (spellId: string): string =>
    spellId
        .split(/[-_]/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

/**
 * Minutes left on a spell light. A record with no `expiresAtRound` runs until
 * dispelled; a record that already expired returns 0 and is dropped.
 */
const minutesRemainingForSpellLight = (
    source: SpellLightSource,
    currentRound: number | undefined,
): number => {
    if (source.expiresAtRound === undefined) return UNTIL_DISPELLED_MINUTES;
    if (currentRound === undefined) return UNTIL_DISPELLED_MINUTES;
    const roundsLeft = source.expiresAtRound - currentRound;
    if (roundsLeft <= 0) return 0;
    return roundsLeft / ROUNDS_PER_MINUTE;
};

export const useUnderdarkLighting = (
    inventory: Item[],
    environment: UnderdarkLightingEnvironment = {},
) => {

    const getActiveLightSources = (): LightSource[] => {
        const sources: LightSource[] = [];

        // Check for Torches
        const torches = inventory.filter(i => i.id === 'torch');
        if (torches.length > 0) {
            sources.push({
                id: 'active_torch',
                type: 'torch',
                name: 'Torch',
                radius: 40, // 20 bright + 20 dim
                durationRemaining: 60, // Simplified: assuming fresh torch
                isActive: true
            });
        }

        // Check for Lanterns
        const lanterns = inventory.filter(i => i.id === 'hooded_lantern');
        const oil = inventory.filter(i => i.id === 'oil_flask');
        if (lanterns.length > 0 && oil.length > 0) {
             sources.push({
                id: 'active_lantern',
                type: 'lantern',
                name: 'Hooded Lantern',
                radius: 60, // 30 bright + 30 dim
                durationRemaining: 360,
                isActive: true
            });
        }

        // Check for Spells (Light, Dancing Lights, Daylight, and anything else
        // the UTILITY light effect materialized). The spell engine records
        // bright and dim radii apart; the Underdark model carries one total
        // radius, the same way the torch above sums 20 + 20.
        for (const spellLight of environment.spellLightSources ?? []) {
            const durationRemaining = minutesRemainingForSpellLight(spellLight, environment.currentRound);
            if (durationRemaining <= 0) continue;
            sources.push({
                id: spellLight.id,
                type: 'spell',
                name: LIGHT_SPELL_NAMES[spellLight.sourceSpellId] ?? labelForSpellId(spellLight.sourceSpellId),
                radius: spellLight.brightRadius + spellLight.dimRadius,
                durationRemaining,
                isActive: true
            });
        }

        // Check for Bioluminescence: the cavern's own living light. Read off
        // the shipped biome table instead of restated here, so a biome retuned
        // in data changes the Underdark's lighting with it.
        const biomeId = environment.biomeId;
        if (biomeId && BIOME_GLOW_ORIGIN[biomeId] === 'flora') {
            const biome = UNDERDARK_BIOMES[biomeId];
            if (biome && biome.baseLightLevel !== 'darkness' && biome.baseLightLevel !== 'magical_darkness') {
                sources.push({
                    id: `bioluminescence_${biomeId}`,
                    type: 'bioluminescence',
                    name: biome.name,
                    radius: BIOLUMINESCENCE_RADIUS,
                    durationRemaining: UNTIL_DISPELLED_MINUTES, // Flora does not burn out
                    isActive: true
                });
            }
        }

        return sources;
    };

    const calculateLightLevel = (sources: LightSource[]): 'bright' | 'dim' | 'darkness' => {
        const active = sources.filter(s => s.isActive && s.durationRemaining > 0);
        if (active.length === 0) return 'darkness';

        // Carried and conjured light has a bright core; a cavern's fungal glow
        // never does. Distance is still not modeled, so a bright-core source in
        // the party's hands reads as bright light, as it did before.
        const hasBrightCore = active.some(s => !DIM_ONLY_TYPES.has(s.type));
        return hasBrightCore ? 'bright' : 'dim';
    };

    const activeSources = getActiveLightSources();
    const currentLightLevel = calculateLightLevel(activeSources);

    return {
        activeSources,
        currentLightLevel,
        isInDarkness: currentLightLevel === 'darkness'
    };
};
