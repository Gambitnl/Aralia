import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { generateBuilding } from '../generateBuilding';
import { renderBlueprintSvg, fitLabel, LABEL_CHAR_W } from '../renderBlueprintSvg';
import { generateHousehold } from '../../town/household';
import { briefFromHousehold } from '../../town/householdBrief';
import { computeOccupancy } from '../occupancy';
import { containerManifests } from '../manifests';

const CELL = 25; // px per 5 ft cell (matches the renderer)

describe('renderBlueprintSvg', () => {
  const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(7), storeys: 2, basement: true });
  const ground = plan.floors.find((f) => f.level === 0)!;

  it('emits one <svg> with a viewBox', () => {
    const svg = renderBlueprintSvg(plan, 0);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox=');
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
  });

  it('draws a scale bar and a room number for every non-corridor room', () => {
    const svg = renderBlueprintSvg(plan, 0);
    expect(svg).toContain('data-scale-bar');
    // brief note: floors[0] may be the basement — assert on the GROUND floor
    const nonCorridor = ground.rooms.filter((r) => !r.isCorridor).length;
    const nums = [...svg.matchAll(/data-room-num="(\d+)"/g)].map((m) => Number(m[1]));
    expect(nums.length).toBe(nonCorridor);
    expect([...nums].sort((a, b) => a - b)).toEqual(Array.from({ length: nonCorridor }, (_, i) => i + 1));
  });

  it('interior door leaves are 3 ft, not a full 5 ft cell', () => {
    const svg = renderBlueprintSvg(plan, 0);
    // door leaves carry data-door-ft; none may be 5
    const fts = [...svg.matchAll(/data-door-ft="([0-9.]+)"/g)].map((m) => Number(m[1]));
    expect(fts.length).toBeGreaterThan(0);
    expect(fts.every((f) => f <= 3)).toBe(true);
  });

  it('renders one door leaf per door on the ground floor', () => {
    const svg = renderBlueprintSvg(plan, 0);
    const leaves = (svg.match(/data-door-ft=/g) ?? []).length;
    expect(leaves).toBe(ground.doors.length);
  });

  it('draws sheet furniture: north arrow, title block, legend, apron', () => {
    const svg = renderBlueprintSvg(plan, 0, { seed: 7 });
    expect(svg).toContain('data-north');
    expect(svg).toContain('data-title-block');
    expect(svg).toContain('seed 7');
    expect(svg).toContain('data-legend');
    expect(svg).toContain('data-apron');
  });

  it('every rendered room label fits its room width bound (abbreviate/wrap/drop)', () => {
    // Independent oracle over the same fit rules the renderer uses: for every
    // non-corridor room on every floor, the fitted lines' estimated pixel
    // width must fit the contiguous cell run through the room's anchor.
    const fs = 10.5;
    for (const floor of plan.floors) {
      for (const rm of floor.rooms) {
        if (rm.isCorridor) continue;
        const cellSet = new Set(rm.cells.map((c) => `${c.cx},${c.cy}`));
        let x0 = rm.anchor.cx;
        let x1 = rm.anchor.cx;
        while (cellSet.has(`${x0 - 1},${rm.anchor.cy}`)) x0--;
        while (cellSet.has(`${x1 + 1},${rm.anchor.cy}`)) x1++;
        const widthBound = (x1 - x0 + 1) * CELL - 6;
        const lines = fitLabel(rm.purpose.replace(/-/g, ' '), widthBound, fs);
        if (lines === null) continue; // dropped: acceptable for tiny rooms
        for (const line of lines) {
          expect(line.length * LABEL_CHAR_W * fs).toBeLessThanOrEqual(widthBound);
        }
      }
    }
  });

  it('fitLabel drops labels that cannot fit and never returns an overflowing line', () => {
    expect(fitLabel('common room', 10, 10.5)).toBeNull();
    const wrapped = fitLabel('common room', 46, 10.5);
    expect(wrapped).not.toBeNull();
    for (const line of wrapped!) expect(line.length * LABEL_CHAR_W * 10.5).toBeLessThanOrEqual(46);
  });

  it('renders the basement (level -1) with zero windows', () => {
    const svg = renderBlueprintSvg(plan, -1);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('data-window');
    expect(svg).toContain('Basement');
  });

  it('is deterministic — identical output for identical input', () => {
    expect(renderBlueprintSvg(plan, 0, { seed: 7 })).toBe(renderBlueprintSvg(plan, 0, { seed: 7 }));
  });

  it('throws honestly on a missing floor level', () => {
    expect(() => renderBlueprintSvg(plan, 5)).toThrow(/no floor at level 5/);
  });
});

