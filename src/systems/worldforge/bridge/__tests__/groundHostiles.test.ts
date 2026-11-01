/**
 * @file groundHostiles.test.ts
 * Verifies deterministic hostile spawn derivation for ground mode.
 *
 * Tests cover:
 * - Determinism: same inputs → same outputs (bit-identical).
 * - Marker → creature mapping: brigands produce bandits, etc.
 * - Peaceful windows: no markers → empty hostiles (hard rule).
 * - Out-of-window markers are excluded.
 * - Zone context utility returns correct boolean.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { RegionMarker, RegionZone } from '../../artifacts';
import { generateGroundHostiles, hasHostileZoneContext, DUNGEON_ENTRANCE_MARKER_TYPES } from '../groundHostiles';

// ============================================================================
// Fixtures
// ============================================================================

/** Standard local window bounds for tests: 500×500 feet at origin. */
const DEFAULT_BOUNDS = { x: 0, y: 0, width: 500, height: 500 };

function makeMarker(type: string, x: number, y: number): RegionMarker {
  return { type, icon: '⚔️', x, y };
}

// ============================================================================
// Tests
// ============================================================================


describe('source group provenance',()=>{
  it('keeps source groups stable when unrelated peaceful records precede them',()=>{
    const marker=makeMarker('brigands',200,200),zone={type:'Invasion',name:'Source invasion'};
    const original=generateGroundHostiles([marker],[zone],1,0,0,500,500);
    const inserted=generateGroundHostiles([makeMarker('statues',100,100),marker],[{type:'Festival',name:'Quiet event'},zone],1,0,0,500,500);
    expect(inserted).toEqual(original);
  });

  it('preserves prior IDs, counts, names, geometry and unchanged profiles across sixteen seeded scenarios',()=>{
    const markers=[makeMarker('brigands',200,200),makeMarker('brigands',350,350)];
    const zones=[{type:'Invasion',name:'Source invasion'},{type:'Rebels',name:'Source rebels'}];
    const outputs=Array.from({length:16},(_,i)=>generateGroundHostiles(markers,zones,i+1,0,0,500,500)
      .map(({sourceGroup,...original})=>original.name==='Highwayman' ? {...original,monsterId:'Bandit'} : original));
    // The original oracle predates the owner-approved CR3 profile binding.
    // Normalize only that explicit Highwayman reference for this historical
    // roster/geometry check. The real-catalog Highwayman contract separately
    // requires Warrior Veteran; every other field and profile stays protected.
    expect(createHash('sha256').update(JSON.stringify(outputs)).digest('hex')).toBe('9b1d4541d9a1706cb24060fc2542289cf066c03df59b88ba36f301770585836a');
  });

  it('keeps every marker pack member attached to its exact source cohort',()=>{
    const markers=[makeMarker('brigands',200,200),makeMarker('brigands',350,350)];
    const hostiles=generateGroundHostiles(markers,undefined,1,0,0,500,500);
    expect(new Set(hostiles.map(h=>h.sourceGroup?.key)).size).toBe(2);
    for(const h of hostiles){
      expect(h.sourceGroup?.kind).toBe('marker');
      expect(h.sourceGroup?.memberIds).toEqual(hostiles.filter(o=>o.sourceGroup?.key===h.sourceGroup?.key).map(o=>o.id));
    }
  });
  it('does not turn independently scattered zone bodies into a distant formation',()=>{
    const h=generateGroundHostiles(undefined,[{type:'Invasion',name:'Source invasion'}],1,0,0,500,500);
    for(const body of h)expect(body.sourceGroup).toMatchObject({kind:'zone',memberIds:[body.id]});
  });
});

