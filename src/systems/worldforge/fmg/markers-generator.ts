/**
 * @file markers-generator.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/public/modules/markers-generator.js. See
 * ./ATTRIBUTION.md.
 *
 * Ported: generate() (all 35 default marker types with their candidate
 * filters and legend writers), regenerate(), add(), deleteMarker(),
 * getConfig/setConfig. Upstream main.js runs Markers.generate() directly
 * after Military.generate(), before Zones.generate() — same slot here.
 *
 * RNG CONTRACT: no reseed. Draws happen per config row in fixed order:
 * extractAnyElement (one Math.random per placed marker) interleaved with
 * each type's add-legend draws (P/ra/rw/rand/gauss/Names) — continuing the
 * post-Provinces stream after Military's regiment-note draws. Nothing
 * previously ported runs after this stage, so existing goldens are
 * untouched.
 *
 * Adaptations (cosmetic only): globals → context (pack/grid/biomesData/seed,
 * Names/Routes/States module instances, notes sink, populationRate/
 * urbanization/era and heightUnit/heightExponent with upstream input
 * defaults); `culturesSet` drives the isFantasy multiplier exactly like
 * upstream's DOM select; document.getElementById marker-DOM removal in
 * regenerate() dropped (headless); notes filtering is done in place to keep
 * the shared array reference.
 *
 * UPSTREAM QUIRKS PRESERVED: addLighthouse/addWaterfall concatenate a bare
 * `name` identifier (= the empty global window.name) — ported as "";
 * listFairs' redundant `population < 20 && population < 5` condition kept;
 * addStatue's ra() over a string indexes UTF-16 code units (can split
 * surrogate pairs — upstream behavior); dungeon/encounter legends keep
 * their upstream iframe HTML verbatim.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mean } from "./d3Shim";
import { last } from "./utils/arrayUtils";
import { findClosestCell, type Grid } from "./utils/graphUtils";
import { getAdjective } from "./utils/languageUtils";
import { rn } from "./utils/numberUtils";
import { P, gauss, ra, rand, rw } from "./utils/probabilityUtils";
import { capitalize } from "./utils/stringUtils";
import { generateDate } from "./utils/commonUtils";
import { convertTemperature, makeGetFriendlyHeight } from "./utils/unitUtils";
import type { Pack } from "./features";
import type { NamesGenerator } from "./names-generator";
import type { RoutesModule } from "./routes-generator";
import type { StatesModule, State } from "./states-generator";
import type { MapNote } from "./military-generator";

export interface Marker {
  i: number;
  type: string;
  icon: string;
  x: number;
  y: number;
  cell: number;
  dx?: number;
  dy?: number;
  px?: number;
  lock?: boolean;
}

export interface MarkerConfigRow {
  type: string;
  icon: string;
  dx?: number;
  dy?: number;
  px?: number;
  min: number;
  each: number;
  multiplier: number;
  list: (pack: Pack) => number[] | ArrayLike<number>;
  add: (id: string, cell: number) => void;
}

export interface MarkersContext {
  pack: Pack;
  grid: Grid;
  biomesData: { habitability: ArrayLike<number> };
  seed: string;
  Names: NamesGenerator;
  Routes: RoutesModule;
  States: StatesModule;
  notes: MapNote[];
  /** Upstream culturesSet select — "...Fantasy" enables portal/rift/burial types. */
  culturesSet?: string;
  populationRate?: number;
  urbanization?: number;
  era?: string;
  heightUnit?: string;
  heightExponent?: number;
}

export class MarkersModule {
  private pack: Pack;
  private seed: string;
  private Names: NamesGenerator;
  private Routes: RoutesModule;
  private States: StatesModule;
  private notes: MapNote[];
  private biomesData: { habitability: ArrayLike<number> };
  private populationRate: number;
  private urbanization: number;
  private era: string;
  private heightUnit: string;
  private getFriendlyHeight: (p: [number, number] | ArrayLike<number>) => string;

  private config: MarkerConfigRow[];
  private occupied: boolean[] = [];
  private isFantasy: boolean;

  constructor(context: MarkersContext) {
    this.pack = context.pack;
    this.seed = context.seed;
    this.Names = context.Names;
    this.Routes = context.Routes;
    this.States = context.States;
    this.notes = context.notes;
    this.biomesData = context.biomesData;
    this.populationRate = context.populationRate ?? 1000;
    this.urbanization = context.urbanization ?? 1;
    this.era = context.era ?? "Common Era";
    this.heightUnit = context.heightUnit ?? "ft";
    this.isFantasy = (context.culturesSet ?? "").includes("Fantasy");

    const cells = this.pack.cells as any;
    this.getFriendlyHeight = makeGetFriendlyHeight(
      (x, y) => findClosestCell(x, y, Infinity, this.pack as any) as number,
      cells.h,
      context.grid,
      this.heightUnit,
      context.heightExponent ?? 2,
    );

    this.config = this.getDefaultConfig();
  }

