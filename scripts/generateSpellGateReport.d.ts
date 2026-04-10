type CanonicalReviewState = 'clean' | 'mismatch' | 'detail_fetch_incomplete' | 'listing_unmatched' | 'not_reviewed';
interface SpellGateArtifactEntry {
    spellId: string;
    spellName: string;
    level: number;
    jsonPath: string;
    schema: {
        valid: boolean;
        issues: string[];
    };
    localData: {
        classesCount: number;
        subClassesCount: number;
        subClassesVerification: string;
        flags: string[];
    };
    canonicalReview: {
        state: CanonicalReviewState;
        generatedAt?: string;
        listingUrl?: string;
        mismatchCount: number;
        mismatchFields: string[];
        mismatchSummaries: string[];
    };
}
interface SpellGateArtifact {
    generatedAt: string;
    spellCount: number;
    spells: Record<string, SpellGateArtifactEntry>;
}
interface ScriptOptions {
    spellId?: string;
}
export declare function buildSpellGateEntryForSpell(spellId: string): SpellGateArtifactEntry;
export declare function buildSpellGateArtifact(options?: ScriptOptions): SpellGateArtifact;
export {};
