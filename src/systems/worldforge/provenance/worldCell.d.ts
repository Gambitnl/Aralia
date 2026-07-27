import type { Pack } from '../fmg/features';
export interface CellFacts {
    id: number;
    height: number;
    biomeId: number;
    cultureId: number;
    stateId: number;
    burgId: number;
    ruralPop: number;
    riverId: number;
}
export declare function readWorldCell(pack: Pack, cellId: number): CellFacts;
export declare function classifyCellType(facts: CellFacts): 'wilderness' | 'settlement';