  /*
    Default markers config:
    type - short description (snake-case)
    icon - unicode character or url to image
    dx: icon offset in x direction, in pixels
    dy: icon offset in y direction, in pixels
    min: minimum number of candidates to add at least 1 marker
    each: how many of the candidates should be added as markers
    multiplier: multiply markers quantity to add
    list: function to select candidates
    add: function to add marker legend
  */
  // prettier-ignore
  getDefaultConfig(): MarkerConfigRow[] {
    const isFantasy = this.isFantasy;
    return [
      {type: "volcanoes", icon: "🌋", dx: 52, px: 13, min: 10, each: 500, multiplier: 1, list: p => this.listVolcanoes(p), add: (id, cell) => this.addVolcano(id, cell)},
      {type: "hot-springs", icon: "♨️", dy: 52, min: 30, each: 1200, multiplier: 1, list: p => this.listHotSprings(p), add: (id, cell) => this.addHotSpring(id, cell)},
      {type: "water-sources", icon: "💧", min: 1, each: 1000, multiplier: 1, list: p => this.listWaterSources(p), add: (id, cell) => this.addWaterSource(id, cell)},
      {type: "mines", icon: "⛏️", dx: 48, px: 13, min: 1, each: 15, multiplier: 1, list: p => this.listMines(p), add: (id, cell) => this.addMine(id, cell)},
      {type: "bridges", icon: "🌉", px: 14, min: 1, each: 5, multiplier: 1, list: p => this.listBridges(p), add: (id, cell) => this.addBridge(id, cell)},
      {type: "inns", icon: "🍻", px: 14, min: 1, each: 10, multiplier: 1, list: p => this.listInns(p), add: (id, cell) => this.addInn(id, cell)},
      {type: "lighthouses", icon: "🚨", px: 14, min: 1, each: 2, multiplier: 1, list: p => this.listLighthouses(p), add: (id, cell) => this.addLighthouse(id, cell)},
      {type: "waterfalls", icon: "⟱", dy: 54, px: 16, min: 1, each: 5, multiplier: 1, list: p => this.listWaterfalls(p), add: (id, cell) => this.addWaterfall(id, cell)},
      {type: "battlefields", icon: "⚔️", dy: 52, min: 50, each: 700, multiplier: 1, list: p => this.listBattlefields(p), add: (id, cell) => this.addBattlefield(id, cell)},
      {type: "dungeons", icon: "🗝️", dy: 51, px: 13, min: 30, each: 200, multiplier: 1, list: p => this.listDungeons(p), add: (id, cell) => this.addDungeon(id, cell)},
      {type: "lake-monsters", icon: "🐉", dy: 48, min: 2, each: 10, multiplier: 1, list: p => this.listLakeMonsters(p), add: (id, cell) => this.addLakeMonster(id, cell)},
      {type: "sea-monsters", icon: "🦑", min: 50, each: 700, multiplier: 1, list: p => this.listSeaMonsters(p), add: (id, cell) => this.addSeaMonster(id, cell)},
      {type: "hill-monsters", icon: "👹", dy: 54, px: 13, min: 30, each: 600, multiplier: 1, list: p => this.listHillMonsters(p), add: (id, cell) => this.addHillMonster(id, cell)},
      {type: "sacred-mountains", icon: "🗻", dy: 48, min: 1, each: 5, multiplier: 1, list: p => this.listSacredMountains(p), add: (id, cell) => this.addSacredMountain(id, cell)},
      {type: "sacred-forests", icon: "🌳", min: 30, each: 1000, multiplier: 1, list: p => this.listSacredForests(p), add: (id, cell) => this.addSacredForest(id, cell)},
      {type: "sacred-pineries", icon: "🌲", px: 13, min: 30, each: 800, multiplier: 1, list: p => this.listSacredPineries(p), add: (id, cell) => this.addSacredPinery(id, cell)},
      {type: "sacred-palm-groves", icon: "🌴", px: 13, min: 1, each: 100, multiplier: 1, list: p => this.listSacredPalmGroves(p), add: (id, cell) => this.addSacredPalmGrove(id, cell)},
      {type: "brigands", icon: "💰", px: 13, min: 50, each: 100, multiplier: 1, list: p => this.listBrigands(p), add: (id, cell) => this.addBrigands(id, cell)},
      {type: "pirates", icon: "🏴‍☠️", dx: 51, min: 40, each: 300, multiplier: 1, list: p => this.listPirates(p), add: (id, cell) => this.addPirates(id, cell)},
      {type: "statues", icon: "🗿", min: 80, each: 1200, multiplier: 1, list: p => this.listStatues(p), add: (id, cell) => this.addStatue(id, cell)},
      {type: "ruins", icon: "🏺", min: 80, each: 1200, multiplier: 1, list: p => this.listRuins(p), add: (id, cell) => this.addRuins(id, cell)},
      {type: "libraries", icon: "📚", min: 10, each: 1200, multiplier: 1, list: p => this.listLibraries(p), add: (id, cell) => this.addLibrary(id, cell)},
      {type: "circuses", icon: "🎪", min: 80, each: 1000, multiplier: 1, list: p => this.listCircuses(p), add: (id, cell) => this.addCircuse(id, cell)},
      {type: "jousts", icon: "🤺", dx: 48, min: 5, each: 500, multiplier: 1, list: p => this.listJousts(p), add: (id, cell) => this.addJoust(id, cell)},
      {type: "fairs", icon: "🎠", min: 50, each: 1000, multiplier: 1, list: p => this.listFairs(p), add: (id, cell) => this.addFair(id, cell)},
      {type: "canoes", icon: "🛶", min: 500, each: 2000, multiplier: 1, list: p => this.listCanoes(p), add: (id, cell) => this.addCanoe(id, cell)},
      {type: "migration", icon: "🐗", min: 20, each: 1000, multiplier: 1, list: p => this.listMigrations(p), add: (id, cell) => this.addMigration(id, cell)},
      {type: "dances", icon: "💃🏽", min: 50, each: 1000, multiplier: 1, list: p => this.listDances(p), add: (id, cell) => this.addDances(id, cell)},
      {type: "mirage", icon: "💦", min: 10, each: 400, multiplier: 1, list: p => this.listMirage(p), add: (id, cell) => this.addMirage(id, cell)},
      {type: "caves", icon: "🦇", min: 60, each: 1000, multiplier: 1, list: p => this.listCaves(p), add: (id, cell) => this.addCave(id, cell)},
      {type: "portals", icon: "🌀", px: 14, min: 16, each: 8, multiplier: +isFantasy, list: p => this.listPortals(p), add: (id, cell) => this.addPortal(id, cell)},
      {type: "rifts", icon: "🎆", min: 5, each: 3000, multiplier: +isFantasy, list: p => this.listRifts(p), add: (id, cell) => this.addRift(id, cell)},
      {type: "disturbed-burials", icon: "💀", min: 20, each: 3000, multiplier: +isFantasy, list: p => this.listDisturbedBurial(p), add: (id, cell) => this.addDisturbedBurial(id, cell)},
      {type: "necropolises", icon: "🪦", min: 20, each: 1000, multiplier: 1, list: p => this.listNecropolis(p), add: (id, cell) => this.addNecropolis(id, cell)},
      {type: "encounters", icon: "🧙", min: 10, each: 600, multiplier: 1, list: p => this.listEncounters(p), add: (id, cell) => this.addEncounter(id, cell)},
    ];
  }

