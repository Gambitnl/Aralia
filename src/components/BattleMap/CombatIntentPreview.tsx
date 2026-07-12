// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:44:58
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CombatIntentPreview.tsx
 * Floating "intent" card shown over the battle map while the player is choosing
 * a target for an ability. It mirrors the tactical mockup's Intent Preview: the
 * ability's icon and name, its action cost, range, any granted follow-up, and a
 * short description — so the player can confirm what they're about to do before
 * committing a click on the grid. It also owns the visible cancel action and
 * Escape behavior so every map renderer exits targeting consistently.
 */
import React, { useEffect } from 'react';
import { Crosshair, X } from 'lucide-react';
import { Ability, TargetingType } from '../../types/combat';
import { getAbilityIconVisual } from '../../utils/visuals/combatIconVisuals';
import { COMBAT_COST_COLORS } from './combatUiTheme';

interface CombatIntentPreviewProps {
  ability: Ability;
  casterName?: string;
  onCancel: () => void;
}

const costLabel = (type: string): string =>
  type === 'bonus' ? 'Bonus Action'
    : type === 'movement-only' ? 'Movement'
    : type.charAt(0).toUpperCase() + type.slice(1);

const rangeLabel = (range: number): string =>
  range === 0 ? 'Self' : `${range} ${range === 1 ? 'tile' : 'tiles'} (${range * 5} ft)`;

// Translate engine targeting categories into the immediate choice the player
// is making. Range remains separate so this line stays short on compact maps.
const targetInstruction = (targeting: TargetingType): string => {
  const instructions: Record<TargetingType, string> = {
    single_enemy: 'Choose an enemy',
    single_ally: 'Choose an ally',
    single_any: 'Choose a creature',
    area: 'Choose the area center',
    self: 'Choose a destination',
    all_enemies: 'All enemies are targeted',
    all_allies: 'All allies are targeted',
  };

  return instructions[targeting];
};

// Text inputs can appear during AI-arbitrated spell prompts. Escape belongs to
// that editor while it is focused, not to the targeting state behind it.
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
};

export const CombatIntentPreview: React.FC<CombatIntentPreviewProps> = ({
  ability,
  casterName,
  onCancel,
}) => {
  const visual = getAbilityIconVisual(ability);
  const cost = COMBAT_COST_COLORS[ability.cost.type] ?? COMBAT_COST_COLORS.action;
  const grants = ability.grantedActions ?? [];

  // Escape is a universal cancel path while this HUD is mounted. Capture mode
  // gives targeting first refusal before map or window shortcuts handle the key.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onCancel]);

  return (
    <aside
      data-testid="combat-targeting-hud"
      aria-label={`${ability.name} targeting`}
      className="pointer-events-auto absolute bottom-24 right-3 z-20 w-64 max-w-[calc(100%-1.5rem)] rounded-lg border border-amber-600/60 bg-slate-950/94 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.68)] backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-amber-900/40 pb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
          {visual.src
            ? <img src={visual.src} alt="" className="h-6 w-6 object-contain" />
            : <span className="text-lg">{visual.fallbackContent}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-amber-200">{ability.name}</p>
          <p className={`text-[11px] font-semibold ${cost.text}`}>{costLabel(ability.cost.type)}</p>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- This compact icon action belongs inside the targeting HUD rather than using the shared full-height button. */}
        <button
          type="button"
          onClick={onCancel}
          aria-label={`Cancel ${ability.name} targeting`}
          title="Cancel targeting"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-rose-500/70 hover:bg-rose-950 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <X size={16} />
        </button>
      </div>

      {/* This is state, not tutorial copy: it names the exact selection the
          currently armed ability is waiting for. */}
      <div className="mt-2 flex items-center gap-2 rounded-md border border-sky-800/60 bg-sky-950/45 px-2 py-1.5 text-[11px] font-bold text-sky-200">
        <Crosshair size={14} className="shrink-0" />
        <span>{targetInstruction(ability.targeting)}</span>
      </div>

      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <dt className="text-slate-400">Range</dt>
          <dd className="font-medium text-amber-200">{rangeLabel(ability.range)}</dd>
        </div>
        {grants.length > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Follow-up</dt>
            <dd className="truncate text-right font-medium text-sky-300">{grants[0].action}</dd>
          </div>
        )}
        {casterName && (
          <div className="flex justify-between">
            <dt className="text-slate-400">Caster</dt>
            <dd className="font-medium text-slate-200">{casterName}</dd>
          </div>
        )}
      </dl>

      {ability.description && (
        <p className="mt-2 line-clamp-3 border-t border-slate-800 pt-2 text-[11px] leading-snug text-slate-300">
          {ability.description}
        </p>
      )}
    </aside>
  );
};

export default CombatIntentPreview;
