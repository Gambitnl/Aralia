/**
 * @file src/utils/visualUtils.ts
 * Utility functions for resolving visual assets for game entities.
 * Implements the "Pipeline" part of the Asset Requirement Standards.
 */

import { NPC, Race } from '../types';
import { NPCVisualSpec, VisualAsset } from '../types/visuals';

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
  // 1. Try to use specific portrait path
  if (visualSpec?.portraitPath) {
    return {
      src: visualSpec.portraitPath,
      fallbackContent: visualSpec.fallbackIcon || getRoleEmoji(npc.role),
      primaryColor: visualSpec.themeColor || getRoleColor(npc.role),
      label: visualSpec.description || `${npc.name} the ${npc.role}`
    };
  }

  // 2. Try to use AI-generated portrait URL (if we had one on the spec, but currently mapped to path)
  // (Future expansion: check for base64 data)

  // 3. Fallback to Role/Race based visual
  const emoji = visualSpec?.fallbackIcon || getRoleEmoji(npc.role);
  const color = visualSpec?.themeColor || getRoleColor(npc.role);

  return {
    fallbackContent: emoji,
    primaryColor: color,
    secondaryColor: '#1f2937', // dark gray
    label: `${npc.name} (${npc.role})`
  };
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
