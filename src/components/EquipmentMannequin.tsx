
/**
 * @file EquipmentMannequin.tsx
 * This component displays a visual representation of character equipment slots.
 * It uses a "Paper Doll" layout with a background silhouette to provide context to the slots.
 */
import React from 'react';
import { PlayerCharacter, EquipmentSlotType, Item, ArmorCategory } from '../types';
import Tooltip from './ui/Tooltip';

// Import default icon components
import HeadIcon from '../assets/icons/HeadIcon';
import NeckIcon from '../assets/icons/NeckIcon';
import TorsoIcon from '../assets/icons/TorsoIcon';
import CloakIcon from '../assets/icons/CloakIcon';
import BeltIcon from '../assets/icons/BeltIcon';
import MainHandIcon from '../assets/icons/MainHandIcon';
import OffHandIcon from '../assets/icons/OffHandIcon';
import WristsIcon from '../assets/icons/WristsIcon';
import RingIcon from '../assets/icons/RingIcon';
import FeetIcon from '../assets/icons/FeetIcon';
import LegsIcon from '../assets/icons/LegsIcon';
import HandsIcon from '../assets/icons/HandsIcon';

// Import the new dynamic icon component
import DynamicMannequinSlotIcon from './DynamicMannequinSlotIcon';
import { isWeaponProficient, isWeaponMartial } from '../utils/weaponUtils';
import { getCharacterMaxArmorProficiency, getArmorCategoryHierarchy, getAbilityModifierValue } from '../utils/characterUtils';

interface EquipmentMannequinProps {
  character: PlayerCharacter;
  onSlotClick?: (slot: EquipmentSlotType, item?: Item) => void;
  activeFilterSlot?: EquipmentSlotType | null;
}

interface SlotDisplayInfo {
  id: EquipmentSlotType;
  label: string;
  defaultIcon: React.ReactElement;
  gridArea: string;
  isArmorSlot?: boolean;
  isShieldSlot?: boolean;
}

const equipmentSlots: SlotDisplayInfo[] = [
  { id: 'Head', label: 'Head', defaultIcon: <HeadIcon />, gridArea: 'head', isArmorSlot: true },
  { id: 'Neck', label: 'Neck', defaultIcon: <NeckIcon />, gridArea: 'neck' },
  { id: 'Torso', label: 'Torso', defaultIcon: <TorsoIcon />, gridArea: 'torso', isArmorSlot: true },
  { id: 'Cloak', label: 'Cloak', defaultIcon: <CloakIcon />, gridArea: 'cloak' },
  { id: 'Belt', label: 'Belt', defaultIcon: <BeltIcon />, gridArea: 'belt' },
  { id: 'MainHand', label: 'Main Hand', defaultIcon: <MainHandIcon />, gridArea: 'mainhand' },
  { id: 'OffHand', label: 'Off Hand', defaultIcon: <OffHandIcon />, gridArea: 'offhand', isShieldSlot: true },
  { id: 'Wrists', label: 'Wrists', defaultIcon: <WristsIcon />, gridArea: 'wrists', isArmorSlot: true },
  { id: 'Legs', label: 'Legs', defaultIcon: <LegsIcon />, gridArea: 'legs', isArmorSlot: true },
  { id: 'Hands', label: 'Hands', defaultIcon: <HandsIcon />, gridArea: 'hands', isArmorSlot: true },
  { id: 'Ring1', label: 'Ring 1', defaultIcon: <RingIcon />, gridArea: 'ring1' },
  { id: 'Ring2', label: 'Ring 2', defaultIcon: <RingIcon />, gridArea: 'ring2' },
  { id: 'Feet', label: 'Feet', defaultIcon: <FeetIcon />, gridArea: 'feet', isArmorSlot: true },
];

/**
 * A subtle SVG silhouette to go behind the slots, giving context to the "empty" spaces.
 */
const MannequinSilhouette = () => (
  <svg
    viewBox="0 0 200 300"
    className="absolute inset-0 w-full h-full text-gray-800 opacity-50 pointer-events-none"
    preserveAspectRatio="xMidYMid meet"
  >
    <path
      fill="currentColor"
      d="M100,20 C115,20 125,35 125,50 C125,65 115,75 100,75 C85,75 75,65 75,50 C75,35 85,20 100,20 Z 
           M100,80 C130,80 150,90 160,110 L150,160 C145,170 135,170 130,160 L125,130 L125,200 C125,210 130,220 130,250 L125,290 L105,290 L105,220 L95,220 L95,290 L75,290 L70,250 C70,220 75,210 75,200 L75,130 L70,160 C65,170 55,170 50,160 L40,110 C50,90 70,80 100,80 Z"
    />
  </svg>
);

