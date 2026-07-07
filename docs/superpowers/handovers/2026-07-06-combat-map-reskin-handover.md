# Handover — 2D combat map reskin (BATTLE MAP)

**Date:** 2026-07-06
**Plan-map node:** `combat-map-reskin` (campaign `ui`, status `active`) in `public/planmap/topics.json`; related `svg-combatant-art` (parked).
**Goal (set via /goal):** "rework the 2D combat map to resemble the BATTLE MAP reference UI" — a premium, painted, Roll20/Foundry-style tactical screen. Reference is a Stitch mock: `web application/stitch/projects/8540300297328151962/screens/17042917865731031245` (no Stitch MCP tools are exposed; work from the image the user pasted — it shows an illustrated forest map, portrait tokens, and a full combat HUD).

---

## 1. What the mission is

Make the **2D combat map** (`CombatView` in 2D render mode) look like the reference image. The reference is essentially: a hand-painted forest battle map + circular portrait tokens + a rich fantasy HUD (party/enemy rail, turn order, action economy, ability grid, combat log, intent-preview card).

The **UI frame** now matches the reference well. The **art** (painted map + character tokens/portraits) is the remaining gap and is partly a different kind of work (procedural generation, not CSS).

## 2. What is DONE (this is solid, verified, tests green)

**Chrome / layout reskin** — matches the reference structure:
- Header toolbar: `⚜ Battle Map ⚜` (Cinzel gold) + biome pill + **New Map** (green) / **End Turn** (orange) / **3D View** (indigo) + **End Battle** (red).
- Left rail: PARTY + ENEMIES cards (ornate theme, two-line names, HP bars, action-economy icons, movement, AI toggle, active-turn glow ring).
- Center: gold-framed grid with **A–P row / 1–20 column rulers** and a **Move / Destination / Attack / Area Effect / Line of Sight legend**; the whole board **fit-scales** to the pane.
- Right rail, in reference order: **Turn Order → Actions (+ Movement bar) → Abilities → Combat Log**.
- **Intent Preview** card floats over the map bottom-right while targeting (ability icon, cost, range, follow-up, description).
- Shared visual tokens live in `combatUiTheme.ts`.

