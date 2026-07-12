# Mountains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Named ranges/peaks/passes as first-class world data, elevation that matters in travel (climb costs, revived mountain biomes, revived trip events), mountain relief glyphs in both 2D renderers, and real high country in 3D (elevation curve, ridges, snow, tree line, restored shading).

**Spec:** `docs/superpowers/specs/2026-07-11-mountains-design.md` — read it first.

**Architecture:** A `mountainsPass` (structural clone of `forestsPass`: own seeded stream, additive, stage 37 after forests) builds `pack.ranges`/`pack.peaks`/`pack.passes`; consumers follow the campaign patterns exactly — label kinds, glyph module, biomeForCell escalation slot, readout opts, tunables module. Travel gains one edge hook (`climbFactor`). The dead `travelEventService` is revived behind a seeded wrapper on the committed-trip path. 3D work splits into a safe fixes task (bug/snow/ice/slope) and the curve+ridge task (the one world-look change).

**Tech Stack:** TypeScript, Vitest, React SVG + canvas, three.js/R3F. No new dependencies.

## Global Constraints

- **NO manual git commits/branches.** Auto-snapshot repo; "Commit" steps = run tests + `npx tsc --noEmit` (baseline ~520, zero errors mentioning touched files).
- **Agora:** controller locks; implementers run no Agora commands, touch only allowed files.
- **World-preservation doctrine (BINDING):** no `Math.random`/`rw`/`gauss`/`P`/`Names.*` in world-gen paths; own streams (`SeededRandom`, `nextInt` MAX-EXCLUSIVE); all pack fields additive; fmgWorld frozen goldens byte-identical (the net that held 22 tasks across two campaigns).
- Thresholds (verbatim from spec): RANGE_MIN_H 50, RANGE_MIN_CELLS 5, PEAK_MIN_H 70, PEAKS_PER_RANGE_MAX 4; escalation h≥70 non-peak → `mountain_alpine`, peak cells → `mountain_crag`, 50–70 in-range → `highland_plateau`, enclosed <50 pockets → `highland_vale`; Glacier index 11 keeps `mountain_glacier`; forest haunted/fey escalation WINS over elevation.
- Climb: `climbFactor = 1 / (1 + CLIMB_ASCENT_PER_H·max(0,Δh) + CLIMB_DESCENT_PER_H·max(0,−Δh))`, ascent 0.05, descent 0.015; tier softening: highway/road ×0.5 on Δh, trail ×0.75, path/off-route ×1.
- Trip events: ONE roll per committed land trip (Remy ruling), `TRIP_EVENT_CHANCE = 0.25`, seeded `(worldSeed, destCellId)` navDrift-style; sea trips exempt.
- 3D curve: `elevationFt(n) = 2000·n + (max(0, n − 0.5)/0.5)^2.2 × 5000` (C1 at the knee; n≤0.5 byte-identical to today; 7,000 ft at n=1).
- US-English plain comments; `git add -N` untracked files before review diffs.
- Background noise: ~346 empty test files, dev_hub build failure, transient failures in OTHER campaigns' mid-edit files (interior/dungeon/town) — verify in isolation before attributing.

## File Structure

- Create `src/systems/worldforge/mountains/mountainTunables.ts`, `mountainClusters.ts` (pure ranges/peaks/naming), `mountainsPass.ts` (world-gen pass + passes detection), `rangeForCell.ts` (cell→range/peak/pass lookups, WeakMap-cached like forestKindForCell).
- Create `src/components/Worldforge/mountainGlyphs.ts`; `src/systems/travel/tripEvents.ts`.
- Modify: `generateWorld.ts` (stage 37), `features.ts` (Pack fields), `artifacts.ts` + `adapter/atlasArtifact.ts` (AtlasRange/Peak/Pass), `atlasSvg.ts`/`AtlasSvgView.tsx`/`AtlasLayers.tsx`/`atlasDraw.ts` (labels + glyphs), `biomeForCell.ts`, `routeTerrain.ts` + `routePlanning.ts` + `atlasTravelGraph.ts` + `multiModalAtlasGraph.ts` (climb + nav), `travelEventService.ts` (rng param), `travelReadout.ts` + `MapPane.tsx` + `App.tsx` (pass naming + trip events), `generateLocal.ts` (curve, tree line, ice material), `generateRegion.ts` (ridge component), `groundWorldAdapter.ts` + `terrainColor.ts` + `groundChunkLoader.ts` (ice/snow/shading/slope), `forestTunables`-adjacent: forest label priority 3→4 move lives in `atlasSvg.ts` constants.

