/**
 * @file backgrounds.ts
 * 2024 Player's Handbook backgrounds for Aralia RPG
 */
export interface Background {
    id: string;
    name: string;
    description: string;
    skillProficiencies: string[];
    toolProficiencies?: string[];
    languages?: string[];
    equipment: string[];
    originFeatId: string;
    feature: {
        name: string;
        description: string;
    };
    ageAppropriate: 'any' | 'adult' | 'child' | 'young';
    suggestedCharacteristics?: {
        personalityTraits: string[];
        ideals: string[];
        bonds: string[];
        flaws: string[];
    };
}
export declare const BACKGROUNDS: Record<string, Background>;
export declare const AGE_APPROPRIATE_BACKGROUNDS: {
    readonly child: readonly ["urchin", "farmer", "acolyte", "entertainer", "noble", "sage", "hermit"];
    readonly young: readonly ["acolyte", "entertainer", "farmer", "noble", "sage", "sailor", "urchin"];
    readonly adult: readonly ["acolyte", "criminal", "entertainer", "farmer", "guide", "hermit", "noble", "sage", "soldier", "sailor", "urchin", "faction-agent"];
};
