#!/usr/bin/env npx tsx
import type { Race } from '../src/types';
/**
 * This script builds review reports that compare Aralia's implemented race data
 * with the vendored 5etools race corpus.
 *
 * It exists to guide future data migration work without rewriting Aralia's race
 * files. The script reads the current TypeScript race records, reads glossary
 * race JSON for display coverage, reads the local vendor corpus as a reference,
 * and writes report artifacts under docs/reports/race-reconciliation.
 *
 * Called by: agents or developers through `npx tsx scripts/raceReconciliationInventory.ts`
 * Depends on: scripts/load-race-data.ts for safe Node-side race loading, vendor/5etools-src/data/races.json
 */
export type SupportBucket = 'enforced_now' | 'represented_not_enforced' | 'blocked_by_missing_mechanic_family' | 'ambiguous_requires_human_mapping' | 'display_lore_only';
export type CrosswalkStatus = 'matched' | 'reflavored' | 'custom' | 'unmatched' | 'ambiguous';
export type MatchConfidence = 'high' | 'medium' | 'low';
export interface AraliaTraitDetail {
    traitName: string;
    detailText: string;
}
export interface AraliaRaceInventoryRecord {
    id: string;
    name: string;
    baseRace?: string;
    descriptionLength: number;
    abilityBonuses: Race['abilityBonuses'];
    traits: string[];
    traitNames: string[];
    knownSpells: Race['knownSpells'];
    spellsOfTheMark: Race['spellsOfTheMark'];
    racialSpellChoice: Race['racialSpellChoice'];
    choiceStructures: string[];
    visual?: Race['visual'];
    imageUrl?: string;
    glossaryPath?: string;
    glossaryId?: string;
    glossaryName?: string;
    structuralWarnings: string[];
}
export interface VendorTraitSummary {
    name: string;
    summary: string;
}
export interface VendorRaceInventoryRecord {
    name: string;
    normalizedName: string;
    source: string;
    page?: number;
    path: string;
    kind: 'race' | 'subrace' | 'foundry_race';
    size: string[];
    speed: Record<string, number>;
    senses: {
        darkvision?: number;
        blindsight?: number;
        tremorsense?: number;
        truesight?: number;
    };
    abilityKeys: string[];
    resistanceKeys: string[];
    skillKeys: string[];
    toolKeys: string[];
    weaponKeys: string[];
    languageKeys: string[];
    choiceSignals: string[];
    traits: VendorTraitSummary[];
    tags: string[];
}
export interface CrosswalkCandidate {
    vendorName: string;
    vendorSource: string;
    vendorPath: string;
    confidence: MatchConfidence;
    score: number;
    reasons: string[];
}
export interface CrosswalkRecord {
    araliaRaceId: string;
    araliaName: string;
    status: CrosswalkStatus;
    vendorCandidates: CrosswalkCandidate[];
    notes: string;
}
export interface MechanicClassification {
    mechanicKey: string;
    support: SupportBucket;
    bucket: string;
    recommendedNextStep: string;
    confidence: MatchConfidence;
    capability?: RaceMechanicCapability;
    codeReferences: string[];
}
export interface MechanicSupportRecord extends MechanicClassification {
    araliaRaceId?: string;
    araliaName?: string;
    vendorName?: string;
    vendorSource?: string;
    traitName: string;
    araliaCurrentRepresentation: string;
    vendorEvidence?: string;
    source: 'aralia' | 'vendor_candidate';
}
export type CapabilitySupportStatus = 'enforced' | 'represented_only' | 'display_only' | 'unsupported' | 'ambiguous';
export interface RaceMechanicCapability {
    mechanicFamily: string;
    supportStatus: CapabilitySupportStatus;
    dataFields: string[];
    enforcementPaths: string[];
    displayPaths: string[];
    limitations: string[];
    exampleRaceIds: string[];
    confidence: MatchConfidence;
}
interface VendorRaceRaw {
    name?: unknown;
    source?: unknown;
    page?: unknown;
    size?: unknown;
    speed?: unknown;
    darkvision?: unknown;
    blindsight?: unknown;
    tremorsense?: unknown;
    truesight?: unknown;
    ability?: unknown;
    resist?: unknown;
    traitTags?: unknown;
    skillProficiencies?: unknown;
    toolProficiencies?: unknown;
    weaponProficiencies?: unknown;
    languageProficiencies?: unknown;
    entries?: unknown;
}
export declare const DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX: RaceMechanicCapability[];
export declare function normalizeRaceNameForMatching(name: string): string;
export declare function extractAraliaTraitDetail(traitText: string): AraliaTraitDetail;
export declare function summarizeVendorRace(rawRace: VendorRaceRaw, vendorPath: string, kind?: VendorRaceInventoryRecord['kind']): VendorRaceInventoryRecord;
export declare function createRaceCrosswalkRecord(araliaRace: Pick<AraliaRaceInventoryRecord, 'id' | 'name' | 'traits' | 'traitNames'>, vendorInventory: VendorRaceInventoryRecord[]): CrosswalkRecord;
export declare function applyRaceSpecificSupportCorrections(raceId: string, classification: MechanicClassification): MechanicClassification;
export declare function classifyMechanicText(traitName: string, detailText: string, capabilityMatrix?: RaceMechanicCapability[]): MechanicClassification;
export declare function runRaceReconciliationWorkflow(): Promise<void>;
export {};
