/** Open shelves keep the canonical furniture footprint and whole-container pick.
 * Their visible goods come only from the household manifest carried by the
 * bridge. Small piles are bounded for rendering; examination keeps exact stock.
 * Geometry is merged by material, built only when the source changes, and freed
 * on unmount. Nothing here grants items, permission, light or game progress.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 14:56:41
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SitePart } from '../../systems/worldforge/bridge/interiorParts';

type V3 = [number, number, number];
type Surface = 'matte' | 'metal' | 'glaze';
export interface ShelfShape {
  kind: 'box' | 'cylinder' | 'ring';
  at: V3;
  size: V3;
  color: string;
  surface: Surface;
  rotateX?: number;
}
type Stock = NonNullable<SitePart['shelfDisplay']>;
const BOOK = '#713e35', PAPER = '#d8ccb0', CLOTH = '#b7a585', IRON = '#64666a';
export const SHELF_ITEM_IDS = new Set([
  'book', 'ledger_book', 'gold_piece', 'silver_piece', 'clay_pot', 'ale_jug', 'tallow_candles',
  'rations', 'sack_of_flour', 'wheel_of_cheese', 'salted_pork', 'linen_shirt',
  'wool_blanket', 'sewing_kit', 'smiths_hammer', 'iron_bar',
]);

/** Coordinates start in an unrotated, room-facing shelf: front is +z. */
export function shelfModel(w: number, h: number, d: number, stock?: Stock) {
  if (![w, h, d].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid shelf dimensions');
  const width = Math.max(w, d), depth = Math.min(w, d), board = Math.min(.035, depth / 6, h / 12);
  const frame: ShelfShape[] = [], goods: ShelfShape[] = [];
  const shape = (list: ShelfShape[], kind: ShelfShape['kind'], at: V3, size: V3,
    color: string, surface: Surface = 'matte', rotateX?: number) => list.push({kind, at, size, color, surface, rotateX});
  const box = (list: ShelfShape[], at: V3, size: V3, color = '#9a8458') => shape(list, 'box', at, size, color);
  for (const sign of [-1, 1]) box(frame, [sign * (width - board) / 2, 0, 0], [board, h, depth]);
  const levels = Array.from({length: 4}, (_, i) => -h / 2 + board / 2 + i * (h - board) / 3);
  for (const y of levels) box(frame, [0, y, 0], [width - 2 * board, board, depth]);
  box(frame, [0, 0, -depth / 2 + board / 4], [width - 2 * board, h - 2 * board, board / 2]);

  const totals = new Map<string, number>();
  for (const entry of stock?.entries ?? []) if (Number.isInteger(entry.qty) && entry.qty > 0) {
    totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + entry.qty);
  }
  const renderedUnits: Record<string, number> = {}, unrepresented: string[] = [];
  let bay = 0;
  // Put library volumes in the bounded visible bays first. Old supplies stay
  // in the exact manifest even when a full shelf cannot display every unit.
  // Shelves without these volumes retain their previous render order.
  const displayed = [...totals].sort(([a],[b]) => Number(b === 'book') - Number(a === 'book'));
  for (const [id, count] of displayed) {
    if (!SHELF_ITEM_IDS.has(id)) { unrepresented.push(id); continue; }
    let remaining = count;
    // Bulky goods use three spaces per bay. Small coins stack twelve high,
    // including current counting-room reserves of up to twenty base silver
    // pieces plus extra draws. Future huge stock still has a fixed mesh budget.
    while (remaining > 0 && bay < 6) {
      const coin = id === 'gold_piece' || id === 'silver_piece';
      const shown = Math.min(remaining, coin ? 12 : 3);
      const x = (bay % 2 ? 1 : -1) * width / 4;
      const y = levels[2 - Math.floor(bay / 2)] + board / 2;
      const z = board / 2;
      bay++;
      renderedUnits[id] = (renderedUnits[id] ?? 0) + shown;
      remaining -= shown;
      for (let unit = 0; unit < shown; unit++) {
        const px = x + (coin ? 0 : (unit - (shown - 1) / 2) * (id === 'ledger_book' || id === 'book' ? .066 : .20));
        const py = y + (coin ? unit * .0035 : 0);
        const b = (at: V3, size: V3, color: string) => box(goods, [px + at[0], py + at[1], z + at[2]], size, color);
        const cyl = (at: V3, top: number, bottom: number, height: number, color: string, surface: Surface = 'matte') =>
          shape(goods, 'cylinder', [px + at[0], py + at[1], z + at[2]], [top, height, bottom], color, surface);
        const ring = (at: V3, radius: number, tube: number, color: string, horizontal = true) =>
          shape(goods, 'ring', [px + at[0], py + at[1], z + at[2]], [radius, tube, 0], color, 'glaze', horizontal ? Math.PI / 2 : 0);
        switch (id) {
          case 'gold_piece': case 'silver_piece':
            cyl([0, .00175, .055], .0155, .0155, .0035, id === 'gold_piece' ? '#cba142' : '#b8babe', 'metal'); break;
          case 'book': case 'ledger_book': {
            const cover = unit % 2 ? '#475968' : BOOK;
            b([0, .165, 0], [.052, .308, .218], PAPER);
            for (const sign of [-1, 1]) b([sign * .029, .165, 0], [.006, .33, .235], cover);
            b([0, .165, .115], [.064, .33, .008], cover);
            b([0, .23, .121], [.042, .007, .003], '#bb9851');
            break;
          }
          case 'clay_pot':
            cyl([0, .065, 0], .082, .060, .13, '#a56f49', 'glaze');
            cyl([0, .132, 0], .067, .067, .003, '#372b22');
            ring([0, .135, 0], .078, .007, '#c18a5d'); break;
          case 'ale_jug':
            cyl([0, .065, 0], .047, .055, .13, '#ad8b60', 'glaze');
            cyl([0, .151, 0], .026, .047, .042, '#ad8b60', 'glaze');
            ring([0, .173, 0], .026, .005, '#c3a57a');
            ring([.057, .095, 0], .043, .008, '#ad8b60', false); break;
          case 'tallow_candles':
            for (let i = 0; i < 3; i++) {
              const height = [.14, .17, .15][i];
              cyl([(i - 1) * .029, height / 2, 0], .014, .014, height, '#dbc995');
              cyl([(i - 1) * .029, height + .004, 0], .001, .001, .008, '#3d3025');
            }
            b([0, .07, 0], [.092, .01, .031], '#766047'); break;
          case 'sack_of_flour':
            cyl([0, .11, 0], .060, .09, .22, CLOTH);
            cyl([0, .23, 0], .035, .045, .02, CLOTH);
            ring([0, .222, 0], .039, .004, '#766047'); break;
          case 'wheel_of_cheese': cyl([0, .035, 0], .09, .09, .07, '#bca45e'); break;
          case 'salted_pork':
            b([0, .04, 0], [.14, .08, .10], '#925c4b');
            b([0, .082, 0], [.14, .004, .10], '#cdbca2'); break;
          case 'rations':
            b([0, .04, 0], [.16, .08, .12], '#a28b65');
            b([0, .042, 0], [.015, .085, .125], '#6d5941'); break;
          case 'linen_shirt': case 'wool_blanket':
            b([0, .025, 0], [.17, .05, .19], id === 'linen_shirt' ? '#c3bba4' : '#80705e');
            b([0, .053, 0], [.16, .006, .18], id === 'linen_shirt' ? '#d3ccb8' : '#94816a'); break;
          case 'sewing_kit':
            b([0, .03, 0], [.13, .06, .10], '#79613f');
            cyl([.025, .078, 0], .016, .016, .035, PAPER); break;
          case 'smiths_hammer':
            b([0, .10, 0], [.018, .20, .024], '#8a6844');
            b([0, .19, 0], [.11, .036, .042], IRON); break;
          case 'iron_bar': b([0, .0125, 0], [.25, .025, .05], IRON); break;
        }
      }
    }
    if (remaining > 0) unrepresented.push(id);
  }
  const front = stock?.front ?? (w >= d ? 'z+' : 'x+');
  const angle = { 'z+': 0, 'x+': Math.PI / 2, 'z-': Math.PI, 'x-': -Math.PI / 2 }[front];
  return {frame, goods, renderedUnits, unrepresented, angle};
}

