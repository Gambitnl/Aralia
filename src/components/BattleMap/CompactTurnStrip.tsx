// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 18:40:42
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
 * This file keeps the minimum turn information beside the battlefield when the
 * full command rail is hidden. It prevents map-focus mode from concealing whose
 * turn it is, which actions remain, how much movement is left, or the End Turn
 * command. Both the playable combat screen and the design preview use the same
 * strip so collapsing a rail has one predictable meaning everywhere.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: the active combat character and familiar lucide interface icons
 */
import React from 'react';
import {
  Footprints,
  PanelRightOpen,
  Shield,
  SkipForward,
  Sparkles,
  Sword,
} from 'lucide-react';
import { CombatCharacter } from '../../types/combat';

// ============================================================================
// Public Contract
// ============================================================================
// The parent still owns turn progression and rail visibility. The strip reads
// that state and exposes only the two commands that remain relevant here.
// ============================================================================

interface CompactTurnStripProps {
  character: CombatCharacter | null;
  isCharactersTurn: boolean;
  onEndTurn: () => void | Promise<void>;
  onRestoreCommands: () => void;
}

// ============================================================================
// Compact Resource Marker
// ============================================================================
// Each marker uses color and a crossed-out state together, so spent resources
// remain understandable without relying on color alone.
// ============================================================================

interface ResourceMarkerProps {
  label: string;
  spent: boolean;
  colorClass: string;
  icon: React.ReactNode;
}

const ResourceMarker: React.FC<ResourceMarkerProps> = ({
  label,
  spent,
  colorClass,
  icon,
}) => (
  <span
    className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/70 px-1.5 ${
      spent ? 'text-slate-600 opacity-60' : colorClass
    }`}
    aria-label={`${label} ${spent ? 'spent' : 'ready'}`}
    title={`${label}: ${spent ? 'spent' : 'ready'}`}
  >
    {icon}
    <span className={`hidden text-[10px] font-black uppercase sm:inline ${spent ? 'line-through' : ''}`}>
      {label}
    </span>
  </span>
);

// ============================================================================
// Compact Turn HUD
// ============================================================================
// This is intentionally status-first rather than a miniature ability palette.
// The full command rail remains the place for choosing abilities and reading
// the combat log; this strip only prevents a hidden rail from hiding essentials.
// ============================================================================

const CompactTurnStrip: React.FC<CompactTurnStripProps> = ({
  character,
  isCharactersTurn,
  onEndTurn,
  onRestoreCommands,
}) => {
  // No active actor can occur briefly while combat initializes. Keeping the
  // restore command available lets the player recover the full command rail.
  if (!character) {
    return (
      <div
        data-testid="compact-turn-strip"
        className="flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md border border-slate-700/80 bg-slate-950/85 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
        role="status"
        aria-label="Compact turn controls"
      >
        <span className="text-xs font-semibold text-slate-400">Waiting for turn order</span>
        {/* eslint-disable-next-line no-restricted-syntax -- This compact icon restores the touch-sized command rail without making the status strip taller. */}
        <button
          type="button"
          onClick={onRestoreCommands}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-sky-700/70 bg-sky-950/70 text-sky-200 hover:bg-sky-900"
          aria-label="Show combat commands"
          title="Show combat commands"
        >
          <PanelRightOpen size={17} />
        </button>
      </div>
    );
  }

  const { actionEconomy } = character;
  const movementRemaining = Math.max(0, actionEconomy.movement.total - actionEconomy.movement.used);
  const isPlayerActor = character.team === 'player';
  const turnLabel = isPlayerActor && isCharactersTurn
    ? 'Your turn'
    : `${character.team === 'enemy' ? 'Enemy' : 'Ally'} turn`;

  return (
    <div
      data-testid="compact-turn-strip"
      className="flex min-h-11 max-w-full shrink-0 flex-wrap items-center gap-2 rounded-md border border-amber-700/45 bg-slate-950/90 px-2 py-1.5 shadow-lg backdrop-blur-sm min-[480px]:flex-nowrap"
      role="status"
      aria-label="Compact turn controls"
    >
      {/* The actor identity stays first so every resource marker has an obvious
          owner even when several combatants are close together on the map. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-amber-400/80 bg-slate-800 text-xs font-black text-amber-100">
          {character.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-slate-100 sm:max-w-32">
            {character.name}
          </span>
          <span className={`block text-[10px] font-black uppercase ${isCharactersTurn ? 'text-amber-300' : 'text-slate-400'}`}>
            {turnLabel}
          </span>
        </span>
      </div>

      {/* Player resources remain visible while the command rail is collapsed.
          Narrow screens place them on a second row rather than deleting them;
          enemy turns omit them because they are not player choices. */}
      {isPlayerActor && (
        <div className="order-3 flex w-full items-center justify-center gap-1 min-[480px]:order-none min-[480px]:w-auto" aria-label="Available turn resources">
          <ResourceMarker
            label="Action"
            spent={actionEconomy.action.used}
            colorClass="text-rose-300"
            icon={<Sword size={15} />}
          />
          <ResourceMarker
            label="Bonus"
            spent={actionEconomy.bonusAction.used}
            colorClass="text-amber-300"
            icon={<Sparkles size={15} />}
          />
          <ResourceMarker
            label="Reaction"
            spent={actionEconomy.reaction.used}
            colorClass="text-sky-300"
            icon={<Shield size={15} />}
          />
          <span
            className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-800/70 bg-emerald-950/50 px-2 text-emerald-200"
            aria-label={`${movementRemaining} feet of movement remaining`}
            title={`${movementRemaining} / ${actionEconomy.movement.total} feet of movement remaining`}
          >
            <Footprints size={15} />
            <span className="text-[10px] font-black tabular-nums">{movementRemaining} ft</span>
          </span>
        </div>
      )}

      {/* Restoring commands is icon-only because the familiar panel symbol is
          enough here; its accessible label and tooltip name the exact result. */}
      {/* eslint-disable-next-line no-restricted-syntax -- This icon belongs to a compact HUD whose fixed 32px geometry protects the battlefield height. */}
      <button
        type="button"
        onClick={onRestoreCommands}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-700/70 bg-sky-950/70 text-sky-200 hover:bg-sky-900"
        aria-label="Show combat commands"
        title="Show combat commands"
      >
        <PanelRightOpen size={17} />
      </button>

      {/* Ending a turn is the only tactical command duplicated from the full
          rail. It remains visible because hiding a panel must never trap play. */}
      {isPlayerActor && (
        /* eslint-disable-next-line no-restricted-syntax -- The surrounding compact HUD is already a keyboard-accessible, fixed-height control surface. */
        <button
          type="button"
          onClick={() => { void onEndTurn(); }}
          disabled={!isCharactersTurn}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-orange-500/70 bg-orange-700 px-2.5 text-xs font-bold text-orange-50 shadow hover:bg-orange-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          aria-label={`End ${character.name}'s turn`}
        >
          <SkipForward size={15} />
          <span className="hidden sm:inline">End Turn</span>
        </button>
      )}
    </div>
  );
};

export default CompactTurnStrip;
