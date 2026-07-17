// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:30:30
 * Dependents: components/DesignPreview/steps/PreviewVisTest.tsx, devtools/vistest/runnerCore.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file scenarios.ts — the visual test scenario registry.
 *
 * One scenario = a named, deep-linkable visual test: which page (relative
 * URL), what a reviewer should look for, and a declarative capture recipe the
 * headless runner (tools/vistest/shoot.ts) interprets. The harness page
 * (design.html?step=vistest) renders this same list with a live viewport.
 *
 * Adding a scenario = appending one object here. The registry test
 * (__tests__/scenarios.test.ts) fails loudly on malformed entries.
 *
 * Recipes reuse the window hooks the pages already expose:
 *   __entityforge (forge), __bm3dCam (battle map camera),
 *   __wf3dScene / __wf3dSetPose / __wfGroundWorld / __wfAgentClock (world).
 * The eval snippets are lifted verbatim from the proven capture probes.
 */

export type CaptureStep =
  | { kind: "waitHook"; expr: string; timeoutMs?: number }
  | { kind: "sleep"; ms: number }
  | { kind: "eval"; js: string }
  | { kind: "readback" }
  | { kind: "screenshot" };

export interface VisScenario {
  /** kebab-case, unique — becomes the capture filename `<id>.png`. */
  id: string;
  title: string;
  group: "entities" | "combat" | "world" | "interiors" | "crowds";
  /** Relative to the dev base (no leading slash), e.g. `misc/design.html?step=…`. */
  url: string;
  /** What a reviewer should look for in the capture. */
  notes: string;
  /** Non-empty; exactly one terminal step (`readback` | `screenshot`), last. */
  capture: CaptureStep[];
}

/** Zoom the world3d MapControls camera in by dispatching wheel ticks. */
const WHEEL_ZOOM_34 = `(() => { const c = document.querySelector('canvas'); if (!c) return; const r = c.getBoundingClientRect(); for (let i = 0; i < 34; i++) { c.dispatchEvent(new WheelEvent('wheel', { clientX: r.left + r.width * 0.485, clientY: r.top + r.height * 0.5, deltaY: -300, bubbles: true, cancelable: true })); } })()`;

/** Park the camera on interior occupant[0] (close-high, inside the room). */
const POSE_AT_OCCUPANT = `(() => { const s = window.__wf3dScene; const occ = []; s.traverse((o) => { if (o.userData && o.userData.isOccupant) occ.push(o); }); const t = occ[0]; if (!t) return 'no occupants'; const p = t.getWorldPosition(new (t.position.constructor)()); window.__wf3dSetPose([p.x + 2.0, p.y + 1.7, p.z + 2.0], [p.x, p.y + 0.7, p.z]); return 'posed'; })()`;

/** Pose on the walking commuter farthest from any building (open street). */
const POSE_AT_OPEN_WALKER = `(() => { const root = window.__wf3dScene.getObjectByName('groundAgentsCrowd'); const g = window.__wfGroundWorld; if (!root || !g) return 'missing hooks'; const OX = g.extentMetersX / 2, OZ = g.extentMetersZ / 2; const buildings = g.buildings ?? []; let best = null, bestScore = -1, idx = 0; const M = new (root.matrix.constructor)(); root.children.forEach((o) => { const isWalk = idx % 9 !== 0; idx += 1; if (!isWalk || !o.isInstancedMesh || o.count === 0) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); const x = M.elements[12], y = M.elements[13], z = M.elements[14]; let dMin = Infinity; for (const b of buildings) { const d = Math.hypot(b.xM - (x + OX), b.zM - (z + OZ)); if (d < dMin) dMin = d; } if (dMin > bestScore) { bestScore = dMin; best = { x, y, z }; } } }); if (best) window.__wf3dSetPose([best.x + 5.5, best.y + 3.2, best.z + 5.5], [best.x, best.y + 0.8, best.z]); return best ? 'posed' : 'no walkers'; })()`;

/** Pose an aerial above the first live crowd walker (street context view). */
const POSE_STREET_AERIAL = `(() => { const root = window.__wf3dScene.getObjectByName('groundAgentsCrowd'); if (!root) return 'no crowd'; let best = null; const M = new (root.matrix.constructor)(); root.traverse((o) => { if (!best && o.isInstancedMesh && o.count > 0) { o.getMatrixAt(0, M); best = { x: M.elements[12], y: M.elements[13], z: M.elements[14] }; } }); if (best) window.__wf3dSetPose([best.x + 14, best.y + 11, best.z + 14], [best.x, best.y + 0.5, best.z]); return best ? 'posed' : 'no instances'; })()`;

