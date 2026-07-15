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
  | { kind: 'waitHook'; expr: string; timeoutMs?: number }
  | { kind: 'sleep'; ms: number }
  | { kind: 'eval'; js: string }
  | { kind: 'readback' }
  | { kind: 'screenshot' };

export interface VisScenario {
  /** kebab-case, unique — becomes the capture filename `<id>.png`. */
  id: string;
  title: string;
  group: 'entities' | 'combat' | 'world' | 'interiors' | 'crowds';
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

const TOWN_WINDOW = '?phase=world3d&ground=1&gx=16&gy=4&wfseed=42';

export const SCENARIOS: VisScenario[] = [
  // --- entities (forge + debugger) -------------------------------------
  {
    id: 'forge-dwarf-wizard',
    title: 'Forge: hill dwarf wizard (idle)',
    group: 'entities',
    url: 'misc/design.html?step=entityforge&race=hill_dwarf&class=wizard&walk=0',
    notes: 'Beard under the hat brim, staff with orb, robe skirt; eyes visible; body renders in the current global look.',
    capture: [{ kind: 'sleep', ms: 8000 }, { kind: 'screenshot' }],
  },
  {
    id: 'forge-dragon-huge',
    title: 'Forge: Huge dragon (idle)',
    group: 'entities',
    url: 'misc/design.html?step=entityforge&mode=creature&type=Dragon&size=Huge&cue=none&walk=0',
    notes: 'Wing sails read from the front; body connected (no floating fragments); horns on the head.',
    capture: [{ kind: 'sleep', ms: 8000 }, { kind: 'screenshot' }],
  },
  {
    id: 'forge-lineup',
    title: 'Forge: mixed race x class lineup (walking)',
    group: 'entities',
    url: 'misc/design.html?step=entityforge&mode=lineup&seed=3',
    notes: 'Eight varied bodies walking a circle; sizes differ (small folk vs goliaths); no T-posed or frozen figures.',
    capture: [{ kind: 'sleep', ms: 9000 }, { kind: 'screenshot' }],
  },
  {
    id: 'entitydebug-anchors',
    title: 'Entity debugger: anchor overlay',
    group: 'entities',
    url: 'misc/design.html?step=entitydebug&race=hill_dwarf&class=wizard&overlay=anchors',
    notes: 'Fifteen labeled anchor markers ride the body: head cluster on the head, hands at the hands, hips/tail at the pelvis.',
    capture: [{ kind: 'sleep', ms: 9000 }, { kind: 'screenshot' }],
  },
  // --- combat -----------------------------------------------------------
  {
    id: 'combat3d-party',
    title: 'Battle map 3D: party close-up',
    group: 'combat',
    url: 'misc/design.html?step=battlemap',
    notes: 'Party members as generated bodies with team rings, HP pips, turn beam; gear visible (shield, helmet).',
    capture: [
      { kind: 'sleep', ms: 12000 },
      { kind: 'eval', js: CLICK_3D_VIEW },
      { kind: 'sleep', ms: 14000 },
      { kind: 'waitHook', expr: 'window.__bm3dCam', timeoutMs: 60000 },
      { kind: 'eval', js: `window.__bm3dCam.poseTeam('player', 9, 58, 205)` },
      { kind: 'sleep', ms: 10000 },
      { kind: 'readback' },
    ],
  },
  {
    id: 'combat3d-enemies',
    title: 'Battle map 3D: enemy close-up',
    group: 'combat',
    url: 'misc/design.html?step=battlemap',
    notes: 'Enemy monsters as generated bodies (orcs with tusks, caster with hat/robe) under red team rings.',
    capture: [
      { kind: 'sleep', ms: 12000 },
      { kind: 'eval', js: CLICK_3D_VIEW },
      { kind: 'sleep', ms: 14000 },
      { kind: 'waitHook', expr: 'window.__bm3dCam', timeoutMs: 60000 },
      { kind: 'eval', js: `window.__bm3dCam.poseTeam('enemy', 9, 58, 25)` },
      { kind: 'sleep', ms: 10000 },
      { kind: 'readback' },
    ],
  },
  {
    id: 'combat-world-road-ambush',
    title: 'World battle: regional-route ambush',
    group: 'combat',
    url: 'misc/design.html?step=battlemaplab',
    notes: 'A real seed-42 regional route crosses the full referee map; party tokens form a road column, enemies occupy both flanks, and projection diagnostics report source parity.',
    capture: [
      // The worker-built scenario is ready only after both the live combat shell
      // and its semantic diagnostics have mounted. Waiting on those surfaces
      // keeps captures deterministic without adding a lab-specific global hook.
      {
        kind: 'waitHook',
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Road ambush')`,
        timeoutMs: 90000,
      },
      { kind: 'sleep', ms: 2500 },
      { kind: 'screenshot' },
    ],
  },
  {
    id: 'combat-world-river-crossing',
    title: 'World battle: regional bridge crossing',
    group: 'combat',
    url: 'misc/design.html?step=battlemaplab&scenario=river-bridge-crossing',
    notes: 'A real seed-42 highway crosses a broad river through one shared Region receipt; the bridge remains water-backed and traversable while teams deploy on opposite banks.',
    capture: [
      {
        kind: 'waitHook',
        expr: `document.querySelector('[data-testid="battle-map-scenario-lab"]') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('River crossing') && document.querySelector('[data-testid="scenario-diagnostics"]')?.textContent?.includes('Crossings')`,
        timeoutMs: 90000,
      },
      // Let the ground painter settle after the worker result mounts so this is
      // visual evidence of the final over-water crossing pass, not a load frame.
      { kind: 'sleep', ms: 3000 },
      { kind: 'screenshot' },
    ],
  },
  // --- world ------------------------------------------------------------
  {
    id: 'world-cast-diorama',
    title: 'World: opening-scene cast in town',
    group: 'world',
    url: '?phase=world3d&ground=1&cast=1',
    notes: 'Player + two strangers clustered in the town square as generated bodies; name labels above heads.',
    capture: [
      { kind: 'waitHook', expr: 'window.__wf3dScene', timeoutMs: 90000 },
      { kind: 'sleep', ms: 12000 },
      { kind: 'eval', js: WHEEL_ZOOM_34 },
      { kind: 'sleep', ms: 6000 },
      { kind: 'readback' },
    ],
  },
  {
    id: 'town-street-aerial',
    title: 'World: street aerial at morning commute',
    group: 'world',
    url: TOWN_WINDOW,
    notes: 'Town street from above with roads, houses, trees; tiny townsfolk figures on the streets.',
    capture: [
      { kind: 'waitHook', expr: 'window.__wf3dScene && window.__wfGroundWorld', timeoutMs: 90000 },
      { kind: 'sleep', ms: 10000 },
      { kind: 'eval', js: `window.__wfAgentClock = 7.2` },
      { kind: 'sleep', ms: 1500 },
      { kind: 'eval', js: POSE_STREET_AERIAL },
      { kind: 'sleep', ms: 4000 },
      { kind: 'readback' },
    ],
  },
  // --- interiors ----------------------------------------------------------
  {
    id: 'interior-villager',
    title: 'Interiors: villager at home, evening',
    group: 'interiors',
    url: `${TOWN_WINDOW}&hour=20`,
    notes: 'Camera inside a house at 20:00; a villager body stands at its station (often at furniture); ancestry varies per household.',
    capture: [
      { kind: 'waitHook', expr: 'window.__wf3dScene && window.__wfGroundWorld', timeoutMs: 90000 },
      { kind: 'sleep', ms: 10000 },
      { kind: 'eval', js: `window.__wfAgentClock = 20` },
      { kind: 'sleep', ms: 2500 },
      { kind: 'eval', js: POSE_AT_OCCUPANT },
      { kind: 'sleep', ms: 4000 },
      { kind: 'readback' },
    ],
  },
  // --- crowds -------------------------------------------------------------
  {
    id: 'crowd-commute',
    title: 'Crowds: commuter mid-stride at 07:12',
    group: 'crowds',
    url: TOWN_WINDOW,
    notes: 'A walking commuter in the open street, legs mid-stride (baked walk keyframes); mixed skin tones across walkers.',
    capture: [
      { kind: 'waitHook', expr: 'window.__wf3dScene && window.__wfGroundWorld', timeoutMs: 90000 },
      { kind: 'sleep', ms: 10000 },
      { kind: 'eval', js: `window.__wfAgentClock = 7.2` },
      { kind: 'sleep', ms: 1500 },
      { kind: 'eval', js: POSE_AT_OPEN_WALKER },
      { kind: 'sleep', ms: 4000 },
      { kind: 'readback' },
    ],
  },
];

/** Validate a scenario list; returns human-readable problems ([] = valid). */
export function validateScenarios(list: VisScenario[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const groups = new Set(['entities', 'combat', 'world', 'interiors', 'crowds']);
  for (const s of list) {
    if (seen.has(s.id)) problems.push(`"${s.id}": duplicate id`);
    seen.add(s.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) problems.push(`"${s.id}": id is not kebab-case`);
    if (s.url.startsWith('/')) problems.push(`"${s.id}": url has a leading slash (must be relative)`);
    if (s.url.includes('://')) problems.push(`"${s.id}": url has a host (must be relative)`);
    if (!groups.has(s.group)) problems.push(`"${s.id}": unknown group "${s.group}"`);
    if (s.notes.trim().length <= 10) problems.push(`"${s.id}": notes too short to guide a reviewer`);
    const terminals = s.capture.filter((c) => c.kind === 'readback' || c.kind === 'screenshot');
    if (s.capture.length === 0 || terminals.length !== 1 || !['readback', 'screenshot'].includes(s.capture[s.capture.length - 1].kind)) {
      problems.push(`"${s.id}": recipe must end with exactly one terminal step (readback | screenshot)`);
    }
    for (const [i, step] of s.capture.entries()) {
      if (step.kind === 'waitHook' && step.expr.trim().length === 0) problems.push(`"${s.id}" step ${i}: empty waitHook`);
      if (step.kind === 'eval' && step.js.trim().length === 0) problems.push(`"${s.id}" step ${i}: empty eval`);
    }
  }
  return problems;
}
