import type { Pack } from '../fmg/features';

export interface CellFacts {
  id: number;
  height: number; // pack.cells.h, 0..100
  biomeId: number;
  cultureId: number;
  stateId: number;
  burgId: number;
  ruralPop: number;
  riverId: number;
}

export function readWorldCell(pack: Pack, cellId: number): CellFacts {
  const c = pack.cells;
  return {
    id: cellId,
    height: c.h[cellId] ?? 0,
    biomeId: c.biome?.[cellId] ?? -1,
    cultureId: c.culture?.[cellId] ?? 0,
    stateId: c.state?.[cellId] ?? 0,
    burgId: c.burg?.[cellId] ?? 0,
    ruralPop: c.pop?.[cellId] ?? 0,
    riverId: c.r?.[cellId] ?? 0,
  };
}

export function classifyCellType(facts: CellFacts): 'wilderness' | 'settlement' {
  return facts.burgId > 0 ? 'settlement' : 'wilderness';
}
