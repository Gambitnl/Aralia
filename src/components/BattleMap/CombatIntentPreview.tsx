/**
 * @file CombatIntentPreview.tsx
 * Floating "intent" card shown over the battle map while the player is choosing
 * a target for an ability. It mirrors the tactical mockup's Intent Preview: the
 * ability's icon and name, its action cost, range, any granted follow-up, and a
 * short description — so the player can confirm what they're about to do before
 * committing a click on the grid.
 */
import React from 'react';
import { Ability } from '../../types/combat';
import { getAbilityIconVisual } from '../../utils/visuals/combatIconVisuals';
import { COMBAT_COST_COLORS } from './combatUiTheme';

interface CombatIntentPreviewProps {
  ability: Ability;
  casterName?: string;
}

const costLabel = (type: string): string =>
  type === 'bonus' ? 'Bonus Action'
    : type === 'movement-only' ? 'Movement'
    : type.charAt(0).toUpperCase() + type.slice(1);

const rangeLabel = (range: number): string =>
  range === 0 ? 'Self' : `${range} tiles (${range * 5} ft)`;

export const CombatIntentPreview: React.FC<CombatIntentPreviewProps> = ({ ability, casterName }) => {
  const visual = getAbilityIconVisual(ability);
  const cost = COMBAT_COST_COLORS[ability.cost.type] ?? COMBAT_COST_COLORS.action;
  const grants = ability.grantedActions ?? [];

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 w-64 rounded-xl border border-amber-700/50 bg-slate-950/92 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-amber-900/40 pb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
          {visual.src
            ? <img src={visual.src} alt="" className="h-6 w-6 object-contain" />
            : <span className="text-lg">{visual.fallbackContent}</span>}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-amber-200">{ability.name}</p>
          <p className={`text-[11px] font-semibold ${cost.text}`}>{costLabel(ability.cost.type)}</p>
        </div>
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
    </div>
  );
};

export default CombatIntentPreview;
