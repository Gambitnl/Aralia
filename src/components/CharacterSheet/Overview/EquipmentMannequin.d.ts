/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 00:50:52
 * Dependents: components/CharacterSheet/Overview/index.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file EquipmentMannequin.tsx
 * This component displays a visual representation of character equipment slots.
 * It uses a "Paper Doll" layout with a background silhouette to provide context to the slots.
 */
/**
 * This file displays a visual paper-doll grid representing equipped item slots.
 *
 * It renders the center column of the character sheet overview, featuring:
 * - A background body silhouette behind 13 slots (Head, Neck, Torso, Ring1, Ring2, etc.).
 * - Colored borders and warnings to highlight proficiency mismatches (e.g. non-proficient armor/weapons).
 * - Stat indicators showing calculated weapon damage bonuses on slot hover.
 * - An active "Heritage Features" panel listing filtered unique, mechanically interesting traits for the character's race.
 *
 * Called by: CharacterSheetModal.tsx (Overview tab, column 2)
 * Depends on: custom SVG icons, dynamic slot wrappers, and character validation utilities.
 */
import React from 'react';
import { PlayerCharacter, EquipmentSlotType, Item } from '../../../types';
interface EquipmentMannequinProps {
    character: PlayerCharacter;
    onSlotClick?: (slot: EquipmentSlotType, item?: Item) => void;
    activeFilterSlot?: EquipmentSlotType | null;
    onAutoEquip?: () => void;
}
declare const EquipmentMannequin: React.FC<EquipmentMannequinProps>;
export default EquipmentMannequin;
