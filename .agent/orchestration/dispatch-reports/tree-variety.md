I have a full picture of the pipeline. Here's the diagnosis and proposal.

---

## Diagnosis

**Root cause**: `VegetationPiece` in `World3DScene.tsx:265-289` renders every tree and bush through a single `<instancedMesh>` with one `<coneGeometry args={[1, 1, 6]} />` and one hardcoded `color="#2f5d2f"`. All instances are identical dark green cones.

**Data layer already knows kind**: `buildGroundVegetation` in `groundChunkLoader.ts:520-546` iterates features with `kind: "tree" | "bush"` and emits per-instance scale jitter (trees 0.9–1.5, bushes 0.35–0.55) and rotation jitter via `fhash01`. But it packs everything into one flat `VegetationScatter` — the renderer never sees the kind split.

**Matrix sync locks the shape**: `syncVegetationInstanceMatrices` in `vegetationInstanceMatrices.ts:70` applies `scale.set(s * 2, s * 5, s * 2)` uniformly — every instance is 5x taller than wide, producing the "dark cone" silhouette regardless of data-layer variety.

**Continent mode compat**: `vegetationScatter.ts` produces the same `VegetationScatter` shape (no kind, no colors) for continent-scale chunks. Any change must stay additive/optional.

---

## Proposal

Per-kind instanced meshes (tree=octagonal cone, bush=low-poly sphere) with per-instance RGB color attributes. Three color variants per kind selected by id hash, widened size range for tree height variety. Continent mode unaffected (optional fields, fallback green when no colors present).

BEGIN_PROPOSAL

### 1. `src/systems/world3d/types.ts`

```diff
 /** Instanced vegetation transforms for a chunk. */
 export interface VegetationScatter {
   positions: Float32Array;
   scales: Float32Array;
   rotations: Float32Array;
+  /** Optional per-instance RGB (3 floats per instance) for color variety. */
+  colors?: Float32Array;
   /**
    * Stable payload fingerprint for the chunk that produced these buffers.
    * The renderer uses this to skip rewriting instance matrices when a worker
    * hands back a fresh wrapper for the same vegetation scatter payload.
    */
   cacheKey: string;
 }

 /** The full set of meshes for one chunk. terrain is always present; the rest optional. */
 export interface ChunkMeshBundle {
   cx: number;
   cy: number;
   terrain: TerrainMesh;
   water?: ChunkGeometryArrays;
   roads?: ChunkGeometryArrays;
   sites: ChunkSite[];
   vegetation?: VegetationScatter;
+  /** Ground-mode bush scatter (separate geometry from trees). */
+  bushes?: VegetationScatter;
 }
```

### 2. `src/systems/worldforge/bridge/groundChunkLoader.ts`

Add `VegetationScatter` to the import on line 34:

```diff
-import type { ChunkData, ChunkMeshBundle } from "../../world3d/types";
+import type { ChunkData, ChunkMeshBundle, VegetationScatter } from "../../world3d/types";
```

Replace `buildGroundVegetation` (lines 520–546):

