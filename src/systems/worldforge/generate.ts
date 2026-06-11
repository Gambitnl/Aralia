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
import {
  AnyWorldforgeArtifact,
  LayerId,
  WORLDFORGE_SCHEMA_VERSION,
  WorldforgeArtifact,
} from './artifacts';

/**
 * One layer's generator. TParent is null only for the root layer (atlas),
 * which derives solely from the world seed.
 */
export interface LayerGenerator<
  TParent extends WorldforgeArtifact | null,
  TArtifact extends WorldforgeArtifact,
> {
  layer: LayerId;
  generate(parent: TParent, seedPath: SeedPath, bounds: BoundsFt): TArtifact;
}

/**
 * Registry keyed by layer. A plain map (not DI) — generators are singletons
 * by design; swapping one (e.g. a debug generator) is an explicit test-time
 * act via registerGenerator.
 */
const registry = new Map<
  LayerId,
  LayerGenerator<WorldforgeArtifact | null, AnyWorldforgeArtifact>
>();

export function registerGenerator(
  generator: LayerGenerator<never, AnyWorldforgeArtifact>,
): void {
  registry.set(
    generator.layer,
    generator as unknown as LayerGenerator<WorldforgeArtifact | null, AnyWorldforgeArtifact>,
  );
}

export function getGenerator(
  layer: LayerId,
): LayerGenerator<WorldforgeArtifact | null, AnyWorldforgeArtifact> | undefined {
  return registry.get(layer);
}

/** Test/tooling hook: clear all registrations. */
export function clearGenerators(): void {
  registry.clear();
}

/**
 * Stamp the common artifact envelope. Generators call this so version/path/
 * bounds discipline lives in one place.
 */
export function makeArtifactEnvelope(
  layer: LayerId,
  seedPath: SeedPath,
  bounds: BoundsFt,
): WorldforgeArtifact {
  return {
    layer,
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath,
    bounds,
  };
}
