import { type Pt } from '../submap/submapEngine';
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
/** Burg id used by the demo previews (no atlas burg backs it). */
export declare const DEMO_BURG_ID = 9001;
export interface DemoTown {
    /** Artifact town plan (streets + plots) consumed by roster/motion/3D previews. */
    plan: ArtifactTownPlan;
    /** The Voronoi cell the town fills (feet), for framing the 3D preview. */
    footprint: Pt[];
    /** Axis-aligned bounds of the footprint (feet). */
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/** Build the demo Voronoi-ward town (adapted to the roster/motion artifact plan). */
export declare function buildDemoTownPlan(worldSeed: number, opts?: {
    burgId?: number;
    population?: number;
}): DemoTown;
