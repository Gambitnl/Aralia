// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/09/2026, 13:54:43
 * Dependents: devtools/buildingIdentityLab/PreviewBuilding3D.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Merge building surfaces and ink edges while retaining each triangle's owner.
 * Positions, normals, colors and physical UVs survive unchanged; picking reads
 * the owner table instead of requiring one GPU draw per architectural piece.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingSceneModel } from '@/systems/world3d/buildingSceneModel';
import { houseSurfaceColor } from '@/components/World3D/townSurfaceTextures';

export function buildingRenderBatches(model: BuildingSceneModel, sources: THREE.BufferGeometry[], wallKey?: string) {
  const groups = new Map<string, { wall: boolean; roughness: number; emissive: string; intensity: number; sources: THREE.BufferGeometry[]; owners: number[] }>();
  const lines: number[] = [];
  model.boxes.forEach((box, index) => {
    const wall = box.kind === 'wall';
    const roughness = box.kind === 'window-pane' ? 0.28 : 0.9;
    const emissive = box.emissive ?? '#000000';
    const intensity = box.emissive ? box.emissiveIntensity ?? 1 : 0;
    const key = `${wall}|${roughness}|${emissive}|${intensity}`;
    let group = groups.get(key);
    if (!group) { group = { wall, roughness, emissive, intensity, sources: [], owners: [] }; groups.set(key, group); }
    const geometry = sources[index].toNonIndexed();
    geometry.translate(box.x, box.z0 + box.h / 2, box.y);
    const color = wall && wallKey ? houseSurfaceColor('wall', wallKey, box.color) : new THREE.Color(box.color);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    group.sources.push(geometry);
    for (let i = 0; i < count / 3; i++) group.owners.push(index);
    const edges = new THREE.EdgesGeometry(geometry, 24);
    const positions = edges.getAttribute('position');
    for (let i = 0; i < positions.count; i++) lines.push(positions.getX(i), positions.getY(i), positions.getZ(i));
    edges.dispose();
  });
  const batches = [...groups.values()].map(({ sources, ...group }) => {
    const geometry = mergeGeometries(sources, false)!;
    sources.forEach(g => g.dispose());
    return { ...group, geometry };
  });
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { batches, edges, dispose: () => { batches.forEach(b => b.geometry.dispose()); edges.dispose(); } };
}
