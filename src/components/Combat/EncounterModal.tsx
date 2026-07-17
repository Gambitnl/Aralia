// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 14:02:24
 * Dependents: components/layout/GameModals.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file EncounterModal.tsx
 * Displays an AI-generated encounter and provides a manual encounter builder
 * backed by the full 5eTools XMM bestiary.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Monster, GroundingChunk, Action, TempPartyMember } from '../../types';
import { CLASSES_DATA } from '../../constants';
import { t } from '../../utils/i18n';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import MonsterPicker, { PickedMonster } from './MonsterPicker';
import { calculateDifficulty, DifficultyTier } from '../../utils/combat/encounterDifficulty';
import { useGameState } from '../../state/GameContext';
import { simpleHash } from '../../utils/core/hashUtils';
import {
  generateBestiaryEncounter,
  BestiaryEncounterResult,
  EncounterDifficultyTarget,
} from '../../utils/world/bestiaryEncounterGenerator';
import { createLocationFreeSimulationSourceGap } from '../../systems/combat/unsupportedBattlefieldSources';

interface EncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: Monster[] | null;
  sources: GroundingChunk[] | null;
  error: string | null;
  isLoading: boolean;
  onAction: (action: Action) => void;
  partyUsed?: TempPartyMember[];
  /** Called when the user first opens the AI tab. Triggers the Gemini encounter generation. */
  onRequestAiGeneration?: () => void;
}

type Tab = 'ai' | 'custom' | 'bestiary';

const TIER_COLORS: Record<DifficultyTier, string> = {
  Easy:   'bg-green-500',
  Medium: 'bg-yellow-400',
  Hard:   'bg-orange-500',
  Deadly: 'bg-red-600',
};

const TIER_TEXT: Record<DifficultyTier, string> = {
  Easy:   'text-green-400',
  Medium: 'text-yellow-300',
  Hard:   'text-orange-400',
  Deadly: 'text-red-400',
};

