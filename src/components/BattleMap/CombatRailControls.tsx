// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:13:14
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file provides the two compact controls that show or hide the combat roster
 * and command rails. Both the real combat screen and the design-preview sandbox use
 * it so a player can temporarily give the battlefield more room without losing the
 * surrounding combat tools or creating two different layout conventions.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: lucide-react for familiar panel icons
 */
import React from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// Public Controls
// ============================================================================
// The parent combat shell owns visibility because it also owns the grid columns.
// This component only presents the state as two stable, accessible icon buttons.
// ============================================================================

interface CombatRailControlsProps {
  rosterVisible: boolean;
  commandVisible: boolean;
  onToggleRoster: () => void;
  onToggleCommand: () => void;
  onResetLayout: () => void;
  layoutIsDefault: boolean;
}

const CombatRailControls: React.FC<CombatRailControlsProps> = ({
  rosterVisible,
  commandVisible,
  onToggleRoster,
  onToggleCommand,
  onResetLayout,
  layoutIsDefault,
}) => (
  <div
    className="flex h-11 items-center gap-0.5 rounded-lg border border-slate-600/70 bg-slate-900/80 p-1 shadow"
    aria-label="Battlefield side panels"
  >
    {/* The left icon always describes the result of the next click. This keeps
        the button understandable even when the roster itself is out of view. */}
    {/* eslint-disable-next-line no-restricted-syntax -- A 36 px button inside the 44 px group: the group, not each button, is the toolbar's touch-height unit (2026-10-30: the old 28 px group stood out beside the 44 px toolbar buttons). */}
    <button
      type="button"
      aria-label={`${rosterVisible ? 'Hide' : 'Show'} combat roster`}
      aria-pressed={rosterVisible}
      title={`${rosterVisible ? 'Hide' : 'Show'} party and enemy roster`}
      onClick={onToggleRoster}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        rosterVisible
          ? 'bg-sky-700 text-sky-50 hover:bg-sky-600'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {rosterVisible ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
    </button>

    {/* The command rail is independent from the roster: map-first play can keep
        abilities visible, while cinematic inspection can hide both rails. */}
    {/* eslint-disable-next-line no-restricted-syntax -- The matching half of the panel-control pair keeps the same fixed geometry. */}
    <button
      type="button"
      aria-label={`${commandVisible ? 'Hide' : 'Show'} combat commands`}
      aria-pressed={commandVisible}
      title={`${commandVisible ? 'Hide' : 'Show'} actions, abilities, and combat log`}
      onClick={onToggleCommand}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        commandVisible
          ? 'bg-sky-700 text-sky-50 hover:bg-sky-600'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {commandVisible ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
    </button>

    {/* Reset restores both visibility and remembered widths. Keeping this next
        to the two panel toggles makes recovery available even when both rails
        are hidden and their resize handles are therefore out of view. */}
    {/* eslint-disable-next-line no-restricted-syntax -- This matches the fixed geometry of the adjacent panel controls. */}
    <button
      type="button"
      aria-label="Reset combat panels"
      title="Reset combat panel visibility and widths"
      onClick={onResetLayout}
      disabled={layoutIsDefault}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-default disabled:text-slate-600 disabled:hover:bg-transparent"
    >
      <RotateCcw size={16} />
    </button>
  </div>
);

export default CombatRailControls;
