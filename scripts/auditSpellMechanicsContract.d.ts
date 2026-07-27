type ContractStatus = 'aligned' | 'json-only' | 'schema-only' | 'type-gap' | 'runtime-only' | 'review';
interface ContractFieldRow {
    fieldPath: string;
    leafName: string;
    jsonSpellCount: number;
    jsonOccurrenceCount: number;
    jsonSampleValues: string[];
    schemaPresent: boolean;
    typeTokenPresent: boolean;
    runtimeTokenPresent: boolean;
    status: ContractStatus;
    notes: string[];
}
interface SpellMechanicsContractAudit {
    generatedAt: string;
    spellCount: number;
    jsonFieldCount: number;
    schemaFieldCount: number;
    typeTokenCount: number;
    runtimeTokenCount: number;
    rows: ContractFieldRow[];
    groupedCounts: Record<ContractStatus, number>;
    schemaOnlyFields: string[];
}
export declare function buildSpellMechanicsContractAudit(): SpellMechanicsContractAudit;
export {};
