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
  treeCountMultiplier?: number;
  rockCountMultiplier?: number;
  heroLineEnabled?: boolean;
  heroLineSpacing?: number;
  heroLineOffset?: { x: number; z: number };
  customTreeOptions?: Record<string, unknown> | null;
  customTreeEnabled?: boolean;
  customTreeOffset?: { x: number; z: number };
  customTreeScale?: number;
  comparisonTreeOptions?: Record<string, unknown> | null;
  comparisonTreeEnabled?: boolean;
  comparisonTreeOffset?: { x: number; z: number };
  comparisonTreeScale?: number;
  onCustomTreeStats?: (stats: TreeStats | null) => void;
  onComparisonTreeStats?: (stats: TreeStats | null) => void;
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

export interface TreeStats {
  heightFt: number;
  trunkVertices: number;
  leavesVertices: number;
  trunkTriangles: number;
  leavesTriangles: number;
  totalVertices: number;
  totalTriangles: number;
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

const getGeometryStats = (geometry: BufferGeometry) => {
  const vertexCount = geometry.attributes.position?.count ?? 0;
  const triangleCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;
  return { vertexCount, triangleCount };
};

// Build a single ez-tree asset from JSON options so the test rig can place
// custom/baseline trees in fixed locations while also reporting stats.
const buildTreeAsset = (options: Record<string, unknown>, id: string) => {
  const tree = new Tree();
  tree.loadFromJson(options as never);
  tree.generate();

  const trunkGeometry = tree.branchesMesh.geometry;
  const leavesGeometry = tree.leavesMesh.geometry;
  trunkGeometry.computeBoundingBox();
  leavesGeometry.computeBoundingBox();

  const trunkBox = trunkGeometry.boundingBox;
  const leavesBox = leavesGeometry.boundingBox;
  const minY = Math.min(trunkBox?.min.y ?? 0, leavesBox?.min.y ?? 0);

  // Shift meshes so y=0 is the ground plane. This keeps placements and height
  // stats consistent with the terrain height sampler.
  if (minY !== 0) {
    const offset = new Matrix4().makeTranslation(0, -minY, 0);
    trunkGeometry.applyMatrix4(offset);
    leavesGeometry.applyMatrix4(offset);
  }

  trunkGeometry.computeBoundingSphere();
  leavesGeometry.computeBoundingSphere();
  trunkGeometry.computeBoundingBox();
  leavesGeometry.computeBoundingBox();

  const trunkMaterial = Array.isArray(tree.branchesMesh.material)
    ? tree.branchesMesh.material[0]
    : tree.branchesMesh.material;
  const leavesMaterial = Array.isArray(tree.leavesMesh.material)
    ? tree.leavesMesh.material[0]
    : tree.leavesMesh.material;

  const trunkStats = getGeometryStats(trunkGeometry);
  const leavesStats = getGeometryStats(leavesGeometry);
  const trunkBounds = trunkGeometry.boundingBox;
  const leavesBounds = leavesGeometry.boundingBox;
  const heightFt = Math.max(trunkBounds?.max.y ?? 0, leavesBounds?.max.y ?? 0);

  const asset: TreeAsset = {
    id,
    seed: Number((options as Record<string, unknown>).seed ?? 0),
    count: 1,
    minScale: 1,
    maxScale: 1,
    trunkGeometry,
    trunkMaterial,
    leavesGeometry,
    leavesMaterial,
  };

  const stats: TreeStats = {
    heightFt,
    trunkVertices: trunkStats.vertexCount,
    leavesVertices: leavesStats.vertexCount,
    trunkTriangles: trunkStats.triangleCount,
    leavesTriangles: leavesStats.triangleCount,
    totalVertices: trunkStats.vertexCount + leavesStats.vertexCount,
    totalTriangles: trunkStats.triangleCount + leavesStats.triangleCount,
  };

  return { asset, stats };
};

const PropsLayer = ({
  submapSeed,
  biomeId,
  size,
  heightSampler,
  tint,
  spawnCenter,
  spawnSafeRadius,
  treeCountMultiplier,
  rockCountMultiplier,
  heroLineEnabled,
  heroLineSpacing,
  heroLineOffset,
  customTreeOptions,
  customTreeEnabled,
  customTreeOffset,
  customTreeScale,
  comparisonTreeOptions,
  comparisonTreeEnabled,
  comparisonTreeOffset,
  comparisonTreeScale,
  onCustomTreeStats,
  onComparisonTreeStats,
}: PropsLayerProps) => {
  const biome = BIOMES[biomeId];
  const family = biome?.family || biomeId;
  const treeCountScale = treeCountMultiplier ?? 1;
  const rockCountScale = rockCountMultiplier ?? 1;
  const showHeroLine = heroLineEnabled ?? false;
  const heroSpacing = heroLineSpacing ?? 50;
  const heroOffset = heroLineOffset ?? { x: 0, z: 120 };
  const showCustomTree = customTreeEnabled ?? false;
  const customOffset = customTreeOffset ?? { x: 0, z: heroOffset.z + 80 };
  const customScale = customTreeScale ?? 1;
  const showComparisonTree = comparisonTreeEnabled ?? false;
  const comparisonOffset = comparisonTreeOffset ?? { x: customOffset.x - 80, z: customOffset.z };
  const comparisonScale = comparisonTreeScale ?? 1;
  const counts = useMemo(() => {
    const base = getCounts(family);
    return {
      trees: Math.max(0, Math.round(base.trees * treeCountScale)),
      rocks: Math.max(0, Math.round(base.rocks * rockCountScale)),
    };
  }, [family, rockCountScale, treeCountScale]);
  const rockGeometry = useMemo(() => {
    const geometry = new DodecahedronGeometry(6, 0);
    geometry.computeBoundingSphere();
    return geometry;
  }, []);
  const biomeTint = useMemo(
    () => new ThreeColor(biome?.rgbaColor ?? '#ffffff'),
    [biomeId]
  );
  const safeCenter = spawnCenter ?? { x: 0, z: 0 };
  const safeRadius = spawnSafeRadius ?? 0;
  const [treeAssets, setTreeAssets] = useState<TreeAsset[]>([]);
  const [customTreeAsset, setCustomTreeAsset] = useState<TreeAsset | null>(null);
  const [comparisonTreeAsset, setComparisonTreeAsset] = useState<TreeAsset | null>(null);
  // Render each generated tree variant once in a straight line for quick QA
  // and side-by-side comparison in the 3D test scene.
  const heroLineEntries = useMemo(() => {
    if (!showHeroLine || treeAssets.length === 0) return [];
    const spacing = Math.max(10, heroSpacing);
    const startX = heroOffset.x - ((treeAssets.length - 1) * spacing) / 2;

    return treeAssets.map((asset, index) => {
      const x = startX + index * spacing;
      const z = heroOffset.z;
      const y = heightSampler(x, z);
      return {
        id: asset.id,
        asset,
        x,
        y,
        z,
        scale: asset.maxScale,
      };
    });
  }, [
    heightSampler,
    heroOffset.x,
    heroOffset.z,
    heroSpacing,
    showHeroLine,
    treeAssets,
  ]);

  const rockMaterial = useMemo(() => {
    const base = new ThreeColor(0x6b7280).lerp(tint, 0.15);
    return new MeshStandardMaterial({ color: base, roughness: 0.95, metalness: 0.1 });
  }, [tint]);

  const treePlan = useMemo(() => {
    const plan = getTreePlan(family, size);
    return {
      ...plan,
      totalCount: Math.max(0, Math.round(plan.totalCount * treeCountScale)),
    };
  }, [family, size, treeCountScale]);
  const treeVariantConfigs = useMemo<TreeVariantConfig[]>(() => {
    const shouldGeneratePool = (treePlan.totalCount > 0 || showHeroLine) && treePlan.poolSize > 0;
    if (!shouldGeneratePool || TREE_PRESET_KEYS.length === 0) return [];

    // In "hero line" mode we still want a pool of variants even when scatter
    // is disabled (totalCount=0). Setting `count=0` keeps the world clean
    // while still rendering one exemplar per variant in the line.
    const shouldScatter = treePlan.totalCount > 0;
    const poolTarget = shouldScatter ? treePlan.totalCount : treePlan.poolSize;
    const poolSize = Math.min(treePlan.poolSize, poolTarget, MAX_TREE_VARIANTS);
    const perVariant = shouldScatter ? Math.floor(treePlan.totalCount / poolSize) : 0;
    const remainder = shouldScatter ? treePlan.totalCount % poolSize : 0;
    const seedBase = submapSeed + hashString(biomeId) * 97;
    const rng = new SeededRandom(seedBase);

    return Array.from({ length: poolSize }, (_, index) => {
      const presetName = TREE_PRESET_KEYS[Math.floor(rng.next() * TREE_PRESET_KEYS.length)];
      const seed = Math.floor(rng.next() * 1_000_000_000);
      const count = shouldScatter ? perVariant + (index < remainder ? 1 : 0) : 0;
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
  }, [biomeId, showHeroLine, submapSeed, treePlan]);

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

  useEffect(() => {
    let cancelled = false;
    let nextAsset: TreeAsset | null = null;

    if (!showCustomTree || !customTreeOptions) {
      setCustomTreeAsset(null);
      onCustomTreeStats?.(null);
      return () => {
        cancelled = true;
      };
    }

    // Rebuild the custom tree whenever sliders change; dispose the old GPU
    // resources so rapid edits do not leak memory in the test harness.
    try {
      const { asset, stats } = buildTreeAsset(customTreeOptions, 'custom-tree');
      nextAsset = asset;
      onCustomTreeStats?.(stats);
    } catch (err) {
      console.error('[PropsLayer] Failed to generate custom tree', err);
      onCustomTreeStats?.(null);
    }

    if (!cancelled) {
      setCustomTreeAsset(nextAsset);
    } else if (nextAsset) {
      nextAsset.trunkGeometry.dispose();
      nextAsset.trunkMaterial.dispose();
      nextAsset.leavesGeometry.dispose();
      nextAsset.leavesMaterial.dispose();
    }

    return () => {
      cancelled = true;
      if (nextAsset) {
        nextAsset.trunkGeometry.dispose();
        nextAsset.trunkMaterial.dispose();
        nextAsset.leavesGeometry.dispose();
        nextAsset.leavesMaterial.dispose();
      }
    };
  }, [customTreeOptions, onCustomTreeStats, showCustomTree]);

  useEffect(() => {
    let cancelled = false;
    let nextAsset: TreeAsset | null = null;

    if (!showComparisonTree || !comparisonTreeOptions) {
      setComparisonTreeAsset(null);
      onComparisonTreeStats?.(null);
      return () => {
        cancelled = true;
      };
    }

    // Comparison tree mirrors the preset so the lab can show side-by-side
    // deltas without touching the preset data itself.
    try {
      const { asset, stats } = buildTreeAsset(comparisonTreeOptions, 'comparison-tree');
      nextAsset = asset;
      onComparisonTreeStats?.(stats);
    } catch (err) {
      console.error('[PropsLayer] Failed to generate comparison tree', err);
      onComparisonTreeStats?.(null);
    }

    if (!cancelled) {
      setComparisonTreeAsset(nextAsset);
    } else if (nextAsset) {
      nextAsset.trunkGeometry.dispose();
      nextAsset.trunkMaterial.dispose();
      nextAsset.leavesGeometry.dispose();
      nextAsset.leavesMaterial.dispose();
    }

    return () => {
      cancelled = true;
      if (nextAsset) {
        nextAsset.trunkGeometry.dispose();
        nextAsset.trunkMaterial.dispose();
        nextAsset.leavesGeometry.dispose();
        nextAsset.leavesMaterial.dispose();
      }
    };
  }, [comparisonTreeOptions, onComparisonTreeStats, showComparisonTree]);

  useEffect(() => () => {
    rockGeometry.dispose();
    rockMaterial.dispose();
  }, [rockGeometry, rockMaterial]);

  return (
    <>
      {treeAssets.map((asset) => {
        const trunkRadius = asset.trunkGeometry.boundingSphere?.radius ?? 0;
        const leavesRadius = asset.leavesGeometry.boundingSphere?.radius ?? 0;
        // Use the larger of trunk/leaves so the spawn-safe radius accounts for
        // the full tree footprint and keeps entry points clear.
        const spawnBuffer = Math.max(trunkRadius, leavesRadius);
        return (
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
            avoidBuffer={spawnBuffer}
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
            avoidBuffer={spawnBuffer}
            yOffset={0}
          />
        </group>
        );
      })}
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
          avoidBuffer={rockGeometry.boundingSphere?.radius ?? 0}
          yOffset={2}
        />
      )}
      {heroLineEntries.length > 0 && (
        <group>
          {heroLineEntries.map((entry) => (
            <group
              key={`hero-${entry.id}`}
              position={[entry.x, entry.y, entry.z]}
              scale={[entry.scale, entry.scale, entry.scale]}
            >
              <mesh geometry={entry.asset.trunkGeometry} material={entry.asset.trunkMaterial} castShadow receiveShadow />
              <mesh geometry={entry.asset.leavesGeometry} material={entry.asset.leavesMaterial} castShadow receiveShadow />
            </group>
          ))}
        </group>
      )}
      {customTreeAsset && (
        <group
          position={[
            customOffset.x,
            heightSampler(customOffset.x, customOffset.z),
            customOffset.z,
          ]}
          scale={[customScale, customScale, customScale]}
        >
          <mesh geometry={customTreeAsset.trunkGeometry} material={customTreeAsset.trunkMaterial} castShadow receiveShadow />
          <mesh geometry={customTreeAsset.leavesGeometry} material={customTreeAsset.leavesMaterial} castShadow receiveShadow />
        </group>
      )}
      {comparisonTreeAsset && (
        <group
          position={[
            comparisonOffset.x,
            heightSampler(comparisonOffset.x, comparisonOffset.z),
            comparisonOffset.z,
          ]}
          scale={[comparisonScale, comparisonScale, comparisonScale]}
        >
          <mesh geometry={comparisonTreeAsset.trunkGeometry} material={comparisonTreeAsset.trunkMaterial} castShadow receiveShadow />
          <mesh geometry={comparisonTreeAsset.leavesGeometry} material={comparisonTreeAsset.leavesMaterial} castShadow receiveShadow />
        </group>
      )}
    </>
  );
};

export default PropsLayer;