```diff
-export function buildGroundVegetation(
+function buildGroundVegetation(
   ground: GroundWorld,
   cx: number,
   cy: number,
-): { positions: Float32Array; scales: Float32Array; rotations: Float32Array; cacheKey: string } {
+): { trees: VegetationScatter; bushes: VegetationScatter } {
   const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
   const minX = cx * S;
   const minZ = cy * S;
-  const positions: number[] = [];
-  const scales: number[] = [];
-  const rotations: number[] = [];
+  const tPos: number[] = [];
+  const tScl: number[] = [];
+  const tRot: number[] = [];
+  const tCol: number[] = [];
+  const bPos: number[] = [];
+  const bScl: number[] = [];
+  const bRot: number[] = [];
+  const bCol: number[] = [];
+
+  const TREE_PALETTE: [number, number, number][] = [
+    [0.12, 0.30, 0.17],
+    [0.18, 0.42, 0.25],
+    [0.24, 0.48, 0.23],
+  ];
+  const BUSH_PALETTE: [number, number, number][] = [
+    [0.29, 0.42, 0.16],
+    [0.35, 0.50, 0.25],
+    [0.24, 0.55, 0.22],
+  ];

   for (const f of ground.features) {
     if (f.kind !== "tree" && f.kind !== "bush") continue;
     if (f.xM < minX || f.xM >= minX + S || f.zM < minZ || f.zM >= minZ + S) continue;
-    positions.push(f.xM - minX, groundSurfaceY(ground, f.xM, f.zM), f.zM - minZ);
-    scales.push(f.kind === "tree" ? 0.9 + fhash01(f.id, 7) * 0.6 : 0.35 + fhash01(f.id, 7) * 0.2);
-    rotations.push(fhash01(f.id, 11) * Math.PI * 2);
+    const surfaceY = groundSurfaceY(ground, f.xM, f.zM);
+    const rot = fhash01(f.id, 11) * Math.PI * 2;
+    if (f.kind === "tree") {
+      tPos.push(f.xM - minX, surfaceY, f.zM - minZ);
+      tScl.push(0.7 + fhash01(f.id, 7) * 1.1);
+      tRot.push(rot);
+      const tc = TREE_PALETTE[Math.floor(fhash01(f.id, 23) * 3)]!;
+      tCol.push(tc[0], tc[1], tc[2]);
+    } else {
+      bPos.push(f.xM - minX, surfaceY, f.zM - minZ);
+      bScl.push(0.35 + fhash01(f.id, 7) * 0.25);
+      bRot.push(rot);
+      const bc = BUSH_PALETTE[Math.floor(fhash01(f.id, 23) * 3)]!;
+      bCol.push(bc[0], bc[1], bc[2]);
+    }
   }

   return {
-    positions: new Float32Array(positions),
-    scales: new Float32Array(scales),
-    rotations: new Float32Array(rotations),
-    cacheKey: `ground|${cx}|${cy}|${positions.length}`,
+    trees: {
+      positions: new Float32Array(tPos),
+      scales: new Float32Array(tScl),
+      rotations: new Float32Array(tRot),
+      colors: new Float32Array(tCol),
+      cacheKey: `ground-tree|${cx}|${cy}|${tPos.length}`,
+    },
+    bushes: {
+      positions: new Float32Array(bPos),
+      scales: new Float32Array(bScl),
+      rotations: new Float32Array(bRot),
+      colors: new Float32Array(bCol),
+      cacheKey: `ground-bush|${cx}|${cy}|${bPos.length}`,
+    },
   };
 }
```

Update `createGroundChunkLoader` (lines 790–800):

```diff
     loader: async (cx: number, cy: number): Promise<ChunkMeshBundle> => {
       const bundle = buildChunkBundle(
         sampleGroundChunk(ground, cx, cy, WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION),
       );
-      // Artifact features replace the generic per-vertex scatter (see
-      // buildGroundVegetation — determinism + no lattice banding).
-      const vegetation = buildGroundVegetation(ground, cx, cy);
+      const { trees, bushes } = buildGroundVegetation(ground, cx, cy);
       return {
         ...bundle,
-        vegetation: vegetation.positions.length > 0 ? vegetation : undefined,
+        vegetation: trees.positions.length > 0 ? trees : undefined,
+        bushes: bushes.positions.length > 0 ? bushes : undefined,
       };
     },
```

### 3. `src/components/World3D/vegetationInstanceMatrices.ts`

```diff
 import * as THREE from 'three';
 import type { VegetationScatter } from '@/systems/world3d/types';

+export type VegetationProfile = 'tree' | 'bush';
+
+const PROFILE_SCALE = {
+  tree: { width: 2, height: 6, yLift: 3 },
+  bush: { width: 2.5, height: 1.8, yLift: 0.9 },
+} as const;
+
+const FALLBACK_COLOR = new THREE.Color('#2f5d2f');
+
 /** Minimal surface needed by the matrix writer. */
 export interface VegetationInstanceMatrixTarget {
   setMatrixAt(index: number, matrix: THREE.Matrix4): void;
+  setColorAt(index: number, color: THREE.Color): void;
   instanceMatrix: {
     needsUpdate: boolean;
   };
+  instanceColor: {
+    needsUpdate: boolean;
+  } | null;
 }

 /** Mutable one-slot cache for the last scatter key written into a mesh. */
 export interface VegetationScatterCacheRef {
   current: string | null;
 }

 /**
  * Writes vegetation transforms into an instanced mesh unless the stable scatter key
  * matches the last payload already applied to that mesh.
  */
 export function syncVegetationInstanceMatrices(
   target: VegetationInstanceMatrixTarget,
   scatter: VegetationScatter,
   cacheRef: VegetationScatterCacheRef,
+  profile: VegetationProfile = 'tree',
 ): boolean {
   if (cacheRef.current === scatter.cacheKey) {
     return false;
   }

   const matrix = new THREE.Matrix4();
   const rotation = new THREE.Quaternion();
   const axis = new THREE.Vector3(0, 1, 0);
   const position = new THREE.Vector3();
   const scale = new THREE.Vector3();
+  const color = new THREE.Color();
+  const { width: sw, height: sh, yLift } = PROFILE_SCALE[profile];
   const count = scatter.positions.length / 3;

   for (let i = 0; i < count; i++) {
     const s = scatter.scales[i];
     rotation.setFromAxisAngle(axis, scatter.rotations[i]);
-    position.set(scatter.positions[i * 3], scatter.positions[i * 3 + 1], scatter.positions[i * 3 + 2]);
-    scale.set(s * 2, s * 5, s * 2);
+    position.set(
+      scatter.positions[i * 3],
+      scatter.positions[i * 3 + 1] + s * yLift,
+      scatter.positions[i * 3 + 2],
+    );
+    scale.set(s * sw, s * sh, s * sw);
     matrix.compose(position, rotation, scale);
     target.setMatrixAt(i, matrix);
+
+    if (scatter.colors) {
+      color.setRGB(scatter.colors[i * 3], scatter.colors[i * 3 + 1], scatter.colors[i * 3 + 2]);
+    } else {
+      color.copy(FALLBACK_COLOR);
+    }
+    target.setColorAt(i, color);
   }

   target.instanceMatrix.needsUpdate = true;
+  if (target.instanceColor) target.instanceColor.needsUpdate = true;
   cacheRef.current = scatter.cacheKey;
   return true;
 }
```

