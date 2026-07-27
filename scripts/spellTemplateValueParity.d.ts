/**
 * This file compares the legal value lists used by paired spell template fields.
 *
 * A field mapping is not actually trustworthy if the structured template allows
 * one vocabulary while the runtime JSON template allows another. The spell
 * validator uses this helper to detect that split directly, before downstream
 * reports have to rediscover it as corpus drift.
 *
 * Called by: validateSpellTemplateContracts.ts and its focused Vitest coverage
 * Depends on: plain string lists supplied by the template validator
 */
export interface TemplateValueSetMismatch {
    fieldName: string;
    structuredOnly: string[];
    runtimeOnly: string[];
}
export declare function compareAcceptedValueSets(fieldName: string, structuredValues: string[], runtimeValues: string[]): TemplateValueSetMismatch | null;
