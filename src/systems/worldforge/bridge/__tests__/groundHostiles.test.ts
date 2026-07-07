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
