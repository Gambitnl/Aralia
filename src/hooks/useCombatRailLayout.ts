// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:13:14
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file remembers which combat side rails the player wants visible.
 * First-time players see both rails, while returning players recover the last
 * roster and command layout they deliberately chose. The design preview and
 * playable combat screen share this hook so the same controls behave the same
 * way in both places.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: useLocalStorage for guarded, schema-validated browser storage
 */
import { useCallback, type CSSProperties, type SetStateAction } from 'react';
import { z } from 'zod';
import { useLocalStorage } from './useLocalStorage';

// ============================================================================
// Saved Layout Contract
// ============================================================================
// The versioned key lets a future layout model start fresh without trying to
// reinterpret an older shape. Only explicit visibility choices are persisted.
// ============================================================================

export const COMBAT_RAIL_LAYOUT_STORAGE_KEY = 'aralia-combat-rail-layout-v1';

export const COMBAT_ROSTER_WIDTH_MIN = 180;
export const COMBAT_ROSTER_WIDTH_DEFAULT = 230;
export const COMBAT_ROSTER_WIDTH_MAX = 360;
export const COMBAT_COMMAND_WIDTH_MIN = 250;
export const COMBAT_COMMAND_WIDTH_DEFAULT = 300;
export const COMBAT_COMMAND_WIDTH_MAX = 440;

interface CombatRailLayout {
  rosterVisible: boolean;
  commandVisible: boolean;
  rosterWidth: number;
  commandWidth: number;
}

const DEFAULT_COMBAT_RAIL_LAYOUT: CombatRailLayout = {
  rosterVisible: true,
  commandVisible: true,
  rosterWidth: COMBAT_ROSTER_WIDTH_DEFAULT,
  commandWidth: COMBAT_COMMAND_WIDTH_DEFAULT,
};

const combatRailLayoutSchema = z.object({
  rosterVisible: z.boolean(),
  commandVisible: z.boolean(),
  // Defaults migrate the visibility-only v1 value written by the first shell
  // pass, preserving that player's choice while adding safe starting widths.
  rosterWidth: z.number().min(COMBAT_ROSTER_WIDTH_MIN).max(COMBAT_ROSTER_WIDTH_MAX).default(COMBAT_ROSTER_WIDTH_DEFAULT),
  commandWidth: z.number().min(COMBAT_COMMAND_WIDTH_MIN).max(COMBAT_COMMAND_WIDTH_MAX).default(COMBAT_COMMAND_WIDTH_DEFAULT),
});

// Keep resized rails within the dimensions the combat cards were designed for.
// The grid applies an additional responsive cap so the map remains dominant.
const clampWidth = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, Math.round(value)))
);

// The CSS variables let both combat shells use the same remembered dimensions
// while media-query classes keep narrow layouts stacked. Viewport caps reserve
// roughly half the desktop width for the battlefield even at saved maxima.
export interface CombatRailGridStyle extends CSSProperties {
  '--combat-roster-width': string;
  '--combat-command-width': string;
}

export const createCombatRailGridStyle = (
  rosterWidth: number,
  commandWidth: number,
): CombatRailGridStyle => ({
  '--combat-roster-width': `clamp(${COMBAT_ROSTER_WIDTH_MIN}px, ${rosterWidth}px, min(${COMBAT_ROSTER_WIDTH_MAX}px, 24vw))`,
  '--combat-command-width': `clamp(${COMBAT_COMMAND_WIDTH_MIN}px, ${commandWidth}px, min(${COMBAT_COMMAND_WIDTH_MAX}px, 30vw))`,
});

// ============================================================================
// Shared Combat Layout Hook
// ============================================================================
// Each setter mirrors React state setters, including functional toggles. The
// complete pair is written together so restoring either screen is atomic.
// ============================================================================

interface UseCombatRailLayoutResult extends CombatRailLayout {
  setRosterVisible: (value: SetStateAction<boolean>) => void;
  setCommandVisible: (value: SetStateAction<boolean>) => void;
  setRosterWidth: (value: SetStateAction<number>) => void;
  setCommandWidth: (value: SetStateAction<number>) => void;
  resetLayout: () => void;
  layoutIsDefault: boolean;
}

export const useCombatRailLayout = (): UseCombatRailLayoutResult => {
  const [layout, setLayout, resetLayout] = useLocalStorage<CombatRailLayout>(
    COMBAT_RAIL_LAYOUT_STORAGE_KEY,
    DEFAULT_COMBAT_RAIL_LAYOUT,
    { schema: combatRailLayoutSchema },
  );

  // Preserve the command choice while changing only the roster side. Accepting
  // a function keeps the existing `visible => !visible` button pattern intact.
  const setRosterVisible = useCallback((value: SetStateAction<boolean>) => {
    setLayout(current => ({
      ...current,
      rosterVisible: typeof value === 'function' ? value(current.rosterVisible) : value,
    }));
  }, [setLayout]);

  // Preserve the roster choice while changing only the command side. This also
  // supports the compact turn strip's direct `true` restore action.
  const setCommandVisible = useCallback((value: SetStateAction<boolean>) => {
    setLayout(current => ({
      ...current,
      commandVisible: typeof value === 'function' ? value(current.commandVisible) : value,
    }));
  }, [setLayout]);

  // Pointer and keyboard resizing both feed this absolute roster width. The
  // clamp protects saved data even if an input device reports a large jump.
  const setRosterWidth = useCallback((value: SetStateAction<number>) => {
    setLayout(current => {
      const nextWidth = typeof value === 'function' ? value(current.rosterWidth) : value;
      return {
        ...current,
        rosterWidth: clampWidth(nextWidth, COMBAT_ROSTER_WIDTH_MIN, COMBAT_ROSTER_WIDTH_MAX),
      };
    });
  }, [setLayout]);

  // The command rail has a wider minimum because ability names and action-cost
  // badges need more room than the compact roster cards.
  const setCommandWidth = useCallback((value: SetStateAction<number>) => {
    setLayout(current => {
      const nextWidth = typeof value === 'function' ? value(current.commandWidth) : value;
      return {
        ...current,
        commandWidth: clampWidth(nextWidth, COMBAT_COMMAND_WIDTH_MIN, COMBAT_COMMAND_WIDTH_MAX),
      };
    });
  }, [setLayout]);

  const layoutIsDefault = layout.rosterVisible
    && layout.commandVisible
    && layout.rosterWidth === COMBAT_ROSTER_WIDTH_DEFAULT
    && layout.commandWidth === COMBAT_COMMAND_WIDTH_DEFAULT;

  return {
    ...layout,
    setRosterVisible,
    setCommandVisible,
    setRosterWidth,
    setCommandWidth,
    resetLayout,
    layoutIsDefault,
  };
};
