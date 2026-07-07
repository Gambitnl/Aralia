/**
 * @file spritePacks.ts
 * Per-biome loader for the Caeora painted VTT token packs
 * (public/assets/battlemap/<biome>/). Each biome that has a painted pack
 * registers a manifest here; the 2D board's ground painter stamps those
 * sprites instead of drawing procedural shapes.
 *
 * Adding a pack for a new biome is one entry in PACKS — drop the art under
 * public/assets/battlemap/<biome>/ and list the files by logical role.
 *
 * Props carry baked drop shadows (sun upper-left), so the painter keeps them
 * near-upright; flat decals (tracks, leaves) are shadow-free and rotate
 * freely. A missing file logs once and is skipped — the painter falls back
 * to its procedural drawer for that role.
 */
import type { BattleMapBiome } from '../../types/combat';

/** A loaded pack: logical role → the images available for it. */
export type SpritePack = Record<string, HTMLImageElement[]>;

const BASE = `${import.meta.env.BASE_URL}assets/battlemap/`;

const range = (stem: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${stem}-${i + 1}.png`);

interface PackDef {
  dir: string;
  groups: Record<string, string[]>;
  derive?: (pack: SpritePack) => void;
}

// Rocks arrive at wildly different natural sizes; split by pixel width so
// boulders draw from the big ones and ground scatter from the small.
const splitRocks = (pack: SpritePack): void => {
  const all = pack.rock ?? [];
  pack.rockBig = all.filter((i) => i.width >= 120);
  pack.rockSmall = all.filter((i) => i.width < 120);
  if (!pack.rockBig.length) pack.rockBig = all;
  if (!pack.rockSmall.length) pack.rockSmall = all;
};

const PACKS: Partial<Record<BattleMapBiome, PackDef>> = {
  forest: {
    dir: 'forest',
    groups: {
      grass: ['grass.jpg'],
      tree: range('tree', 4),
      bush: [...range('bush', 2), ...range('berry-bush', 2)],
      rock: range('rock', 12),
      stump: range('stump', 4),
      log: range('log', 3),
      stick: range('stick', 7),
      fern: range('fern', 3),
      flower: range('flower', 6),
      mushroom: [...range('red-mushrooms', 2), ...range('grey-mushrooms', 3), 'white-mushrooms.png'],
      giantMushroom: range('giant-mushroom', 3),
      leaves: range('fallen-leaves', 2),
      roots: range('roots', 3),
      tracks: range('animal-tracks', 9),
      lily: [...range('lily-pad', 3), 'lily-pad-flower.png'],
      standingStone: range('standing-stone', 3),
      setPiece: ['altar.png', 'toadstool-ring.png', 'sword-in-stone.png'],
      dragonSkeleton: ['dragon-skeleton.png'],
    },
    derive: splitRocks,
  },
  desert: {
    dir: 'desert',
    groups: {
      sand: ['sand.jpg'],
      cactus: ['cactus.png'],
      roundCactus: range('round-cactus', 3),
      rock: range('rock', 18),
      smallRock: range('small-rocks', 8),
      bush: range('bush', 2),
      fern: [...range('fern', 3), 'medium-fern.png', 'small-fern.png'],
      dryWood: range('dry-wood', 3),
      bone: range('bone', 4),
      tumbleweed: ['tumble-weed.png'],
      succulent: ['suculent-flower.png'],
      pillar: ['pillar.png'],
      slab: range('slab', 3),
      cliff: range('cliff', 2),
      ruin: range('ruin', 4),
      cowSkull: ['cow-skull.png'],
      trexSkeleton: ['t-rex-skeleton.png'],
      // Small still critters that read as ambient desert life.
      creature: ['snake.png', 'scarab.png', 'vulture.png'],
      // Rare oddities: a genie lamp, a magic carpet.
      setPiece: ['lamp.png', 'magic-carpet.png'],
    },
    derive: splitRocks,
  },
};

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.error(`[spritePacks] missing asset: ${src}`);
      resolve(null);
    };
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
};

const packPromises = new Map<BattleMapBiome, Promise<SpritePack | null>>();

/** True if the biome has a painted pack registered. */
export const biomeHasSpritePack = (biome: BattleMapBiome): boolean => biome in PACKS;

/** Load (once) and cache the painted pack for a biome, or null if it has none. */
export const loadSpritePack = (biome: BattleMapBiome): Promise<SpritePack | null> => {
  const def = PACKS[biome];
  if (!def) return Promise.resolve(null);
  const existing = packPromises.get(biome);
  if (existing) return existing;
  const promise = (async () => {
    const pack: SpritePack = {};
    await Promise.all(
      Object.entries(def.groups).map(async ([role, files]) => {
        const imgs = await Promise.all(files.map((f) => loadImage(`${BASE}${def.dir}/${f}`)));
        pack[role] = imgs.filter((i): i is HTMLImageElement => i !== null);
      }),
    );
    def.derive?.(pack);
    return pack;
  })();
  packPromises.set(biome, promise);
  return promise;
};