describe('generateGroundHostiles', () => {
  it('returns empty array when markers is undefined', () => {
    const result = generateGroundHostiles(
      undefined, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result).toEqual([]);
  });

  it('returns empty array when markers is empty', () => {
    const result = generateGroundHostiles(
      [], undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result).toEqual([]);
  });

  it('returns empty for peaceful markers (statues, ruins, fairs)', () => {
    const markers: RegionMarker[] = [
      makeMarker('statues', 100, 100),
      makeMarker('ruins', 200, 200),
      makeMarker('fairs', 300, 300),
      makeMarker('water-sources', 150, 150),
    ];
    const result = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result).toEqual([]);
  });

  it('produces hostiles from a brigands marker', () => {
    const markers: RegionMarker[] = [makeMarker('brigands', 250, 250)];
    const result = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const h of result) {
      expect(h.id).toMatch(/^wf-hostile-marker-brigands-/);
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.monsterId.length).toBeGreaterThan(0);
      expect(h.xM).toBeGreaterThanOrEqual(0);
      expect(h.zM).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces hostiles from multiple marker types', () => {
    // Pillar 2 seam: dungeon-flavored types (caves/dungeons/…) now surface as
    // sealed-door ENTRANCES, not surface swarms — so this uses only NON-dungeon
    // hostile types (see the dedicated seam test below for the excluded types).
    const markers: RegionMarker[] = [
      makeMarker('brigands', 100, 100),
      makeMarker('hill-monsters', 300, 300),
      makeMarker('pirates', 400, 400),
    ];
    const result = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    const ids = result.map((h) => h.id);
    expect(ids.some((id) => id.includes('brigands'))).toBe(true);
    expect(ids.some((id) => id.includes('hill-monsters'))).toBe(true);
    expect(ids.some((id) => id.includes('pirates'))).toBe(true);
  });

  it('dungeon-flavored markers no longer spawn SURFACE hostiles (Pillar 2 seam)', () => {
    // These four types are claimed by the world-grown dungeon layer and surface
    // as entrances (GroundWorld.dungeonEntrances) instead — no double spawn.
    for (const type of DUNGEON_ENTRANCE_MARKER_TYPES) {
      const result = generateGroundHostiles(
        [makeMarker(type, 250, 250)], undefined, 42,
        DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
        DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
      );
      expect(result).toHaveLength(0);
    }
  });

  it('is deterministic — same inputs produce identical output', () => {
    const markers: RegionMarker[] = [
      makeMarker('brigands', 200, 200),
      makeMarker('hill-monsters', 350, 350),
    ];
    const a = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    const b = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(a).toEqual(b);
  });

  it('different seeds produce different spawn positions', () => {
    const markers: RegionMarker[] = [makeMarker('brigands', 200, 200)];
    const a = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    const b = generateGroundHostiles(
      markers, undefined, 99,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    // At least one creature position should differ (overwhelmingly likely)
    const positionsA = a.map((h) => `${h.xM.toFixed(4)},${h.zM.toFixed(4)}`).join('|');
    const positionsB = b.map((h) => `${h.xM.toFixed(4)},${h.zM.toFixed(4)}`).join('|');
    expect(positionsA).not.toBe(positionsB);
  });

  it('excludes markers outside the local window', () => {
    // Local window at offset (1000, 1000) — marker at (100, 100) is outside
    const markers: RegionMarker[] = [makeMarker('brigands', 100, 100)];
    const result = generateGroundHostiles(
      markers, undefined, 42,
      1000, 1000, 500, 500,
    );
    expect(result).toEqual([]);
  });

  it('includes markers just inside the window', () => {
    const markers: RegionMarker[] = [makeMarker('brigands', 1, 1)];
    const result = generateGroundHostiles(
      markers, undefined, 42,
      0, 0, 500, 500,
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('clamps creature positions to artifact bounds', () => {
    const markers: RegionMarker[] = [makeMarker('brigands', 0, 0)];
    const extentXM = 500 * 0.3048;
    const extentZM = 500 * 0.3048;
    const result = generateGroundHostiles(
      markers, undefined, 42,
      0, 0, 500, 500,
    );
    for (const h of result) {
      expect(h.xM).toBeGreaterThanOrEqual(0);
      expect(h.xM).toBeLessThanOrEqual(extentXM);
      expect(h.zM).toBeGreaterThanOrEqual(0);
      expect(h.zM).toBeLessThanOrEqual(extentZM);
    }
  });

  it('brigands map to valid creature templates', () => {
    const markers: RegionMarker[] = [makeMarker('brigands', 250, 250)];
    const validNames = new Set(['Bandit', 'Bandit Captain', 'Highwayman']);
    const result = generateGroundHostiles(
      markers, undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    for (const h of result) {
      expect(validNames.has(h.name)).toBe(true);
    }
  });

  it('lake-monsters and sea-monsters produce exactly 1 creature', () => {
    const lakeResult = generateGroundHostiles(
      [makeMarker('lake-monsters', 200, 200)], undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    const lakeCreatures = lakeResult.filter((h) => h.id.includes('lake-monsters'));
    expect(lakeCreatures.length).toBe(1);

    const seaResult = generateGroundHostiles(
      [makeMarker('sea-monsters', 400, 400)], undefined, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    const seaCreatures = seaResult.filter((h) => h.id.includes('sea-monsters'));
    expect(seaCreatures.length).toBe(1);
  });

  it('all hostile marker types produce at least one creature', () => {
    // Excludes the four dungeon-entrance types (caves/dungeons/necropolises/
    // disturbed-burials) — Pillar 2 surfaces those as sealed doors, not swarms.
    const hostileTypes = [
      'brigands', 'pirates', 'hill-monsters',
      'lake-monsters', 'sea-monsters',
      'rifts', 'encounters',
    ];
    for (const type of hostileTypes) {
      const result = generateGroundHostiles(
        [makeMarker(type, 250, 250)], undefined, 42,
        DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
        DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
      );
      expect(result.length).toBeGreaterThan(0);
      for (const h of result) {
        expect(h.name.length).toBeGreaterThan(0);
        expect(h.monsterId.length).toBeGreaterThan(0);
      }
    }
  });

  it('zones spawn additional hostiles (Invasion and Rebels)', () => {
    const zones: RegionZone[] = [
      { type: 'Invasion', name: 'Test Invasion' },
      { type: 'Rebels', name: 'Test Rebels' },
    ];
    const result = generateGroundHostiles(
      undefined, zones, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result.length).toBeGreaterThanOrEqual(2); // At least 1 from each zone
    const invaders = result.filter((h) => h.name === 'Invader');
    const rebels = result.filter((h) => h.name === 'Rebel');
    expect(invaders.length).toBeGreaterThan(0);
    expect(rebels.length).toBeGreaterThan(0);
  });

  it('non-hostile zones do not spawn creatures', () => {
    const zones: RegionZone[] = [
      { type: 'Disease', name: 'Red Fever' },
      { type: 'Disaster', name: 'Famine' },
    ];
    const result = generateGroundHostiles(
      undefined, zones, 42,
      DEFAULT_BOUNDS.x, DEFAULT_BOUNDS.y,
      DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height,
    );
    expect(result).toEqual([]);
  });
});

describe('hasHostileZoneContext', () => {
  it('returns false when zones is undefined', () => {
    expect(hasHostileZoneContext(undefined)).toBe(false);
  });

  it('returns false when zones is empty', () => {
    expect(hasHostileZoneContext([])).toBe(false);
  });

  it('returns true when an Invasion zone is present', () => {
    const zones: RegionZone[] = [{ type: 'Invasion', name: 'Test Invasion' }];
    expect(hasHostileZoneContext(zones)).toBe(true);
  });

  it('returns false for non-hostile zone types', () => {
    const zones: RegionZone[] = [
      { type: 'Disease', name: 'Red Fever' },
      { type: 'Disaster', name: 'Famine of X' },
    ];
    expect(hasHostileZoneContext(zones)).toBe(false);
  });

  it('returns true for Crusade zone type', () => {
    const zones: RegionZone[] = [{ type: 'Crusade', name: 'Holy Crusade' }];
    expect(hasHostileZoneContext(zones)).toBe(true);
  });
});
