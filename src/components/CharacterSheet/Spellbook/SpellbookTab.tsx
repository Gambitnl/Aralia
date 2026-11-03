/**
 * This file renders the Spellbook tab inside the resizable Character Sheet.
 *
 * It combines the character's known and prepared spells with the shared spell
 * registry, then shows casting controls and details for the selected spell. When
 * the compiled glossary contains that spell, the tab uses the same structured
 * detail renderer as the full Spellbook overlay so rule links stay interactive.
 * The older spell detail pane remains the fallback for spells that have not been
 * compiled yet.
 *
 * Called by: CharacterSheetModal.tsx
 * Depends on: SpellContext, GlossaryContext, FullEntryDisplay, and SpellDetailPane
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:51:52
 * Dependents: components/CharacterSheet/Spellbook/index.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState, useContext, useMemo, useEffect } from 'react';
// Local SVG glyphs remain legible when an external icon font is unavailable.
import {Sparkles,Lock,Search,MousePointer} from 'lucide-react';
import { PlayerCharacter, Spell, Action } from '../../../types';
import { getRulesEdition, type RulesEdition } from '../../../config/rulesEdition';
import { preparationPlanError, preparationMinutes, preparationSpellError, togglePreparationPlan, usesRestPreparation } from '../../../systems/gameplay/spellPreparation';
import SpellContext from '../../../context/SpellContext';
import GlossaryContext from '../../../context/GlossaryContext';
import { CLASSES_DATA } from '../../../constants';
import { getMaxPreparedSpells, getPreparedSpellsAffectingLimit, isRacialSpellLockedForPreparation } from '../../../utils/character/characterUtils';
import { findGlossaryEntryAndPath } from '../../../utils/visuals';
import { fetchWithTimeout } from '../../../utils/context';
import { assetUrl } from '../../../config/env';
import { FullEntryDisplay } from '../../Glossary/FullEntryDisplay';
import SpellCardTemplate from '../../Glossary/SpellCardTemplate';
import SpellSlotDisplay from './SpellSlotDisplay';
import SpellDetailPane from './SpellDetailPane';
import CastSpellControls from './CastSpellControls';
import { SpellSummaryCard } from '../../ui/SpellSummaryCard';
// GG-378: shared button style and control roles.
import { BTN_FOCUS_VISIBLE, BTN_TEXT_LINK } from '../../../styles/buttonStyles';

// ============================================================================
// Spellbook Rules and Inputs
// ============================================================================
// These declarations describe the caster behavior and navigation hooks the
// Character Sheet supplies before the component assembles its visible spell list.
// ============================================================================

// These classes choose daily spells from their class list. A wizard still
// needs a learned spell in the spellbook; browsing a list never teaches it.
const CLASS_LIST_PREPARATION_IDS = ['cleric', 'druid', 'paladin', 'artificer'];

interface SpellReferencedRule {
    label: string;
    description: string;
    glossaryTermId?: string;
}

interface SpellReferencedRulesEnrichmentFile {
    enrichmentDataset?: {
        spells?: Array<{
            spellId: string;
            referencedRules?: SpellReferencedRule[];
        }>;
    };
}

interface SpellbookTabProps {
    character: PlayerCharacter;
    rulesEdition?: RulesEdition;
    onAction: (action: Action) => void;
    /** Full party, used by the out-of-combat cast target picker. */
    party?: PlayerCharacter[];
    /** Opens a linked rule in the application's existing glossary route. */
    onNavigateToGlossary?: (termId: string) => void;
}

