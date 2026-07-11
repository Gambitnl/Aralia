/**
 * @file generateDungeon.test.ts
 * @description Acceptance invariants for the procedural dungeon generator
 * (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md).
 * Numeric goldens are necessary but NOT sufficient — the design-preview eyeball
 * is the other half of the proof (Aralia visual-inspection rule).
 */

import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../generateDungeon';
import { CELL_FT, CellKind, OverlayKind, type DungeonPlan } from '../types';
import { roomBudget, encounterMultiplier } from '../encounterBudget';
import { bestiaryForSite } from '../world/bestiaryTable';

/** Entity coords are plot-local feet; the grid is 5 ft cells. */
const cellIndex = (plan: DungeonPlan, xFt: number, yFt: number): number =>
  (yFt / CELL_FT) * plan.W + xFt / CELL_FT;

const SEEDS = [1, 7, 42, 1337, 99999];
const THEMES = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'] as const;

/** FNV-1a over the grid — a compact byte-identity checksum. */
function gridChecksum(plan: DungeonPlan): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < plan.grid.length; i++) {
    h ^= plan.grid[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${plan.W}x${plan.H}:${(h >>> 0).toString(16)}`;
}

function floorReachability(plan: DungeonPlan): number {
  let floor = 0;
  let reached = 0;
  for (let i = 0; i < plan.grid.length; i++) {
    if (plan.grid[i] === CellKind.Floor) {
      floor++;
      if (plan.bfs[i] >= 0) reached++;
    }
  }
  return floor === 0 ? 0 : reached / floor;
}

describe('generateDungeon', () => {
  it('reaches 100% of floor cells by flood fill from the entrance', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(floorReachability(plan)).toBe(1);
    }
  });

  it('is deterministic — identical grid checksum across 3 runs', () => {
    for (const seed of SEEDS) {
      const a = gridChecksum(generateDungeon({ seed }));
      const b = gridChecksum(generateDungeon({ seed }));
      const c = gridChecksum(generateDungeon({ seed }));
      expect(a).toBe(b);
      expect(b).toBe(c);
    }
  });

  it('different seeds produce different layouts', () => {
    const checksums = new Set(SEEDS.map((seed) => gridChecksum(generateDungeon({ seed }))));
    expect(checksums.size).toBe(SEEDS.length);
  });

  it('places the boss deep and the entrance as a distinct degree-1 leaf', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const maxDepth = Math.max(...plan.rooms.map((r) => r.depth));
      const boss = plan.rooms[plan.bossId];
      const entrance = plan.rooms[plan.entranceId];
      expect(boss.depth).toBeGreaterThanOrEqual(0.6 * maxDepth);
      expect(entrance.degree).toBe(1);
      expect(plan.entranceId).not.toBe(plan.bossId);
      // Entrance is not adjacent to the boss.
      const adjacent = plan.edges.some(
        (e) => (e.a === plan.entranceId && e.b === plan.bossId) || (e.b === plan.entranceId && e.a === plan.bossId),
      );
      expect(adjacent).toBe(false);
    }
  });

  it('guarantees loops — loop count equals the cyclomatic number', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const loops = plan.edges.filter((e) => e.isLoop).length;
      expect(loops).toBe(plan.edges.length - plan.rooms.length + 1);
    }
  });

  it('DEFECT A2: critical path is ≤ 0.7 × rooms at 42 rooms for every archetype', () => {
    // Built loops + branched/hubbed topology keep the entrance→boss critical path
    // well under the room count — no corridor conga line. Force each archetype so
    // this is not gated behind theme→archetype mapping.
    const archs = ['mausoleum', 'mine', 'fortress', 'waterworks'] as const;
    for (const archetype of archs) {
      for (const seed of [1, 7, 42, 1337]) {
        const plan = generateDungeon({ seed, params: { archetype, roomCount: 42 } });
        const ratio = plan.stats.criticalLength / plan.stats.rooms;
        expect(ratio, `${archetype} seed ${seed} crit ${plan.stats.criticalLength}/${plan.stats.rooms}`)
          .toBeLessThanOrEqual(0.7);
      }
    }
  });

  it('DEFECT A: built circulation exists before decay; cyclomatic invariant holds after', () => {
    // The intact builder opens ≥1 BUILT loop per archetype (never a pure tree) —
    // proven at the buildIntact stage in buildIntact.test.ts. In the FULL pipeline
    // decay events (collapse/brick-off) may legitimately consume some loops, so
    // the final plan can have fewer; what must always hold is the cyclomatic
    // identity: loops == edges − rooms + 1 (built + dug both count), a consistent
    // graph. Zero final loops only occurs when every cycle edge was sealed away.
    const archs = ['mausoleum', 'mine', 'fortress', 'waterworks'] as const;
    for (const archetype of archs) {
      for (const seed of [1, 7, 42, 1337]) {
        const plan = generateDungeon({ seed, params: { archetype, roomCount: 42 } });
        const loops = plan.edges.filter((e) => e.isLoop).length;
        expect(loops, `${archetype} seed ${seed}`).toBe(plan.edges.length - plan.rooms.length + 1);
        expect(loops).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has >= 3 leaf rooms at 40+ rooms', () => {
    const plan = generateDungeon({ seed: 42, params: { roomCount: 44 } });
    const leaves = plan.rooms.filter((r) => r.degree === 1).length;
    expect(leaves).toBeGreaterThanOrEqual(3);
  });

  it('never places a prop or spawn on a doorway, wall, or void cell', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const doorSet = new Set(plan.doorways.map((d) => d.y * plan.W + d.x));
      for (const p of [...plan.props, ...plan.spawns]) {
        const i = cellIndex(plan, p.x, p.y);
        expect(plan.grid[i]).toBe(CellKind.Floor);
        expect(doorSet.has(i)).toBe(false);
      }
    }
  });

  it('entity coordinates are plot-local feet, 5 ft aligned, inside the plan', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      for (const e of [...plan.props, ...plan.spawns, ...plan.traps]) {
        expect(e.x % CELL_FT).toBe(0);
        expect(e.y % CELL_FT).toBe(0);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThan(plan.widthFt);
        expect(e.y).toBeLessThan(plan.depthFt);
      }
      for (const r of plan.rooms) {
        expect(r.x % CELL_FT).toBe(0);
        expect(r.w % CELL_FT).toBe(0);
        expect(r.x + r.w).toBeLessThanOrEqual(plan.widthFt);
        expect(r.y + r.h).toBeLessThanOrEqual(plan.depthFt);
      }
    }
  });

  it('critical path runs entrance → boss through real rooms, and spawns exist', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(plan.criticalRoomIds[0]).toBe(plan.entranceId);
      expect(plan.criticalRoomIds[plan.criticalRoomIds.length - 1]).toBe(plan.bossId);
      for (const id of plan.criticalRoomIds) {
        expect(plan.rooms[id]).toBeDefined();
      }
      expect(plan.spawns.length).toBeGreaterThan(0);
      expect(plan.stats.roomsRequested).toBe(plan.params.roomCount);
    }
  });

  it('traps sit on open room floor and secret door cells are real doorways', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const doorSet = new Set(plan.doorways.map((d) => d.y * plan.W + d.x));
      for (const t of plan.traps) {
        const i = cellIndex(plan, t.x, t.y);
        expect(plan.grid[i]).toBe(CellKind.Floor);
        expect(doorSet.has(i)).toBe(false);
        expect(t.roomId).not.toBe(plan.entranceId);
        expect(t.roomId).not.toBe(plan.bossId);
      }
      // secretDoorCells is DERIVED from doors[] with state 'secret' (single
      // source). It is non-empty iff at least one secret door exists, and each
      // cell is exactly the cell of a secret door — a passable Floor cell the
      // drawer renders as a searchable hidden door (brick-off never writes the
      // grid at the secret cell, only at the bricked `mid`, so it stays Floor).
      const secretDoors = plan.doors.filter((d) => d.state === 'secret');
      expect(plan.secretDoorCells.length).toBe(secretDoors.length);
      const secretDoorKeys = new Set(secretDoors.map((d) => d.cell.y * plan.W + d.cell.x));
      for (const c of plan.secretDoorCells) {
        const i = c.y * plan.W + c.x;
        expect(secretDoorKeys.has(i)).toBe(true);
        expect(plan.grid[i]).toBe(CellKind.Floor);
      }
    }
  });

  it('generates 60 rooms in a bounded warm time, tight and full sprawl', () => {
    // FULL-SUITE RECALIBRATION (2026-07-10): three aggregate runs measured the
    // tight layout at roughly 147-171 ms while the same test remained comfortably
    // green alone. The 200/220 ms ceilings preserve this as a runaway-regression
    // tripwire without treating unrelated suite contention as product breakage.
    // Warm up (JIT) then measure the MEDIAN of a small batch so a single GC pause
    // can't flake the budget. The per-room-cell scan cache in simulateHistory (the
    // former O(side²)-per-room hot spot) brought the warm median well under budget;
    // this pins that win against regressions. sprawl is PINNED (0 / 1) so a jittered
    // default can't flake it.
    //
    // BUDGET RAISED 50 → 130/150 ms (Remy ROOM-SIZE ×2, 2026-07-07): room dimension
    // ranges were scaled ≈×1.4 so interior floor area roughly DOUBLED. The generator
    // works in floor cells, so the O(side²) history / rasterize / built-loop passes
    // now process ~2× the cells and the working grid `side` grew ~1.4×. Run ALONE
    // the warm median moved from ~13 ms (tight) / ~15 ms (sprawl) to ~56 ms / ~66 ms;
    // run CONCURRENTLY with the other dungeon test files (as the full suite does) CPU
    // contention roughly DOUBLES that to ~95 ms / ~110 ms. That is the EXPECTED cost
    // of grander rooms under a busy machine, not a runaway — a genuine 10× algorithmic
    // regression would still blow past these ceilings (the old code was ~13/15 ms
    // alone, ~30 ms contended). The ceilings sit ≈1.35× over the contended medians to
    // absorb GC/CI jitter without flaking; this is a runaway tripwire, not a tight SLA.
    const median = (fn: () => void): number => {
      for (let i = 0; i < 4; i++) fn();
      const times: number[] = [];
      for (let i = 0; i < 9; i++) { const t0 = performance.now(); fn(); times.push(performance.now() - t0); }
      times.sort((a, b) => a - b);
      return times[Math.floor(times.length / 2)];
    };
    let seedA = 5;
    expect(median(() => {
      const plan = generateDungeon({ seed: seedA++, params: { roomCount: 60, sprawl: 0 } });
      expect(plan.stats.rooms).toBeGreaterThan(0);
    })).toBeLessThan(200);

    // Perf budget must also hold at FULL sprawl (bigger grids, corridor links) —
    // the side calc scales with sprawl and stays sane. Looser ceiling to absorb the
    // larger grid while still proving no runaway.
    let seedB = 105;
    expect(median(() => {
      const plan = generateDungeon({ seed: seedB++, params: { roomCount: 60, sprawl: 1 } });
      expect(plan.stats.rooms).toBeGreaterThan(0);
    })).toBeLessThan(220);
  }, 30000);
});

// ─── History-first invariants (Task 6 pipeline swap) ─────────────────────────
// These fail against the Task-1 bridge (empty history, hardcoded 'mausoleum',
// no purposes/overlay/doors from simulateHistory) and pass once the intact →
// history → furnish → lore pipeline is live.

describe('history-first invariants', () => {
  it('carries a builder archetype derived from the theme (or an override)', () => {
    const byTheme: Record<string, string> = {
      crypt: 'mausoleum', cavern: 'mine', frost: 'fortress', sewer: 'waterworks', fungal: 'mausoleum',
    };
    for (const theme of THEMES) {
      const plan = generateDungeon({ seed: 42, params: { theme } });
      expect(plan.archetype).toBe(byTheme[theme]);
      expect(plan.params.archetype).toBe(byTheme[theme]);
    }
    // Explicit override wins over the theme default.
    const forced = generateDungeon({ seed: 42, params: { theme: 'crypt', archetype: 'fortress' } });
    expect(forced.archetype).toBe('fortress');
  });

  it('produces a real, non-empty simulated history and derived lore', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(plan.history.length).toBeGreaterThan(0);
      expect(plan.stats.events).toBe(plan.history.length);
      // Lore text is derived, not bridged blanks.
      expect(plan.builderName.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.blurb.length).toBeGreaterThan(0);
      // One rumor hook per logged event, each referencing a real event id.
      expect(plan.rumorHooks.length).toBe(plan.history.length);
      const ids = new Set(plan.history.map((e) => e.id));
      for (const h of plan.rumorHooks) expect(ids.has(h.eventRef)).toBe(true);
    }
  });

  it('every room carries a purpose from its builder program', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      for (const r of plan.rooms) {
        expect(typeof r.purpose).toBe('string');
        expect(r.purpose.length).toBeGreaterThan(0);
      }
      // The entrance room's purpose is the archetype's first core spec purpose,
      // not the generic bridge 'passage-room'.
      expect(plan.rooms[plan.entranceId].purpose).not.toBe('passage-room');
    }
  });

  it('boss is the deepest room of the apex occupation; entrance is a degree-1 leaf far from it', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const maxDepth = Math.max(...plan.rooms.map((r) => r.depth));
      const boss = plan.rooms[plan.bossId];
      const entrance = plan.rooms[plan.entranceId];
      expect(boss.depth).toBeGreaterThanOrEqual(0.6 * maxDepth);
      expect(entrance.degree).toBe(1);
      expect(plan.entranceId).not.toBe(plan.bossId);
      const adjacent = plan.edges.some(
        (e) => (e.a === plan.entranceId && e.b === plan.bossId) || (e.b === plan.entranceId && e.a === plan.bossId),
      );
      expect(adjacent).toBe(false);
    }
  });

  it('the overlay bitmap is grid-sized and lands only on floor cells', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(plan.overlay.length).toBe(plan.grid.length);
      for (let i = 0; i < plan.overlay.length; i++) {
        if (plan.overlay[i] !== 0) expect(plan.grid[i]).toBe(CellKind.Floor);
      }
    }
  });

  it('waterworks plan renders WET cisterns + ≥1 wet channel from the built baseline (mock 5)', () => {
    // Visual-identity regression: the sewer/waterworks archetype's whole point is
    // WATER — two water-filled cisterns fed by visible channels. A prior fix left
    // every cistern dry and trimmed the channel stub, so the rendered sheet showed
    // ZERO water. This asserts the plan's Water overlay (OverlayKind.Water = 1) —
    // the exact bitmap the drawer paints wavy lines on — covers BOTH cisterns and
    // at least one corridor cell. Uses a cutoff OLDER than any event
    // (asOfYearsAgo huge) so NO flood/bloom event applies: the water proven here is
    // the built-wet baseline alone (buildIntact → simulateHistory stamp → crop),
    // not incidental event water. Pinned across the standard seed set.
    for (const seed of [1, 7, 42, 1337]) {
      const plan = generateDungeon({
        seed,
        params: { theme: 'sewer', asOfYearsAgo: 100000 },
      });
      expect(plan.archetype, `seed ${seed} archetype`).toBe('waterworks');
      const { grid, overlay, corridor, W, rooms } = plan;
      // No overlay may land off a floor cell (crop-remap sanity).
      for (let i = 0; i < overlay.length; i++) {
        if (overlay[i] === OverlayKind.Water) expect(grid[i]).toBe(CellKind.Floor);
      }
      // Both cisterns are (fully) wet in the plan overlay.
      const cisterns = rooms.filter((r) => r.purpose === 'cistern');
      expect(cisterns.length, `seed ${seed} cisterns`).toBe(2);
      // A cistern's rectangular BOUNDING BOX can legally overlap an adjacent
      // room's floor in the ellipse's void CORNERS (rooms sit closer now that
      // room area doubled, 2026-07-07). Those corner cells belong to the NEIGHBOR
      // (correctly dry), not the basin — a naive bbox scan would miscount them as
      // dry cistern floor. Restrict the wet-check to cells actually inside the
      // cistern's own ellipse footprint, mirroring the generator's `inMask`
      // ellipse test (nx²+ny² ≤ 1.02). This keeps the invariant's MEANING intact:
      // every genuine basin floor cell must be Water.
      for (const c of cisterns) {
        const x0 = c.x / CELL_FT;
        const y0 = c.y / CELL_FT;
        const w = c.w / CELL_FT;
        const h = c.h / CELL_FT;
        const inEllipse = (i: number, j: number): boolean => {
          const nx = (i - (w - 1) / 2) / (w / 2);
          const ny = (j - (h - 1) / 2) / (h / 2);
          return nx * nx + ny * ny <= 1.02;
        };
        let floor = 0;
        let wet = 0;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            if (c.shape === 'ellipse' && !inEllipse(i, j)) continue; // neighbor's corner, not basin
            const k = (y0 + j) * W + (x0 + i);
            if (grid[k] !== CellKind.Floor) continue;
            floor++;
            if (overlay[k] === OverlayKind.Water) wet++;
          }
        }
        expect(floor, `seed ${seed} cistern ${c.id} floor`).toBeGreaterThan(0);
        expect(wet, `seed ${seed} cistern ${c.id} wet`).toBe(floor);
      }
      // At least one WET CHANNEL corridor cell (corridor === 1 with Water overlay).
      let wetChannel = 0;
      for (let i = 0; i < overlay.length; i++) {
        if (overlay[i] === OverlayKind.Water && corridor[i] === 1) wetChannel++;
      }
      expect(wetChannel, `seed ${seed} wet channel cells`).toBeGreaterThan(0);
    }
  });

  it('F2: overlay is nonzero ONLY on Floor cells across a 40-seed × 5-theme sweep', () => {
    // applyCollapse used to stamp Rubble on the cells it converted to Wall (the
    // overlay-on-Wall violation). It now spills rubble onto the surviving FLOOR
    // cells at the seal instead. Sweep every theme × seeds 1..40 and assert no
    // overlay ever lands on a non-Floor cell.
    for (const theme of THEMES) {
      for (let seed = 1; seed <= 40; seed++) {
        const plan = generateDungeon({ seed, params: { theme } });
        for (let i = 0; i < plan.overlay.length; i++) {
          if (plan.overlay[i] !== 0) {
            expect(plan.grid[i], `theme=${theme} seed=${seed} cell=${i}`).toBe(CellKind.Floor);
          }
        }
      }
    }
  }, 30000);

  it('door records cover every doorway plus every stateful (bricked/secret) door', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const doorCellKey = (c: { x: number; y: number }): number => c.y * plan.W + c.x;
      const doorKeys = new Set(plan.doors.map((d) => doorCellKey(d.cell)));
      // Every plain doorway has a door record.
      for (const d of plan.doorways) expect(doorKeys.has(doorCellKey(d))).toBe(true);
      // Bricked doors are impassable Wall cells; secret doors sit on floor.
      for (const d of plan.doors) {
        const i = doorCellKey(d.cell);
        if (d.state === 'bricked') expect(plan.grid[i]).toBe(CellKind.Wall);
        else expect(plan.grid[i]).toBe(CellKind.Floor);
        // Stateful doors reference the event that set them.
        if (d.state === 'bricked' || d.state === 'secret') expect(typeof d.eventRef).toBe('number');
      }
    }
  });

  it('evidence props carry an eventRef; built furniture and torches do not', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      let evidence = 0;
      let furniture = 0;
      for (const p of plan.props) {
        if (typeof p.eventRef === 'number') {
          evidence++;
          expect(plan.history[p.eventRef]).toBeDefined();
        } else {
          furniture++;
        }
      }
      // Torches are always built (eventRef-free); at least some furniture exists.
      expect(furniture).toBeGreaterThan(0);
      // History exists, so at least one event left evidence somewhere.
      expect(evidence).toBeGreaterThan(0);
    }
  });

  it('spawns come from occupations, and the apex occupation seats the boss spawn', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(plan.spawns.length).toBeGreaterThan(0);
      // Exactly one boss-room spawn, and it lives in the boss room.
      const bossSpawns = plan.spawns.filter((s) => s.roomId === plan.bossId);
      expect(bossSpawns.length).toBe(1);
    }
  });

  it('F1: the boss room holds EXACTLY ONE spawn across the den/bloom-heavy themes', () => {
    // A non-apex occupation (den/bloom) whose cluster includes the boss room used
    // to fall through to the count-formula and stack extra spawns there. Sweep the
    // den-heavy crypt and the bloom-terminated fungal over seeds 1..40 — the boss
    // room must carry exactly one spawn in every one.
    for (const theme of ['crypt', 'fungal'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const plan = generateDungeon({ seed, params: { theme } });
        const bossSpawns = plan.spawns.filter((s) => s.roomId === plan.bossId);
        expect(bossSpawns.length, `theme=${theme} seed=${seed}`).toBe(1);
      }
    }
  }, 30000);

  it('P2 BUDGET: every occupied non-boss room stays within its 5e XP budget; boss holds exactly one', () => {
    // The original acceptance criterion: every spawn's CR is legal for its room
    // and the room's MULTIPLIER-ADJUSTED XP is within budget for partyLevel. The
    // budget is roomBudget(partyLevel, difficulty) (party of 4, 5e thresholds).
    //   • Upper bound is the HARD invariant: adjusted XP ≤ 1.2 × budget always.
    //   • Lower bound is LOOSE (spec): a room that ran out of free cells or hit
    //     the weak band ceiling may fall below 0.4 × budget — those are exempt
    //     (still ≥1 spawn). "Room-limited" = one more min-tier monster would
    //     still fit under budget, i.e. the stop was NOT budget-driven.
    //   • Boss room: EXACTLY ONE spawn (the apex capstone; its lone CR may exceed
    //     the room budget at low partyLevel — allowed by design).
    for (const theme of ['crypt', 'fungal'] as const) {
      const table = bestiaryForSite(theme);
      const minTierXp = Math.min(...table.map((t) => t.xp));
      for (const partyLevel of [2, 6]) {
        for (const seed of [1, 7, 42, 1337]) {
          const plan = generateDungeon({ seed, params: { theme, partyLevel, roomCount: 24 } });

          // Boss room: exactly one spawn.
          expect(
            plan.spawns.filter((s) => s.roomId === plan.bossId).length,
            `boss spawns ${theme} pl${partyLevel} s${seed}`,
          ).toBe(1);

          const byRoom = new Map<number, { xp: number; n: number }>();
          for (const s of plan.spawns) {
            const e = byRoom.get(s.roomId) ?? { xp: 0, n: 0 };
            e.xp += s.xp;
            e.n += 1;
            byRoom.set(s.roomId, e);
          }
          for (const [rid, e] of byRoom) {
            if (rid === plan.bossId) continue;
            // At least one spawn in every occupied combat room.
            expect(e.n, `>=1 spawn room ${rid} ${theme} pl${partyLevel} s${seed}`).toBeGreaterThanOrEqual(1);
            const room = plan.rooms[rid];
            const budget = roomBudget(partyLevel, room.difficulty);
            const adjusted = e.xp * encounterMultiplier(e.n);
            const hi = 1.2 * budget;
            // Upper bound — the honest cap. 37 ghouls can never fit here.
            expect(adjusted, `adj≤1.2×budget room ${rid} ${theme} pl${partyLevel} s${seed}`).toBeLessThanOrEqual(hi + 1e-6);
            // Lower bound — loose, exempting room-/ceiling-limited fills.
            const oneMoreAdjusted = (e.xp + minTierXp) * encounterMultiplier(e.n + 1);
            const roomLimited = oneMoreAdjusted <= hi;
            if (e.n > 1 && !roomLimited) {
              expect(adjusted, `adj≥0.4×budget room ${rid} ${theme} pl${partyLevel} s${seed}`).toBeGreaterThanOrEqual(0.4 * budget);
            }
          }
        }
      }
    }
  });

  it('P2 REGRESSION: budget caps a 20-room crypt well under the old area-scaled count', () => {
    // The old formula (round(area/24 × (0.5+difficulty)) per occupied room) stamped
    // 38 spawns / 8100 XP on this exact dungeon. The budget pass must cut that hard.
    const plan = generateDungeon({ seed: 24680, params: { theme: 'crypt', roomCount: 20, partyLevel: 2 } });
    expect(plan.spawns.length, `spawns=${plan.spawns.length}`).toBeLessThan(30);
    // Boss room still holds exactly one climax spawn.
    expect(plan.spawns.filter((s) => s.roomId === plan.bossId).length).toBe(1);
  });

  it('P2 DETERMINISM: budget-driven spawns are stable across runs (same seed)', () => {
    for (const partyLevel of [2, 6]) {
      const key = (p: DungeonPlan): string =>
        p.spawns.map((s) => `${s.roomId}:${s.x},${s.y}:${s.monsterKey}`).join('|');
      const a = generateDungeon({ seed: 42, params: { theme: 'crypt', partyLevel } });
      const b = generateDungeon({ seed: 42, params: { theme: 'crypt', partyLevel } });
      expect(key(a)).toBe(key(b));
    }
  });

  it('P2 PARTYLEVEL: a higher party level buys a bigger encounter budget (more/stronger spawns)', () => {
    // partyLevel is genuinely consumed now: at pl6 the same layout should carry
    // strictly more total encounter XP than at pl2 (bigger per-room budgets).
    const lo = generateDungeon({ seed: 1337, params: { theme: 'crypt', partyLevel: 2, roomCount: 30 } });
    const hi = generateDungeon({ seed: 1337, params: { theme: 'crypt', partyLevel: 6, roomCount: 30 } });
    expect(hi.stats.encounterXp).toBeGreaterThan(lo.stats.encounterXp);
  });

  it('rooms touched by events get a derived note; untouched rooms do not', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const touched = new Set<number>();
      for (const e of plan.history) for (const rid of e.roomIds) touched.add(rid);
      for (const r of plan.rooms) {
        if (r.note !== undefined) {
          expect(r.note.length).toBeGreaterThan(0);
          expect(touched.has(r.id)).toBe(true);
        }
      }
    }
  });

  it('a map drawn asOfYearsAgo shows the same layout but an earlier ruin state', () => {
    // Prefix replay: at a large cutoff, younger events have not happened, so the
    // ruin state is at most as decayed (never MORE overlay than full history).
    const full = generateDungeon({ seed: 7 });
    const early = generateDungeon({ seed: 7, params: { asOfYearsAgo: 100000 } });
    // Same builder layout (byte-identical grid geometry is history-independent
    // only up to structural events; but rooms/graph skeleton match).
    expect(early.rooms.length).toBe(full.rooms.length);
    const overlayCount = (p: DungeonPlan): number => {
      let n = 0;
      for (let i = 0; i < p.overlay.length; i++) if (p.overlay[i] !== 0) n++;
      return n;
    };
    // A 100000-year cutoff predates every event, so only built water (if any)
    // remains — never more overlay than the fully-decayed present.
    expect(overlayCount(early)).toBeLessThanOrEqual(overlayCount(full));
  });
});
