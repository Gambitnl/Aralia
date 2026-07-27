/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/naval/crewTraits.ts
 * Static data for crew generation: names, traits, and role definitions.
 */
import { CrewRole } from '../../types/naval';
export declare const CREW_NAMES: string[];
export declare const CREW_SURNAMES: string[];
export declare const CREW_TRAITS: Record<string, {
    effect: string;
    moraleModifier?: number;
    skillBonus?: Record<string, number>;
}>;
export declare const ROLE_BASE_SKILLS: Record<CrewRole, Record<string, number>>;
export declare const ROLE_DAILY_WAGE: Record<CrewRole, number>;
