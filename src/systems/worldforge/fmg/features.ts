// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 10/07/2026, 13:11:03
 * Dependents: systems/worldforge/fmg/biomes.ts, systems/worldforge/fmg/burgs-generator.ts, systems/worldforge/fmg/coa-generator.ts, systems/worldforge/fmg/cultures-generator.ts, systems/worldforge/fmg/generateAtlas.ts, systems/worldforge/fmg/generateBase.ts, systems/worldforge/fmg/ice.ts, systems/worldforge/fmg/lakes.ts, systems/worldforge/fmg/markers-generator.ts, systems/worldforge/fmg/military-generator.ts, systems/worldforge/fmg/names-generator.ts, systems/worldforge/fmg/provinces-generator.ts, systems/worldforge/fmg/rankCells.ts, systems/worldforge/fmg/reGraph.ts, systems/worldforge/fmg/religions-generator.ts, systems/worldforge/fmg/river-generator.ts, systems/worldforge/fmg/routes-generator.ts, systems/worldforge/fmg/states-generator.ts, systems/worldforge/fmg/utils/graphUtils.ts, systems/worldforge/fmg/zones-generator.ts, systems/worldforge/provenance/worldCell.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file features.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/features.ts. See ./ATTRIBUTION.md.
 *
 * Faithfulness: markupGrid (grid-level ocean/lake/island detection +
 * distance field), markupPack (pack-level features, haven/harbor) and
 * defineGroups are exact ports — flood-fill order, queue handling and the
 * `[0, ...features]` placeholder layout are preserved.
 *
 * Adaptations (cosmetic only):
 * - `grid`, `pack`, `seed`, `graphWidth`, `graphHeight` are explicit
 *   parameters (upstream globals).
 * - markupPack/defineGroups are ported for the later pack stage (reGraph is
 *   not part of slice 1); generateBase only exercises markupGrid.
 * - Non-null assertions added for strict TS; upstream `grid` was `any`.
 */
import Alea from "alea";
import { polygonArea } from "./d3Shim";
import {
  clipPoly,
  connectVertices,
  createTypedArray,
  distanceSquared,
  isLand,
  isWater,
  rn,
  TYPED_ARRAY_MAX_VALUES,
  unique,
} from "./utils";
import type { Grid } from "./utils/graphUtils";
import type { Cells, Point, Vertices } from "./voronoi";
import { Lakes } from "./lakes";

type FeatureType = "ocean" | "lake" | "island";

export interface PackedGraphFeature {
  i: number;
  type: FeatureType;
  land: boolean;
  border: boolean;
  cells: number;
  firstCell: number;
  vertices: number[];
  area: number;
  shoreline: number[];
  height: number;
  group: string;
  temp: number;
  flux: number;
  evaporation: number;
  name: string;

  // River related
  inlets?: number[];
  outlet?: number;
  river?: number;
  enteringFlux?: number;
  closed?: boolean;
  outCell?: number;
}

export interface GridFeature {
  i: number;
  land: boolean;
  border: boolean;
  type: FeatureType;
}

/**
 * Packed-graph shape used by markupPack/defineGroups and the slice-2 stages —
 * subset of upstream's PackedGraph type (.tmp/azgaar-src/src/types/PackedGraph.ts).
 * Built by the reGraph stage (./reGraph.ts); rivers/biomes fields are added by
 * Rivers.generate (./river-generator.ts) and Biomes.define (./biomes.ts).
 */
