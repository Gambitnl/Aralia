import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { BiomesData } from "./biomes";
export interface Route {
    i: number;
    group: "highways" | "roads" | "trails" | "paths" | "searoutes";
    feature: number;
    points: number[][];
    cells?: number[];
    merged?: boolean;
}
export interface RoutesContext {
    pack: Pack;
    grid: Grid;
    biomesData: BiomesData;
}
export declare class RoutesModule {
    private ctx;
    constructor(ctx: RoutesContext);
    buildLinks(routes: Route[]): Record<number, Record<number, number>>;
    private sortBurgsByFeature;
    private calculateUrquhartEdges;
    private createCostEvaluator;
    private getRouteSegments;
    private findPathSegments;
    private generateMainRoads;
    private addConnections;
    private isTownBurg;
    private generateTrails;
    /** Knuth-hash a burg id to a stable 0..99 bucket (deterministic spur pick). */
    private spurBucket;
    /**
     * Village forest spurs: a share of villages get a short hunters'/woodcutters'
     * path from the village into the nearest forest, so faint paths lead INTO the
     * woods (and can fade there) instead of only linking settlements. Deterministic:
     * spur selection hashes the burg id; the target is the first forest cell found
     * by BFS, walked PATH_SPUR_MAX_DEPTH cells deeper along forest neighbors.
     */
    private generatePaths;
    private generateSeaRoutes;
    private preparePointsArray;
    private getPoints;
    private mergeRoutes;
    private createRoutesData;
    generate(lockedRoutes?: Route[]): void;
    isConnected(cellId: number): boolean;
    areConnected(from: number, to: number): boolean;
    getRoute(from: number, to: number): Route | null;
    hasRoad(cellId: number): boolean;
    isCrossroad(cellId: number): boolean;
    getConnectivityRate(cellId: number): number;
}
