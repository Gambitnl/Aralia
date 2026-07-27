import { StatusEffect } from '../../types/combat';
export interface BlessingDefinition {
    id: string;
    name: string;
    description: string;
    effect: StatusEffect;
}
export declare const BLESSING_EFFECTS: Record<string, BlessingDefinition>;
/**
 * Helper to get a status effect from a blessing ID.
 */
export declare const getBlessingEffect: (blessingId: string) => StatusEffect | null;
/**
 * Helper to get the full definition.
 */
export declare const getBlessingDefinition: (blessingId: string) => BlessingDefinition | null;
