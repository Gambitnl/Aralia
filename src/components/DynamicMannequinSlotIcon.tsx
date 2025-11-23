/**
 * @file DynamicMannequinSlotIcon.tsx
 * This component dynamically loads and displays an SVG icon for an equipment slot
 * based on the character's maximum armor proficiency.
 * It falls back to a default icon if the specific SVG is not found.
 */
import React, { useState, useEffect } from 'react';
import { ArmorProficiencyLevel, EquipmentSlotType } from '../types';

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
  const [svgSrc, setSvgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const slotIdLowercase = slotType.toLowerCase();
    const proficiencyPathPart = characterProficiency.toLowerCase();
    // Path assumes SVGs are in /src/assets/icons/mannequin/[PROFICIENCY_LEVEL]/[SLOT_ID_LOWERCASE].svg
    // Ensure these paths are resolvable by your build system or dev server (e.g., by placing them in a public assets folder).
    const path = `/src/assets/icons/mannequin/${proficiencyPathPart}/${slotIdLowercase}.svg`;
    
    setSvgSrc(path);
    setHasError(false); 
  }, [characterProficiency, slotType]);

  const handleError = () => {
    console.warn(`DynamicMannequinSlotIcon: Failed to load SVG for ${characterProficiency} ${slotType} at ${svgSrc}. Using fallback.`);
    setHasError(true);
  };

  if (hasError || !svgSrc) {
    return React.cloneElement(fallbackIcon, { className: "w-full h-full object-contain text-gray-500" });
  }

  return (
    <img 
      src={svgSrc} 
      alt={`${characterProficiency} ${slotType} slot icon`} 
      className="w-full h-full object-contain"
      onError={handleError} 
    />
  );
};

export default DynamicMannequinSlotIcon;