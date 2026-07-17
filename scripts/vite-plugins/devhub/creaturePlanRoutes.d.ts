import type { DevHubRouteContext } from './routeContext';
import { type CreaturePlan } from '../../../src/systems/entities3d/textPlan/planSchema';
export interface CreatureLibraryEntry {
    id: string;
    name: string;
    slug: string;
    /** The generation prompt text, or the revise note for revised entries. */
    description: string;
    plan: CreaturePlan;
    status: 'generated' | 'approved';
    createdAt: string;
    revisedFrom?: string;
    /** D&D size derived from the plan's dimensions (combat tile footprint). */
    sizeCategory?: string;
}
/** Injectable for tests; the default shells out to the Claude CLI. */
export type CliRunner = (prompt: string) => Promise<string>;
export declare function setLibraryDirForTests(dir: string | null): void;
export declare function handleCreaturePlanRoutes(ctx: DevHubRouteContext, runner?: CliRunner): Promise<boolean>;
