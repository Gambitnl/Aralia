/**
 * @file generateEntityBlueprint.ts — recipe → fully resolved EntityBlueprint.
 *
 * Pure data, deterministic. Randomness comes only from seedPath streams, one
 * per concern, so adding draws to one concern never perturbs another:
 *   frame    — height/bulk jitter inside the species or size band
 *   palette  — skin and eye tone picks
 * Gear and features are data joins (race profile + class kit), not draws.
 */
import { ALL_RACES_DATA } from '../../data/races';
import { CLASSES_DATA } from '../../data/classes';
import { makeSeedPath, rngFromPath, streamPath, fnv1a } from '../worldforge/seedPath';
import type { SeedPath } from '../worldforge/seedPath';
import type { EntityBlueprint, EntityRecipe } from './types';
import { deriveFrame } from './types';
import { profileForRace } from './raceMap';
import { kitForClass } from './classKits';
import { profileForCreature } from './creatureProfiles';

function entityPath(seed: string): SeedPath {
  // Seed strings are user-facing; hash them into one clean path segment.
  return makeSeedPath(fnv1a(seed), `entity:${fnv1a(`salt:${seed}`)}`);
}

function uniform(rng: { next(): number }, lo: number, hi: number): number {
  return lo + rng.next() * (hi - lo);
}

function pick<T>(rng: { next(): number }, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length) % items.length];
}

export function generateEntityBlueprint(recipe: EntityRecipe): EntityBlueprint {
  const base = entityPath(recipe.seed);
  const frameRng = rngFromPath(streamPath(base, 'frame'));
  const paletteRng = rngFromPath(streamPath(base, 'palette'));

  if (recipe.kind === 'humanoid') {
    const race = ALL_RACES_DATA[recipe.raceId];
    if (!race) {
      throw new Error(`entities3d: unknown race id "${recipe.raceId}"`);
    }
    const cls = CLASSES_DATA[recipe.classId];
    if (!cls) {
      throw new Error(`entities3d: unknown class id "${recipe.classId}"`);
    }
    const profile = profileForRace(recipe.raceId);
    const kit = kitForClass(recipe.classId);
    let heightFt = uniform(frameRng, profile.heightRangeFt[0], profile.heightRangeFt[1]);
    let bulk = uniform(frameRng, profile.bulkRange[0], profile.bulkRange[1]);
    let headScale = profile.headScale;
    if (recipe.ageBand === 'child') {
      heightFt *= 0.62;
      bulk *= 0.9;
      headScale *= 1.3;
    } else if (recipe.ageBand === 'elder') {
      heightFt *= 0.96;
    }
    return {
      gait: profile.gait,
      frame: deriveFrame(profile.gait, heightFt, bulk, headScale),
      palette: {
        skinHex: pick(paletteRng, profile.skinTones),
        eyeHex: pick(paletteRng, profile.eyeTones),
        accentHex: kit.accentHex,
        secondaryHex: kit.secondaryHex,
      },
      parts: [...profile.features, ...(recipe.gearOverride ?? kit.gear)],
      label: `${race.name} ${cls.name}`,
    };
  }

  const resolved = profileForCreature(recipe.creatureType, recipe.size, recipe.cues ?? []);
  const heightFt = resolved.frame.heightFt * uniform(frameRng, 0.92, 1.08);
  const bulk = resolved.frame.bulk * uniform(frameRng, 0.9, 1.1);
  return {
    gait: resolved.gait,
    frame: deriveFrame(resolved.gait, heightFt, bulk, resolved.frame.headScale),
    palette: {
      ...resolved.palette,
      skinHex: pick(paletteRng, resolved.skinTones),
    },
    parts: resolved.parts,
    label: `${recipe.size} ${recipe.creatureType}`,
  };
}
