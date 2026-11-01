/** Opt-in attached-water optical experiment on the plain comparison rock.
 * Uses Three's spectrally integrated thin-film material over the same diffuse
 * rock, roughness and lights. Water thickness comes only from the snapshot.
 * This is a conformal coating approximation, not resolved wet-rock microphysics
 * or a replacement for bulk, detached water. The zero mode is a diagnostic.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 17:21:00
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import type { ContactSnapshot, ContactVec3 } from '@/systems/world3d/river/waterfallContactFlow';

export type AttachedFilmMode = 'native' | 'coupled' | 'zero' | 'bare';

export class WaterfallAttachedFilmView {
  readonly mesh: THREE.Mesh;
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.MeshPhysicalNodeMaterial({ color: '#7c817e', roughness: 1,
    metalness: 0, ior: 1.5, iridescence: 1, iridescenceIOR: 1.333,
    side: THREE.DoubleSide, flatShading: true, fog: false });
  private previous: ContactSnapshot | null = null;
  private previousMode: AttachedFilmMode = 'native';
  constructor() {
    // Match the declared plain-rock dielectric (F0=.04), never infer IOR
    // from its diffuse color. Three's Belcour/Barla implementation uses nm.
    this.material.iridescenceThicknessNode = attribute('filmNanometers', 'float');
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'attached-film-optical-study';
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  update(snapshot: ContactSnapshot, mode: AttachedFilmMode, world: (p: ContactVec3) => ContactVec3): void {
    this.mesh.visible = mode === 'coupled' || mode === 'zero';
    if (!this.mesh.visible || this.previous === snapshot && this.previousMode === mode) return;
    const positions: number[] = [], thickness: number[] = [];
    const film = snapshot.film;
    const normal = snapshot.surfaces.find(s => s.id === film?.surfaceId)?.normal;
    if (film && normal) for (const cell of film.cells) {
      if (!(cell.volume > 0)) continue;
      // Retain the inspection's subnormal upload exclusion. No material is
      // removed from the solver, and no minimum visible depth is invented.
      if (Math.abs(Math.fround(cell.height / 2)) < 2 ** -126) continue;
      const h = mode === 'zero' ? 0 : cell.height;
      if (!Number.isFinite(h * 1e9)) throw Error('Nonfinite attached-film optical thickness');
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = cell.corners[i];
        positions.push(...world([p[0]+normal[0]*h,p[1]+normal[1]*h,p[2]+normal[2]*h]));
        thickness.push(h * 1e9);
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    next.setAttribute('filmNanometers', new THREE.Float32BufferAttribute(thickness, 1));
    next.computeVertexNormals();
    this.mesh.geometry = next; this.geometry.dispose(); this.geometry = next;
    this.previous = snapshot; this.previousMode = mode;
  }
  dispose(): void { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