/** Merge differently colored props by physical material. The scene mirrors
 * canonical depth once at the root, just as it does for the part's position. */
export function shelfGeometry(shapes: ShelfShape[], angle: number, colors = false) {
  const pieces = shapes.map(s => {
    const g = s.kind === 'box' ? new THREE.BoxGeometry(...s.size)
      : s.kind === 'cylinder' ? new THREE.CylinderGeometry(s.size[0], s.size[2], s.size[1], 12)
      : new THREE.TorusGeometry(s.size[0], s.size[1], 5, 12);
    if (s.rotateX) g.rotateX(s.rotateX);
    g.translate(...s.at); g.rotateY(angle);
    if (colors) {
      const color = new THREE.Color(s.color), data = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < data.length; i += 3) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(data, 3));
    }
    return g;
  });
  const merged = mergeGeometries(pieces, false) ?? new THREE.BufferGeometry();
  for (const g of pieces) g.dispose();
  merged.computeBoundingBox();
  return merged;
}

const MATERIALS = {
  matte: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88}),
  metal: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .32, metalness: .8}),
  glaze: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .38}),
};

export function ShelfFrameGeometry({part}: {part: SitePart}) {
  const geometry = useMemo(() => {
    const model = shelfModel(part.w, part.h, part.d, part.shelfDisplay);
    return shelfGeometry(model.frame, model.angle);
  }, [part.w, part.h, part.d, part.shelfDisplay?.front]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" dispose={null} />;
}

export function ShelfContents({part}: {part: SitePart}) {
  const model = useMemo(() => shelfModel(part.w, part.h, part.d, part.shelfDisplay), [part]);
  const groups = useMemo(() => (Object.keys(MATERIALS) as Surface[]).flatMap(surface => {
    const shapes = model.goods.filter(s => s.surface === surface);
    return shapes.length ? [{surface, geometry: shelfGeometry(shapes, model.angle, true)}] : [];
  }), [model]);
  useEffect(() => () => { for (const group of groups) group.geometry.dispose(); }, [groups]);
  return <group name="world3d:shelf-contents" userData={{ownerHomeId: part.shelfDisplay?.ownerHomeId,
    renderedUnits: model.renderedUnits, unrepresented: model.unrepresented}}>
    {groups.map(group => <mesh key={group.surface} geometry={group.geometry} castShadow={false}>
      <primitive object={MATERIALS[group.surface]} attach="material" dispose={null} />
    </mesh>)}
  </group>;
}
