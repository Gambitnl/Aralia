import { traceRivers } from '../rivers';

it('returns no rivers when there is no land', () => {
  const cols = 4;
  const rows = 4;
  const heights = new Array(cols * rows).fill(10);
  expect(traceRivers(heights, cols, rows, 1)).toEqual([]);
});

it('traces a river down a single-slope ridge to the sea', () => {
  const cols = 6;
  const rows = 1;
  const heights = [80, 70, 60, 40, 25, 10];
  const rivers = traceRivers(heights, cols, rows, 1);
  expect(rivers.length).toBeGreaterThanOrEqual(1);
  const main = rivers[0];
  expect(main.points[0].x).toBeLessThan(5);
  expect(main.points[main.points.length - 1].x).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < main.discharge.length; i++) {
    expect(main.discharge[i]).toBeGreaterThanOrEqual(main.discharge[i - 1]);
  }
});

it('is deterministic for a given seed and heightmap', () => {
  const cols = 8;
  const rows = 8;
  const heights = new Array(cols * rows).fill(0).map((_, i) => 80 - i);
  const a = traceRivers(heights, cols, rows, 1);
  const b = traceRivers(heights, cols, rows, 1);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

it('the last width entry duplicates the second-to-last', () => {
  const cols = 6;
  const rows = 1;
  const heights = [80, 70, 60, 40, 25, 10];
  const rivers = traceRivers(heights, cols, rows, 1);
  expect(rivers.length).toBeGreaterThanOrEqual(1);
  const r = rivers[0];
  expect(r.width.length).toBeGreaterThanOrEqual(2);
  expect(r.width[r.width.length - 1]).toBe(r.width[r.width.length - 2]);
});

it('tributary river records its parentId when joining a trunk', () => {
  // A 7x3 heightmap with two branches that merge.
  // Layout (y rows top to bottom):
  //   row 0: 70 60 50 40 30 25 15
  //   row 1: 80 70 60 50 40 25 15   <- trunk descends along this row
  //   row 2: 70 60 50 40 30 25 15
  // Both row 0 and row 2 will source rivers that descend into row 1's path.
  const cols = 7;
  const rows = 3;
  const heights = [
    70, 60, 50, 40, 30, 25, 15,
    80, 70, 60, 50, 40, 25, 15,
    70, 60, 50, 40, 30, 25, 15,
  ];
  const rivers = traceRivers(heights, cols, rows, 1);
  // The trunk source is the highest point (cell (0,1), height 80).
  // Tributary sources are (0,0) height 70 and (0,2) height 70.
  // At least one river should have a parentId pointing at the trunk.
  const withParents = rivers.filter((r) => r.parentId !== undefined);
  expect(withParents.length).toBeGreaterThanOrEqual(1);
});

it('basin-locked cell (all neighbors higher) is not emitted as a source', () => {
  // 3x3 with center cell lowest among land cells (a pit).
  // Cell (1,1) has height 25; all 8 neighbors are 50.
  const cols = 3;
  const rows = 3;
  const heights = [
    50, 50, 50,
    50, 25, 50,
    50, 50, 50,
  ];
  // No river should "originate" from the pit (it has no descent).
  // Other cells flow INTO the pit, so the pit is a sink.
  const rivers = traceRivers(heights, cols, rows, 1);
  // The pit cell is at index 4 ((1,1)). It should not appear as a river's points[0].
  for (const r of rivers) {
    const start = r.points[0];
    expect(!(Math.floor(start.x) === 1 && Math.floor(start.y) === 1)).toBe(true);
  }
});
