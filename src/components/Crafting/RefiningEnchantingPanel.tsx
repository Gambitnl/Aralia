/**
 * @file src/components/Crafting/RefiningEnchantingPanel.tsx
 * Dedicated crafting panel for Refining and Enchanting (crafting G5).
 *
 * Refining: batch-process raw materials into refined components via
 * processRefiningBatch (skill roll drives success, quality, and bonus yield).
 * Enchanting: bind magic into a base item via attemptEnchant (essences always
 * burn; critical failure destroys the base item).
 *
 * The panel reads the live party inventory, rolls with a real party member
 * (crafterAdapter), and applies results through the normal reducer actions
 * (REMOVE_ITEM / ADD_ITEM / ADVANCE_TIME) — no shadow inventory.
 */
import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    CircleX,
    Clock3,
    Flame,
    FlaskConical,
    Hammer,
    LoaderCircle,
    PackageCheck,
    Sparkles,
    UserRound,
    WandSparkles,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { ALL_ITEMS } from '../../data/items';
import { Recipe } from '../../systems/crafting/types';
import { REFINING_RECIPES } from '../../systems/crafting/data/refiningRecipes';
import { ENCHANTING_RECIPES } from '../../systems/crafting/data/enchantingRecipes';
import { processRefiningBatch, RefiningRecipe } from '../../systems/crafting/RefiningSystem';
import { attemptEnchant } from '../../systems/crafting/EnchantingSystem';
import { resolveCraftingCrafter } from './crafterAdapter';
import {
    buildCrafterInventory,
    buildEnchantActions,
    buildRefineBatchActions,
    getMaxBatchSize,
    getRecipeReadiness,
} from './refiningEnchantingSelectors';

// ============================================================================
// Workshop Contract and Display Helpers
// ============================================================================
// The panel owns only presentation and short-lived work-order state. Recipe
// rules, inventory changes, and skill outcomes remain in the crafting systems.
// ============================================================================
type WorkshopTab = 'refine' | 'enchant';

interface RefiningEnchantingPanelProps {
    onClose?: () => void;
}

interface WorkLogEntry {
    message: string;
    tone: 'success' | 'failure' | 'critical';
    detail?: string;
}

// Recipe records store item ids; the work order always shows the player-facing
// item name, falling back to the id only for incomplete future content.
const itemName = (itemId: string): string => ALL_ITEMS[itemId]?.name ?? itemId;

// Some glossary-ingested items store an asset PATH in `icon`; only render short
// emoji-style icons, otherwise fall back to a neutral glyph.
const itemIcon = (itemId: string): string => {
    const icon = ALL_ITEMS[itemId]?.icon;
    return icon && icon.length <= 4 ? icon : '📦';
};

// Long crafting times are easier to compare when they are shown as hours and
// minutes instead of one large minute total.
const formatMinutes = (minutes: number): string => {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
};

