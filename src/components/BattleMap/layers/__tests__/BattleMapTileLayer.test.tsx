import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BattleMapTileLayer } from '../BattleMapTileLayer';
import type { BattleMapTileLayerProps } from '../BattleMapTileLayer';
import type { BattleMapTile as BattleMapTileData } from '../../../../types/combat';

/**
 * The tile layer is where the 2D board decides what each square MEANS this
 * frame: reachable or not, on the path, threatened, targetable, a legal drop
 * spot for a carried object, and which of its four edges form the outer
 * perimeter of the reachable region.
 *
 * Those decisions used to be an anonymous block inside BattleMap's JSX and had
 * no test of their own (agora-9950). BattleMapTile is mocked so each assertion
 * reads the exact props the layer produced, with no tile rendering in the way.
 */

const tileProps: Array<Record<string, unknown>> = [];

vi.mock('../../BattleMapTile', () => ({
  default: (props: Record<string, unknown>) => {
    tileProps.push(props);
    return <div data-testid={`tile-${props.tile ? (props.tile as BattleMapTileData).id : 'none'}`} />;
  }
}));

const createTile = (x: number, y: number, blocksMovement = false): BattleMapTileData => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: 'floor',
  elevation: 0,
  movementCost: 1,
  blocksMovement,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: []
} as unknown as BattleMapTileData);

function renderLayer(overrides: Partial<BattleMapTileLayerProps> = {}) {
  tileProps.length = 0;
  const tiles = [createTile(0, 0), createTile(1, 0), createTile(2, 0)];
  const props: BattleMapTileLayerProps = {
    visibleTiles: tiles,
    validTargetSet: new Set(),
    aoeSet: new Set(),
    teleportDestinationSet: new Set(),
    activePathSet: new Set(),
    visibility: {
      visibleTiles: new Set(['0-0', '1-0', '2-0']),
      getLightLevel: () => 'bright'
    },
    actionMode: null,
    validMoves: new Set(),
    validMoveCoordSet: new Set(),
    threatCoordSet: new Set(),
    activeObject: null,
    showCoverLabels: false,
    elevationReference: null,
    elevationBaseline: 0,
    targetingMode: false,
    onTileClick: vi.fn(),
    onTileHover: vi.fn(),
    ...overrides
  };
  render(<BattleMapTileLayer {...props} />);
  return tileProps;
}

const byId = (id: string) => tileProps.find(p => (p.tile as BattleMapTileData).id === id)!;

describe('BattleMapTileLayer', () => {
  it('renders one tile per culled-in tile and forwards its light level', () => {
    const props = renderLayer();

    expect(props).toHaveLength(3);
    expect(props.map(p => (p.tile as BattleMapTileData).id)).toEqual(['0-0', '1-0', '2-0']);
    expect(props.every(p => p.isVisible === true)).toBe(true);
    expect(props.every(p => p.lightLevel === 'bright')).toBe(true);
  });

  it('marks reachable tiles only while the pointer is in move mode', () => {
    renderLayer({ actionMode: 'ability', validMoves: new Set(['1-0']) });
    expect(byId('1-0').isValidMove).toBe(false);

    renderLayer({ actionMode: 'move', validMoves: new Set(['1-0']) });
    expect(byId('1-0').isValidMove).toBe(true);
  });

  it('strokes only the outer edges of the reachable region', () => {
    // Two reachable tiles side by side: their shared edge must NOT be stroked,
    // so the region reads as one outline instead of two boxes.
    renderLayer({
      actionMode: 'move',
      validMoves: new Set(['0-0', '1-0']),
      validMoveCoordSet: new Set(['0,0', '1,0'])
    });

    expect(byId('0-0').moveEdges).toEqual({ top: true, right: false, bottom: true, left: true });
    expect(byId('1-0').moveEdges).toEqual({ top: true, right: true, bottom: true, left: false });
    // A tile outside the region gets no edge record at all.
    expect(byId('2-0').moveEdges).toBeUndefined();
  });

  it('threatens only reachable tiles inside an enemy reach', () => {
    renderLayer({
      actionMode: 'move',
      validMoves: new Set(['0-0']),
      validMoveCoordSet: new Set(['0,0']),
      // 2,0 is in reach but NOT reachable, so it must not be hatched.
      threatCoordSet: new Set(['0,0', '2,0'])
    });

    expect(byId('0-0').isThreatened).toBe(true);
    expect(byId('2-0').isThreatened).toBe(false);
  });

  it('offers every unblocked tile as a drop destination while an object is carried', () => {
    const walls = [createTile(0, 0), createTile(1, 0, true)];

    renderLayer({
      visibleTiles: walls,
      visibility: { visibleTiles: new Set(['0-0', '1-0']), getLightLevel: () => 'bright' },
      activeObject: { id: 'torch', name: 'Torch', position: { x: 0, y: 0 }, isFixedToSurface: false } as BattleMapTileLayerProps['activeObject']
    });

    expect(byId('0-0').isObjectMoveDestination).toBe(true);
    expect(byId('1-0').isObjectMoveDestination).toBe(false);
  });

  it('leaves every tile a non-destination when no object is carried', () => {
    const props = renderLayer();

    expect(props.every(p => p.isObjectMoveDestination === false)).toBe(true);
  });

  it('forwards the tactical highlight sets to the matching tiles', () => {
    renderLayer({
      validTargetSet: new Set(['0-0']),
      aoeSet: new Set(['1-0']),
      teleportDestinationSet: new Set(['2-0']),
      activePathSet: new Set(['1-0'])
    });

    expect(byId('0-0').isTargetable).toBe(true);
    expect(byId('1-0').isTargetable).toBe(false);
    expect(byId('1-0').isAoePreview).toBe(true);
    expect(byId('2-0').isTeleportDestinationPreview).toBe(true);
    expect(byId('1-0').isInPath).toBe(true);
  });
});
