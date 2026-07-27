/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/06/2026, 19:11:10
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasDemo.tsx, components/Worldforge/SpawnPreview.tsx, systems/worldforge/adapter/atlasArtifact.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/index.ts, systems/worldforge/local/resolveSpawn.ts, systems/worldforge/local/unifyMapBiomes.ts, systems/worldforge/region/generateRegion.ts, systems/worldforge/world/createWorld.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file generateWorld.ts — headless entry for the ported FMG world, slice 3
 * (Worldforge build-order item 2c): everything generateFmgAtlas produces,
 * plus the civilization layer — ice, cell ranking, cultures, burgs, states
 * (with campaigns/diplomacy/forms), routes, religions, provinces and
 * river/lake names.
 *
 * Orchestration order is FMG's own (upstream public/main.js `generate()`),
 * continuing exactly where generateAtlas stops:
 *    ... Features.defineGroups()       (slice 2, via generateFmgAtlas)
 *    18. Ice.generate()                (reseeds Alea(seed), P/rand draws)
 *    19. rankCells()                   (draw-free)
 *    20. Cultures.generate()
 *    21. Cultures.expand()
 *    22. Burgs.generate()
 *    23. States.generate()
 *    24. Routes.generate()             (draw-free)
 *    25. Religions.generate()
 *    26. Burgs.specify()
 *    27. States.collectStatistics()    (draw-free)
 *    28. States.defineStateForms()
 *    29. Provinces.generate()          (reseeds Alea(seed))
 *    30. Provinces.getPoles()          (draw-free)
 *    31. Rivers.specify()
 *    32. Lakes.defineNames()
 *    33. Military.generate()           (no reseed; rand/gauss note draws)
 *    34. Markers.generate()            (no reseed; placement/legend draws)
 *    35. Zones.generate()              (no reseed; count/placement draws)
 *    36. generateForests()             (Aralia pass, OWN SeededRandom stream
 *                                       — zero shared-stream draws, additive)
 *    37. generateMountains()           (Aralia pass, OWN SeededRandom stream
 *                                       — zero shared-stream draws, additive)
 * The only remaining upstream stage — Names.getMapName — is NOT ported
 * (map-title UI; it runs strictly after stage 35, so omitting
 * them cannot affect any ported draw).
 *
 * RNG CONTRACT: Ice.generate's `Math.random = Alea(seed)` is the LAST reseed
 * before the whole cultures→religions chain (none of stages 19-28 reseeds),
 * so the entire civilization layer consumes Ice's stream — that is why Ice
 * is ported although nothing reads pack.ice yet. Provinces.generate reseeds
 * Alea(seed) again (upstream localSeed === seed in the default pipeline) and
 * Rivers.specify/Lakes.defineNames continue on that stream.
 *
 * pack.cells.q: upstream reGraph builds the d3-quadtree spatial index; the
 * slice-2 reGraph port stripped it ("port it with the first stage that needs
 * it") — Routes.getPoints needs it (findClosestCell), so this runner builds
 * the identical index here, leaving reGraph.ts untouched.
 *
 * NOT REPRODUCED (same stance as slices 1-2): upstream randomizeOptions()
 * randomizes the UI inputs per map on the separate UI-only aleaPRNG stream.
 * They are explicit typed options instead (see FmgWorldOptions), defaulting
 * to the center of upstream's randomization distribution.
 */
import { type FmgAtlasOptions, type FmgAtlasResult } from "./generateAtlas";
import type { NameBase } from "./name-bases";
import { type CulturesSet } from "./cultures-generator";
import { type MapNote, type MilitaryUnit } from "./military-generator";
import { type Marker } from "./markers-generator";
import { type Zone } from "./zones-generator";
import { type EnsureIslandHarborsReport } from "./ensureIslandHarbors";
export interface FmgWorldOptions extends FmgAtlasOptions {
    /**
     * Number of cultures (upstream `culturesInput`). Upstream randomizes it
     * per map via gauss(12, 3, 5, 30) on the UI-only aleaPRNG stream (not
     * reproduced); default 12 is that distribution's center. Capped by the
     * culture set's data-max (32 for "world").
     */
    culturesNumber?: number;
    /**
     * Culture set (upstream `culturesSet` select). Upstream randomizes it via
     * a weighted pick (world 10, european 10, oriental 2, english 5, antique 3,
     * highFantasy 11, darkFantasy 3, random 1) on the UI-only stream (not
     * reproduced); default "world" is the select's static default.
     */
    culturesSet?: CulturesSet;
    /**
     * Number of states/capitals (upstream `statesNumber`, a.k.a. "regions").
     * Upstream randomizes gauss(18, 5, 2, 30) on the UI-only stream (not
     * reproduced); default 18 is the center.
     */
    statesNumber?: number;
    /**
     * Provinces ratio in % (upstream `provincesRatio`). Upstream randomizes
     * gauss(20, 10, 20, 100) on the UI-only stream (not reproduced); default
     * 20 is the center (also the distribution's min).
     */
    provincesRatio?: number;
    /**
     * Number of towns (upstream `manorsInput`); 1000 means "auto" (scaled from
     * populated-cell count), which is upstream's default and what
     * randomizeOptions always resets to.
     */
    manorsNumber?: number;
    /**
     * Number of organized religions (upstream `religionsNumber`). Upstream
     * randomizes gauss(6, 3, 2, 10) on the UI-only stream (not reproduced);
     * default 6 is the center.
     */
    religionsNumber?: number;
    /**
     * States/cultures size variety (upstream `sizeVariety`, drives
     * expansionism randomization). Upstream randomizes gauss(4, 2, 0, 10, 1)
     * on the UI-only stream (not reproduced); default 4 is the center.
     */
    sizeVariety?: number;
    /**
     * Growth rate (upstream `growthRate`, caps state/religion expansion cost).
     * Upstream randomizes rn(1 + Math.random(), 1) — uniform [1, 2] — on the
     * UI-only stream (not reproduced); default 1.5 is the center.
     */
    growthRate?: number;
    /**
     * Emblem shape (upstream `emblemShape` select). "culture" (default),
     * "random" and "state" are the Diversiform modes; any other value is a
     * fixed shield name used for every coat of arms.
     */
    emblemShape?: string;
    /**
     * Current in-world year (upstream `options.year`, used by state
     * campaigns/wars chronology). Upstream draws rand(100, 2000) on the
     * UI-only stream (not reproduced); default 1050 is the center.
     */
    year?: number;
    /**
     * Era name + short form (upstream `options.era`/`eraShort`, regiment-note
     * text only). Upstream generates the era from a name base on the UI-only
     * stream (not reproduced); plain typed options instead.
     */
    era?: string;
    eraShort?: string;
    /**
     * People per population point (upstream `populationRateInput`,
     * default 1000) — scales regiment troop totals.
     */
    populationRate?: number;
    /** Urban population multiplier (upstream `urbanizationInput`, default 1). */
    urbanization?: number;
    /** Military unit roster (upstream `options.military`); defaults to FMG's. */
    militaryUnits?: MilitaryUnit[];
    /**
     * Maritime reachability pass. Default is true (owner-approved 2026-06-26):
     * significant islands without a port receive one after the FMG pipeline so
     * every landmass is reachable by sea in real games. Pass false to reproduce
     * pre-approval golden worlds or to isolate RNG-order tests.
     */
    ensureIslandHarbors?: boolean;
}
export interface FmgWorldResult extends FmgAtlasResult {
    /** The name bases the Markov name generator used (upstream `nameBases`). */
    nameBases: NameBase[];
    /** Map notes generated so far (upstream global `notes`; regiment + marker legends). */
    notes: MapNote[];
    /** The military unit roster used (upstream `options.military`). */
    militaryOptions: MilitaryUnit[];
    /** Points of interest (upstream `pack.markers`; also reachable via pack). */
    markers: Marker[];
    /** Event/danger areas (upstream `pack.zones`; also reachable via pack). */
    zones: Zone[];
    /** Report from the optional maritime reachability pass, when enabled. */
    islandHarborReport?: EnsureIslandHarborsReport;
}
/**
 * Generate the full FMG world (slices 1 + 2 + 3) headlessly.
 * Deterministic: the same seed + options always produce the same pack,
 * including cultures, burgs, states, routes, religions and provinces.
 * `generateFmgBase` and `generateFmgAtlas` remain available and unchanged.
 */
export declare function generateFmgWorld(seed: string, options?: FmgWorldOptions): FmgWorldResult;
