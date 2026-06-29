import React from 'react';
import { CombatCharacter, ActionCostType, ActiveEffect } from '../../types/combat';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { CharacterStats } from '../../types/core';

interface Props {
  character: CombatCharacter;
  onClose: () => void;
}

const abilityMod = (score: number): string => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const STAT_LABELS: [keyof CharacterStats, string][] = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
];

const COST_BADGE: Record<ActionCostType, { label: string; cls: string }> = {
  action:         { label: 'Action',    cls: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  bonus:          { label: 'Bonus',     cls: 'bg-sky-900/40 text-sky-300 border-sky-700/50' },
  reaction:       { label: 'Reaction',  cls: 'bg-violet-900/40 text-violet-300 border-violet-700/50' },
  legendary:      { label: 'Legendary', cls: 'bg-rose-900/40 text-rose-300 border-rose-700/50' },
  lair:           { label: 'Lair',      cls: 'bg-stone-800/60 text-amber-200 border-amber-800/50' },
  free:           { label: 'Free',      cls: 'bg-gray-700/40 text-gray-400 border-gray-600/50' },
  'movement-only':{ label: 'Move',      cls: 'bg-green-900/40 text-green-300 border-green-700/50' },
};

const STATUS_TYPE_CLS: Record<string, string> = {
  buff:    'bg-green-900/30 text-green-300 border-green-700/50',
  debuff:  'bg-red-900/30 text-red-300 border-red-700/50',
  dot:     'bg-orange-900/30 text-orange-300 border-orange-700/50',
  hot:     'bg-teal-900/30 text-teal-300 border-teal-700/50',
  neutral: 'bg-gray-700/40 text-gray-300 border-gray-600/50',
};

const Chip: React.FC<{ label: string; cls?: string }> = ({ label, cls = '' }) => (
  <span className={`px-2 py-0.5 rounded text-xs capitalize border ${cls}`}>{label}</span>
);

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <p className="text-[10px] uppercase text-amber-400 font-bold tracking-widest mb-2">{label}</p>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">{children}</div>
);