### 4. `src/components/World3D/World3DScene.tsx` — `VegetationPiece` (lines 265–289)

```diff
 const VegetationPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
   const veg = chunk.bundle.vegetation;
-  const ref = useRef<THREE.InstancedMesh>(null);
-  // Track the last vegetation payload key so identical worker-cloned scatters do not
-  // rewrite every instance matrix again. If vegetation disappears, the key resets so the
-  // next mount still repopulates the new mesh.
-  const lastVegetationCacheKey = useRef<string | null>(null);
+  const bushes = chunk.bundle.bushes;
+  const treeRef = useRef<THREE.InstancedMesh>(null);
+  const bushRef = useRef<THREE.InstancedMesh>(null);
+  const lastTreeCacheKey = useRef<string | null>(null);
+  const lastBushCacheKey = useRef<string | null>(null);
   useEffect(() => {
-    if (!veg || !ref.current) {
-      lastVegetationCacheKey.current = null;
+    if (!veg || !treeRef.current) {
+      lastTreeCacheKey.current = null;
       return;
     }
-    syncVegetationInstanceMatrices(ref.current, veg, lastVegetationCacheKey);
-  }, [veg?.cacheKey]);
-  const count = veg ? veg.positions.length / 3 : 0;
-  if (!veg || count === 0) return null;
+    syncVegetationInstanceMatrices(treeRef.current, veg, lastTreeCacheKey, 'tree');
+  }, [veg?.cacheKey]);
+  useEffect(() => {
+    if (!bushes || !bushRef.current) {
+      lastBushCacheKey.current = null;
+      return;
+    }
+    syncVegetationInstanceMatrices(bushRef.current, bushes, lastBushCacheKey, 'bush');
+  }, [bushes?.cacheKey]);
+  const treeCount = veg ? veg.positions.length / 3 : 0;
+  const bushCount = bushes ? bushes.positions.length / 3 : 0;
+  if (treeCount === 0 && bushCount === 0) return null;
   return (
     <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
-      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={SHADOWS}>
-        <coneGeometry args={[1, 1, 6]} />
-        <meshStandardMaterial color="#2f5d2f" flatShading />
-      </instancedMesh>
+      {treeCount > 0 && (
+        <instancedMesh ref={treeRef} args={[undefined, undefined, treeCount]} castShadow={SHADOWS}>
+          <coneGeometry args={[1, 1, 8]} />
+          <meshStandardMaterial color="#ffffff" flatShading />
+        </instancedMesh>
+      )}
+      {bushCount > 0 && (
+        <instancedMesh ref={bushRef} args={[undefined, undefined, bushCount]} castShadow={SHADOWS}>
+          <sphereGeometry args={[1, 6, 4]} />
+          <meshStandardMaterial color="#ffffff" flatShading />
+        </instancedMesh>
+      )}
     </group>
   );
 };
```

END_PROPOSAL

---

**Summary**: 4 files, ~100 lines of diff. Trees become tall octagonal cones with 3 green color variants; bushes become low-poly spheres with 3 olive/sage color variants. Size varies by id hash (trees 0.7–1.8 scale, bushes 0.35–0.60). Continent mode unchanged — the `colors` field is optional and the fallback green in the sync helper preserves current visuals. Both meshes remain instanced (one draw call per kind).
