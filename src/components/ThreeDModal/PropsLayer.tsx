import type { Color } from 'three';
import { useEffect, useMemo, useState } from 'react';
import {
  Color as ThreeColor,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  BufferGeometry,
  Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES } from '../../constants';
import PropField from './PropField';

interface PropsLayerProps {
  tileSeed: number;
  biomeId: string;
  size: number;
  heightSampler: (x: number, z: number) => number;
  tint: Color;
}

const treeVariants = [
  { id: 'default', file: 'tree_default.glb', count: 200 },
  { id: 'tall', file: 'tree_tall.glb', count: 160 },
  { id: 'pine', file: 'tree_pineTallA.glb', count: 140 },
  { id: 'detailed', file: 'tree_detailed.glb', count: 120 },
  { id: 'palm', file: 'tree_palm.glb', count: 100 },
];

const getCounts = (family: string) => {
  switch (family) {
    case 'forest':
      return { trees: 1400, rocks: 400 };
    case 'wetland':
      return { trees: 1100, rocks: 300 };
    case 'mountain':
    case 'highland':
      return { trees: 180, rocks: 900 };
    case 'hills':
      return { trees: 600, rocks: 500 };
    case 'desert':
      return { trees: 60, rocks: 450 };
    case 'coastal':
      return { trees: 160, rocks: 260 };
    case 'ocean':
      return { trees: 0, rocks: 80 };
    case 'cave':
    case 'dungeon':
      return { trees: 0, rocks: 650 };
    case 'plains':
    default:
      return { trees: 500, rocks: 260 };
  }
};

const PropsLayer = ({ tileSeed, biomeId, size, heightSampler, tint }: PropsLayerProps) => {
  const biome = BIOMES[biomeId];
  const family = biome?.family || biomeId;
  const counts = getCounts(family);
  const plainsSpawnRadius = Math.min(size / 2, 1800);
  const treeGeometry = useMemo(() => new ConeGeometry(6, 32, 7), []);
  const trunkGeometry = useMemo(() => new CylinderGeometry(1.5, 2.2, 8, 6), []);
  const rockGeometry = useMemo(() => new DodecahedronGeometry(6, 0), []);
  const assetBase = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/';
  const treeVariantDir = `${assetBase}assets/biomes/kenney-tree-kit`;

  const treeMaterial = useMemo(() => {
    const base = new ThreeColor(0x14532d).lerp(tint, 0.25);
    return new MeshStandardMaterial({ color: base, roughness: 0.8, metalness: 0.05 });
  }, [tint]);
  const trunkMaterial = useMemo(() => {
    const base = new ThreeColor(0x8b5a2b).lerp(tint, 0.1);
    return new MeshStandardMaterial({ color: base, roughness: 0.9, metalness: 0.05 });
  }, [tint]);
  const rockMaterial = useMemo(() => {
    const base = new ThreeColor(0x6b7280).lerp(tint, 0.15);
    return new MeshStandardMaterial({ color: base, roughness: 0.95, metalness: 0.1 });
  }, [tint]);

  const [treeAssets, setTreeAssets] = useState<
    Array<{ id: string; geometry: BufferGeometry; material: Material; count: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    let activeAssets: Array<{ geometry: BufferGeometry; material: Material }> = [];

    const loadVariant = (variant: typeof treeVariants[number]) =>
      new Promise<{
        id: string;
        geometry: BufferGeometry;
        material: Material;
        count: number;
      }>((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${treeVariantDir}/${variant.file}`;
        loader.load(
          url,
          (gltf) => {
            if (cancelled) return;
        const scanScene = gltf.scene || gltf.scenes?.[0];
        if (!scanScene) {
          reject(new Error(`No scene found inside ${url}`));
          return;
        }
        const meshes: Mesh[] = [];
        scanScene.traverse((child) => {
          const maybeMesh = child as Mesh;
          if (maybeMesh.isMesh) {
            meshes.push(maybeMesh);
          }
        });
        if (meshes.length === 0) {
          reject(new Error(`No mesh found inside ${url}`));
          return;
        }
        const clonedGeoms = meshes.map((mesh) => {
          const geom = mesh.geometry.clone();
          mesh.updateWorldMatrix(true, false);
          geom.applyMatrix4(new Matrix4().copy(mesh.matrixWorld));
          return geom;
        });
        const mergedGeom = mergeGeometries(clonedGeoms, false);
        if (!mergedGeom) {
          reject(new Error(`Failed to merge geometries for ${url}`));
          return;
        }
        mergedGeom.computeBoundingBox();
        mergedGeom.computeBoundingSphere();
        const material = Array.isArray(meshes[0].material)
          ? (meshes[0].material[0] as Material).clone()
          : (meshes[0].material as Material).clone();
        resolve({ id: variant.id, geometry: mergedGeom, material, count: variant.count });
          },
          undefined,
          reject
        );
      });

    Promise.all(treeVariants.map(loadVariant))
      .then((assets) => {
        if (cancelled) {
          assets.forEach((asset) => {
            asset.geometry.dispose();
            asset.material.dispose();
          });
          return;
        }
        activeAssets = assets;
        setTreeAssets(assets);
      })
      .catch((err) => {
        console.error('[PropsLayer] Failed to load tree variants', err);
      });

    return () => {
      cancelled = true;
      activeAssets.forEach((asset) => {
        asset.geometry.dispose();
        asset.material.dispose();
      });
    };
  }, [treeVariantDir]);

  useEffect(() => () => {
    treeGeometry.dispose();
    trunkGeometry.dispose();
    rockGeometry.dispose();
    treeMaterial.dispose();
    trunkMaterial.dispose();
    rockMaterial.dispose();
    treeAssets.forEach((asset) => {
      asset.geometry.dispose();
      asset.material.dispose();
    });
  }, [rockGeometry, rockMaterial, treeGeometry, treeMaterial, trunkGeometry, trunkMaterial, treeAssets]);

  return (
    <>
      {family === 'plains' &&
        treeAssets.map((asset) => (
          <PropField
            key={asset.id}
            count={asset.count}
            size={size}
            seed={tileSeed + asset.count}
            minScale={16}
            maxScale={32}
            heightSampler={heightSampler}
            geometry={asset.geometry}
            material={asset.material}
            spawnRadius={plainsSpawnRadius}
            yOffset={0}
          />
        ))}
      {family !== 'plains' && counts.trees > 0 && (
        <PropField
          count={counts.trees}
          size={size}
          seed={tileSeed + 37}
          minScale={0.9}
          maxScale={2.4}
          heightSampler={heightSampler}
          geometry={treeGeometry}
          material={treeMaterial}
          yOffset={14}
        />
      )}
      {counts.rocks > 0 && (
        <PropField
          count={counts.rocks}
          size={size}
          seed={tileSeed + 79}
          minScale={0.7}
          maxScale={2.6}
          heightSampler={heightSampler}
          geometry={rockGeometry}
          material={rockMaterial}
          yOffset={2}
        />
      )}
    </>
  );
};

export default PropsLayer;