// ---- Fix 1: furniture legibility ------------------------------------------
describe('renderBlueprintSvg furniture legibility', () => {
  // A tavern carries a wide spread of furnishing kinds across its floors.
  const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(7), storeys: 2, basement: true });

  /** Every distinct furnishing kind that appears anywhere in the plan. */
  const kindsPresent = new Set<string>();
  for (const f of plan.floors) for (const fn of f.furnishings) kindsPresent.add(fn.kind);

  it('every furnishing element carries a data-kind attribute and a <title> naming its kind', () => {
    for (const floor of plan.floors) {
      const svg = renderBlueprintSvg(plan, floor.level);
      // one data-kind per furnishing on this floor
      const kinds = [...svg.matchAll(/data-kind="([^"]+)"/g)].map((m) => m[1]);
      expect(kinds.length).toBe(floor.furnishings.length);
      // and the multiset of kinds matches the floor's furnishings exactly
      expect(kinds.slice().sort()).toEqual(floor.furnishings.map((f) => f.kind).slice().sort());
      // every furnishing kind on the floor appears inside a <title> tooltip
      for (const f of floor.furnishings) {
        expect(svg).toContain(`<title>${f.kind}</title>`);
      }
    }
  });

  it('renders distinct silhouettes for the common kinds (bed pillow, chest lid, barrel ring, hearth hatching)', () => {
    // Build a synthetic single-floor plan exercising each glyph deterministically
    // by rendering the tavern and asserting the marker paths appear when the kind
    // is present. (The tavern seed carries beds, hearths, barrels, chests, etc.)
    const svg0 = renderBlueprintSvg(plan, 0);
    const svgB = renderBlueprintSvg(plan, -1);
    const allSvg = svg0 + svgB + renderBlueprintSvg(plan, 1);
    if (kindsPresent.has('bed')) expect(allSvg).toContain('data-glyph="bed-pillow"');
    if (kindsPresent.has('chest')) expect(allSvg).toContain('data-glyph="chest-lid"');
    if (kindsPresent.has('barrel')) expect(allSvg).toContain('data-glyph="barrel-ring"');
    if (kindsPresent.has('hearth') || kindsPresent.has('forge-hearth')) {
      expect(allSvg).toContain('data-glyph="hearth-hatch"');
    }
    if (kindsPresent.has('shelf') || kindsPresent.has('counter')) {
      expect(allSvg).toContain('data-glyph="shelf-edge"');
    }
    if (kindsPresent.has('workbench')) expect(allSvg).toContain('data-glyph="workbench-dot"');
  });

  it('XML-escapes a furnishing kind containing markup characters in its <title>', () => {
    // Deep-clone the ground floor and inject a hostile kind string.
    const evil = JSON.parse(JSON.stringify(plan)) as typeof plan;
    const gf = evil.floors.find((f) => f.level === 0)!;
    gf.furnishings.push({ kind: 'a<b>&"c', roomId: gf.rooms[0].id, x: gf.rooms[0].anchor.cx * 5 + 2.5, y: gf.rooms[0].anchor.cy * 5 + 2.5, rotation: 0 });
    const svg = renderBlueprintSvg(evil, 0);
    expect(svg).toContain('<title>a&lt;b&gt;&amp;&quot;c</title>');
    expect(svg).not.toContain('<title>a<b>');
  });
});

