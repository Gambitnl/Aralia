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

type WorkshopTab = 'refine' | 'enchant';

interface RefiningEnchantingPanelProps {
    onClose?: () => void;
}

interface WorkLogEntry {
    message: string;
    tone: 'success' | 'failure' | 'critical';
    detail?: string;
}

const itemName = (itemId: string): string => ALL_ITEMS[itemId]?.name ?? itemId;
// Some glossary-ingested items store an asset PATH in `icon`; only render short
// emoji-style icons, otherwise fall back to a neutral glyph.
const itemIcon = (itemId: string): string => {
    const icon = ALL_ITEMS[itemId]?.icon;
    return icon && icon.length <= 4 ? icon : '📦';
};

const formatMinutes = (minutes: number): string => {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
};

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

    const selectRecipe = (id: string) => {
        setSelectedId(id);
        setBatchSize(1);
    };

    const switchTab = (tab: WorkshopTab) => {
        setActiveTab(tab);
        setSelectedId(null);
        setBatchSize(1);
    };

    const pushLog = (entry: WorkLogEntry) =>
        setWorkLog(prev => [entry, ...prev].slice(0, 12));

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

    return (
        <WindowFrame
            title="Refinery & Enchanter's Table"
            onClose={onClose}
            storageKey={WINDOW_KEYS.REFINING_ENCHANTING}
        >
            <div className="flex flex-col h-full bg-slate-900 text-gray-200">
                {/* Tabs */}
                <div className="shrink-0 flex border-b border-slate-700 bg-slate-800/60" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'refine'}
                        onClick={() => switchTab('refine')}
                        className={`flex-1 min-h-11 px-4 py-3 text-sm font-cinzel transition-colors ${
                            activeTab === 'refine'
                                ? 'text-orange-300 bg-slate-700/60 border-b-2 border-orange-400'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/30'
                        }`}
                    >
                        🔥 Refining
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'enchant'}
                        onClick={() => switchTab('enchant')}
                        className={`flex-1 min-h-11 px-4 py-3 text-sm font-cinzel transition-colors ${
                            activeTab === 'enchant'
                                ? 'text-purple-300 bg-slate-700/60 border-b-2 border-purple-400'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/30'
                        }`}
                    >
                        ✨ Enchanting
                    </button>
                </div>

                {/* Crafter line */}
                <div className="shrink-0 px-4 py-2 text-xs text-gray-400 border-b border-slate-700/60 bg-slate-800/30">
                    {sourceCharacter
                        ? <>Working hands: <span className="text-gray-200">{sourceCharacter.name}</span> — rolls use their real skills and proficiencies.</>
                        : 'No party member available — rolls are unmodified.'}
                    {activeTab === 'enchant' && (
                        <span className="ml-2 text-purple-300/70 italic">
                            Essences burn on every attempt. A bad failure can destroy the base item.
                        </span>
                    )}
                </div>

                {/* Body: recipe list + detail */}
                <div className="flex-grow min-h-0 flex flex-col sm:flex-row">
                    <div className="sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-700/60 overflow-y-auto scrollable-content">
                        {recipes.map(recipe => {
                            const ready = getRecipeReadiness(recipe, state.inventory).canCraft;
                            return (
                                <button
                                    key={recipe.id}
                                    onClick={() => selectRecipe(recipe.id)}
                                    className={`w-full text-left px-4 py-3 border-b border-slate-800 transition-colors flex items-center gap-3 ${
                                        selectedId === recipe.id
                                            ? 'bg-slate-700/70'
                                            : 'hover:bg-slate-800/70'
                                    }`}
                                >
                                    <span className="text-xl" aria-hidden="true">
                                        {itemIcon(recipe.outputs[0]?.itemId ?? '')}
                                    </span>
                                    <span className="min-w-0 flex-grow">
                                        <span className="block text-sm text-gray-200 truncate">{recipe.name}</span>
                                        <span className="block text-xs text-gray-500">
                                            DC {recipe.skillCheck?.dc ?? '—'} {recipe.skillCheck?.skill ?? ''} · {formatMinutes(recipe.timeMinutes)}
                                        </span>
                                    </span>
                                    <span className={`text-xs ${ready ? 'text-green-400' : 'text-gray-600'}`}>
                                        {ready ? '✓' : '✗'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-grow min-h-0 overflow-y-auto p-4 scrollable-content">
                        {!selectedRecipe || !readiness ? (
                            <div className="text-center py-12 text-gray-500">
                                <span className="text-4xl block mb-3" aria-hidden="true">
                                    {activeTab === 'refine' ? '⚒️' : '🔮'}
                                </span>
                                <p className="italic text-sm">
                                    {activeTab === 'refine'
                                        ? 'Select a refining process. Better rolls squeeze bonus yield from the same ore.'
                                        : 'Select an enchantment. The base item survives ordinary failure — but not a botch.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-cinzel text-gray-100">{selectedRecipe.name}</h3>
                                    <p className="text-sm text-gray-400 mt-1">{selectedRecipe.description}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-slate-800/70 rounded p-2">
                                        <p className="text-[10px] uppercase text-gray-500">Check</p>
                                        <p className="text-sm text-gray-200">
                                            {selectedRecipe.skillCheck ? `${selectedRecipe.skillCheck.skill} DC ${selectedRecipe.skillCheck.dc}` : 'None'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/70 rounded p-2">
                                        <p className="text-[10px] uppercase text-gray-500">Time</p>
                                        <p className="text-sm text-gray-200">
                                            {activeTab === 'refine' && batchSize > 1
                                                ? formatMinutes(selectedRecipe.timeMinutes * (1 + 0.8 * (batchSize - 1)))
                                                : formatMinutes(selectedRecipe.timeMinutes)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/70 rounded p-2">
                                        <p className="text-[10px] uppercase text-gray-500">Station</p>
                                        <p className="text-sm text-gray-200 capitalize">{selectedRecipe.station.replace(/_/g, ' ')}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-cinzel text-gray-300 mb-2">Materials</h4>
                                    <ul className="space-y-1">
                                        {readiness.inputs.map(input => (
                                            <li
                                                key={input.itemId}
                                                className={`flex justify-between text-sm ${input.satisfied ? 'text-gray-300' : 'text-red-400'}`}
                                            >
                                                <span>
                                                    {itemIcon(input.itemId)} {itemName(input.itemId)}
                                                    {activeTab === 'enchant' && input === readiness.inputs[0] && (
                                                        <span className="text-xs text-purple-300/70 ml-1">(base item)</span>
                                                    )}
                                                </span>
                                                <span>
                                                    {input.available}/{activeTab === 'refine' ? input.required * batchSize : input.required}
                                                    {input.satisfied ? ' ✓' : ' ✗'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="text-sm font-cinzel text-gray-300 mb-2">Produces</h4>
                                    <ul className="space-y-1">
                                        {selectedRecipe.outputs.map(out => (
                                            <li key={out.itemId} className="text-sm text-gray-300">
                                                {itemIcon(out.itemId)} {out.quantity * (activeTab === 'refine' ? batchSize : 1)}× {itemName(out.itemId)}
                                            </li>
                                        ))}
                                    </ul>
                                    {activeTab === 'refine' && (selectedRecipe as RefiningRecipe).yieldBonus && (
                                        <p className="text-xs text-orange-300/70 mt-1 italic">
                                            Beat the DC by {(selectedRecipe as RefiningRecipe).yieldBonus!.thresholdStep}+ for bonus yield.
                                        </p>
                                    )}
                                </div>

                                {activeTab === 'refine' && maxBatch > 1 && (
                                    <div>
                                        <h4 className="text-sm font-cinzel text-gray-300 mb-2">Batch</h4>
                                        <div className="flex gap-2">
                                            {Array.from({ length: Math.min(maxBatch, 5) }, (_, i) => i + 1).map(qty => (
                                                <button
                                                    key={qty}
                                                    onClick={() => setBatchSize(qty)}
                                                    className={`w-10 h-9 rounded border text-sm transition-colors ${
                                                        batchSize === qty
                                                            ? 'bg-orange-800/60 border-orange-500 text-orange-200'
                                                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:border-slate-500'
                                                    }`}
                                                >
                                                    {qty}×
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            One roll covers the whole batch; later items work 20% faster.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={activeTab === 'refine' ? handleRefine : handleEnchant}
                                    disabled={!readiness.canCraft || isWorking}
                                    className={`w-full min-h-11 rounded font-cinzel text-sm transition-colors border ${
                                        readiness.canCraft && !isWorking
                                            ? activeTab === 'refine'
                                                ? 'bg-orange-800 hover:bg-orange-700 border-orange-600 text-orange-100'
                                                : 'bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-100'
                                            : 'bg-slate-800 border-slate-700 text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    {isWorking
                                        ? '⏳ Working…'
                                        : activeTab === 'refine'
                                            ? `🔨 Refine ${batchSize}× ${selectedRecipe.name}`
                                            : `✨ Attempt ${selectedRecipe.name}`}
                                </button>
                                {!readiness.canCraft && (
                                    <p className="text-xs text-red-400/80">⚠ Missing materials — gather or buy what is marked ✗.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Work log */}
                {workLog.length > 0 && (
                    <div className="shrink-0 max-h-32 overflow-y-auto border-t border-slate-700 bg-slate-800/50 px-4 py-2 scrollable-content">
                        <ul className="space-y-1">
                            {workLog.map((entry, i) => (
                                <li key={i} className="text-xs">
                                    <span className={logToneClass[entry.tone]}>{entry.message}</span>
                                    {entry.detail && <span className="text-gray-500 ml-1 italic">{entry.detail}</span>}
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