export interface Pack {
  cells: Cells & {
    p: Point[]; // cell points
    g?: Uint8Array | Uint16Array | Uint32Array; // grid-cell reference, set by reGraph
    h: Uint8Array | Uint16Array | Uint32Array; // heights
    area?: Uint8Array | Uint16Array | Uint32Array; // cell area, set by reGraph
    t?: Int8Array; // distance field
    f?: Uint16Array; // feature ids
    haven?: Uint8Array | Uint16Array | Uint32Array; // opposite water cell
    harbor?: Uint8Array; // number of adjacent water cells
    fl?: Uint16Array; // water flux, set by Rivers.generate
    r?: Uint16Array; // river ids, set by Rivers.generate
    conf?: Uint8Array | Uint16Array; // confluences, set by Rivers.generate
    biome?: Uint8Array; // biome ids, set by Biomes.define
    // --- slice-3 civilization fields (TYPE-ONLY extension, like the slice-2
    // g/area/fl/... additions — no slice-1/2 logic change) ---
    s?: Int16Array; // cell suitability, set by rankCells
    pop?: Float32Array; // cell rural population, set by rankCells
    culture?: Uint16Array; // culture ids, set by Cultures.generate/expand
    burg?: Uint16Array; // burg ids, set by Burgs.generate
    state?: Uint16Array; // state ids, set by States.expandStates
    religion?: Uint16Array; // religion ids, set by Religions.generate
    province?: Uint16Array; // province ids, set by Provinces.generate
    routes?: Record<number, Record<number, number>>; // cell-to-cell route links, set by Routes.generate
    q?: import("./utils/quadtree").Quadtree<number[]>; // [x, y, cellId] spatial index (upstream reGraph builds it; this port builds it in generateWorld)
  };
  vertices: Vertices;
  features: PackedGraphFeature[]; // element 0 is the literal 0 placeholder, as upstream
  rivers?: import("./river-generator").River[]; // set by Rivers.generate
  // --- slice-3 civilization collections (index 0 is a placeholder entry, as upstream) ---
  cultures?: import("./cultures-generator").Culture[];
  burgs?: import("./burgs-generator").Burg[];
  states?: import("./states-generator").State[];
  routes?: import("./routes-generator").Route[];
  religions?: import("./religions-generator").Religion[];
  provinces?: import("./provinces-generator").Province[];
  ice?: import("./ice").IceElement[];
}

export class FeatureModule {
  private DEEPER_LAND = 3;
  private LANDLOCKED = 2;
  private LAND_COAST = 1;
  private UNMARKED = 0;
  private WATER_COAST = -1;
  private DEEP_WATER = -2;

  /**
   * calculate distance to coast for every cell
   */
  private markup({
    distanceField,
    neighbors,
    start,
    increment,
    limit = TYPED_ARRAY_MAX_VALUES.INT8_MAX,
  }: {
    distanceField: Int8Array;
    neighbors: number[][];
    start: number;
    increment: number;
    limit?: number;
  }) {
    for (
      let distance = start, marked = Infinity;
      marked > 0 && distance !== limit;
      distance += increment
    ) {
      marked = 0;
      const prevDistance = distance - increment;
      for (let cellId = 0; cellId < neighbors.length; cellId++) {
        if (distanceField[cellId] !== prevDistance) continue;

        for (const neighborId of neighbors[cellId]) {
          if (distanceField[neighborId] !== this.UNMARKED) continue;
          distanceField[neighborId] = distance;
          marked++;
        }
      }
    }
  }

  /**
   * mark Grid features (ocean, lakes, islands) and calculate distance field
   */
  markupGrid(grid: Grid, seed: string) {
    Math.random = Alea(seed); // get the same result on heightmap edit in Erase mode

    const { h: heights, c: neighbors, b: borderCells, i } = grid.cells;
    const cellsNumber = i.length;
    const distanceField = new Int8Array(cellsNumber); // gird.cells.t
    const featureIds = new Uint16Array(cellsNumber); // gird.cells.f
    const features: GridFeature[] = [];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = heights![firstCell] >= 20;
      let border = false; // set true if feature touches map edge

      while (queue.length) {
        const cellId = queue.pop() as number;
        if (!border && borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = heights![neighborId] >= 20;

          if (land === isNeibLand && featureIds[neighborId] === this.UNMARKED) {
            featureIds[neighborId] = featureId;
            queue.push(neighborId);
          } else if (land && !isNeibLand) {
            distanceField[cellId] = this.LAND_COAST;
            distanceField[neighborId] = this.WATER_COAST;
          }
        }
      }

      const type = land ? "island" : border ? "ocean" : "lake";
      features.push({ i: featureId, land, border, type });

      queue[0] = featureIds.indexOf(this.UNMARKED); // find unmarked cell
    }

