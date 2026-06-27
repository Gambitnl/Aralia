/**
 * @file src/systems/worldforge/travel/knownPorts.ts
 * Pure helper: extract the set of known port burg ids from an FMG pack.
 *
 * The bridge convention: a port's identity across the naval↔FMG seam is the
 * burg id as a string. `knownPorts` in NavalState holds `String(burg.i)` for
 * every live burg that has a truthy `.port` field.
 */

// Narrow typing — only the fields this module reads from the pack.
// FMG uses a numeric sentinel (0) for removed burgs; the array element type
// is `number | BurgLike` rather than the literal `0` so TypeScript accepts
// plain inline object arrays in callers and test fixtures.
type PackishBurg = {
  i: number;
  port?: number;
  cell?: number;
};

type PackishForPorts = {
  burgs?: Array<number | PackishBurg>;
};

/**
 * Returns the FMG burg ids (as strings) of all live port burgs in the pack,
 * sorted ascending by burg id.
 *
 * Skips `0`-sentinel holes (FMG uses 0 as a removed-burg placeholder) and
 * burgs whose `.port` field is falsy (0, undefined, null).
 */
export function knownPortsFromPack(pack: PackishForPorts): string[] {
  const burgs = pack.burgs ?? [];
  const portIds: number[] = [];

  for (const burg of burgs) {
    if (typeof burg === 'number') continue;  // removed-burg sentinel (0 or any numeric placeholder)
    if (!burg.port) continue;                // not a port (falsy: 0 / undefined / null)
    portIds.push(burg.i);
  }

  portIds.sort((a, b) => a - b);
  return portIds.map(String);
}
