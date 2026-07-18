// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 11:55:22
 * Dependents: components/BattleMap/groundPainter.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file groundPainter/paintPipeline.ts
 * The paint pipeline: composes the cached textures and the prop drawers into
 * the complete painted battle-map ground (base coat, flagstones, patches,
 * roads, the sub-tile waterline pipeline, landmark set-pieces, foliage, and
 * the vignette / dapple / time-of-day washes).
 *
 * Extracted verbatim from groundPainter.ts — the seeded draw ORDER is
 * unchanged so the art is byte-for-byte identical across the DOM canvas and
 * the PixiJS prototype.
 */
import type { BattleMapData, BattleMapTile } from "../../../types/combat";
import {
  BATTLE_MAP_CELL_SIZE_FEET,
  BATTLE_MAP_CONTOUR_INTERVAL_FEET,
} from "../../../config/mapConfig";
import { elevationUnitsToFeet } from "../elevationPresentation";
import {
  type Ground,
  type CombatBiome,
  COMBAT_BIOMES,
  terrainToGround,
  type GroundTextures,
} from "./textures";
import {
  rand,
  stamp,
  pick,
  drawTree,
  drawBush,
  drawTuft,
  drawLog,
  drawRock,
  drawCactus,
  drawStalagmite,
  drawPillar,
  drawPine,
  drawCrystal,
  drawMangrove,
  BUSH_FOREST,
  BUSH_SWAMP,
  BUSH_DESERT,
  ROCK_GRAY,
  ROCK_SAND,
  ROCK_DARK,
} from "./props";

export interface PaintGroundOptions {
  /** Whether to draw decorative asset props such as trees, rocks, bushes, logs, and loose scatter. */
  showDecorations?: boolean;
}

/**
 * Decides whether the painter may add visual-only leaves, flowers, saplings,
 * and loose rocks to otherwise empty tiles.
 *
 * Legacy sandbox arenas still need that illustrative filler. A WorldForge map
 * does not: its placed features and props are authoritative, so extra per-tile
 * scatter would recreate the "assets sneezed onto the map" problem and make the
 * picture disagree with the game world.
 */
export function shouldPaintAmbientScatter(mapData: BattleMapData): boolean {
  return mapData.provenance?.kind !== "worldforge";
}

export interface CrossingPaintGroup {
  id: string;
  kind: NonNullable<BattleMapTile["crossing"]>["kind"];
  cells: BattleMapTile[];
}

export interface ElevationContourSegment {
  /** Segment coordinates are in tactical-cell space and scale with tileSize. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  reliefFeet: number;
}

/**
 * Build interpolated five-foot contour segments through tile-center samples.
 * This uses marching-square edge intersections instead of tracing cell borders,
 * because blocky stair steps would merely replace raw numbers with a different
 * debug-grid artifact.
 */
export function collectElevationContourSegments(
  mapData: BattleMapData,
): ElevationContourSegment[] {
  const { width, height } = mapData.dimensions;
  const elevationFeetAt = (x: number, y: number): number =>
    elevationUnitsToFeet(mapData.tiles.get(`${x}-${y}`)?.elevation ?? 0);
  const segments: ElevationContourSegment[] = [];

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const corners = [
        elevationFeetAt(x, y),
        elevationFeetAt(x + 1, y),
        elevationFeetAt(x + 1, y + 1),
        elevationFeetAt(x, y + 1),
      ];
      const minimum = Math.min(...corners);
      const maximum = Math.max(...corners);
      const firstContour =
        (Math.floor(minimum / BATTLE_MAP_CONTOUR_INTERVAL_FEET) + 1) *
        BATTLE_MAP_CONTOUR_INTERVAL_FEET;

      for (
        let reliefFeet = firstContour;
        reliefFeet <= maximum;
        reliefFeet += BATTLE_MAP_CONTOUR_INTERVAL_FEET
      ) {
        const intersections: Array<{ x: number; y: number }> = [];
        const addIntersection = (
          ax: number,
          ay: number,
          a: number,
          bx: number,
          by: number,
          b: number,
        ) => {
          // Half-open threshold comparisons prevent a contour passing exactly
          // through one sample from being emitted twice by adjacent edges.
          if (!(
            (a < reliefFeet && b >= reliefFeet) ||
            (b < reliefFeet && a >= reliefFeet)
          )) {
            return;
          }
          const amount = (reliefFeet - a) / (b - a);
          intersections.push({
            x: ax + (bx - ax) * amount,
            y: ay + (by - ay) * amount,
          });
        };

        addIntersection(
          x + 0.5,
          y + 0.5,
          corners[0],
          x + 1.5,
          y + 0.5,
          corners[1],
        );
        addIntersection(
          x + 1.5,
          y + 0.5,
          corners[1],
          x + 1.5,
          y + 1.5,
          corners[2],
        );
        addIntersection(
          x + 1.5,
          y + 1.5,
          corners[2],
          x + 0.5,
          y + 1.5,
          corners[3],
        );
        addIntersection(
          x + 0.5,
          y + 1.5,
          corners[3],
          x + 0.5,
          y + 0.5,
          corners[0],
        );

        for (let index = 0; index + 1 < intersections.length; index += 2) {
          segments.push({
            x1: intersections[index].x,
            y1: intersections[index].y,
            x2: intersections[index + 1].x,
            y2: intersections[index + 1].y,
            reliefFeet,
          });
        }
      }
    }
  }

  return segments;
}

/**
 * Add subtle hillshade and interpolated contours beneath roads, water, and
 * props. Terrain remains the first visual read; tactical overlays and bodies
 * stay unobstructed because they are rendered later by the battle map.
 */
