/**
 * @file src/components/BattleMap/RitualProgressPanel.tsx
 * Battle-map HUD panel for the ritual in progress: spell, caster, progress bar,
 * elapsed/total in the ritual's own unit, and the conditions that break it.
 * Renders nothing when no ritual is active (agora-f4ab.4, 2026-09-13).
 */
import React from 'react';
import type { CombatCharacter } from '../../types/combat';
import type { InterruptCondition, RitualState } from '../../types/rituals';

export interface RitualProgressPanelProps {
  ritual: RitualState | null | undefined;
  characters?: CombatCharacter[];
}

const CONDITION_LABEL: Record<InterruptCondition['type'], string> = {
  damage: 'Damage',
  movement: 'Movement',
  silence: 'Silence',
  incapacitated: 'Incapacitated',
  action: 'Other action',
  noise: 'Noise',
  distraction: 'Distraction',
};

const describeCondition = (condition: InterruptCondition): string => {
  const parts = [CONDITION_LABEL[condition.type] ?? condition.type];
  if (condition.threshold !== undefined) parts.push(`≥ ${condition.threshold}`);
  if (condition.saveType) {
    const dc = condition.dcCalculation === 'damage_half' ? 'DC ½ dmg'
      : condition.dcCalculation === 'fixed_10' ? 'DC 10'
      : condition.dcCalculation === 'damage_taken' ? 'DC dmg'
      : 'save';
    parts.push(`${condition.saveType.slice(0, 3)} ${dc}`);
  }
  return parts.join(' · ');
};

const unitLabel = (ritual: RitualState): string => {
  const n = ritual.durationTotal;
  switch (ritual.durationUnit) {
    case 'rounds': return n === 1 ? 'round' : 'rounds';
    case 'minutes': return n === 1 ? 'min' : 'min';
    case 'hours': return n === 1 ? 'hour' : 'hours';
    default: return 's';
  }
};

export const RitualProgressPanel: React.FC<RitualProgressPanelProps> = ({ ritual, characters = [] }) => {
  if (!ritual) return null;
  const total = ritual.durationTotalSeconds > 0 ? ritual.durationTotalSeconds : 1;
  const fraction = Math.max(0, Math.min(1, ritual.progressSeconds / total));
  const percent = Math.round(fraction * 100);
  const caster = characters.find((c) => c.id === ritual.casterId);
  const casterName = caster?.name ?? ritual.casterId;
  const state = ritual.interrupted ? 'interrupted' : ritual.isPaused ? 'paused' : 'casting';
  const tone = state === 'interrupted'
    ? 'border-rose-400/70 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.28)]'
    : state === 'paused'
      ? 'border-amber-300/70 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.25)]'
      : 'border-violet-300/70 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.35)]';
  const barTone = state === 'interrupted' ? 'bg-rose-400' : state === 'paused' ? 'bg-amber-300' : 'bg-violet-300';
  const shown = ritual.progress;
  const shownTotal = ritual.durationTotal;

  return (
    <div
      data-testid="ritual-progress-panel"
      role="status"
      aria-label={`Ritual ${ritual.spellName} ${percent}% complete`}
      className={`absolute right-3 top-14 z-30 w-[15.5rem] rounded-md border bg-slate-950/90 px-3 py-2 text-xs leading-snug backdrop-blur-sm ${tone}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-black uppercase tracking-[0.16em]">Ritual</span>
        <span className="text-[10px] uppercase tracking-[0.14em] opacity-80">{state}</span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-white" title={ritual.spellName}>{ritual.spellName}</div>
      <div className="truncate text-[11px] opacity-80" title={casterName}>{casterName}</div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-slate-800/90" aria-hidden="true">
        <div className={`h-full ${barTone}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums">
        <span>{shown} / {shownTotal} {unitLabel(ritual)}</span>
        <span>{percent}%</span>
      </div>
      {ritual.interruptConditions.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-70">Breaks on</div>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {ritual.interruptConditions.map((condition, index) => (
              <li
                key={`${condition.type}-${index}`}
                className="rounded border border-current/40 bg-slate-900/80 px-1.5 py-0.5 text-[10px]"
              >
                {describeCondition(condition)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ritual.interrupted && ritual.interruptionReason && (
        <div className="mt-1 text-[11px] text-rose-200">{ritual.interruptionReason}</div>
      )}
    </div>
  );
};

export default RitualProgressPanel;
