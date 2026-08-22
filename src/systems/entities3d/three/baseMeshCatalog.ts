/**
 * @file baseMeshCatalog.ts — the licensed base meshes the Part Lab can show
 * as whole-body options beside the procedural body (Remy, 2026-08-21).
 *
 * Files: public/references/basemesh/<id>.glb, produced by
 * tools/entities3d/splitBaseMeshes.mjs from the two Sketchfab packs. Each
 * file is normalized: feet on y = 0, centered on x/z, height 1. Both packs
 * are CC-BY 4.0 — credit lives in CREDITS.md and must ship with any use.
 *
 * No three.js import here: the lab toolbar (eager bundle) reads this list.
 */

export type BaseMeshKind = 'body' | 'head';

export interface BaseMeshDef {
  id: string;
  label: string;
  kind: BaseMeshKind;
  /** Pack the model came from, for the credit line. */
  pack: 'lowpoly-2026' | 'stylized-basemesh';
  /** Triangles after the split (from manifest.json). */
  tris: number;
  note: string;
  /** A `<id>.rigged.glb` exists beside the static file: our 39-bone biped
   * skeleton with Blender bone-heat weights (tools/entities3d/rigBaseMeshes.mjs).
   * The lab drives it through the biped pose sink. */
  rigged?: boolean;
}

export const BASE_MESH_PACKS = {
  'lowpoly-2026': {
    title: 'Lowpoly Basemeshes - 2026 - FBX',
    author: 'Seifert (Peter_Seifert)',
    license: 'CC-BY 4.0',
    source: 'https://sketchfab.com/3d-models/lowpoly-basemeshes-2026-fbx-514ca15af30446ebbacbb56628e26744',
  },
  'stylized-basemesh': {
    title: 'Free Stylized Basemesh for Blender Sculpting',
    author: 'dacancino',
    license: 'CC-BY 4.0',
    source: 'https://sketchfab.com/3d-models/free-stylized-basemesh-for-blender-sculpting-fc45334ab9fd4f24acb91eb7e17222b3',
  },
} as const;

export const BASE_MESHES: readonly BaseMeshDef[] = [
  { id: 'lowpoly-nogender', label: 'lowpoly: no-gender body', kind: 'body', pack: 'lowpoly-2026', tris: 5024, rigged: true, note: 'Headless low-poly body (neck stump); rigged 2026-08-21, head bone floats above the stump.' },
  { id: 'lowpoly-female', label: 'lowpoly: female body', kind: 'body', pack: 'lowpoly-2026', tris: 5348, rigged: true, note: 'Rigged 2026-08-21 with our biped skeleton (Blender bone heat, T-pose bind).' },
  { id: 'lowpoly-male', label: 'lowpoly: male body', kind: 'body', pack: 'lowpoly-2026', tris: 5392, rigged: true, note: 'Rigged 2026-08-21 with our biped skeleton (Blender bone heat, T-pose bind).' },
  { id: 'stylized-figure-a', label: 'stylized: figure A', kind: 'body', pack: 'stylized-basemesh', tris: 48648, rigged: true, note: 'Sculpt basemesh, 39 separate objects. Rigged 2026-08-21 v2: bone heat on a voxel proxy, weights transferred to the shells; arms fitted from the silhouette.' },
  { id: 'stylized-figure-b', label: 'stylized: figure B', kind: 'body', pack: 'stylized-basemesh', tris: 47008, rigged: true, note: 'Sculpt basemesh, 38 separate objects. Rigged 2026-08-21 v2: bone heat on a voxel proxy, weights transferred to the shells; arms fitted from the silhouette.' },
  { id: 'stylized-head-kit', label: 'stylized: head kit', kind: 'head', pack: 'stylized-basemesh', tris: 31308, note: 'Skull, jaw and face, nose, teeth, eyes, lids, neck as separate objects.' },
];

export function baseMeshById(id: string): BaseMeshDef {
  const def = BASE_MESHES.find((m) => m.id === id);
  if (!def) throw new Error(`baseMeshCatalog: unknown base mesh "${id}" (known: ${BASE_MESHES.map((m) => m.id).join(', ')})`);
  return def;
}

export function baseMeshUrl(id: string): string {
  const def = baseMeshById(id);
  // rigged entries load the skinned file; the static split stays for the bake
  return `${import.meta.env.BASE_URL}references/basemesh/${def.id}${def.rigged ? '.rigged' : ''}.glb`;
}
