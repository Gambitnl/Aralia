/**
 * @file cultures-generator.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/modules/cultures-generator.ts. See
 * ./ATTRIBUTION.md.
 *
 * Ported: getDefault (all seven culture-set data tables verbatim),
 * getRandomShield, generate() (culture selection, center placement via
 * d3-quadtree, type/expansionism definition) and expand() (FlatQueue cost
 * spread). RNG draw order is preserved exactly: selectCultures' rand/P
 * retry loop, getColors' shuffle, placeCenter's biased() attempts,
 * defineCultureType's conditional P draws and defineCultureExpansionism's
 * Math.random — all on the stream Ice.generate seeded.
 *
 * Adaptations (cosmetic only):
 * - DOM inputs became explicit context values: culturesInput →
 *   `culturesNumber`, culturesSet select → `culturesSet` (+ the data-max
 *   table from index.html), sizeVariety, emblemShape; `neutralRate` has no
 *   DOM element upstream (the `?.valueAsNumber || 1` fallback always yields
 *   1) and is a constant 1 here.
 * - globals pack/grid/graphWidth/graphHeight/nameBases and the Names/COA
 *   modules are injected via the context object.
 * - the "Extreme climate warning" jQuery dialogs were stripped; the
 *   count-reduction logic they accompany is kept verbatim.
 *
 * Stripped (editor-only): add() (culture editor's "add culture" button).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { max, range } from "./d3Shim";
import { quadtree } from "./utils/quadtree";
import { FlatQueue } from "./utils/flatqueue";
import { abbreviate } from "./utils/languageUtils";
import { getColors } from "./utils/colorUtils";
import { minmax, rn } from "./utils/numberUtils";
import { biased, P, rand, rw } from "./utils/probabilityUtils";
import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { BiomesData } from "./biomes";
import type { NamesGenerator } from "./names-generator";
import { getNameBases } from "./name-bases";
import type { CoaGenerator } from "./coa-generator";

const WARN = false;
const ERROR = false;

export interface Culture {
  name: string;
  i: number;
  base: number;
  shield: string;
  lock?: boolean;
  code?: string;
  center?: number;
  sort?: (i: number) => number;
  odd?: number;
  color?: string;
  type?: string;
  expansionism?: number;
  origins?: (number | null)[];
  removed?: boolean;
  cells?: number;
  area?: number;
  rural?: number;
  urban?: number;
}

export type CulturesSet =
  | "world"
  | "european"
  | "oriental"
  | "english"
  | "antique"
  | "highFantasy"
  | "darkFantasy"
  | "random";

/** `data-max` per culturesSet option (upstream src/index.html select). */
export const CULTURES_SET_MAX: Record<CulturesSet, number> = {
  world: 32,
  european: 15,
  oriental: 13,
  english: 10,
  antique: 10,
  highFantasy: 17,
  darkFantasy: 18,
  random: 100,
};

export interface CulturesContext {
  pack: Pack;
  grid: Grid;
  graphWidth: number;
  graphHeight: number;
  biomesData: BiomesData;
  culturesNumber: number; // upstream culturesInput
  culturesSet: CulturesSet; // upstream culturesSet select
  sizeVariety: number; // upstream sizeVariety input
  emblemShape: string; // upstream emblemShape select
  Names: NamesGenerator;
  COA: CoaGenerator;
}

export class CulturesModule {
  cells: any;

  constructor(private ctx: CulturesContext) {}

  getRandomShield() {
    const COA = this.ctx.COA;
    const type = rw(COA.shields.types);
    return rw((COA.shields as any)[type]);
  }

