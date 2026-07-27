import { Ability } from '../../../types/combat';
/**
 * Converts a single 5etools action entry into an Aralia Ability.
 * @param costType - defaults to 'action'; pass 'bonus', 'reaction', 'legendary', or 'lair' for those arrays.
 */
export declare function parse5eToolsAction(action: any, costType?: 'action' | 'bonus' | 'reaction' | 'legendary' | 'lair'): Ability | null;
