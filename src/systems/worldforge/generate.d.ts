/**
 * @file generate.ts — the Worldforge generator contract + registry.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 ("Handoff contract per layer"):
 *
 *   generate(parentArtifact, seedPath, bounds) → LayerArtifact
 *
 * Generators are pure: same (parent, seedPath, bounds) → identical artifact,
 * forever (decision #14). All randomness must come from rngFromPath /
 * streamPath on the given seedPath — never Math.random, never Date.
 *
 * What changed: new module (build-order item 1).
 * Preserved: nothing replaced; concrete generators land per build order
 * (FMG port = atlas, then region, local, ground).
 */
import { BoundsFt } from './units';
import { SeedPath } from './seedPath';
import { AnyWorldforgeArtifact, LayerId, WorldforgeArtifact } from './artifacts';
/**
 * One layer's generator. TParent is null only for the root layer (atlas),
 * which derives solely from the world seed.
 */
export interface LayerGenerator<TParent extends WorldforgeArtifact | null, TArtifact extends WorldforgeArtifact> {
    layer: LayerId;
    generate(parent: TParent, seedPath: SeedPath, bounds: BoundsFt): TArtifact;
}
export declare function registerGenerator(generator: LayerGenerator<never, AnyWorldforgeArtifact>): void;
export declare function getGenerator(layer: LayerId): LayerGenerator<WorldforgeArtifact | null, AnyWorldforgeArtifact> | undefined;
/** Test/tooling hook: clear all registrations. */
export declare function clearGenerators(): void;
/**
 * Stamp the common artifact envelope. Generators call this so version/path/
 * bounds discipline lives in one place.
 */
export declare function makeArtifactEnvelope(layer: LayerId, seedPath: SeedPath, bounds: BoundsFt): WorldforgeArtifact;
