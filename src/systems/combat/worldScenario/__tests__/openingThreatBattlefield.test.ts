/**
 * These tests prove that a hostile opening can only use the WorldForge crop
 * matching its game-authored seed/cell receipt.
 *
 * They also pin the deterministic anchor policy and the explicit omitted-facts
 * contract. A language-model threat may supply enemies, but it cannot claim
 * exact world positions or an approach direction it never authored.
 */
import { describe, expect, it } from 'vitest';
import type { OpeningBattlefieldSource } from '@/systems/gameEntry/types';
import type { BattleMapData, BattleMapTile } from '@/types/combat';
import { projectOpeningThreatBattlefield } from '../openingThreatBattlefield';

// ============================================================================
// Source Fixtures
// ============================================================================

const SOURCE: OpeningBattlefieldSource = {
  kind: 'worldforge-opening-location',
  receiptId: 'opening:42:cell:476',
  worldSeed: 42,
  cellId: 476,
  centerPx: [120, 240],
  locationLabel: 'Legium',
};

function makeTile(x: number, y: number, blocked = false): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: blocked ? Infinity : 1,
    blocksLoS: blocked,
    blocksMovement: blocked,
    decoration: null,
    effects: [],
  };
}

function makeMap(options: {
  worldSeed?: number;
  cellId?: number;
  allBlocked?: boolean;
} = {}): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      // The exact center is intentionally blocked in the normal fixture. This
      // proves the adapter chooses the closest legal cell deterministically.
      const blocked = options.allBlocked || (x === 2 && y === 2);
      tiles.set(`${x}-${y}`, makeTile(x, y, blocked));
    }
  }

  return {
    dimensions: { width: 5, height: 5 },
    tiles,
    theme: 'forest',
    seed: 99,
    provenance: {
      kind: 'worldforge',
      worldSeed: options.worldSeed ?? 42,
      anchorCellId: options.cellId ?? 476,
      anchorWorldMeters: { x: 300, z: 180 },
      generationPath: ['WorldForge', 'GroundWorld', 'Tactical crop'],
    },
  };
}

// ============================================================================
// Projection Contract
// ============================================================================

describe('opening threat battlefield projection', () => {
  it('adds a deterministic standoff receipt without inventing source positions', () => {
    const mapData = makeMap();

    const first = projectOpeningThreatBattlefield(mapData, SOURCE);
    const second = projectOpeningThreatBattlefield(mapData, SOURCE);

    expect(first).toEqual(second);
    expect(first.status).toBe('ready');
    if (first.status !== 'ready') return;

    expect(first.mapData.encounterContext).toEqual({
      kind: 'opening-standoff',
      source: 'worldforge-opening',
      sourceReceiptId: SOURCE.receiptId,
      sourceWorldCellId: SOURCE.cellId,
      anchorTile: { x: 2, y: 1 },
      deployment: {
        player: 'current-position',
        enemy: 'terrain-fit-standoff-constellation',
      },
      omittedFacts: {
        enemyWorldPositions: 'not-authored',
        approachDirection: 'not-authored',
      },
    });
    expect(first.mapData.provenance?.generationPath).toContain(
      `Opening threat ${SOURCE.receiptId}`,
    );
    expect(mapData.encounterContext).toBeUndefined();
  });

  it('fails closed when the live crop belongs to another world or atlas cell', () => {
    const wrongSeed = projectOpeningThreatBattlefield(makeMap({ worldSeed: 43 }), SOURCE);
    const wrongCell = projectOpeningThreatBattlefield(makeMap({ cellId: 477 }), SOURCE);

    expect(wrongSeed.status).toBe('source-gap');
    expect(wrongCell.status).toBe('source-gap');
    expect(wrongSeed.detail).toContain('expected world 42, cell 476');
    expect(wrongCell.detail).toContain('world 42, cell 477');
  });

  it('fails closed when the source crop offers no legal player anchor', () => {
    const result = projectOpeningThreatBattlefield(makeMap({ allBlocked: true }), SOURCE);

    expect(result).toEqual({
      status: 'source-gap',
      detail: `Opening receipt ${SOURCE.receiptId} has no legal player anchor in its WorldForge crop.`,
    });
  });
});
