import type { Grid } from "./utils/graphUtils";
import type { Pack } from "./features";
export interface IceElement {
    i: number;
    points: number[][];
    type: "glacier" | "iceberg";
    cellId?: number;
    size?: number;
}
export declare class IceModule {
    private getNextId;
    private clear;
    generate({ seed, grid, pack, graphWidth, graphHeight, }: {
        seed: string;
        grid: Grid;
        pack: Pack;
        graphWidth: number;
        graphHeight: number;
    }): void;
}
export declare const Ice: IceModule;
