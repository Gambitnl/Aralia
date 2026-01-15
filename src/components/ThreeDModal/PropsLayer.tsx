import type { Color } from 'three';
import { useEffect, useMemo, useState } from 'react';
import {
  BufferGeometry,
  Color as ThreeColor,
  DodecahedronGeometry,
  Material,
  Matrix4,
  MeshStandardMaterial,
} from 'three';
import { Billboard, Tree, TreePreset } from '@dgreenheck/ez-tree';
import { BIOMES } from '../../constants';
import { SeededRandom } from '../../utils/random/seededRandom';
import PropField from './PropField';

interface PropsLayerProps {
  submapSeed: number;
  biomeId: string;
  size: number;
  heightSampler: (x: number, z: number) => number;
  tint: Color;
  spawnCenter?: { x: number; z: number };
  spawnSafeRadius?: number;
}

const TREE_PRESET_KEYS = Object.keys(TreePreset);
const MAX_TREE_VARIANTS = 24;

interface TreePlan {
  totalCount: number;
  poolSize: number;
  minScale: number;
  maxScale: number;
  spawnRadius?: number;
}

interface TreeVariantConfig {
  id: string;
  seed: number;
  presetName: string;
  count: number;
  minScale: number;
  maxScale: number;
  spawnRadius?: number;
}

interface TreeAsset {
  id: string;
  seed: number;
  count: number;
  minScale: number;
  maxScale: number;
  spawnRadius?: number;
  trunkGeometry: BufferGeometry;
  trunkMaterial: Material;
  leavesGeometry: BufferGeometry;
  leavesMaterial: Material;
}

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

