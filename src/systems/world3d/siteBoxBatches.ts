// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 18:18:45
 * Dependents: components/World3D/WebGPUProbeScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file converts streamed World3D building boxes into renderer-friendly batches.
 *
 * Worldforge still owns every building, room and furnishing as individual canonical
 * data. This helper only changes their presentation: boxes that share a colour can
 * share one GPU mesh while retaining their own size, position, rotation and stable
 * source identity. WebGPUProbeScene consumes these records when it builds instanced
 * meshes; no generator, collision or gameplay state depends on this file.
 */

import type { LoadedChunk } from './types';
import { isSitePartRenderable } from '../worldforge/bridge/sitePartTransform';

// ============================================================================
// Public batch records
// ============================================================================
// These plain-number records keep Three.js out of the canonical preparation step.
// Tests can therefore prove that batching preserves authored building differences
// without needing a renderer or browser.
// ============================================================================

type StreamedSite = LoadedChunk['bundle']['sites'][number];

export interface SiteBoxBatchInstance {
  /** Stable lookup back to the building and original part index. */
  sourceId: string;
  /** Chunk-local centre after applying the building's authored yaw. */
  x: number;
  y: number;
  z: number;
  /** The building yaw remains per instance, so street alignment stays unique. */
  rotationY: number;
  /** Authored box dimensions in metres. */
  width: number;
  height: number;
  depth: number;
}

export interface SiteBoxBatch {
  /** Exact generated colour used by every box in this draw bucket. */
  colorHex: string;
  instances: SiteBoxBatchInstance[];
}

export type SiteBoxDetail = 'full' | 'shell';

export type ScalableRoofForm = 'gable' | 'hip' | 'steep';

export interface SiteRoofBatchInstance {
  sourceId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  rise: number;
  depth: number;
  colorHex: string;
}

export interface SiteRoofBatch {
  form: ScalableRoofForm;
  instances: SiteRoofBatchInstance[];
}

// ============================================================================
// Site-to-instance conversion
// ============================================================================
// Buildings are grouped only by colour. Their layouts are not normalized or
// replaced: every source box supplies its own transform and dimensions.
// ============================================================================

/** Match the legacy marker palette used by both World3D renderers. */
function markerColor(site: StreamedSite): string {
  if (site.kind === 'town') return '#caa46a';
  if (site.kind === 'dungeon') return '#555555';
  if (site.kind === 'monster') return '#d9534f';
  return '#888888';
}

/** Use one case-insensitive bucket for colours that are visually identical. */
function colorKey(colorHex: string): string {
  return colorHex.trim().toLowerCase();
}

/**
 * Prepare every visible site box for instancing.
 *
 * Detailed buildings keep every renderable part. Legacy buildings keep their
 * footprint shell, and non-building sites keep the same marker cube as before.
 * Marker-only settlement labels remain deliberately geometry-free.
 */
export function buildSiteBoxBatches(
  sites: readonly StreamedSite[],
  detail: SiteBoxDetail = 'full',
): SiteBoxBatch[] {
  const batches = new Map<string, SiteBoxBatch>();

  /** Add one authored box without changing its dimensions or identity. */
  const add = (colorHex: string, instance: SiteBoxBatchInstance): void => {
    const key = colorKey(colorHex);
    let batch = batches.get(key);
    if (!batch) {
      batch = { colorHex, instances: [] };
      batches.set(key, batch);
    }
    batch.instances.push(instance);
  };

  for (const site of sites) {
    // Settlement marker sites still provide labels but intentionally draw no cube.
    if (site.markerOnly) continue;

    const rotationY = site.rotationY ?? 0;
    const hasBuildingBounds = Boolean(site.boxWidth && site.boxDepth && site.boxHeight);

    if (hasBuildingBounds && site.parts && detail === 'full') {
      const cos = Math.cos(rotationY);
      const sin = Math.sin(rotationY);
      const zDirection = -(site.doorZSign ?? -1);

      // Keep the original part index in sourceId even when a tactical-only party
      // wall is skipped. This makes an instance hit traceable to canonical data.
      site.parts.forEach((part, partIndex) => {
        if (!isSitePartRenderable(part)) return;

        const localZ = part.z * zDirection;
        const rotatedX = part.x * cos + localZ * sin;
        const rotatedZ = -part.x * sin + localZ * cos;
        add(part.colorHex, {
          sourceId: `${site.id}:part:${partIndex}`,
          x: site.localX + rotatedX,
          y: site.surfaceY + (part.baseY ?? 0) + part.h * 0.5,
          z: site.localZ + rotatedZ,
          rotationY,
          width: part.w,
          height: part.h,
          depth: part.d,
        });
      });
      continue;
    }

    if (hasBuildingBounds) {
      // Legacy buildings always use their shell. Detailed buildings also use it
      // outside the full-detail LOD ring: their unique footprint, height, yaw,
      // colour and separate authored roof remain visible, while interior boxes
      // that cannot be seen at this distance are left off the GPU.
      add(site.colorHex ?? '#b09a72', {
        sourceId: `${site.id}:${site.parts ? 'lod-shell' : 'shell'}`,
        x: site.localX,
        y: site.surfaceY + site.boxHeight! * 0.5,
        z: site.localZ,
        rotationY,
        width: site.boxWidth!,
        height: site.boxHeight!,
        depth: site.boxDepth!,
      });
      continue;
    }

    // Preserve the old fallback cube for ruins, dungeons and monsters that do
    // not carry an explicit building footprint.
    add(markerColor(site), {
      sourceId: `${site.id}:marker`,
      x: site.localX,
      y: site.surfaceY + site.radius * 0.5,
      z: site.localZ,
      rotationY: 0,
      width: site.radius,
      height: site.radius,
      depth: site.radius,
    });
  }

  return [...batches.values()];
}

/**
 * Group scale-invariant roof forms while preserving every authored dimension.
 *
 * Flat parapets are deliberately excluded: their slab, lip and rim thicknesses
 * are absolute measurements, so scaling a unit mesh would distort the design.
 */
export function buildSiteRoofBatches(sites: readonly StreamedSite[]): SiteRoofBatch[] {
  const batches = new Map<ScalableRoofForm, SiteRoofBatch>();

  for (const site of sites) {
    if (site.markerOnly || !site.boxWidth || !site.boxDepth || !site.boxHeight) continue;
    const form = site.roofForm ?? 'hip';
    if (form === 'flat') continue;

    let batch = batches.get(form);
    if (!batch) {
      batch = { form, instances: [] };
      batches.set(form, batch);
    }

    const width = site.parts && site.wallWidthM
      ? site.wallWidthM + 0.9
      : site.boxWidth * 1.08;
    const depth = site.parts && site.wallDepthM
      ? site.wallDepthM + 0.9
      : site.boxDepth * 1.08;
    batch.instances.push({
      sourceId: `${site.id}:roof`,
      x: site.localX,
      y: site.surfaceY + site.boxHeight,
      z: site.localZ,
      rotationY: site.rotationY ?? 0,
      width,
      rise: Math.max(1.2, Math.min(3, Math.min(width, depth) * 0.5)),
      depth,
      colorHex: site.roofColorHex ?? '#7a4a32',
    });
  }

  return [...batches.values()];
}
