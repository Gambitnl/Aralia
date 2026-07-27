import type { SpeciesProfile } from './speciesProfiles';
/** Resolve a race id to its fully merged species profile. Throws on unknown ids. */
export declare function profileForRace(raceId: string): SpeciesProfile;