---

### Task 1: mountainTunables + pure clustering/naming core

**Files:** Create `src/systems/worldforge/mountains/mountainTunables.ts`, `src/systems/worldforge/mountains/mountainClusters.ts`; Test `src/systems/worldforge/mountains/__tests__/mountainClusters.test.ts`.

**Interfaces (produces — later tasks import EXACTLY these):**
- `RangeKind = 'range' | 'highlands' | 'volcanic'`
- `RangeCluster { id: number; cellIds: number[]; coreCells: number[]; seedCell: number }` (core = h≥PEAK_MIN_H)
- `clusterRangeCells(h: ArrayLike<number>, neighbors: (c:number)=>number[], cellCount: number): RangeCluster[]` — flood-fill `h >= RANGE_MIN_H` land cells (h≥20 is implied by ≥50), drop < RANGE_MIN_CELLS, seedCell = lowest id, ordered by seedCell.
- `findPeaks(cluster: RangeCluster, h: ArrayLike<number>, neighbors): number[]` — cells in cluster with `h >= PEAK_MIN_H` strictly greater than ALL neighbors; sorted by h desc then id asc; capped PEAKS_PER_RANGE_MAX.
- `rangeKindOf(cluster, hasVolcanoCell: (c:number)=>boolean): RangeKind` — volcanic if any cluster cell has a volcano; highlands if coreCells empty; else range.
- `nameRange(kind: RangeKind, cultureAdjective: string, rng: SeededRandom): string`, `namePeak(cultureAdjective, rng)`, `namePass(stem: string, rng)` — banks in tunables: range [Spine, Reach, Range, Heights, Teeth, Crags, Wall]; highlands [Downs, Highlands, Moors, Fells]; volcanic [Furnace, Anvil, Ashreach, Cinderwall]; peak forms ["Mount <Adj>", "<Adj> Peak", "<Adj> Horn", "<Adj> Tor", "<Adj> Fang"] (rng picks the FORM then formats); pass [Pass, Gap, Col, Saddle] → `"<stem> <word>"`.
- Tunables (exact): RANGE_MIN_H 50, RANGE_MIN_CELLS 5, PEAK_MIN_H 70, PEAKS_PER_RANGE_MAX 4, HIGHLAND_NAV_DC_BUMP 3, CLIMB_ASCENT_PER_H 0.05, CLIMB_DESCENT_PER_H 0.015, CLIMB_TIER_SOFTEN {highway:0.5, road:0.5, trail:0.75, path:1}, TRIP_EVENT_CHANCE 0.25, TRIP_EVENT_DRAMA (ordered priority list: ['mountain_crag','mountain_alpine','mountain_glacier','forest_haunted','forest_fey','highland_vale','wetland_marsh','desert_dune'] — first legacy id crossed wins; else the route's most-crossed non-plain id; else 'general'), MOUNTAIN_MAX_ELEV_FT 7000, RIDGE_START_N 0.55, RIDGE_AMPLITUDE 0.25, RIDGE_SPAN_FT 2500, TREELINE_N {cold: 0.55, temperate: 0.62, none: 1.1} (biome→class table in the same file: taiga/tundra/glacier cold; tropical ids none; else temperate), SNOW_LINE_H 55 (encoded-height units), SNOW_RGB [0.92,0.93,0.95], ICE_RGB [0.86,0.90,0.95], glyph bands (peak ≥70 caret, hill 50–70 chevron, snow-tip ≥80), GLYPH sizes/zoom reuse forest constants pattern, label constants (RANGE_LABEL_* small-caps spec: font min 10 max 18, priority 3; PEAK_LABEL font 8 priority 5 min zoom 2.2; FOREST label priority moves to 4 — constant lives here as RANGE_LABEL_PRIORITY=3/PEAK=5 and Task 3 edits atlasSvg's forest entry).