**3D lazy-split** — `CombatView` now `React.lazy`-loads `BattleMap3D` and `InPlaceCombatScene`, so the 2D path no longer statically imports the three.js/TSL graph. This was also required to make combat loadable at all (see gotcha #1).

**Procedural painted ground** — `BattleMapGroundCanvas` draws a naturalistic forest floor onto a `<canvas>` behind the grid: tiled `grass.jpg`/`dirt_color.jpg` textures (already shipped for the 3D ez-tree lab), procedurally-drawn top-down tree canopies + boulders, procedural water, an edge vignette, and dappled light. Tiles are now transparent (with a faint terrain tint) so the ground shows through; emoji decorations were removed (the canvas draws trees/rocks). Fog-of-war/darkness masks were **softened** so the art shows instead of blacking out the board.

**Where it stands vs. the reference:** ~60–70%. It reads as a *textured* forest battlefield now, not flat tiles — but it is **procedural, not a bespoke painted illustration**; trees/rocks are drawn shapes, the ground is dimmer/busier than the reference, and the procedural map is much larger than the reference's tidy ~20×20 (so tiles are smaller).

## 3. Relevant files

**New this session:**
- `src/components/BattleMap/combatUiTheme.ts` — shared Tailwind class tokens (panels, labels, buttons, cost colors, turn rings).
- `src/components/BattleMap/CombatIntentPreview.tsx` — the targeting intent card.
- `src/components/BattleMap/BattleMapGroundCanvas.tsx` — **the procedural painted ground** (start here for texturing work).

**Modified (reskin):**
- `src/components/Combat/CombatView.tsx` — toolbar, right-rail restructure, intent-preview wiring, `handleNewMap`, biome pill, lazy 3D + `Suspense`.
- `src/components/BattleMap/BattleMap.tsx` — gold frame, rulers, legend, fit-to-view scaling (`fitWrapRef`/`fitFrameRef`/`fitScale` + `ResizeObserver`), ground-canvas wiring, grid `zIndex`.
- `src/components/BattleMap/BattleMapTile.tsx` — transparent tiles + faint terrain tint, removed emoji decoration, **softened visibility masks**, elevation label dimmed.
- `src/components/BattleMap/PartyDisplay.tsx`, `InitiativeTracker.tsx`, `ActionEconomyBar.tsx`, `AbilityPalette.tsx`, `AbilityButton.tsx`, `CombatLog.tsx` — themed to `combatUiTheme`. (Some also got min-h-11 touch-target a11y tweaks by a linter — keep them.)
- `src/components/BattleMap/__tests__/BattleMapTile.test.tsx` — assertions updated for the new terrain-tint + softened-mask classes.
- `vite.config.ts` — added `optimizeDeps.exclude: ['three/examples/jsm/tsl/display/BloomNode.js']` (see gotcha #1).
- `public/planmap/topics.json` — `combat-map-reskin` + `svg-combatant-art` nodes.

**Assets used:** `public/assets/ez-tree-lab/grass.jpg`, `public/assets/ez-tree-lab/dirt_color.jpg`. There is **no forest battle-map illustration** in the repo, and `public/assets/images/races/` (238 portraits) is **NOT** to be used for tokens (Remy's call — use SVG generation instead).

**Reference recipe / gotchas doc:** memory `combat-2d-preview-recipe` (auto-loaded via MEMORY.md).

## 4. How to preview & verify

**Reach the real 2D combat map without Ollama:** load the app with **`?dummy=1&dev_combat=1`** — `?dummy=1` seeds a synchronous dummy party (no Ollama), `?dev_combat=1` fires a deterministic goblin/orc encounter straight into `CombatView`.

**Verify headless (reliable):** Playwright 1.57 is installed. See the throwaway script `.agent/scratch/shoot-combat.mjs` (poll for `.battle-map-grid`, click a party name in the Turn Order strip to reach a player turn so Actions/Abilities render, press Escape to close the char sheet the click may open, wait ~2.5s for the ground canvas images to load, screenshot). Run it from inside the repo so `node` resolves `node_modules`.

**Dev server:** `node -r ./scripts/dev-crash-logger.cjs node_modules/vite/bin/vite.js --port <p> --strictPort`. The BloomNode fix is now in `vite.config.ts`, so a plain start works. First load optimizes deps (~40s). **The dev server is chronically unstable in this environment — it crashes/restarts and the preview MCP loses its registration.** Headless capture per-run (fresh `goto`) is the dependable path. `preview_screenshot` also times out on the animated map canvas — use headless screenshots.

**Status:** `npx tsc --noEmit` clean for all touched source files (pre-existing errors in `AbilityPalette.tsx:60` and `BattleMapDemo.tsx` are NOT from this work). `BattleMapTile` + `ActionEconomyBar` suites pass (13/13). 2D BattleMap render suites pass (8 files).

## 5. Open decisions — get Remy's pick (my recommendation noted)

These were offered but deferred to this handover. **Ask Remy via the AskUserQuestion tool**, and offer your own opinion:

**A. Texturing depth** (in `BattleMapGroundCanvas.tsx`):
1. **Push polish 1–3:** brighter/varied grass + winding dirt path; crisper foliage (trunks, bushes, logs); proper water banks.
2. **Just #1:** only lift the ground toward daylight + grass-patch variation + a dirt path (biggest bang for buck).
3. **Good enough as base:** stop here; let the SVG-generation track carry character art.
   - *My opinion:* do **#1** first (the ground is too dark/uniform vs. the reference and a winding dirt path adds the most "map" feel for the least effort), then reassess before investing in foliage detail — procedural trees have diminishing returns against a painted reference.

**B. Live preview pane:** relaunch combat in Remy's preview pane despite the flaky server, or keep verifying headless.
   - *My opinion:* **headless** is more reliable; only relaunch the pane on explicit request.

**C. (implied) Character token/portrait art:** Remy chose **owned SVG generation** (`svg-combatant-art`, parked) over the 238 race images. This is the real path to portrait-quality tokens/roster art and is where the "looks like the reference" gap mostly remains. Consider whether to spec this next.

## 6. Gotchas (will bite you)

1. **three/TSL BloomNode breaks Vite optimize.** The installed `three` build's `three/examples/jsm/tsl/display/BloomNode.js` imports `PostProcessingUtils`, which the same build does **not** export (`grep -c PostProcessingUtils node_modules/three/build/three.module.js` → 0). esbuild can't pre-bundle it → the whole optimize pass fails → the combat chunk 504s / the server dies. This entered via `BattleMap3DGpuScene.tsx` (concurrent WebGPU work). Mitigated two ways here: the `optimizeDeps.exclude` in `vite.config.ts`, and the lazy-split so 2D never runs it. If three's TSL modules later match the core build, the exclude can go.
2. **Deep-link into combat is race-sensitive.** `?dummy=1&dev_combat=1` sometimes bounces to the main menu: (a) the app's history-sync strips `?dummy=1` before the autostart effect runs (StrictMode double-mount), and (b) each successful combat entry writes a save, and the dummy-autostart refuses to clobber an existing save. Reliable recipe in a fresh browser: clear `localStorage`, navigate once, check; if it lands on the menu, retry once. Headless Playwright wins the race far more reliably than the MCP-controlled Chrome.
3. **Intermittent combat crash.** One capture hit an ErrorBoundary "An error occurred during Combat" — traced to a **data-dependent crash keyed off the fixture's `Date.now()` seed**, NOT the reskin (re-runs render fine). Consistent with the codebase's known intermittent issues; worth a separate look if seen in real play.
4. **Map size / fog.** The procedural combat map is large; before the fog softening, darkness masks turned most of it black and row labels ran past Z (AH–BH), suggesting the fit-to-view may clip on the largest maps. Confirm the whole board fits after your changes; consider a zoom/pan affordance if not.

## 7. ⚠ COORDINATION — CombatView.tsx is Agora-locked by another fleet

As of 2026-07-06, `src/components/Combat/CombatView.tsx` is **locked in Agora** by agent `f8c9e3c6…` (2D-UI playtest fleet, "fix responsive combat 2d layout clipping"). This session's CombatView edits (toolbar, rail restructure, lazy-split, intent preview) were made **before** that coordination surfaced and are uncommitted in the shared tree alongside their in-flight work — clobber risk. Before touching `CombatView.tsx`: `curl -s http://localhost:4319/locks`, and if it is held, coordinate via Agora (see the `agora-coordination` skill) rather than overwriting. The other reskin files are not contended.

## Update 2026-07-06 (later session)

Remy chose: more ground polish AND fix map fit/zoom. Both are DONE and verified headless (95/95 BattleMap tests green):
- **Texturing 1–3 all done** in `BattleMapGroundCanvas.tsx`: daylight lift + large sunlit/shaded grass patches, winding dirt path with worn center and pebbles, scalloped tree canopies with sunlit crowns, understory bushes + fallen logs on plain grass, sandy water banks on land-facing pond edges.
- **User zoom** in `BattleMap.tsx`: −/+/Fit/Auto control cluster (bottom-right) + ctrl+wheel; spacer div gives real scrollbars at any zoom; leaving scroll mode resets stale scroll offset (jsdom-safe `scrollTo` guard). Fit shows the whole board centered even on the largest maps — gotcha #4 is closed.
- Also fixed `BattleMap.parity.test.tsx` highlight-class assertions (a concurrent tile reskin renamed them; Agora lock was already released).
- Remaining gap to the reference: character token/portrait art → `svg-combatant-art` (parked).

## Update 2026-07-06 (critique round)

Five Opus critics filed 50 points in `.agent/scratch/2026-07-06-combat-map-critique.md`
(Art Director, UX Lead, VTT Power User, Graphics Engineer, Player). First fix
batch SHIPPED and verified (95/95 BattleMap tests, headless screenshot proof):
- Canvas: devicePixelRatio + 2× supersampled ground (pixel-budget capped),
  module-level texture decode cache (no blank-frame flash), imageSmoothingQuality
  high, water drawn on its own layer and feather-composited, continuous ripple
  phase, time-of-day tint per map seed (noon/golden/overcast/dusk).
- Tactical read: crisp emerald perimeter stroke around the reachable-move
  region with a quieter interior fill, elevation digits hover-only, grid lines
  warmed to low-alpha ink brown.
- HUD: active-character banner (name/HP/"Your turn") atop the Actions rail,
  ability names on button faces, confirm dialogs on New Map and End Battle.
Round 2 SHIPPED (verified headless; BattleMap suites green — one 3D WebGPU
failfast test is flaky under parallel load only, passes alone):
- Token legibility: "invisible enemies" was a CONTRAST bug (dark red-800 ring on
  dark slate over dark forest) — now bright faction rings (red-500 hostile,
  blue-400 ally) + white halo + an HP arc around the rim (green→amber→red);
  tokens glide 0.35s between tiles instead of teleporting.
- Roster: names get the full card width (no more "K…/Tho…"), ⓘ/AI controls
  moved to their own row (44px touch targets kept).
- Log: "Round N" entries render as chapter divider chips; movement lines now
  carry distance + compass direction ("Goblin 3 moves 30 ft west"), origin
  taken from action.movementPath[0] since the character is already at the
  destination when the line is written.
Round 3 SHIPPED (verified headless; BattleMap suites 55/55 green):
- Soft fog-of-war: new `BattleMapFogCanvas` paints visibility at 1px/tile and
  upscales with bilinear smoothing — the interpolation feathers every light
  boundary, so fog reads as organic dark pools; per-tile mask divs removed
  from `BattleMapTile` (tests updated to assert their absence).
- Threat read: tiles inside a living enemy's melee reach get a red hatch when
  they're inside the reachable-move region ("you can go here, but it provokes").
- Objective chip in the toolbar ("N enemies remain" → "Battlefield clear") and
  a dismissible first-fight coach line ("Your turn, X — click a green tile…",
  persisted via localStorage `aralia-combat-coach-dismissed`).
Still open in the ledger (larger lifts): SFX layer, canvas re-render at zoom,
biome selector surfacing, board frame/ruler band, roster/initiative-strip
dedup, gamma-aware overlay palette, token min-size floor at Fit zoom.

## 8. Do-not-revert notes

- Keep the linter's a11y tweaks (min-h-11 touch targets) in `PartyDisplay`/`InitiativeTracker`/`combatUiTheme`.
- Work only in master (no branches/worktrees). Leave changes uncommitted; the 2am snapshot commits them.
- Throwaway scripts live in `.agent/scratch/` — safe to delete.
