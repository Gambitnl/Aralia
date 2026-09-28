/**
 * @file src/components/CharacterSheet/Overview/ItemComparisonPanel.tsx
 * Equipped-versus-candidate comparison for the inventory (agora-d1c7.13).
 * Hover an equippable item and the panel lines its numbers up against the
 * item in the slot it would take: damage, armor, weight, value, rarity, with
 * the delta colored green (better), red (worse), gray (same).
 */
import React from 'react';
import type { Item, EquipmentSlotType } from '../../../types';
import { averageDamage } from '../../../utils/naval/firepower';

export interface ComparisonRow {
  label: string;
  candidate: string;
  equipped: string;
  /** Positive = candidate better, negative = worse, 0 = same, null = not comparable. */
  delta: number | null;
  /** Numeric delta text, e.g. "+2.5", when delta is non-null and non-zero. */
  deltaText?: string;
}

const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, 'very rare': 3, legendary: 4, artifact: 5 };
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const fmt = (v: number | null, unit = ''): string => (v === null ? '—' : `${v % 1 === 0 ? v : v.toFixed(1)}${unit}`);

/** Build one row where "higher is better" unless lowerIsBetter. */
function row(label: string, cand: number | null, eq: number | null, opts: { unit?: string; lowerIsBetter?: boolean; candText?: string; eqText?: string } = {}): ComparisonRow {
  const { unit = '', lowerIsBetter = false, candText, eqText } = opts;
  if (cand === null || eq === null) return { label, candidate: candText ?? fmt(cand, unit), equipped: eqText ?? fmt(eq, unit), delta: null };
  const change = cand - eq; // what the number does if you swap
  const delta = lowerIsBetter ? -change : change; // is that good for you
  const deltaText = change === 0 ? undefined : `${change > 0 ? '+' : ''}${change % 1 === 0 ? change : change.toFixed(1)}`;
  return { label, candidate: candText ?? fmt(cand, unit), equipped: eqText ?? fmt(eq, unit), delta, deltaText };
}

/** Rows comparing a candidate to what is equipped (equipped may be absent). */
export function compareItems(candidate: Item, equipped: Item | null | undefined): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const eq = equipped ?? null;
  if (candidate.type === 'weapon' || eq?.type === 'weapon') {
    rows.push(row('Avg damage', candidate.damageDice ? averageDamage(candidate.damageDice) : null, eq?.damageDice ? averageDamage(eq.damageDice) : null,
      { candText: candidate.damageDice ? `${candidate.damageDice}${candidate.damageType ? ' ' + candidate.damageType : ''} (${fmt(averageDamage(candidate.damageDice))})` : '—',
        eqText: eq?.damageDice ? `${eq.damageDice}${eq.damageType ? ' ' + eq.damageType : ''} (${fmt(averageDamage(eq.damageDice))})` : '—' }));
    const props = (i: Item | null) => (i?.properties?.length ? i.properties.join(', ') : '—');
    rows.push({ label: 'Properties', candidate: props(candidate), equipped: props(eq), delta: null });
  }
  if (candidate.type === 'armor' || eq?.type === 'armor') {
    rows.push(row('Base AC', num(candidate.baseArmorClass), num(eq?.baseArmorClass)));
    rows.push(row('AC bonus', num(candidate.armorClassBonus) ?? 0, num(eq?.armorClassBonus) ?? 0, { candText: `+${num(candidate.armorClassBonus) ?? 0}`, eqText: eq ? `+${num(eq.armorClassBonus) ?? 0}` : '—' }));
    rows.push(row('Str required', num(candidate.strengthRequirement) ?? 0, num(eq?.strengthRequirement) ?? 0, { lowerIsBetter: true }));
    rows.push({ label: 'Stealth', candidate: candidate.stealthDisadvantage ? 'disadvantage' : 'ok', equipped: eq ? (eq.stealthDisadvantage ? 'disadvantage' : 'ok') : '—',
      delta: eq ? (Number(!!eq.stealthDisadvantage) - Number(!!candidate.stealthDisadvantage)) : null });
  }
  rows.push(row('Weight', num(candidate.weight), num(eq?.weight), { unit: ' lb', lowerIsBetter: true }));
  rows.push(row('Value', num(candidate.value), num(eq?.value), { unit: ' gp' }));
  const rr = (i: Item | null) => (i?.rarity ? RARITY_RANK[String(i.rarity).toLowerCase()] ?? null : null);
  rows.push(row('Rarity', rr(candidate), rr(eq), { candText: String(candidate.rarity ?? '—'), eqText: eq ? String(eq.rarity ?? '—') : '—' }));
  return rows;
}

export interface ItemComparisonPanelProps {
  candidate: Item;
  equipped: Item | null | undefined;
  slot: EquipmentSlotType | null;
}

export const ItemComparisonPanel: React.FC<ItemComparisonPanelProps> = ({ candidate, equipped, slot }) => {
  const rows = compareItems(candidate, equipped);
  const tone = (d: number | null) => (d === null || d === 0 ? 'text-gray-400' : d > 0 ? 'text-emerald-300' : 'text-rose-300');
  return (
    <div data-testid="item-comparison-panel" className="mb-3 rounded-lg border border-amber-500/30 bg-gray-900/80 p-3 text-xs">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-black uppercase tracking-[0.14em] text-amber-200">Compare</span>
        <span className="truncate text-gray-400">{slot ? `slot: ${slot}` : 'no slot'}</span>
      </div>
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-500">
            <th className="w-[26%] text-left font-medium">Stat</th>
            <th className="w-[32%] text-left font-medium text-amber-200 truncate" title={candidate.name}>{candidate.name}</th>
            <th className="w-[32%] text-left font-medium text-sky-200 truncate" title={equipped?.name ?? 'nothing equipped'}>{equipped?.name ?? 'Nothing equipped'}</th>
            <th className="w-[10%] text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-gray-800/80">
              <td className="py-0.5 text-gray-400">{r.label}</td>
              <td className={`py-0.5 truncate ${tone(r.delta)}`} title={r.candidate}>{r.candidate}</td>
              <td className="py-0.5 truncate text-gray-300" title={r.equipped}>{r.equipped}</td>
              <td className={`py-0.5 text-right tabular-nums ${tone(r.delta)}`}>{r.deltaText ?? (r.delta === 0 ? '=' : '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemComparisonPanel;
