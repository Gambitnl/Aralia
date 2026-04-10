type ValueKind = 'string' | 'number' | 'boolean' | 'null';
type ContainerKind = ValueKind | 'object' | 'array' | 'mixed';
export interface SpellRecord {
    spellId: string;
    spellName: string;
    level: number;
    filePath: string;
    relativePath: string;
    browserPath: string;
}
export interface InventoryOccurrence {
    spellId: string;
    spellName: string;
    level: number;
    filePath: string;
    browserPath: string;
    fieldPath: string;
    semanticFieldPath: string;
    value: string;
    valueKind: ValueKind;
    isFreeText: boolean;
    lineNumber: number | null;
}
export interface InventoryValueSummary {
    value: string;
    valueKind: ValueKind;
    occurrenceCount: number;
    spellCount: number;
    sampleSpellIds: string[];
}
export interface InventoryFieldSummary {
    fieldPath: string;
    containerKind: ContainerKind;
    spellCount: number;
    occurrenceCount: number;
    distinctValueCount: number;
    containsFreeTextValues: boolean;
    sampleValues: InventoryValueSummary[];
}
export interface SpellFieldInventory {
    generatedAt: string;
    sourceRoot: string;
    spellCount: number;
    fieldCount: number;
    occurrenceCount: number;
    spells: SpellRecord[];
    fields: InventoryFieldSummary[];
    occurrences: InventoryOccurrence[];
}
export interface SpellFieldInventoryQueryOptions {
    fieldPath?: string;
    value?: string;
    level?: number;
    includeFreeText?: boolean;
    limit?: number;
}
export declare function buildSpellFieldInventory(): SpellFieldInventory;
export declare function createSpellFieldInventorySummary(inventory: SpellFieldInventory): {
    generatedAt: string;
    sourceRoot: string;
    spellCount: number;
    fieldCount: number;
    occurrenceCount: number;
    fields: InventoryFieldSummary[];
};
export declare function querySpellFieldInventory(inventory: SpellFieldInventory, options?: SpellFieldInventoryQueryOptions): {
    generatedAt: string;
    filters: {
        fieldPath: string;
        value: string;
        level: number;
        includeFreeText: boolean;
        limit: number;
    };
    fieldMatches: InventoryFieldSummary[];
    distinctValues: {
        value: string;
        valueKind: ValueKind;
        occurrenceCount: number;
        spellCount: number;
        sampleSpellIds: string[];
    }[];
    occurrences: InventoryOccurrence[];
    totalMatches: number;
};
export {};