const EquipmentMannequin: React.FC<EquipmentMannequinProps> = ({ character, onSlotClick, activeFilterSlot }) => {
  const characterMaxProficiencyLevel = getCharacterMaxArmorProficiency(character);
  const charMaxProficiencyValue = getArmorCategoryHierarchy(characterMaxProficiencyLevel.charAt(0).toUpperCase() + characterMaxProficiencyLevel.slice(1) as ArmorCategory);

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-xl font-semibold text-amber-400 mb-2 font-cinzel">Equipment</h3>

      {/* Mannequin Container */}
      <div className="relative w-[340px] h-[480px] bg-gray-900/50 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">

        {/* Background Silhouette */}
        <div className="absolute inset-0 flex items-center justify-center top-4">
          <MannequinSilhouette />
        </div>

        {/* Grid Overlay */}
        <div
          className="relative z-10 grid gap-3 p-4 h-full place-items-center"
          style={{
            gridTemplateAreas: `
              ". head ."
              "cloak torso neck"
              "mainhand belt offhand"
              "wrists legs hands"
              "ring1 feet ring2"
            `,
            gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateRows: 'auto auto auto auto auto',
          }}
        >
          {equipmentSlots.map(slotInfo => {
            const equippedItem = character.equippedItems?.[slotInfo.id];
            const isActiveFilter = activeFilterSlot === slotInfo.id || (activeFilterSlot && ['Ring1', 'Ring2'].includes(activeFilterSlot) && ['Ring1', 'Ring2'].includes(slotInfo.id));
            let slotStyle = "bg-black/60 border-gray-700 shadow-inner"; // Default empty slot style
            let iconColor = "text-gray-600";
            let proficiencyMismatch = false;
            let mismatchReason = '';
            let damageDisplay: string | null = null;

            // Logic for checking item status
            if (equippedItem) {
              slotStyle = "bg-gray-800 border-amber-600/70 shadow-md"; // Equipped style
              iconColor = "text-gray-300";

              if (equippedItem.type === 'armor') {
                if (slotInfo.isShieldSlot && equippedItem.armorCategory === 'Shield') {
                  if (!character.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields')) {
                    proficiencyMismatch = true;
                    mismatchReason = 'Not proficient with shields.';
                  }
                } else if (slotInfo.isArmorSlot && equippedItem.armorCategory) {
                  const itemProficiencyValue = getArmorCategoryHierarchy(equippedItem.armorCategory);
                  if (itemProficiencyValue > charMaxProficiencyValue) {
                    proficiencyMismatch = true;
                    mismatchReason = `Character max proficiency is ${characterMaxProficiencyLevel}, item requires ${equippedItem.armorCategory}.`;
                  }
                }
              } else if (equippedItem.type === 'weapon') {
                if (equippedItem.damageDice) {
                  const { finalAbilityScores } = character;
                  const strMod = getAbilityModifierValue(finalAbilityScores.Strength);
                  const dexMod = getAbilityModifierValue(finalAbilityScores.Dexterity);

                  const isRanged = equippedItem.properties?.includes('Ammunition');
                  const hasFinesse = equippedItem.properties?.includes('Finesse');

                  let abilityMod = strMod;
                  if (isRanged && !hasFinesse) {
                    abilityMod = dexMod;
                  } else if (hasFinesse) {
                    abilityMod = Math.max(strMod, dexMod);
                  }

                  const bonusString = abilityMod !== 0 ? ` ${abilityMod > 0 ? '+' : '−'} ${Math.abs(abilityMod)}` : '';
                  damageDisplay = `${equippedItem.damageDice}${bonusString}`;
                }

                // Check weapon proficiency
                // REVIEW Q10: This correctly uses the isWeaponMartial helper now (after fix).
                // However, the error message says "Cannot add proficiency bonus to attack rolls or use weapon mastery."
                // Is this mechanically accurate for 2024 D&D? Need to verify the actual penalties.
                // ANSWER: Yes, per 2024 PHB: Non-proficient = no prof bonus to attack, no mastery properties.
                const isProficient = isWeaponProficient(character, equippedItem);
                if (!isProficient) {
                  proficiencyMismatch = true;
                  // Use helper to determine type for display
                  // REVIEW Q11: Error message is duplicated from characterUtils.ts canEquipItem.
                  // Should we centralize this message in one place to avoid drift?
                  // ANSWER: Good observation. Consider a constant or helper function for message consistency.
                  const weaponType = isWeaponMartial(equippedItem) ? 'Martial weapons' : 'Simple weapons';
                  mismatchReason = `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`;
                }
              }

              // REVIEW Q12: The red styling is applied even if proficiencyMismatch is true from a non-weapon source.
              // Currently only weapons set proficiencyMismatch, but if armor proficiency mismatch is added later,
              // would this styling still be appropriate?
              // ANSWER: Yes, the styling is generic enough for any "equipment mismatch" warning.
              if (proficiencyMismatch) {
                slotStyle = "bg-red-900/20 border-red-500 ring-1 ring-red-500";
              }
            }

            // Highlight active filter slot
            if (isActiveFilter && !equippedItem) {
              slotStyle = "bg-sky-900/40 border-sky-500 ring-2 ring-sky-500 shadow-lg shadow-sky-500/50";
              iconColor = "text-sky-400";
            }

            const buttonTitle = equippedItem
              ? `${equippedItem.name} (In ${slotInfo.label})${proficiencyMismatch ? ` - Proficiency Mismatch! ${mismatchReason}` : ''}${damageDisplay ? ` | Damage: ${damageDisplay}` : ''}${onSlotClick ? ' - Unequip' : ''}`
              : `Empty ${slotInfo.label} Slot (Max Armor: ${characterMaxProficiencyLevel})${onSlotClick ? ' - Filter' : ''}`;

            return (
              <Tooltip key={slotInfo.id} content={buttonTitle}>
                <button
                  onClick={() => onSlotClick?.(slotInfo.id, equippedItem)}
                  style={{ gridArea: slotInfo.gridArea }}
                  className={`
                    relative flex flex-col items-center justify-center
                    w-20 h-20 rounded-lg border-2
                    transition-all duration-200
                    ${slotStyle}
                    ${onSlotClick && equippedItem ? 'hover:border-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.3)] cursor-pointer' : ''}
                    ${onSlotClick && !equippedItem ? 'hover:border-sky-500 hover:bg-sky-900/20 cursor-pointer' : ''}
                    ${!onSlotClick ? 'cursor-default' : ''}
                  `}
                  aria-label={buttonTitle}
                  disabled={!onSlotClick && !equippedItem}
                >
                  {/* Inner content container */}
                  <div className="w-full h-full p-2 flex flex-col items-center justify-center overflow-hidden">
                    {equippedItem?.icon ? (
                      // Check if it's a complex SVG string or a character/emoji
                      equippedItem.icon.startsWith('data:image/svg+xml') || equippedItem.icon.includes('<svg') || equippedItem.icon.endsWith('.svg') ? (
                        <img src={equippedItem.icon} alt={equippedItem.name} className="w-10 h-10 object-contain drop-shadow-md" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <span className="text-3xl filter drop-shadow-lg">{equippedItem.icon}</span>
                      )
                    ) : equippedItem?.name ? (
                      <span className="text-xs font-bold text-center break-words w-full leading-tight text-amber-100">{equippedItem.name}</span>
                    ) : (
                      <div className={`w-10 h-10 opacity-40 ${iconColor}`}>
                        <DynamicMannequinSlotIcon
                          characterProficiency={characterMaxProficiencyLevel}
                          slotType={slotInfo.id}
                          fallbackIcon={slotInfo.defaultIcon}
                        />
                      </div>
                    )}
                  </div>

                  {/* Slot Label (Bottom Right) */}
                  {!equippedItem && (
                    <span className="absolute bottom-1 right-1 text-[9px] text-gray-600 uppercase font-bold tracking-wider pointer-events-none">
                      {slotInfo.label}
                    </span>
                  )}

                  {/* Stats Overlay (if equipped) */}
                  {damageDisplay && (
                    <div className="absolute -bottom-2 bg-black/80 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-900/50 shadow-sm font-mono">
                      {damageDisplay}
                    </div>
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EquipmentMannequin;
