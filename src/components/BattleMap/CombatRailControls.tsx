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
}

const CombatRailControls: React.FC<CombatRailControlsProps> = ({
  rosterVisible,
  commandVisible,
  onToggleRoster,
  onToggleCommand,
}) => (
  <div
    className="flex h-7 items-center rounded-md border border-slate-600/70 bg-slate-900/80 p-0.5 shadow"
    aria-label="Battlefield side panels"
  >
    {/* The left icon always describes the result of the next click. This keeps
        the button understandable even when the roster itself is out of view. */}
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
  </div>
);

export default CombatRailControls;
