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
  group: "entities" | "combat" | "world" | "interiors" | "crowds" | "dungeons";
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

// ── dungeon capture helpers ─────────────────────────────────────────────────
// The dungeon workbench (`?step=dungeon`) opens on the 3D Expedition view and
// keeps the parchment module sheet behind a presentation toggle. Both are the
// SAME generated plan, so a pinned `dseed` makes the pair directly comparable.

/** Press one of the workbench's named camera presets (tactical | entrance | objective). */
const DUNGEON_CAMERA = (preset: "tactical" | "entrance" | "objective") =>
  `(() => { const b = document.querySelector('[data-testid="dungeon-camera-${preset}"]'); if (!b) return 'MISSING ${preset} preset'; b.click(); return 'preset ${preset}'; })()`;

/**
 * Pull the orbit camera in toward its target with wheel ticks.
 *
 * Why this and not a pose hook: the dungeon preview exposes no camera setter,
 * only the three intent presets. `entrance` already aims at the entrance room,
 * but at a distance derived from the room radius — far enough that torch
 * falloff and stone material are a few pixels tall. Dollying along the existing
 * look direction keeps the preset's aim and buys critique distance.
 */
const DUNGEON_DOLLY_IN = (ticks: number) =>
  `(() => { const c = document.querySelector('[data-testid="dungeon-3d-preview"] canvas'); if (!c) return 'MISSING dungeon canvas'; const r = c.getBoundingClientRect(); for (let i = 0; i < ${ticks}; i++) { c.dispatchEvent(new WheelEvent('wheel', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5, deltaY: -240, bubbles: true, cancelable: true })); } return 'dollied ${ticks}'; })()`;

/**
 * Lift the parchment sheet out of the workbench chrome for a clean plate.
 *
 * The module sheet is a 2D canvas, so the WebGL `readback` path cannot reach it
 * and a plain page screenshot would be two-thirds slider panel. This moves the
 * live canvas into a fixed full-viewport backdrop so the capture is the SHEET,
 * judged on its ink — not the design harness around it.
 */
/**
 * Zoom the parchment viewport onto the plan so the LINEWORK is judgeable.
 *
 * The full-plate shot is the right frame for page composition, but the plan
 * occupies about a third of the sheet, which leaves wall hatch and corner blots
 * a few pixels wide — the same "cannot judge it" failure the whole framing pass
 * exists to remove.
 *
 * PRODUCT BUG this has to route around: the sheet's zoom-to-cursor wheel
 * listener is bound in an effect keyed on `error`, and the parchment canvas is
 * created only when the presentation toggle leaves the 3D view. Arriving at the
 * default 3D view and switching to Parchment therefore leaves the canvas with
 * NO wheel listener, so wheel zoom silently does nothing for a real user too.
 * The button cluster and the React pointer handlers are wired per render, so
 * this drives those instead: three centre-zoom clicks, then one pan-drag that
 * recentres the viewport on the plan (which sits left of and below sheet
 * centre, because the legend column occupies the upper right).
 */
const PARCHMENT_ZOOM_IN = `(() => { const zoomIn = document.querySelector('[title="Zoom in"]'); if (!zoomIn) return 'MISSING zoom-in control'; for (let i = 0; i < 3; i++) zoomIn.click(); return 'zoomed 2.74x'; })()`;

/**
 * Pan the zoomed sheet so the plan — not the empty lower page — fills the frame.
 *
 * Runs as its own step after a pause, because the pan handler reads `view.zoom`
 * from the render closure: dispatched in the same task as the zoom clicks it
 * would still see zoom 1 and bail. `setPointerCapture` is neutralised for the
 * same reason a synthetic drag needs it — there is no real active pointer, so
 * the genuine call would throw before the drag state is ever recorded.
 */
const PARCHMENT_PAN_TO_PLAN = `(() => { const canvas = [...document.querySelectorAll('canvas')].find((c) => { try { return !(c.getContext('webgl2') || c.getContext('webgl')); } catch { return true; } }); if (!canvas) return 'MISSING parchment canvas'; canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {}; const ZOOM = Math.pow(1.4, 3); const r = canvas.getBoundingClientRect(); const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5; const dx = (0.5 - 0.46) * ZOOM * r.width, dy = (0.5 - 0.54) * ZOOM * r.height; const send = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true })); send('pointerdown', cx, cy); send('pointermove', cx + dx, cy + dy); send('pointerup', cx + dx, cy + dy); return 'panned to plan'; })()`;

