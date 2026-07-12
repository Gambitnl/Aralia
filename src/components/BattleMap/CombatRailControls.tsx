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
    className="flex h-7 items-center rounded-md border border-slate-600/70 bg-slate-900/80 p-0.5 shadow"
    aria-label="Battlefield side panels"
  >
    {/* The left icon always describes the result of the next click. This keeps
        the button understandable even when the roster itself is out of view. */}
    {/* eslint-disable-next-line no-restricted-syntax -- The shared Button's touch-height would make this paired map-toolbar control taller than the surrounding compact controls. */}
    <button
      type="button"
      aria-label={`${rosterVisible ? 'Hide' : 'Show'} combat roster`}
      aria-pressed={rosterVisible}
      title={`${rosterVisible ? 'Hide' : 'Show'} party and enemy roster`}
      onClick={onToggleRoster}
      className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
        rosterVisible
          ? 'bg-sky-700 text-sky-50 hover:bg-sky-600'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {rosterVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
    </button>

    {/* The command rail is independent from the roster: map-first play can keep
        abilities visible, while cinematic inspection can hide both rails. */}
    {/* eslint-disable-next-line no-restricted-syntax -- This is the matching half of the compact panel-control pair and must keep the same fixed geometry. */}
    <button
      type="button"
      aria-label={`${commandVisible ? 'Hide' : 'Show'} combat commands`}
      aria-pressed={commandVisible}
      title={`${commandVisible ? 'Hide' : 'Show'} turn order, abilities, and combat log`}
      onClick={onToggleCommand}
      className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
        commandVisible
          ? 'bg-sky-700 text-sky-50 hover:bg-sky-600'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      }`}
    >
      {commandVisible ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
    </button>

    {/* Reset restores both visibility and remembered widths. Keeping this next
        to the two panel toggles makes recovery available even when both rails
        are hidden and their resize handles are therefore out of view. */}
    {/* eslint-disable-next-line no-restricted-syntax -- This matches the fixed compact geometry of the adjacent panel controls. */}
    <button
      type="button"
      aria-label="Reset combat panels"
      title="Reset combat panel visibility and widths"
      onClick={onResetLayout}
      disabled={layoutIsDefault}
      className="flex h-6 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-default disabled:text-slate-600 disabled:hover:bg-transparent"
    >
      <RotateCcw size={14} />
    </button>
  </div>
);

export default CombatRailControls;
