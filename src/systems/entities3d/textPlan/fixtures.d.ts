/**
 * @file fixtures.ts — canned CreaturePlans: the body-plan language's living
 * examples. Tests use these so no suite ever calls the LLM; the driver and
 * compiler suites treat them as their reference creatures.
 */
import type { CreaturePlan } from './planSchema';
export declare const PLAN_FIXTURES: {
    readonly dragon: CreaturePlan;
    readonly threeHeadedSerpent: CreaturePlan;
    readonly tentacledOoze: CreaturePlan;
    readonly floatingEye: CreaturePlan;
    readonly centaur: CreaturePlan;
    readonly gelatinousCube: CreaturePlan;
    readonly beholder: CreaturePlan;
    readonly ghost: CreaturePlan;
};
