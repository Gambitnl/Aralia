type CanonicalReviewState = 'clean' | 'mismatch' | 'not_reviewed';
type StructuredJsonReviewState = 'clean' | 'mismatch' | 'not_reviewed';
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
        mismatchCount: number;
        mismatchFields: string[];
        mismatchSummaries: string[];
    };
    structuredJsonReview: {
        state: StructuredJsonReviewState;
        generatedAt?: string;
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
