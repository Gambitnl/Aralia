/**
 * @file src/utils/visualUtils.ts
 * Utility functions for resolving visual assets for game entities.
 * Implements the "Pipeline" part of the Asset Requirement Standards.
 */

import { NPC, Race, Item } from '../types';
import { NPCVisualSpec, VisualAsset, ItemVisualSpec } from '../types/visuals';

/**
 * Resolves the visual representation for an NPC, handling fallbacks.
 *
 * @param npc - The NPC entity
 * @param visualSpec - Optional specific visual spec (if attached to NPC or separate)
 * @param race - Optional race data for additional context
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export function resolveNPCVisual(
  npc: NPC,
  visualSpec?: NPCVisualSpec,
  race?: Race
): VisualAsset {
  // Resolve spec: use argument if provided, otherwise check the NPC object
  const spec = visualSpec || npc.visual;

  // 1. Try to use specific portrait path
  if (spec?.portraitPath) {
    return {
      src: spec.portraitPath,
      fallbackContent: spec.fallbackIcon || getRoleEmoji(npc.role),
      primaryColor: spec.themeColor || getRoleColor(npc.role),
      label: spec.description || `${npc.name} the ${npc.role}`
    };
  }

  // 2. Try to use AI-generated portrait URL (if we had one on the spec, but currently mapped to path)
  // (Future expansion: check for base64 data)

  // 3. Fallback to Role/Race based visual
  const emoji = spec?.fallbackIcon || getRoleEmoji(npc.role);
  const color = spec?.themeColor || getRoleColor(npc.role);

  return {
    fallbackContent: emoji,
    primaryColor: color,
    secondaryColor: '#1f2937', // dark gray
    label: `${npc.name} (${npc.role})`
  };
}

/**
 * Resolves the visual representation for an Item, handling legacy icons and fallbacks.
 *
 * @param item - The item entity
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export function resolveItemVisual(item: Item): VisualAsset {
  // 1. Try to use explicit visual spec if present
  if (item.visual?.iconPath) {
    return {
      src: item.visual.iconPath,
      fallbackContent: item.visual.fallbackIcon || item.icon || '📦',
      primaryColor: getItemRarityColor(item.visual.rarity),
      label: item.name
    };
  }

  // 2. Try to use legacy icon if it looks like a path
  if (item.icon && (item.icon.startsWith('/') || item.icon.startsWith('http') || item.icon.startsWith('data:'))) {
    return {
      src: item.icon,
      fallbackContent: '📦',
      primaryColor: '#9ca3af', // gray-400
      label: item.name
    };
  }

  // 3. Use legacy icon as fallback content (emoji/text) if not a path
  // If no icon at all, default to box
  return {
    fallbackContent: item.icon || '📦',
    primaryColor: '#9ca3af', // gray-400
    label: item.name
  };
}

/**
 * Helper to get border color based on item rarity.
 */
function getItemRarityColor(rarity?: ItemVisualSpec['rarity']): string {
  switch (rarity) {
    case 'common': return '#9ca3af'; // gray-400
    case 'uncommon': return '#10b981'; // emerald-500
    case 'rare': return '#3b82f6'; // blue-500
    case 'very_rare': return '#8b5cf6'; // violet-500
    case 'legendary': return '#f59e0b'; // amber-500
    default: return '#9ca3af';
  }
}

/**
 * Helper to get default emoji based on NPC role.
 */
function getRoleEmoji(role: NPC['role']): string {
  switch (role) {
    case 'merchant': return '💰';
    case 'guard': return '🛡️';
    case 'quest_giver': return '📜';
    case 'unique': return '✨';
    case 'civilian':
    default: return '👤';
  }
}

/**
 * Helper to get default theme color based on NPC role.
 */
function getRoleColor(role: NPC['role']): string {
  switch (role) {
    case 'merchant': return '#f59e0b'; // amber-500
    case 'guard': return '#3b82f6'; // blue-500
    case 'quest_giver': return '#8b5cf6'; // violet-500
    case 'unique': return '#ec4899'; // pink-500
    case 'civilian':
    default: return '#9ca3af'; // gray-400
  }
}