const SpellbookTab: React.FC<SpellbookTabProps> = ({ character, onAction, party, onNavigateToGlossary, rulesEdition }) => {
    const edition = getRulesEdition({rulesEdition});
    const [currentLevel, setCurrentLevel] = useState(0);
    const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
    const [showAllPossibleSpells, setShowAllPossibleSpells] = useState(false);
    const [referencedRulesBySpellId, setReferencedRulesBySpellId] = useState<Record<string, SpellReferencedRule[]>>({});
    // A failed enrichment load used to be indistinguishable from a spell that
    // simply cites no rules. This records the failure so the tab can say so.
    const [ruleLinkLoadError, setRuleLinkLoadError] = useState<string | null>(null);
    const allSpellsData = useContext(SpellContext);
    const glossaryEntries = useContext(GlossaryContext);

    // Load the same generated spell-to-rule links used by the full Glossary.
    // Keeping this as one lazy request per mounted tab avoids parsing spell text
    // in the browser and gives every structured spell card canonical link ids.
    useEffect(() => {
        let cancelled = false;

        fetchWithTimeout<SpellReferencedRulesEnrichmentFile>(
            assetUrl('data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json')
        )
            .then((data) => {
                if (cancelled) return;

                const nextRulesBySpellId = Object.fromEntries(
                    (data.enrichmentDataset?.spells ?? []).map((spellRecord) => [
                        spellRecord.spellId,
                        spellRecord.referencedRules ?? [],
                    ])
                );

                setReferencedRulesBySpellId(nextRulesBySpellId);
                setRuleLinkLoadError(null);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                // The spell itself must stay readable, so a missing enrichment file
                // does not blank the card. It does gate the rule links and says so
                // in the UI: silently showing spell prose with no rule chips looked
                // identical to a spell that cites no rules (agora-65d0).
                setReferencedRulesBySpellId({});
                setRuleLinkLoadError(error instanceof Error ? error.message : String(error));
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Compute spell lists
    const { spellsToDisplay, knownSpellIds, preparedSpellIds, levels } = useMemo(() => {
        if (!allSpellsData || !character.spellbook) {
            return { spellsToDisplay: [], knownSpellIds: new Set<string>(), preparedSpellIds: new Set<string>(), levels: [0] };
        }

        const { spellbook, spellSlots } = character;
        const maxSpellLevelCharCanCast = Math.max(0, ...Object.entries(spellSlots ?? {})
            .filter(([, slot]) => slot.max > 0)
            .map(([key]) => parseInt(key.replace('level_', ''))));
        
        // Include levels for future racial spell grants
        const racialFutureLevels = (character.race.knownSpells ?? [])
            .map(s => allSpellsData[s.spellId]?.level ?? 0);
        const maxLevel = Math.max(maxSpellLevelCharCanCast, ...racialFutureLevels, 0);
        const lvls = Array.from({ length: maxLevel + 1 }, (_, i) => i);

        const classData = CLASSES_DATA[character.class.id];
        const classSpellList = classData?.spellcasting?.spellList
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s) ?? [];

        const known = new Set([
            ...(spellbook.cantrips ?? []),
            ...(spellbook.preparedSpells ?? []),
            ...(spellbook.preparationPlan?.preparedSpells ?? []),
            ...(spellbook.knownSpells ?? []),
            ...(character.race.knownSpells?.map(s => s.spellId) ?? [])
        ]);

        const prepared = new Set(spellbook.preparedSpells ?? []);

        let spells: Spell[] = [];
        if (showAllPossibleSpells) {
            const combinedIds = new Set([
                ...classSpellList.map(s => s.id),
                ...Array.from(known)
            ]);
            spells = Array.from(combinedIds)
                .map(id => allSpellsData[id])
                .filter((s): s is Spell => !!s && s.level === currentLevel);
        } else {
            spells = Array.from(known)
                .map(id => allSpellsData[id])
                .filter((s): s is Spell => !!s && s.level === currentLevel);
        }
        spells.sort((a, b) => a.name.localeCompare(b.name));

        return { spellsToDisplay: spells, knownSpellIds: known, preparedSpellIds: prepared, levels: lvls };
    }, [allSpellsData, character, currentLevel, showAllPossibleSpells]);

    // Auto-select first spell when level changes or list updates
    useEffect(() => {
        if (spellsToDisplay.length > 0 && !spellsToDisplay.find(s => s.id === selectedSpellId)) {
            setSelectedSpellId(spellsToDisplay[0].id);
        }
    }, [spellsToDisplay, selectedSpellId]);

    // Get selected spell from SpellContext
    const selectedSpell = useMemo(() => {
        if (!selectedSpellId || !allSpellsData) return null;
        return allSpellsData[selectedSpellId] || null;
    }, [selectedSpellId, allSpellsData]);

    // Resolve the selected spell against the compiled glossary index. A missing
    // match is expected while migration is incomplete and deliberately falls
    // through to the legacy SpellDetailPane below.
    const selectedSpellEntry = useMemo(() => {
        if (!selectedSpellId || !glossaryEntries) return null;
        const { entry } = findGlossaryEntryAndPath(selectedSpellId, glossaryEntries);
        // Shield is also an equipment ID. Only spell entries may replace the
        // selected spell record; other matches use its existing detail pane.
        return entry && (entry.hasSpellJson || entry.category.toLowerCase() === 'spells') ? entry : null;
    }, [selectedSpellId, glossaryEntries]);

    // Readiness gate for the out-of-combat Cast button: cantrips must be known;
    // leveled spells must be prepared (or simply known for known-spell casters).
    const castReadiness = useMemo(() => {
        if (!selectedSpell) return { ready: false as const, reason: undefined as string | undefined };
        const racialGrant = character.race.knownSpells?.find(s => s.spellId === selectedSpell.id);
        if (racialGrant && racialGrant.minLevel > (character.level || 1)) {
            return { ready: false as const, reason: `Unlocks at level ${racialGrant.minLevel}.` };
        }
        if (selectedSpell.level === 0) {
            return knownSpellIds.has(selectedSpell.id)
                ? { ready: true as const, reason: undefined }
                : { ready: false as const, reason: 'Not a known cantrip.' };
        }
        const isKnownCaster = !usesRestPreparation(character, edition);
        const alwaysPrepared =
            isRacialSpellLockedForPreparation(character, selectedSpell.id) ||
            (character.class.id === 'druid' && selectedSpell.id === 'speak-with-animals');
        const ready = isKnownCaster
            ? knownSpellIds.has(selectedSpell.id)
            : preparedSpellIds.has(selectedSpell.id) || alwaysPrepared || Boolean(racialGrant);
        return ready
            ? { ready: true as const, reason: undefined }
            : { ready: false as const, reason: isKnownCaster ? 'Not a known spell.' : 'Not prepared.' };
    }, [selectedSpell, character, knownSpellIds, preparedSpellIds, edition]);

    if (!allSpellsData || !character.spellbook) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No spellbook data available.</p>
            </div>
        );
    }

    const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;

    // Calculate prepared spell count and limit
    const preparedCount = getPreparedSpellsAffectingLimit(character).size;
    const maxPrepared = getMaxPreparedSpells(character, edition);
    const plan = character.spellbook.preparationPlan;
    const plannedIds = new Set(plan?.preparedSpells ?? character.spellbook.preparedSpells);
    const plannedCount = getPreparedSpellsAffectingLimit({...character, spellbook: {...character.spellbook, preparedSpells: [...plannedIds]}}).size;
    const isAtPrepLimit = maxPrepared !== null && plannedCount >= maxPrepared;
    const spellLevels = Object.fromEntries(Object.values(allSpellsData).map(spell => [spell.id, spell.level]));
    const planError = plan ? preparationPlanError(character, plan, edition) : null;
    const restPreparation = usesRestPreparation(character, edition);

    return (
        <div className="h-full min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50">
            {/* Left Column - Spell List */}
            <div className="h-64 md:h-auto w-full md:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-700 flex flex-col bg-slate-800/30">
                {/* Level Tabs */}
                <div className="p-3 border-b border-slate-700 flex flex-wrap gap-1.5">
                    {levels.map(level => (
                        <button
                            key={level}
                            onClick={() => setCurrentLevel(level)}
                            className={`${BTN_FOCUS_VISIBLE} px-2.5 py-1 rounded text-xs font-semibold transition-all ${currentLevel === level
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                }`}
                        >
                            {level === 0 ? 'Cantrips' : `Lvl ${level}`}
                        </button>
                    ))}
                </div>

                {/* Spell List */}
                <div className="flex-1 overflow-y-auto p-3 scrollable-content">
                    <h3 className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-3 px-1 opacity-80">
                        {pageTitle}
                    </h3>

                    {spellsToDisplay.length === 0 ? (
                        <p className="text-slate-500 italic text-sm px-1">No spells at this level.</p>
                    ) : (
                        <div className="space-y-1">
                            {spellsToDisplay.map(spell => {
                                const isAlwaysPrepared = character.class.id === 'druid' && spell.id === 'speak-with-animals';
                                const racialAlwaysPrepared = isRacialSpellLockedForPreparation(character, spell.id);
                                const racialGrant = character.race.knownSpells?.find(s => s.spellId === spell.id);
                                const isFutureRacial = racialGrant && racialGrant.minLevel > (character.level || 1);
                                
                                // Known-spell casters choose spells permanently elsewhere, so this sheet should not offer preparation toggles for them.
                                const isKnownCaster = !restPreparation;
                                const isKnown = knownSpellIds.has(spell.id) && !isFutureRacial;
                                const canChooseFromClassList = (CLASS_LIST_PREPARATION_IDS.includes(character.class.id.toLowerCase()) || (edition === '2024' && character.class.id === 'ranger'))
                                    && (CLASSES_DATA[character.class.id]?.spellcasting?.spellList.includes(spell.id) ?? false)
                                    && (character.spellSlots?.[`level_${spell.level}` as keyof NonNullable<PlayerCharacter['spellSlots']>]?.max ?? 0) > 0;
                                const canPrepare = !isFutureRacial && (preparedSpellIds.has(spell.id) || !preparationSpellError(character, spell.id, spell.level, edition));
                                const isPrepared = (preparedSpellIds.has(spell.id) || isAlwaysPrepared || racialAlwaysPrepared) && !isFutureRacial;
                                const isSelected = selectedSpellId === spell.id;
                                const isLocked = isAlwaysPrepared || racialAlwaysPrepared;
                                const isPlanned = plannedIds.has(spell.id);
                                const choiceError = togglePreparationPlan(character, spell.id, spellLevels, edition).error;

                                const statusBadges = (
                                    <>
                                        {isFutureRacial && (
                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold tracking-wider flex-shrink-0">
                                                Level {racialGrant.minLevel}
                                            </span>
                                        )}
                                        {isPrepared && !isFutureRacial && (
                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold tracking-wider flex-shrink-0">
                                                {isAlwaysPrepared || racialAlwaysPrepared ? 'Always' : 'Prep'}
                                            </span>
                                        )}
                                        {plan && isPlanned !== preparedSpellIds.has(spell.id) && (
                                            <span className="text-[9px] text-amber-300">{isPlanned ? 'After rest' : 'Remove after rest'}</span>
                                        )}
                                        {!isPrepared && canPrepare && spell.level > 0 && (
                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600/50 font-bold tracking-wider flex-shrink-0">
                                                Unprepared
                                            </span>
                                        )}
                                    </>
                                );

                                const prepareButton = spell.level > 0 && canPrepare && maxPrepared !== null && !isKnownCaster ? (
                                    <button
                                        title={choiceError ?? "Plan a change for the next eligible long rest; current spells stay active."}
                                        className={`${BTN_FOCUS_VISIBLE} min-h-11 md:min-h-0 px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isPlanned && !isLocked
                                            ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                                            : isAtPrepLimit && !isPrepared
                                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                : 'bg-purple-600/80 text-white hover:bg-purple-500'
                                            }`}
                                        disabled={isLocked || Boolean(choiceError)}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onAction({
                                                type: 'TOGGLE_PREPARED_SPELL',
                                                label: 'Plan Spell Preparation',
                                                payload: { characterId: character.id!, spellId: spell.id }
                                            });
                                        }}
                                    >
                                        {isLocked ? '-' : isPlanned ? 'Plan removal' : 'Plan prepare'}
                                    </button>
                                ) : null;

                                return (
                                    <SpellSummaryCard
                                        key={spell.id}
                                        spell={spell}
                                        selected={isSelected}
                                        disabled={false}
                                        density="row"
                                        onSelect={() => setSelectedSpellId(spell.id)}
                                        leadingIcon={
                                            <span aria-hidden="true" className={isSelected ? 'text-purple-400' : 'text-slate-500 group-hover:text-purple-400'}>
                                                {isFutureRacial ? <Lock size={16}/> : <Sparkles size={16}/>}
                                            </span>
                                        }
                                        statusBadges={statusBadges}
                                        trailing={prepareButton}
                                        className={`group ${!isKnown && !canChooseFromClassList ? 'opacity-50 hover:opacity-80 grayscale hover:grayscale-0' : ''}`}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column - Spell Details */}
            <div className="min-h-0 min-w-0 flex-none md:flex-1 flex flex-col overflow-visible md:overflow-hidden">
                {/* Right Header - Spell Slots, Prepared Count & Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 md:px-6 py-3 border-b border-slate-700 bg-slate-800/20">
                    <div className="flex items-center gap-4">
                        <SpellSlotDisplay spellSlots={character.spellSlots} />
                        {maxPrepared !== null && restPreparation && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Prepared</span>
                                <span className={`text-sm font-bold ${isAtPrepLimit ? 'text-amber-400' : 'text-purple-400'}`}>
                                    {preparedCount} / {maxPrepared}
                                </span>
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                            Show All Class Spells
                        </span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={showAllPossibleSpells}
                                onChange={() => setShowAllPossibleSpells(!showAllPossibleSpells)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-purple-600 transition-colors" />
                            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </div>
                    </label>
                </div>

                {restPreparation && (
                    <div className="shrink-0 max-h-40 overflow-y-auto px-3 md:px-6 py-2 md:py-3 border-b border-slate-700 text-xs md:text-sm text-slate-300" aria-label="Preparation plan">
                        <p>Current spells stay available until an eligible long rest completes. {edition === '2024' && ['paladin', 'ranger'].includes(character.class.id.toLowerCase()) ? 'You may replace one spell per long rest.' : 'Plan your next daily list here.'}</p>
                        {plan && <>
                            <p className="mt-1 text-amber-300">After rest: {plannedCount} / {maxPrepared} prepared. {planError ?? 'These choices apply when you complete the rest.'}</p>
                            <p>{plan.preparedSpells.map(id => allSpellsData[id]?.name ?? id).join(', ') || 'No planned spells.'}</p>
                            {preparationMinutes(character, edition) > 0 && <p>Prayer or study: {preparationMinutes(character, edition)} additional minutes after the rest, at your current location.</p>}
                            <button type="button" className={`${BTN_TEXT_LINK} min-h-11 md:min-h-0 mt-2 underline text-amber-200`} onClick={() => onAction({type: 'TOGGLE_PREPARED_SPELL', label: 'Reset spell preparation plan', payload: {characterId: character.id!, spellId: '', resetPlan: true}})}>Reset planned changes</button>
                        </>}
                    </div>
                )}
                {!restPreparation && ['bard', 'sorcerer', 'warlock', 'ranger'].includes(character.class.id.toLowerCase()) && (
                    <p className="shrink-0 px-3 md:px-6 py-3 border-b border-slate-700 text-sm text-slate-300">
                        {character.class.name} spell selections change when you gain a class level. Resting does not replace them.
                    </p>
                )}
                {/* Out-of-combat casting bar for the selected spell */}
                {selectedSpell && (
                    <CastSpellControls
                        spell={selectedSpell}
                        character={character}
                        party={party}
                        isReadyToCast={castReadiness.ready}
                        notReadyReason={castReadiness.reason}
                        onAction={onAction}
                    />
                )}

                {/* Compiled JSON-backed spells use the shared spell card because
                    their glossary records intentionally have no filePath. Future
                    file-backed spell entries can flow through FullEntryDisplay,
                    while missing compiled entries preserve the legacy pane. */}
                {/* Rule-link gate: the spell stays visible, but the tab states
                    plainly that its glossary rule chips are unavailable and names
                    the generator that produces them. */}
                {ruleLinkLoadError && (
                    <div
                        role="status"
                        className="mx-6 mt-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                    >
                        <p className="font-semibold">Rule links unavailable</p>
                        <p className="text-amber-200/80">
                            The generated spell rule-link dataset did not load, so this spell's rules are shown without glossary links.
                            Run <code className="font-mono">npx tsx scripts/generateSpellReferencedRulesEnrichment.ts</code> to rebuild it.
                        </p>
                        <p className="text-amber-200/60">{ruleLinkLoadError}</p>
                    </div>
                )}

                <div className="flex-none md:flex-1 overflow-visible md:overflow-y-auto p-3 md:p-6 scrollable-content">
                    {selectedSpellEntry?.hasSpellJson && selectedSpell ? (
                        <SpellCardTemplate
                            spell={selectedSpell}
                            referencedRules={referencedRulesBySpellId[selectedSpell.id] ?? []}
                            onNavigateToGlossary={onNavigateToGlossary}
                        />
                    ) : selectedSpellEntry?.filePath ? (
                        <FullEntryDisplay
                            entry={selectedSpellEntry}
                            onNavigate={onNavigateToGlossary}
                        />
                    ) : selectedSpell ? (
                        <SpellDetailPane spell={selectedSpell} />
                    ) : selectedSpellId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Search aria-hidden="true" size={40} className="mb-2"/>
                            <p>Spell data not found.</p>
                            <p className="text-sm">ID: {selectedSpellId}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <MousePointer aria-hidden="true" size={40} className="mb-2"/>
                            <p>Select a spell to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default SpellbookTab;