  getConfig(): MarkerConfigRow[] {
    return this.config;
  }

  setConfig(newConfig: MarkerConfigRow[]): void {
    this.config = newConfig;
  }

  generate(): void {
    this.setConfig(this.getDefaultConfig());
    (this.pack as any).markers = [];
    this.generateTypes();
  }

  regenerate(): void {
    (this.pack as any).markers = (this.pack as any).markers.filter(({i, lock, cell}: Marker) => {
      if (lock) {
        this.occupied[cell] = true;
        return true;
      }
      // upstream also removes the marker's SVG element here (DOM, headless: skipped)
      const id = `marker${i}`;
      const index = this.notes.findIndex(note => note.id === id);
      if (index != -1) this.notes.splice(index, 1);
      return false;
    });

    this.generateTypes();
  }

  add(marker: Partial<Marker> & {cell: number; type?: string}): Marker {
    const base = this.config.find(c => c.type === marker.type);
    if (base) {
      const {icon, type, dx, dy, px} = base;
      const added = this.addMarker({icon, type, dx, dy, px}, marker)!;
      base.add("marker" + added.i, added.cell);
      return added;
    }

    const markers = (this.pack as any).markers as Marker[];
    const i = (last(markers)?.i ?? -1) + 1 || 0;
    markers.push({...(marker as Marker), i});
    this.occupied[marker.cell] = true;
    return {...(marker as Marker), i};
  }

  private generateTypes(): void {
    this.config.forEach(({type, icon, dx, dy, px, min, each, multiplier, list, add}) => {
      if (multiplier === 0) return;

      const candidates = Array.from(list(this.pack) as ArrayLike<number>);
      let quantity = this.getQuantity(candidates, min, each, multiplier);

      while (quantity && candidates.length) {
        const [cell] = this.extractAnyElement(candidates);
        const marker = this.addMarker({icon, type, dx, dy, px}, {cell});
        if (!marker) continue;
        add("marker" + marker.i, cell);
        quantity--;
      }
    });

    this.occupied = [];
  }

  private getQuantity(array: number[], min: number, each: number, multiplier: number): number {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  }

  private extractAnyElement(array: number[]): number[] {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  private getMarkerCoordinates(cell: number): [number, number] {
    const {cells, burgs} = this.pack as any;
    const burgId = cells.burg[cell];

    if (burgId) {
      const {x, y} = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  }

  private addMarker(base: Partial<Marker>, marker: Partial<Marker> & {cell?: number}): Marker | undefined {
    if (marker.cell === undefined) return;
    const markers = (this.pack as any).markers as Marker[];
    const i = (last(markers)?.i ?? -1) + 1 || 0;
    const [x, y] = this.getMarkerCoordinates(marker.cell);
    const full = {...base, x, y, ...marker, i} as Marker;
    markers.push(full);
    this.occupied[full.cell] = true;
    return full;
  }

  deleteMarker(markerId: number): void {
    const noteId = "marker" + markerId;
    // in place: the notes array reference is shared with the world result
    const keep = this.notes.filter(note => note.id !== noteId);
    this.notes.length = 0;
    this.notes.push(...keep);
    (this.pack as any).markers = ((this.pack as any).markers as Marker[]).filter(m => m.i !== markerId);
  }

  // ── candidate lists + legend writers (verbatim per type) ─────────────────

  private listVolcanoes({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 70);
  }

  private addVolcano(id: string, cell: number) {
    const {cells} = this.pack as any;

    const proper = this.Names.getCulture(cells.culture[cell]);
    const name = P(0.3) ? "Mount " + proper : P(0.7) ? proper + " Volcano" : proper;
    const status = P(0.6) ? "Dormant" : P(0.4) ? "Active" : "Erupting";
    this.notes.push({id, name, legend: `${status} volcano. Height: ${this.getFriendlyHeight(cells.p[cell])}.`});
  }

  private listHotSprings({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] > 50 && cells.culture[i]);
  }

  private addHotSpring(id: string, cell: number) {
    const {cells} = this.pack as any;

    const proper = this.Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    const name = P(0.3) ? "Hot Springs of " + proper : P(0.7) ? proper + " Hot Springs" : proper;
    const legend = `A geothermal springs with naturally heated water that provide relaxation and medicinal benefits. Average temperature is ${temp}.`;

    this.notes.push({id, name, legend});
  }

  private listWaterSources({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] > 30 && cells.r[i]);
  }

