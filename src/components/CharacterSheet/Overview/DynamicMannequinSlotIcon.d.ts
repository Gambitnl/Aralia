/**
 * @file DynamicMannequinSlotIcon.tsx
 * This component dynamically loads and displays an SVG icon for an equipment slot
 * based on the character's maximum armor proficiency.
 * It falls back to a default icon if the specific SVG is not found.
 */
import React from 'react';
import { ArmorProficiencyLevel, EquipmentSlotType } from '../../../types';
interface DynamicMannequinSlotIconProps {
    characterProficiency: ArmorProficiencyLevel;
    slotType: EquipmentSlotType;
    fallbackIcon: React.ReactElement<{
        className?: string;
    }>;
}
declare const DynamicMannequinSlotIcon: React.FC<DynamicMannequinSlotIconProps>;
export default DynamicMannequinSlotIcon;
