// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:11
 * Dependents: useSubmapProceduralData.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PathDetails } from '../../types';

export type EdgeDirection = 'north' | 'south' | 'east' | 'west';

export interface SubmapDimensionsInput {
  rows: number;
  cols: number;
}

export interface RoadPort {
  x: number;
  y: number;
}

export interface RoadPorts {
  north: RoadPort | null;
  south: RoadPort | null;
  east: RoadPort | null;
  west: RoadPort | null;
}

interface TileCoordinates {
  x: number;
  y: number;
}

interface GenerateRoadPortsArgs {
  worldSeed: number;
  tileCoords: TileCoordinates;
  submapDimensions: SubmapDimensionsInput;
  edgeChancePercent: number;
  networkId?: string;
}

interface GeneratePathDetailsArgs {
  worldSeed: number;
  tileCoords: TileCoordinates;
  submapDimensions: SubmapDimensionsInput;
  edgeChancePercent: number;
  forceCenterConnection?: boolean;
  networkId?: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(hash, 31) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeEdgePair(a: TileCoordinates, b: TileCoordinates): [TileCoordinates, TileCoordinates] {
  if (a.y < b.y) return [a, b];
  if (a.y > b.y) return [b, a];
  if (a.x <= b.x) return [a, b];
  return [b, a];
}

function getNeighbor(tile: TileCoordinates, direction: EdgeDirection): TileCoordinates {
  switch (direction) {
    case 'north':
      return { x: tile.x, y: tile.y - 1 };
    case 'south':
      return { x: tile.x, y: tile.y + 1 };
    case 'east':
      return { x: tile.x + 1, y: tile.y };
    case 'west':
      return { x: tile.x - 1, y: tile.y };
    default:
      return tile;
  }
}

function edgeHash(
  worldSeed: number,
  tileA: TileCoordinates,
  tileB: TileCoordinates,
  label: string
): number {
  const [left, right] = normalizeEdgePair(tileA, tileB);
  return hashString(`${worldSeed}|${left.x},${left.y}|${right.x},${right.y}|${label}`);
}

function getPortForDirection(
  direction: EdgeDirection,
  portOffset: number,
  dims: SubmapDimensionsInput
): RoadPort | null {
  const { cols, rows } = dims;
  if (cols < 3 || rows < 3) return null;

  switch (direction) {
    case 'north':
      return { x: 1 + (portOffset % Math.max(1, cols - 2)), y: 0 };
    case 'south':
      return { x: 1 + (portOffset % Math.max(1, cols - 2)), y: rows - 1 };
    case 'east':
      return { x: cols - 1, y: 1 + (portOffset % Math.max(1, rows - 2)) };
    case 'west':
      return { x: 0, y: 1 + (portOffset % Math.max(1, rows - 2)) };
    default:
      return null;
  }
}

export function generateRoadPortsForTile({
  worldSeed,
  tileCoords,
  submapDimensions,
  edgeChancePercent,
  networkId = 'road',
}: GenerateRoadPortsArgs): RoadPorts {
  const dirs: EdgeDirection[] = ['north', 'south', 'east', 'west'];
  const boundedChance = Math.max(0, Math.min(100, edgeChancePercent));
  const ports: RoadPorts = { north: null, south: null, east: null, west: null };

  for (const direction of dirs) {
    const neighbor = getNeighbor(tileCoords, direction);
    const existsRoll = edgeHash(worldSeed, tileCoords, neighbor, `${networkId}_exists`) % 100;
    if (existsRoll >= boundedChance) {
      ports[direction] = null;
      continue;
    }

    const portOffset = edgeHash(worldSeed, tileCoords, neighbor, `${networkId}_port`);
    ports[direction] = getPortForDirection(direction, portOffset, submapDimensions);
  }

  return ports;
}

function traceLine(start: RoadPort, end: RoadPort): RoadPort[] {
  const points: RoadPort[] = [];
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y0 += sy;
    }
  }

  return points;
}

function addAdjacency(mainPathCoords: Set<string>, submapDimensions: SubmapDimensionsInput): Set<string> {
  const adjacency = new Set<string>();
  const { cols, rows } = submapDimensions;

  mainPathCoords.forEach((coordStr) => {
    const [xStr, yStr] = coordStr.split(',');
    const x = Number.parseInt(xStr, 10);
    const y = Number.parseInt(yStr, 10);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const key = `${nx},${ny}`;
        if (!mainPathCoords.has(key)) {
          adjacency.add(key);
        }
      }
    }
  });

  return adjacency;
}

export function generateContinuousSubmapPathDetails({
  worldSeed,
  tileCoords,
  submapDimensions,
  edgeChancePercent,
  forceCenterConnection = false,
  networkId = 'road',
}: GeneratePathDetailsArgs): PathDetails {
  const ports = generateRoadPortsForTile({
    worldSeed,
    tileCoords,
    submapDimensions,
    edgeChancePercent,
    networkId,
  });

  const mainPathCoords = new Set<string>();
  const center: RoadPort = {
    x: Math.floor(submapDimensions.cols / 2),
    y: Math.floor(submapDimensions.rows / 2),
  };

  const activePorts = Object.values(ports).filter((port): port is RoadPort => port !== null);
  if (activePorts.length === 0 && forceCenterConnection) {
    mainPathCoords.add(`${center.x},${center.y}`);
  }

  for (const port of activePorts) {
    for (const point of traceLine(port, center)) {
      mainPathCoords.add(`${point.x},${point.y}`);
    }
  }

  const pathAdjacencyCoords = addAdjacency(mainPathCoords, submapDimensions);
  return { mainPathCoords, pathAdjacencyCoords };
}