function paintElevationRelief(
  ctx: CanvasRenderingContext2D,
  mapData: BattleMapData,
  tileSize: number,
): void {
  const { width, height } = mapData.dimensions;
  const elevationAt = (x: number, y: number): number => {
    const clampedX = Math.max(0, Math.min(width - 1, x));
    const clampedY = Math.max(0, Math.min(height - 1, y));
    return elevationUnitsToFeet(
      mapData.tiles.get(`${clampedX}-${clampedY}`)?.elevation ?? 0,
    );
  };

  // One shaded sample per source tile is intentionally smoothed when enlarged;
  // the result reads as broad landform lighting instead of square cell tinting.
  const shadeCanvas = document.createElement("canvas");
  shadeCanvas.width = width;
  shadeCanvas.height = height;
  const shadeContext = shadeCanvas.getContext("2d");
  if (shadeContext) {
    // Positional-sun cast shadows: march each tile's eye-line toward the sun
    // (upper-left, matching every baked prop/token shadow) and accumulate how
    // far terrain rises above it. Slope shading says "this face tilts away";
    // a cast shadow says "that hill over there blocks the light" — together
    // they make landforms read as volumes instead of tint.
    const SUN_DIR = { x: -0.78, y: -0.62 }; // normalized-ish toward the sun
    const SUN_SLOPE_FT_PER_TILE = 0.9; // low sun: 10 ft knoll throws ~11 tiles
    const MAX_SHADOW_MARCH_TILES = 24;
    const castShadowAt = (x: number, y: number): number => {
      const base = elevationAt(x, y);
      let blockedBy = 0;
      for (let step = 1; step <= MAX_SHADOW_MARCH_TILES; step += 1) {
        const sampleX = Math.round(x + SUN_DIR.x * step);
        const sampleY = Math.round(y + SUN_DIR.y * step);
        if (
          sampleX < 0 ||
          sampleY < 0 ||
          sampleX >= width ||
          sampleY >= height
        )
          break;
        const eyeLine = base + SUN_SLOPE_FT_PER_TILE * step;
        blockedBy = Math.max(blockedBy, elevationAt(sampleX, sampleY) - eyeLine);
      }
      // 0 = fully lit; saturates at 1 when terrain rises 6+ ft over the ray.
      return Math.max(0, Math.min(1, blockedBy / 6));
    };
    const image = shadeContext.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const eastWestRise = elevationAt(x + 1, y) - elevationAt(x - 1, y);
        const northSouthRise = elevationAt(x, y + 1) - elevationAt(x, y - 1);
        const slopeX = eastWestRise / (BATTLE_MAP_CELL_SIZE_FEET * 2);
        const slopeY = northSouthRise / (BATTLE_MAP_CELL_SIZE_FEET * 2);
        // A northwest light direction matches the board's existing token and
        // prop shadows. Clamp aggressively so relief supports, not recolors.
        const directional = Math.max(
          -1,
          Math.min(1, -slopeX * 0.7 - slopeY * 0.55),
        );
        const shadow = castShadowAt(x, y);
        const offset = (y * width + x) * 4;
        const slopeAlpha = Math.abs(directional) * (directional > 0 ? 42 : 66);
        const shadowAlpha = shadow * 58;
        // Cast shadow always darkens; a lit slope inside a cast shadow loses
        // its highlight instead of glowing through the shade.
        const bright = directional > 0 && shadow < 0.15;
        image.data[offset] = bright ? 255 : 6;
        image.data[offset + 1] = bright ? 239 : 12;
        image.data[offset + 2] = bright ? 194 : 20;
        image.data[offset + 3] = Math.round(
          bright ? slopeAlpha : Math.min(96, (directional > 0 ? 0 : slopeAlpha) + shadowAlpha),
        );
      }
    }
    shadeContext.putImageData(image, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(shadeCanvas, 0, 0, width * tileSize, height * tileSize);
    ctx.restore();
  }

  const contours = collectElevationContourSegments(mapData);
  if (contours.length === 0) return;
  const traceContours = () => {
    ctx.beginPath();
    for (const segment of contours) {
      ctx.moveTo(segment.x1 * tileSize, segment.y1 * tileSize);
      ctx.lineTo(segment.x2 * tileSize, segment.y2 * tileSize);
    }
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  traceContours();
  ctx.strokeStyle = "rgba(4,10,12,0.5)";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  traceContours();
  ctx.strokeStyle = "rgba(244,211,145,0.62)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inline elevation labels, USGS topo style: without a number on the line a
  // contour reads as an accidental scratch. Labels repeat along each level so
  // one is visible in any reasonable viewport crop, rotated to follow the
  // line, kept upright, with a casing halo so they survive busy terrain.
  const LABEL_SPACING_TILES = 22;
  const byLevel = new Map<number, ElevationContourSegment[]>();
  for (const segment of contours) {
    const bucket = byLevel.get(segment.reliefFeet) ?? [];
    bucket.push(segment);
    byLevel.set(segment.reliefFeet, bucket);
  }
  ctx.font = `700 ${Math.max(9, tileSize * 0.5)}px "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [reliefFeet, segments] of byLevel) {
    let sinceLabel = LABEL_SPACING_TILES * 0.6; // stagger the first label in
    for (const segment of segments) {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      sinceLabel += Math.hypot(dx, dy);
      if (sinceLabel < LABEL_SPACING_TILES) continue;
      sinceLabel = 0;
      const midX = ((segment.x1 + segment.x2) / 2) * tileSize;
      const midY = ((segment.y1 + segment.y2) / 2) * tileSize;
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      const text = `${reliefFeet} ft`;
      ctx.strokeStyle = "rgba(28,34,24,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = "rgba(248,222,160,0.95)";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Group only source-authored crossing cells for the over-water paint pass.
 * Keeping this selection pure gives tests and debug tools a way to prove that
 * ordinary water cannot acquire plausible bridge art from painter heuristics.
 */
export function collectCrossingPaintGroups(
  mapData: BattleMapData,
): CrossingPaintGroup[] {
  const groups = new Map<string, CrossingPaintGroup>();
  for (const tile of mapData.tiles.values()) {
    if (!tile.crossing) continue;
    const group = groups.get(tile.crossing.sourceCrossingId) ?? {
      id: tile.crossing.sourceCrossingId,
      kind: tile.crossing.kind,
      cells: [],
    };
    group.cells.push(tile);
    groups.set(group.id, group);
  }
  return [...groups.values()];
}

/**
 * Paint the complete painted ground onto a 2D context. The caller must have
 * sized the canvas to (W*tileSize*res, H*tileSize*res) and set
 * ctx.setTransform(res,0,0,res,0,0) before calling.
 */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  mapData: BattleMapData,
  tileSize: number,
  textures: GroundTextures,
  res: number,
  options: PaintGroundOptions = {},
): void {
  const { grass, dirt } = textures;
  const W = mapData.dimensions.width;
  const H = mapData.dimensions.height;
  const px = W * tileSize;
  const py = H * tileSize;
  // The generator stamps its biome into mapData.theme; the painter follows.
  const biome: CombatBiome = (COMBAT_BIOMES as readonly string[]).includes(
    mapData.theme ?? "",
  )
    ? (mapData.theme as CombatBiome)
    : "forest";
  const indoor = biome === "cave" || biome === "dungeon";
  const paintAmbientScatter = shouldPaintAmbientScatter(mapData);

  const grassPat = grass ? ctx.createPattern(grass, "repeat") : null;
  const dirtPat = dirt ? ctx.createPattern(dirt, "repeat") : null;

  // 1. Base ground per biome (texture pattern where one fits, else solid).
  if (biome === "desert" && textures.pack?.sand?.[0]) {
    // Desert with the painted pack: Caeora's own sand-dune plate, palette-
    // matched to the props so it needs no unifying wash.
    const sandPat = ctx.createPattern(textures.pack.sand[0], "repeat");
    if (sandPat) {
      ctx.fillStyle = sandPat;
      ctx.fillRect(0, 0, px, py);
      ctx.fillStyle = "rgba(228,200,142,0.1)";
      ctx.fillRect(0, 0, px, py);
    }
  } else if (biome === "desert" || biome === "coast") {
    // Sand: the dirt texture pushed hard toward warm tan (paler on the coast).
    if (dirtPat) {
      ctx.fillStyle = dirtPat;
      ctx.fillRect(0, 0, px, py);
      ctx.fillStyle =
        biome === "coast" ? "rgba(228,208,156,0.6)" : "rgba(216,186,124,0.55)";
      ctx.fillRect(0, 0, px, py);
    } else {
      ctx.fillStyle = biome === "coast" ? "#d0ba8a" : "#c2a877";
      ctx.fillRect(0, 0, px, py);
    }
  } else if (biome === "cave") {
    ctx.fillStyle = "#4e4759";
    ctx.fillRect(0, 0, px, py);
  } else if (biome === "dungeon" || biome === "ruins") {
    ctx.fillStyle = biome === "ruins" ? "#4a4a4e" : "#47474f";
    ctx.fillRect(0, 0, px, py);
  } else if (biome === "snow") {
    ctx.fillStyle = "#c6cfd8";
    ctx.fillRect(0, 0, px, py);
  } else if (biome === "volcanic") {
    ctx.fillStyle = "#2e2522";
    ctx.fillRect(0, 0, px, py);
  } else if (biome === "forest" && textures.pack?.grass?.[0]) {
    // Forest with the painted pack: Caeora's own grass plate — it matches
    // the props' palette exactly, so no heavy unifying wash is needed.
    const caeoraPat = ctx.createPattern(textures.pack.grass[0], "repeat");
    if (caeoraPat) {
      ctx.fillStyle = caeoraPat;
      ctx.fillRect(0, 0, px, py);
      ctx.fillStyle = "rgba(30,58,24,0.1)";
      ctx.fillRect(0, 0, px, py);
    }
  } else if (grassPat) {
    ctx.fillStyle = grassPat;
    ctx.fillRect(0, 0, px, py);
    // Forest: a light daylight wash. Swamp: heavier olive murk. Jungle:
    // deep saturated green.
    ctx.fillStyle =
      biome === "swamp"
        ? "rgba(38,50,26,0.5)"
        : biome === "jungle"
          ? "rgba(22,64,28,0.44)"
          : "rgba(46,82,36,0.30)";
    ctx.fillRect(0, 0, px, py);
  } else {
    ctx.fillStyle =
      biome === "swamp"
        ? "#2c3a24"
        : biome === "jungle"
          ? "#1f4224"
          : "#2c4a2c";
    ctx.fillRect(0, 0, px, py);
  }

  const mapSeed = W * 31 + H * 17;

  // 1a. Flagstone floor (dungeon + ruins): big worked-stone slabs with
  // mortar lines and per-slab tint. Drawn board-wide; wall tiles and
  // overgrowth overpaint later.
  if (biome === "dungeon" || biome === "ruins") {
    const slab = tileSize * 2;
    for (let sy = 0; sy < Math.ceil(py / slab); sy++) {
      for (let sx = 0; sx < Math.ceil(px / slab); sx++) {
        const jitter = rand(sx, sy, 171);
        ctx.fillStyle =
          jitter > 0.5
            ? `rgba(255,255,255,${(jitter - 0.5) * 0.08})`
            : `rgba(0,0,0,${(0.5 - jitter) * 0.16})`;
        // Stagger every other row half a slab, like real flagstone courses.
        const ox = (sy % 2) * slab * 0.5;
        ctx.fillRect(sx * slab - ox, sy * slab, slab, slab);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx * slab - ox, sy * slab, slab, slab);
      }
    }
  }

  // 1b. Large soft patches — variation so no biome reads as one flat tone.
  // Forest: sunlit yellow-greens vs shaded darks. Swamp: murk pools with a
  // sickly light. Desert: sun-bleached brights vs warm shadow. Cave: cold
  // faint pools. Dungeon: skipped, the flagstones carry the variation.
  if (biome !== "dungeon") {
    const PATCHES: Record<string, { sun: string; shade: string }> = {
      forest: { sun: "168,190,88", shade: "12,34,18" },
      swamp: { sun: "120,140,60", shade: "10,20,10" },
      desert: { sun: "240,214,150", shade: "120,84,44" },
      cave: { sun: "112,122,165", shade: "0,0,6" },
      snow: { sun: "235,242,250", shade: "92,112,150" },
      jungle: { sun: "140,190,70", shade: "4,26,10" },
      coast: { sun: "246,228,172", shade: "128,104,62" },
      ruins: { sun: "112,130,84", shade: "10,12,10" },
      volcanic: { sun: "205,95,42", shade: "4,2,2" },
    };
    const pc = PATCHES[biome];
    const sunA =
      biome === "cave"
        ? 0.09
        : biome === "swamp"
          ? 0.1
          : biome === "ruins"
            ? 0.1
            : biome === "volcanic"
              ? 0.1
              : 0.16;
    const shadeA = biome === "cave" ? 0.28 : biome === "volcanic" ? 0.3 : 0.2;
    const patchCount = Math.max(8, Math.floor((W * H) / 45));
    for (let i = 0; i < patchCount; i++) {
      const cxp = px * rand(i, mapSeed, 11);
      const cyp = py * rand(i, mapSeed, 12);
      const pr = tileSize * (2 + rand(i, mapSeed, 13) * 4);
      const sunny = rand(i, mapSeed, 14) > 0.45;
      const pg = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, pr);
      if (sunny) {
        pg.addColorStop(0, `rgba(${pc.sun},${sunA})`);
        pg.addColorStop(1, `rgba(${pc.sun},0)`);
      } else {
        pg.addColorStop(0, `rgba(${pc.shade},${shadeA})`);
        pg.addColorStop(1, `rgba(${pc.shade},0)`);
      }
      ctx.fillStyle = pg;
      ctx.fillRect(cxp - pr, cyp - pr, pr * 2, pr * 2);
    }
  }

  // Ground lookup for neighbor checks (road routing avoids water; water
  // banks need to know which edges of a water tile touch land).
  const groundAt = new Map<string, Ground>();
  mapData.tiles.forEach((tile) => {
    groundAt.set(
      `${tile.coordinates.x},${tile.coordinates.y}`,
      terrainToGround(tile.terrain),
    );
  });
  const isLand = (x: number, y: number) => {
    const g = groundAt.get(`${x},${y}`);
    return g !== undefined && g !== "water";
  };

  // 1c. A road that actually GOES somewhere: it enters on the west edge,
  // exits on the east edge, and walks a near-straight line between the two
  // with small human wobble — dodging water — instead of aimless sine
  // squiggles. Drawn BEFORE the per-cell overpaint so water/stone tiles
  // paint over any residue where they overlap. Open-country biomes only:
  // no road crosses a bog, a cave, or a dungeon room.
  // Legacy arenas need a painter-authored route to read as a place. A real
  // location must wait for its source road geometry to reach the referee grid;
  // drawing a replacement here would hide that missing semantic bridge.
  if (
    paintAmbientScatter &&
    dirtPat &&
    (biome === "forest" || biome === "desert")
  ) {
    const startY = py * (0.2 + rand(mapSeed, 1, 81) * 0.6);
    const endY = py * (0.2 + rand(mapSeed, 2, 82) * 0.6);
    const segs = Math.max(6, Math.floor(W / 12));
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= segs; i++) {
      const x = -tileSize + (px + tileSize * 2) * (i / segs);
      const base = startY + (endY - startY) * (i / segs);
      // Wobble is small (±1.5 tiles) so the route stays purposeful.
      let y =
        base +
        (i === 0 || i === segs
          ? 0
          : (rand(mapSeed, i, 83) - 0.5) * tileSize * 3);
      // Nudge waypoints off water so the road fords nothing it shouldn't.
      const txi = Math.max(0, Math.min(W - 1, Math.floor(x / tileSize)));
      for (let tries = 0; tries < 10; tries++) {
        const tyi = Math.max(0, Math.min(H - 1, Math.floor(y / tileSize)));
        if (isLand(txi, tyi)) break;
        y += (rand(mapSeed, i, 84) > 0.5 ? 1 : -1) * tileSize;
        y = Math.max(tileSize, Math.min(py - tileSize, y));
      }
      pts.push({ x, y });
    }
    // Piecewise-linear y along the road, for pebble placement.
    const roadYAt = (x: number): number => {
      for (let i = 1; i < pts.length; i++) {
        if (x <= pts[i].x) {
          const t = (x - pts[i - 1].x) / Math.max(1, pts[i].x - pts[i - 1].x);
          return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t;
        }
      }
      return pts[pts.length - 1].y;
    };
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const tracePath = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };
    // Soft dark edge under the path (fainter in sand — dunes hold no mud).
    tracePath();
    ctx.strokeStyle =
      biome === "desert" ? "rgba(90,66,34,0.22)" : "rgba(40,30,18,0.35)";
    ctx.lineWidth = tileSize * 1.7;
    ctx.stroke();
    // Dirt body.
    tracePath();
    ctx.strokeStyle = dirtPat;
    ctx.lineWidth = tileSize * 1.25;
    ctx.stroke();
    // Tint the body: warm sunlit dirt in forest, pale packed sand in desert.
    tracePath();
    ctx.strokeStyle =
      biome === "desert" ? "rgba(226,198,142,0.4)" : "rgba(150,116,70,0.30)";
    ctx.lineWidth = tileSize * 1.25;
    ctx.stroke();
    // Worn center line, lighter where feet travel.
    tracePath();
    ctx.strokeStyle =
      biome === "desert" ? "rgba(245,225,175,0.22)" : "rgba(205,175,125,0.18)";
    ctx.lineWidth = tileSize * 0.45;
    ctx.stroke();
    // Scattered pebbles/speckles along the path edges.
    for (let i = 0; i < W * 2; i++) {
      const sx = px * rand(i, mapSeed, 21);
      const sy = roadYAt(sx) + (rand(i, mapSeed, 22) - 0.5) * tileSize * 1.3;
      const sr = 1 + rand(i, mapSeed, 23) * 2.5;
      ctx.fillStyle =
        rand(i, mapSeed, 24) > 0.5
          ? "rgba(90,70,45,0.5)"
          : "rgba(170,150,115,0.4)";
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Animal tracks crossing and following the road — the pack's flat
    // decals; a road that things walk on reads as a used road.
    if (textures.pack) {
      const trackCount = 4 + Math.floor(rand(mapSeed, 5, 361) * 3);
      for (let i = 0; i < trackCount; i++) {
        const img = pick(textures.pack.tracks, i, mapSeed, 362);
        if (!img) continue;
        const sx = px * (0.1 + rand(i, mapSeed, 363) * 0.8);
        const sy = roadYAt(sx) + (rand(i, mapSeed, 364) - 0.5) * tileSize * 2.2;
        ctx.save();
        ctx.globalAlpha = 0.75;
        stamp(
          ctx,
          img,
          sx,
          sy,
          tileSize * (0.9 + rand(i, mapSeed, 365) * 0.5),
          rand(i, mapSeed, 366) * Math.PI * 2,
        );
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Water draws into its own layer so the whole sheet can be feathered
  // (slight blur) when composited — softening the hard tile-square edges
  // into shorelines without blurring grass, path, or foliage.
  const waterCanvas = document.createElement("canvas");
  waterCanvas.width = Math.round(px * res);
  waterCanvas.height = Math.round(py * res);
  const wctx = waterCanvas.getContext("2d");
  if (wctx) wctx.setTransform(res, 0, 0, res, 0, 0);

  // 2. Per-cell ground: overpaint non-base terrain + add organic variation.
  mapData.tiles.forEach((tile) => {
    const tx = tile.coordinates.x;
    const ty = tile.coordinates.y;
    const gx = tx * tileSize;
    const gy = ty * tileSize;
    const ground = terrainToGround(tile.terrain);

    if (ground === "stone") {
      if (biome === "dungeon" || biome === "ruins") {
        // Masonry wall: a DARK solid mass (walls are the void, the floor is
        // the room) with sparse block joints, not a busy mini-grid.
        ctx.fillStyle = "#232329";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        ctx.fillStyle =
          rand(tx, ty, 9) > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.16)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(gx, gy, tileSize, tileSize);
        const joint = (ty % 2 === 0 ? 0.5 : 0.3) * tileSize;
        ctx.beginPath();
        ctx.moveTo(gx + joint, gy);
        ctx.lineTo(gx + joint, gy + tileSize);
        ctx.stroke();
      } else if (biome === "cave") {
        // Rough rock mass, clearly darker than the floor so passages read
        // as carved space.
        ctx.fillStyle = "#17141d";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        ctx.fillStyle =
          rand(tx, ty, 9) > 0.5 ? "rgba(120,105,140,0.07)" : "rgba(0,0,0,0.2)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      } else {
        ctx.fillStyle = "#3b3f47";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        ctx.fillStyle =
          rand(tx, ty, 9) > 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      }
      return;
    }

    if (biome === "desert") {
      // Sand is the base coat; rock outcrops ('rock' → dirt) get a soft
      // feathered rocky stain — never a hard-edged square — and the decor
      // pass stamps actual boulders on them.
      if (ground === "dirt") {
        const rcx = gx + tileSize * (0.35 + rand(tx, ty, 185) * 0.3);
        const rcy = gy + tileSize * (0.35 + rand(tx, ty, 186) * 0.3);
        const rr = tileSize * 1.1;
        const rgd = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, rr);
        rgd.addColorStop(0, "rgba(112,102,88,0.5)");
        rgd.addColorStop(0.6, "rgba(112,102,88,0.28)");
        rgd.addColorStop(1, "rgba(112,102,88,0)");
        ctx.fillStyle = rgd;
        ctx.fillRect(rcx - rr, rcy - rr, rr * 2, rr * 2);
      }
      return;
    }

    if (biome === "volcanic") {
      // Basalt is the base coat. Ash drifts ('difficult') get a soft
      // feathered pale stain (hard tile rects read as glitch squares);
      // lava is painted by the waterline pipeline.
      if (tile.terrain === "difficult") {
        const acx = gx + tileSize * (0.35 + rand(tx, ty, 301) * 0.3);
        const acy = gy + tileSize * (0.35 + rand(tx, ty, 302) * 0.3);
        const ar = tileSize * 1.05;
        const ag = ctx.createRadialGradient(acx, acy, 0, acx, acy, ar);
        ag.addColorStop(0, "rgba(152,142,132,0.3)");
        ag.addColorStop(1, "rgba(152,142,132,0)");
        ctx.fillStyle = ag;
        ctx.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);
      }
      return;
    }

    if (biome === "snow") {
      // Deep drifts ('difficult') read as raised white mounds with a cool
      // feathered shadow skirt; frozen ponds go through the waterline
      // pipeline.
      if (tile.terrain === "difficult") {
        const scx = gx + tileSize / 2;
        const scy = gy + tileSize / 2;
        const sr = tileSize * 1.0;
        const sg2 = ctx.createRadialGradient(scx, scy, 0, scx, scy, sr);
        sg2.addColorStop(0, "rgba(96,116,150,0.22)");
        sg2.addColorStop(1, "rgba(96,116,150,0)");
        ctx.fillStyle = sg2;
        ctx.fillRect(scx - sr, scy - sr, sr * 2, sr * 2);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.ellipse(
          gx + tileSize * (0.4 + rand(tx, ty, 261) * 0.2),
          gy + tileSize * (0.4 + rand(tx, ty, 262) * 0.2),
          tileSize * 0.42,
          tileSize * 0.3,
          rand(tx, ty, 263) * Math.PI,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      return;
    }

    if (biome === "coast") {
      // Dune grass tiles get a green wash over the sand base.
      if (ground === "grass") {
        ctx.fillStyle = "rgba(96,130,58,0.35)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      }
      return;
    }

    if (biome === "ruins") {
      // Overgrowth reclaims paving; rubble piles gray it out.
      if (ground === "grass") {
        ctx.fillStyle = "rgba(66,104,48,0.4)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      } else if (tile.terrain === "difficult") {
        ctx.fillStyle = "rgba(30,30,34,0.35)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      }
      return;
    }

    if (biome === "swamp") {
      // Mud flats: wet dark soil with an occasional puddle sheen. 'difficult'
      // (root tangles) keeps the grass base and gets roots drawn later.
      if (tile.terrain === "mud") {
        ctx.fillStyle = "rgba(46,36,22,0.5)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        if (rand(tx, ty, 181) < 0.3) {
          ctx.fillStyle = "rgba(150,180,170,0.12)";
          ctx.beginPath();
          ctx.ellipse(
            gx + tileSize * (0.3 + rand(tx, ty, 182) * 0.4),
            gy + tileSize * (0.3 + rand(tx, ty, 183) * 0.4),
            tileSize * 0.3,
            tileSize * 0.16,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      return;
    }

    if (ground === "dirt" || ground === "sand") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, tileSize, tileSize);
      ctx.clip();
      if (biome === "cave") {
        // Cave floor: rough stone, lifted enough to survive the fog dimming
        // — the wall/floor contrast is the whole tactical read down here.
        ctx.fillStyle = "#4e4759";
        ctx.fillRect(gx, gy, tileSize, tileSize);
        ctx.fillStyle =
          rand(tx, ty, 9) > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(185,172,205,0.09)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      } else if (biome === "dungeon") {
        // Dungeon floor: the flagstone base already carries the look.
      } else if (dirtPat) {
        ctx.fillStyle = dirtPat;
        ctx.fillRect(gx - 8, gy - 8, tileSize + 16, tileSize + 16);
        ctx.fillStyle =
          ground === "sand" ? "rgba(190,165,105,0.45)" : "rgba(70,52,35,0.4)";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      } else {
        ctx.fillStyle = ground === "sand" ? "#b9a06a" : "#5a4632";
        ctx.fillRect(gx, gy, tileSize, tileSize);
      }
      ctx.restore();
    }
    // Water tiles are painted by the dedicated waterline pipeline below —
    // the silhouette is computed at sub-tile resolution, not per tile.
  });

  // 2a-ii. Wall rims (any biome with walls): where a wall meets open floor,
  // draw a lit edge on the wall and a soft shadow falling onto the floor —
  // this is what makes wall mass read as RAISED instead of painted-on.
  if (indoor || biome === "ruins") {
    mapData.tiles.forEach((tile) => {
      if (terrainToGround(tile.terrain) !== "stone") return;
      const tx = tile.coordinates.x;
      const ty = tile.coordinates.y;
      const gx = tx * tileSize;
      const gy = ty * tileSize;
      const rim =
        biome === "cave" ? "rgba(150,135,170,0.28)" : "rgba(175,175,195,0.3)";
      const edges: Array<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ];
      for (const [dx, dy] of edges) {
        const ng = groundAt.get(`${tx + dx},${ty + dy}`);
        if (ng === undefined || ng === "stone") continue;
        // Lit rim just inside the wall edge.
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (dy === -1) {
          ctx.moveTo(gx + 1, gy + 1);
          ctx.lineTo(gx + tileSize - 1, gy + 1);
        }
        if (dy === 1) {
          ctx.moveTo(gx + 1, gy + tileSize - 1);
          ctx.lineTo(gx + tileSize - 1, gy + tileSize - 1);
        }
        if (dx === -1) {
          ctx.moveTo(gx + 1, gy + 1);
          ctx.lineTo(gx + 1, gy + tileSize - 1);
        }
        if (dx === 1) {
          ctx.moveTo(gx + tileSize - 1, gy + 1);
          ctx.lineTo(gx + tileSize - 1, gy + tileSize - 1);
        }
        ctx.stroke();
        // Shadow falling onto the neighboring floor tile.
        const sw = tileSize * 0.28;
        const fx = (tx + dx) * tileSize;
        const fy = (ty + dy) * tileSize;
        const sg =
          dx !== 0
            ? ctx.createLinearGradient(
                dx === 1 ? fx : fx + tileSize,
                0,
                dx === 1 ? fx + sw : fx + tileSize - sw,
                0,
              )
            : ctx.createLinearGradient(
                0,
                dy === 1 ? fy : fy + tileSize,
                0,
                dy === 1 ? fy + sw : fy + tileSize - sw,
              );
        sg.addColorStop(0, "rgba(0,0,0,0.35)");
        sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg;
        if (dx !== 0)
          ctx.fillRect(dx === 1 ? fx : fx + tileSize - sw, fy, sw, tileSize);
        else ctx.fillRect(fx, dy === 1 ? fy : fy + tileSize - sw, tileSize, sw);
      }
    });
  }

  // 2b. Quarter-tile color blending. Whole-tile brightness noise read as
  // "colored squares", so instead each grass tile splits into four quadrants
  // and each quadrant leans toward the tones of the neighbor tiles it
  // touches — close to them, never identical (a per-quadrant jitter keeps
  // every quadrant unique). The tile grid dissolves into a soft color field.
  const half = tileSize / 2;
  // Which ground the quadrant blend applies to, and in what palette, is
  // biome-specific: greens over grass, sand lights over dunes, cold grays
  // over cave floor. Dungeon skips it — worked stone is deliberately even.
  const QUAD: Record<
    CombatBiome,
    {
      ground: Ground;
      pos: string;
      neg: string;
      posA: number;
      negA: number;
    } | null
  > = {
    forest: {
      ground: "grass",
      pos: "140,170,80",
      neg: "0,10,0",
      posA: 0.3,
      negA: 0.24,
    },
    swamp: {
      ground: "grass",
      pos: "110,130,58",
      neg: "6,10,2",
      posA: 0.24,
      negA: 0.28,
    },
    desert: {
      ground: "sand",
      pos: "248,224,164",
      neg: "104,72,38",
      posA: 0.24,
      negA: 0.2,
    },
    cave: {
      ground: "dirt",
      pos: "138,128,160",
      neg: "0,0,4",
      posA: 0.12,
      negA: 0.24,
    },
    dungeon: null,
    snow: {
      ground: "grass",
      pos: "255,255,255",
      neg: "96,116,150",
      posA: 0.3,
      negA: 0.2,
    },
    jungle: {
      ground: "grass",
      pos: "120,180,70",
      neg: "0,14,2",
      posA: 0.28,
      negA: 0.28,
    },
    coast: {
      ground: "sand",
      pos: "250,232,178",
      neg: "110,88,52",
      posA: 0.22,
      negA: 0.18,
    },
    ruins: {
      ground: "grass",
      pos: "120,150,80",
      neg: "8,10,6",
      posA: 0.24,
      negA: 0.24,
    },
    volcanic: {
      ground: "dirt",
      pos: "235,120,52",
      neg: "0,0,0",
      posA: 0.09,
      negA: 0.3,
    },
  };
  const quad = QUAD[biome];
  const toneOf = (x: number, y: number): number => {
    const g = groundAt.get(`${x},${y}`);
    if (g === undefined) return rand(x, y, 5) * 2 - 1; // off-map: neutral noise
    if (quad && g === quad.ground) return rand(x, y, 5) * 2 - 1; // open ground: seeded noise
    if (g === "water") return -0.55; // pull shore ground darker and cooler
    if (g === "stone") return -0.25;
    if (g === "dirt" || g === "sand") return 0.18; // warm pull near paths
    return rand(x, y, 5) * 2 - 1;
  };
  if (quad) {
    mapData.tiles.forEach((tile) => {
      if (terrainToGround(tile.terrain) !== quad.ground) return;
      const tx = tile.coordinates.x;
      const ty = tile.coordinates.y;
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const dx = qx === 0 ? -1 : 1;
          const dy = qy === 0 ? -1 : 1;
          // Bilinear-style corner blend: the tile's own tone dominates, the
          // two edge neighbors pull, the diagonal pulls least.
          const tone =
            (4 * toneOf(tx, ty) +
              2 * toneOf(tx + dx, ty) +
              2 * toneOf(tx, ty + dy) +
              toneOf(tx + dx, ty + dy)) /
              9 +
            (rand(tx * 2 + qx, ty * 2 + qy, 91) - 0.5) * 0.24;
          ctx.fillStyle =
            tone > 0
              ? `rgba(${quad.pos},${Math.min(quad.posA, tone * quad.posA)})`
              : `rgba(${quad.neg},${Math.min(quad.negA, -tone * quad.negA)})`;
          ctx.fillRect(
            tx * tileSize + qx * half,
            ty * tileSize + qy * half,
            half,
            half,
          );
        }
      }
    });
  }

  // 2b-ii. Ground litter. The reference ground is a dense collage — no flat
  // wash anywhere — so every open tile gets a handful of tiny speckles in a
  // biome palette: leaves and twig bits in the forest, wet debris in the
  // swamp, pebbles in the desert, gravel in cave and dungeon.
  const LITTER_BY_BIOME: Record<
    CombatBiome,
    { ground: Ground; colors: string[]; dense: number }
  > = {
    forest: {
      ground: "grass",
      colors: [
        "rgba(40,66,34,0.5)",
        "rgba(92,102,44,0.45)",
        "rgba(96,72,44,0.45)",
        "rgba(132,158,74,0.4)",
        "rgba(150,128,88,0.35)",
      ],
      dense: 4,
    },
    swamp: {
      ground: "grass",
      colors: [
        "rgba(30,40,22,0.55)",
        "rgba(60,64,30,0.5)",
        "rgba(70,52,32,0.5)",
        "rgba(96,110,54,0.4)",
        "rgba(44,58,52,0.4)",
      ],
      dense: 4,
    },
    desert: {
      ground: "sand",
      colors: [
        "rgba(140,112,70,0.45)",
        "rgba(190,160,110,0.45)",
        "rgba(110,84,52,0.4)",
        "rgba(225,200,150,0.4)",
      ],
      dense: 3,
    },
    cave: {
      ground: "dirt",
      colors: [
        "rgba(20,16,26,0.55)",
        "rgba(120,110,138,0.32)",
        "rgba(76,68,92,0.42)",
      ],
      dense: 3,
    },
    dungeon: {
      ground: "dirt",
      colors: [
        "rgba(20,20,26,0.4)",
        "rgba(120,120,135,0.25)",
        "rgba(80,80,92,0.3)",
      ],
      dense: 2,
    },
    snow: {
      ground: "grass",
      colors: [
        "rgba(160,175,195,0.4)",
        "rgba(120,138,165,0.3)",
        "rgba(90,74,52,0.25)",
        "rgba(235,242,250,0.45)",
      ],
      dense: 2,
    },
    jungle: {
      ground: "grass",
      colors: [
        "rgba(28,60,26,0.55)",
        "rgba(80,120,44,0.5)",
        "rgba(150,180,80,0.4)",
        "rgba(90,64,40,0.4)",
        "rgba(190,90,110,0.3)",
      ],
      dense: 5,
    },
    coast: {
      ground: "sand",
      colors: [
        "rgba(200,180,140,0.45)",
        "rgba(240,232,210,0.5)",
        "rgba(150,130,100,0.4)",
        "rgba(120,130,125,0.3)",
      ],
      dense: 3,
    },
    ruins: {
      ground: "dirt",
      colors: [
        "rgba(20,20,24,0.4)",
        "rgba(120,120,130,0.3)",
        "rgba(88,104,64,0.35)",
        "rgba(70,70,78,0.35)",
      ],
      dense: 3,
    },
    volcanic: {
      ground: "dirt",
      colors: [
        "rgba(10,6,4,0.55)",
        "rgba(90,74,66,0.4)",
        "rgba(255,140,50,0.35)",
        "rgba(60,50,46,0.4)",
      ],
      dense: 3,
    },
  };
  const litter = LITTER_BY_BIOME[biome];
  mapData.tiles.forEach((tile) => {
    if (terrainToGround(tile.terrain) !== litter.ground) return;
    const tx = tile.coordinates.x;
    const ty = tile.coordinates.y;
    const n = litter.dense + Math.floor(rand(tx, ty, 121) * litter.dense);
    for (let s = 0; s < n; s++) {
      const sx = (tx + rand(tx * 7 + s, ty, 122)) * tileSize;
      const sy = (ty + rand(tx, ty * 7 + s, 123)) * tileSize;
      ctx.fillStyle =
        litter.colors[
          Math.floor(rand(tx + s, ty - s, 124) * litter.colors.length)
        ];
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + rand(tx - s, ty + s, 125) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 2b-iii. Relief belongs below source roads, water, crossings, and physical
  // props. Those authored facts should interrupt contours naturally instead of
  // looking like labels pasted beneath a diagnostic elevation layer.
  paintElevationRelief(ctx, mapData, tileSize);

  // 2b-iv. Source-backed road surface. Unlike the legacy painter route above,
  // this pass has no route generator and cannot decide where a road belongs.
  // It only joins referee cells whose WorldForge surface fact says the source
  // road intersects them. Drawing before water keeps unbridged crossings wet
  // and visibly blocked instead of manufacturing a plausible-looking ford.
  const roadCells = Array.from(mapData.tiles.values()).filter(
    (tile) => tile.surface?.kind === "road",
  );
  if (roadCells.length > 0) {
    // Stroke-union painting (center-to-center segments per cell) could never
    // read smooth: every direction change left cap lobes and notch steps on
    // the band's boundary. Instead, trace the road cells' OUTLINE as vector
    // contours (marching-squares over the tile mask) and round it with two
    // Chaikin passes — one continuous curved silhouette, then fill it. The
    // footprint stays exactly the source-fact cells, quarter-tile rounded.
    const inRoad = new Set<string>();
    for (const tile of roadCells) {
      inRoad.add(`${tile.coordinates.x},${tile.coordinates.y}`);
    }
    const filled = (x: number, y: number) => inRoad.has(`${x},${y}`);
    // Boundary edges between a filled cell and an unfilled neighbor, keyed by
    // corner-lattice endpoints, chained into closed loops. Consistent
    // orientation (filled cell on the left of travel) makes chaining exact.
    type Pt = readonly [number, number];
    const segs = new Map<string, Pt[]>(); // startKey -> [end, ...] (branching safe)
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const addSeg = (a: Pt, b: Pt) => {
      const list = segs.get(key(a));
      if (list) list.push(b);
      else segs.set(key(a), [b]);
    };
    for (const tile of roadCells) {
      const x = tile.coordinates.x;
      const y = tile.coordinates.y;
      // Each open side contributes one lattice edge, oriented so the road
      // interior stays on the LEFT: top L→R, right T→B, bottom R→L, left B→T.
      if (!filled(x, y - 1)) addSeg([x, y], [x + 1, y]);
      if (!filled(x + 1, y)) addSeg([x + 1, y], [x + 1, y + 1]);
      if (!filled(x, y + 1)) addSeg([x + 1, y + 1], [x, y + 1]);
      if (!filled(x - 1, y)) addSeg([x, y + 1], [x, y]);
    }
    const loops: Pt[][] = [];
    while (segs.size > 0) {
      const [startKey, ends] = segs.entries().next().value as [string, Pt[]];
      const start = startKey.split(",").map(Number) as unknown as Pt;
      const loop: Pt[] = [start];
      let cur = ends.pop()!;
      if (ends.length === 0) segs.delete(startKey);
      let guard = 0;
      while (key(cur) !== startKey && guard++ < 100000) {
        loop.push(cur);
        const nexts = segs.get(key(cur));
        if (!nexts || nexts.length === 0) break; // open chain (map edge): stop
        // At a checkerboard corner two continuations exist; taking the last
        // keeps loops consistent because orientation already disambiguates.
        const next = nexts.pop()!;
        if (nexts.length === 0) segs.delete(key(cur));
        cur = next;
      }
      if (loop.length >= 4) loops.push(loop);
    }
    // Corner rounding alone still ripples at 1-tile wavelength (a rounded
    // staircase is still a staircase). Low-pass the contour FIRST — a few
    // Laplacian passes flatten the stair ripple into straights and long
    // curves — then one Chaikin pass rounds what remains.
    const laplacian = (pts: Pt[], iterations: number): Pt[] => {
      let cur = pts;
      for (let it = 0; it < iterations; it++) {
        const next: Pt[] = new Array(cur.length);
        for (let i = 0; i < cur.length; i++) {
          const p = cur[i];
          const a = cur[(i - 1 + cur.length) % cur.length];
          const b = cur[(i + 1) % cur.length];
          next[i] = [
            p[0] * 0.5 + (a[0] + b[0]) * 0.25,
            p[1] * 0.5 + (a[1] + b[1]) * 0.25,
          ];
        }
        cur = next;
      }
      return cur;
    };
    const chaikin = (pts: Pt[]): Pt[] => {
      const out: Pt[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      return out;
    };
    const roadPath = new Path2D();
    for (let loop of loops) {
      loop = chaikin(laplacian(loop, 4));
      roadPath.moveTo(loop[0][0] * tileSize, loop[0][1] * tileSize);
      for (let i = 1; i < loop.length; i++) {
        roadPath.lineTo(loop[i][0] * tileSize, loop[i][1] * tileSize);
      }
      roadPath.closePath();
    }

    ctx.save();
    ctx.lineJoin = "round";
    // Soft dark ground shadow straddling the boundary.
    ctx.strokeStyle = "rgba(38,28,17,0.42)";
    ctx.lineWidth = tileSize * 0.34;
    ctx.stroke(roadPath);
    // The bed itself.
    ctx.fillStyle = dirtPat ?? "#72563a";
    ctx.fill(roadPath, "evenodd");
    // Sun-bleached center wash + a worn inner rim, clipped to the bed so
    // both fade at the true curved edge.
    ctx.clip(roadPath, "evenodd");
    ctx.fillStyle =
      biome === "desert" ? "rgba(224,194,137,0.24)" : "rgba(157,122,76,0.2)";
    ctx.fillRect(0, 0, px, py);
    ctx.strokeStyle = "rgba(30,22,13,0.35)";
    ctx.lineWidth = tileSize * 0.3;
    ctx.stroke(roadPath);
    ctx.restore();
  }

  // 2c. Waterline pipeline (look reference: gozzys.com wilderness maps).
  // The bank must wiggle at SUB-tile scale — smooth geometry of any kind
  // (squares, rounded squares, circle unions) reads as artificial. So: build
  // a smooth per-tile water field, threshold it against sub-tile noise to
  // get a ragged fractal coastline, cut the painted water to that
  // silhouette, lay a mud band along it, and plant shore growth on the bank.
  // Per-biome water treatment: what fills the ragged silhouette, what color
  // band hugs it, and which extra effect sells the material (foam for sea,
  // cracks for ice, glow for lava, duckweed for bog).
  const WATER_LOOKS: Record<
    CombatBiome,
    {
      top: string;
      bottom: string;
      band: string;
      rim: string;
      depth: string;
      bLight: string;
      bDark: string;
      glint: string;
      extra: "none" | "duckweed" | "ice" | "foam" | "lava";
      shore: "none" | "forest" | "swamp" | "coast";
    }
  > = {
    forest: {
      top: "#2b74ad",
      bottom: "#174f7e",
      band: "#4a3f2c",
      rim: "#101c16",
      depth: "rgba(8,30,52,0.4)",
      bLight: "rgba(120,185,225,0.14)",
      bDark: "rgba(12,45,78,0.18)",
      glint: "rgba(140,205,230,0.28)",
      extra: "none",
      shore: "forest",
    },
    swamp: {
      top: "#547a52",
      bottom: "#2c4a32",
      band: "#39331f",
      rim: "#101c16",
      depth: "rgba(10,24,12,0.45)",
      bLight: "rgba(150,175,125,0.13)",
      bDark: "rgba(12,28,14,0.2)",
      glint: "rgba(180,200,150,0.2)",
      extra: "duckweed",
      shore: "swamp",
    },
    jungle: {
      top: "#2b8da0",
      bottom: "#14555f",
      band: "#3c3a22",
      rim: "#0c1a14",
      depth: "rgba(6,38,40,0.42)",
      bLight: "rgba(130,205,200,0.14)",
      bDark: "rgba(8,48,50,0.2)",
      glint: "rgba(160,220,215,0.26)",
      extra: "none",
      shore: "swamp",
    },
    coast: {
      top: "#2f86b8",
      bottom: "#155a88",
      band: "#b09a72",
      rim: "#123a52",
      depth: "rgba(6,34,58,0.45)",
      bLight: "rgba(150,205,235,0.16)",
      bDark: "rgba(10,50,84,0.18)",
      glint: "rgba(200,235,250,0.32)",
      extra: "foam",
      shore: "coast",
    },
    snow: {
      top: "#b8d4e6",
      bottom: "#7ea6c0",
      band: "#8a97a4",
      rim: "#4a6478",
      depth: "rgba(60,100,130,0.3)",
      bLight: "rgba(255,255,255,0.2)",
      bDark: "rgba(90,130,160,0.16)",
      glint: "rgba(255,255,255,0.3)",
      extra: "ice",
      shore: "none",
    },
    volcanic: {
      top: "#ff8a2e",
      bottom: "#c23408",
      band: "#160b06",
      rim: "#000000",
      depth: "rgba(120,20,4,0.4)",
      bLight: "rgba(255,215,80,0.35)",
      bDark: "rgba(122,30,5,0.4)",
      glint: "rgba(255,240,150,0.4)",
      extra: "lava",
      shore: "none",
    },
    desert: {
      top: "#2b74ad",
      bottom: "#174f7e",
      band: "#4a3f2c",
      rim: "#101c16",
      depth: "rgba(8,30,52,0.4)",
      bLight: "rgba(120,185,225,0.14)",
      bDark: "rgba(12,45,78,0.18)",
      glint: "rgba(140,205,230,0.28)",
      extra: "none",
      shore: "none",
    },
    cave: {
      top: "#1d4a5e",
      bottom: "#0c2836",
      band: "#232030",
      rim: "#050810",
      depth: "rgba(2,16,26,0.45)",
      bLight: "rgba(90,180,190,0.12)",
      bDark: "rgba(4,26,36,0.2)",
      glint: "rgba(120,210,215,0.25)",
      extra: "none",
      shore: "none",
    },
    dungeon: {
      top: "#1d4a5e",
      bottom: "#0c2836",
      band: "#232030",
      rim: "#050810",
      depth: "rgba(2,16,26,0.45)",
      bLight: "rgba(90,180,190,0.12)",
      bDark: "rgba(4,26,36,0.2)",
      glint: "rgba(120,210,215,0.25)",
      extra: "none",
      shore: "none",
    },
    ruins: {
      top: "#2b6d80",
      bottom: "#154350",
      band: "#3a3a2c",
      rim: "#0c1614",
      depth: "rgba(6,30,36,0.4)",
      bLight: "rgba(120,190,195,0.13)",
      bDark: "rgba(10,42,48,0.18)",
      glint: "rgba(150,210,215,0.26)",
      extra: "none",
      shore: "forest",
    },
  };
  const wl = WATER_LOOKS[biome];

  let hasWater = false;
  groundAt.forEach((g) => {
    if (g === "water") hasWater = true;
  });
  if (wctx && hasWater) {
    const S = 16; // mask subpixels per tile edge (raggedness ~1/16 tile)
    const mw = W * S;
    const mh = H * S;
    const tiny = document.createElement("canvas");
    tiny.width = W;
    tiny.height = H;
    const tinyCtx = tiny.getContext("2d");
    const mask = document.createElement("canvas");
    mask.width = mw;
    mask.height = mh;
    const maskCtx = mask.getContext("2d");
    if (tinyCtx && maskCtx) {
      // Smooth 0..1 water field: 1px-per-tile mask, bilinearly upscaled.
      tinyCtx.fillStyle = "#ffffff";
      mapData.tiles.forEach((tile) => {
        if (terrainToGround(tile.terrain) !== "water") return;
        tinyCtx.fillRect(tile.coordinates.x, tile.coordinates.y, 1, 1);
      });
      maskCtx.imageSmoothingEnabled = true;
      maskCtx.imageSmoothingQuality = "high";
      maskCtx.drawImage(tiny, 0, 0, W, H, 0, 0, mw, mh);
      // Threshold the field against two octaves of noise: coarse clumps of
      // raggedness plus fine grit, like a real eroded bank.
      const img = maskCtx.getImageData(0, 0, mw, mh);
      const d = img.data;
      for (let yy = 0; yy < mh; yy++) {
        for (let xx = 0; xx < mw; xx++) {
          const i4 = (yy * mw + xx) * 4;
          const v = d[i4 + 3] / 255;
          const n =
            (rand(xx >> 2, yy >> 2, 97) - 0.5) * 0.5 +
            (rand(xx, yy, 98) - 0.5) * 0.3;
          const solid = v + n > 0.5;
          d[i4] = 255;
          d[i4 + 1] = 255;
          d[i4 + 2] = 255;
          d[i4 + 3] = solid ? 255 : 0;
        }
      }
      maskCtx.putImageData(img, 0, 0);

      // Mud band: stamp the ragged silhouette in wet-earth at small offsets
      // (a cheap dilation) — the water covers the center, leaving a muddy
      // rim that follows every wiggle of the coastline.
      const mud = document.createElement("canvas");
      mud.width = mw;
      mud.height = mh;
      const mudCtx = mud.getContext("2d");
      if (mudCtx) {
        mudCtx.drawImage(mask, 0, 0);
        mudCtx.globalCompositeOperation = "source-in";
        mudCtx.fillStyle = wl.band;
        mudCtx.fillRect(0, 0, mw, mh);
        ctx.save();
        // Antialiased upscale: the raggedness comes from the noise clumps,
        // not from hard mask pixels — square texels read as pixel art.
        ctx.globalAlpha = 0.38;
        const o = Math.max(2, tileSize * 0.09);
        const offsets: Array<[number, number]> = [
          [-o, 0],
          [o, 0],
          [0, -o],
          [0, o],
          [-o * 0.7, -o * 0.7],
          [o * 0.7, -o * 0.7],
          [-o * 0.7, o * 0.7],
          [o * 0.7, o * 0.7],
        ];
        for (const [ox, oy] of offsets) {
          ctx.drawImage(mud, 0, 0, mw, mh, ox, oy, px, py);
        }
        ctx.restore();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }

      // Dark waterline: the ragged silhouette stamped nearly-black at a
      // tight dilation, so the water sits in a crisp shadowed edge (the
      // reference banks all carry this dark rim inside the mud band).
      const rim = document.createElement("canvas");
      rim.width = mw;
      rim.height = mh;
      const rimCtx = rim.getContext("2d");
      if (rimCtx) {
        rimCtx.drawImage(mask, 0, 0);
        rimCtx.globalCompositeOperation = "source-in";
        rimCtx.fillStyle = wl.rim;
        rimCtx.fillRect(0, 0, mw, mh);
        ctx.save();
        ctx.globalAlpha = 0.5;
        const o2 = Math.max(1, tileSize * 0.045);
        for (const [ox, oy] of [
          [-o2, 0],
          [o2, 0],
          [0, -o2],
          [0, o2],
        ] as Array<[number, number]>) {
          ctx.drawImage(rim, 0, 0, mw, mh, ox, oy, px, py);
        }
        ctx.restore();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }

      // Sea foam: a tight pale fringe stamped just outside the silhouette,
      // over the wet-sand band — surf licking the beach.
      if (wl.extra === "foam") {
        const foam = document.createElement("canvas");
        foam.width = mw;
        foam.height = mh;
        const foamCtx = foam.getContext("2d");
        if (foamCtx) {
          foamCtx.drawImage(mask, 0, 0);
          foamCtx.globalCompositeOperation = "source-in";
          foamCtx.fillStyle = "#eef6f2";
          foamCtx.fillRect(0, 0, mw, mh);
          ctx.save();
          ctx.globalAlpha = 0.4;
          const of = Math.max(1, tileSize * 0.07);
          for (const [ox, oy] of [
            [-of, 0],
            [of, 0],
            [0, -of],
            [0, of],
          ] as Array<[number, number]>) {
            ctx.drawImage(foam, 0, 0, mw, mh, ox, oy, px, py);
          }
          ctx.restore();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
        }
      }

      // Lava glow: broad warm halo stamped far past the silhouette — molten
      // rock lights the basalt around it.
      if (wl.extra === "lava") {
        const glow = document.createElement("canvas");
        glow.width = mw;
        glow.height = mh;
        const glowCtx = glow.getContext("2d");
        if (glowCtx) {
          glowCtx.drawImage(mask, 0, 0);
          glowCtx.globalCompositeOperation = "source-in";
          glowCtx.fillStyle = "#ff9a3d";
          glowCtx.fillRect(0, 0, mw, mh);
          ctx.save();
          ctx.globalAlpha = 0.09;
          const og = tileSize * 0.3;
          const spots: Array<[number, number]> = [
            [-og, 0],
            [og, 0],
            [0, -og],
            [0, og],
            [-og * 0.7, -og * 0.7],
            [og * 0.7, -og * 0.7],
            [-og * 0.7, og * 0.7],
            [og * 0.7, og * 0.7],
          ];
          for (const [ox, oy] of spots) {
            ctx.drawImage(glow, 0, 0, mw, mh, ox, oy, px, py);
          }
          ctx.restore();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
        }
      }

      // Water body: paint the full treatment edge-to-edge, then keep only
      // the ragged silhouette. Rich saturated blue in the open country —
      // dark desaturated water reads as a hole in the map. Swamp water is
      // the exception on purpose: stagnant murk green.
      const grd = wctx.createLinearGradient(0, 0, 0, py);
      grd.addColorStop(0, wl.top);
      grd.addColorStop(1, wl.bottom);
      wctx.fillStyle = grd;
      wctx.fillRect(0, 0, px, py);
      // Depth away from every bank — as a SMOOTH field, not per-tile squares
      // (square depth patches betray the grid through the water surface).
      // Same trick as the coastline: 1px-per-tile raster, bilinear upscale.
      const depthTiny = document.createElement("canvas");
      depthTiny.width = W;
      depthTiny.height = H;
      const depthCtx = depthTiny.getContext("2d");
      if (depthCtx) {
        // Graded depth: BFS distance from the nearest land tile. A binary
        // "interior vs bank" band paints any river wider than two tiles as
        // one flat wash; grading by bank distance gives shallows a bright
        // margin and the channel a dark spine, which is what makes broad
        // water read as water instead of blue paint.
        const dist = new Map<string, number>();
        const queue: Array<[number, number]> = [];
        mapData.tiles.forEach((tile) => {
          if (terrainToGround(tile.terrain) !== "water") return;
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          if (
            isLand(tx, ty - 1) ||
            isLand(tx, ty + 1) ||
            isLand(tx - 1, ty) ||
            isLand(tx + 1, ty)
          ) {
            dist.set(`${tx},${ty}`, 1);
            queue.push([tx, ty]);
          }
        });
        for (let qi = 0; qi < queue.length; qi++) {
          const [qx, qy] = queue[qi];
          const d = dist.get(`${qx},${qy}`)!;
          for (const [nx, ny] of [
            [qx, qy - 1],
            [qx, qy + 1],
            [qx - 1, qy],
            [qx + 1, qy],
          ] as const) {
            const key = `${nx},${ny}`;
            if (dist.has(key)) continue;
            const g = groundAt.get(key);
            if (g !== "water") continue;
            dist.set(key, d + 1);
            queue.push([nx, ny]);
          }
        }
        const depthMatch = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(
          wl.depth.replace(/\s/g, ""),
        );
        const [dr, dg, db, da] = depthMatch
          ? [
              Number(depthMatch[1]),
              Number(depthMatch[2]),
              Number(depthMatch[3]),
              Number(depthMatch[4]),
            ]
          : [8, 30, 52, 0.4];
        const DEPTH_FULL_AT = 4; // bank distance where the wash saturates
        // Raw ring distances terrace into visible stair-step bands on broad
        // water; a box blur over the water mask melts the rings into one
        // continuous shallow-to-deep ramp before the bilinear upscale.
        const alphaAt = new Float32Array(W * H);
        mapData.tiles.forEach((tile) => {
          if (terrainToGround(tile.terrain) !== "water") return;
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          // Crossing cells are the raised bed itself — a ford is SHALLOW by
          // definition, so the deep-water wash must not paint over it.
          if (tile.crossing) return;
          const d = dist.get(`${tx},${ty}`) ?? DEPTH_FULL_AT + 1;
          const t = d <= 1 ? 0 : Math.min(1, (d - 1) / DEPTH_FULL_AT);
          alphaAt[ty * W + tx] = d <= 1 ? 0 : da * (0.35 + 0.65 * t);
        });
        const blurred = new Float32Array(W * H);
        for (let by = 0; by < H; by++) {
          for (let bx = 0; bx < W; bx++) {
            if (groundAt.get(`${bx},${by}`) !== "water") continue;
            let sum = 0;
            let n = 0;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                const sx = bx + ox;
                const sy = by + oy;
                if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
                if (groundAt.get(`${sx},${sy}`) !== "water") continue;
                sum += alphaAt[sy * W + sx];
                n++;
              }
            }
            blurred[by * W + bx] = n > 0 ? sum / n : 0;
          }
        }
        for (let by = 0; by < H; by++) {
          for (let bx = 0; bx < W; bx++) {
            const a = blurred[by * W + bx];
            if (a <= 0.004) continue;
            depthCtx.fillStyle = `rgba(${dr},${dg},${db},${a.toFixed(3)})`;
            depthCtx.fillRect(bx, by, 1, 1);
          }
        }
        wctx.imageSmoothingEnabled = true;
        wctx.imageSmoothingQuality = "high";
        wctx.drawImage(depthTiny, 0, 0, W, H, 0, 0, px, py);
      }
      // Internal turbulence: mottled lighter/darker blotches, plus the
      // continuous-phase ripple glints.
      mapData.tiles.forEach((tile) => {
        if (terrainToGround(tile.terrain) !== "water") return;
        const tx = tile.coordinates.x;
        const ty = tile.coordinates.y;
        if (wl.extra === "ice") {
          // Frozen surface: no turbulence, no ripples — pale sheen streaks
          // and long hairline cracks.
          wctx.fillStyle = "rgba(255,255,255,0.12)";
          wctx.beginPath();
          wctx.ellipse(
            (tx + rand(tx, ty, 101)) * tileSize,
            (ty + rand(ty, tx, 104)) * tileSize,
            tileSize * 0.5,
            tileSize * 0.14,
            (rand(tx, ty, 196) - 0.5) * 0.5,
            0,
            Math.PI * 2,
          );
          wctx.fill();
          if (rand(tx, ty, 197) < 0.3) {
            wctx.strokeStyle = "rgba(235,246,252,0.4)";
            wctx.lineWidth = 1;
            let ix = (tx + rand(tx, ty, 198)) * tileSize;
            let iy = (ty + rand(ty, tx, 199)) * tileSize;
            wctx.beginPath();
            wctx.moveTo(ix, iy);
            for (let sg = 0; sg < 3; sg++) {
              ix += (rand(tx + sg, ty, 200) - 0.5) * tileSize * 1.4;
              iy += (rand(tx, ty + sg, 203) - 0.5) * tileSize * 1.4;
              wctx.lineTo(ix, iy);
            }
            wctx.stroke();
          }
          return;
        }
        for (let b = 0; b < 3; b++) {
          const bx = (tx + rand(tx, ty, 101 + b)) * tileSize;
          const by = (ty + rand(ty, tx, 104 + b)) * tileSize;
          const br = tileSize * (0.14 + rand(tx * 3 + b, ty, 107) * 0.2);
          wctx.fillStyle =
            rand(tx, ty * 3 + b, 108) > 0.5 ? wl.bLight : wl.bDark;
          // Flattened horizontal streaks — round blobs read as bubbles,
          // stretched ones read as surface turbulence (or crust, for lava).
          wctx.beginPath();
          wctx.ellipse(bx, by, br * 1.8, br * 0.5, 0, 0, Math.PI * 2);
          wctx.fill();
        }
        wctx.strokeStyle = wl.glint;
        wctx.lineWidth = 1;
        const phase = Math.sin(tx * 0.9 + ty * 1.7) * 0.5 + 0.5;
        const ry = ty * tileSize + tileSize * (0.25 + phase * 0.5);
        wctx.beginPath();
        wctx.moveTo(tx * tileSize, ry);
        wctx.quadraticCurveTo(
          tx * tileSize + tileSize / 2,
          ry - 3,
          tx * tileSize + tileSize,
          ry,
        );
        wctx.stroke();
        // Duckweed: stagnant swamp water carries floating green flecks.
        if (wl.extra === "duckweed" && rand(tx, ty, 191) < 0.4) {
          wctx.fillStyle = "rgba(116,164,72,0.5)";
          const dots = 2 + Math.floor(rand(tx, ty, 192) * 3);
          for (let dd = 0; dd < dots; dd++) {
            wctx.beginPath();
            wctx.arc(
              (tx + rand(tx * 5 + dd, ty, 193)) * tileSize,
              (ty + rand(tx, ty * 5 + dd, 194)) * tileSize,
              1 + rand(tx + dd, ty - dd, 195) * 1.8,
              0,
              Math.PI * 2,
            );
            wctx.fill();
          }
        }
      });
      // Cut the ragged silhouette and composite nearly crisp — the fractal
      // edge IS the softness; a heavy blur would melt it back into blobs.
      wctx.save();
      wctx.globalCompositeOperation = "destination-in";
      wctx.drawImage(mask, 0, 0, mw, mh, 0, 0, px, py);
      wctx.restore();
      ctx.save();
      ctx.filter = "blur(1px)";
      ctx.drawImage(waterCanvas, 0, 0, px, py);
      ctx.filter = "none";
      ctx.restore();

      // Shore growth: clumps of bushes and reeds hugging the land side of
      // the waterline, overhanging the edge like the reference maps. Frozen
      // ponds and lava get no growth — nothing lives on those banks.
      if (paintAmbientScatter && wl.shore !== "none")
        mapData.tiles.forEach((tile) => {
          if (terrainToGround(tile.terrain) !== "water") return;
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          const sides: Array<[number, number]> = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ];
          for (const [dx, dy] of sides) {
            if (!isLand(tx + dx, ty + dy)) continue;
            const lseed = (tx + dx) * 73 + (ty + dy) * 149;
            // Swamp/jungle banks are crowded; forest occasional; beaches sparse.
            const skip =
              wl.shore === "swamp" ? 0.25 : wl.shore === "coast" ? 0.62 : 0.45;
            if (rand(tx + dx, ty + dy, 111) < skip) continue;
            const ex =
              (tx + 0.5 + dx * 0.55) * tileSize +
              (rand(lseed, 1, 112) - 0.5) * tileSize * 0.4;
            const ey =
              (ty + 0.5 + dy * 0.55) * tileSize +
              (rand(lseed, 2, 113) - 0.5) * tileSize * 0.4;
            drawBush(
              ctx,
              ex,
              ey,
              tileSize * (0.16 + rand(lseed, 3, 114) * 0.12),
              lseed,
              wl.shore === "swamp"
                ? BUSH_SWAMP
                : wl.shore === "coast"
                  ? BUSH_DESERT
                  : BUSH_FOREST,
            );
            // Reeds: thin bright strokes leaning over the water.
            ctx.strokeStyle =
              wl.shore === "swamp"
                ? "rgba(130,160,80,0.8)"
                : wl.shore === "coast"
                  ? "rgba(190,200,120,0.7)"
                  : "rgba(120,170,80,0.75)";
            ctx.lineWidth = 1;
            for (let rb = 0; rb < 4; rb++) {
              const a = Math.atan2(dy, dx) + (rand(lseed, rb, 115) - 0.5) * 1.4;
              const len = tileSize * (0.15 + rand(lseed, rb, 116) * 0.15);
              const sx = ex + (rand(lseed, rb, 117) - 0.5) * tileSize * 0.5;
              const sy = ey + (rand(lseed, rb, 118) - 0.5) * tileSize * 0.5;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
              ctx.stroke();
            }
          }
        });

      // Lily pads floating on shore-touching water (painted decals, drawn
      // over the composited water so they sit ON the surface).
      const lilySprites = biome === "forest" ? textures.pack : null;
      if (paintAmbientScatter && lilySprites) {
        mapData.tiles.forEach((tile) => {
          if (terrainToGround(tile.terrain) !== "water") return;
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          if (!(
            isLand(tx, ty - 1) ||
            isLand(tx, ty + 1) ||
            isLand(tx - 1, ty) ||
            isLand(tx + 1, ty)
          ))
            return;
          if (rand(tx, ty, 371) > 0.18) return;
          const n = 1 + Math.floor(rand(tx, ty, 372) * 2);
          for (let li = 0; li < n; li++) {
            const img = pick(lilySprites.lily, tx + li, ty, 373);
            if (!img) continue;
            stamp(
              ctx,
              img,
              (tx + 0.2 + rand(tx, ty + li, 374) * 0.6) * tileSize,
              (ty + 0.2 + rand(tx + li, ty, 375) * 0.6) * tileSize,
              tileSize * (0.35 + rand(tx - li, ty, 376) * 0.2),
              rand(tx, ty - li, 377) * Math.PI * 2,
            );
          }
        });
      }
    }
  }

  // 2c-ii. Source-backed crossings sit above the completed water layer. The
  // painter groups their referee cells into one joined footprint, but it never
  // chooses a crossing location or changes movement rules; both come from the
  // Region crossing receipt carried on each tile.
  for (const group of collectCrossingPaintGroups(mapData)) {
    const cellIds = new Set(group.cells.map((tile) => tile.id));
    const traceCellUnion = (): void => {
      ctx.beginPath();
      for (const tile of group.cells) {
        const x = (tile.coordinates.x + 0.5) * tileSize;
        const y = (tile.coordinates.y + 0.5) * tileSize;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.01, y);
        if (cellIds.has(`${tile.coordinates.x + 1}-${tile.coordinates.y}`)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + tileSize, y);
        }
        if (cellIds.has(`${tile.coordinates.x}-${tile.coordinates.y + 1}`)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + tileSize);
        }
      }
    };

    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "round";
    if (group.kind === "bridge") {
      const crossing = group.cells[0].crossing!;
      const directionLength =
        Math.hypot(crossing.roadDirection.x, crossing.roadDirection.y) || 1;
      const direction = {
        x: crossing.roadDirection.x / directionLength,
        y: crossing.roadDirection.y / directionLength,
      };
      const sourceAnchor = mapData.provenance?.anchorWorldMeters;
      const center = sourceAnchor
        ? {
            x:
              (Math.floor(W / 2) +
                (crossing.centerWorldMeters.x - sourceAnchor.x) / 1.524) *
              tileSize,
            y:
              (Math.floor(H / 2) +
                (crossing.centerWorldMeters.z - sourceAnchor.z) / 1.524) *
              tileSize,
          }
        : {
            // Legacy/test maps may omit provenance. The crossing cells remain
            // authoritative; their centroid is the least-assumptive fallback.
            x:
              (group.cells.reduce(
                (sum, tile) => sum + tile.coordinates.x + 0.5,
                0,
              ) /
                group.cells.length) *
              tileSize,
            y:
              (group.cells.reduce(
                (sum, tile) => sum + tile.coordinates.y + 0.5,
                0,
              ) /
                group.cells.length) *
              tileSize,
          };
      const spanPx = (crossing.spanMeters / 1.524) * tileSize;
      const widthPx = (crossing.widthMeters / 1.524) * tileSize;
      const halfSpan = spanPx / 2;
      const halfWidth = widthPx / 2;

      // Draw one oriented construction span from the source dimensions. This
      // removes the stair-step silhouette that the referee-cell union produced
      // while leaving collision and movement on those exact cells unchanged.
      ctx.translate(center.x, center.y);
      ctx.rotate(Math.atan2(direction.y, direction.x));
      // Cast shadow onto the water first: a deck several feet above the
      // surface throws a soft offset band. Without it the span reads as
      // paint on the water, not a structure over it.
      ctx.save();
      ctx.shadowColor = "rgba(4,10,22,0.55)";
      ctx.shadowBlur = tileSize * 0.55;
      ctx.shadowOffsetY = tileSize * 0.45;
      ctx.fillStyle = "rgba(4,10,22,0.28)";
      ctx.fillRect(-halfSpan, -halfWidth, spanPx, widthPx);
      ctx.restore();
      ctx.shadowColor = "rgba(8,5,3,0.62)";
      ctx.shadowBlur = tileSize * 0.18;
      ctx.shadowOffsetY = tileSize * 0.12;
      ctx.fillStyle = "#292720";
      ctx.fillRect(-halfSpan - 2, -halfWidth - 2, spanPx + 4, widthPx + 4);
      ctx.shadowColor = "transparent";

      const deckGradient = ctx.createLinearGradient(
        0,
        -halfWidth,
        0,
        halfWidth,
      );
      deckGradient.addColorStop(0, "#5b574e");
      deckGradient.addColorStop(0.18, "#716b5f");
      deckGradient.addColorStop(0.5, "#797265");
      deckGradient.addColorStop(0.82, "#6c665b");
      deckGradient.addColorStop(1, "#514d45");
      ctx.fillStyle = deckGradient;
      ctx.fillRect(-halfSpan, -halfWidth, spanPx, widthPx);

      // World3D already treats Ground decks as town masonry. Repeating joints
      // and restrained value changes keep this view materially consistent and
      // flat, avoiding the false rounded-log read of a strong wood gradient.
      ctx.strokeStyle = "rgba(38,36,32,0.62)";
      ctx.lineWidth = Math.max(1, tileSize * 0.06);
      for (
        let x = -halfSpan + tileSize * 0.7;
        x < halfSpan;
        x += tileSize * 1.4
      ) {
        ctx.beginPath();
        ctx.moveTo(x, -halfWidth + 2);
        ctx.lineTo(x, halfWidth - 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(198,190,170,0.12)";
      for (const lane of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(-halfSpan, widthPx * lane);
        ctx.lineTo(halfSpan, widthPx * lane);
        ctx.stroke();
      }

      // Parallel rails and regular posts give the deck a readable constructed
      // edge instead of allowing its broad route width to resemble floor paint.
      for (const side of [-1, 1]) {
        const railY = side * (halfWidth - Math.max(2, tileSize * 0.08));
        ctx.strokeStyle = "#26241f";
        ctx.lineWidth = Math.max(3, tileSize * 0.22);
        ctx.beginPath();
        ctx.moveTo(-halfSpan, railY);
        ctx.lineTo(halfSpan, railY);
        ctx.stroke();
        ctx.strokeStyle = "rgba(184,178,160,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-halfSpan, railY - side * tileSize * 0.08);
        ctx.lineTo(halfSpan, railY - side * tileSize * 0.08);
        ctx.stroke();
        ctx.fillStyle = "#45423b";
        for (let x = -halfSpan; x <= halfSpan; x += tileSize * 3.5) {
          ctx.fillRect(
            x - tileSize * 0.08,
            railY - tileSize * 0.2,
            tileSize * 0.16,
            tileSize * 0.4,
          );
        }
      }
    } else {
      // Ford, modeled on historic crossings (Roman paved fords, packhorse
      // fords): the riverBED rises — a pale gravel causeway continuing the
      // road line UNDER shallow water — it is never a dry deck. Water keeps
      // flowing over it: crown shading, transverse ripples where the current
      // quickens over the shallows, wheel ruts from cart traffic, and a
      // single-file line of stepping stones upstream for walkers.
      const fordCrossing = group.cells[0].crossing;
      const fordAnchor = mapData.provenance?.anchorWorldMeters;
      if (fordCrossing && fordAnchor) {
        const dirLen =
          Math.hypot(
            fordCrossing.roadDirection.x,
            fordCrossing.roadDirection.y,
          ) || 1;
        const dir = {
          x: fordCrossing.roadDirection.x / dirLen,
          y: fordCrossing.roadDirection.y / dirLen,
        };
        const center = {
          x:
            (Math.floor(W / 2) +
              (fordCrossing.centerWorldMeters.x - fordAnchor.x) / 1.524) *
            tileSize,
          y:
            (Math.floor(H / 2) +
              (fordCrossing.centerWorldMeters.z - fordAnchor.z) / 1.524) *
            tileSize,
        };
        const spanPx = (fordCrossing.spanMeters / 1.524) * tileSize;
        const widthPx = (fordCrossing.widthMeters / 1.524) * tileSize;
        const halfSpan = spanPx / 2;
        const halfWidth = widthPx / 2;
        ctx.translate(center.x, center.y);
        ctx.rotate(Math.atan2(dir.y, dir.x));

        // The bar must survive TACTICAL zoom, not just close-ups. That means:
        // a NARROW committed line (chokepoint read), a crisp wet-sand edge
        // with a dark drop-off rim where the bed falls away (the danger
        // boundary IS the feature), coarse mottling instead of sub-pixel
        // speckle, churned mud mouths where traffic funnels in, and
        // irregular stones — not a rivet line.
        const barHalf = Math.max(halfWidth * 0.85, tileSize * 0.9);
        const edgeSegs = Math.max(8, Math.floor(spanPx / (tileSize * 0.6)));
        const edgeAt = (side: -1 | 1, fx: number) =>
          side *
          (barHalf +
            (rand(Math.round(fx * 7), side, 621) - 0.5) * tileSize * 0.7);
        const traceBar = (inflate: number) => {
          ctx.beginPath();
          for (let s = 0; s <= edgeSegs; s++) {
            const fx = -halfSpan + (s / edgeSegs) * spanPx;
            const fy = edgeAt(-1, fx) - inflate;
            if (s === 0) ctx.moveTo(fx, fy);
            else ctx.lineTo(fx, fy);
          }
          for (let s = edgeSegs; s >= 0; s--) {
            const fx = -halfSpan + (s / edgeSegs) * spanPx;
            ctx.lineTo(fx, edgeAt(1, fx) + inflate);
          }
          ctx.closePath();
        };
        // Drop-off rim FIRST: a dark deep-water line hugging the bar, so the
        // shallow/deep boundary reads as a hard edge, not a gradient.
        traceBar(tileSize * 0.34);
        ctx.fillStyle = "rgba(6,20,34,0.4)";
        ctx.fill();
        // The bar itself: flat wet sand, one honest value, crisp silhouette.
        traceBar(0);
        ctx.fillStyle = "rgba(206,188,142,0.5)";
        ctx.fill();
        // Coarse mottling — patches sized in THIRDS of a tile so texture
        // still reads when the whole map is on screen.
        traceBar(0);
        ctx.save();
        ctx.clip();
        for (let g = 0; g < Math.floor(spanPx / (tileSize * 0.45)); g++) {
          const gx = -halfSpan + rand(g, 1, 622) * spanPx;
          const gy = (rand(g, 2, 623) - 0.5) * barHalf * 1.8;
          const gr = tileSize * (0.2 + rand(g, 4, 625) * 0.3);
          ctx.fillStyle =
            rand(g, 3, 624) > 0.5
              ? "rgba(226,210,164,0.32)"
              : "rgba(112,96,66,0.28)";
          ctx.beginPath();
          ctx.ellipse(gx, gy, gr * 1.5, gr * 0.8, rand(g, 5, 631) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        // Wheel ruts: carts take the crown; two darker wet lines.
        ctx.strokeStyle = "rgba(92,80,52,0.45)";
        ctx.lineWidth = Math.max(1.5, tileSize * 0.1);
        for (const lane of [-0.3, 0.3]) {
          ctx.beginPath();
          ctx.moveTo(-halfSpan, barHalf * lane);
          ctx.lineTo(halfSpan, barHalf * lane);
          ctx.stroke();
        }
        // Thin water film over the bar — the crossing is still SUBMERGED;
        // without this the crisp sand reads as a dry causeway. Strongest
        // mid-channel, fading toward the banks where the bed emerges.
        const filmG = ctx.createLinearGradient(-halfSpan, 0, halfSpan, 0);
        filmG.addColorStop(0, "rgba(62,120,158,0.06)");
        filmG.addColorStop(0.25, "rgba(62,120,158,0.3)");
        filmG.addColorStop(0.5, "rgba(62,120,158,0.36)");
        filmG.addColorStop(0.75, "rgba(62,120,158,0.3)");
        filmG.addColorStop(1, "rgba(62,120,158,0.06)");
        ctx.fillStyle = filmG;
        ctx.fillRect(-halfSpan, -barHalf - tileSize, spanPx, (barHalf + tileSize) * 2);
        ctx.restore();
        // Broken white water on the downstream lip — the current tripping
        // over the drop-off. Chunky dashes, not hairlines.
        ctx.strokeStyle = "rgba(238,246,250,0.6)";
        ctx.lineWidth = Math.max(1.5, tileSize * 0.12);
        for (
          let wx = -halfSpan;
          wx < halfSpan;
          wx += tileSize * (0.6 + rand(Math.round(wx), 5, 626) * 0.7)
        ) {
          ctx.beginPath();
          ctx.moveTo(wx, edgeAt(1, wx) + tileSize * 0.42);
          ctx.lineTo(wx + tileSize * 0.4, edgeAt(1, wx) + tileSize * 0.55);
          ctx.stroke();
        }
        // Churned mud mouths: traffic funnels into the crossing, so both
        // approaches get a dark trampled fan reaching onto the banks.
        for (const end of [-1, 1] as const) {
          const mx = end * halfSpan;
          const mudG = ctx.createRadialGradient(mx, 0, 0, mx, 0, barHalf * 2.6);
          mudG.addColorStop(0, "rgba(58,44,28,0.5)");
          mudG.addColorStop(0.6, "rgba(58,44,28,0.24)");
          mudG.addColorStop(1, "rgba(58,44,28,0)");
          ctx.fillStyle = mudG;
          ctx.beginPath();
          ctx.ellipse(mx, 0, barHalf * 2.6, barHalf * 1.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Upstream pool: water piles up and stills against the bar before
        // spilling over — a smooth, slightly darker band with none of the
        // open river's texture. Downstream gets broken water; upstream gets
        // calm. The asymmetry is what makes the current direction readable.
        const poolG = ctx.createLinearGradient(0, -barHalf - tileSize * 2.6, 0, -barHalf - tileSize * 0.2);
        poolG.addColorStop(0, "rgba(10,30,52,0)");
        poolG.addColorStop(0.55, "rgba(10,30,52,0.24)");
        poolG.addColorStop(1, "rgba(10,30,52,0.34)");
        ctx.fillStyle = poolG;
        ctx.fillRect(-halfSpan, -barHalf - tileSize * 2.6, spanPx, tileSize * 2.4);
        // A single stillness sheen line in the pool — glassy, not rippled.
        ctx.strokeStyle = "rgba(210,228,240,0.18)";
        ctx.lineWidth = Math.max(1, tileSize * 0.07);
        ctx.beginPath();
        ctx.moveTo(-halfSpan + tileSize, -barHalf - tileSize * 1.3);
        ctx.quadraticCurveTo(0, -barHalf - tileSize * 1.05, halfSpan - tileSize, -barHalf - tileSize * 1.4);
        ctx.stroke();

        // Stepping stones: irregular sizes, drunk spacing, ~1 in 5 missing
        // (washed away), occasional doubled stone. Upstream side.
        let sx = -halfSpan + tileSize * 0.5;
        let stoneIdx = 0;
        while (sx < halfSpan) {
          stoneIdx++;
          const skip = rand(stoneIdx, 6, 632) < 0.2;
          const step = tileSize * (0.65 + rand(stoneIdx, 7, 633) * 0.75);
          if (!skip) {
            const stones = rand(stoneIdx, 8, 634) < 0.18 ? 2 : 1;
            for (let st = 0; st < stones; st++) {
              const jx = sx + st * tileSize * 0.28;
              const sy =
                -barHalf -
                tileSize * (0.5 + (rand(stoneIdx + st, 9, 635) - 0.5) * 0.45);
              const sr = tileSize * (0.12 + rand(stoneIdx + st, 10, 636) * 0.14);
              ctx.fillStyle = "rgba(235,245,250,0.4)";
              ctx.beginPath();
              ctx.moveTo(jx + sr * 0.4, sy + sr * 0.7);
              ctx.lineTo(jx + sr * 1.7, sy + sr * 1.5);
              ctx.lineTo(jx + sr * 0.1, sy + sr * 1.1);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = "#5c554a";
              ctx.beginPath();
              ctx.ellipse(jx, sy, sr, sr * (0.62 + rand(stoneIdx, 11, 637) * 0.3), rand(stoneIdx + st, 12, 638) * Math.PI, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(182,174,158,0.75)";
              ctx.beginPath();
              ctx.ellipse(jx - sr * 0.25, sy - sr * 0.22, sr * 0.5, sr * 0.32, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          sx += step;
        }
      } else {
        // Legacy/test maps without crossing receipts keep the simple wet band.
        traceCellUnion();
        ctx.strokeStyle = "rgba(188,166,112,0.42)";
        ctx.lineWidth = tileSize * 1.02;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2d. One rare landmark set-piece per forest map (seeded, about half of
  // maps): standing stones, a toadstool ring, an altar, a sword in the
  // stone, giant mushrooms, or a dragon skeleton. Pure set dressing on open
  // grass — it blocks nothing, it just makes the field a PLACE.
  if (
    paintAmbientScatter &&
    textures.pack &&
    biome === "forest" &&
    rand(mapSeed, 8, 381) < 0.55
  ) {
    // Deterministic search for an open grass tile in the center half.
    let lx = -1;
    let ly = -1;
    for (let tries = 0; tries < 60; tries++) {
      const cxT = Math.floor(W * (0.25 + rand(mapSeed, tries, 382) * 0.5));
      const cyT = Math.floor(H * (0.25 + rand(tries, mapSeed, 383) * 0.5));
      const t = mapData.tiles.get(`${cxT}-${cyT}`);
      if (t && terrainToGround(t.terrain) === "grass" && !t.decoration) {
        lx = cxT;
        ly = cyT;
        break;
      }
    }
    if (lx >= 0) {
      const cxp = (lx + 0.5) * tileSize;
      const cyp = (ly + 0.5) * tileSize;
      const kind = Math.floor(rand(mapSeed, 9, 384) * 4);
      if (kind === 0) {
        // A ring of standing stones.
        const stones = 3 + Math.floor(rand(mapSeed, 10, 385) * 3);
        for (let s = 0; s < stones; s++) {
          const img = pick(textures.pack.standingStone, s, mapSeed, 386);
          if (!img) continue;
          const a = (s / stones) * Math.PI * 2 + rand(mapSeed, s, 387);
          stamp(
            ctx,
            img,
            cxp + Math.cos(a) * tileSize * 1.6,
            cyp + Math.sin(a) * tileSize * 1.6,
            tileSize * (1.1 + rand(mapSeed, s, 388) * 0.4),
            (rand(mapSeed, s, 389) - 0.5) * 0.4,
          );
        }
      } else if (kind === 1) {
        const img = pick(textures.pack.setPiece, mapSeed, 11, 390);
        if (img)
          stamp(
            ctx,
            img,
            cxp,
            cyp,
            tileSize * 1.9,
            (rand(mapSeed, 12, 391) - 0.5) * 0.3,
          );
      } else if (kind === 2) {
        const n = 1 + Math.floor(rand(mapSeed, 13, 392) * 2);
        for (let g = 0; g < n; g++) {
          const img = pick(textures.pack.giantMushroom, g, mapSeed, 393);
          if (img)
            stamp(
              ctx,
              img,
              cxp + (rand(mapSeed, g, 394) - 0.5) * tileSize * 2,
              cyp + (rand(mapSeed, g, 395) - 0.5) * tileSize * 2,
              tileSize * (1.3 + rand(mapSeed, g, 396) * 0.5),
              (rand(mapSeed, g, 397) - 0.5) * 0.4,
            );
        }
      } else {
        const img = textures.pack.dragonSkeleton?.[0] ?? null;
        if (img)
          stamp(
            ctx,
            img,
            cxp,
            cyp,
            tileSize * 4.2,
            rand(mapSeed, 14, 398) * Math.PI * 2,
          );
      }
    }
  }

  // 2d-ii. One rare landmark set-piece per desert map: a T-rex skeleton
  // bleaching in the sand, a cluster of ruined pillars/slabs, or a genie's
  // lamp/carpet oddity. Same "makes it a PLACE" job as the forest set.
  if (
    paintAmbientScatter &&
    textures.pack &&
    biome === "desert" &&
    rand(mapSeed, 8, 441) < 0.5
  ) {
    let lx = -1;
    let ly = -1;
    for (let tries = 0; tries < 60; tries++) {
      const cxT = Math.floor(W * (0.25 + rand(mapSeed, tries, 442) * 0.5));
      const cyT = Math.floor(H * (0.25 + rand(tries, mapSeed, 443) * 0.5));
      const t = mapData.tiles.get(`${cxT}-${cyT}`);
      if (t && terrainToGround(t.terrain) === "sand" && !t.decoration) {
        lx = cxT;
        ly = cyT;
        break;
      }
    }
    if (lx >= 0) {
      const cxp = (lx + 0.5) * tileSize;
      const cyp = (ly + 0.5) * tileSize;
      const kind = Math.floor(rand(mapSeed, 9, 444) * 3);
      if (kind === 0) {
        const img = textures.pack.trexSkeleton?.[0] ?? null;
        if (img)
          stamp(
            ctx,
            img,
            cxp,
            cyp,
            tileSize * 4.6,
            rand(mapSeed, 10, 445) * Math.PI * 2,
          );
      } else if (kind === 1) {
        // Ruined pillars and toppled slabs — a lost temple in the sand.
        const parts = [
          ...(textures.pack.ruin ?? []),
          ...(textures.pack.pillar ?? []),
          ...(textures.pack.slab ?? []),
        ];
        const n = 3 + Math.floor(rand(mapSeed, 11, 446) * 3);
        for (let s = 0; s < n; s++) {
          const img = pick(parts, s, mapSeed, 447);
          if (!img) continue;
          const a = (s / n) * Math.PI * 2 + rand(mapSeed, s, 448);
          stamp(
            ctx,
            img,
            cxp + Math.cos(a) * tileSize * 1.7,
            cyp + Math.sin(a) * tileSize * 1.7,
            tileSize * (1.1 + rand(mapSeed, s, 449) * 0.5),
            (rand(mapSeed, s, 450) - 0.5) * 0.5,
          );
        }
      } else {
        const img = pick(textures.pack.setPiece, mapSeed, 12, 451);
        if (img)
          stamp(
            ctx,
            img,
            cxp,
            cyp,
            tileSize * 1.6,
            (rand(mapSeed, 13, 452) - 0.5) * 0.3,
          );
      }
    }
  }

  // 2f. Woodland floor: a humus/needle-litter halo under every source tree,
  // drawn BEFORE the trees so overlapping halos merge into continuous forest-
  // floor masses. Lone tree glyphs on bright meadow grass read as scribbles;
  // the same trees over a shared dark floor read as a wood. This is
  // renderer-authored continuous texture keyed to source tree positions —
  // no synthetic objects are invented.
  if (
    options.showDecorations !== false &&
    (biome === "forest" || biome === "jungle" || biome === "swamp")
  ) {
    const floorInk =
      biome === "swamp" ? "rgba(18,28,14," : "rgba(22,38,18,";
    mapData.tiles.forEach((tile) => {
      if (tile.decoration !== "tree" && tile.decoration !== "bush") return;
      const tx = tile.coordinates.x;
      const ty = tile.coordinates.y;
      const cx = (tx + 0.5) * tileSize;
      const cy = (ty + 0.5) * tileSize;
      const big = tile.decoration === "tree";
      // Two stacked soft blobs: a wide faint litter spread and a tighter,
      // darker humus core. Jitter keeps merged masses organic.
      for (const [radiusTiles, alpha] of big
        ? ([[2.1, 0.16], [1.15, 0.22]] as const)
        : ([[1.2, 0.12], [0.7, 0.16]] as const)) {
        const jx = cx + (rand(tx, ty, 641) - 0.5) * tileSize * 0.5;
        const jy = cy + (rand(ty, tx, 642) - 0.5) * tileSize * 0.5;
        const r = tileSize * radiusTiles * (0.85 + rand(tx, ty, 643) * 0.3);
        const g = ctx.createRadialGradient(jx, jy, 0, jx, jy, r);
        g.addColorStop(0, `${floorInk}${alpha})`);
        g.addColorStop(0.7, `${floorInk}${alpha * 0.6})`);
        g.addColorStop(1, `${floorInk}0)`);
        ctx.fillStyle = g;
        ctx.fillRect(jx - r, jy - r, r * 2, r * 2);
      }
    });
  }

  // 3. Foliage + rocks from tile decorations (drawn large, top-down).
  // The asset-overlay toggle hides this whole pass while preserving the base
  // terrain paint. That gives users a clean tactical read without deleting the
  // authored/generated decorations from the map data.
  if (options.showDecorations !== false) {
    mapData.tiles.forEach((tile) => {
      const cx = tile.coordinates.x * tileSize + tileSize / 2;
      const cy = tile.coordinates.y * tileSize + tileSize / 2;
      const seed = tile.coordinates.x * 73 + tile.coordinates.y * 149;
      const fsp = biome === "forest" ? textures.pack : null;
      const dsp = biome === "desert" ? textures.pack : null;
      // Props carry baked shadows — keep rotation shallow so light stays
      // coherent across the board.
      const propRot = (salt: number) => (rand(seed, salt, 311) - 0.5) * 0.25;
      switch (tile.decoration) {
        case "tree": {
          const img = pick(fsp?.tree, seed, 0, 312);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (2.1 + rand(seed, 1, 313) * 0.6),
              propRot(1),
            );
          else if (biome === "snow")
            drawPine(ctx, cx, cy, tileSize * 0.66, seed);
          else
            drawTree(
              ctx,
              cx,
              cy,
              tileSize * (biome === "jungle" ? 0.82 : 0.7),
              seed,
            );
          break;
        }
        case "mangrove":
          drawMangrove(ctx, cx, cy, tileSize * 0.68, seed);
          break;
        case "boulder": {
          const img = pick(fsp?.rockBig ?? dsp?.rockBig, seed, 0, 314);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (1.2 + rand(seed, 2, 315) * 0.4),
              propRot(2),
            );
          else
            drawRock(
              ctx,
              cx,
              cy,
              tileSize * 0.5,
              seed,
              biome === "desert" ? ROCK_SAND : indoor ? ROCK_DARK : ROCK_GRAY,
            );
          break;
        }
        case "bush": {
          // Cover-providing bush: must always be VISIBLE (it previously fell
          // through to random understory and could draw nothing).
          const img = pick(fsp?.bush, seed, 0, 316);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (1.05 + rand(seed, 3, 317) * 0.3),
              propRot(3),
            );
          else
            drawBush(
              ctx,
              cx,
              cy,
              tileSize * 0.42,
              seed,
              biome === "swamp"
                ? BUSH_SWAMP
                : biome === "desert"
                  ? BUSH_DESERT
                  : BUSH_FOREST,
            );
          break;
        }
        case "stump": {
          const img = pick(fsp?.stump, seed, 0, 318);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (0.9 + rand(seed, 4, 319) * 0.2),
              propRot(4),
            );
          else drawLog(ctx, cx, cy, tileSize * 0.55, seed);
          break;
        }
        case "fallen_log": {
          const img = pick(fsp?.log, seed, 0, 320);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (1.6 + rand(seed, 5, 321) * 0.4),
              (rand(seed, 6, 322) - 0.5) * 0.7,
            );
          else drawLog(ctx, cx, cy, tileSize * 0.9, seed);
          break;
        }
        case "stalagmite":
          drawStalagmite(ctx, cx, cy, tileSize * 0.5, seed);
          break;
        case "pillar":
          drawPillar(ctx, cx, cy, tileSize * 0.44, seed);
          break;
        case "cactus": {
          // Painted saguaros and barrel cacti when the desert pack is present.
          const pool = dsp
            ? [...(dsp.cactus ?? []), ...(dsp.roundCactus ?? [])]
            : undefined;
          const img = pick(pool, seed, 0, 314);
          if (img)
            stamp(
              ctx,
              img,
              cx,
              cy,
              tileSize * (0.95 + rand(seed, 2, 315) * 0.45),
              propRot(2),
            );
          else drawCactus(ctx, cx, cy, tileSize * 0.5, seed);
          break;
        }
        default: {
          // World-derived maps draw only objects that exist in GroundWorld. The
          // base texture still carries grass and soil detail, but leaves,
          // flowers, saplings, and loose rocks are not invented per tile.
          if (!paintAmbientScatter) {
            break;
          }

          // Understory scatter, biome by biome. Densities are deliberately
          // high — a battlefield should read as a populated place, not an
          // empty arena.
          const ground = terrainToGround(tile.terrain);
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          const roll = rand(tx, ty, 61);
          if (biome === "forest" && ground === "grass" && textures.pack) {
            // Painted understory from the token pack. Offsets keep clumps off
            // exact tile centers; flat decals (leaves/flowers/tracks) rotate
            // freely, shadowed props stay near upright.
            const fs2 = textures.pack;
            const ox = cx + (rand(seed, 1, 331) - 0.5) * tileSize * 0.7;
            const oy = cy + (rand(seed, 2, 332) - 0.5) * tileSize * 0.7;
            const freeRot = rand(seed, 3, 333) * Math.PI * 2;
            if (roll < 0.1) {
              const img = pick(fs2.leaves, seed, 0, 334);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (1.2 + rand(seed, 4, 335) * 0.6),
                  freeRot,
                );
            } else if (roll < 0.18) {
              const img = pick(fs2.fern, seed, 0, 336);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.7 + rand(seed, 5, 337) * 0.3),
                  (rand(seed, 6, 338) - 0.5) * 0.5,
                );
            } else if (roll < 0.24) {
              const img = pick(fs2.stick, seed, 0, 339);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.7 + rand(seed, 7, 340) * 0.4),
                  (rand(seed, 8, 341) - 0.5) * 1.2,
                );
            } else if (roll < 0.29) {
              // Flowers come in little clusters, never alone.
              const n = 1 + Math.floor(rand(seed, 9, 342) * 3);
              for (let f = 0; f < n; f++) {
                const img = pick(fs2.flower, seed + f, f, 343);
                if (img)
                  stamp(
                    ctx,
                    img,
                    ox + (rand(seed, f, 344) - 0.5) * tileSize * 0.6,
                    oy + (rand(seed, f, 345) - 0.5) * tileSize * 0.6,
                    tileSize * (0.28 + rand(seed, f, 346) * 0.14),
                    rand(seed, f, 347) * Math.PI * 2,
                  );
              }
            } else if (roll < 0.32) {
              const img = pick(fs2.mushroom, seed, 0, 348);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.35 + rand(seed, 10, 349) * 0.2),
                  (rand(seed, 11, 350) - 0.5) * 0.6,
                );
            } else if (roll < 0.37) {
              const img = pick(fs2.rockSmall, seed, 0, 351);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.4 + rand(seed, 12, 352) * 0.3),
                  (rand(seed, 13, 353) - 0.5) * 0.8,
                );
            } else if (roll < 0.41) {
              const img = pick(fs2.bush, seed, 0, 354);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.8 + rand(seed, 14, 355) * 0.3),
                  (rand(seed, 15, 356) - 0.5) * 0.25,
                );
            } else if (roll < 0.425) {
              const img = pick(fs2.roots, seed, 0, 357);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.9 + rand(seed, 16, 358) * 0.4),
                  (rand(seed, 17, 359) - 0.5) * 1.0,
                );
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(150,190,95,0.5)",
              "rgba(60,100,55,0.55)",
              0.3,
            );
          } else if (biome === "forest" && ground === "grass") {
            if (roll < 0.11) {
              drawBush(
                ctx,
                cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5,
                tileSize * (0.28 + rand(seed, 3, 64) * 0.14),
                seed,
              );
            } else if (roll < 0.135) {
              drawLog(ctx, cx, cy, tileSize * 0.9, seed);
            } else if (roll < 0.19) {
              // Sapling: a young tree, visually smaller than a blocking canopy
              // so it never lies about cover.
              drawTree(
                ctx,
                cx + (rand(seed, 4, 65) - 0.5) * tileSize * 0.4,
                cy + (rand(seed, 5, 66) - 0.5) * tileSize * 0.4,
                tileSize * (0.26 + rand(seed, 6, 67) * 0.12),
                seed,
              );
            } else if (roll < 0.24) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.1 + rand(seed, 9, 70) * 0.08),
                seed,
              );
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(150,190,95,0.55)",
              "rgba(60,100,55,0.6)",
              0.5,
            );
          } else if (biome === "swamp" && ground === "grass") {
            if (roll < 0.1) {
              drawBush(
                ctx,
                cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5,
                tileSize * (0.26 + rand(seed, 3, 64) * 0.12),
                seed,
                BUSH_SWAMP,
              );
            } else if (roll < 0.13) {
              drawLog(ctx, cx, cy, tileSize * 0.9, seed);
            } else if (roll < 0.18 && tile.terrain === "difficult") {
              // Root tangles on thick-mud tiles: the difficult terrain shows
              // WHY it is difficult.
              ctx.strokeStyle = "#3a2d1c";
              ctx.lineCap = "round";
              for (let rt = 0; rt < 4; rt++) {
                const a = rand(seed, rt, 201) * Math.PI * 2;
                ctx.lineWidth = 1.5 + rand(seed, rt, 202) * 1.5;
                ctx.beginPath();
                ctx.moveTo(
                  cx + Math.cos(a) * tileSize * 0.1,
                  cy + Math.sin(a) * tileSize * 0.1,
                );
                ctx.quadraticCurveTo(
                  cx + Math.cos(a + 0.6) * tileSize * 0.25,
                  cy + Math.sin(a + 0.6) * tileSize * 0.25,
                  cx + Math.cos(a) * tileSize * 0.45,
                  cy + Math.sin(a) * tileSize * 0.45,
                );
                ctx.stroke();
              }
            }
            // Marsh reeds are the swamp's tufts: taller, denser, duller.
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(140,160,90,0.6)",
              "rgba(52,72,40,0.65)",
              0.6,
            );
          } else if (biome === "desert" && ground === "dirt" && textures.pack) {
            // Rock-outcrop tiles: a cluster of painted desert boulders — the
            // outcrop is a thing you can see, not just a stain.
            const dp = textures.pack;
            const rocks = 1 + Math.floor(rand(tx, ty, 187) * 2);
            for (let rk = 0; rk < rocks; rk++) {
              const img = pick(dp.rockBig, seed + rk, rk, 411);
              if (img)
                stamp(
                  ctx,
                  img,
                  cx + (rand(seed, rk, 188) - 0.5) * tileSize * 0.7,
                  cy + (rand(seed, rk, 189) - 0.5) * tileSize * 0.7,
                  tileSize * (0.7 + rand(seed, rk, 190) * 0.5),
                  (rand(seed, rk, 191) - 0.5) * 0.25,
                );
            }
          } else if (biome === "desert" && ground === "dirt") {
            const rocks = 1 + Math.floor(rand(tx, ty, 187) * 2);
            for (let rk = 0; rk < rocks; rk++) {
              drawRock(
                ctx,
                cx + (rand(seed, rk, 188) - 0.5) * tileSize * 0.6,
                cy + (rand(seed, rk, 189) - 0.5) * tileSize * 0.6,
                tileSize * (0.16 + rand(seed, rk, 190) * 0.14),
                seed + rk,
                ROCK_SAND,
              );
            }
          } else if (biome === "desert" && ground === "sand" && textures.pack) {
            // Painted desert scatter: dry brush, sun-bleached bones, cracked
            // wood, small stones, a tumbleweed, the rare still critter. Kept
            // sparse — a desert reads as mostly empty sand.
            const dp = textures.pack;
            const ox = cx + (rand(seed, 1, 421) - 0.5) * tileSize * 0.7;
            const oy = cy + (rand(seed, 2, 422) - 0.5) * tileSize * 0.7;
            const upright = (rand(seed, 3, 423) - 0.5) * 0.25;
            const free = rand(seed, 4, 424) * Math.PI * 2;
            if (roll < 0.05) {
              const img = pick(dp.smallRock, seed, 0, 425);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.35 + rand(seed, 5, 426) * 0.3),
                  free,
                );
            } else if (roll < 0.085) {
              const img = pick(dp.bush, seed, 0, 427);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.5 + rand(seed, 6, 428) * 0.3),
                  upright,
                );
            } else if (roll < 0.11) {
              const img = pick(dp.dryWood, seed, 0, 429);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.7 + rand(seed, 7, 430) * 0.4),
                  free,
                );
            } else if (roll < 0.13) {
              const img = pick(dp.bone, seed, 0, 431);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.4 + rand(seed, 8, 432) * 0.3),
                  free,
                );
            } else if (roll < 0.145) {
              const img = pick(dp.fern, seed, 0, 433);
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.5 + rand(seed, 9, 434) * 0.3),
                  upright,
                );
            } else if (roll < 0.155) {
              const img = pick(
                [
                  ...(dp.tumbleweed ?? []),
                  ...(dp.succulent ?? []),
                  ...(dp.creature ?? []),
                ],
                seed,
                0,
                435,
              );
              if (img)
                stamp(
                  ctx,
                  img,
                  ox,
                  oy,
                  tileSize * (0.45 + rand(seed, 10, 436) * 0.3),
                  free,
                );
            }
            // Very sparse bleached dry grass.
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(210,190,130,0.5)",
              "rgba(150,130,80,0.45)",
              0.14,
            );
          } else if (biome === "desert" && ground === "sand") {
            if (roll < 0.05) {
              drawBush(
                ctx,
                cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5,
                tileSize * (0.2 + rand(seed, 3, 64) * 0.1),
                seed,
                BUSH_DESERT,
              );
            } else if (roll < 0.13) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.08 + rand(seed, 9, 70) * 0.08),
                seed,
                ROCK_SAND,
              );
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(210,190,130,0.55)",
              "rgba(150,130,80,0.5)",
              0.25,
            );
          } else if (biome === "cave" && ground === "dirt") {
            if (roll < 0.03) {
              drawStalagmite(
                ctx,
                cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.4,
                cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.4,
                tileSize * 0.22,
                seed,
              );
            } else if (roll < 0.07) {
              // Crystal clusters: cold glowing shards — the cavern's jewelry.
              drawCrystal(
                ctx,
                cx + (rand(seed, 1, 254) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 2, 255) - 0.5) * tileSize * 0.5,
                tileSize * (0.16 + rand(seed, 3, 256) * 0.1),
                seed,
              );
            } else if (roll < 0.13) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.08 + rand(seed, 9, 70) * 0.07),
                seed,
                ROCK_DARK,
              );
            } else if (roll < 0.24) {
              // Glow fungus cluster: cave life, and its scattered light.
              const gx2 = cx + (rand(seed, 1, 211) - 0.5) * tileSize * 0.6;
              const gy2 = cy + (rand(seed, 2, 212) - 0.5) * tileSize * 0.6;
              const halo = ctx.createRadialGradient(
                gx2,
                gy2,
                0,
                gx2,
                gy2,
                tileSize * 0.5,
              );
              halo.addColorStop(0, "rgba(90,220,200,0.2)");
              halo.addColorStop(1, "rgba(90,220,200,0)");
              ctx.fillStyle = halo;
              ctx.fillRect(
                gx2 - tileSize * 0.5,
                gy2 - tileSize * 0.5,
                tileSize,
                tileSize,
              );
              ctx.fillStyle = "rgba(140,240,220,0.85)";
              for (let m = 0; m < 3; m++) {
                ctx.beginPath();
                ctx.arc(
                  gx2 + (rand(seed, m, 213) - 0.5) * tileSize * 0.25,
                  gy2 + (rand(seed, m, 214) - 0.5) * tileSize * 0.25,
                  1.2 + rand(seed, m, 215) * 1.6,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            } else if (roll < 0.3) {
              // Mineral vein: a thin amber or cyan seam in the floor.
              ctx.strokeStyle =
                rand(tx, ty, 257) > 0.5
                  ? "rgba(210,170,90,0.35)"
                  : "rgba(110,200,210,0.3)";
              ctx.lineWidth = 1;
              let vx = cx + (rand(seed, 0, 258) - 0.5) * tileSize * 0.6;
              let vy = cy + (rand(seed, 1, 259) - 0.5) * tileSize * 0.6;
              ctx.beginPath();
              ctx.moveTo(vx, vy);
              for (let sg = 0; sg < 3; sg++) {
                vx += (rand(seed, sg, 260) - 0.5) * tileSize * 0.8;
                vy += (rand(seed, sg + 3, 260) - 0.5) * tileSize * 0.8;
                ctx.lineTo(vx, vy);
              }
              ctx.stroke();
            }
          } else if (biome === "snow" && ground === "grass") {
            if (roll < 0.05) {
              // Bare wind-stripped shrub: dark twiggy strokes.
              ctx.strokeStyle = "rgba(60,48,36,0.7)";
              ctx.lineWidth = 1;
              for (let tw = 0; tw < 5; tw++) {
                const a = rand(seed, tw, 271) * Math.PI * 2;
                const len = tileSize * (0.1 + rand(seed, tw, 272) * 0.14);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
                ctx.stroke();
              }
            } else if (roll < 0.1) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.09 + rand(seed, 9, 70) * 0.08),
                seed,
              );
            } else if (roll < 0.22) {
              // Wind-sculpted snow hummock.
              ctx.fillStyle = "rgba(255,255,255,0.35)";
              ctx.beginPath();
              ctx.ellipse(
                cx,
                cy,
                tileSize * (0.25 + rand(seed, 4, 273) * 0.2),
                tileSize * 0.14,
                rand(seed, 5, 274) * Math.PI,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(150,140,100,0.5)",
              "rgba(90,84,60,0.55)",
              0.15,
            );
          } else if (biome === "jungle" && ground === "grass") {
            if (roll < 0.14) {
              drawBush(
                ctx,
                cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5,
                tileSize * (0.3 + rand(seed, 3, 64) * 0.14),
                seed,
              );
            } else if (roll < 0.26) {
              // Big-leaf plant: elongated leaves radiating from a crown.
              ctx.fillStyle =
                rand(tx, ty, 281) > 0.5
                  ? "rgba(60,130,55,0.8)"
                  : "rgba(40,100,45,0.8)";
              const leaves = 4 + Math.floor(rand(seed, 0, 282) * 3);
              for (let lf = 0; lf < leaves; lf++) {
                const a = (lf / leaves) * Math.PI * 2 + rand(seed, lf, 283);
                const len = tileSize * (0.2 + rand(seed, lf, 284) * 0.16);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(a);
                ctx.beginPath();
                ctx.ellipse(
                  len * 0.55,
                  0,
                  len * 0.55,
                  len * 0.16,
                  0,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
                ctx.restore();
              }
            } else if (roll < 0.3) {
              drawLog(ctx, cx, cy, tileSize * 0.9, seed);
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(140,210,90,0.6)",
              "rgba(40,90,45,0.65)",
              0.55,
            );
          } else if (biome === "coast" && ground === "sand") {
            if (roll < 0.04) {
              // Shell flecks: tiny pale specks in the sand.
              ctx.fillStyle = "rgba(245,240,225,0.7)";
              for (let sh = 0; sh < 3; sh++) {
                ctx.beginPath();
                ctx.arc(
                  cx + (rand(seed, sh, 291) - 0.5) * tileSize * 0.8,
                  cy + (rand(seed, sh, 292) - 0.5) * tileSize * 0.8,
                  0.8 + rand(seed, sh, 293),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            } else if (roll < 0.09) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.08 + rand(seed, 9, 70) * 0.07),
                seed,
              );
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(205,205,130,0.55)",
              "rgba(140,140,85,0.5)",
              0.18,
            );
          } else if (biome === "coast" && ground === "grass") {
            // Dune-grass tiles are all tufts.
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(180,195,110,0.65)",
              "rgba(110,125,65,0.6)",
              0.8,
            );
            if (roll < 0.08) {
              drawBush(
                ctx,
                cx,
                cy,
                tileSize * (0.2 + rand(seed, 3, 64) * 0.1),
                seed,
                BUSH_DESERT,
              );
            }
          } else if (biome === "ruins") {
            if (ground === "dirt") {
              if (roll < 0.08) {
                // Floor crack (same recipe as dungeon).
                ctx.strokeStyle = "rgba(10,10,14,0.5)";
                ctx.lineWidth = 1;
                let cxx = cx + (rand(seed, 0, 221) - 0.5) * tileSize * 0.6;
                let cyy = cy + (rand(seed, 1, 222) - 0.5) * tileSize * 0.6;
                ctx.beginPath();
                ctx.moveTo(cxx, cyy);
                for (let sg = 0; sg < 3; sg++) {
                  cxx += (rand(seed, sg, 223) - 0.5) * tileSize * 0.7;
                  cyy += (rand(seed, sg, 224) - 0.5) * tileSize * 0.7;
                  ctx.lineTo(cxx, cyy);
                }
                ctx.stroke();
              } else if (roll < 0.2) {
                // Moss reclaiming the paving — ruins get far more than dungeons.
                ctx.fillStyle = "rgba(76,110,58,0.3)";
                ctx.beginPath();
                ctx.ellipse(
                  cx + (rand(seed, 2, 225) - 0.5) * tileSize * 0.7,
                  cy + (rand(seed, 3, 226) - 0.5) * tileSize * 0.7,
                  tileSize * 0.32,
                  tileSize * 0.22,
                  rand(seed, 4, 227) * Math.PI,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              } else if (roll < 0.26) {
                drawRock(
                  ctx,
                  cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                  cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                  tileSize * (0.08 + rand(seed, 9, 70) * 0.07),
                  seed,
                  ROCK_DARK,
                );
              }
            } else if (ground === "grass") {
              if (roll < 0.1) {
                drawBush(
                  ctx,
                  cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5,
                  cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5,
                  tileSize * (0.24 + rand(seed, 3, 64) * 0.12),
                  seed,
                );
              }
              drawTuft(
                ctx,
                tile,
                tileSize,
                seed,
                "rgba(150,180,95,0.55)",
                "rgba(70,100,55,0.6)",
                0.5,
              );
            } else if (tile.terrain === "difficult") {
              // Rubble field: a pile of small broken stones.
              for (let rb = 0; rb < 3; rb++) {
                drawRock(
                  ctx,
                  cx + (rand(seed, rb, 295) - 0.5) * tileSize * 0.7,
                  cy + (rand(seed, rb, 296) - 0.5) * tileSize * 0.7,
                  tileSize * (0.07 + rand(seed, rb, 297) * 0.07),
                  seed + rb,
                  ROCK_DARK,
                );
              }
            }
          } else if (biome === "volcanic" && ground === "dirt") {
            if (roll < 0.06) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.1 + rand(seed, 9, 70) * 0.1),
                seed,
                ROCK_DARK,
              );
            } else if (roll < 0.09) {
              // Ember vent: a glowing pinprick in the basalt.
              const vx2 = cx + (rand(seed, 1, 298) - 0.5) * tileSize * 0.6;
              const vy2 = cy + (rand(seed, 2, 299) - 0.5) * tileSize * 0.6;
              const halo = ctx.createRadialGradient(
                vx2,
                vy2,
                0,
                vx2,
                vy2,
                tileSize * 0.4,
              );
              halo.addColorStop(0, "rgba(255,150,50,0.3)");
              halo.addColorStop(1, "rgba(255,150,50,0)");
              ctx.fillStyle = halo;
              ctx.fillRect(
                vx2 - tileSize * 0.4,
                vy2 - tileSize * 0.4,
                tileSize * 0.8,
                tileSize * 0.8,
              );
              ctx.fillStyle = "rgba(255,200,90,0.9)";
              ctx.beginPath();
              ctx.arc(vx2, vy2, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }
            drawTuft(
              ctx,
              tile,
              tileSize,
              seed,
              "rgba(140,130,120,0.45)",
              "rgba(80,72,66,0.5)",
              0.1,
            );
          } else if (biome === "dungeon" && ground === "dirt") {
            if (roll < 0.06) {
              // Floor crack: a thin dark 2-3 segment polyline.
              ctx.strokeStyle = "rgba(10,10,14,0.5)";
              ctx.lineWidth = 1;
              let cxx = cx + (rand(seed, 0, 221) - 0.5) * tileSize * 0.6;
              let cyy = cy + (rand(seed, 1, 222) - 0.5) * tileSize * 0.6;
              ctx.beginPath();
              ctx.moveTo(cxx, cyy);
              for (let sg = 0; sg < 3; sg++) {
                cxx += (rand(seed, sg, 223) - 0.5) * tileSize * 0.7;
                cyy += (rand(seed, sg, 224) - 0.5) * tileSize * 0.7;
                ctx.lineTo(cxx, cyy);
              }
              ctx.stroke();
            } else if (roll < 0.1) {
              // Moss stain creeping out of a corner.
              ctx.fillStyle = "rgba(66,96,52,0.25)";
              ctx.beginPath();
              ctx.ellipse(
                cx + (rand(seed, 2, 225) - 0.5) * tileSize * 0.7,
                cy + (rand(seed, 3, 226) - 0.5) * tileSize * 0.7,
                tileSize * 0.3,
                tileSize * 0.2,
                rand(seed, 4, 227) * Math.PI,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            } else if (roll < 0.13) {
              drawRock(
                ctx,
                cx + (rand(seed, 7, 68) - 0.5) * tileSize * 0.5,
                cy + (rand(seed, 8, 69) - 0.5) * tileSize * 0.5,
                tileSize * (0.07 + rand(seed, 9, 70) * 0.06),
                seed,
                ROCK_DARK,
              );
            }
          }
          break;
        }
      }
    });
  }

  // 4. Vignette — darken the edges so the board feels lit from within.
  // Heavier underground (enclosed dark), lighter under an open desert sky.
  const VIGNETTE: Record<CombatBiome, number> = {
    forest: 0.35,
    swamp: 0.42,
    desert: 0.22,
    cave: 0.5,
    dungeon: 0.45,
    snow: 0.25,
    jungle: 0.42,
    coast: 0.25,
    ruins: 0.35,
    volcanic: 0.45,
  };
  const vignetteStrength = VIGNETTE[biome];
  const vg = ctx.createRadialGradient(
    px / 2,
    py / 2,
    Math.min(px, py) * 0.35,
    px / 2,
    py / 2,
    Math.max(px, py) * 0.7,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, px, py);

  // 5. A couple of soft light dapples for warmth — sky biomes only; there is
  // no sunlight underground to dapple.
  if (!indoor && biome !== "volcanic") {
    const dappleA = biome === "swamp" || biome === "jungle" ? 0.06 : 0.1;
    for (let i = 0; i < 3; i++) {
      const lx = px * (0.2 + rand(i, 0, 6) * 0.6);
      const ly = py * (0.2 + rand(i, 1, 7) * 0.6);
      const lr = Math.min(px, py) * 0.18;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, `rgba(255,236,170,${dappleA})`);
      lg.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
  }

  // 5b. Swamp mist: a few broad pale-green fog banks lying over everything —
  // the swamp's signature mood.
  if (biome === "swamp") {
    for (let i = 0; i < 5; i++) {
      const mx = px * rand(i, 3, 231);
      const my = py * rand(i, 4, 232);
      const mr = tileSize * (5 + rand(i, 5, 233) * 6);
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, "rgba(170,190,160,0.1)");
      mg.addColorStop(1, "rgba(170,190,160,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
  }

  // 6. Time-of-day tint keyed off the map seed, so re-rolled encounters
  // don't all read as the same noon meadow: noon (none), golden hour,
  // overcast, and dusk each get a cheap full-board wash. Underground
  // biomes skip it — caves have no sky.
  if (!indoor) {
    const seed = mapData.seed ?? 0;
    const tod = Math.floor(rand(seed % 9973, seed % 7919, 71) * 4);
    if (tod === 1) {
      ctx.fillStyle = "rgba(255,170,60,0.10)"; // golden hour
      ctx.fillRect(0, 0, px, py);
    } else if (tod === 2) {
      ctx.fillStyle = "rgba(120,135,160,0.14)"; // overcast
      ctx.fillRect(0, 0, px, py);
    } else if (tod === 3) {
      ctx.fillStyle = "rgba(50,60,130,0.16)"; // dusk
      ctx.fillRect(0, 0, px, py);
      ctx.fillStyle = "rgba(255,140,50,0.05)";
      ctx.fillRect(0, 0, px, py);
    }
  }
}
