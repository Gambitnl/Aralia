/** Ground maps put north along negative Z. Translate only the camera's view
 * direction into a compass bearing; neither the body nor its saved pose changes.
 * A vertical or unavailable view has no honest horizontal bearing. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:41:50
 * Dependents: components/World3D/CameraHeadingReporter.tsx, components/World3D/InWorldHUD.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export function bearingFromViewDirection(direction: {x: number; z: number}): number | null {
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.z)
    || Math.hypot(direction.x, direction.z) < 1e-6) return null;
  return (Math.round(Math.atan2(direction.x, -direction.z) * 180 / Math.PI) + 360) % 360;
}

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function compassPointForBearing(degrees: number): string {
  return compassPoints[Math.round(((degrees % 360 + 360) % 360) / 45) % 8];
}