// ---- Fix 2: layout overflow (legend/cartouche never cover the apron) --------
describe('renderBlueprintSvg layout overflow', () => {
  const CELL_PX = 25;
  const ML = 34; // matches the renderer's sheet margin

  /** Parse the emitted SVG size + plan-content bbox (grid+apron) from coords. */
  function geometry(plan: ReturnType<typeof generateBuilding>, level: number) {
    const svg = renderBlueprintSvg(plan, level);
    const wh = svg.match(/^<svg width="([0-9.]+)" height="([0-9.]+)"/)!;
    const W = Number(wh[1]);
    const H = Number(wh[2]);
    const floor = plan.floors.find((f) => f.level === level)!;
    const cols = Math.round(plan.widthFt / 5);
    const rows = Math.round(plan.depthFt / 5);
    // grid+apron bbox: apron extends one cell beyond the grid on every side
    const gridW = cols * CELL_PX;
    const gridH = rows * CELL_PX;
    const bbox = {
      x0: ML - CELL_PX,
      y0: ML - CELL_PX,
      x1: ML + gridW + CELL_PX,
      y1: ML + gridH + CELL_PX,
    };
    // legend box: the group's leftmost text x and full column extent
    const legendXs = [...svg.matchAll(/data-legend="1">[\s\S]*?<\/g>/g)];
    const lx = Number(svg.match(/<g data-legend="1"><text x="([0-9.]+)"/)![1]);
    // title-block cartouche rect
    const tb = svg.match(/data-title-block="1"><rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/)!;
    const cartouche = { x: Number(tb[1]), y: Number(tb[2]), w: Number(tb[3]), h: Number(tb[4]) };
    // scale bar left edge (also in the bottom strip)
    return { svg, W, H, bbox, lx, cartouche };
  }

  it('55×40 tenement (seed 814084969): legend column and title cartouche never overlap the grid+apron bbox', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'tenement', seedPath: rootSeedPath(814084969), storeys: 2 });
    const { W, H, bbox, lx, cartouche } = geometry(plan, 0);
    // legend starts strictly to the RIGHT of the apron's right edge
    expect(lx).toBeGreaterThanOrEqual(bbox.x1);
    // title cartouche sits strictly BELOW the apron's bottom edge
    expect(cartouche.y).toBeGreaterThanOrEqual(bbox.y1);
    // and the whole sheet contains both the apron bbox and the furniture
    expect(W).toBeGreaterThanOrEqual(bbox.x1);
    expect(H).toBeGreaterThanOrEqual(cartouche.y + cartouche.h);
    // cartouche fits within the sheet width
    expect(cartouche.x + cartouche.w).toBeLessThanOrEqual(W);
  });

  it('a small plan does not waste canvas: sheet is sized close to its content, not padded to a large fixed size', () => {
    const small = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(3), storeys: 1 });
    const { W, H, bbox } = geometry(small, 0);
    // the sheet is not egregiously larger than the content bbox + legend + title
    // (allow the legend column + title strip, but no acres of empty canvas)
    expect(W).toBeLessThanOrEqual(bbox.x1 + 200);
    expect(H).toBeLessThanOrEqual(bbox.y1 + 120);
  });
});

describe('renderBlueprintSvg roof overlay (BGv2 Task 6)', () => {
  const styled = generateBuilding({
    buildingId: 1, type: 'tavern', seedPath: rootSeedPath(759381890), storeys: 2, basement: false,
    style: { cultureType: 'Highland', climate: 'cold', wealth: 'poor', ageBand: 'new' },
  });

  it('roof extra ⇒ one <g data-roof> whose element counts match the RoofPlan', () => {
    expect(styled.roof).toBeDefined();
    const roof = styled.roof!;
    const svg = renderBlueprintSvg(styled, 0, { roof });
    expect((svg.match(/<g data-roof="1"/g) ?? []).length).toBe(1);
    expect((svg.match(/data-roof-plane=/g) ?? []).length).toBe(roof.planes.length);
    expect((svg.match(/data-roof-ridge=/g) ?? []).length).toBe(roof.ridges.length);
    expect((svg.match(/data-roof-valley=/g) ?? []).length).toBe(roof.valleys.length);
    expect((svg.match(/data-roof-chimney=/g) ?? []).length).toBe(roof.chimneys.length);
    expect((svg.match(/data-roof-dormer=/g) ?? []).length).toBe(roof.dormers.length);
    expect((svg.match(/data-roof-cap=/g) ?? []).length).toBe(roof.towerCaps.length);
  });

  it('no roof extra ⇒ no roof group; existing callers unchanged', () => {
    const svg = renderBlueprintSvg(styled, 0);
    expect(svg).not.toContain('data-roof');
  });

  it('roof overlay is deterministic', () => {
    const a = renderBlueprintSvg(styled, 0, { roof: styled.roof! });
    const b = renderBlueprintSvg(styled, 0, { roof: styled.roof! });
    expect(a).toBe(b);
  });
});

