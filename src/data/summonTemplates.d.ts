import { z } from 'zod';
import { SummonedEntityStatBlock } from '../systems/spells/validation/spellValidator';
/**
 * Defines the structure for a summoned entity's stat block.
 * Inferred from the Zod schema to ensure consistency.
 */
export type SummonTemplate = z.infer<typeof SummonedEntityStatBlock>;
export declare const SUMMON_TEMPLATES: Record<string, SummonTemplate>;
/**
 * Helper to get a template, handling case insensitivity and aliases.
 */
export declare function getSummonTemplate(name: string): SummonTemplate | undefined;
