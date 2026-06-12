/**
 * @file burgs-generator.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/modules/burgs-generator.ts. See
 * ./ATTRIBUTION.md.
 *
 * Ported: generate() (capitals + towns placement via d3-quadtree spacing,
 * with the spacing-reduction retry loop), shift() (port placement + river
 * shift), getType, specify() (definePopulation → defineEmblem →
 * defineFeatures per burg, then defineGroup), getDefaultGroups. RNG draw
 * order preserved: score randomization (Math.random per cell for capitals,
 * gauss per cell for towns), per-town gauss spacing, and in specify the
 * gauss/P/COA.generate interleaving per burg.
 *
 * UPSTREAM QUIRK PRESERVED: defineFeatures checks
 * `pack.states[burg.state].form === "Theocracy"`, but in the upstream
 * generate() pipeline Burgs.specify runs BEFORE States.defineStateForms, so
 * `form` is still undefined and the theocracy temple bonus can never fire on
 * initial generation.
 *
 * Adaptations (cosmetic only): DOM inputs became context values
 * (statesNumber, manorsInput → manorsNumber with 1000 = auto); globals
 * pack/grid/graphWidth/graphHeight and Names/Routes/COA injected;
 * options.burgs.groups comes from the context (built from getDefaultGroups,
 * as upstream does when localStorage has no override).
 *
 * Stripped: createWatabouCityLinks/createWatabouVillageLinks/
 * createWatabouDwellingLinks/getPreview (external watabou URL builders, UI
 * preview pane; the only generate-path RNG-free consumers are UI), add()
 * (editor click handler, draws+renders), changeGroup/remove (editor).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { quadtree } from "./utils/quadtree";
import { gauss, P } from "./utils/probabilityUtils";
import { rn } from "./utils/numberUtils";
import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { NamesGenerator } from "./names-generator";
import type { CoaGenerator } from "./coa-generator";
import type { RoutesModule } from "./routes-generator";

const WARN = false;
const ERROR = false;

export interface Burg {
  cell: number;
  x: number;
  y: number;
  i?: number;
  state?: number;
  culture?: number;
  name?: string;
  feature?: number;
  capital?: number;
  lock?: boolean;
  port?: number;
  removed?: boolean;
  population?: number;
  type?: string;
  coa?: any;
  citadel?: number;
  plaza?: number;
  walls?: number;
  shanty?: number;
  temple?: number;
  group?: string;
  link?: string;
  MFCG?: string;
}

export interface BurgGroup {
  name: string;
  active: boolean;
  order: number;
  features?: Record<string, boolean>;
  percentile?: number;
  min?: number;
  max?: number;
  biomes?: number[];
  preview?: string;
  isDefault?: boolean;
}

export interface BurgsContext {
  pack: Pack;
  grid: Grid;
  graphWidth: number;
  graphHeight: number;
  statesNumber: number; // upstream statesNumber input
  manorsNumber: number; // upstream manorsInput (1000 = auto)
  burgGroups: BurgGroup[]; // upstream options.burgs.groups
  Names: NamesGenerator;
  COA: CoaGenerator;
  Routes: RoutesModule;
}

export class BurgsModule {
  constructor(private ctx: BurgsContext) {}

  shift() {
    const { pack, grid } = this.ctx;
    const { cells, features, burgs } = pack as any;
    const temp = grid.cells.temp!;

    // port is a capital with any harbor OR any burg with a safe harbor
    // safe harbor is a cell having just one adjacent water cell
    const featurePortCandidates: Record<number, Burg[]> = {};
    for (const burg of burgs as Burg[]) {
      if (!burg.i || burg.lock) continue;
      delete burg.port; // reset port status
      const cellId = burg.cell;

      const haven = cells.haven[cellId];
      const harbor = cells.harbor[cellId];
      const featureId = cells.f[haven];
      if (!featureId) continue; // no adjacent water body

      const isMulticell = features[featureId].cells > 1;
      const isHarbor = (harbor && burg.capital) || harbor === 1;
      const isFrozen = temp[cells.g[cellId]] <= 0;

      if (isMulticell && isHarbor && !isFrozen) {
        if (!featurePortCandidates[featureId])
          featurePortCandidates[featureId] = [];
        featurePortCandidates[featureId].push(burg);
      }
    }

    const getCloseToEdgePoint = (cell1: number, cell2: number) => {
      const { cells, vertices } = pack as any;

      const [x0, y0] = cells.p[cell1];
      const commonVertices = cells.v[cell1].filter((vertex: number) =>
        vertices.c[vertex].some((cell: number) => cell === cell2),
      );
      const [x1, y1] = vertices.p[commonVertices[0]];
      const [x2, y2] = vertices.p[commonVertices[1]];
      const xEdge = (x1 + x2) / 2;
      const yEdge = (y1 + y2) / 2;

      const x = rn(x0 + 0.95 * (xEdge - x0), 2);
      const y = rn(y0 + 0.95 * (yEdge - y0), 2);

      return [x, y];
    };

    // shift ports to the edge of the water body
    Object.entries(featurePortCandidates).forEach(([featureId, burgs]) => {
      if (burgs.length < 2) return; // only one port on water body - skip
      burgs.forEach((burg) => {
        burg.port = Number(featureId);
        const haven = cells.haven[burg.cell];
        const [x, y] = getCloseToEdgePoint(burg.cell, haven);
        burg.x = x;
        burg.y = y;
      });
    });

    // shift non-port river burgs a bit
    for (const burg of burgs as Burg[]) {
      if (!burg.i || burg.lock || burg.port || !cells.r[burg.cell]) continue;
      const cellId = burg.cell;
      const shift = Math.min(cells.fl[cellId] / 150, 1);
      burg.x = cellId % 2 ? rn(burg.x + shift, 2) : rn(burg.x - shift, 2);
      burg.y =
        cells.r[cellId] % 2 ? rn(burg.y + shift, 2) : rn(burg.y - shift, 2);
    }
  }

  generate() {
    const { pack, grid, graphWidth, graphHeight, Names } = this.ctx;
    const statesNumberInput = this.ctx.statesNumber;
    const manorsNumber = this.ctx.manorsNumber;
    const { cells } = pack as any;

    let burgs: Burg[] = [0 as any]; // burgs array
    cells.burg = new Uint16Array(cells.i.length);

    const populatedCells = cells.i.filter(
      (i: number) => cells.s[i] > 0 && cells.culture[i],
    );
    if (!populatedCells.length) {
      ERROR &&
        console.error(
          "There is no populated cells with culture assigned. Cannot generate states",
        );
      // upstream returns without assigning pack.burgs — preserved
      return burgs;
    }

    let burgsQuadtree = quadtree();

    const generateCapitals = () => {
      const randomize = (score: number) => score * (0.5 + Math.random() * 0.5);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort(
        (a: number, b: number) => score[b] - score[a],
      );

      const capitalsNumber = getCapitalsNumber();
      let spacing = (graphWidth + graphHeight) / 2 / capitalsNumber; // min distance between capitals

      for (let i = 0; burgs.length <= capitalsNumber; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (burgsQuadtree.find(x, y, spacing) === undefined) {
          burgs.push({ cell, x, y });
          burgsQuadtree.add([x, y]);
        }

        // reset if all cells were checked
        if (i === sorted.length - 1) {
          WARN &&
            console.warn(
              "Cannot place capitals with current spacing. Trying again with reduced spacing",
            );
          burgsQuadtree = quadtree();
          i = -1;
          burgs = [0 as any];
          spacing /= 1.2;
        }
      }

      burgs.forEach((burg, burgId) => {
        if (!burgId) return;
        burg.i = burgId;
        burg.state = burgId;
        burg.culture = cells.culture[burg.cell];
        burg.name = Names.getCultureShort(burg.culture!);
        burg.feature = cells.f[burg.cell];
        burg.capital = 1;
        cells.burg[burg.cell] = burgId;
      });
    };

    const generateTowns = () => {
      const randomize = (score: number) => score * gauss(1, 3, 0, 20, 3);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort(
        (a: number, b: number) => score[b] - score[a],
      );

      const burgsNumber = getTownsNumber();
      let spacing =
        (graphWidth + graphHeight) / 150 / (burgsNumber ** 0.7 / 66); // min distance between town

      for (let added = 0; added < burgsNumber && spacing > 1; ) {
        for (let i = 0; added < burgsNumber && i < sorted.length; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];

          const minSpacing = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make placement not uniform
          if (burgsQuadtree.find(x, y, minSpacing) !== undefined) continue; // to close to existing burg

          const burgId = burgs.length;
          const culture = cells.culture[cell];
          const name = Names.getCulture(culture);
          const feature = cells.f[cell];
          burgs.push({
            cell,
            x,
            y,
            i: burgId,
            state: 0,
            culture,
            name,
            feature,
            capital: 0,
          });
          added++;
          cells.burg[cell] = burgId;
        }

        spacing *= 0.5;
      }
    };

    generateCapitals();
    generateTowns();

    pack.burgs = burgs;
    this.shift();

    return burgs;

    function getCapitalsNumber() {
      let number = statesNumberInput;

      if (populatedCells.length < number * 10) {
        number = Math.floor(populatedCells.length / 10);
        WARN &&
          console.warn(
            `Not enough populated cells. Generating only ${number} capitals/states`,
          );
      }

      return number;
    }

    function getTownsNumber() {
      const isAuto = manorsNumber === 1000; // '1000' is considered as auto
      if (isAuto)
        return rn(
          populatedCells.length / 5 / (grid.points.length / 10000) ** 0.8,
        );

      return Math.min(manorsNumber, populatedCells.length);
    }
  }

  getType(cellId: number, port?: number) {
    const { cells, features } = this.ctx.pack as any;

    if (port) return "Naval";

    const haven = cells.haven[cellId];
    if (haven !== undefined && features[cells.f[haven]].type === "lake")
      return "Lake";

    if (cells.h[cellId] > 60) return "Highland";

    if (cells.r[cellId] && cells.fl[cellId] >= 100) return "River";

    const biome = cells.biome[cellId];
    const population = cells.pop[cellId];
    if (!cells.burg[cellId] || population <= 5) {
      if (population < 5 && [1, 2, 3, 4].includes(biome)) return "Nomadic";
      if (biome > 4 && biome < 10) return "Hunting";
    }

    return "Generic";
  }

  private definePopulation(burg: Burg) {
    const { pack, Routes } = this.ctx;
    const cellId = burg.cell;
    let population = (pack.cells as any).s[cellId] / 5;
    if (burg.capital) population *= 1.5;
    const connectivityRate = Routes.getConnectivityRate(cellId);
    if (connectivityRate) population *= connectivityRate;
    population *= gauss(1, 1, 0.25, 4, 5); // randomize
    population += (((burg.i as number) % 100) - (cellId % 100)) / 1000; // unround
    burg.population = rn(Math.max(population, 0.01), 3);
  }

  private defineEmblem(burg: Burg) {
    const { pack, COA } = this.ctx;
    burg.type = this.getType(burg.cell, burg.port);

    const state = pack.states![burg.state as number];
    const stateCOA = state.coa;

    let kinship = 0.25;
    if (burg.capital) kinship += 0.1;
    else if (burg.port) kinship -= 0.1;
    if (burg.culture !== state.culture) kinship -= 0.25;

    const type =
      burg.capital && P(0.2)
        ? "Capital"
        : burg.type === "Generic"
          ? "City"
          : burg.type;
    burg.coa = COA.generate(stateCOA, kinship, null, type);
    burg.coa.shield = COA.getShield(burg.culture, burg.state);
  }

  private defineFeatures(burg: Burg) {
    const { pack, Routes } = this.ctx;
    const pop = burg.population as number;
    burg.citadel = Number(
      burg.capital || (pop > 50 && P(0.75)) || (pop > 15 && P(0.5)) || P(0.1),
    );
    burg.plaza = Number(
      Routes.isCrossroad(burg.cell) ||
        (Routes.hasRoad(burg.cell) && P(0.7)) ||
        pop > 20 ||
        (pop > 10 && P(0.8)),
    );
    burg.walls = Number(
      burg.capital ||
        pop > 30 ||
        (pop > 20 && P(0.75)) ||
        (pop > 10 && P(0.5)) ||
        P(0.1),
    );
    burg.shanty = Number(
      pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && burg.walls && P(0.4)),
    );
    const religion = (pack.cells as any).religion[burg.cell] as number;
    const theocracy = pack.states![burg.state as number].form === "Theocracy";
    burg.temple = Number(
      (religion && theocracy && P(0.5)) ||
        pop > 50 ||
        (pop > 35 && P(0.75)) ||
        (pop > 20 && P(0.5)),
    );
  }

  getDefaultGroups(): BurgGroup[] {
    return [
      {
        name: "capital",
        active: true,
        order: 9,
        features: { capital: true },
        preview: "watabou-city",
      },
      {
        name: "city",
        active: true,
        order: 8,
        percentile: 90,
        min: 5,
        preview: "watabou-city",
      },
      {
        name: "fort",
        active: true,
        features: { citadel: true, walls: false, plaza: false, port: false },
        order: 6,
        max: 1,
      },
      {
        name: "monastery",
        active: true,
        features: { temple: true, walls: false, plaza: false, port: false },
        order: 5,
        max: 0.8,
      },
      {
        name: "caravanserai",
        active: true,
        features: { port: false, plaza: true },
        order: 4,
        max: 0.8,
        biomes: [1, 2, 3],
      },
      {
        name: "trading_post",
        active: true,
        order: 3,
        features: { plaza: true },
        max: 0.8,
        biomes: [5, 6, 7, 8, 9, 10, 11, 12],
      },
      {
        name: "village",
        active: true,
        order: 2,
        min: 0.1,
        max: 2,
        preview: "watabou-village",
      },
      {
        name: "hamlet",
        active: true,
        order: 1,
        features: { plaza: false },
        max: 0.1,
        preview: "watabou-village",
      },
      {
        name: "town",
        active: true,
        order: 7,
        isDefault: true,
        preview: "watabou-city",
      },
    ];
  }

  defineGroup(burg: Burg, populations: number[]) {
    const groups = this.ctx.burgGroups;
    if (burg.lock && burg.group) {
      // locked burgs: don't change group if it still exists
      const group = groups.find((g) => g.name === burg.group);
      if (group) return;
    }

    const defaultGroup = groups.find((g) => g.isDefault);
    if (!defaultGroup) {
      ERROR && console.error("No default group defined");
      return;
    }
    burg.group = defaultGroup.name;

    for (const group of groups) {
      if (!group.active) continue;

      if (group.min) {
        const isFit = (burg.population as number) >= group.min;
        if (!isFit) continue;
      }

      if (group.max) {
        const isFit = (burg.population as number) <= group.max;
        if (!isFit) continue;
      }

      if (group.features) {
        const isFit = Object.entries(
          group.features as Record<string, boolean>,
        ).every(
          ([feature, value]) => Boolean(burg[feature as keyof Burg]) === value,
        );
        if (!isFit) continue;
      }

      if (group.biomes) {
        const isFit = group.biomes.includes(
          (this.ctx.pack.cells as any).biome[burg.cell],
        );
        if (!isFit) continue;
      }

      if (group.percentile) {
        const index = populations.indexOf(burg.population as number);
        const isFit =
          index >= Math.floor((populations.length * group.percentile) / 100);
        if (!isFit) continue;
      }

      burg.group = group.name; // apply fitting group
      return;
    }
  }

  specify() {
    const pack = this.ctx.pack;

    pack.burgs!.forEach((burg) => {
      if (!burg.i || burg.removed || burg.lock) return;
      this.definePopulation(burg);
      this.defineEmblem(burg);
      this.defineFeatures(burg);
    });

    const populations = pack
      .burgs!.filter((b) => b.i && !b.removed)
      .map((b) => b.population as number)
      .sort((a: number, b: number) => a - b); // ascending

    pack.burgs!.forEach((burg) => {
      if (!burg.i || burg.removed) return;
      this.defineGroup(burg, populations);
    });
  }
}
