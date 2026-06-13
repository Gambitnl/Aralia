// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 03:51:17
 * Dependents: systems/worldforge/world/worldStore.ts
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
  TownPlan,
} from '../artifacts';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type DeltaWarning,
  type JsonObject,
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

// Copy the town skeleton before replay so plot changes never leak back into
// the generated base artifact the caller passed in.
function cloneTownPlan(townPlan: TownPlan): TownPlan {
  return {
    ...townPlan,
    streets: townPlan.streets.map((street) => ({
      ...street,
      centerline: street.centerline.map(([x, y]) => [x, y]),
    })),
    plots: townPlan.plots.map((plot) => ({
      ...plot,
      footprint: plot.footprint.map(([x, y]) => [x, y]),
    })),
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
    townPlan: artifact.townPlan ? cloneTownPlan(artifact.townPlan) : undefined,
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
// Town mutation helpers
// ---------------------------------------------------------------------------
// Town deltas target the generated TownPlan inside a LocalArtifact. They are
// replayed against the same save envelope as feature deltas. B7 changes the
// pre-release `add-building` payload in place because no shipped saves exist;
// once saves ship, incompatible operation changes must bump the op version.
// ---------------------------------------------------------------------------

// Look up the stable plot id inside the cloned TownPlan.
function findPlot(townPlan: TownPlan, plotId: number): TownPlan['plots'][number] | undefined {
  return townPlan.plots.find((plot) => plot.id === plotId);
}

// Apply role/storey edits while preserving the generated footprint.
function modifyPlot(
  townPlan: TownPlan,
  plotId: number,
  role: string | undefined,
  storeys: number | undefined,
): TownPlan | null {
  if (!findPlot(townPlan, plotId)) return null;

  return {
    ...townPlan,
    plots: townPlan.plots.map((plot) => {
      if (plot.id !== plotId) return plot;

      return {
        ...plot,
        role: role ?? plot.role,
        storeys: storeys ?? plot.storeys,
      };
    }),
  };
}

// Remove the plot from the durable town plan so later interior generation can
// no longer find or generate rooms for it.
function removePlot(townPlan: TownPlan, plotId: number): TownPlan | null {
  if (!findPlot(townPlan, plotId)) return null;

  return {
    ...townPlan,
    plots: townPlan.plots.filter((plot) => plot.id !== plotId),
  };
}

// Add a new plot or replace an existing one. This lets an add-building replay
// repair a placeholder plot into the exact footprint/role/storeys L4 needs.
function upsertPlot(
  townPlan: TownPlan,
  nextPlot: TownPlan['plots'][number],
): TownPlan {
  const existingIndex = townPlan.plots.findIndex((plot) => plot.id === nextPlot.id);
  const replacement = {
    ...nextPlot,
    footprint: nextPlot.footprint.map(([x, y]) => [x, y] as [number, number]),
  };

  if (existingIndex === -1) {
    return {
      ...townPlan,
      plots: [...townPlan.plots, replacement],
    };
  }

  return {
    ...townPlan,
    plots: townPlan.plots.map((plot, index) =>
      index === existingIndex ? replacement : plot,
    ),
  };
}

// Average the quad corners to place the optional render/UI marker at the plot
// center. Interiors do not use this marker; they use the TownPlan plot.
function plotCentroid(plot: TownPlan['plots'][number]): { x: number; y: number } {
  const total = plot.footprint.reduce(
    (sum, [x, y]) => ({
      x: sum.x + x,
      y: sum.y + y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / plot.footprint.length,
    y: total.y / plot.footprint.length,
  };
}

// Keep the B6 feature marker as a lightweight handle for local renderers and
// UI queries while the TownPlan plot remains the source of truth for interiors.
function buildBuildingFeature(
  plot: TownPlan['plots'][number],
  buildingId: number,
  featureData: JsonObject | undefined,
): LocalFeature {
  const centroid = plotCentroid(plot);

  return {
    id: buildingId,
    kind: 'building',
    x: centroid.x,
    y: centroid.y,
    data: {
      plotId: plot.id,
      role: plot.role,
      storeys: plot.storeys,
      ...(featureData ?? {}),
    },
  };
}

// JSON-loaded deltas can have bad shapes, so patch values are checked before
// replay instead of trusting the TypeScript union.
function hasValidPlotPatch(role: unknown, storeys: unknown): boolean {
  const roleOk = role === undefined || typeof role === 'string';
  const storeysOk =
    storeys === undefined ||
    (typeof storeys === 'number' && Number.isFinite(storeys));

  return roleOk && storeysOk;
}

// `featureData` must be a plain JSON object because it is persisted inside the
// delta save envelope and copied onto the marker feature.
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Numeric guards reject NaN/Infinity from hand-edited or future-version saves.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// L4 expects a closed four-corner footprint. Reject malformed footprints before
// they can create plots that the interior generator cannot size.
function hasValidFootprint(value: unknown): value is Array<[number, number]> {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        isFiniteNumber(point[0]) &&
        isFiniteNumber(point[1]),
    )
  );
}

// Clone the footprint tuples so the replayed plot owns its geometry.
function cloneFootprint(
  footprint: Array<[number, number]>,
): Array<[number, number]> {
  return footprint.map(([x, y]) => [x, y]);
}

// Resolve the plot footprint for add-building. Explicit footprint wins; an
// existing plot can donate its generated footprint; otherwise x/y plus optional
// width/depth creates a deterministic axis-aligned default.
function defaultBuildingFootprint(
  operation: Extract<WorldDelta['operation'], { kind: 'add-building' }>,
  existingPlot: TownPlan['plots'][number] | undefined,
): Array<[number, number]> | null {
  if (operation.footprint !== undefined) {
    return hasValidFootprint(operation.footprint)
      ? cloneFootprint(operation.footprint)
      : null;
  }

  if (existingPlot) return cloneFootprint(existingPlot.footprint);

  if (!isFiniteNumber(operation.x) || !isFiniteNumber(operation.y)) return null;

  const widthFt =
    operation.widthFt === undefined ? 40 : operation.widthFt;
  const depthFt =
    operation.depthFt === undefined ? widthFt : operation.depthFt;

  if (!isFiniteNumber(widthFt) || !isFiniteNumber(depthFt)) return null;
  if (widthFt <= 0 || depthFt <= 0) return null;

  const halfWidth = widthFt / 2;
  const halfDepth = depthFt / 2;

  return [
    [operation.x - halfWidth, operation.y - halfDepth],
    [operation.x + halfWidth, operation.y - halfDepth],
    [operation.x + halfWidth, operation.y + halfDepth],
    [operation.x - halfWidth, operation.y + halfDepth],
  ];
}

// Validate the L4-facing add-building payload before replaying it. The core
// fields are role, storeys, and a footprint source; extra featureData is only
// carried through to the marker feature.
function hasValidBuildingPayload(
  operation: Extract<WorldDelta['operation'], { kind: 'add-building' }>,
): boolean {
  return (
    isFiniteNumber(operation.plotId) &&
    isFiniteNumber(operation.buildingId) &&
    typeof operation.role === 'string' &&
    operation.role.length > 0 &&
    isFiniteNumber(operation.storeys) &&
    operation.storeys > 0 &&
    (operation.featureData === undefined || isJsonObject(operation.featureData)) &&
    (operation.footprint === undefined || hasValidFootprint(operation.footprint))
  );
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

    if (delta.operation.kind === 'modify-plot') {
      if (!hasValidPlotPatch(delta.operation.role, delta.operation.storeys)) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped modify-plot delta because role/storeys values are malformed.',
        });
        continue;
      }

      if (!nextArtifact.townPlan) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped modify-plot delta because the local artifact has no town plan.',
        });
        continue;
      }

      const changedTownPlan = modifyPlot(
        nextArtifact.townPlan,
        delta.operation.plotId,
        delta.operation.role,
        delta.operation.storeys,
      );

      if (!changedTownPlan) {
        warnings.push({
          deltaId: delta.id,
          message: `Skipped modify-plot delta because plot ${delta.operation.plotId} does not exist.`,
        });
        continue;
      }

      nextArtifact.townPlan = changedTownPlan;
      continue;
    }

    if (delta.operation.kind === 'remove-plot') {
      if (!nextArtifact.townPlan) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped remove-plot delta because the local artifact has no town plan.',
        });
        continue;
      }

      const changedTownPlan = removePlot(nextArtifact.townPlan, delta.operation.plotId);

      if (!changedTownPlan) {
        warnings.push({
          deltaId: delta.id,
          message: `Skipped remove-plot delta because plot ${delta.operation.plotId} does not exist.`,
        });
        continue;
      }

      nextArtifact.townPlan = changedTownPlan;
      continue;
    }

    if (delta.operation.kind === 'add-building') {
      if (!hasValidBuildingPayload(delta.operation)) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped add-building delta because building values are malformed.',
        });
        continue;
      }

      if (!nextArtifact.townPlan) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped add-building delta because the local artifact has no town plan.',
        });
        continue;
      }

      const plot = findPlot(nextArtifact.townPlan, delta.operation.plotId);
      const footprint = defaultBuildingFootprint(delta.operation, plot);

      if (!footprint) {
        warnings.push({
          deltaId: delta.id,
          message: 'Skipped add-building delta because no valid footprint could be resolved.',
        });
        continue;
      }

      const buildingPlot: TownPlan['plots'][number] = {
        id: delta.operation.plotId,
        footprint,
        role: delta.operation.role,
        storeys: delta.operation.storeys,
      };

      // B7 coherence: the TownPlan plot is the durable source for interiors.
      // The LocalFeature marker remains useful for L2/L3 renderers and UI hit
      // tests, but L4 reads the plot above so room generation stays coherent
      // with role, storeys, and footprint deltas.
      nextArtifact.townPlan = upsertPlot(nextArtifact.townPlan, buildingPlot);
      nextArtifact.features = upsertFeature(
        nextArtifact.features,
        buildBuildingFeature(
          buildingPlot,
          delta.operation.buildingId,
          delta.operation.featureData,
        ),
      );
      continue;
    }
  }

  return {
    artifact: nextArtifact,
    warnings,
  };
}