const CLICK_3D_VIEW = `(() => { const b = [...document.querySelectorAll('button')].find((x) => /3D View/i.test(x.textContent ?? '')); if (!b) return 'MISSING'; b.click(); return 'clicked'; })()`;

/**
 * Reject blank or nearly uniform WebGL readbacks before accepting a 3D frame.
 * The camera hook forces a same-tick render, then a 64px probe measures opaque
 * coverage and luminance range instead of trusting file size alone.
 */
const VERIFY_3D_CANVAS_PIXELS = `(async () => { const api = window.__bm3dCam; if (!api?.capture || !api?.sceneBreakdown) return 'missing 3D capture hook'; const roots = JSON.stringify(api.sceneBreakdown()?.topRoots ?? []); if (!roots.includes('opening-resolved-body-3d-goblin') || !roots.includes('opening-resolved-body-3d-wolf') || !roots.includes('opening-activity-site-3d') || !roots.includes('opening-combat-disturbance-3d')) return 'missing opening scene meshes'; const dataUrl = api.capture(); if (!dataUrl || dataUrl.length < 10000) return 'missing 3D framebuffer'; const image = new Image(); await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; }); const probe = document.createElement('canvas'); probe.width = 64; probe.height = 64; const ctx = probe.getContext('2d', { willReadFrequently: true }); if (!ctx) return 'missing pixel probe'; ctx.drawImage(image, 0, 0, 64, 64); const pixels = ctx.getImageData(0, 0, 64, 64).data; let opaque = 0, min = 255, max = 0; const bins = new Set(); for (let i = 0; i < pixels.length; i += 16) { const alpha = pixels[i + 3]; if (alpha < 16) continue; opaque += 1; const luma = Math.round(pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722); min = Math.min(min, luma); max = Math.max(max, luma); bins.add(Math.floor(luma / 12)); } if (opaque < 700 || max - min < 34 || bins.size < 5) return 'missing canvas contrast'; return 'pixels ok: ' + opaque + ' samples, range ' + (max - min) + ', bins ' + bins.size; })()`;

const TOWN_WINDOW = "?phase=world3d&ground=1&gx=16&gy=4&wfseed=42";

