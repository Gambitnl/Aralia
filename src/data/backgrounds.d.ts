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
    readonly child: readonly ["child-of-the-streets", "urchin", "apprentice", "acolyte", "entertainer", "folk-hero", "noble", "sage", "inheritor", "beast-master"];
    readonly young: readonly ["apprentice", "acolyte", "entertainer", "folk-hero", "guild-artisan", "noble", "sage", "sailor", "inheritor", "shipwright", "knight-of-the-order", "tribal-warrior", "beast-master", "revolutionary"];
    readonly adult: readonly ["acolyte", "criminal", "entertainer", "faction-agent", "far-traveler", "folk-hero", "guild-artisan", "noble", "sage", "soldier", "archaeologist", "cloistered-scholar", "courtier", "gladiator", "hermit", "inheritor", "mercenary", "outlander", "shipwright", "spy", "tribal-warrior", "beast-master", "elemental-adept", "gravekeeper"];
};
