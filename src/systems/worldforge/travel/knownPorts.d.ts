/**
 * @file src/systems/worldforge/travel/knownPorts.ts
 * Pure helper: extract the set of known port burg ids from an FMG pack.
 *
 * The bridge convention: a port's identity across the naval↔FMG seam is the
 * burg id as a string. `knownPorts` in NavalState holds `String(burg.i)` for
 * every live burg that has a truthy `.port` field.
 */
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
export declare function knownPortsFromPack(pack: PackishForPorts): string[];
export {};