const EncounterModal: React.FC<EncounterModalProps> = ({
  isOpen,
  onClose,
  encounter,
  sources,
  error,
  isLoading,
  onAction,
  partyUsed,
  onRequestAiGeneration,
}) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>('bestiary');
  /** Tracks whether we have already fired the AI generation request this session. */
  const [aiRequested, setAiRequested] = useState(false);
  const [customMonsters, setCustomMonsters] = useState<PickedMonster[]>([]);

  // Bestiary tab state — generated locally, no Redux needed
  const [bestiaryDifficulty, setBestiaryDifficulty] = useState<EncounterDifficultyTarget>('Medium');
  const [bestiaryResult, setBestiaryResult] = useState<BestiaryEncounterResult | null>(null);
  const [bestiaryGenerated, setBestiaryGenerated] = useState(false); // lazy: only generate on first tab visit
  const [bestiarySeedCounter, setBestiarySeedCounter] = useState(0);
  const [lairOnly, setLairOnly] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  /**
   * Single source of truth for the encounter being built on the bestiary tab.
   * Seeded from the generator on every roll; user can +/− any row or add extra
   * monsters from the search picker — all edits land here directly.
   */
  const [liveMonsters, setLiveMonsters] = useState<Monster[]>([]);

  const { state } = useGameState();
  const party = state.party;
  const effectiveParty: TempPartyMember[] = partyUsed && partyUsed.length > 0
    ? partyUsed
    : party.map(p => ({ id: p.id, name: p.name, classId: p.class.id, level: p.level || 1 }));

  const buildBestiarySeed = useCallback((difficulty: EncounterDifficultyTarget, lair: boolean) => {
    const partySeed = effectiveParty
      .map(member => `${member.id ?? member.name}:${member.level ?? 1}:${member.classId}`)
      .sort()
      .join('|');
    return simpleHash([
      state.worldSeed,
      state.currentLocationId,
      partySeed,
      difficulty,
      lair ? 'lair' : 'normal',
      bestiarySeedCounter,
    ].join('|'));
  }, [effectiveParty, state.worldSeed, state.currentLocationId, bestiarySeedCounter]);

  const rollBestiaryEncounter = useCallback((difficulty: EncounterDifficultyTarget, lair: boolean) => {
    const result = generateBestiaryEncounter(effectiveParty, {
      difficulty,
      lairOnly: lair,
      seed: buildBestiarySeed(difficulty, lair),
    });
    setBestiaryResult(result);
    setLiveMonsters(result?.monsters ? [...result.monsters] : []);
    setBestiaryGenerated(true);
  }, [effectiveParty, buildBestiarySeed]);

  /** Merges a MonsterPicker selection into liveMonsters — stacks onto existing rows. */
  const handleAddSearchMonster = useCallback((picked: PickedMonster) => {
    const cr = picked.isLair && picked.crLair ? picked.crLair : picked.cr;
    setLiveMonsters(prev => {
      const idx = prev.findIndex(m => m.name === picked.name && m.cr === cr);
      if (idx !== -1) {
        // Already in the list — increment quantity
        return prev.map((m, i) => i === idx ? { ...m, quantity: m.quantity + picked.quantity } : m);
      }
      return [...prev, {
        name: picked.name,
        quantity: picked.quantity,
        cr,
        description: `${picked.name} · CR ${cr}`,
      }];
    });
  }, []);

  useEffect(() => {
    if (isOpen && !isLoading) {
      // firstFocusableElementRef.current?.focus();
    }
  }, [isOpen, isLoading]);

  // Reset all local state whenever the modal is reopened
  useEffect(() => {
    if (isOpen) {
      setTab('bestiary');
      setAiRequested(false);
      setCustomMonsters([]);
      setBestiaryResult(null);
      setBestiaryGenerated(false);
      setBestiaryDifficulty('Medium');
      setLairOnly(false);
      setBestiarySeedCounter(0);
      setShowSearch(false);
      setLiveMonsters([]);
    }
  }, [isOpen]);

  // Fire AI generation the first time the user opens the AI tab
  useEffect(() => {
    if (tab === 'ai' && !aiRequested && !isLoading && !encounter) {
      setAiRequested(true);
      onRequestAiGeneration?.();
    }
  }, [tab, aiRequested, isLoading, encounter, onRequestAiGeneration]);

  // Auto-generate when the bestiary tab is first opened
  useEffect(() => {
    if (tab === 'bestiary' && !bestiaryGenerated) {
      rollBestiaryEncounter(bestiaryDifficulty, lairOnly);
    }
  }, [tab, bestiaryGenerated, bestiaryDifficulty, lairOnly, rollBestiaryEncounter]);

  // Live difficulty recalculated whenever quantities change.
  const liveDiff = useMemo(() => {
    const active = liveMonsters.filter(m => m.quantity > 0);
    if (active.length === 0) return null;
    return calculateDifficulty(
      active.map(m => ({ cr: m.cr, quantity: m.quantity })),
      effectiveParty.map(p => p.level || 1),
    );
  }, [liveMonsters, effectiveParty]);

  if (!isOpen) {
    return null;
  }

  const handleSimulateBattle = () => {
    let monsters: Monster[];
    if (tab === 'custom') {
      monsters = customMonsters.map(m => ({
        name: m.name,
        quantity: m.quantity,
        cr: m.isLair && m.crLair ? m.crLair : m.cr,
        description: m.description,
      }));
    } else if (tab === 'bestiary') {
      monsters = liveMonsters.filter(m => m.quantity > 0);
    } else {
      monsters = encounter ?? [];
    }

    if (monsters.length === 0) return;

    const proposedCombatantCount = monsters.reduce(
      (total, monster) => total + Math.max(0, monster.quantity),
      0,
    );

    // The builder may propose encounter content, but it has no location picker
    // and therefore cannot create a production battlefield. Preserve the mode
    // and count in an explicit refusal instead of preparing placeless actors.
    onAction({
      type: 'START_BATTLE_MAP_ENCOUNTER',
      label: 'Simulate Battle',
      payload: {
        startBattleMapEncounterData: {
          monsters: [],
          sourceGap: createLocationFreeSimulationSourceGap(
            tab,
            proposedCombatantCount,
          ),
        },
      },
    });
  };

  function addCustomMonster(m: PickedMonster) {
    setCustomMonsters(prev => {
      const existing = prev.findIndex(e => e.name === m.name && e.isLair === m.isLair);
      if (existing !== -1) {
        return prev.map((e, i) => i === existing ? { ...e, quantity: e.quantity + m.quantity } : e);
      }
      return [...prev, m];
    });
  }

  function removeCustomMonster(name: string, isLair?: boolean) {
    setCustomMonsters(prev => prev.filter(m => !(m.name === name && m.isLair === isLair)));
  }

  function toggleLair(name: string, isLair?: boolean) {
    setCustomMonsters(prev => prev.map(m => {
      if (m.name === name && m.isLair === isLair) {
        return { ...m, isLair: !m.isLair };
      }
      return m;
    }));
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center p-8">
          <p className="text-xl text-amber-300">{t('encounter_modal.loading')}</p>
          <p className="text-sm text-gray-400 mt-2">{t('encounter_modal.loading_flavor')}</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-6 bg-red-900/30 border border-red-500 rounded-lg">
          <h3 className="text-xl font-bold text-red-400 mb-2">{t('encounter_modal.error_title')}</h3>
          <p className="text-red-300">{error}</p>
        </div>
      );
    }
    if (!encounter || encounter.length === 0) {
      return <p className="text-gray-400 italic text-center p-8">{t('encounter_modal.no_encounter')}</p>;
    }
    return (
      <>
        {effectiveParty && effectiveParty.length > 0 && (
          <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
            <h5 className="text-xs font-semibold text-sky-400 mb-1">{t('encounter_modal.generated_for')}</h5>
            <p className="text-xs text-gray-400">
              {effectiveParty.map(p => `Lvl ${p.level} ${CLASSES_DATA[p.classId]?.name || 'Adventurer'}`).join(', ')}
            </p>
          </div>
        )}
        <div className="space-y-4">
          {encounter.map((monster, index) => (
            <div key={index} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
              <div className="flex justify-between items-baseline">
                <h4 className="text-xl font-bold text-amber-300">{monster.name} x {monster.quantity}</h4>
                <p className="text-sm text-sky-300">CR: {monster.cr}</p>
              </div>
              <p className="text-gray-400 italic mt-1">{monster.description}</p>
            </div>
          ))}
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-600">
            <h4 className="text-md font-semibold text-sky-400 mb-2">{t('encounter_modal.sources')}</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {sources.map((source, index) => (
                <li key={index}>
                  <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-300 underline break-all">
                    {source.web.title || source.web.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  const partyLevels = (effectiveParty ?? []).map(p => p.level);
  const difficulty = customMonsters.length > 0 && partyLevels.length > 0
    ? calculateDifficulty(
        customMonsters.map(m => ({ cr: m.cr, quantity: m.quantity })),
        partyLevels,
      )
    : null;

  const canSimulateAi = !isLoading && !error && encounter && encounter.length > 0;
  const canSimulateCustom = customMonsters.length > 0;
  const canSimulateBestiary = liveMonsters.some(m => m.quantity > 0);
  const canSimulate = tab === 'ai' ? canSimulateAi
    : tab === 'bestiary' ? canSimulateBestiary
    : canSimulateCustom;

  return (
    // WindowFrame owns the one accessible dialog boundary. This outer wrapper
    // only groups the encounter content; duplicating the role made assistive
    // technology announce two identically named dialogs for one window.
    <div>
      <WindowFrame
        title={t('encounter_modal.title')}
        onClose={onClose}
        storageKey={WINDOW_KEYS.ENCOUNTER_MODAL}
      >
      <div className="flex flex-col h-full bg-gray-800 p-6">
        {/* Tab bar */}
        <div className="flex border-b border-gray-600 mb-4 shrink-0">
          <button
            onClick={() => setTab('ai')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'ai'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            AI Generated
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'custom'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Custom (5eTools)
          </button>
          <button
            onClick={() => setTab('bestiary')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'bestiary'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎲 Bestiary Roll
          </button>
        </div>

        <div className="overflow-y-auto scrollable-content flex-grow p-1 pr-2">
          {tab === 'ai' && renderContent()}

          {tab === 'bestiary' && (
            <div className="flex flex-col gap-4">
              {/* Difficulty selector + lair toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 shrink-0">Difficulty:</span>
                {(['Easy', 'Medium', 'Hard', 'Deadly'] as EncounterDifficultyTarget[]).map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setBestiaryDifficulty(d);
                      setBestiarySeedCounter(0);
                      setBestiaryGenerated(false); // trigger re-gen via useEffect
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                      bestiaryDifficulty === d
                        ? d === 'Easy'   ? 'bg-green-700 text-green-200'
                        : d === 'Medium' ? 'bg-yellow-700 text-yellow-200'
                        : d === 'Hard'   ? 'bg-orange-700 text-orange-200'
                        : 'bg-red-800 text-red-200'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setBestiarySeedCounter(prev => prev + 1);
                    setBestiaryGenerated(false); // trigger re-gen via useEffect
                  }}
                  className="ml-auto px-3 py-1 text-xs font-semibold rounded bg-emerald-800/60 text-emerald-300 hover:bg-emerald-700/60 border border-emerald-700/50 transition-colors"
                >
                  🎲 Reroll
                </button>
              </div>

              {/* Lair toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const next = !lairOnly;
                    setBestiarySeedCounter(0);
                    setLairOnly(next);
                    setBestiaryGenerated(false); // trigger re-gen via useEffect
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    lairOnly ? 'bg-amber-600' : 'bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={lairOnly}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      lairOnly ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-300">
                  🏰 Lair encounter
                </span>
                {lairOnly && (
                  <span className="text-xs text-amber-400/80 italic">
                    — only monsters with lair actions
                  </span>
                )}
              </div>

              {/* Generated encounter */}
              {bestiaryResult ? (
                <>
                  {/* Party context */}
                  {effectiveParty.length > 0 && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <h5 className="text-xs font-semibold text-sky-400 mb-1">{t('encounter_modal.generated_for')}</h5>
                      <p className="text-xs text-gray-400">
                        {effectiveParty.map(p => `Lvl ${p.level} ${CLASSES_DATA[p.classId]?.name || 'Adventurer'}`).join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Template label */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Template:</span>
                    <span className="text-xs text-emerald-400 font-medium">{bestiaryResult.templateLabel}</span>
                  </div>

                  {/* Monster cards with quantity controls */}
                  <div className="space-y-2">
                    {liveMonsters.map((monster, i) => {
                      const qty = monster.quantity;
                      const removed = qty === 0;
                      const isAdded = bestiaryResult
                        ? !bestiaryResult.monsters.some(m => m.name === monster.name && m.cr === monster.cr)
                        : true;
                      return (
                        <div
                          key={`${monster.name}|${monster.cr}|${i}`}
                          className={`p-3 rounded-lg border transition-colors ${
                            removed
                              ? 'bg-gray-800/30 border-gray-700/40 opacity-40'
                              : isAdded
                              ? 'bg-indigo-900/30 border-indigo-700/50'
                              : 'bg-gray-700/50 border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Quantity stepper */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setLiveMonsters(prev => prev.map((m, j) => j === i ? { ...m, quantity: Math.max(0, m.quantity - 1) } : m))}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-600 hover:bg-gray-500 text-gray-200 text-sm font-bold leading-none transition-colors"
                                aria-label={`Decrease ${monster.name} count`}
                              >−</button>
                              <span className="w-6 text-center text-sm font-bold text-white tabular-nums">{qty}</span>
                              <button
                                onClick={() => setLiveMonsters(prev => prev.map((m, j) => j === i ? { ...m, quantity: m.quantity + 1 } : m))}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-600 hover:bg-gray-500 text-gray-200 text-sm font-bold leading-none transition-colors"
                                aria-label={`Increase ${monster.name} count`}
                              >+</button>
                            </div>

                            {/* Name + CR */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className={`font-bold text-sm ${removed ? 'line-through text-gray-400' : isAdded ? 'text-indigo-300' : 'text-amber-300'}`}>
                                  {monster.name}
                                </span>
                                <span className="text-xs text-sky-400 shrink-0">CR {monster.cr}</span>
                                {isAdded && !removed && (
                                  <span className="text-xs text-indigo-400/70 italic">added</span>
                                )}
                              </div>
                              {!removed && (
                                <p className="text-gray-400 italic text-xs mt-0.5 truncate">{monster.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Monster search — add extra creatures from the full 5eTools library */}
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowSearch(s => !s)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-700/60 text-xs font-semibold text-gray-300 transition-colors"
                    >
                      <span>＋ Add Monster from Library</span>
                      <span className="text-gray-400">{showSearch ? '▲' : '▼'}</span>
                    </button>
                    {showSearch && (
                      <div className="p-3 bg-gray-800/30 relative">
                        <MonsterPicker onAdd={handleAddSearchMonster} />
                      </div>
                    )}
                  </div>

                  {/* Live difficulty bar */}
                  {liveDiff ? (
                    <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                          Adjusted XP:{' '}
                          <span className="text-white font-medium">{liveDiff.adjustedXp.toLocaleString()}</span>
                          {liveDiff.rawXp !== liveDiff.adjustedXp && (
                            <span className="text-gray-400 ml-1">(raw {liveDiff.rawXp.toLocaleString()})</span>
                          )}
                        </span>
                        <span className={`text-xs font-bold ${TIER_TEXT[liveDiff.tier]}`}>
                          {liveDiff.tier}
                        </span>
                      </div>
                      <div className="relative h-2 rounded bg-gray-700 overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-150 ${TIER_COLORS[liveDiff.tier]}`}
                          style={{ width: `${Math.min(100, (liveDiff.adjustedXp / (liveDiff.thresholds.deadly * 1.5)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Easy {liveDiff.thresholds.easy.toLocaleString()}</span>
                        <span>Med {liveDiff.thresholds.medium.toLocaleString()}</span>
                        <span>Hard {liveDiff.thresholds.hard.toLocaleString()}</span>
                        <span>Deadly {liveDiff.thresholds.deadly.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-2">
                      All monsters removed — add at least one to see difficulty.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  {lairOnly
                    ? 'No lair monsters found at this difficulty — try a higher difficulty or disable the lair filter.'
                    : 'Generating encounter…'}
                </p>
              )}
            </div>
          )}

          {tab === 'custom' && (
            <div className="flex flex-col gap-4">
              <MonsterPicker onAdd={addCustomMonster} />

              {customMonsters.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wide">
                    Encounter ({customMonsters.reduce((s, m) => s + m.quantity, 0)} combatants)
                  </h4>
                  {customMonsters.map(m => (
                    <div
                      key={`${m.name}-${m.isLair ? 'lair' : 'base'}`}
                      className="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded border border-gray-600"
                    >
                      <div className="flex items-center">
                        <span className="text-sm text-white font-medium">{m.name}</span>
                        <span className="text-xs text-gray-400 ml-2">×{m.quantity} · CR {m.isLair && m.crLair ? m.crLair : m.cr}</span>
                        {m.crLair && (
                          <label className="ml-4 text-xs text-amber-300 cursor-pointer flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={m.isLair || false}
                              onChange={() => toggleLair(m.name, m.isLair)}
                              className="accent-amber-500"
                            />
                            In Lair
                          </label>
                        )}
                      </div>
                      <button
                        onClick={() => removeCustomMonster(m.name, m.isLair)}
                        className="text-gray-400 hover:text-red-400 text-xs ml-2 transition-colors"
                        aria-label={`Remove ${m.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {difficulty && (
                <div className="mt-2 p-3 bg-gray-900/50 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      Encounter XP: <span className="text-white font-medium">{difficulty.adjustedXp.toLocaleString()}</span>
                      {difficulty.multiplier !== 1 && (
                        <span className="text-gray-400 ml-1">
                          ({difficulty.rawXp.toLocaleString()} × {difficulty.multiplier})
                        </span>
                      )}
                    </span>
                    <span className={`text-xs font-bold ${TIER_TEXT[difficulty.tier]}`}>
                      {difficulty.tier}
                    </span>
                  </div>
                  <div className="relative h-2 rounded bg-gray-700 overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 transition-all ${TIER_COLORS[difficulty.tier]}`}
                      style={{ width: `${Math.min(100, (difficulty.adjustedXp / (difficulty.thresholds.deadly * 1.5)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Easy {difficulty.thresholds.easy.toLocaleString()}</span>
                    <span>Med {difficulty.thresholds.medium.toLocaleString()}</span>
                    <span>Hard {difficulty.thresholds.hard.toLocaleString()}</span>
                    <span>Deadly {difficulty.thresholds.deadly.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {customMonsters.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-2">
                  Search and click a monster to add it to the encounter.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            ref={firstFocusableElementRef}
            onClick={handleSimulateBattle}
            disabled={!canSimulate}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg shadow disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {t('encounter_modal.simulate')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            {t('encounter_modal.close')}
          </button>
        </div>
      </div>
      </WindowFrame>
    </div>
  );
};

export default EncounterModal;
