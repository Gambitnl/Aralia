// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/09/2026, 00:07:24
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Keeps each generated building's actual exterior visible from across town.
 * Walls, openings, shop motifs and roof dressing share three draw calls instead
 * of mounting every furnishing. Canonical dimensions and party-wall ownership
 * remain unchanged; walking inside still mounts the complete interior.
 */
import * as THREE from 'three';
import type { LoadedChunk } from '@/systems/world3d/types';
import { isSitePartRenderable, sitePartLocalOffset } from '@/systems/worldforge/bridge/sitePartTransform';
import { houseSurfaceColor } from './townSurfaceTextures';

type Site = LoadedChunk['bundle']['sites'][number];
const EXTERIOR_TAGS = new Set(['exterior', 'building-material', 'facade', 'motif', 'roof', 'building-ensemble', 'building-weathering', 'building-history']);

type BucketName = 'walls' | 'detail' | 'glass';

/**
 * GG-574 (2026-11-02): the unit box, non-indexed, made once. Every part used to
 * build its own BoxGeometry, call toNonIndexed() and push into JS arrays: in a
 * 653-building town that took about 2.9 s of main-thread time while the chunks
 * mounted. A part now scales this template straight into typed arrays. The
 * output is byte-identical to the old path (same part order, same vertex order,
 * and Math.fround matches the Float32 rounding BoxGeometry applied to w/2).
 */
let unitBox: { positions: Float32Array; normals: Float32Array } | null = null;
function unitBoxTemplate(): { positions: Float32Array; normals: Float32Array } {
  if (!unitBox) {
    const indexed = new THREE.BoxGeometry(1, 1, 1);
    const box = indexed.toNonIndexed();
    unitBox = {
      positions: Float32Array.from(box.getAttribute('position').array as ArrayLike<number>),
      normals: Float32Array.from(box.getAttribute('normal').array as ArrayLike<number>),
    };
    indexed.dispose();
    box.dispose();
  }
  return unitBox;
}

export function buildExteriorGeometry(site: Site, wallSurfaceKey = ''): Record<BucketName, THREE.BufferGeometry> {
  const template = unitBoxTemplate();
  const verts = template.positions.length / 3;
  // Pass 1: choose each part's bucket, so each bucket gets one exact-size array.
  const picked: Array<{ part: NonNullable<Site['parts']>[number]; bucket: BucketName }> = [];
  const counts: Record<BucketName, number> = { walls: 0, detail: 0, glass: 0 };
  for (const part of site.parts ?? []) {
    if (!isSitePartRenderable(part) || !(EXTERIOR_TAGS.has(part.tag ?? '') || part.lightRole === 'window')) continue;
    const bucket: BucketName = part.lightRole === 'window' ? 'glass' : part.tag === 'exterior' ? 'walls' : 'detail';
    picked.push({ part, bucket });
    counts[bucket] += verts;
  }
  const buckets = Object.fromEntries((['walls', 'detail', 'glass'] as const).map((name) => [name, {
    positions: new Float32Array(counts[name] * 3),
    normals: new Float32Array(counts[name] * 3),
    colors: new Float32Array(counts[name] * 3),
    uvs: new Float32Array(counts[name] * 2),
    at: 0,
  }])) as Record<BucketName, { positions: Float32Array; normals: Float32Array; colors: Float32Array; uvs: Float32Array; at: number }>;
  // One color per (bucket, hex): a town reuses a few dozen wall colors.
  const colorCache = new Map<string, THREE.Color>();
  for (const { part, bucket: name } of picked) {
    const bucket = buckets[name];
    const offset = sitePartLocalOffset(part, site.doorZSign ?? -1);
    const tinted = name === 'walls' && !!wallSurfaceKey;
    const colorKey = `${tinted ? 'w' : '-'}|${part.colorHex}`;
    let color = colorCache.get(colorKey);
    if (!color) {
      color = tinted ? houseSurfaceColor('wall', wallSurfaceKey, part.colorHex) : new THREE.Color(part.colorHex);
      colorCache.set(colorKey, color);
    }
    const size = [part.w, part.h, part.d];
    for (let i = 0; i < verts; i++) {
      const x = Math.fround(template.positions[i * 3] * size[0]) + offset.x;
      const y = Math.fround(template.positions[i * 3 + 1] * size[1]) + offset.y;
      const z = Math.fround(template.positions[i * 3 + 2] * size[2]) + offset.z;
      const nx = template.normals[i * 3], ny = template.normals[i * 3 + 1], nz = template.normals[i * 3 + 2];
      const v = bucket.at + i;
      bucket.positions[v * 3] = x; bucket.positions[v * 3 + 1] = y; bucket.positions[v * 3 + 2] = z;
      bucket.normals[v * 3] = nx; bucket.normals[v * 3 + 1] = ny; bucket.normals[v * 3 + 2] = nz;
      bucket.colors[v * 3] = color.r; bucket.colors[v * 3 + 1] = color.g; bucket.colors[v * 3 + 2] = color.b;
      // Repeat at physical scale, including over segmented window walls.
      bucket.uvs[v * 2] = (Math.abs(nx) > 0.5 ? z : x) / 2;
      bucket.uvs[v * 2 + 1] = (Math.abs(ny) > 0.5 ? z : y) / 2;
    }
    bucket.at += verts;
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, data]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geometry.computeBoundingSphere();
    return [key, geometry];
  })) as Record<BucketName, THREE.BufferGeometry>;
}