    // markup deep ocean cells
    this.markup({
      distanceField,
      neighbors,
      start: this.DEEP_WATER,
      increment: -1,
      limit: -10,
    });
    grid.cells.t = distanceField;
    grid.cells.f = featureIds;
    grid.features = [0 as unknown as GridFeature, ...features]; // upstream: [0, ...features]
  }

  /**
   * mark PackedGraph features (oceans, lakes, islands) and calculate distance field
   */
  markupPack(pack: Pack, graphWidth: number, graphHeight: number) {
    const defineHaven = (cellId: number) => {
      const waterCells = neighbors[cellId].filter((index: number) =>
        isWater(index, pack),
      );
      const distances = waterCells.map((neibCellId: number) =>
        distanceSquared(cells.p[cellId], cells.p[neibCellId]),
      );
      const closest = distances.indexOf(Math.min(...distances));

      haven[cellId] = waterCells[closest];
      harbor[cellId] = waterCells.length;
    };

    const getCellsData = (
      featureType: string,
      firstCell: number,
    ): [number, number[]] => {
      if (featureType === "ocean") return [firstCell, []];

      const getType = (cellId: number) => featureIds[cellId];
      const type = getType(firstCell);
      const ofSameType = (cellId: number) => getType(cellId) === type;
      const ofDifferentType = (cellId: number) => getType(cellId) !== type;

      const startCell = findOnBorderCell(firstCell);
      const featureVertices = getFeatureVertices(startCell);
      return [startCell, featureVertices];

      function findOnBorderCell(firstCell: number) {
        const isOnBorder = (cellId: number) =>
          Boolean(borderCells[cellId]) ||
          neighbors[cellId].some(ofDifferentType); // Boolean(): upstream's pack.cells.b is boolean[]; identical truthiness
        if (isOnBorder(firstCell)) return firstCell;

        const startCell = cells.i.filter(ofSameType).find(isOnBorder);
        if (startCell === undefined)
          throw new Error(
            `Markup: firstCell ${firstCell} is not on the feature or map border`,
          );

        return startCell;
      }

      function getFeatureVertices(startCell: number) {
        const startingVertex = cells.v[startCell].find((v: number) =>
          vertices.c[v].some(ofDifferentType),
        );
        if (startingVertex === undefined)
          throw new Error(
            `Markup: startingVertex for cell ${startCell} is not found`,
          );

        return connectVertices({
          vertices,
          startingVertex,
          ofSameType,
          closeRing: false,
        });
      }
    };

    const addFeature = ({
      firstCell,
      land,
      border,
      featureId,
      totalCells,
    }: {
      firstCell: number;
      land: boolean;
      border: boolean;
      featureId: number;
      totalCells: number;
    }): PackedGraphFeature => {
      const type = land ? "island" : border ? "ocean" : "lake";
      const [startCell, featureVertices] = getCellsData(type, firstCell);
      const points = clipPoly(
        featureVertices.map((vertex: number) => vertices.p[vertex]),
        graphWidth,
        graphHeight,
      );
      const area = polygonArea(points); // feature perimiter area
      const absArea = Math.abs(rn(area));

      const feature: Partial<PackedGraphFeature> = {
        i: featureId,
        type,
        land,
        border,
        cells: totalCells,
        firstCell: startCell,
        vertices: featureVertices,
        area: absArea,
        shoreline: [],
        height: 0,
      };

      if (type === "lake") {
        if (area > 0)
          feature.vertices = (feature.vertices as number[]).reverse();
        feature.shoreline = unique(
          (feature.vertices as number[]).flatMap((vertexIndex) =>
            vertices.c[vertexIndex].filter((index) => isLand(index, pack)),
          ),
        );
        feature.height = Lakes.getHeight(feature as PackedGraphFeature, pack);
      }

      return {
        ...feature,
      } as PackedGraphFeature;
    };

    const { cells, vertices } = pack;
    const { c: neighbors, b: borderCells, i } = cells;
    const packCellsNumber = i.length;
    if (!packCellsNumber) return; // no cells -> there is nothing to do

    const distanceField = new Int8Array(packCellsNumber); // pack.cells.t
    const featureIds = new Uint16Array(packCellsNumber); // pack.cells.f
    const haven = createTypedArray({
      maxValue: packCellsNumber,
      length: packCellsNumber,
    }); // haven: opposite water cell
    const harbor = new Uint8Array(packCellsNumber); // harbor: number of adjacent water cells
    const features: PackedGraphFeature[] = [];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = isLand(firstCell, pack);
      let border = Boolean(borderCells[firstCell]); // true if feature touches map border
      let totalCells = 1; // count cells in a feature

      while (queue.length) {
        const cellId = queue.pop() as number;
        if (borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = isLand(neighborId, pack);

          if (land && !isNeibLand) {
            distanceField[cellId] = this.LAND_COAST;
            distanceField[neighborId] = this.WATER_COAST;
            if (!haven[cellId]) defineHaven(cellId);
          } else if (land && isNeibLand) {
            if (
              distanceField[neighborId] === this.UNMARKED &&
              distanceField[cellId] === this.LAND_COAST
            )
              distanceField[neighborId] = this.LANDLOCKED;
            else if (
              distanceField[cellId] === this.UNMARKED &&
              distanceField[neighborId] === this.LAND_COAST
            )
              distanceField[cellId] = this.LANDLOCKED;
          }

          if (!featureIds[neighborId] && land === isNeibLand) {
            queue.push(neighborId);
            featureIds[neighborId] = featureId;
            totalCells++;
          }
        }
      }

      features.push(
        addFeature({ firstCell, land, border, featureId, totalCells }),
      );
      queue[0] = featureIds.indexOf(this.UNMARKED); // find unmarked cell
    }

    this.markup({
      distanceField,
      neighbors,
      start: this.DEEPER_LAND,
      increment: 1,
    }); // markup pack land
    this.markup({
      distanceField,
      neighbors,
      start: this.DEEP_WATER,
      increment: -1,
      limit: -10,
    }); // markup pack water

    pack.cells.t = distanceField;
    pack.cells.f = featureIds;
    pack.cells.haven = haven;
    pack.cells.harbor = harbor;
    pack.features = [0 as unknown as PackedGraphFeature, ...features];
  }

  /**
   * define feature groups (ocean, sea, gulf, continent, island, isle, freshwater lake, salt lake, etc.)
   */
  defineGroups(grid: Grid, pack: Pack) {
    const gridCellsNumber = grid.cells.i.length;
    const OCEAN_MIN_SIZE = gridCellsNumber / 25;
    const SEA_MIN_SIZE = gridCellsNumber / 1000;
    const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
    const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

    const defineIslandGroup = (feature: PackedGraphFeature) => {
      const prevFeature = pack.features[pack.cells.f![feature.firstCell - 1]];
      if (prevFeature && prevFeature.type === "lake") return "lake_island";
      if (feature.cells > CONTINENT_MIN_SIZE) return "continent";
      if (feature.cells > ISLAND_MIN_SIZE) return "island";
      return "isle";
    };

    const defineOceanGroup = (feature: PackedGraphFeature) => {
      if (feature.cells > OCEAN_MIN_SIZE) return "ocean";
      if (feature.cells > SEA_MIN_SIZE) return "sea";
      return "gulf";
    };

    const defineLakeGroup = (feature: PackedGraphFeature) => {
      if (feature.temp < -3) return "frozen";
      if (
        feature.height > 60 &&
        feature.cells < 10 &&
        feature.firstCell % 10 === 0
      )
        return "lava";

      if (!feature.inlets && !feature.outlet) {
        if (feature.evaporation > feature.flux * 4) return "dry";
        if (feature.cells < 3 && feature.firstCell % 10 === 0)
          return "sinkhole";
      }

      if (!feature.outlet && feature.evaporation > feature.flux) return "salt";

      return "freshwater";
    };

    const defineGroup = (feature: PackedGraphFeature) => {
      if (feature.type === "island") return defineIslandGroup(feature);
      if (feature.type === "ocean") return defineOceanGroup(feature);
      if (feature.type === "lake") return defineLakeGroup(feature);
      throw new Error(`Markup: unknown feature type ${feature.type}`);
    };

    for (const feature of pack.features) {
      if (!feature || feature.type === "ocean") continue;

      if (feature.type === "lake")
        feature.height = Lakes.getHeight(feature, pack);
      feature.group = defineGroup(feature);
    }
  }
}

/** Module-level singleton, mirroring upstream `window.Features`. */
export const Features = new FeatureModule();
