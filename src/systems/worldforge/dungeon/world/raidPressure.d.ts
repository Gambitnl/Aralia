/** A dungeon raids out to ~8 miles of countryside. Beyond this a site's menace
 * doesn't reach a burg at all (contribution 0). */
export declare const RAID_RADIUS_FT: number;
/**
 * Raid pressure a burg feels from the uncleared dungeons around it, in [0, 1].
 *
 * Contributions from every UNCLEARED site within RAID_RADIUS_FT accumulate
 * probabilistically (so more nearby threats push toward 1 without ever exceeding
 * it), each scaled by a linear distance falloff (1 at the burg, 0 at the radius).
 * Cleared sites contribute nothing; a world with no nearby uncleared sites reads
 * exactly 0.
 *
 * No-fallback: a phantom-0 / removed / unknown burg is a caller bug → throw.
 *
 * @param worldSeed  World seed (drives site enumeration).
 * @param burgId     A live burg id.
 * @param clearedSet Frozen site paths the party has cleared (order-free).
 */
export declare function raidPressureForBurg(worldSeed: number, burgId: number, clearedSet?: Iterable<string>): number;