const getTreePlan = (family: string, size: number): TreePlan => {
  switch (family) {
    case 'forest':
      return { totalCount: 8000, poolSize: 60, minScale: 1.2, maxScale: 3.2 };
    case 'wetland':
      return { totalCount: 6000, poolSize: 50, minScale: 1.15, maxScale: 3.0 };
    case 'plains':
      return {
        totalCount: 3000,
        poolSize: 40,
        minScale: 1.0,
        maxScale: 2.6,
        spawnRadius: Math.min(size / 2, 1800),
      };
    case 'hills':
      return { totalCount: 2800, poolSize: 40, minScale: 0.9, maxScale: 2.4 };
    case 'mountain':
    case 'highland':
      return { totalCount: 1800, poolSize: 32, minScale: 0.8, maxScale: 2.1 };
    case 'coastal':
      return { totalCount: 2000, poolSize: 32, minScale: 0.85, maxScale: 2.3 };
    case 'desert':
      return { totalCount: 800, poolSize: 24, minScale: 0.7, maxScale: 1.8 };
    case 'ocean':
    case 'cave':
    case 'dungeon':
      return { totalCount: 0, poolSize: 0, minScale: 1, maxScale: 1 };
    default:
      return { totalCount: 2400, poolSize: 36, minScale: 0.95, maxScale: 2.5 };
  }
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampInt = (value: number, min: number, max: number) => Math.round(clampNumber(value, min, max));

const PropsLayer = ({
  submapSeed,
  biomeId,
  size,
  heightSampler,
  tint,
  spawnCenter,
  spawnSafeRadius,
}: PropsLayerProps) => {
  const biome = BIOMES[biomeId];
  const family = biome?.family || biomeId;
  const counts = getCounts(family);
  const rockGeometry = useMemo(() => new DodecahedronGeometry(6, 0), []);
  const biomeTint = useMemo(
    () => new ThreeColor(biome?.rgbaColor ?? '#ffffff'),
    [biomeId]
  );
  const safeCenter = spawnCenter ?? { x: 0, z: 0 };
  const safeRadius = spawnSafeRadius ?? 0;

  const rockMaterial = useMemo(() => {
    const base = new ThreeColor(0x6b7280).lerp(tint, 0.15);
    return new MeshStandardMaterial({ color: base, roughness: 0.95, metalness: 0.1 });
  }, [tint]);

  const treePlan = useMemo(() => getTreePlan(family, size), [family, size]);
  const treeVariantConfigs = useMemo<TreeVariantConfig[]>(() => {
    if (treePlan.totalCount <= 0 || TREE_PRESET_KEYS.length === 0) return [];
    const poolSize = Math.min(treePlan.poolSize, treePlan.totalCount, MAX_TREE_VARIANTS);
    const perVariant = Math.floor(treePlan.totalCount / poolSize);
    const remainder = treePlan.totalCount % poolSize;
    const seedBase = submapSeed + hashString(biomeId) * 97;
    const rng = new SeededRandom(seedBase);

    return Array.from({ length: poolSize }, (_, index) => {
      const presetName = TREE_PRESET_KEYS[Math.floor(rng.next() * TREE_PRESET_KEYS.length)];
      const seed = Math.floor(rng.next() * 1_000_000_000);
      const count = perVariant + (index < remainder ? 1 : 0);
      return {
        id: `${presetName}-${index}`,
        seed,
        presetName,
        count,
        minScale: treePlan.minScale,
        maxScale: treePlan.maxScale,
        spawnRadius: treePlan.spawnRadius,
      };
    });
  }, [biomeId, submapSeed, treePlan]);

  const [treeAssets, setTreeAssets] = useState<TreeAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    let activeAssets: TreeAsset[] = [];

    if (treeVariantConfigs.length === 0) {
      setTreeAssets([]);
      return () => {
        cancelled = true;
      };
    }

    const barkBase = new ThreeColor(0x8b5a2b).lerp(biomeTint, 0.2);
    const leafBase = new ThreeColor(0x14532d).lerp(biomeTint, 0.4);
    const nextAssets: TreeAsset[] = [];

    try {
      treeVariantConfigs.forEach((variant, index) => {
        const rng = new SeededRandom(variant.seed);
        const tree = new Tree();
        tree.loadPreset(variant.presetName);

        const barkTint = barkBase.clone().lerp(new ThreeColor(0xffffff), rng.next() * 0.08);
        const leafTint = leafBase.clone().lerp(new ThreeColor(0xffffff), rng.next() * 0.12);

        tree.options.seed = variant.seed;
        tree.options.bark.tint = barkTint.getHex();
        tree.options.leaves.tint = leafTint.getHex();
        tree.options.bark.textured = false;
        tree.options.bark.flatShading = true;
        tree.options.leaves.billboard = Billboard.Single;
        tree.options.branch.length[0] *= 0.75 + rng.next() * 0.5;
        tree.options.branch.length[1] *= 0.7 + rng.next() * 0.45;
        tree.options.branch.radius[0] *= 0.8 + rng.next() * 0.4;
        tree.options.branch.radius[1] *= 0.8 + rng.next() * 0.4;
        tree.options.leaves.count = clampInt(tree.options.leaves.count * (0.25 + rng.next() * 0.25), 80, 220);
        tree.options.leaves.size *= 0.65 + rng.next() * 0.45;

        const maxLevel = clampInt(tree.options.branch.levels, 1, 2);
        tree.options.branch.levels = maxLevel;
        for (let level = 0; level <= maxLevel; level += 1) {
          const key = level as 0 | 1 | 2 | 3;
          const sections = tree.options.branch.sections[key];
          const segments = tree.options.branch.segments[key];
          tree.options.branch.sections[key] = clampInt(sections * 0.45, 3, 8);
          tree.options.branch.segments[key] = clampInt(segments * 0.45, 3, 7);
          if (level <= 2) {
            const childKey = level as 0 | 1 | 2;
            const children = tree.options.branch.children[childKey];
            tree.options.branch.children[childKey] = clampInt(children * (0.45 + rng.next() * 0.15), 2, 5);
          }
        }

        tree.generate();

        const trunkGeometry = tree.branchesMesh.geometry;
        const leavesGeometry = tree.leavesMesh.geometry;
        trunkGeometry.computeBoundingBox();
        const minY = trunkGeometry.boundingBox?.min.y ?? 0;
        if (minY !== 0) {
          const offset = new Matrix4().makeTranslation(0, -minY, 0);
          trunkGeometry.applyMatrix4(offset);
          leavesGeometry.applyMatrix4(offset);
        }
        trunkGeometry.computeBoundingSphere();
        leavesGeometry.computeBoundingSphere();

        const trunkMaterial = Array.isArray(tree.branchesMesh.material)
          ? tree.branchesMesh.material[0]
          : tree.branchesMesh.material;
        const leavesMaterial = Array.isArray(tree.leavesMesh.material)
          ? tree.leavesMesh.material[0]
          : tree.leavesMesh.material;

        nextAssets.push({
          id: `tree-${index}`,
          seed: variant.seed,
          count: variant.count,
          minScale: variant.minScale,
          maxScale: variant.maxScale,
          spawnRadius: variant.spawnRadius,
          trunkGeometry,
          trunkMaterial,
          leavesGeometry,
          leavesMaterial,
        });
      });
    } catch (err) {
      console.error('[PropsLayer] Failed to generate tree variants', err);
    }

    if (!cancelled) {
      activeAssets = nextAssets;
      setTreeAssets(nextAssets);
    } else {
      nextAssets.forEach((asset) => {
        asset.trunkGeometry.dispose();
        asset.trunkMaterial.dispose();
        asset.leavesGeometry.dispose();
        asset.leavesMaterial.dispose();
      });
    }

    return () => {
      cancelled = true;
      activeAssets.forEach((asset) => {
        asset.trunkGeometry.dispose();
        asset.trunkMaterial.dispose();
        asset.leavesGeometry.dispose();
        asset.leavesMaterial.dispose();
      });
    };
  }, [biomeTint, treeVariantConfigs]);

  useEffect(() => () => {
    rockGeometry.dispose();
    rockMaterial.dispose();
  }, [rockGeometry, rockMaterial]);

  return (
    <>
      {treeAssets.map((asset) => (
        <group key={asset.id}>
          <PropField
            count={asset.count}
            size={size}
            seed={asset.seed}
            minScale={asset.minScale}
            maxScale={asset.maxScale}
            heightSampler={heightSampler}
            geometry={asset.trunkGeometry}
            material={asset.trunkMaterial}
            spawnRadius={asset.spawnRadius}
            avoidCenter={safeCenter}
            avoidRadius={safeRadius}
            yOffset={0}
          />
          <PropField
            count={asset.count}
            size={size}
            seed={asset.seed}
            minScale={asset.minScale}
            maxScale={asset.maxScale}
            heightSampler={heightSampler}
            geometry={asset.leavesGeometry}
            material={asset.leavesMaterial}
            spawnRadius={asset.spawnRadius}
            avoidCenter={safeCenter}
            avoidRadius={safeRadius}
            yOffset={0}
          />
        </group>
      ))}
      {counts.rocks > 0 && (
        <PropField
          count={counts.rocks}
          size={size}
          seed={submapSeed + 79}
          minScale={0.7}
          maxScale={2.6}
          heightSampler={heightSampler}
          geometry={rockGeometry}
          material={rockMaterial}
          avoidCenter={safeCenter}
          avoidRadius={safeRadius}
          yOffset={2}
        />
      )}
    </>
  );
};

export default PropsLayer;
