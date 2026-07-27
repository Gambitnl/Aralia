/**
 * @file ActionEconomyBar.tsx
 * A component to display the character's current action economy status.
 */
import React from 'react';
import { CombatCharacter, CombatAction } from '../../types/combat';
interface ActionEconomyBarProps {
    character: CombatCharacter;
    onExecuteAction: (action: CombatAction) => boolean | Promise<boolean>;
}
declare const ActionEconomyBar: React.FC<ActionEconomyBarProps>;
export default ActionEconomyBar;