export const SCENARIOS: VisScenario[] = [
  // --- entities (forge + debugger) -------------------------------------
  {
    id: "forge-dwarf-wizard",
    title: "Forge: hill dwarf wizard (idle)",
    group: "entities",
    url: "misc/design.html?step=entityforge&race=hill_dwarf&class=wizard&walk=0",
    notes:
      "Beard under the hat brim, staff with orb, robe skirt; eyes visible; body renders in the current global look.",
    capture: [{ kind: "sleep", ms: 8000 }, { kind: "screenshot" }],
  },
  {
    id: "forge-dragon-huge",
    title: "Forge: Huge dragon (idle)",
    group: "entities",
    url: "misc/design.html?step=entityforge&mode=creature&type=Dragon&size=Huge&cue=none&walk=0",
    notes:
      "Wing sails read from the front; body connected (no floating fragments); horns on the head.",
    capture: [{ kind: "sleep", ms: 8000 }, { kind: "screenshot" }],
  },
  {
    id: "forge-lineup",
    title: "Forge: mixed race x class lineup (walking)",
    group: "entities",
    url: "misc/design.html?step=entityforge&mode=lineup&seed=3",
    notes:
      "Eight varied bodies walking a circle; sizes differ (small folk vs goliaths); no T-posed or frozen figures.",
    capture: [{ kind: "sleep", ms: 9000 }, { kind: "screenshot" }],
  },
  {
    id: "entitydebug-anchors",
    title: "Entity debugger: anchor overlay",
    group: "entities",
    url: "misc/design.html?step=entitydebug&race=hill_dwarf&class=wizard&overlay=anchors",
    notes:
      "Fifteen labeled anchor markers ride the body: head cluster on the head, hands at the hands, hips/tail at the pelvis.",
    capture: [{ kind: "sleep", ms: 9000 }, { kind: "screenshot" }],
  },
  // --- combat -----------------------------------------------------------
  {
    id: "combat3d-party",
    title: "Battle map 3D: party close-up",
    group: "combat",
    url: "misc/design.html?step=battlemap",
    notes:
      "Party members as generated bodies with team rings, HP pips, turn beam; gear visible (shield, helmet).",
    capture: [
      { kind: "sleep", ms: 12000 },
      { kind: "eval", js: CLICK_3D_VIEW },
      { kind: "sleep", ms: 14000 },
      { kind: "waitHook", expr: "window.__bm3dCam", timeoutMs: 60000 },
      { kind: "eval", js: `window.__bm3dCam.poseTeam('player', 9, 58, 205)` },
      { kind: "sleep", ms: 10000 },
      { kind: "readback" },
    ],
  },
  {
    id: "combat3d-enemies",
    title: "Battle map 3D: enemy close-up",
    group: "combat",
    url: "misc/design.html?step=battlemap",
    notes:
      "Enemy monsters as generated bodies (orcs with tusks, caster with hat/robe) under red team rings.",
    capture: [
      { kind: "sleep", ms: 12000 },
      { kind: "eval", js: CLICK_3D_VIEW },
      { kind: "sleep", ms: 14000 },
      { kind: "waitHook", expr: "window.__bm3dCam", timeoutMs: 60000 },
      { kind: "eval", js: `window.__bm3dCam.poseTeam('enemy', 9, 58, 25)` },
      { kind: "sleep", ms: 10000 },
      { kind: "readback" },
    ],
  },
  {
    id: "combat-world-source-gap",
    title: "World battle: missing source fails closed",
    group: "combat",
    url: "?dummy=1&dev_combat_source_gap=1",
    notes:
      "The real production CombatView receives actors without a WorldForge projection and must remain inert, explain the missing source, and visibly withhold the procedural fallback.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battlefield-source-gap"]')?.textContent?.includes('WorldForge tactical projection') && document.querySelector('[data-testid="battlefield-source-gap"]')?.textContent?.includes('Procedural production fallback') && document.querySelector('[data-testid="battlefield-source-gap"]')?.textContent?.includes('Withheld')`,
        timeoutMs: 90000,
      },
      // The state itself is static; this brief pause lets the app transition
      // finish so the screenshot cannot catch leftover exploration chrome.
      { kind: "sleep", ms: 1000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-authored-town-watch-gap",
    title: "World battle: authored-town watch fails closed",
    group: "combat",
    url: "?dummy=1&dev_static_town_watch_source_gap=1",
    notes:
      "The real application action and reducer path must identify the unsupported authored-town watch encounter, show every missing WorldForge fact, and mount neither substitute guards nor combat controls.",
    capture: [
      {
        kind: "waitHook",
        expr: `(() => { const gap = document.querySelector('[data-testid="battlefield-source-gap"]'); const text = gap?.textContent ?? ''; return gap?.getAttribute('data-source-gap-code') === 'authored-town-watch-no-worldforge-location' && text.includes('Wanted watch confrontation') && text.includes('Authored town "oakhaven"') && text.includes('WorldForge cell, settlement site, tactical terrain projection') && text.includes('Enemy roster') && text.includes('Not fabricated') && text.includes('Withheld') && !document.body.textContent?.includes('Turn Order') && !document.body.textContent?.includes('End Turn'); })()`,
        timeoutMs: 90000,
      },
      // The action is deterministic, but the route still crosses the complete
      // application transition before the unsupported-state screenshot.
      { kind: "sleep", ms: 1000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-sea-encounter-gap",
    title: "World battle: sea encounter fails closed",
    group: "combat",
    url: "?dummy=1&dev_sea_encounter_source_gap=1",
    notes:
      "The production shell must consume the hostile voyage request without turning proposed foes into actors, identify the absent sea/deck authority, and expose no land battlefield or combat controls.",
    capture: [
      {
        kind: "waitHook",
        expr: `(() => { const gap = document.querySelector('[data-testid="battlefield-source-gap"]'); const text = gap?.textContent ?? ''; return gap?.getAttribute('data-source-gap-code') === 'sea-encounter-no-worldforge-battlefield' && text.includes('Daily sea encounter: pirates') && text.includes('Open-sea voyage without a tactical location artifact') && text.includes('WorldForge sea surface, vessel deck geometry, relative vessel headings, weather and boarding context') && text.includes('Enemy roster') && text.includes('Not fabricated') && text.includes('Withheld') && !text.includes('Bandit') && !document.body.textContent?.includes('Turn Order') && !document.body.textContent?.includes('End Turn'); })()`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 1000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-location-free-encounter-gap",
    title: "World battle: location-free simulation fails closed",
    group: "combat",
    url: "?dummy=1&dev_location_free_encounter_source_gap=1",
    notes:
      "The production EncounterModal contract must keep a bestiary proposal outside combat until a canonical WorldForge cell and crop anchor are selected, with an exact refusal and no prepared actors.",
    capture: [
      {
        kind: "waitHook",
        expr: `(() => { const gap = document.querySelector('[data-testid="battlefield-source-gap"]'); const text = gap?.textContent ?? ''; return gap?.getAttribute('data-source-gap-code') === 'location-free-simulation-no-worldforge-location' && text.includes('Bestiary roll encounter simulation') && text.includes('No WorldForge battlefield selected') && text.includes('selected WorldForge cell, tactical crop anchor, encounter-to-location receipt') && text.includes('Enemy roster') && text.includes('Not fabricated') && text.includes('Withheld') && !document.body.textContent?.includes('Turn Order') && !document.body.textContent?.includes('End Turn'); })()`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 1000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-settlement-edge",
    title: "World battle: Legium wanted-party watch confrontation",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-settlement-edge",
    notes:
      "A real Legium gatehouse anchors a settlement-edge fight; residents retain scheduled positions while a labeled witnessed-crime fixture authorizes Turino's source regiment patrol through the same rule a live player-state caller can use.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelectorAll('[data-testid="world-occupant-marker"]').length > 0 && document.querySelector('[data-testid="scenario-occupant-facts"]')?.textContent?.includes('Projected identities') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('1st (Legium) Regiment') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('Combat verdictHostile') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('watch-confrontation / visual-harness') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('1 witnessed crime in cell_829') && document.body.textContent?.includes('Turino Archer 1') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Settlement edge')`,
        timeoutMs: 90000,
      },
      // Wait for whole-map fit and resident grouping to settle after the worker
      // result mounts; the screenshot then represents the stable audit state.
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-live-watch",
    title: "World battle: live-position watch interception",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-watch-interception",
    notes:
      "The production settlement-watch frame keeps the party on the exact live crop anchor and deploys source Turino defenders from the town side; the deterministic crime remains visibly labeled as a visual fixture.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]')?.textContent?.includes('Live Watch') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('Combat verdictHostile') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('watch-confrontation / visual-harness') && document.body.textContent?.includes('Watch interception') && document.body.textContent?.includes('Turino Infantry 1')`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-state-patrol",
    title: "World battle: generated-state patrol interception",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-state-patrol",
    notes:
      "A deterministic hostile Turino standing fixture drives the production state-confrontation frame, source regiment actors, and current-position deployment without masquerading as a local watch arrest.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]')?.textContent?.includes('State Patrol') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('Combat verdictHostile') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('state-confrontation / visual-harness') && document.querySelector('[data-testid="scenario-defender-facts"]')?.textContent?.includes('HOSTILE standing -55') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Encounter frameState patrol') && document.body.textContent?.includes('State patrol') && document.body.textContent?.includes('Turino Infantry 1')`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-hostile-opening",
    title: "World battle: authored hostile opening ecology",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-hostile-opening",
    notes:
      "An exact WorldForge opening scene must read as a coordinated occupation, not spawned tokens: lead, screens, distinct source-authored bodies and carried loads, physical tracks and territorial damage, and saved flattened-ground, traffic, drag, and refuse imprints all remain visible with their source-scene receipt.",
    capture: [
      {
        // This is intentionally an adversarial readiness gate. A mounted map is
        // insufficient if the monster ecology collapses back to repeated stamps.
        kind: "waitHook",
        expr: `(() => { const facts = document.querySelector('[data-testid="scenario-opening-source-facts"]')?.textContent ?? ''; const bodies = [...document.querySelectorAll('[data-testid="opening-threat-body"]')]; const imprints = [...document.querySelectorAll('[data-testid="opening-terrain-imprint"]')]; const imprintKinds = new Set(imprints.map((imprint) => imprint.getAttribute('data-imprint-kind'))); return document.querySelector('[data-testid="battle-map-scenario-lab"]')?.textContent?.includes('Hostile Opening') && facts.includes('scene replayed') && facts.includes('Scene continuitysaved-replay') && facts.includes('contact-lead / screen-left / screen-right / scent-flanker') && facts.includes('Body silhouettes4 authored / 4 postures') && facts.includes('salvage-pack / long-tool / buckler') && facts.includes('flattened-ground / trampled-run / drag-furrow / refuse-scatter') && facts.includes('Claimed scavenger cache / fresh') && facts.includes('salvaged-container / torn-bedding / gnawed-remains') && bodies.length >= 4 && new Set(bodies.map((body) => body.getAttribute('data-body-posture'))).size >= 4 && document.querySelector('[data-testid="opening-threat-carried-salvage-pack"]') && document.querySelector('[data-testid="opening-threat-carried-long-tool"]') && document.querySelector('[data-testid="opening-threat-carried-buckler"]') && document.querySelectorAll('[data-testid="opening-threat-roster-role"]').length >= 4 && document.querySelectorAll('[data-testid="opening-ecological-trace"]').length >= 3 && document.querySelector('[data-trace-kind="territorial-scrape"]') && document.querySelector('[data-testid="opening-track-trail"]') && imprints.length >= 4 && imprintKinds.has('flattened-ground') && imprintKinds.has('trampled-run') && imprintKinds.has('drag-furrow') && imprintKinds.has('refuse-scatter') && document.querySelector('[data-testid="opening-monster-site"][data-site-kind="claimed-cache"]'); })()`,
        timeoutMs: 90000,
      },
      // Let the one-time establishing camera settle around the party, monster
      // formation, and evidence trail before recording the critical review frame.
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-hostile-opening-aftermath",
    title: "World battle: resolved hostile-opening return",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-hostile-opening-aftermath",
    notes:
      "The exact saved contact scene returns after a mixed party victory with one goblin and one wolf downed, two goblin withdrawals, an abandoned disturbed cache, and combat-authored ground churn; the original four-creature formation must not respawn.",
    capture: [
      {
        // A pretty empty map is not outcome continuity. Require the exact
        // receipt state, reduced physical roster, disturbed site, and physical
        // aftermath layers before accepting the screenshot.
        kind: "waitHook",
        expr: `(() => { const facts = document.querySelector('[data-testid="scenario-opening-source-facts"]')?.textContent ?? ''; const bodies = [...document.querySelectorAll('[data-testid="opening-threat-body"]')]; const bodyFacts = [...document.querySelectorAll('[data-testid="opening-aftermath-body-fact"]')]; return document.querySelector('[data-testid="battle-map-scenario-lab"]')?.textContent?.includes('Opening Aftermath') && facts.includes('aftermath replayed') && facts.includes('Scene continuityresolved-return') && facts.includes('Source enemy positions2 physical / 4 resolved') && facts.includes('Battle outcomeparty-victory') && facts.includes('Creature outcomesdowned / withdrew / withdrew / downed') && facts.includes('Site after combatabandoned-disturbed') && facts.includes('Combat disturbanceheavy') && bodies.length === 2 && bodyFacts.length === 2 && document.querySelectorAll('[data-testid="opening-threat-roster-role"]').length === 0 && document.querySelector('[data-testid="opening-combat-disturbance"][data-disturbance-severity="heavy"]') && document.querySelector('[data-testid="opening-monster-site"][data-site-condition="abandoned-disturbed"]'); })()`,
        timeoutMs: 90000,
      },
      {
        // Targeting mode removes the default movement perimeter so the capture
        // can judge source ecology rather than a legal-move teaching overlay.
        // Cancel only the ability HUD afterward: the combat mode remains armed,
        // but neither teaching surface is allowed to hide aftermath evidence.
        kind: "eval",
        js: `(() => { const button = [...document.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('Attack with')); if (!button || button.disabled) return 'missing attack'; button.click(); return 'targeting armed'; })()`,
      },
      { kind: "sleep", ms: 300 },
      {
        kind: "eval",
        js: `(() => { const cancel = [...document.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('Cancel ') && (candidate.getAttribute('aria-label') ?? '').endsWith(' targeting')); if (!cancel) return 'missing cancel'; cancel.click(); return 'attack mode without targeting HUD'; })()`,
      },
      { kind: "sleep", ms: 1500 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-hostile-opening-aftermath-3d",
    title: "World battle 3D: resolved hostile-opening return",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-hostile-opening-aftermath&render=3d",
    notes:
      "The WebGL renderer must consume the same resolved receipt as 2D: four saved terrain imprints, physical cache condition, heavy combat churn, and exactly one goblin plus one wolf body outside initiative, with no blank-frame acceptance.",
    capture: [
      {
        kind: "waitHook",
        // DOM metadata proves the canvas was given the complete saved scene;
        // the later pixel probe separately proves that it drew a real frame.
        expr: `(() => { const marker = document.querySelector('[data-testid="opening-threat-scene-3d-facts"]'); return marker?.getAttribute('data-scene-continuity') === 'resolved-return' && marker?.getAttribute('data-body-count') === '2' && marker?.getAttribute('data-terrain-imprint-count') === '4' && Number(marker?.getAttribute('data-trace-count') ?? 0) >= 3 && marker?.getAttribute('data-site-condition') === 'abandoned-disturbed' && marker?.getAttribute('data-has-disturbance') === 'true' && Number.isFinite(Number(marker?.getAttribute('data-focus-ground-y'))) && document.querySelector('canvas') && window.__bm3dCam?.poseAtHeight; })()`,
        timeoutMs: 90000,
      },
      {
        // Arm the first real attack ability. The canvas-only readback excludes
        // the surrounding target-picker HUD, while keeping this mode armed
        // removes the default movement wash from the physical scene itself.
        kind: "eval",
        js: `(() => { const button = [...document.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? '').includes('Action cost') && (candidate.getAttribute('aria-label') ?? '').includes('range 1 tile')); if (!button || button.disabled) return 'missing attack'; button.click(); return 'targeting armed'; })()`,
      },
      { kind: "sleep", ms: 300 },
      {
        // The source site's elevation is 11+ world units, so flat-map camera
        // targeting would put the capture below the terrain surface.
        kind: "eval",
        js: `(() => { const marker = document.querySelector('[data-testid="opening-threat-scene-3d-facts"]'); const x = Number(marker?.getAttribute('data-focus-x')); const y = Number(marker?.getAttribute('data-focus-ground-y')); const z = Number(marker?.getAttribute('data-focus-z')); if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !window.__bm3dCam?.poseAtHeight) return 'missing aftermath focus'; return window.__bm3dCam.poseAtHeight(x + 0.5, y, z + 0.5, 11, 56, 214) ? 'posed aftermath' : 'missing camera pose'; })()`,
      },
      {
        // A 3D frame must respond to camera movement. Compare explicit
        // framebuffer readbacks at two azimuths, then restore the accepted
        // composition before the final quality capture.
        kind: "eval",
        js: `(() => { const marker = document.querySelector('[data-testid="opening-threat-scene-3d-facts"]'); const x = Number(marker?.getAttribute('data-focus-x')) + 0.5; const y = Number(marker?.getAttribute('data-focus-ground-y')); const z = Number(marker?.getAttribute('data-focus-z')) + 0.5; const api = window.__bm3dCam; if (!api?.capture || !api?.poseAtHeight) return 'missing camera motion hook'; const before = api.capture(); api.poseAtHeight(x, y, z, 11, 56, 230); const after = api.capture(); api.poseAtHeight(x, y, z, 11, 56, 214); return before && after && before !== after ? 'camera movement ok' : 'missing camera movement'; })()`,
      },
      { kind: "sleep", ms: 9000 },
      { kind: "eval", js: VERIFY_3D_CANVAS_PIXELS },
      { kind: "readback" },
    ],
  },
  {
    id: "combat-world-road-ambush",
    title: "World battle: regional-route ambush",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=wilderness-road-ambush",
    notes:
      "A real seed-42 regional route crosses the full referee map; party tokens form a road column, enemies occupy both flanks, and projection diagnostics report source parity.",
    capture: [
      // The worker-built scenario is ready only after both the live combat shell
      // and its semantic diagnostics have mounted. Waiting on those surfaces
      // keeps captures deterministic without adding a lab-specific global hook.
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Road ambush')`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 2500 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-river-crossing",
    title: "World battle: regional bridge crossing",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=river-bridge-crossing",
    notes:
      "A real seed-42 highway crosses a broad river through one shared Region receipt; the bridge remains water-backed and traversable while teams deploy on opposite banks.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('River crossing') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Crossings')`,
        timeoutMs: 90000,
      },
      // Let the ground painter settle after the worker result mounts so this is
      // visual evidence of the final over-water crossing pass, not a load frame.
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-river-elevation",
    title: "World battle: readable river-bank elevation",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=river-bridge-crossing",
    notes:
      "The source river banks retain five-foot contours and hillshade; a deliberately hovered higher tile puts the tile, Dev, and the tactical crop's real zero-foot map floor on one literal elevation ladder.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('River crossing') && document.querySelector('[data-relative-elevation-feet]')`,
        timeoutMs: 90000,
      },
      // Magnify the source patch enough to judge contour continuity while the
      // camera's existing active-character policy keeps the relevant bank near
      // the viewport instead of drifting to an arbitrary map corner.
      {
        kind: "eval",
        js: `(() => { const zoom = document.querySelector('[aria-label="Zoom in"]'); zoom?.click(); zoom?.click(); })()`,
      },
      { kind: "sleep", ms: 1800 },
      {
        kind: "eval",
        js: `(() => { const candidates = [...document.querySelectorAll('[data-relative-elevation-feet]')].filter((candidate) => { const box = candidate.getBoundingClientRect(); return Number(candidate.getAttribute('data-relative-elevation-feet')) >= 8 && candidate.getAttribute('title')?.includes('grass') && box.left > 300 && box.right < window.innerWidth - 360 && box.top > 330 && box.bottom < window.innerHeight - 90; }); candidates.sort((left, right) => { const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect(); return Math.hypot(a.left + a.width / 2 - window.innerWidth / 2, a.top + a.height / 2 - window.innerHeight / 2) - Math.hypot(b.left + b.width / 2 - window.innerWidth / 2, b.top + b.height / 2 - window.innerHeight / 2); }); const tile = candidates[0]; if (!tile) throw new Error('missing raised terrain probe'); tile.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); })()`,
      },
      {
        kind: "waitHook",
        expr: `(() => { const readout = document.querySelector('[data-testid="battle-map-elevation-readout"]'); const legend = document.querySelector('[data-testid="elevation-legend"]'); const tiles = [...document.querySelectorAll('[data-local-relief-feet]')]; const heights = tiles.map((tile) => Number(tile.getAttribute('data-local-relief-feet'))).filter(Number.isFinite); const rawLabel = tiles.some((tile) => tile.getAttribute('title')?.includes('Elev:')); const hasTruthfulMapZero = heights.length > 0 && Math.min(...heights) === 0 && Math.max(...heights) >= 5; const tileFeet = Number(readout?.getAttribute('data-tile-height-feet')); const referenceFeet = Number(readout?.getAttribute('data-reference-height-feet')); const relativeFeet = Number(readout?.getAttribute('data-relative-height-feet')); const ladderExplainsDifference = Number.isFinite(tileFeet) && Number.isFinite(referenceFeet) && Number.isFinite(relativeFeet) && tileFeet - referenceFeet === relativeFeet; return readout?.getAttribute('data-elevation-relation') === 'higher' && readout?.getAttribute('data-map-floor-feet') === '0' && readout.textContent?.includes('This tile') && readout.textContent?.includes('Dev Player') && readout.textContent?.includes('Map floor') && readout.textContent?.includes('0 ft is the lowest visible ground') && readout.textContent?.includes('Each contour is a 5 ft step') && legend?.textContent?.includes('floor 0 ft') && legend?.textContent?.includes('contour step 5 ft') && ladderExplainsDifference && hasTruthfulMapZero && !rawLabel; })()`,
        timeoutMs: 10000,
      },
      { kind: "sleep", ms: 800 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-targetable-objects",
    title: "World battle: source object targets",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=legium-town-skirmish",
    notes:
      "Real Legium feature and prop anchors publish provenance-bearing spell targets; cyan circles mark natural features, amber diamonds mark catalog props, and diagnostics expose incomplete mobility/weight facts.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelectorAll('[data-testid="targetable-object-fact-marker"]').length > 0 && document.querySelector('[data-testid="scenario-object-facts"]')?.textContent?.includes('Incomplete mobility / weight')`,
        timeoutMs: 90000,
      },
      // Object rings mount with the worker result. A short pause lets the map
      // camera finish its initial fit before this review layer is captured.
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  // --- world ------------------------------------------------------------
  {
    id: "world-cast-diorama",
    title: "World: opening-scene cast in town",
    group: "world",
    url: "?phase=world3d&ground=1&cast=1",
    notes:
      "Player + two strangers clustered in the town square as generated bodies; name labels above heads.",
    capture: [
      { kind: "waitHook", expr: "window.__wf3dScene", timeoutMs: 90000 },
      { kind: "sleep", ms: 12000 },
      { kind: "eval", js: WHEEL_ZOOM_34 },
      { kind: "sleep", ms: 6000 },
      { kind: "readback" },
    ],
  },
  {
    id: "town-street-aerial",
    title: "World: street aerial at morning commute",
    group: "world",
    url: TOWN_WINDOW,
    notes:
      "Town street from above with roads, houses, trees; tiny townsfolk figures on the streets.",
    capture: [
      {
        kind: "waitHook",
        expr: "window.__wf3dScene && window.__wfGroundWorld",
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 10000 },
      { kind: "eval", js: `window.__wfAgentClock = 7.2` },
      { kind: "sleep", ms: 1500 },
      { kind: "eval", js: POSE_STREET_AERIAL },
      { kind: "sleep", ms: 4000 },
      { kind: "readback" },
    ],
  },
  // --- interiors ----------------------------------------------------------
  {
    id: "interior-villager",
    title: "Interiors: villager at home, evening",
    group: "interiors",
    url: `${TOWN_WINDOW}&hour=20`,
    notes:
      "Camera inside a house at 20:00; a villager body stands at its station (often at furniture); ancestry varies per household.",
    capture: [
      {
        kind: "waitHook",
        expr: "window.__wf3dScene && window.__wfGroundWorld",
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 10000 },
      { kind: "eval", js: `window.__wfAgentClock = 20` },
      { kind: "sleep", ms: 2500 },
      { kind: "eval", js: POSE_AT_OCCUPANT },
      { kind: "sleep", ms: 4000 },
      { kind: "readback" },
    ],
  },
  // --- crowds -------------------------------------------------------------
  {
    id: "crowd-commute",
    title: "Crowds: commuter mid-stride at 07:12",
    group: "crowds",
    url: TOWN_WINDOW,
    notes:
      "A walking commuter in the open street, legs mid-stride (baked walk keyframes); mixed skin tones across walkers.",
    capture: [
      {
        kind: "waitHook",
        expr: "window.__wf3dScene && window.__wfGroundWorld",
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 10000 },
      { kind: "eval", js: `window.__wfAgentClock = 7.2` },
      { kind: "sleep", ms: 1500 },
      { kind: "eval", js: POSE_AT_OPEN_WALKER },
      { kind: "sleep", ms: 4000 },
      { kind: "readback" },
    ],
  },
];

/** Validate a scenario list; returns human-readable problems ([] = valid). */
export function validateScenarios(list: VisScenario[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const groups = new Set([
    "entities",
    "combat",
    "world",
    "interiors",
    "crowds",
  ]);
  for (const s of list) {
    if (seen.has(s.id)) problems.push(`"${s.id}": duplicate id`);
    seen.add(s.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id))
      problems.push(`"${s.id}": id is not kebab-case`);
    if (s.url.startsWith("/"))
      problems.push(`"${s.id}": url has a leading slash (must be relative)`);
    if (s.url.includes("://"))
      problems.push(`"${s.id}": url has a host (must be relative)`);
    if (!groups.has(s.group))
      problems.push(`"${s.id}": unknown group "${s.group}"`);
    if (s.notes.trim().length <= 10)
      problems.push(`"${s.id}": notes too short to guide a reviewer`);
    const terminals = s.capture.filter(
      (c) => c.kind === "readback" || c.kind === "screenshot",
    );
    if (
      s.capture.length === 0 ||
      terminals.length !== 1 ||
      !["readback", "screenshot"].includes(s.capture[s.capture.length - 1].kind)
    ) {
      problems.push(
        `"${s.id}": recipe must end with exactly one terminal step (readback | screenshot)`,
      );
    }
    for (const [i, step] of s.capture.entries()) {
      if (step.kind === "waitHook" && step.expr.trim().length === 0)
        problems.push(`"${s.id}" step ${i}: empty waitHook`);
      if (step.kind === "eval" && step.js.trim().length === 0)
        problems.push(`"${s.id}" step ${i}: empty eval`);
    }
  }
  return problems;
}
