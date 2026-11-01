/** Beds need to read as a place to sleep rather than a solid blue crate.
 * This renderer replaces only the existing bed's visible box: timber frame,
 * mattress, blanket and pillow all fit its unchanged catalog envelope. The
 * canonical part still owns collision, examination, booking and permissions.
 * Bedding is part of that bed, not newly generated transferable inventory.
 * Like the shelf and altar renderers, it merges geometry once per size and
 * disposes it when replaced. Household-specific luxury remains source work.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 14:12:00
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {SitePart} from '../../systems/worldforge/bridge/interiorParts';

export const BED_MATERIAL = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .92});

/** All positions are relative to the same centered catalog box as collision. */
export function bedGeometry(w: number, h: number, d: number, blanketColor: string,
  facing?: 0 | 90 | 180 | 270): THREE.BufferGeometry {
  if (![w, h, d].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid bed dimensions');
  const width = Math.min(w, d), length = Math.max(w, d);
  // Older worker parts may omit facing. Keep their long axis; current parts
  // carry the original rotation so a 180-degree bed keeps its head end.
  if (facing !== undefined && (facing % 180 === 90) !== (w > d)) throw new Error('Bed facing disagrees with dimensions');
  const angle = facing === undefined ? (w > d ? Math.PI / 2 : 0) : facing * Math.PI / 180;
  const pieces: THREE.BufferGeometry[] = [];
  const timber = '#705037', linen = '#cec3a8';
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) => {
    const piece = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    piece.translate(x, y, z); piece.rotateY(angle);
    const rgb = new THREE.Color(color), values = new Float32Array(piece.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) rgb.toArray(values, i);
    piece.setAttribute('color', new THREE.BufferAttribute(values, 3));
    pieces.push(piece);
  };
  // Feet and side rails leave a visible under-bed gap; the existing solid
  // collision envelope remains conservative rather than admitting crawling.
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) box(side * width * .45, -h * .28, end * length * .44,
      width * .08, h * .44, length * .05, timber);
    box(side * width * .47, -h * .04, 0, width * .06, h * .18, length, timber);
  }
  box(0, -h * .07, 0, width * .90, h * .08, length * .92, timber);
  box(0, 0, -length * .485, width, h, length * .03, timber);
  box(0, -h * .24, length * .485, width, h * .52, length * .03, timber);
  box(0, h * .13, 0, width * .88, h * .30, length * .92, linen);
  box(0, h * .31, length * .12, width * .90, h * .06, length * .67, blanketColor);
  // A folded top edge and a separate pillow make the sleeping surface legible
  // at the ordinary desktop follow distance without enlarging the bed.
  box(0, h * .35, -length * .205, width * .90, h * .025, length * .045, blanketColor);
  box(0, h * .375, -length * .34, width * .67, h * .18, length * .18, '#ded5bf');
  const merged = mergeGeometries(pieces, false)!;
  for (const piece of pieces) piece.dispose();
  merged.computeBoundingBox();
  return merged;
}

export function BedGeometry({part}: {part: SitePart}) {
  const geometry = useMemo(() => bedGeometry(part.w, part.h, part.d, part.colorHex, part.bedFacing),
    [part.w, part.h, part.d, part.colorHex, part.bedFacing]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" dispose={null}/>;
}