const ISOLATE_PARCHMENT_SHEET = `(() => { const canvas = [...document.querySelectorAll('canvas')].find((c) => { try { return !(c.getContext('webgl2') || c.getContext('webgl')); } catch { return true; } }); if (!canvas) return 'MISSING parchment canvas'; if (canvas.width < 400) return 'MISSING composed sheet (width ' + canvas.width + ')'; const stage = document.createElement('div'); stage.id = 'vistest-sheet-stage'; stage.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#1a1a1a;display:flex;align-items:center;justify-content:center;padding:0'; canvas.style.cssText = 'width:auto;height:100vh;max-width:100vw;display:block'; stage.appendChild(canvas); document.body.appendChild(stage); return 'sheet isolated ' + canvas.width + 'x' + canvas.height; })()`;

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
    id: "combat-world-stream-ford",
    title: "World battle: regional stream ford",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=river-ford-crossing",
    notes:
      "A real seed-42 trail fords a narrow stream through one shared Region receipt; the crossing paints stepping stones and a wet band instead of a bridge deck while staying traversable.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('River crossing') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Crossings')`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 3000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-hillside",
    title: "World battle: steep hillside trail",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=hillside-overlook",
    notes:
      "A steep roadless taiga flank (seed 42 cell 1419, atlas slope 36): contours, hillshade, and positional-sun cast shadows must make the slope read at tactical zoom.",
    capture: [
      {
        kind: "waitHook",
        // First generation of this cell takes a while: wait for the BUILT
        // battle map (source label carries the resolved cell), not the shell.
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.body.textContent.includes('World 42 / Cell 1419') && document.querySelector('[role="button"][aria-label^="Tile "]')`,
        timeoutMs: 120000,
      },
      { kind: "sleep", ms: 4000 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "combat-world-hillside-3d",
    title: "World battle 3D: steep hillside trail",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=hillside-overlook&render=3d",
    notes:
      "The WebGL heightfield must show a real slope with the trail traversing it; slope-exposed rock and terrain shadows carry the hillside read.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('canvas') && window.__bm3dCam?.pose`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 5000 },
      { kind: "eval", js: `(() => window.__bm3dCam.pose(30, 55, 210) ? 'posed hillside' : 'missing pose')()` },
      { kind: "sleep", ms: 6000 },
      { kind: "readback" },
    ],
  },
  {
    id: "combat-world-stream-ford-3d",
    title: "World battle 3D: stream ford crossing detail",
    group: "combat",
    url: "misc/design.html?step=battlemaplab&scenario=river-ford-crossing&render=3d",
    notes:
      "The WebGL scene must present the same ford story as 2D: a shallow pale gravel bar under visible water, stepping stones breaking the surface on the upstream side, and churned mud approaches — not a grass causeway or open deep water.",
    capture: [
      {
        kind: "waitHook",
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('canvas') && window.__bm3dCam?.poseTeam`,
        timeoutMs: 90000,
      },
      { kind: "sleep", ms: 4000 },
      {
        // The crossing receipt centers the tactical crop, so the map center
        // IS the ford: a mid-distance three-quarter view puts the bar, the
        // stone line, and one mud mouth in the same frame.
        kind: "eval",
        js: `(() => window.__bm3dCam.pose(24, 56, 150) ? 'posed ford' : 'missing pose')()`,
      },
      { kind: "sleep", ms: 6000 },
      {
        // Ford-specific structure + generic contrast: the stone group must
        // exist in the scene graph, and the framebuffer must show a real
        // multi-value frame (not a blank or single-tone canvas).
        kind: "eval",
        js: `(async () => { const api = window.__bm3dCam; if (!api?.capture) return 'missing 3D capture hook'; if (!(Number(window.__fordStonesCount) > 5)) return 'missing ford stones (count=' + window.__fordStonesCount + ')'; const dataUrl = api.capture(); if (!dataUrl || dataUrl.length < 10000) return 'missing 3D framebuffer'; const image = new Image(); await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; }); const probe = document.createElement('canvas'); probe.width = 64; probe.height = 64; const ctx = probe.getContext('2d', { willReadFrequently: true }); if (!ctx) return 'missing pixel probe'; ctx.drawImage(image, 0, 0, 64, 64); const pixels = ctx.getImageData(0, 0, 64, 64).data; let opaque = 0, min = 255, max = 0; for (let i = 0; i < pixels.length; i += 16) { const alpha = pixels[i + 3]; if (alpha < 16) continue; opaque += 1; const luma = Math.round(pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722); min = Math.min(min, luma); max = Math.max(max, luma); } if (opaque < 700 || max - min < 30) return 'missing canvas contrast'; return 'ford 3D ok'; })()`,
      },
      { kind: "readback" },
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
  {
    id: "wilds-mountain-summit",
    title: "Wilds: Mount Wildlands summit (snow + far shells)",
    group: "world",
    url: "?phase=world3d&ground=1&dcell=1199&wfseed=42",
    notes:
      "Snowfields with rock breaking through on steep faces; ridgelines, no needle spikes; distant ranges continue past the window (no world edge).",
    capture: [
      { kind: "waitHook", expr: "window.__wf3dScene && window.__wfGroundWorld && window.__wf3dSetPose", timeoutMs: 180000 },
      { kind: "sleep", ms: 15000 },
      { kind: "eval", js: `(() => { const gw = window.__wfGroundWorld; if (!gw.farShells) return 'MISSING farShells'; const MPC = 1.524; const c0 = Math.floor(gw.cols * 0.2), c1 = Math.ceil(gw.cols * 0.8); let best = -1, bc = 0, br = 0; for (let r = c0; r < c1; r++) for (let c = c0; c < c1; c++) { const v = gw.heights[r * gw.cols + c]; if (v > best) { best = v; bc = c; br = r; } } const fx = (bc + 0.5) * MPC - gw.extentMetersX / 2, fz = (br + 0.5) * MPC - gw.extentMetersZ / 2, y = (best / 100) * 1800; window.__wf3dSetPose([fx + 240, y + 110, fz + 240], [fx, y, fz]); return 'posed'; })()` },
      { kind: "sleep", ms: 8000 },
      { kind: "readback" },
    ],
  },
  {
    id: "wilds-road-bridge",
    title: "Wilds: inland bridge + far vista",
    group: "world",
    url: "?phase=world3d&ground=1&dcell=4214&wfseed=42",
    notes:
      "Bridge deck meets both banks; river continues past the window border as a blue course; terrain runs to a fogged horizon in every direction.",
    capture: [
      { kind: "waitHook", expr: "window.__wf3dScene && window.__wfGroundWorld && window.__wf3dSetPose", timeoutMs: 180000 },
      { kind: "sleep", ms: 15000 },
      { kind: "eval", js: `(() => { const gw = window.__wfGroundWorld; if (!gw.farShells) return 'MISSING farShells'; const c = (gw.crossings ?? []).find((x) => x.kind === 'bridge'); if (!c) return 'MISSING bridge'; const fx = c.xM - gw.extentMetersX / 2, fz = c.zM - gw.extentMetersZ / 2; const deck = (gw.decks ?? []).find((d) => d.sourceCrossingId === c.id); const y = deck ? deck.topY : 2; window.__wf3dSetPose([fx + 45, y + 24, fz + 45], [fx, y, fz]); return 'posed'; })()` },
      { kind: "sleep", ms: 8000 },
      { kind: "readback" },
    ],
  },
  {
    id: "wilds-ancient-forest",
    title: "Wilds: Slovan Ancientwood interior",
    group: "world",
    url: "?phase=world3d&ground=1&dcell=3023&wfseed=42",
    notes:
      "Thickets and clearings with undergrowth; canopy shade dims the light and pulls fog in (anchorCellId now threads on dev entries).",
    capture: [
      { kind: "waitHook", expr: "window.__wf3dScene && window.__wfGroundWorld && window.__wf3dSetPose", timeoutMs: 180000 },
      { kind: "sleep", ms: 15000 },
      { kind: "eval", js: `(() => { const gw = window.__wfGroundWorld; const MPC = 1.524; const col = Math.floor(gw.cols / 2), row = Math.floor(gw.rows / 2); const y = ((gw.heights[row * gw.cols + col] ?? 0) / 100) * 1800; window.__wf3dSetPose([30, y + 16, 30], [0, y, 0]); return 'posed'; })()` },
      { kind: "sleep", ms: 8000 },
      { kind: "readback" },
    ],
  },
  {
    id: "wilds-ford-causeway",
    title: "Wilds: stream ford causeway (cell 3090)",
    group: "world",
    url: "?phase=world3d&ground=1&dcell=3090&wfseed=42",
    notes:
      "Wet-sand causeway strips bank to bank with stepping stones confined to the water; three trails converge on the crossing.",
    capture: [
      { kind: "waitHook", expr: "window.__wf3dScene && window.__wfGroundWorld && window.__wf3dSetPose", timeoutMs: 180000 },
      { kind: "sleep", ms: 15000 },
      { kind: "eval", js: `(() => { const gw = window.__wfGroundWorld; const f = (gw.crossings ?? []).find((c) => c.kind === 'ford'); if (!f) return 'MISSING ford'; const fx = f.xM - gw.extentMetersX / 2, fz = f.zM - gw.extentMetersZ / 2; const strip = (gw.decks ?? []).find((d) => d.kind === 'ford'); const y = strip ? strip.topY : 1; window.__wf3dSetPose([fx + 32, y + 18, fz + 32], [fx, y, fz]); return 'posed'; })()` },
      { kind: "sleep", ms: 8000 },
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
  // --- dungeons -----------------------------------------------------------
  // The dungeon surface had NO capture scenario at all before this program, so
  // its critic had nothing to judge. These are the first two: the lit 3D room
  // an expedition actually stands in, and the diegetic parchment module sheet.
  {
    id: "dungeon-3d-entrance-room",
    title: "Dungeon 3D: torch-lit entrance room at expedition distance",
    group: "dungeons",
    url: "misc/design.html?step=dungeon&dseed=20260730&dtheme=crypt",
    notes:
      "Standing inside the entrance chamber, not surveying the level: torch flames with warm falloff onto the nearest walls, coursed stone reading as stone at arm's length, floor-to-wall contact readable, and darkness closing the far side of the room rather than a uniform grey wash.",
    capture: [
      // __dungeon3dReady only flips after three consecutive drawn frames, so it
      // is a real paint gate rather than a mount gate.
      { kind: "waitHook", expr: "window.__dungeon3dReady === true", timeoutMs: 180000 },
      { kind: "eval", js: DUNGEON_CAMERA("entrance") },
      { kind: "sleep", ms: 3000 },
      // Detail props (torches among them) are culled at the tactical preset, so
      // the dolly happens only after `entrance` has restored them.
      { kind: "eval", js: DUNGEON_DOLLY_IN(9) },
      { kind: "sleep", ms: 5000 },
      { kind: "readback" },
    ],
  },
  {
    id: "dungeon-parchment-sheet",
    title: "Dungeon 2D: hand-inked module sheet, full plate",
    group: "dungeons",
    url: "misc/design.html?step=dungeon&dseed=20260730&dtheme=crypt",
    notes:
      "The Gozzy-style module sheet as a page, free of workbench chrome: one ink hand across walls and corridors, pressure on the shadow side, warm paper, keyed room numbers, cartouche and legend. Same seed as dungeon-3d-entrance-room, so the two views are the same dungeon.",
    capture: [
      { kind: "waitHook", expr: "window.__dungeon3dReady === true", timeoutMs: 180000 },
      {
        kind: "eval",
        js: `(() => { const b = document.querySelector('[data-testid="dungeon-view-parchment"]'); if (!b) return 'MISSING parchment toggle'; b.click(); return 'parchment'; })()`,
      },
      // renderSheet composes a supersampled buffer on the view switch; this is
      // the slow step, and the blit onto the visible canvas follows it.
      { kind: "sleep", ms: 6000 },
      { kind: "eval", js: ISOLATE_PARCHMENT_SHEET },
      { kind: "sleep", ms: 800 },
      { kind: "screenshot" },
    ],
  },
  {
    id: "dungeon-parchment-linework",
    title: "Dungeon 2D: module-sheet linework at critique distance",
    group: "dungeons",
    url: "misc/design.html?step=dungeon&dseed=20260730&dtheme=crypt",
    notes:
      "The same sheet zoomed onto the plan so the ink itself is judgeable: wall stroke weight swelling on the shadow side, corner blots, corridor jambs and threshold ticks, event overlays under the ink, and door states (leaf / bricked red brick / secret dash).",
    capture: [
      { kind: "waitHook", expr: "window.__dungeon3dReady === true", timeoutMs: 180000 },
      {
        kind: "eval",
        js: `(() => { const b = document.querySelector('[data-testid="dungeon-view-parchment"]'); if (!b) return 'MISSING parchment toggle'; b.click(); return 'parchment'; })()`,
      },
      { kind: "sleep", ms: 6000 },
      { kind: "eval", js: PARCHMENT_ZOOM_IN },
      { kind: "sleep", ms: 1500 },
      { kind: "eval", js: PARCHMENT_PAN_TO_PLAN },
      { kind: "sleep", ms: 1500 },
      { kind: "eval", js: ISOLATE_PARCHMENT_SHEET },
      { kind: "sleep", ms: 800 },
      { kind: "screenshot" },
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
    "dungeons",
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
