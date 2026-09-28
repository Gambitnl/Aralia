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

export function buildExteriorGeometry(site: Site, wallSurfaceKey = ''): Record<'walls' | 'detail' | 'glass', THREE.BufferGeometry> {
  const buckets = {
    walls: { positions: [] as number[], normals: [] as number[], colors: [] as number[], uvs: [] as number[] },
    detail: { positions: [] as number[], normals: [] as number[], colors: [] as number[], uvs: [] as number[] },
    glass: { positions: [] as number[], normals: [] as number[], colors: [] as number[], uvs: [] as number[] },
  };
  for (const part of site.parts ?? []) {
    if (!isSitePartRenderable(part) || !(EXTERIOR_TAGS.has(part.tag ?? '') || part.lightRole === 'window')) continue;
    const bucket = part.lightRole === 'window' ? buckets.glass : part.tag === 'exterior' ? buckets.walls : buckets.detail;
    const offset = sitePartLocalOffset(part, site.doorZSign ?? -1);
    const indexedBox = new THREE.BoxGeometry(part.w, part.h, part.d);
    const box = indexedBox.toNonIndexed();
    indexedBox.dispose();
    const positions = box.getAttribute('position');
    const normals = box.getAttribute('normal');
    const color = bucket === buckets.walls && wallSurfaceKey
      ? houseSurfaceColor('wall', wallSurfaceKey, part.colorHex) : new THREE.Color(part.colorHex);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + offset.x, y = positions.getY(i) + offset.y, z = positions.getZ(i) + offset.z;
      bucket.positions.push(x, y, z);
      bucket.normals.push(normals.getX(i), normals.getY(i), normals.getZ(i));
      bucket.colors.push(color.r, color.g, color.b);
      // Repeat at physical scale, including over segmented window walls.
      bucket.uvs.push((Math.abs(normals.getX(i)) > 0.5 ? z : x) / 2, (Math.abs(normals.getY(i)) > 0.5 ? z : y) / 2);
    }
    box.dispose();
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, data]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.computeBoundingSphere();
    return [key, geometry];
  })) as Record<'walls' | 'detail' | 'glass', THREE.BufferGeometry>;
}