TDD steps as the forests Task 1 (crafted strip fixtures; determinism; peak strictness incl. plateau-tie case → NO peak on ties; volcanic/highlands kind rules; naming shapes). Gates: new test file green; tsc.

### Task 2: mountainsPass — pack.ranges/peaks + marker-name adoption + artifacts

**Files:** Create `src/systems/worldforge/mountains/mountainsPass.ts`; Modify `generateWorld.ts` (stage 37, directly after `generateForests`), `features.ts` (Pack: `ranges?: PackRange[]; peaks?: PackPeak[]; passes?: PackPass[]` — passes typed now, filled Task 4), `artifacts.ts` + `adapter/atlasArtifact.ts` (`AtlasRange {id,name,kind,cellIds,coreCellIds,pole}`, `AtlasPeak {id,rangeId,cellId,h,name}`, `AtlasPass {id,rangeId,cellId,name,routeIds}` + artifact fields + mapping, pole via feetFromFmgPixel like forests). Test: `__tests__/mountainsPass.test.ts` + fmgWorld extension.

**Key resolutions:** `generateMountains(pack, seed)` — own stream `hash(seed) ^ 0x4d6f756e` ("Moun"); draw order: range kinds need NO draws → names (range then peaks, cluster id order) → (passes are Task 4, RNG-free). Culture adjective = raw culture name (getAdjective is IMPURE — forests precedent). **Peak name adoption:** before rolling a fresh name, if the peak cell or a direct neighbor carries a marker of type `volcanoes`/`sacred-mountains`, adopt that marker's note name — find the note via the marker's id (READ the markers generate loop for the exact note-id template — it is the `id` string passed to each `add(id, cell)`; grep `add(` call in the config runner); pure string reuse, no draws, and SKIP the rng name draw for adopted peaks (document: adoption changes the draw count per range — the stream-mirror test pins the real sequence). Geographic-suffix dedup for ranges (forests helper pattern — reimplement locally or export the forests one; prefer EXPORTING `dedupeNamesGeographic` from a shared `src/systems/worldforge/naming/dedupe.ts` moved out of forestsPass with forestsPass re-importing it — a small sanctioned refactor, zero behavior change, stream-mirror tests must stay green UNMODIFIED). Pole via `getPolesOfInaccessibility` keyed on range id.
**Gates:** additive proof — every pre-existing fmgWorld golden byte-identical; forests suite untouched green (the dedupe move's proof); determinism signature extends to ranges/peaks.

### Task 3: Range + peak labels

**Files:** Modify `atlasSvg.ts` (LabelKind + 'range'/'peak', buildLabels reads pack.ranges/peaks, LABEL_FONT/PRIORITY/RENDER_DY entries, **forest priority 3→4**, declutter `rangeMinScale ?? 1.0` / `peakMinScale ?? 2.2`), `AtlasSvgView.tsx` (render styling: range = letter-spaced small-caps grey-brown `RANGE_LABEL_COLOR` from tunables; peak = tiny `▲ ` prefix). Test: label test file (existing forest-label tests must keep passing with priority 4 — update the ONE priority assertion intent-preserving, traced).
Area-scaled range font via the forests fontSize override (already in the pipeline). Peaks: flat font 8.

### Task 4: Passes — detection + readout naming

**Files:** Modify `mountainsPass.ts` (`detectPasses(pack)` RNG-FREE, called last in generateMountains), `travelReadout.ts` (`opts.passName?: string` → append `· via <Name>`; when both forestName and passName present, pass WINS and forest clause is dropped — one flavor clause max), `MapPane.tsx` + `AtlasSvgView.tsx` (thread `passNameForRoute` exactly like `forestNameForRoute` — same memo/prop pattern), `rangeForCell.ts` (create: `lookupRangesForAtlas(atlas)`, `passNameOnRoute(pack, routeCells): string | null` — first pass cell crossed wins). Tests: crafted detection (profile local-max per contiguous range run; shared-cell dedup keeps all routeIds; no-crossing route → none), readout ordering, fmgWorld: every detected pass cell has h≥RANGE_MIN_H and lies on its route.
**Detection (verbatim rule):** for each route in `highways|roads|trails`: walk cellIds; runs where `rangeIdOf(cell) != null`; per run take the max-h cell (tie → lowest id); candidates dedup by cellId across routes (merge routeIds). Name: nearest peak in the same range within 3 BFS steps → peak stem (strip "Mount "/suffix word) else range name first word; `namePass(stem, rng)` — WAIT, RNG-free constraint: use deterministic pick `PASS_WORDS[cellId % PASS_WORDS.length]` instead of rng (document; keeps detectPasses draw-free so it can run after adoption-affected naming without stream coupling).

### Task 5: Elevation biome escalation

**Files:** Modify `biomeForCell.ts` (escalation order: forest haunted/fey → ELEVATION → plain), `rangeForCell.ts` (add `elevationClassForCell(atlas, cellId): 'crag'|'alpine'|'plateau'|'vale'|null` — peak cells crag; h≥70 alpine; 50–70 in a named range plateau; enclosed <50 pocket fully-surrounded-by-range-cells vale; else null; WeakMap-cached alongside range lookup; Glacier index 11 returns null — keeps mountain_glacier via plain mapping). Tests: reachability per new id on crafted atlas + real-world probe; byte-identity outside highland; haunted forest at h75 stays forest_haunted.

### Task 6: Climb cost + nav bumps

**Files:** Modify `routePlanning.ts` (TravelGraph `climbFactor?: (from: number, to: number) => number`; minutesOf factor branch: `const factor = base * (graph.climbFactor?.(from, to) ?? 1)`), `routeTerrain.ts` (export `climbFactorFor(dh: number, tier: RouteTier | null): number` implementing the Global-Constraints formula + tier softening on Δh), `atlasTravelGraph.ts` (wire `climbFactor` using `cells.h` + tier map; ALSO nav bumps in `buildNavInfoFn`: off-route h≥70 → dc = max(dc, 15); off-route 50–70 → dc += HIGHLAND_NAV_DC_BUMP when dc>0... NO: when dc>0 only would skip open cells — spec says open 50-70 becomes DC 8: apply `dc = dc === 0 ? 0 : dc + bump` for on-route? Spec: "On-route tiers keep their ladder". EXACT rule: if cell has NO tier (off-route): h≥70 → dc=15; 50≤h<70 → dc+=3. Tiered cells unchanged.), `multiModalAtlasGraph.ts` (edgeMinutes folds `climbFactorFor(h[to]-h[from], tier)` on land legs). Tests: factor math (ascent/descent asymmetry, tier softening), both-graphs agreement extension, planner-preference (crafted graph: pass route beats direct scramble), nav bump cases, haunted-forest bump styles compose (forest bump + elevation rule: take the MAX dc then forest +2 — order: compute base dc (tier/biome/elevation) then forest bump as today).

### Task 7: Trip-event revival

**Files:** Modify `travelEventService.ts` (optional `rng?: () => number` param — replaces the two `Math.random()` calls when provided; default preserves today), Create `src/systems/travel/tripEvents.ts`:
```ts
export interface TripEventOutcome { message: string; extraSeconds: number }
export function rollTripEvent(
  routeCells: number[],
  biomeIdOf: (cell: number) => string | undefined,
  partyCheckTotal: (skill: string) => number, // d20 roll + party's best modifier, caller-seeded
  rng: SeededRandom,
): TripEventOutcome | undefined
```
— governing id via TRIP_EVENT_DRAMA priority scan; `generateTravelEvent(id, TRIP_EVENT_CHANCE, undefined, () => rng.next())`; null → undefined; skillCheck events resolve via `partyCheckTotal(skill) >= dc` picking success/failure branch (message = event description + branch description; extraSeconds = branch/base effect `delay` hours × 3600, else 0); non-check events use base effect. Modify `MapPane.tsx`: at BOTH commit sites (beside deriveNavDrift), land trips only: `rollTripEvent(route.cells, (c) => biomeIdForCell(worldforgeSeed ?? 0, c), partyCheckFn, new SeededRandom((worldforgeSeed ?? 0) + destCellId * 9973 + 41))`; partyCheckFn generalizes the existing partySurvivalModifier pattern (read MapPane 140-160: best member modifier per skill via the skills index skill→ability + proficiency — extract `partyCheckTotalFn(party)` into tripEvents.ts consuming a minimal party shape, unit-testable). Thread outcome through travelMeta as `tripEvent?: { message: string; extraSeconds: number }`; Modify `types/travelMeta.ts` (field + doc) and `App.tsx` (apply extraSeconds into ADVANCE_TIME sum beside navDrift's, announce message — mirror announceNavDrift). Tests: seeded determinism, drama priority, check resolution both branches, sea exemption (caller-guarded — assert MapPane guard via the hasSeaLeg flag already in scope), chance gate.

### Task 8: mountainGlyphs pure module

**Files:** Create `src/components/Worldforge/mountainGlyphs.ts` + test. forestGlyphs template EXACTLY (hash placement, PIP, Path2D-safe strings): `cellReliefGlyphs(cellId, poly, h, kind: 'peak'|'hill')` → 1–2 glyphs; `reliefGlyphPath(g, x, y, s, snowTip: boolean)` — peak caret = two strokes `M..L..L..` (∧ shape) + optional detached tip stroke gap when snowTip (h≥80); hill chevron = one soft arc stroke. Band from h: ≥70 peak, 50–70 hill. Deterministic; sizes scale with h.

### Task 9: Glyph + pass-mark wiring, both renderers

**Files:** Modify `atlasSvg.ts` (buildReliefGlyphs → model layer; cells h≥50 ALL land cells — height-truth, not range-gated; UNDER forestGlyphs layer), `AtlasLayers.tsx` (render between biome fill and forest glyphs; stroke ink `#3d3833`, no fill for chevrons, snow tip stroke `#ffffff` when flagged; zoom via the forest CSS-var pattern — new var `--relief-glyph-opacity`, view side sets both), `atlasDraw.ts` (canvas stamping beside forest glyphs, same ramp), pass marks: paired chevron glyph at pass cells rendered in the ROUTES layer group (after route strokes; both renderers) from `pack.passes`. Tests: builder determinism/band gating/pass marks presence; existing suites unshifted.

### Task 10: 3D safe fixes — shading bug, slope, snow, ice, tundra

**Files:** Modify `groundChunkLoader.ts` `sampleGroundChunk` (fix `biomeColor(biomeId, height / 100)` → `biomeColor(biomeId, height, slope01)` computing `slope01` per sample from the heights grid finite difference normalized like chunkGeometry's `1−ny` convention — derive: `slope01 = min(1, gradMagnitude * SLOPE01_SCALE)` with SLOPE01_SCALE calibrated so the chunkGeometry normal-path and this agree within test tolerance on a crafted ramp; then SNOW blend: `if (heights[idx] >= snowLineH) lerp toward SNOW_RGB by min(1,(h-snowLineH)/SNOW_BAND 12)` where `snowLineH` resolves from the anchor cell's atlas latitude band via the canopy-resolution seam (3 bands: polar |lat|>60° line 35, temperate 25–60° line 55, tropical <25° line 75 — atlas y → latitude via the pack's mapCoordinates if present, else graph-height proportion; READ how latitude is derivable — FMG packs carry `mapCoordinates {latN, latS}`; fall back to y-proportion 90..-90 and document)), `generateLocal.ts` (glacier profile `ground: 'ice'` — add `'ice'` to TerrainMaterial union in artifacts.ts + MAT enum + materials list; tundra profile stays dirt BUT adapter maps a NEW entry), `groundWorldAdapter.ts` (MATERIAL_BIOME + `ice: 'ice'`), `terrainColor.ts` (PALETTE + `ice: [0.86, 0.90, 0.95]`, `snow` NOT needed as palette id — snow is the blend above; tundra stays as-is this task). Tests: unit-bug regression (shade at height 30 differs ≥10% from height 5 — dead today), slope01 agreement on crafted ramp, snow blend bands, ice material end-to-end (glacier window → ice palette color), goldens: local-golden materialHash SHIFTS for glacier fixtures only — traced; all other windows byte-identical (the /100→raw + slope changes VERTEX COLORS not materials — biomeColors arrays shift everywhere: assert terrain MESH (positions) byte-identical and trace the color change as the intended fix).

### Task 11: 3D curve + ridge synthesis + tree line

**Files:** Modify `generateLocal.ts` (elevation curve per Global Constraints — ONLY the `elevationFt[i] =` line changes to `elevationCurveFt(n)` (new exported pure fn beside it); tree line: tree placeKind keep gains `&& normalized[cellAt(fx,fy)] <= treelineN` — compose with the forests clearingKeep via a combined keep closure; treelineN from TREELINE_N by the window biome's temperature class), `generateRegion.ts` (after the octave loop, add the MOUNTAIN RIDGE component: domain-warped ridged world-feet noise, span RIDGE_SPAN_FT, warp = two aux noises ±0.35·span; `ridgeBoost = smoothstep01((baseH − RIDGE_START_N)/0.45)`; `samples[i] += ridgeNoise * RIDGE_AMPLITUDE * ridgeBoost` — world-seed-keyed (`worldSeed ^ 0x52444745`), seam-safe by world-feet indexing; then existing clamp pass re-applies), Test: curve unit tests (C1 continuity at 0.5 numeric check, n≤0.5 byte-identity, 7000 at 1.0, monotonic), ridge determinism + boost-gating (lowland sample unchanged), treeline (trees absent above the line in a crafted high window; taiga line lower than temperate), goldens: local/region goldens SHIFT for high-n fixtures — every shift traced to curve/ridge; LOWLAND fixtures (towns) must stay within ±2 ft (the invariance test: craft n≤0.5 window, assert elevationFt byte-identical).
**This is the world-look task: DONE_WITH_CONCERNS unless lowland invariance is proven.**

### Task 12: Verification sweep + visual proof (controller-run)

- Full targeted run (worldforge + travel + Worldforge + World3D + services) + tsc baseline.
- 2D captures: Cartographer + startselect — relief carets/chevrons, range labels, pass marks, snow-tipped peaks; forest layering intact. Send Remy.
- 3D captures: town3d harness health; best-effort mountain-window ground capture (worldGenCore test path can render headless? use the playwright world3d sandbox if it now shows worldforge ground — else record the live-look gap as before). Snow/ice/glacier window proof via the pure-test palette assertions + any capturable window.
- Trip-event + climb sanity: unit outputs quoted in the report (a pass-crossing route's minutes vs pre-campaign; a rolled mountain event message).
- Docs: spec status/Open, planmap statuses, ledger, memory. Final whole-campaign review (opus) precedes this task's close-out — dispatch it after Task 11 review lands.

## Self-review

- Spec coverage: slice 1 → T1–3; slice 2 → T4; slice 3 → T5–7; slice 4 → T8–9; slice 5 → T10–11; proof → T12. Forest-priority move → T3. Dedupe-share refactor → T2. All covered.
- Placeholder scan: discovery steps are bounded with stated rules (note-id template, latitude derivation, SLOPE01 calibration); no TBDs.
- Type consistency: RangeCluster/PackRange/AtlasRange/rangeForCell exports/climbFactorFor/TripEventOutcome names used consistently across tasks; `elevationCurveFt` defined T11 and used only there; `snowLineH` local to T10.
