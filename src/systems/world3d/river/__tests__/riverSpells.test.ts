/** Spells reshape the live river's ground, and the water reacts by its own
 * physics with no water made or lost (2026-10-25). The original reach stands
 * in for the seven-falls course: same solver, a grid that builds in seconds. */
import { afterEach, describe, expect, it } from 'vitest';
import { LiveRiver } from '../riverLive';
import { courseKeyAt, setRiverCourseEdit, setRiverShape } from '../riverReach';
import { setRiverHeadwaters } from '../riverHeadwaters';
import { riverSpellCommands, type RiverSpellCast } from '../riverSpells';

afterEach(() => { setRiverShape(null); setRiverCourseEdit(null); setRiverHeadwaters(false); });

/** A point on the course at design s, n meters to the left of the flow. */
function at(live: LiveRiver, s: number, n: number) {
  const p = live.course.at(s);
  const x = p.x - p.tz * n, z = p.z + p.tx * n;
  const g = live.grid, i = Math.floor((x - g.x0) / g.dx), j = Math.floor((z - g.z0) / g.dx);
  return { x, z, c: j * g.nx + i };
}
const level = (live: LiveRiver, c: number) => live.solver.bed[c] + live.solver.h[c];
let stroke = 1;
const cast = (live: LiveRiver, c: RiverSpellCast) => live.applyTerrainBrushBatch(riverSpellCommands(c, stroke++));
/** The deepest water across a cross-section at s (the low flow fills only a
 * few middle meters of the design channel, so a mean would mostly read dry bank). */
function sectionDepth(live: LiveRiver, s: number): number {
  const half = courseKeyAt(s).halfW; let top = 0;
  for (let n = -half; n <= half; n += 0.5) top = Math.max(top, live.solver.h[at(live, s, n).c]);
  return top;
}

describe('river spells', () => {
  it('a hole dug beside the river and joined to it by a channel fills to the river level', () => {
    const live = new LiveRiver(); live.startCold(); live.advance(Infinity, 20);
    const s = live.course.samples[Math.floor(live.course.samples.length * .45)].s, half = courseKeyAt(s).halfW;
    // At the low summer flow the water fills only the middle few meters of the
    // design channel. Move Earth reaches 40 ft (12.2 m): cut the channel from
    // the water in the middle to a hole dug 11 m out, on the dry bank.
    void half;
    const hole = at(live, s, 11), shore = at(live, s, 0);
    const v0 = live.solver.volume();
    cast(live, { spell: 'mold-earth', x: hole.x, z: hole.z });
    cast(live, { spell: 'move-earth', x: shore.x, z: shore.z, x2: hole.x, z2: hole.z });
    // No water is made or lost by the edits themselves.
    expect(live.solver.volume()).toBeCloseTo(v0, 9);
    expect(live.editLostM3 + live.editAddedM3).toBeLessThan(1e-9);
    expect(live.solver.h[hole.c]).toBe(0);
    live.advance(Infinity, 120);
    // The hole now holds water up to about the river's own level.
    expect(live.solver.h[hole.c]).toBeGreaterThan(0.3);
    expect(Math.abs(level(live, hole.c) - level(live, shore.c))).toBeLessThan(0.25);
  }, 240000);

  it('a dam ponds the river behind it, starves the river below, and a breach floods it', () => {
    const run = (dam: boolean) => {
      const live = new LiveRiver(); live.startCold(); live.advance(Infinity, 20);
      const n = live.course.samples.length, sDam = live.course.samples[Math.floor(n * .5)].s;
      // Gauges just above and below the dam: the pond spreads upstream slowly at 1.5 m3/s.
      const sUp = live.course.samples[Math.floor(n * .48)].s, sDown = live.course.samples[Math.floor(n * .53)].s;
      // Wall of Stone reaches 100 ft (30.5 m): span the channel and 3 m of each bank.
      const half = courseKeyAt(sDam).halfW + 3, a = at(live, sDam, -half), b = at(live, sDam, half);
      const v0 = live.solver.volume();
      if (dam) cast(live, { spell: 'wall-of-stone', x: a.x, z: a.z, x2: b.x, z2: b.z });
      const editError = live.solver.volume() - v0;
      live.advance(Infinity, 150);
      return { live, sDam, sUp, sDown, editError, up: sectionDepth(live, sUp), down: sectionDepth(live, sDown), mid: at(live, sDam, 0) };
    };
    const free = run(false), dammed = run(true);
    expect(Math.abs(dammed.editError)).toBeLessThan(1e-9);
    // Behind the dam the water stands deeper; below it the river runs thinner.
    expect(dammed.up).toBeGreaterThan(free.up + 0.03);
    expect(dammed.down).toBeLessThan(free.down - 0.02);
    // Disintegrate the middle of the wall: the pond rushes out downstream.
    const before = dammed.down, v0 = dammed.live.solver.volume();
    cast(dammed.live, { spell: 'disintegrate', x: dammed.mid.x, z: dammed.mid.z });
    expect(Math.abs(dammed.live.solver.volume() - v0)).toBeLessThan(1e-9);
    dammed.live.advance(Infinity, 25);
    expect(sectionDepth(dammed.live, dammed.sDown)).toBeGreaterThan(before + 0.02);
  }, 400000);
});