describe('renderBlueprintSvg occupancy overlay', () => {
  // Matched (plan, household) pair — the SAME pattern the occupancy tests use:
  // the brief the plan is designed for is coarsened from the named household,
  // so plan slot tags and household member names line up. Single-storey
  // cottage, no basement: every station lives on level 0.
  const seed = 42;
  const town = rootSeedPath(seed);
  const household = generateHousehold(town, 'b42', 5, 'cottage');
  const brief = briefFromHousehold(household, { wealth: 'common', worksAtHome: false });
  const plan = generateBuilding({
    buildingId: 1, type: 'cottage', seedPath: town, storeys: 1, household: brief,
  });
  const occupancy = computeOccupancy(plan, household, { worksAtHome: false });
  const manifests = containerManifests(plan, brief, town);

  it('renders a <g data-occupancy> with claim labels and one station dot per member at 02:00', () => {
    const svg = renderBlueprintSvg(plan, 0, {
      seed, occupancy, manifests, hour: 2, members: household.members,
    });
    expect(svg).toContain('data-occupancy');
    // every claim on this floor gets a forSlot label under the room number
    const claimTags = [...svg.matchAll(/data-claim="([^"]+)"/g)].map((m) => m[1]);
    const level0Claims = occupancy.claims.filter((c) => c.level === 0);
    expect(level0Claims.length).toBeGreaterThan(0);
    expect(claimTags.sort()).toEqual(level0Claims.map((c) => c.slotTag).sort());
    // at 02:00 everyone is asleep at home on the single floor: one dot each
    const stations = svg.match(/data-station="/g) ?? [];
    expect(stations.length).toBe(household.members.length);
    // each dot is labeled with the member's GIVEN name (first token)
    for (const m of household.members) {
      expect(svg).toContain(`>${m.name.split(' ')[0]}<`);
    }
  });

  it('members who are out at the chosen hour get no dot', () => {
    // 11:00 — worksAtHome false: adults are out, children (odd hour) are out
    const svg = renderBlueprintSvg(plan, 0, {
      seed, occupancy, manifests, hour: 11, members: household.members,
    });
    const homeAt11 = occupancy.stationsByHour[11].filter(
      (st) => st.where === 'home' && st.level === 0,
    ).length;
    expect((svg.match(/data-station="/g) ?? []).length).toBe(homeAt11);
  });

  it('lit hearth at 19:00 gets a warm halo; none at 03:00', () => {
    const hasHearth = plan.floors[0].furnishings.some(
      (f) => f.kind === 'hearth' || f.kind === 'forge-hearth',
    );
    const svg19 = renderBlueprintSvg(plan, 0, {
      seed, occupancy, manifests, hour: 19, members: household.members,
    });
    if (hasHearth && occupancy.flags.hearthLitHours[19]) {
      expect(svg19).toContain('data-hearth-halo');
    }
    const svg3 = renderBlueprintSvg(plan, 0, {
      seed, occupancy, manifests, hour: 3, members: household.members,
    });
    expect(svg3).not.toContain('data-hearth-halo');
  });

  it('container markers carry <title> tooltips listing the manifest entries', () => {
    const svg = renderBlueprintSvg(plan, 0, {
      seed, occupancy, manifests, hour: 2, members: household.members,
    });
    const level0 = manifests.filter((m) => m.level === 0);
    expect((svg.match(/data-container="/g) ?? []).length).toBe(level0.length);
    for (const m of level0) {
      for (const e of m.entries) expect(svg).toContain(e.itemId);
    }
  });

  it('no occupancy passed → no overlay group; existing callers unchanged', () => {
    const svg = renderBlueprintSvg(plan, 0, { seed });
    expect(svg).not.toContain('data-occupancy');
    expect(svg).not.toContain('data-station');
    expect(svg).not.toContain('data-claim');
  });

  it('overlay is deterministic', () => {
    const opts = { seed, occupancy, manifests, hour: 19, members: household.members };
    expect(renderBlueprintSvg(plan, 0, opts)).toBe(renderBlueprintSvg(plan, 0, opts));
  });

  it('throws on a HOME station whose room cannot be resolved (no (0,0) corner-drop)', () => {
    // No-fallback: a home station must resolve to a real room. A missing room is
    // a schedule/plan mismatch, not a silent (0,0) placement at the sheet corner.
    const bad = JSON.parse(JSON.stringify(occupancy)) as typeof occupancy;
    bad.stationsByHour[8] = [
      { memberIndex: 0, hour: 8, where: 'home', level: 0, roomId: 999999, activity: 'chores' },
    ];
    expect(() =>
      renderBlueprintSvg(plan, 0, { seed, occupancy: bad, hour: 8, members: household.members }),
    ).toThrow(/room/i);
  });
});
