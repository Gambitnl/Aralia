/**
 * @file WeaponMasterySelection.tsx
 * A component for selecting weapon masteries during character creation.
 * Allows users to choose by mastery property or by weapon type.
 */
import React from 'react';
import { Class as CharClass } from '../../types';
interface WeaponMasterySelectionProps {
    charClass: CharClass;
    onMasteriesSelect: (weaponIds: string[]) => void;
    onBack: () => void;
}
declare const WeaponMasterySelection: React.FC<WeaponMasterySelectionProps>;
export default WeaponMasterySelection;