  getDefault(count: number = 0): Omit<Culture, "i">[] {
    const { pack, grid, culturesSet, Names } = this.ctx;
    const nameBases = Names.nameBases;
    // generic sorting functions
    const cells = pack.cells,
      s = cells.s!,
      sMax = max(s as unknown as Iterable<number>) as number,
      t = cells.t!,
      h = cells.h,
      temp = grid.cells.temp!;
    const n = (cell: number) => Math.ceil((s[cell] / sMax) * 3); // normalized cell score
    const td = (cell: number, goal: number) => {
      const d = Math.abs(temp[cells.g![cell]] - goal);
      return d ? d + 1 : 1;
    }; // temperature difference fee
    const bd = (cell: number, biomes: number[], fee = 4) =>
      biomes.includes(cells.biome![cell]) ? 1 : fee; // biome difference fee
    const sf = (cell: number, fee = 4) =>
      cells.haven![cell] &&
      (pack.features[cells.f![cells.haven![cell]]] as any).type !== "lake"
        ? 1
        : fee; // not on sea coast fee

    if (culturesSet === "european") {
      return [
        { name: "Shwazen", base: 0, odd: 1, sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "swiss" },
        { name: "Angshire", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 10) / sf(i), shield: "wedged" },
        { name: "Luari", base: 2, odd: 1, sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "french" },
        { name: "Tallian", base: 3, odd: 1, sort: (i: number) => n(i) / td(i, 15), shield: "horsehead" },
        { name: "Astellian", base: 4, odd: 1, sort: (i: number) => n(i) / td(i, 16), shield: "spanish" },
        { name: "Slovan", base: 5, odd: 1, sort: (i: number) => (n(i) / td(i, 6)) * t[i], shield: "polish" },
        { name: "Norse", base: 6, odd: 1, sort: (i: number) => n(i) / td(i, 5), shield: "heater" },
        { name: "Elladan", base: 7, odd: 1, sort: (i: number) => (n(i) / td(i, 18)) * h[i], shield: "boeotian" },
        { name: "Romian", base: 8, odd: 0.2, sort: (i: number) => n(i) / td(i, 15) / t[i], shield: "roman" },
        { name: "Soumi", base: 9, odd: 1, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise" },
        { name: "Portuzian", base: 13, odd: 1, sort: (i: number) => n(i) / td(i, 17) / sf(i), shield: "renaissance" },
        { name: "Vengrian", base: 15, odd: 1, sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "horsehead2" },
        { name: "Turchian", base: 16, odd: 0.05, sort: (i: number) => n(i) / td(i, 14), shield: "round" },
        { name: "Euskati", base: 20, odd: 0.05, sort: (i: number) => (n(i) / td(i, 15)) * h[i], shield: "oldFrench" },
        { name: "Keltan", base: 22, odd: 0.05, sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "oval" },
      ];
    }

    if (culturesSet === "oriental") {
      return [
        { name: "Koryo", base: 10, odd: 1, sort: (i: number) => n(i) / td(i, 12) / t[i], shield: "round" },
        { name: "Hantzu", base: 11, odd: 1, sort: (i: number) => n(i) / td(i, 13), shield: "banner" },
        { name: "Yamoto", base: 12, odd: 1, sort: (i: number) => n(i) / td(i, 15) / t[i], shield: "round" },
        { name: "Turchian", base: 16, odd: 1, sort: (i: number) => n(i) / td(i, 12), shield: "round" },
        { name: "Berberan", base: 17, odd: 0.2, sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "oval" },
        { name: "Eurabic", base: 18, odd: 1, sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "oval" },
        { name: "Efratic", base: 23, odd: 0.1, sort: (i: number) => (n(i) / td(i, 22)) * t[i], shield: "round" },
        { name: "Tehrani", base: 24, odd: 1, sort: (i: number) => (n(i) / td(i, 18)) * h[i], shield: "round" },
        { name: "Maui", base: 25, odd: 0.2, sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i], shield: "vesicaPiscis" },
        { name: "Carnatic", base: 26, odd: 0.5, sort: (i: number) => n(i) / td(i, 26), shield: "round" },
        { name: "Vietic", base: 29, odd: 0.8, sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner" },
        { name: "Guantzu", base: 30, odd: 0.5, sort: (i: number) => n(i) / td(i, 17), shield: "banner" },
        { name: "Ulus", base: 31, odd: 1, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner" },
      ];
    }

    if (culturesSet === "english") {
      const getName = () => Names.getBase(1, 5, 9, "");
      return [
        { name: getName(), base: 1, odd: 1, shield: "heater" },
        { name: getName(), base: 1, odd: 1, shield: "wedged" },
        { name: getName(), base: 1, odd: 1, shield: "swiss" },
        { name: getName(), base: 1, odd: 1, shield: "oldFrench" },
        { name: getName(), base: 1, odd: 1, shield: "swiss" },
        { name: getName(), base: 1, odd: 1, shield: "spanish" },
        { name: getName(), base: 1, odd: 1, shield: "hessen" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy5" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy4" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy1" },
      ];
    }

    if (culturesSet === "antique") {
      return [
        { name: "Roman", base: 8, odd: 1, sort: (i: number) => n(i) / td(i, 14) / t[i], shield: "roman" }, // Roman
        { name: "Roman", base: 8, odd: 1, sort: (i: number) => n(i) / td(i, 15) / sf(i), shield: "roman" }, // Roman
        { name: "Roman", base: 8, odd: 1, sort: (i: number) => n(i) / td(i, 16) / sf(i), shield: "roman" }, // Roman
        { name: "Roman", base: 8, odd: 1, sort: (i: number) => n(i) / td(i, 17) / t[i], shield: "roman" }, // Roman
        { name: "Hellenic", base: 7, odd: 1, sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian" }, // Greek
        { name: "Hellenic", base: 7, odd: 1, sort: (i: number) => (n(i) / td(i, 19) / sf(i)) * h[i], shield: "boeotian" }, // Greek
        { name: "Macedonian", base: 7, odd: 0.5, sort: (i: number) => (n(i) / td(i, 12)) * h[i], shield: "round" }, // Greek
        { name: "Celtic", base: 22, odd: 1, sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "round" },
        { name: "Germanic", base: 0, odd: 1, sort: (i: number) => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]), shield: "round" },
        { name: "Persian", base: 24, odd: 0.8, sort: (i: number) => (n(i) / td(i, 18)) * h[i], shield: "oval" }, // Iranian
        { name: "Scythian", base: 24, odd: 0.5, sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [4]), shield: "round" }, // Iranian
        { name: "Cantabrian", base: 20, odd: 0.5, sort: (i: number) => (n(i) / td(i, 16)) * h[i], shield: "oval" }, // Basque
        { name: "Estian", base: 9, odd: 0.2, sort: (i: number) => (n(i) / td(i, 5)) * t[i], shield: "pavise" }, // Finnic
        { name: "Carthaginian", base: 42, odd: 0.3, sort: (i: number) => n(i) / td(i, 20) / sf(i), shield: "oval" }, // Levantine
        { name: "Hebrew", base: 42, odd: 0.2, sort: (i: number) => (n(i) / td(i, 19)) * sf(i), shield: "oval" }, // Levantine
        { name: "Mesopotamian", base: 23, odd: 0.2, sort: (i: number) => n(i) / td(i, 22) / bd(i, [1, 2, 3]), shield: "oval" }, // Mesopotamian
      ];
    }

    if (culturesSet === "highFantasy") {
      return [
        // fantasy races
        { name: "Quenian (Elfish)", base: 33, odd: 1, sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "gondor" }, // Elves
        { name: "Eldar (Elfish)", base: 33, odd: 1, sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "noldor" }, // Elves
        { name: "Trow (Dark Elfish)", base: 34, odd: 0.9, sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen" }, // Dark Elves
        { name: "Lothian (Dark Elfish)", base: 34, odd: 0.3, sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "wedged" }, // Dark Elves
        { name: "Dunirr (Dwarven)", base: 35, odd: 1, sort: (i: number) => n(i) + h[i], shield: "ironHills" }, // Dwarfs
        { name: "Khazadur (Dwarven)", base: 35, odd: 1, sort: (i: number) => n(i) + h[i], shield: "erebor" }, // Dwarfs
        { name: "Kobold (Goblin)", base: 36, odd: 1, sort: (i: number) => t[i] - s[i], shield: "moriaOrc" }, // Goblin
        { name: "Uruk (Orkish)", base: 37, odd: 1, sort: (i: number) => h[i] * t[i], shield: "urukHai" }, // Orc
        { name: "Ugluk (Orkish)", base: 37, odd: 0.5, sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "moriaOrc" }, // Orc
        { name: "Yotunn (Giants)", base: 38, odd: 0.7, sort: (i: number) => td(i, -10), shield: "pavise" }, // Giant
        { name: "Rake (Drakonic)", base: 39, odd: 0.7, sort: (i: number) => -s[i], shield: "fantasy2" }, // Draconic
        { name: "Arago (Arachnid)", base: 40, odd: 0.7, sort: (i: number) => t[i] - s[i], shield: "horsehead2" }, // Arachnid
        { name: "Aj'Snaga (Serpents)", base: 41, odd: 0.7, sort: (i: number) => n(i) / bd(i, [12], 10), shield: "fantasy1" }, // Serpents
        // fantasy human
        { name: "Anor (Human)", base: 32, odd: 1, sort: (i: number) => n(i) / td(i, 10), shield: "fantasy5" },
        { name: "Dail (Human)", base: 32, odd: 1, sort: (i: number) => n(i) / td(i, 13), shield: "roman" },
        { name: "Rohand (Human)", base: 16, odd: 1, sort: (i: number) => n(i) / td(i, 16), shield: "round" },
        { name: "Dulandir (Human)", base: 31, odd: 1, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "easterling" },
      ];
    }

    if (culturesSet === "darkFantasy") {
      return [
        // common real-world English
        { name: "Angshire", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 10) / sf(i), shield: "heater" },
        { name: "Enlandic", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 12), shield: "heater" },
        { name: "Westen", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 10), shield: "heater" },
        { name: "Nortumbic", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 7), shield: "heater" },
        { name: "Mercian", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 9), shield: "heater" },
        { name: "Kentian", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 12), shield: "heater" },
        // rare real-world western
        { name: "Norse", base: 6, odd: 0.7, sort: (i: number) => n(i) / td(i, 5) / sf(i), shield: "oldFrench" },
        { name: "Schwarzen", base: 0, odd: 0.3, sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "gonfalon" },
        { name: "Luarian", base: 2, odd: 0.3, sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench" },
        { name: "Hetallian", base: 3, odd: 0.3, sort: (i: number) => n(i) / td(i, 15), shield: "oval" },
        { name: "Astellian", base: 4, odd: 0.3, sort: (i: number) => n(i) / td(i, 16), shield: "spanish" },
        // rare real-world exotic
        { name: "Kiswaili", base: 28, odd: 0.05, sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis" },
        { name: "Yoruba", base: 21, odd: 0.05, sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis" },
        { name: "Koryo", base: 10, odd: 0.05, sort: (i: number) => n(i) / td(i, 12) / t[i], shield: "round" },
        { name: "Hantzu", base: 11, odd: 0.05, sort: (i: number) => n(i) / td(i, 13), shield: "banner" },
        { name: "Yamoto", base: 12, odd: 0.05, sort: (i: number) => n(i) / td(i, 15) / t[i], shield: "round" },
        { name: "Guantzu", base: 30, odd: 0.05, sort: (i: number) => n(i) / td(i, 17), shield: "banner" },
        { name: "Ulus", base: 31, odd: 0.05, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner" },
        { name: "Turan", base: 16, odd: 0.05, sort: (i: number) => n(i) / td(i, 12), shield: "round" },
        { name: "Berberan", base: 17, odd: 0.05, sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "round" },
        { name: "Eurabic", base: 18, odd: 0.05, sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round" },
        { name: "Slovan", base: 5, odd: 0.05, sort: (i: number) => (n(i) / td(i, 6)) * t[i], shield: "round" },
        { name: "Keltan", base: 22, odd: 0.1, sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "vesicaPiscis" },
        { name: "Elladan", base: 7, odd: 0.2, sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian" },
        { name: "Romian", base: 8, odd: 0.2, sort: (i: number) => n(i) / td(i, 14) / t[i], shield: "roman" },
        // fantasy races
        { name: "Eldar", base: 33, odd: 0.5, sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "fantasy5" }, // Elves
        { name: "Trow", base: 34, odd: 0.8, sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen" }, // Dark Elves
        { name: "Durinn", base: 35, odd: 0.8, sort: (i: number) => n(i) + h[i], shield: "erebor" }, // Dwarven
        { name: "Kobblin", base: 36, odd: 0.8, sort: (i: number) => t[i] - s[i], shield: "moriaOrc" }, // Goblin
        { name: "Uruk", base: 37, odd: 0.8, sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "urukHai" }, // Orc
        { name: "Yotunn", base: 38, odd: 0.8, sort: (i: number) => td(i, -10), shield: "pavise" }, // Giant
        { name: "Drake", base: 39, odd: 0.9, sort: (i: number) => -s[i], shield: "fantasy2" }, // Draconic
        { name: "Rakhnid", base: 40, odd: 0.9, sort: (i: number) => t[i] - s[i], shield: "horsehead2" }, // Arachnid
        { name: "Aj'Snaga", base: 41, odd: 0.9, sort: (i: number) => n(i) / bd(i, [12], 10), shield: "fantasy1" }, // Serpents
      ];
    }

    if (culturesSet === "random") {
      return range(count).map(() => {
        const rnd = rand(nameBases.length - 1);
        const name = Names.getBaseShort(rnd);
        return { name, base: rnd, odd: 1, shield: this.getRandomShield() };
      });
    }

    // all-world
    return [
      { name: "Shwazen", base: 0, odd: 0.7, sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "hessen" },
      { name: "Angshire", base: 1, odd: 1, sort: (i: number) => n(i) / td(i, 10) / sf(i), shield: "heater" },
      { name: "Luari", base: 2, odd: 0.6, sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench" },
      { name: "Tallian", base: 3, odd: 0.6, sort: (i: number) => n(i) / td(i, 15), shield: "horsehead2" },
      { name: "Astellian", base: 4, odd: 0.6, sort: (i: number) => n(i) / td(i, 16), shield: "spanish" },
      { name: "Slovan", base: 5, odd: 0.7, sort: (i: number) => (n(i) / td(i, 6)) * t[i], shield: "round" },
      { name: "Norse", base: 6, odd: 0.7, sort: (i: number) => n(i) / td(i, 5), shield: "heater" },
      { name: "Elladan", base: 7, odd: 0.7, sort: (i: number) => (n(i) / td(i, 18)) * h[i], shield: "boeotian" },
      { name: "Romian", base: 8, odd: 0.7, sort: (i: number) => n(i) / td(i, 15), shield: "roman" },
      { name: "Soumi", base: 9, odd: 0.3, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise" },
      { name: "Koryo", base: 10, odd: 0.1, sort: (i: number) => n(i) / td(i, 12) / t[i], shield: "round" },
      { name: "Hantzu", base: 11, odd: 0.1, sort: (i: number) => n(i) / td(i, 13), shield: "banner" },
      { name: "Yamoto", base: 12, odd: 0.1, sort: (i: number) => n(i) / td(i, 15) / t[i], shield: "round" },
      { name: "Portuzian", base: 13, odd: 0.4, sort: (i: number) => n(i) / td(i, 17) / sf(i), shield: "spanish" },
      { name: "Nawatli", base: 14, odd: 0.1, sort: (i: number) => h[i] / td(i, 18) / bd(i, [7]), shield: "square" },
      { name: "Vengrian", base: 15, odd: 0.2, sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "wedged" },
      { name: "Turchian", base: 16, odd: 0.2, sort: (i: number) => n(i) / td(i, 13), shield: "round" },
      { name: "Berberan", base: 17, odd: 0.1, sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "round" },
      { name: "Eurabic", base: 18, odd: 0.2, sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round" },
      { name: "Inuk", base: 19, odd: 0.05, sort: (i: number) => td(i, -1) / bd(i, [10, 11]) / sf(i), shield: "square" },
      { name: "Euskati", base: 20, odd: 0.05, sort: (i: number) => (n(i) / td(i, 15)) * h[i], shield: "spanish" },
      { name: "Yoruba", base: 21, odd: 0.05, sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis" },
      { name: "Keltan", base: 22, odd: 0.05, sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "vesicaPiscis" },
      { name: "Efratic", base: 23, odd: 0.05, sort: (i: number) => (n(i) / td(i, 22)) * t[i], shield: "diamond" },
      { name: "Tehrani", base: 24, odd: 0.1, sort: (i: number) => (n(i) / td(i, 18)) * h[i], shield: "round" },
      { name: "Maui", base: 25, odd: 0.05, sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i], shield: "round" },
      { name: "Carnatic", base: 26, odd: 0.05, sort: (i: number) => n(i) / td(i, 26), shield: "round" },
      { name: "Inqan", base: 27, odd: 0.05, sort: (i: number) => h[i] / td(i, 13), shield: "square" },
      { name: "Kiswaili", base: 28, odd: 0.1, sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis" },
      { name: "Vietic", base: 29, odd: 0.1, sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner" },
      { name: "Guantzu", base: 30, odd: 0.1, sort: (i: number) => n(i) / td(i, 17), shield: "banner" },
      { name: "Ulus", base: 31, odd: 0.1, sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner" },
      { name: "Hebrew", base: 42, odd: 0.2, sort: (i: number) => (n(i) / td(i, 18)) * sf(i), shield: "oval" }, // Levantine
    ];
  }

  generate() {
    const { pack, graphWidth, graphHeight, emblemShape, Names } = this.ctx;
    this.cells = pack.cells;
    const cultureIds = new Uint16Array(this.cells.i.length); // cell cultures

    const culturesInputNumber = this.ctx.culturesNumber;
    const culturesInSetNumber = CULTURES_SET_MAX[this.ctx.culturesSet];
    let count = Math.min(culturesInputNumber, culturesInSetNumber);
    const populated = this.cells.i.filter((i: number) => this.cells.s[i]); // populated cells

    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        WARN &&
          console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [{ name: "Wildlands", i: 0, base: 1, shield: "round" }];
        this.cells.culture = cultureIds;
        // upstream: "Extreme climate warning" jQuery dialog — stripped
        return;
      } else {
        WARN &&
          console.warn(
            `Not enough populated cells (${populated.length}). Will generate only ${count} cultures`,
          );
        // upstream: "Extreme climate warning" jQuery dialog — stripped
      }
    }

    const selectCultures = (culturesNumber: number): Culture[] => {
      const defaultCultures = this.getDefault(culturesNumber);
      const cultures: Culture[] = [];

      pack.cultures?.forEach((culture) => {
        if (culture.lock && !culture.removed) cultures.push(culture);
      });

      if (!cultures.length) {
        if (culturesNumber === defaultCultures.length)
          return defaultCultures as Culture[];
        if (defaultCultures.every((d) => d.odd === 1))
          return defaultCultures.splice(0, culturesNumber) as Culture[];
      }

      for (
        let culture: Culture, rnd: number, i = 0;
        cultures.length < culturesNumber && defaultCultures.length > 0;

      ) {
        do {
          rnd = rand(defaultCultures.length - 1);
          culture = defaultCultures[rnd] as Culture;
          i++;
        } while (i < 200 && !P(culture.odd as number));
        cultures.push(culture);
        defaultCultures.splice(rnd, 1);
      }
      return cultures;
    };

    const cultures = selectCultures(count);
    pack.cultures = cultures;
    const centers = quadtree();
    const colors = getColors(count);

    const codes: string[] = [];

    const placeCenter = (sortingFn: (i: number) => number) => {
      let spacing = (graphWidth + graphHeight) / 2 / count;
      const MAX_ATTEMPTS = 100;

      const sorted = [...populated].sort((a, b) => sortingFn(b) - sortingFn(a));
      const max = Math.floor(sorted.length / 2);

      let cellId = 0;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        cellId = sorted[biased(0, max, 5)];
        spacing *= 0.9;
        if (
          !cultureIds[cellId] &&
          !centers.find(
            this.cells.p[cellId][0],
            this.cells.p[cellId][1],
            spacing,
          )
        )
          break;
      }

      return cellId;
    };

    // set culture type based on culture center position
    const defineCultureType = (i: number) => {
      if (this.cells.h[i] < 70 && [1, 2, 4].includes(this.cells.biome[i]))
        return "Nomadic"; // high penalty in forest biomes and near coastline
      if (this.cells.h[i] > 50) return "Highland"; // no penalty for hills and mountains, high for other elevations
      const f = pack.features[this.cells.f[this.cells.haven[i]]] as any; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake"; // low water cross penalty and high for growth not along coastline
      if (
        (this.cells.harbor[i] && f.type !== "lake" && P(0.1)) ||
        (this.cells.harbor[i] === 1 && P(0.6)) ||
        ((pack.features[this.cells.f[i]] as any).group === "isle" && P(0.4))
      )
        return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (this.cells.r[i] && this.cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (
        this.cells.t[i] > 2 &&
        [3, 7, 8, 9, 10, 12].includes(this.cells.biome[i])
      )
        return "Hunting"; // high penalty in non-native biomes
      return "Generic";
    };

    const defineCultureExpansionism = (type: string) => {
      let base = 1; // Generic
      if (type === "Lake") base = 0.8;
      else if (type === "Naval") base = 1.5;
      else if (type === "River") base = 0.9;
      else if (type === "Nomadic") base = 1.5;
      else if (type === "Hunting") base = 0.7;
      else if (type === "Highland") base = 1.2;
      return rn(((Math.random() * this.ctx.sizeVariety) / 2 + 1) * base, 1);
    };

    cultures.forEach((c: Culture, i: number) => {
      const newId = i + 1;

      if (c.lock) {
        codes.push(c.code as string);
        centers.add(c.center as unknown as number[]);

        for (const i of this.cells.i) {
          if (this.cells.culture[i] === c.i) cultureIds[i] = newId;
        }

        c.i = newId;
        return;
      }

      const sortingFn = c.sort ? c.sort : (i: number) => this.cells.s[i];
      const center = placeCenter(sortingFn);

      centers.add(this.cells.p[center]);
      c.center = center;
      c.i = newId;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(center);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origins = [0];
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);
      cultureIds[center] = newId;
      if (emblemShape === "random") c.shield = this.getRandomShield();
    });

    this.cells.culture = cultureIds;

    // the first culture with id 0 is for wildlands
    cultures.unshift({
      name: "Wildlands",
      i: 0,
      base: 1,
      origins: [null],
      shield: "round",
    });

    // make sure all bases exist in nameBases
    if (!Names.nameBases.length) {
      ERROR &&
        console.error("Name base is empty, default nameBases will be applied");
      Names.nameBases = getNameBases();
    }

    cultures.forEach((c: Culture) => {
      c.base = c.base % Names.nameBases.length;
    });
  }

  expand() {
    const { pack, biomesData } = this.ctx;
    const { cells, cultures } = pack as never as {
      cells: any;
      cultures: Culture[];
    };

    const queue = new FlatQueue<{
      cellId: number;
      cultureId: number;
      priority: number;
    }>();
    const cost: number[] = [];

    // upstream: byId("neutralRate")?.valueAsNumber || 1 — no such element in
    // index.html, so the fallback 1 is always used
    const neutralRate = 1;
    const maxExpansionCost = cells.i.length * 0.6 * neutralRate; // limit cost for culture growth

    // remove culture from all cells except of locked
    const hasLocked = cultures.some((c) => !c.removed && c.lock);
    if (hasLocked) {
      for (const cellId of cells.i) {
        const culture = cultures[cells.culture[cellId]];
        if (culture.lock) continue;
        cells.culture[cellId] = 0;
      }
    } else {
      cells.culture = new Uint16Array(cells.i.length) as unknown as number[];
    }

    for (const culture of cultures) {
      if (!culture.i || culture.removed || culture.lock) continue;
      queue.push(
        { cellId: culture.center as number, cultureId: culture.i, priority: 0 },
        0,
      );
    }

    const getBiomeCost = (c: number, biome: number, type: string) => {
      if (cells.biome[cultures[c].center as number] === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10)
        return biomesData.cost[biome] * 10; // forest biome penalty for nomads
      return biomesData.cost[biome] * 2; // general non-native biome penalty
    };

    const getHeightCost = (i: number, h: number, type: string) => {
      const f = pack.features[cells.f[i]] as any,
        a = cells.area[i];
      if (type === "Lake" && f.type === "lake") return 10; // no lake crossing penalty for Lake cultures
      if (type === "Naval" && h < 20) return a * 2; // low sea/lake crossing penalty for Naval cultures
      if (type === "Nomadic" && h < 20) return a * 50; // giant sea/lake crossing penalty for Nomads
      if (h < 20) return a * 6; // general sea/lake crossing penalty
      if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
      if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
      if (type === "Highland") return 0; // no penalty for highlanders on highlands
      if (h >= 67) return 200; // general mountains crossing penalty
      if (h >= 44) return 30; // general hills crossing penalty
      return 0;
    };

    const getRiverCost = (riverId: number, cellId: number, type: string) => {
      if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
      if (!riverId) return 0; // no penalty for others if there is no river
      return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
    };

    const getTypeCost = (t: number, type: string) => {
      if (t === 1)
        return type === "Naval" || type === "Lake"
          ? 0
          : type === "Nomadic"
            ? 60
            : 20; // penalty for coastline
      if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
      return 0;
    };

    while (queue.length) {
      const { cellId, priority, cultureId } = queue.pop()!;
      const { type, expansionism } = cultures[cultureId];

      cells.c[cellId].forEach((neibCellId: number) => {
        if (hasLocked) {
          const neibCultureId = cells.culture[neibCellId];
          if (neibCultureId && cultures[neibCultureId].lock) return; // do not overwrite cell of locked culture
        }

        const biome = cells.biome[neibCellId];
        const biomeCost = getBiomeCost(cultureId, biome, type as string);
        const biomeChangeCost = biome === cells.biome[neibCellId] ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(
          neibCellId,
          cells.h[neibCellId],
          type as string,
        );
        const riverCost = getRiverCost(
          cells.r[neibCellId],
          neibCellId,
          type as string,
        );
        const typeCost = getTypeCost(cells.t[neibCellId], type as string);
        const cellCost =
          (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) /
          (expansionism as number);
        const totalCost = priority + cellCost;

        if (totalCost > maxExpansionCost) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.pop[neibCellId] > 0) cells.culture[neibCellId] = cultureId; // assign culture to populated cell
          cost[neibCellId] = totalCost;
          queue.push(
            { cellId: neibCellId, cultureId, priority: totalCost },
            totalCost,
          );
        }
      });
    }
  }
}
