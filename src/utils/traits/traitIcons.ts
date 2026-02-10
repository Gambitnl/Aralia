import { VALID_TRAIT_ICONS } from './validTraitIcons';

/**
 * Shared trait icon resolver for both Character Creator and Glossary.
 *
 * Goal: One place to control which icon a given trait concept uses, so
 * changing it updates both UIs.
 */
export const getTraitIcon = (name: string, defaultIcon?: string): string => {
  const n = name.toLowerCase();

  // Explicit mappings for common traits
  if (n.includes('lucky') || n.includes('luck')) return 'clover';
  if (n.includes('brave') || n.includes('courage')) return 'shield_star';
  if (n.includes('nimble') || n.includes('speed') || n.includes('agility')) return 'wind';
  if (n.includes('resilience') || n.includes('tough')) return 'shield';
  if (n.includes('magic') || n.includes('spell')) return 'magic';
  if (n.includes('attack') || n.includes('combat')) return 'sword';
  if (n.includes('skill') || n.includes('expert')) return 'book';
  if (n.includes('vision') || n.includes('sight')) return 'eye';
  if (n.includes('heart') || n.includes('compassion') || n.includes('empathy') || n.includes('love')) return 'settings_heart';

  // Keep compatibility with any authored/default icon if valid.
  if (defaultIcon && VALID_TRAIT_ICONS.has(defaultIcon)) return defaultIcon;

  // If the name itself matches a valid icon id, allow it.
  const exactMatch = Array.from(VALID_TRAIT_ICONS).find((icon) => icon.toLowerCase() === n);
  if (exactMatch) return exactMatch;

  return 'auto_awesome';
};

