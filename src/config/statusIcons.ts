/**
 * @file src/config/statusIcons.ts
 * Centralized configuration for status condition icons.
 */

// TODO(Materializer): Deprecate this file in favor of `STATUS_VISUALS` and `getStatusVisual` in `src/types/visuals.ts`.
// The new system provides color, description, and structured data beyond just the icon.

export const STATUS_ICONS: Record<string, string> = {
    'Blinded': '👁️',
    'Charmed': '💕',
    'Deafened': '🙉',
    'Frightened': '😱',
    'Grappled': '✊',
    'Incapacitated': '🤕',
    'Invisible': '👻',
    'Paralyzed': '⚡',
    'Petrified': '🗿',
    'Poisoned': '🤢',
    'Prone': '🛌',
    'Restrained': '⛓️',
    'Stunned': '💫',
    'Unconscious': '💤',
    'Exhaustion': '😫',
    'Ignited': '🔥',
    'Taunted': '🤬',
    'Blessed': '✨',
    'Baned': '📉'
  };

  export const DEFAULT_STATUS_ICON = '💀';