export const CombatCharacterInspector: React.FC<Props> = ({ character, onClose }) => {
  const ac = character.armorClass ?? character.baseAC;
  const hpPct = Math.min(100, (character.currentHP / character.maxHP) * 100);
  const teamBadgeCls = character.team === 'player'
    ? 'bg-sky-900/40 text-sky-300 border-sky-700/50'
    : 'bg-red-900/40 text-red-300 border-red-700/50';

  const hasDefenses =
    character.resistances?.length ||
    character.nonMagicalResistances?.length ||
    character.immunities?.length ||
    character.nonMagicalImmunities?.length ||
    character.vulnerabilities?.length ||
    character.conditionImmunities?.length;

  return (
    <WindowFrame
      title={character.name}
      onClose={onClose}
      storageKey={WINDOW_KEYS.COMBAT_INSPECTOR}
      initialMaximized={false}
    >
      <div className="overflow-y-auto scrollable-content h-full p-4 space-y-3 text-sm text-slate-200">

        {/* Identity tags */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <Chip label={character.team === 'player' ? 'Ally' : 'Enemy'} cls={teamBadgeCls} />
          {character.class?.name && (
            <Chip label={character.class.name} cls="bg-gray-700/50 text-gray-300 border-gray-600/50" />
          )}
          <Chip label={`CR/Lvl ${character.level}`} cls="bg-gray-700/50 text-gray-400 border-gray-600/50" />
          {character.creatureTypes?.map(t => (
            <Chip key={t} label={t} cls="bg-gray-700/40 text-gray-400 border-gray-600/40" />
          ))}
          {character.alignment && (
            <Chip label={character.alignment} cls="bg-gray-700/40 text-gray-400 border-gray-600/40" />
          )}
        </div>

        {/* HP bar + AC tile */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="w-full bg-gray-900 rounded-full h-5 shadow-inner overflow-hidden relative border border-gray-500">
              <div
                className="bg-red-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${hpPct}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                  {character.currentHP} / {character.maxHP} HP
                  {character.tempHP ? ` (+${character.tempHP} temp)` : ''}
                </p>
              </div>
            </div>
          </div>
          {ac != null && (
            <div className="flex flex-col items-center px-3 py-1 bg-gray-700/50 rounded-lg border border-gray-600/60 min-w-[52px]">
              <span className="text-[10px] uppercase text-amber-400 font-bold tracking-widest">AC</span>
              <span className="text-base font-bold text-white">{ac}</span>
            </div>
          )}
        </div>

        {/* 
          DEATH SAVING THROWS & STABILIZATION PANEL
          What changed: Added a dedicated card to display successes, failures, or a 'Stable' badge.
          Why: When player characters hit 0 HP, they enter a downed state. Tracking their death save
               progress or stabilization status is essential for players to make tactical healing decisions.
          What was preserved: Standard AC and HP bar metrics are left intact; this card only renders when
               character.deathSaves is defined, avoiding clutter for active allies or enemies.
        */}
        {character.deathSaves && (
          <Card>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-amber-400 font-bold tracking-widest">Death Saving Throws</p>
                {character.deathSaves.isStable ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-900/40 text-teal-300 border border-teal-700/50 shadow-sm shadow-teal-500/20 uppercase tracking-wider">
                    Stable
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900/40 text-rose-300 border border-rose-700/50 shadow-sm shadow-rose-500/20 uppercase tracking-wider animate-pulse">
                    Dying
                  </span>
                )}
              </div>

              {!character.deathSaves.isStable && (
                <div className="grid grid-cols-2 gap-4 mt-1">
                  {/* Successes row with 3 dots */}
                  <div className="flex items-center justify-between bg-gray-800/40 rounded px-2.5 py-1.5 border border-gray-600/30">
                    <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Successes</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(i => {
                        const isFilled = character.deathSaves!.successes >= i;
                        return (
                          <div
                            key={`success-${i}`}
                            className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                              isFilled
                                ? 'bg-green-500 border-green-400 shadow-sm shadow-green-500/40'
                                : 'bg-gray-900/60 border-gray-600'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Failures row with 3 dots */}
                  <div className="flex items-center justify-between bg-gray-800/40 rounded px-2.5 py-1.5 border border-gray-600/30">
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Failures</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(i => {
                        const isFilled = character.deathSaves!.failures >= i;
                        return (
                          <div
                            key={`failure-${i}`}
                            className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                              isFilled
                                ? 'bg-red-500 border-red-400 shadow-sm shadow-red-500/40'
                                : 'bg-gray-900/60 border-gray-600'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Ability scores */}
        <Card>
          <SectionHeader label="Ability Scores" />
          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {STAT_LABELS.map(([key, label]) => {
              const score = (character.stats[key] as number | undefined) ?? 10;
              return (
                <div key={key} className="flex items-center justify-between bg-gray-800/60 rounded px-2 py-1">
                  <span className="text-gray-400 text-xs font-bold">{label}</span>
                  <span className="text-white font-semibold text-xs">
                    {score} <span className="text-amber-300">({abilityMod(score)})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Speed */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-700/50 rounded-md border border-gray-600/60">
          <span className="text-[10px] uppercase text-amber-400 font-bold tracking-widest">Speed</span>
          <span className="text-white font-semibold">{character.stats.speed} ft</span>
          {character.stats.extraMovementSpeeds && Object.entries(character.stats.extraMovementSpeeds).map(([type, ft]) => (
            <span key={type} className="text-gray-400 text-xs capitalize">{type} {ft} ft</span>
          ))}
        </div>

        {/* Defenses */}
        {hasDefenses ? (
          <Card>
            <SectionHeader label="Defenses" />
            <div className="space-y-2">
              {character.resistances?.length ? (
                <div>
                  <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wide block mb-1">Resistances</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.resistances.map(r => <Chip key={r} label={r} cls="bg-green-900/30 text-green-300 border-green-700/50" />)}
                  </div>
                </div>
              ) : null}
              {character.nonMagicalResistances?.length ? (
                <div>
                  <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wide block mb-1">Non-magical Resistances</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.nonMagicalResistances.map(r => <Chip key={r} label={r} cls="bg-green-900/20 text-green-400 border-green-800/50" />)}
                  </div>
                </div>
              ) : null}
              {character.immunities?.length ? (
                <div>
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide block mb-1">Immunities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.immunities.map(i => <Chip key={i} label={i} cls="bg-blue-900/30 text-blue-300 border-blue-700/50" />)}
                  </div>
                </div>
              ) : null}
              {character.nonMagicalImmunities?.length ? (
                <div>
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide block mb-1">Non-magical Immunities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.nonMagicalImmunities.map(i => <Chip key={i} label={i} cls="bg-blue-900/20 text-blue-400 border-blue-800/50" />)}
                  </div>
                </div>
              ) : null}
              {character.vulnerabilities?.length ? (
                <div>
                  <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wide block mb-1">Vulnerabilities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.vulnerabilities.map(v => <Chip key={v} label={v} cls="bg-red-900/30 text-red-300 border-red-700/50" />)}
                  </div>
                </div>
              ) : null}
              {character.conditionImmunities?.length ? (
                <div>
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide block mb-1">Condition Immunities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.conditionImmunities.map(c => <Chip key={c} label={c} cls="bg-blue-900/20 text-blue-400 border-blue-800/50" />)}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {/* Conditions */}
        {character.conditions?.length ? (
          <Card>
            <SectionHeader label="Conditions" />
            <div className="flex flex-wrap gap-1.5">
              {character.conditions.map((c) => {
                const dur = c.duration.type === 'permanent' ? '∞'
                  : c.duration.type === 'rounds'  ? `${c.duration.value}r`
                  : c.duration.type === 'minutes' ? `${c.duration.value}m`
                  : '';
                return (
                  <Chip
                    key={`${c.name}-${c.appliedTurn}`}
                    label={dur ? `${c.name} ${dur}` : String(c.name)}
                    cls="bg-yellow-900/30 text-yellow-300 border-yellow-700/50"
                  />
                );
              })}
            </div>
          </Card>
        ) : null}

        {/* Active Spell Effects (buffs / debuffs) */}
        {(character.activeEffects?.length || character.concentratingOn) ? (
          <Card>
            <SectionHeader label="Active Effects" />
            <div className="space-y-2">

              {/* Concentration banner */}
              {character.concentratingOn && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-900/30 border border-violet-700/50 rounded">
                  <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wide shrink-0">Concentration</span>
                  <span className="text-violet-200 text-xs font-semibold">{character.concentratingOn.spellName}</span>
                  <span className="text-violet-400 text-[10px] ml-auto">Lvl {character.concentratingOn.spellLevel}</span>
                </div>
              )}

              {/* Individual active effects */}
              {character.activeEffects?.map((effect: ActiveEffect) => {
                const isBuff   = effect.type === 'buff';
                const isDebuff = effect.type === 'debuff';
                const rowCls = isBuff
                  ? 'bg-green-900/20 border-green-700/40'
                  : isDebuff
                    ? 'bg-red-900/20 border-red-700/40'
                    : 'bg-gray-700/30 border-gray-600/40';
                const labelCls = isBuff ? 'text-green-300' : isDebuff ? 'text-red-300' : 'text-gray-300';

                const dur = effect.duration.type === 'rounds'  ? `${effect.duration.value}r`
                  : effect.duration.type === 'minutes' ? `${effect.duration.value}m`
                  : effect.duration.type === 'special' ? 'special'
                  : '';

                const m = effect.mechanics;
                const pills: string[] = [];
                if (m?.acBonus)              pills.push(`AC ${m.acBonus > 0 ? '+' : ''}${m.acBonus}`);
                if (m?.attackBonus)          pills.push(`Atk ${m.attackBonus > 0 ? '+' : ''}${m.attackBonus}`);
                if (m?.savingThrowBonus)     pills.push(`Save ${m.savingThrowBonus > 0 ? '+' : ''}${m.savingThrowBonus}`);
                if (m?.damageBonus)          pills.push(`+${m.damageBonus.amount} ${m.damageBonus.type}`);
                if (m?.damageResistance?.length)  pills.push(`Resist: ${m.damageResistance.join(', ')}`);
                if (m?.damageImmunity?.length)    pills.push(`Immune: ${m.damageImmunity.join(', ')}`);
                if (m?.advantageOnAttacks)   pills.push('Adv Atk');
                if (m?.disadvantageOnAttacks) pills.push('Dis Atk');

                return (
                  <div key={effect.id} className={`px-2 py-1.5 rounded border ${rowCls}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${labelCls}`}>{effect.sourceName}</span>
                      {dur && <span className="text-[10px] text-gray-400 ml-auto">{dur}</span>}
                    </div>
                    {pills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pills.map(p => (
                          <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded border ${rowCls} ${labelCls}`}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {/* Status Effects */}
        {character.statusEffects?.length ? (
          <Card>
            <SectionHeader label="Status Effects" />
            <div className="space-y-2">
              {character.statusEffects.map(s => (
                <div key={s.id} className="flex items-start gap-2">
                  <Chip label={`${s.name} ${s.duration}r`} cls={STATUS_TYPE_CLS[s.type] ?? STATUS_TYPE_CLS.neutral} />
                  {s.description && <span className="text-gray-400 text-xs leading-relaxed">{s.description}</span>}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Abilities */}
        {character.abilities?.length ? (
          <Card>
            <SectionHeader label={`Abilities (${character.abilities.length})`} />
            <div className="space-y-3">
              {character.abilities.map((ability, idx) => {
                const badge = COST_BADGE[ability.cost.type] ?? COST_BADGE.free;
                return (
                  <div
                    key={ability.id}
                    className={idx > 0 ? 'border-t border-gray-600/40 pt-2' : ''}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Chip label={badge.label} cls={badge.cls} />
                      <span className="font-semibold text-slate-200">{ability.name}</span>
                      {ability.recharge && (
                        <span className="text-[10px] text-orange-400 font-semibold">[{ability.recharge.description}]</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{ability.description}</p>
                    {ability.grantedActions?.length ? (
                      <div className="mt-2 rounded border border-cyan-500/30 bg-cyan-950/30 p-2">
                        <span className="text-[10px] text-cyan-300 font-semibold uppercase tracking-wide block mb-1">Granted follow-up actions</span>
                        <div className="space-y-1">
                          {ability.grantedActions.map((action, actionIndex) => (
                            <div key={`${ability.id}-granted-${actionIndex}`} className="text-[11px] text-cyan-100">
                              <span className="font-semibold">{action.type === 'bonus_action' ? 'Bonus Action' : action.type}:</span> {action.action}
                              {action.frequency ? <span className="text-cyan-300"> ({action.frequency.replace('_', ' ')})</span> : null}
                              {action.notes ? <p className="text-cyan-200/80 leading-relaxed">{action.notes}</p> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

      </div>
    </WindowFrame>
  );
};
