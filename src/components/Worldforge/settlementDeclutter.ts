// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:41:08
 * Dependents: components/Worldforge/AtlasSvgView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file decides which existing settlements the atlas paints at each zoom.
 *
 * AtlasSvgView calls it with the current viewport and the canonical SVG burg
 * records. The helper never creates, removes, or relocates a settlement: it only
 * selects a deterministic, geographically spaced subset for the current view.
 * Exact burg ids and cells remain owned by the canonical atlas model.
 */
import type {
  AtlasSvgBurg,
  BurgTier,
  DeclutterView,
  LabelObstacle,
} from './atlasSvg';

// ============================================================================
// Zoom-dependent display budgets
// ============================================================================
// Fit view reserves the page for capitals and a sparse city network. Each zoom
// band raises both budgets and unlocks a lower settlement tier. At close zoom,
// viewport culling is enough to keep the DOM bounded, so every on-screen burg
// may appear without discarding any identity from the model.
// ============================================================================

export interface SettlementDisplayBudget {
  maxMarkers: number;
  maxLabels: number;
  showTowns: boolean;
  showVillages: boolean;
  markerSeparationPx: number;
}

/** Return a monotonic detail budget for the rendered viewport and zoom ratio. */
export function settlementDisplayBudget(
  width: number,
  height: number,
  zoomRatio: number,
): SettlementDisplayBudget {
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const safeZoom = Number.isFinite(zoomRatio) ? Math.max(1, zoomRatio) : 1;
  const area = safeWidth * safeHeight;

  // Small panes keep the existing single-label overview contract. Larger panes
  // scale their fit budget with physical screen area, not world population.
  const baseLabels = safeWidth < 360 || safeHeight < 260
    ? 1
    : safeWidth < 420 || safeHeight < 320
      ? Math.max(2, Math.floor(area / 36_000))
      : Math.max(8, Math.floor(area / 44_000));
  const baseMarkers = Math.max(12, Math.floor(area / 30_000));

  if (safeZoom < 1.25) {
    return {
      maxMarkers: baseMarkers,
      maxLabels: baseLabels,
      showTowns: false,
      showVillages: false,
      markerSeparationPx: 18,
    };
  }
  if (safeZoom < 1.65) {
    return {
      maxMarkers: Math.ceil(baseMarkers * 2),
      maxLabels: Math.ceil(baseLabels * 1.5),
      showTowns: false,
      showVillages: false,
      markerSeparationPx: 16,
    };
  }
  if (safeZoom < 2.5) {
    return {
      maxMarkers: baseMarkers * 4,
      maxLabels: baseLabels * 3,
      showTowns: true,
      showVillages: false,
      markerSeparationPx: 13,
    };
  }
  if (safeZoom < 3.5) {
    return {
      maxMarkers: baseMarkers * 8,
      maxLabels: baseLabels * 5,
      showTowns: true,
      showVillages: true,
      markerSeparationPx: 11,
    };
  }
  return {
    maxMarkers: Number.POSITIVE_INFINITY,
    maxLabels: baseLabels * 8,
    showTowns: true,
    showVillages: true,
    markerSeparationPx: 9,
  };
}

// ============================================================================
// Stable, geographically spaced settlement selection
// ============================================================================
// Tier rank supplies political hierarchy. Canonical id breaks ties, which makes
// the result stable even if a worker clone creates new object references.
// Screen-space spacing prevents the chosen subset becoming another dot cloud.
// ============================================================================

const TIER_RANK: Record<BurgTier, number> = {
  capital: 0,
  city: 1,
  town: 2,
  village: 3,
};

export interface VisibleAtlasBurg {
  burg: AtlasSvgBurg;
  modelIndex: number;
  screenX: number;
  screenY: number;
}

/** Select the canonical burg records that are eligible to paint in this view. */
export function selectVisibleBurgs(
  burgs: ReadonlyArray<AtlasSvgBurg>,
  view: DeclutterView,
  width: number,
  height: number,
  budget: SettlementDisplayBudget,
): VisibleAtlasBurg[] {
  const margin = 20;
  const candidates = burgs
    .map((burg, modelIndex) => ({
      burg,
      modelIndex,
      screenX: burg.x * view.k + view.x,
      screenY: burg.y * view.k + view.y,
    }))
    .filter(({ burg, screenX, screenY }) => (
      (burg.tier !== 'town' || budget.showTowns)
      && (burg.tier !== 'village' || budget.showVillages)
      && screenX >= -margin
      && screenX <= width + margin
      && screenY >= -margin
      && screenY <= height + margin
    ))
    .sort((left, right) => (
      TIER_RANK[left.burg.tier] - TIER_RANK[right.burg.tier]
      || left.burg.id - right.burg.id
    ));

  const chosen: VisibleAtlasBurg[] = [];
  const minimumDistanceSquared = budget.markerSeparationPx ** 2;
  for (const candidate of candidates) {
    // Capitals remain the political anchors even if a cramped viewport's
    // nominal marker budget is smaller than the number of states.
    if (candidate.burg.tier !== 'capital' && chosen.length >= budget.maxMarkers) break;
    const tooClose = chosen.some((other) => {
      const dx = candidate.screenX - other.screenX;
      const dy = candidate.screenY - other.screenY;
      return dx * dx + dy * dy < minimumDistanceSquared;
    });
    if (tooClose) continue;
    chosen.push(candidate);
  }
  return chosen;
}

// ============================================================================
// Label collision obstacles
// ============================================================================
// Marker silhouettes become obstacles for state and geographic labels. Their
// canonical anchor is retained so a settlement name may still sit beneath its
// own marker while avoiding every other marker.
// ============================================================================

const BURG_BOX: Record<BurgTier, { width: number; height: number }> = {
  capital: { width: 20, height: 18 },
  city: { width: 16, height: 16 },
  town: { width: 14, height: 14 },
  village: { width: 12, height: 12 },
};

/** Convert visible settlement silhouettes into screen-space label obstacles. */
export function burgLabelObstacles(burgs: ReadonlyArray<VisibleAtlasBurg>): LabelObstacle[] {
  return burgs.map(({ burg, screenX, screenY }) => {
    const box = BURG_BOX[burg.tier];
    return {
      x: screenX - box.width / 2,
      y: screenY - box.height / 2,
      w: box.width,
      h: box.height,
      anchorX: screenX,
      anchorY: screenY,
    };
  });
}