// ============================================================================
// Live Workshop State and Reducer Actions
// ============================================================================
// This component derives readiness from the live inventory and sends every
// completed job through the same reducer actions used by the rest of the game.
// ============================================================================
export const RefiningEnchantingPanel: React.FC<RefiningEnchantingPanelProps> = ({ onClose }) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<WorkshopTab>('refine');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [batchSize, setBatchSize] = useState(1);
    const [isWorking, setIsWorking] = useState(false);
    const [workLog, setWorkLog] = useState<WorkLogEntry[]>([]);

    const { crafter, sourceCharacter } = useMemo(
        () => resolveCraftingCrafter({ party: state.party, characterSheetModal: state.characterSheetModal }),
        [state.party, state.characterSheetModal],
    );

    const recipes: Recipe[] = activeTab === 'refine' ? REFINING_RECIPES : ENCHANTING_RECIPES;
    const selectedRecipe = recipes.find(r => r.id === selectedId) ?? null;
    const readiness = useMemo(
        () => (selectedRecipe ? getRecipeReadiness(selectedRecipe, state.inventory) : null),
        [selectedRecipe, state.inventory],
    );
    const maxBatch = useMemo(
        () =>
            activeTab === 'refine' && selectedRecipe
                ? getMaxBatchSize(selectedRecipe as RefiningRecipe, state.inventory)
                : 1,
        [activeTab, selectedRecipe, state.inventory],
    );

    // Readiness is shown before a recipe is selected, letting players scan for
    // work they can start now instead of opening every process one by one.
    const readyRecipeCount = useMemo(
        () => recipes.filter(recipe => getRecipeReadiness(recipe, state.inventory).canCraft).length,
        [recipes, state.inventory],
    );

    // Starting a different work order resets batch quantity so an old choice
    // cannot silently spend more materials than the newly selected recipe shows.
    const selectRecipe = (id: string) => {
        setSelectedId(id);
        setBatchSize(1);
    };

    // Refining and enchanting use different recipe books. Switching disciplines
    // clears the old selection rather than showing a recipe from the wrong book.
    const switchTab = (tab: WorkshopTab) => {
        setActiveTab(tab);
        setSelectedId(null);
        setBatchSize(1);
    };

    // Keep only the twelve newest workshop outcomes so the modal remains useful
    // during a long session without becoming an unbounded history screen.
    const pushLog = (entry: WorkLogEntry) =>
        setWorkLog(prev => [entry, ...prev].slice(0, 12));

    // Refining spends the selected batch, applies the real skill roll, and then
    // records the yield or loss that the crafting system returned.
    const handleRefine = () => {
        if (!selectedRecipe || !readiness?.canCraft || isWorking) return;
        setIsWorking(true);

        setTimeout(() => {
            const liveCrafter = { ...crafter, inventory: buildCrafterInventory(state.inventory) };
            const result = processRefiningBatch(liveCrafter, {
                recipe: selectedRecipe as RefiningRecipe,
                batchSize,
            });

            for (const action of buildRefineBatchActions(result)) {
                dispatch(action as Parameters<typeof dispatch>[0]);
            }

            const produced = Object.entries(result.summary.totalOutput)
                .map(([id, qty]) => `${qty}× ${itemName(id)}`)
                .join(', ');
            const bonus = Object.values(result.summary.bonusYield).reduce((a, b) => a + b, 0);
            if (result.summary.successes > 0) {
                pushLog({
                    message: `Refined ${produced || 'nothing'} (${result.summary.successes}/${result.summary.successes + result.summary.failures} batches).`,
                    tone: 'success',
                    detail: bonus > 0 ? `Skilled work — ${bonus} bonus yield.` : undefined,
                });
            } else {
                pushLog({
                    message: `The batch was ruined. Materials lost.`,
                    tone: 'failure',
                });
            }

            setIsWorking(false);
            setBatchSize(1);
        }, 600);
    };

    // Enchanting follows its separate failure rules, including backlash and
    // base-item loss, before forwarding the resulting inventory actions.
    const handleEnchant = () => {
        if (!selectedRecipe || !readiness?.canCraft || isWorking) return;
        setIsWorking(true);

        setTimeout(() => {
            const liveCrafter = { ...crafter, inventory: buildCrafterInventory(state.inventory) };
            const result = attemptEnchant(liveCrafter, selectedRecipe);

            for (const action of buildEnchantActions(selectedRecipe, result)) {
                dispatch(action as Parameters<typeof dispatch>[0]);
            }

            pushLog({
                message: result.message,
                tone: result.criticalFailure ? 'critical' : result.success ? 'success' : 'failure',
                detail: result.backlashEffect || undefined,
            });

            setIsWorking(false);
        }, 600);
    };

    const logToneClass: Record<WorkLogEntry['tone'], string> = {
        success: 'text-green-300',
        failure: 'text-amber-400',
        critical: 'text-red-400',
    };

    // ========================================================================
    // Workshop Layout
    // ========================================================================
    // Mode choice, live status, process ledger, work order, and recent outcomes
    // stay visible as one coherent flow while the shared WindowFrame owns chrome.
    // ========================================================================
    return (
        <WindowFrame
            title="Refinery & Enchanter's Table"
            onClose={onClose}
            storageKey={WINDOW_KEYS.REFINING_ENCHANTING}
            initialMaximized={false}
            minimumSize={{ width: 720, height: 560 }}
        >
            <div className="flex h-full flex-col bg-[#0d1118] text-stone-200">
                {/* The two crafts share one workshop but keep distinct risk and
                    reward language. Large mode cards make that choice explicit. */}
                <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-700/70 bg-[#121824] p-3" role="tablist" aria-label="Workshop discipline">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'refine'}
                        onClick={() => switchTab('refine')}
                        className={`group flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                            activeTab === 'refine'
                                ? 'border-orange-600/70 bg-orange-950/40 text-orange-100 shadow-inner'
                                : 'border-slate-700/70 bg-slate-900/60 text-stone-400 hover:border-orange-900/70 hover:text-stone-200'
                        }`}
                    >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${activeTab === 'refine' ? 'bg-orange-600 text-slate-950' : 'bg-slate-800 text-orange-500'}`}>
                            <Flame className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block font-cinzel text-sm font-semibold">Refining</span>
                            <span className="mt-0.5 block text-[10px] text-stone-500">Turn raw stock into useful components</span>
                        </span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'enchant'}
                        onClick={() => switchTab('enchant')}
                        className={`group flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                            activeTab === 'enchant'
                                ? 'border-violet-600/70 bg-violet-950/40 text-violet-100 shadow-inner'
                                : 'border-slate-700/70 bg-slate-900/60 text-stone-400 hover:border-violet-900/70 hover:text-stone-200'
                        }`}
                    >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${activeTab === 'enchant' ? 'bg-violet-500 text-slate-950' : 'bg-slate-800 text-violet-400'}`}>
                            <WandSparkles className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block font-cinzel text-sm font-semibold">Enchanting</span>
                            <span className="mt-0.5 block text-[10px] text-stone-500">Bind volatile magic into an item</span>
                        </span>
                    </button>
                </div>

                {/* This status row answers who is working, how many jobs are
                    possible now, and what the current discipline risks. */}
                <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-700/60 bg-slate-900/70 px-4 py-2.5 text-xs text-stone-400">
                    <span className="inline-flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        {sourceCharacter
                            ? <>Working hands: <strong className="font-medium text-stone-200">{sourceCharacter.name}</strong></>
                            : 'No party member available — rolls are unmodified.'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        {readyRecipeCount} of {recipes.length} processes ready
                    </span>
                    {activeTab === 'enchant' && (
                        <span className="inline-flex items-center gap-2 text-violet-300/80">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            Essences burn on every attempt; a botch can destroy the base item.
                        </span>
                    )}
                </div>

                {/* The process list stays narrow while the work order receives
                    a constrained reading width, avoiding the old empty expanse. */}
                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <aside className="scrollable-content shrink-0 overflow-y-auto border-b border-slate-700/60 bg-[#101620] sm:w-72 sm:border-b-0 sm:border-r">
                        <div className="sticky top-0 z-10 border-b border-slate-700/60 bg-[#101620]/95 px-4 py-3 backdrop-blur">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">Available processes</p>
                            <p className="mt-1 text-xs text-stone-600">Choose a work order to inspect its cost.</p>
                        </div>
                        {recipes.map(recipe => {
                            const ready = getRecipeReadiness(recipe, state.inventory).canCraft;
                            const selected = selectedId === recipe.id;
                            return (
                                <button
                                    key={recipe.id}
                                    onClick={() => selectRecipe(recipe.id)}
                                    className={`group flex w-full items-center gap-3 border-b border-slate-800/80 px-4 py-3 text-left transition-colors ${
                                        selected
                                            ? activeTab === 'refine' ? 'bg-orange-950/35' : 'bg-violet-950/35'
                                            : 'hover:bg-slate-800/60'
                                    }`}
                                >
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg ${selected ? activeTab === 'refine' ? 'border-orange-700/60 bg-orange-950/60' : 'border-violet-700/60 bg-violet-950/60' : 'border-slate-700 bg-slate-900'}`} aria-hidden="true">
                                        {itemIcon(recipe.outputs[0]?.itemId ?? '')}
                                    </span>
                                    <span className="min-w-0 flex-grow">
                                        <span className="block truncate text-sm font-medium text-stone-200">{recipe.name}</span>
                                        <span className="mt-0.5 block text-[11px] text-stone-600">
                                            DC {recipe.skillCheck?.dc ?? '—'} {recipe.skillCheck?.skill ?? ''} · {formatMinutes(recipe.timeMinutes)}
                                        </span>
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${ready ? 'bg-emerald-950/60 text-emerald-300' : 'bg-slate-900 text-stone-600'}`}>
                                        {ready ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <CircleX className="h-3 w-3" aria-hidden="true" />}
                                        {ready ? 'Ready' : 'Missing'}
                                    </span>
                                </button>
                            );
                        })}
                    </aside>

                    <main className="scrollable-content min-h-0 flex-1 overflow-y-auto bg-[#0d1118] p-4 sm:p-6">
                        {!selectedRecipe || !readiness ? (
                            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center py-8 text-center">
                              <div>
                                <span className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${activeTab === 'refine' ? 'border-orange-800/60 bg-orange-950/30 text-orange-400' : 'border-violet-800/60 bg-violet-950/30 text-violet-300'}`}>
                                    {activeTab === 'refine' ? <Hammer className="h-8 w-8" aria-hidden="true" /> : <Sparkles className="h-8 w-8" aria-hidden="true" />}
                                </span>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-600">Workbench awaiting an order</p>
                                <h3 className="mt-2 font-cinzel text-xl text-stone-200">
                                    {activeTab === 'refine' ? 'Choose material to refine' : 'Choose an enchantment to attempt'}
                                </h3>
                                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
                                    {activeTab === 'refine'
                                        ? 'Select a process from the ledger. The work order will show the exact stock, skill check, time, and possible yield before anything is spent.'
                                        : 'Select a formula from the ledger. You will see the base item, consumed essences, check difficulty, and failure risk before committing.'}
                                </p>
                                <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
                                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-4">
                                        <p className="flex items-center gap-2 text-xs font-semibold text-stone-300"><PackageCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Inventory checked live</p>
                                        <p className="mt-1 text-xs leading-5 text-stone-600">Ready labels update from the party&apos;s real carried materials.</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-4">
                                        <p className="flex items-center gap-2 text-xs font-semibold text-stone-300"><FlaskConical className="h-4 w-4 text-sky-400" aria-hidden="true" /> Outcomes use real skills</p>
                                        <p className="mt-1 text-xs leading-5 text-stone-600">Quality, bonus yield, and backlash come from the active crafter.</p>
                                    </div>
                                </div>
                              </div>
                            </div>
                        ) : (
                            <div className="mx-auto max-w-4xl space-y-5">
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-700/60 pb-4">
                                    <div>
                                        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${activeTab === 'refine' ? 'text-orange-500' : 'text-violet-400'}`}>Selected work order</p>
                                        <h3 className="mt-1 font-cinzel text-xl text-stone-100">{selectedRecipe.name}</h3>
                                        <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">{selectedRecipe.description}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${readiness.canCraft ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300' : 'border-red-900/70 bg-red-950/40 text-red-300'}`}>
                                        {readiness.canCraft ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                                        {readiness.canCraft ? 'Ready to begin' : 'Materials missing'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Skill check</p>
                                        <p className="mt-1 text-sm text-stone-200">
                                            {selectedRecipe.skillCheck ? `${selectedRecipe.skillCheck.skill} DC ${selectedRecipe.skillCheck.dc}` : 'None'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Time required</p>
                                        <p className="mt-1 text-sm text-stone-200">
                                            {activeTab === 'refine' && batchSize > 1
                                                ? formatMinutes(selectedRecipe.timeMinutes * (1 + 0.8 * (batchSize - 1)))
                                                : formatMinutes(selectedRecipe.timeMinutes)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600"><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> Station</p>
                                        <p className="mt-1 text-sm capitalize text-stone-200">{selectedRecipe.station.replace(/_/g, ' ')}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <section className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-4">
                                    <h4 className="mb-3 font-cinzel text-sm text-stone-300">Materials committed</h4>
                                    <ul className="space-y-2">
                                        {readiness.inputs.map(input => (
                                            <li
                                                key={input.itemId}
                                                className={`flex items-center justify-between gap-3 rounded-md bg-black/20 px-3 py-2 text-sm ${input.satisfied ? 'text-stone-300' : 'text-red-300'}`}
                                            >
                                                <span className="min-w-0 truncate">
                                                    {itemIcon(input.itemId)} {itemName(input.itemId)}
                                                    {activeTab === 'enchant' && input === readiness.inputs[0] && (
                                                        <span className="ml-1 text-xs text-violet-300/70">(base item)</span>
                                                    )}
                                                </span>
                                                <span className="shrink-0 font-medium">
                                                    {input.available}/{activeTab === 'refine' ? input.required * batchSize : input.required}
                                                    {input.satisfied ? <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-400" aria-label="Enough materials" /> : <CircleX className="ml-1 inline h-3.5 w-3.5" aria-label="Missing materials" />}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                  </section>

                                  <section className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-4">
                                    <h4 className="mb-3 font-cinzel text-sm text-stone-300">Expected output</h4>
                                    <ul className="space-y-2">
                                        {selectedRecipe.outputs.map(out => (
                                            <li key={out.itemId} className="flex items-center justify-between rounded-md bg-black/20 px-3 py-2 text-sm text-stone-300">
                                                <span>{itemIcon(out.itemId)} {itemName(out.itemId)}</span>
                                                <strong className="text-emerald-300">{out.quantity * (activeTab === 'refine' ? batchSize : 1)}×</strong>
                                            </li>
                                        ))}
                                    </ul>
                                    {activeTab === 'refine' && (selectedRecipe as RefiningRecipe).yieldBonus && (
                                        <p className="mt-3 text-xs italic text-orange-300/70">
                                            Beat the DC by {(selectedRecipe as RefiningRecipe).yieldBonus!.thresholdStep}+ for bonus yield.
                                        </p>
                                    )}
                                  </section>
                                </div>

                                {activeTab === 'refine' && maxBatch > 1 && (
                                    <section className="rounded-lg border border-orange-900/50 bg-orange-950/15 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <h4 className="font-cinzel text-sm text-stone-300">Batch size</h4>
                                            <p className="mt-1 text-xs text-stone-600">One roll covers the batch; later items work 20% faster.</p>
                                          </div>
                                          <div className="flex gap-2">
                                            {Array.from({ length: Math.min(maxBatch, 5) }, (_, i) => i + 1).map(qty => (
                                                <button
                                                    key={qty}
                                                    onClick={() => setBatchSize(qty)}
                                                    className={`h-9 w-10 rounded-md border text-sm transition-colors ${
                                                        batchSize === qty
                                                            ? 'border-orange-500 bg-orange-700/60 text-orange-100'
                                                            : 'border-slate-700 bg-slate-900 text-stone-500 hover:border-slate-500'
                                                    }`}
                                                    aria-label={`Refine a batch of ${qty}`}
                                                >
                                                    {qty}×
                                                </button>
                                            ))}
                                          </div>
                                        </div>
                                    </section>
                                )}

                                <button
                                    onClick={activeTab === 'refine' ? handleRefine : handleEnchant}
                                    disabled={!readiness.canCraft || isWorking}
                                    className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border font-cinzel text-sm transition-colors ${
                                        readiness.canCraft && !isWorking
                                            ? activeTab === 'refine'
                                                ? 'border-orange-500 bg-orange-700 text-orange-50 hover:bg-orange-600'
                                                : 'border-violet-500 bg-violet-700 text-violet-50 hover:bg-violet-600'
                                            : 'cursor-not-allowed border-slate-700 bg-slate-900 text-stone-600'
                                    }`}
                                >
                                    {isWorking
                                        ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Working…</>
                                        : activeTab === 'refine'
                                            ? <><Hammer className="h-4 w-4" aria-hidden="true" /> Refine {batchSize}× {selectedRecipe.name}</>
                                            : <><WandSparkles className="h-4 w-4" aria-hidden="true" /> Attempt {selectedRecipe.name}</>}
                                </button>
                                {!readiness.canCraft && (
                                    <p className="flex items-center gap-2 text-xs text-red-300/80"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Missing materials — gather or buy the stock marked above.</p>
                                )}
                            </div>
                        )}
                    </main>
                </div>

                {/* Recent outcomes remain visible without taking over the work
                    order. The newest result is always listed first. */}
                {workLog.length > 0 && (
                    <div className="scrollable-content max-h-32 shrink-0 overflow-y-auto border-t border-slate-700 bg-[#121824] px-4 py-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">Workshop record</p>
                        <ul className="space-y-1">
                            {workLog.map((entry, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs">
                                    {entry.tone === 'success'
                                        ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                                        : entry.tone === 'critical'
                                            ? <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
                                            : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />}
                                    <span><span className={logToneClass[entry.tone]}>{entry.message}</span>
                                    {entry.detail && <span className="ml-1 italic text-stone-600">{entry.detail}</span>}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </WindowFrame>
    );
};

export default RefiningEnchantingPanel;
