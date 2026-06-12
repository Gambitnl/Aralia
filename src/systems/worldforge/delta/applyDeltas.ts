// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/06/2026, 03:10:02
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file applyDeltas.ts - replay Worldforge save deltas over generated artifacts.
 *
 * This is the pure merge point for decision #14. Generators rebuild the base
 * artifact from its seed path; then this module applies saved mutations without
 * changing the original input artifact. Today the landed mutation target is
 * LocalArtifact.features, and the envelope is designed so later layers can add
 * their own stable entity keys without changing the ordering contract.
 */
import type {
  AnyWorldforgeArtifact,
  LocalArtifact,
  LocalFeature,
} from '../artifacts';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type DeltaWarning,
  type JsonValue,
  type WorldDelta,
} from './types';

// ---------------------------------------------------------------------------
// Public result
// ---------------------------------------------------------------------------
// Unknown future delta versions are not fatal. The caller receives the best
// artifact this reader can produce plus warnings that can be surfaced in save
// diagnostics.
// ---------------------------------------------------------------------------

export interface ApplyDeltasResult<TArtifact extends AnyWorldforgeArtifact> {
  artifact: TArtifact;
  warnings: DeltaWarning[];
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------
// Deltas are sorted before application by:
//   1. artifactSeedPath
//   2. entityKey
//   3. sequence
//   4. delta id
// This means storage can return the same delta set in any insertion order and
// the replayed artifact will still be identical.
// ---------------------------------------------------------------------------

function compareDeltas(a: WorldDelta, b: WorldDelta): number {
  const byArtifact = a.artifactSeedPath.localeCompare(b.artifactSeedPath);
  if (byArtifact) return byArtifact;

  const byEntity = a.entityKey.localeCompare(b.entityKey);
  if (byEntity) return byEntity;

  const bySequence = a.sequence - b.sequence;
  if (bySequence) return bySequence;

  return a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Cloning
// ---------------------------------------------------------------------------
// LocalArtifact contains typed arrays for terrain. Clone them explicitly so
// the input artifact never changes when a caller replays deltas.
// ---------------------------------------------------------------------------

function cloneFeature(feature: LocalFeature): LocalFeature {
  return {
    ...feature,
    data: feature.data ? { ...feature.data } : undefined,
  };
}

function cloneLocalArtifact(artifact: LocalArtifact): LocalArtifact {
  return {
    ...artifact,
    bounds: { ...artifact.bounds },
    terrain: {
      ...artifact.terrain,
      elevationFt: new Float32Array(artifact.terrain.elevationFt),
      materialIndex: new Uint8Array(artifact.terrain.materialIndex),
      materials: [...artifact.terrain.materials],
    },
    features: artifact.features.map(cloneFeature),
    townPlan: artifact.townPlan
      ? {
          ...artifact.townPlan,
          streets: artifact.townPlan.streets.map((street) => ({
            ...street,
            centerline: street.centerline.map(([x, y]) => [x, y]),
          })),
          plots: artifact.townPlan.plots.map((plot) => ({
            ...plot,
            footprint: plot.footprint.map(([x, y]) => [x, y]),
          })),
        }
      : undefined,
  };
}

function cloneArtifact<TArtifact extends AnyWorldforgeArtifact>(
  artifact: TArtifact,
): TArtifact {
  if (artifact.layer === 'local') {
    return cloneLocalArtifact(artifact) as TArtifact;
  }

  return structuredClone(artifact);
}

// ---------------------------------------------------------------------------
// Feature mutation helpers
// ---------------------------------------------------------------------------
// Add is an upsert: if a feature with that id already exists, the delta replaces
// it. This keeps replay deterministic after a remove/add correction or a save
// repair that re-emits a feature with the same stable key.
// ---------------------------------------------------------------------------

function upsertFeature(features: LocalFeature[], next: LocalFeature): LocalFeature[] {
  const replacement = cloneFeature(next);
  const existingIndex = features.findIndex((feature) => feature.id === next.id);

  if (existingIndex === -1) return [...features, replacement];

  return features.map((feature, index) =>
    index === existingIndex ? replacement : feature,
  );
}

function setFeatureState(
  features: LocalFeature[],
  featureId: number,
  key: string,
  value: JsonValue,
): LocalFeature[] {
  return features.map((feature) => {
    if (feature.id !== featureId) return feature;

    return {
      ...feature,
      data: {
        ...(feature.data ?? {}),
        [key]: value,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Delta application
// ---------------------------------------------------------------------------
// Only deltas whose artifactSeedPath matches the target artifact are applied.
// Deltas for other artifacts are ignored so callers can pass a mixed save-file
// batch and replay the relevant subset against one artifact at a time.
// ---------------------------------------------------------------------------

export function applyDeltas<TArtifact extends AnyWorldforgeArtifact>(
  artifact: TArtifact,
  deltas: WorldDelta[],
): ApplyDeltasResult<TArtifact> {
  const warnings: DeltaWarning[] = [];
  const nextArtifact = cloneArtifact(artifact);

  for (const delta of [...deltas].sort(compareDeltas)) {
    if (delta.artifactSeedPath !== artifact.seedPath) continue;

    if (delta.schemaVersion !== WORLD_DELTA_SCHEMA_VERSION) {
      warnings.push({
        deltaId: delta.id,
        message: `Skipped delta with unsupported schema version ${delta.schemaVersion}.`,
      });
      continue;
    }

    if (delta.opVersion !== WORLD_DELTA_OPERATION_VERSION) {
      warnings.push({
        deltaId: delta.id,
        message: `Skipped delta with unsupported operation version ${delta.opVersion}.`,
      });
      continue;
    }

    if (nextArtifact.layer !== 'local') {
      warnings.push({
        deltaId: delta.id,
        message: `Skipped feature delta for non-local artifact layer ${nextArtifact.layer}.`,
      });
      continue;
    }

    if (delta.operation.kind === 'remove-feature') {
      const featureId = delta.operation.featureId;
      nextArtifact.features = nextArtifact.features.filter(
        (feature) => feature.id !== featureId,
      );
      continue;
    }

    if (delta.operation.kind === 'add-feature') {
      nextArtifact.features = upsertFeature(
        nextArtifact.features,
        delta.operation.feature,
      );
      continue;
    }

    if (delta.operation.kind === 'set-feature-state') {
      nextArtifact.features = setFeatureState(
        nextArtifact.features,
        delta.operation.featureId,
        delta.operation.key,
        delta.operation.value,
      );
      continue;
    }
  }

  return {
    artifact: nextArtifact,
    warnings,
  };
}