  private addWaterSource(id: string, cell: number) {
    const {cells} = this.pack as any;

    const type = rw({
      "Healing Spring": 5,
      "Purifying Well": 2,
      "Enchanted Reservoir": 1,
      "Creek of Luck": 1,
      "Fountain of Youth": 1,
      "Wisdom Spring": 1,
      "Spring of Life": 1,
      "Spring of Youth": 1,
      "Healing Stream": 1
    });

    const proper = this.Names.getCulture(cells.culture[cell]);
    const name = `${proper} ${type}`;
    const legend =
      "This legendary water source is whispered about in ancient tales and believed to possess mystical properties. The spring emanates crystal-clear water, shimmering with an otherworldly iridescence that sparkles even in the dimmest light.";

    this.notes.push({id, name, legend});
  }

  private listMines({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] > 47 && cells.burg[i]);
  }

  private addMine(id: string, cell: number) {
    const {cells} = this.pack as any;

    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};
    const resource = rw(resources);
    const burg = (this.pack as any).burgs[cells.burg[cell]];
    const name = `${burg.name} — ${resource} mining town`;
    const population = rn(burg.population * this.populationRate * this.urbanization);
    const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine.`;
    this.notes.push({id, name, legend});
  }

  private listBridges({cells, burgs}: any) {
    const meanFlux = mean(Array.from(cells.fl as ArrayLike<number>).filter((fl: number) => fl > 0));
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] &&
        cells.burg[i] &&
        cells.t[i] !== 1 &&
        burgs[cells.burg[i]].population > 20 &&
        cells.r[i] &&
        cells.fl[i] > (meanFlux as number)
    );
  }

  private addBridge(id: string, cell: number) {
    const {cells} = this.pack as any;

    const burg = (this.pack as any).burgs[cells.burg[cell]];
    const river = (this.pack as any).rivers.find((r: any) => r.i === cells.r[cell]);
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const name = river && P(0.2) ? `${river.name} Bridge` : `${burg.name} Bridge`;
    const weightedAdjectives = {
      stone: 10,
      wooden: 1,
      lengthy: 2,
      formidable: 2,
      rickety: 1,
      beaten: 1,
      weathered: 1
    };
    const barriers = [
      "its collapse during the flood",
      "being rumoured to attract trolls",
      "the drying up of local trade",
      "banditry infested the area",
      "the old waypoints crumbled"
    ];
    const legend = P(0.7)
      ? `A ${rw(weightedAdjectives)} bridge spans over the ${riverName} near ${burg.name}.`
      : `An old crossing of the ${riverName}, rarely used since ${ra(barriers)}.`;

    this.notes.push({id, name, legend});
  }

  private listInns({cells}: any) {
    const crossRoads = cells.i.filter(
      (i: number) => !this.occupied[i] && cells.pop[i] > 5 && this.Routes.isCrossroad(i)
    );
    return crossRoads;
  }

  private addInn(id: string, _cell: number) {
    const colors = [
      "Dark", "Light", "Bright", "Golden", "White", "Black", "Red", "Pink",
      "Purple", "Blue", "Green", "Yellow", "Amber", "Orange", "Brown", "Grey"
    ];
    const animals = [
      "Antelope", "Ape", "Badger", "Bear", "Beaver", "Bison", "Boar", "Buffalo",
      "Cat", "Crane", "Crocodile", "Crow", "Deer", "Dog", "Eagle", "Elk", "Fox",
      "Goat", "Goose", "Hare", "Hawk", "Heron", "Horse", "Hyena", "Ibis",
      "Jackal", "Jaguar", "Lark", "Leopard", "Lion", "Mantis", "Marten",
      "Moose", "Mule", "Narwhal", "Owl", "Panther", "Rat", "Raven", "Rook",
      "Scorpion", "Shark", "Sheep", "Snake", "Spider", "Swan", "Tiger",
      "Turtle", "Wolf", "Wolverine", "Camel", "Falcon", "Hound", "Ox"
    ];
    const adjectives = [
      "New", "Good", "High", "Old", "Great", "Big", "Major", "Happy", "Main",
      "Huge", "Far", "Beautiful", "Fair", "Prime", "Ancient", "Golden",
      "Proud", "Lucky", "Fat", "Honest", "Giant", "Distant", "Friendly",
      "Loud", "Hungry", "Magical", "Superior", "Peaceful", "Frozen", "Divine",
      "Favorable", "Brave", "Sunny", "Flying"
    ];
    const methods = [
      "Boiled", "Grilled", "Roasted", "Spit-roasted", "Stewed", "Stuffed",
      "Jugged", "Mashed", "Baked", "Braised", "Poached", "Marinated",
      "Pickled", "Smoked", "Dried", "Dry-aged", "Corned", "Fried",
      "Pan-fried", "Deep-fried", "Dressed", "Steamed", "Cured", "Syrupped",
      "Flame-Broiled"
    ];
    const courses = [
      "beef", "pork", "bacon", "chicken", "lamb", "chevon", "hare", "rabbit",
      "hart", "deer", "antlers", "bear", "buffalo", "badger", "beaver",
      "turkey", "pheasant", "duck", "goose", "teal", "quail", "pigeon",
      "seal", "carp", "bass", "pike", "catfish", "sturgeon", "escallop",
      "pie", "cake", "pottage", "pudding", "onions", "carrot", "potato",
      "beet", "garlic", "cabbage", "eggplant", "eggs", "broccoli", "zucchini",
      "pepper", "olives", "pumpkin", "spinach", "peas", "chickpea", "beans",
      "rice", "pasta", "bread", "apples", "peaches", "pears", "melon",
      "oranges", "mango", "tomatoes", "cheese", "corn", "rat tails", "pig ears"
    ];
    const types = [
      "hot", "cold", "fire", "ice", "smoky", "misty", "shiny", "sweet",
      "bitter", "salty", "sour", "sparkling", "smelly"
    ];
    const drinks = [
      "wine", "brandy", "gin", "whisky", "rom", "beer", "cider", "mead",
      "liquor", "spirits", "vodka", "tequila", "absinthe", "nectar", "milk",
      "kvass", "kumis", "tea", "water", "juice", "sap"
    ];

    const typeName = P(0.3) ? "inn" : "tavern";
    const isAnimalThemed = P(0.7);
    const animal = ra(animals);
    const name = isAnimalThemed
      ? P(0.6)
        ? ra(colors) + " " + animal
        : ra(adjectives) + " " + animal
      : ra(adjectives) + " " + capitalize(typeName);
    const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
    const course = `${ra(methods)} ${meal}`.toLowerCase();
    const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
    const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here.`;
    this.notes.push({id, name: "The " + name, legend});
  }

  private listLighthouses({cells}: any) {
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] &&
        cells.harbor[i] > 6 &&
        cells.c[i].some((c: number) => cells.h[c] < 20 && this.Routes.isConnected(c))
    );
  }

  private addLighthouse(id: string, cell: number) {
    const {cells} = this.pack as any;

    const proper = cells.burg[cell]
      ? (this.pack as any).burgs[cells.burg[cell]].name
      : this.Names.getCulture(cells.culture[cell]);
    this.notes.push({
      id,
      // upstream appends a bare `name` identifier (= window.name = "")
      name: getAdjective(proper) + " Lighthouse" + "",
      legend: `A lighthouse to serve as a beacon for ships in the open sea.`
    });
  }

  private listWaterfalls({cells}: any) {
    return cells.i.filter(
      (i: number) =>
        cells.r[i] &&
        !this.occupied[i] &&
        cells.h[i] >= 50 &&
        cells.c[i].some((c: number) => cells.h[c] < 40 && cells.r[c])
    );
  }

  private addWaterfall(id: string, cell: number) {
    const {cells} = this.pack as any;

    const descriptions = [
      "A gorgeous waterfall flows here.",
      "The rapids of an exceptionally beautiful waterfall.",
      "An impressive waterfall has cut through the land.",
      "The cascades of a stunning waterfall.",
      "A river drops down from a great height forming a wonderous waterfall.",
      "A breathtaking waterfall cuts through the landscape."
    ];

    const proper = cells.burg[cell]
      ? (this.pack as any).burgs[cells.burg[cell]].name
      : this.Names.getCulture(cells.culture[cell]);
    // upstream appends a bare `name` identifier (= window.name = "")
    this.notes.push({id, name: getAdjective(proper) + " Waterfall" + "", legend: `${ra(descriptions)}`});
  }

  private listBattlefields({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25
    );
  }

  private addBattlefield(id: string, cell: number) {
    const {cells} = this.pack as any;
    const states = (this.pack as any).states as State[];

    const state = states[cells.state[cell]] as any;
    if (!state.campaigns) state.campaigns = this.States.generateCampaign(state);
    const campaign = ra(state.campaigns) as { name: string; start: number; end: number };
    const date = generateDate(campaign.start, campaign.end);
    const name = this.Names.getCulture(cells.culture[cell]) + " Battlefield";
    const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${this.era}.`;
    this.notes.push({id, name, legend});
  }

  private listDungeons({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.pop[i] && cells.pop[i] < 3);
  }

  private addDungeon(id: string, cell: number) {
    const dungeonSeed = `${this.seed}${cell}`;
    const name = "Dungeon";
    const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="pointer-events: none;" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    this.notes.push({id, name, legend});
  }

  private listLakeMonsters({features}: any) {
    return features
      .filter(
        (feature: any) =>
          feature && feature.type === "lake" && feature.group === "freshwater" && !this.occupied[feature.firstCell]
      )
      .map((feature: any) => feature.firstCell);
  }

  private addLakeMonster(id: string, cell: number) {
    const lake = (this.pack as any).features[(this.pack as any).cells.f[cell]];

    // Check that the feature is a lake in case the user clicked on a wrong square
    if (lake.type !== "lake") return;

    const name = `${lake.name} Monster`;
    const length = gauss(10, 5, 5, 100);
    const subjects = [
      "Locals", "Elders", "Inscriptions", "Tipplers", "Legends", "Whispers",
      "Rumors", "Journeying folk", "Tales"
    ];
    const legend = `${ra(subjects)} say a relic monster of ${length} ${this.heightUnit} long inhabits ${
      lake.name
    } Lake. Truth or lie, folks are afraid to fish in the lake.`;
    this.notes.push({id, name, legend});
  }

  private listSeaMonsters({cells, features}: any) {
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] && cells.h[i] < 20 && this.Routes.isConnected(i) && features[cells.f[i]].type === "ocean"
    );
  }

  private addSeaMonster(id: string, _cell: number) {
    const name = `${this.Names.getCultureShort(0)} Monster`;
    const length = gauss(25, 10, 10, 100);
    const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${this.heightUnit} long.`;
    this.notes.push({id, name, legend});
  }

  private listHillMonsters({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addHillMonster(id: string, cell: number) {
    const {cells} = this.pack as any;

    const adjectives = [
      "great", "big", "huge", "prime", "golden", "proud", "lucky", "fat",
      "giant", "hungry", "magical", "superior", "terrifying", "horrifying",
      "feared"
    ];
    const subjects = [
      "Locals", "Elders", "Inscriptions", "Tipplers", "Legends", "Whispers",
      "Rumors", "Journeying folk", "Tales"
    ];
    const species = [
      "Ogre", "Troll", "Cyclops", "Giant", "Monster", "Beast", "Dragon",
      "Undead", "Ghoul", "Vampire", "Hag", "Banshee", "Bearded Devil", "Roc",
      "Hydra", "Warg"
    ];
    const modusOperandi = [
      "steals cattle at night", "prefers eating children",
      "doesn't mind human flesh", "keeps the region at bay", "eats kids whole",
      "abducts young women", "terrorizes the region",
      "harasses travelers in the area", "snatches people from homes",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims"
    ];

    const monster = ra(species);
    const toponym = this.Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} speak of a ${ra(adjectives)} ${monster} who inhabits ${toponym} hills and ${ra(
      modusOperandi
    )}.`;
    this.notes.push({id, name, legend});
  }

  // Sacred mountains spawn on lonely mountains
  private listSacredMountains({cells}: any) {
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] &&
        cells.h[i] >= 70 &&
        cells.c[i].some((c: number) => cells.culture[c]) &&
        cells.c[i].every((c: number) => cells.h[c] < 60)
    );
  }

  private addSacredMountain(id: string, cell: number) {
    const {cells} = this.pack as any;
    const religions = (this.pack as any).religions;

    const culture = cells.c[cell].map((c: number) => cells.culture[c]).find((c: number) => c);
    const religion = cells.religion[cell];
    const name = `${this.Names.getCulture(culture)} Mountain`;
    const height = this.getFriendlyHeight(cells.p[cell]);
    const legend = `A sacred mountain of ${religions[religion].name}. Height: ${height}.`;
    this.notes.push({id, name, legend});
  }

  // Sacred forests spawn on temperate forests
  private listSacredForests({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.culture[i] && cells.religion[i] && [6, 8].includes(cells.biome[i])
    );
  }

  private addSacredForest(id: string, cell: number) {
    const {cells} = this.pack as any;
    const religions = (this.pack as any).religions;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${this.Names.getCulture(culture)} Forest`;
    const legend = `A forest sacred to local ${religions[religion].name}.`;
    this.notes.push({id, name, legend});
  }

  // Sacred pineries spawn on boreal forests
  private listSacredPineries({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.culture[i] && cells.religion[i] && cells.biome[i] === 9
    );
  }

  private addSacredPinery(id: string, cell: number) {
    const {cells} = this.pack as any;
    const religions = (this.pack as any).religions;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${this.Names.getCulture(culture)} Pinery`;
    const legend = `A pinery sacred to local ${religions[religion].name}.`;
    this.notes.push({id, name, legend});
  }

  // Sacred palm groves spawn on oasises
  private listSacredPalmGroves({cells}: any) {
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] &&
        cells.culture[i] &&
        cells.religion[i] &&
        cells.biome[i] === 1 &&
        cells.pop[i] > 1 &&
        this.Routes.isConnected(i)
    );
  }

  private addSacredPalmGrove(id: string, cell: number) {
    const {cells} = this.pack as any;
    const religions = (this.pack as any).religions;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${this.Names.getCulture(culture)} Palm Grove`;
    const legend = `A palm grove sacred to local ${religions[religion].name}.`;
    this.notes.push({id, name, legend});
  }

  private listBrigands({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.culture[i] && this.Routes.hasRoad(i));
  }

  private addBrigands(id: string, cell: number) {
    const {cells} = this.pack as any;

    const animals = [
      "Apes", "Badgers", "Bears", "Beavers", "Bisons", "Boars", "Cats",
      "Crows", "Dogs", "Foxes", "Hares", "Hawks", "Hyenas", "Jackals",
      "Jaguars", "Leopards", "Lions", "Owls", "Panthers", "Rats", "Ravens",
      "Rooks", "Scorpions", "Sharks", "Snakes", "Spiders", "Tigers", "Wolfs",
      "Wolverines", "Falcons"
    ];
    const types = {brigands: 4, bandits: 3, robbers: 1, highwaymen: 1};

    const culture = cells.culture[cell];
    const biome = cells.biome[cell];
    // UPSTREAM QUIRK: `height` is assigned the cell's POINT (cells.p), not
    // its height, so the `height >= 70` branch never fires — preserved.
    const height = cells.p[cell];

    const locality = ((height: any, biome: number) => {
      if (height >= 70) return "highlander";
      if ([1, 2].includes(biome)) return "desert";
      if ([3, 4].includes(biome)) return "mounted";
      if ([5, 6, 7, 8, 9].includes(biome)) return "forest";
      if (biome === 12) return "swamp";
      return "angry";
    })(height, biome);

    const name = `${this.Names.getCulture(culture)} ${ra(animals)}`;
    const legend = `A gang of ${locality} ${rw(types)}.`;
    this.notes.push({id, name, legend});
  }

  // Pirates spawn on sea routes
  private listPirates({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] < 20 && this.Routes.isConnected(i));
  }

  private addPirates(id: string, _cell: number) {
    const name = "Pirates";
    const legend = "Pirate ships have been spotted in these waters.";
    this.notes.push({id, name, legend});
  }

  private listStatues({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40);
  }

  private addStatue(id: string, cell: number) {
    const {cells} = this.pack as any;

    const variants = [
      "Statue", "Obelisk", "Monument", "Column", "Monolith", "Pillar",
      "Megalith", "Stele", "Runestone", "Sculpture", "Effigy", "Idol"
    ];
    const scripts: Record<string, string> = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿      ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

    const culture = cells.culture[cell];

    const variant = ra(variants);
    const name = `${this.Names.getCulture(culture)} ${variant}`;
    // upstream ra() over a STRING indexes UTF-16 code units (can split
    // surrogate pairs) — preserved via the same indexing
    const script = scripts[ra(Object.keys(scripts))];
    const inscription = Array(rand(40, 100))
      .fill(null)
      .map(() => (ra as any)(script))
      .join("");
    const legend = `An ancient ${variant.toLowerCase()}. It has an inscription, but no one can translate it:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
    this.notes.push({id, name, legend});
  }

  private listRuins({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60
    );
  }

  private addRuins(id: string, _cell: number) {
    const types = [
      "City", "Town", "Settlement", "Pyramid", "Fort", "Stronghold", "Temple",
      "Sacred site", "Mausoleum", "Outpost", "Fortification", "Fortress",
      "Castle"
    ];

    const ruinType = ra(types);
    const name = `Ruined ${ruinType}`;
    const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within.`;
    this.notes.push({id, name, legend});
  }

  private listLibraries({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.culture[i] && cells.burg[i] && cells.pop[i] > 10
    );
  }

  private addLibrary(id: string, cell: number) {
    const {cells} = this.pack as any;

    const type = rw({Library: 3, Archive: 1, Collection: 1});
    const name = `${this.Names.getCulture(cells.culture[cell])} ${type}`;
    const legend = "A vast collection of knowledge, including many rare and ancient tomes.";

    this.notes.push({id, name, legend});
  }

  private listCircuses({cells}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && this.Routes.isConnected(i)
    );
  }

  private addCircuse(id: string, _cell: number) {
    const adjectives = [
      "Fantastical", "Wonderous", "Incomprehensible", "Magical",
      "Extraordinary", "Unmissable", "World-famous", "Breathtaking"
    ];

    const adjective = ra(adjectives);
    const name = `Travelling ${adjective} Circus`;
    const legend = `Roll up, roll up, this ${adjective.toLowerCase()} circus is here for a limited time only.`;
    this.notes.push({id, name, legend});
  }

  private listJousts({cells, burgs}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 20
    );
  }

  private addJoust(id: string, cell: number) {
    const {cells} = this.pack as any;
    const burgs = (this.pack as any).burgs;
    const types = ["Joust", "Competition", "Melee", "Tournament", "Contest"];
    const virtues = ["cunning", "might", "speed", "the greats", "acumen", "brutality"];

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;
    const type = ra(types);
    const virtue = ra(virtues);

    const name = `${burgName} ${type}`;
    const legend = `Warriors from around the land gather for a ${type.toLowerCase()} of ${virtue} in ${burgName}, with fame, fortune and favour on offer to the victor.`;
    this.notes.push({id, name, legend});
  }

  private listFairs({cells, burgs}: any) {
    // upstream's redundant double population condition preserved
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] &&
        cells.burg[i] &&
        burgs[cells.burg[i]].population < 20 &&
        burgs[cells.burg[i]].population < 5
    );
  }

  private addFair(id: string, cell: number) {
    const {cells} = this.pack as any;
    const burgs = (this.pack as any).burgs;
    if (!cells.burg[cell]) return;

    const burgName = burgs[cells.burg[cell]].name;
    const type = "Fair";

    const name = `${burgName} ${type}`;
    const legend = `A fair is being held in ${burgName}, with all manner of local and foreign goods and services on offer.`;
    this.notes.push({id, name, legend});
  }

  private listCanoes({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.r[i]);
  }

  private addCanoe(id: string, cell: number) {
    const river = (this.pack as any).rivers.find((r: any) => r.i === (this.pack as any).cells.r[cell]);

    const name = `Minor Jetty`;
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const legend = `A small location along the ${riverName} to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river.`;
    this.notes.push({id, name, legend});
  }

  private listMigrations({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] <= 2);
  }

  private addMigration(id: string, _cell: number) {
    const animals = [
      "Antelopes", "Apes", "Badgers", "Bears", "Beavers", "Bisons", "Boars",
      "Buffalo", "Cats", "Cranes", "Crocodiles", "Crows", "Deer", "Dogs",
      "Eagles", "Elk", "Foxes", "Goats", "Geese", "Hares", "Hawks", "Herons",
      "Horses", "Hyenas", "Ibises", "Jackals", "Jaguars", "Larks", "Leopards",
      "Lions", "Mantises", "Martens", "Mooses", "Mules", "Owls", "Panthers",
      "Rats", "Ravens", "Rooks", "Scorpions", "Sharks", "Sheep", "Snakes",
      "Spiders", "Tigers", "Wolves", "Wolverines", "Camels", "Falcons",
      "Hounds", "Oxen"
    ];
    const animalChoice = ra(animals);

    const name = `${animalChoice} migration`;
    const legend = `A huge group of ${animalChoice.toLowerCase()} are migrating, whether part of their annual routine, or something more extraordinary.`;
    this.notes.push({id, name, legend});
  }

  private listDances({cells, burgs}: any) {
    return cells.i.filter(
      (i: number) => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 15
    );
  }

  private addDances(id: string, cell: number) {
    const {cells} = this.pack as any;
    const burgs = (this.pack as any).burgs;
    const burgName = burgs[cells.burg[cell]].name;
    const socialTypes = [
      "gala", "dance", "performance", "ball", "soiree", "jamboree",
      "exhibition", "carnival", "festival", "jubilee", "celebration",
      "gathering", "fete"
    ];
    const people = [
      "great and the good", "nobility", "local elders", "foreign dignitaries",
      "spiritual leaders", "suspected revolutionaries"
    ];
    const socialType = ra(socialTypes);

    const name = `${burgName} ${socialType}`;
    const legend = `A ${socialType} has been organised at ${burgName} as a chance to gather the ${ra(
      people
    )} of the area together to be merry, make alliances and scheme around the crisis.`;
    this.notes.push({id, name, legend});
  }

  private listMirage({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.biome[i] === 1);
  }

  private addMirage(id: string, _cell: number) {
    const adjectives = ["Entrancing", "Diaphanous", "Illusory", "Distant", "Perculiar"];

    const mirageAdjective = ra(adjectives);
    const name = `${mirageAdjective} mirage`;
    const legend = `This ${mirageAdjective.toLowerCase()} mirage has been luring travellers out of their way for eons.`;
    this.notes.push({id, name, legend});
  }

  private listCaves({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addCave(id: string, cell: number) {
    const {cells} = this.pack as any;

    const formations = {
      Cave: 10,
      Cavern: 8,
      Chasm: 6,
      Ravine: 6,
      Fracture: 5,
      Grotto: 4,
      Pit: 4,
      Sinkhole: 2,
      Hole: 2
    };
    const status = {
      "a good spot to hid treasure": 5,
      "the home of strange monsters": 5,
      "totally empty": 4,
      "endlessly deep and unexplored": 4,
      "completely flooded": 2,
      "slowly filling with lava": 1
    };

    let formation = rw(formations) as string;
    const toponym = this.Names.getCulture(cells.culture[cell]);
    if (cells.biome[cell] === 11) {
      formation = "Glacial " + formation;
    }
    const name = `${toponym} ${formation}`;
    const legend = `The ${name}. Locals claim that it is ${rw(status)}.`;
    this.notes.push({id, name, legend});
  }

  private listPortals({burgs}: any) {
    return burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({cell}: any) => !this.occupied[cell])
      .map((burg: any) => burg.cell);
  }

  private addPortal(id: string, cell: number) {
    const {cells} = this.pack as any;
    const burgs = (this.pack as any).burgs;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;

    const name = `${burgName} Portal`;
    const legend = `An element of the magic portal system connecting major city. The portals were installed centuries ago, but still work fine.`;
    this.notes.push({id, name, legend});
  }

  private listRifts({cells}: any) {
    return cells.i.filter(
      (i: number) =>
        !this.occupied[i] && cells.pop[i] <= 3 && this.biomesData.habitability[cells.biome[i]]
    );
  }

  private addRift(id: string, _cell: number) {
    const types = ["Demonic", "Interdimensional", "Abyssal", "Cosmic", "Cataclysmic", "Subterranean", "Ancient"];

    const descriptions = [
      "all known nearby beings to flee in terror",
      "cracks in reality itself to form",
      "swarms of foes to spill forth",
      "nearby plants to wither and decay",
      "an emmissary to step through with an all-powerful relic"
    ];

    const riftType = ra(types);
    const name = `${riftType} Rift`;
    const legend = `A rumoured ${riftType.toLowerCase()} rift in this area is causing ${ra(descriptions)}.`;
    this.notes.push({id, name, legend});
  }

  private listDisturbedBurial({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 2);
  }

  private addDisturbedBurial(id: string, _cell: number) {
    const name = "Disturbed Burial";
    const legend = "A burial site has been disturbed in this area, causing the dead to rise and attack the living.";
    this.notes.push({id, name, legend});
  }

  private listNecropolis({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] < 2);
  }

  private addNecropolis(id: string, cell: number) {
    const {cells} = this.pack as any;

    const toponym = this.Names.getCulture(cells.culture[cell]);
    const type = rw({
      Necropolis: 5,
      Crypt: 2,
      Tomb: 2,
      Graveyard: 1,
      Cemetery: 2,
      Mausoleum: 1,
      Sepulchre: 1
    });

    const name = `${toponym} ${type}`;
    const legend = ra([
      "A foreboding necropolis shrouded in perpetual darkness, where eerie whispers echo through the winding corridors and spectral guardians stand watch over the tombs of long-forgotten souls.",
      "A towering necropolis adorned with macabre sculptures and guarded by formidable undead sentinels. Its ancient halls house the remains of fallen heroes, entombed alongside their cherished relics.",
      "This ethereal necropolis seems suspended between the realms of the living and the dead. Wisps of mist dance around the tombstones, while haunting melodies linger in the air, commemorating the departed.",
      "Rising from the desolate landscape, this sinister necropolis is a testament to necromantic power. Its skeletal spires cast ominous shadows, concealing forbidden knowledge and arcane secrets.",
      "An eerie necropolis where nature intertwines with death. Overgrown tombstones are entwined by thorny vines, and mournful spirits wander among the fading petals of once-vibrant flowers.",
      "A labyrinthine necropolis where each step echoes with haunting murmurs. The walls are adorned with ancient runes, and restless spirits guide or hinder those who dare to delve into its depths.",
      "This cursed necropolis is veiled in perpetual twilight, perpetuating a sense of impending doom. Dark enchantments shroud the tombs, and the moans of anguished souls resound through its crumbling halls.",
      "A sprawling necropolis built within a labyrinthine network of catacombs. Its halls are lined with countless alcoves, each housing the remains of the departed, while the distant sound of rattling bones fills the air.",
      "A desolate necropolis where an eerie stillness reigns. Time seems frozen amidst the decaying mausoleums, and the silence is broken only by the whispers of the wind and the rustle of tattered banners.",
      "A foreboding necropolis perched atop a jagged cliff, overlooking a desolate wasteland. Its towering walls harbor restless spirits, and the imposing gates bear the marks of countless battles and ancient curses."
    ]) as string;

    this.notes.push({id, name, legend});
  }

  private listEncounters({cells}: any) {
    return cells.i.filter((i: number) => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 1);
  }

  private addEncounter(id: string, cell: number) {
    const name = "Random encounter";
    const encounterSeed = cell; // use just cell Id to not overwhelm the Vercel KV database
    const legend = `<div>You have encountered a character.</div><iframe src="https://deorum.vercel.app/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    this.notes.push({id, name, legend});
  }
}
