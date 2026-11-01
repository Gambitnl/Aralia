/**
 * @file DynamicMannequinSlotIcon.tsx
 * This component dynamically loads and displays an SVG icon for an equipment slot
 * based on the character's maximum armor proficiency.
 * It falls back to a default icon if the specific SVG is not found.
 */
import React, { useState, useEffect } from 'react';
import { ArmorProficiencyLevel, EquipmentSlotType } from '../../../types';
import { resolveItemAssetSrc } from '../../../utils/visuals';

interface DynamicMannequinSlotIconProps {
  characterProficiency: ArmorProficiencyLevel;
  slotType: EquipmentSlotType;
  fallbackIcon: React.ReactElement<{ className?: string }>; // The original default icon for the slot
}

const DynamicMannequinSlotIcon: React.FC<DynamicMannequinSlotIconProps> = ({
  characterProficiency,
  slotType,
  fallbackIcon,
}) => {
  // SVG assets live at public/assets/icons/mannequin/[proficiency]/[slot].svg,
  // covering all 13 paper-doll slots for light, medium, and heavy proficiency.
  // MANNEQUIN_SVGS_EXIST stays as a kill-switch: flip it to false to restore the
  // default slot icons everywhere without deleting assets.
  const MANNEQUIN_SVGS_EXIST = true;

  const [svgSrc, setSvgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // No unarmored/ asset tier exists: unarmored characters keep the default icons.
    if (!MANNEQUIN_SVGS_EXIST || characterProficiency === 'unarmored') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasError(true); // Skip straight to fallback
      return;
    }

    const slotIdLowercase = slotType.toLowerCase();
    const proficiencyPathPart = characterProficiency.toLowerCase();
    // Catalog-style portable path; resolveItemAssetSrc routes it through the Vite
    // base so the /Aralia/ deployment and nested routes request the right URL.
    const path = resolveItemAssetSrc(`assets/icons/mannequin/${proficiencyPathPart}/${slotIdLowercase}.svg`);

    setSvgSrc(path ?? null);
    setHasError(false);
  }, [characterProficiency, slotType, MANNEQUIN_SVGS_EXIST]);

  const handleError = () => {
    console.warn(`DynamicMannequinSlotIcon: Failed to load SVG for ${characterProficiency} ${slotType} at ${svgSrc}. Using fallback.`);
    setHasError(true);
  };

  if (hasError || !svgSrc) {
    return React.cloneElement(fallbackIcon, { className: "w-full h-full object-contain text-gray-400" });
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={svgSrc}
      alt={`${characterProficiency} ${slotType} slot icon`}
      className="w-full h-full object-contain"
      onError={handleError}
    />
  );
};

export default DynamicMannequinSlotIcon;
