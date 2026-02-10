/**
 * @file src/components/Crafting/AlchemyBenchPanel.tsx
 * UI component for the alchemy crafting bench with tabs for Recipe Browser,
 * Experimental Alchemy, and Ingredient Glossary.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../../state/GameContext';
import {
    getAllRecipeCraftability,
    attemptCrafting,
    generateCraftingActions,
    RecipeCraftability,
    getCraftingSummary,
    getQualityColor,
    getQualityIcon
} from '../../systems/crafting/craftingEngine';
import { CraftingRecipe, CraftingTool, getResearchCost } from '../../systems/crafting/alchemyRecipes';
import { CraftingQuality } from '../../systems/crafting/crafterProgression';
import {
    calculateBatchCraftability,
    attemptBatchCraft,
    generateBatchCraftActions,
    getBatchDCDisplay
} from '../../systems/crafting/batchCrafting';
import {
    CRAFTING_LOCATIONS,
    CraftingLocationType,
    calculateLocationModifier,
    canCraftRarityAtLocation
} from '../../systems/crafting/craftingLocations';
import { ExperimentPanel } from './ExperimentPanel';
import { IngredientGlossaryPanel } from './IngredientGlossaryPanel';
import { createInitialCraftingState, CraftingState } from '../../types/crafting';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import './AlchemyBenchPanel.css';

interface AlchemyBenchPanelProps {
    onClose?: () => void;
}

type TabType = 'recipes' | 'experiment' | 'glossary';

interface CraftLogEntry {
    message: string;
    quality: CraftingQuality;
    xpGained: number;
    timestamp: Date;
}

export const AlchemyBenchPanel: React.FC<AlchemyBenchPanelProps> = ({ onClose }) => {
    const { state, dispatch } = useGameState();

    const [activeTab, setActiveTab] = useState<TabType>('recipes');
    const [selectedTool, setSelectedTool] = useState<CraftingTool | 'all'>('all');
    const [selectedRecipe, setSelectedRecipe] = useState<RecipeCraftability | null>(null);
    const [craftingLog, setCraftingLog] = useState<CraftLogEntry[]>([]);
    const [isCrafting, setIsCrafting] = useState(false);
    const [filterCraftable, setFilterCraftable] = useState(false);
    const [showUnknown, setShowUnknown] = useState(true);
    const [isResearching, setIsResearching] = useState(false);
    const [batchSize, setBatchSize] = useState(1);
    const [selectedLocation, setSelectedLocation] = useState<CraftingLocationType>('workshop');

    // Initialize crafting state if not present
    useEffect(() => {
        if (!state.crafting) {
            const profs: string[] = [];
            for (const char of state.party) {
                // TODO: Add proper tool proficiency tracking to Class/Background
                // For now, check feat choices
                if (char.featChoices) {
                    Object.values(char.featChoices).forEach(choice => {
                        if (choice.selectedTools) {
                            profs.push(...choice.selectedTools);
                        }
                    });
                }
            }
            dispatch({ type: 'INIT_CRAFTING_STATE', payload: { toolProficiencies: profs } });
        }
    }, [state.crafting, state.party, dispatch]);

    // Use crafting state from global state, or create temporary one
    const craftingState: CraftingState = useMemo(() => {
        if (state.crafting) return state.crafting;

        const profs: string[] = [];
        for (const char of state.party) {
            // TODO: Add proper tool proficiency tracking to Class/Background
            if (char.featChoices) {
                Object.values(char.featChoices).forEach(choice => {
                    if (choice.selectedTools) {
                        profs.push(...choice.selectedTools);
                    }
                });
            }
        }
        return createInitialCraftingState(profs);
    }, [state.crafting, state.party]);

    // Convert array to Set for the engine
    const knownRecipesSet = useMemo(() =>
        new Set(craftingState.knownRecipes),
        [craftingState.knownRecipes]
    );

    // Get tool proficiencies from party
    const toolProficiencies = useMemo(() => {
        const profs: string[] = [];
        for (const char of state.party) {
            // TODO: Add proper tool proficiency tracking to Class/Background
            if (char.featChoices) {
                Object.values(char.featChoices).forEach(choice => {
                    if (choice.selectedTools) {
                        profs.push(...choice.selectedTools);
                    }
                });
            }
        }
        return profs;
    }, [state.party]);

    // Current location data
    const currentLocation = CRAFTING_LOCATIONS[selectedLocation];

    // Get all recipe craftability with discovery filter
    const allRecipes = useMemo(() => {
        const filterTool = selectedTool === 'all' ? undefined : selectedTool;
        return getAllRecipeCraftability(
            state.inventory,
            state.gold,
            toolProficiencies,
            filterTool,
            knownRecipesSet,
            showUnknown
        );
    }, [state.inventory, state.gold, toolProficiencies, selectedTool, knownRecipesSet, showUnknown]);

    // Summary stats
    const summary = useMemo(() =>
        getCraftingSummary(state.inventory, state.gold, toolProficiencies, knownRecipesSet),
        [state.inventory, state.gold, toolProficiencies, knownRecipesSet]
    );

    // Filtered recipes (also filter by location max rarity)
    const displayedRecipes = useMemo(() => {
        let recipes = allRecipes;
        if (filterCraftable) {
            recipes = recipes.filter(r => r.canCraft);
        }
        // Filter by location max rarity
        recipes = recipes.filter(r => canCraftRarityAtLocation(currentLocation, r.recipe.rarity));
        return recipes;
    }, [allRecipes, filterCraftable, currentLocation]);

    // Batch craftability for selected recipe
    const batchInfo = useMemo(() => {
        if (!selectedRecipe) return null;
        return calculateBatchCraftability(selectedRecipe.recipe, state.inventory, state.gold);
    }, [selectedRecipe, state.inventory, state.gold]);

    // Get crafter modifier
    const crafterModifier = useMemo(() => {
        if (state.party.length === 0) return 2;
        const profBonus = state.party[0].proficiencyBonus || 2;
        const intMod = Math.floor(((state.party[0].abilityScores?.Intelligence || 10) - 10) / 2);
        const locationMod = selectedRecipe
            ? calculateLocationModifier(currentLocation, selectedRecipe.recipe.category)
            : currentLocation.dcModifier;
        return profBonus + intMod + craftingState.bonusModifier - locationMod;
    }, [state.party, craftingState.bonusModifier, currentLocation, selectedRecipe]);

    const handleCraft = () => {
        if (!selectedRecipe) return;

        setIsCrafting(true);

        setTimeout(() => {
            if (batchSize > 1 && batchInfo && batchInfo.maxCraftable >= batchSize) {
                // Batch crafting
                const result = attemptBatchCraft(selectedRecipe.recipe, batchSize, crafterModifier);
                const actions = generateBatchCraftActions(selectedRecipe.recipe, result);

                for (const action of actions) {
                    dispatch(action as Parameters<typeof dispatch>[0]);
                }

                // Update crafting stats
                dispatch({
                    type: 'UPDATE_CRAFTING_STATS',
                    payload: {
                        quality: result.totalSuccess > 0 ? 'standard' : 'ruined',
                        category: selectedRecipe.recipe.category,
                        isNat20: result.results.some(r => r.roll >= 20)
                    }
                });

                // Add XP
                dispatch({ type: 'ADD_CRAFTING_XP', payload: { amount: result.totalXpGained } });

                setCraftingLog(prev => [{
                    message: result.summary,
                    quality: (result.totalSuccess > 0 ? 'standard' : 'ruined') as CraftingQuality,
                    xpGained: result.totalXpGained,
                    timestamp: new Date()
                }, ...prev].slice(0, 15));
            } else {
                // Single crafting
                const result = attemptCrafting(
                    selectedRecipe.recipe,
                    crafterModifier,
                    state.inventory,
                    state.gold,
                    { ...craftingState, knownRecipes: knownRecipesSet } as any
                );

                const actions = generateCraftingActions(selectedRecipe.recipe, result);
                for (const action of actions) {
                    dispatch(action as Parameters<typeof dispatch>[0]);
                }

                // Update crafting stats
                dispatch({
                    type: 'UPDATE_CRAFTING_STATS',
                    payload: {
                        quality: result.quality,
                        category: selectedRecipe.recipe.category,
                        isNat20: result.isNat20
                    }
                });

                // Add XP
                dispatch({ type: 'ADD_CRAFTING_XP', payload: { amount: result.xpGained } });

                setCraftingLog(prev => [{
                    message: result.message,
                    quality: result.quality,
                    xpGained: result.xpGained,
                    timestamp: new Date()
                }, ...prev].slice(0, 15));
            }

            setSelectedRecipe(null);
            setBatchSize(1);
            setIsCrafting(false);
        }, 1000);
    };

    const handleResearch = () => {
        if (!selectedRecipe || selectedRecipe.isKnown) return;

        const cost = getResearchCost(selectedRecipe.recipe.rarity);
        if (state.gold < cost.gold) return;

        setIsResearching(true);

        setTimeout(() => {
            dispatch({ type: 'MODIFY_GOLD', payload: { amount: -cost.gold } });
            dispatch({ type: 'ADVANCE_TIME', payload: { seconds: cost.days * 8 * 60 * 60 } });
            dispatch({ type: 'LEARN_RECIPE', payload: { recipeId: selectedRecipe.recipe.id } });

            setCraftingLog(prev => [{
                message: `📜 Discovered: ${selectedRecipe.recipe.name}!`,
                quality: 'standard' as CraftingQuality,
                xpGained: 30,
                timestamp: new Date()
            }, ...prev].slice(0, 15));

            setIsResearching(false);
        }, 800);
    };

    const handleProgressionUpdate = (newProgression: any) => {
        // When recipes are discovered via experiment, update state
        if (newProgression.knownRecipes) {
            const newRecipes = Array.from(newProgression.knownRecipes as Set<string>);
            for (const recipeId of newRecipes) {
                if (!craftingState.knownRecipes.includes(recipeId)) {
                    dispatch({ type: 'LEARN_RECIPE', payload: { recipeId } });
                }
            }
        }
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'common': return 'var(--color-common, #aaa)';
            case 'uncommon': return 'var(--color-uncommon, #1eff00)';
            case 'rare': return 'var(--color-rare, #0070dd)';
            case 'very_rare': return 'var(--color-epic, #a335ee)';
            default: return '#fff';
        }
    };

    const getToolIcon = (tool: CraftingTool) => {
        switch (tool) {
            case 'alchemist_supplies': return '⚗️';
            case 'herbalism_kit': return '🌿';
            case 'poisoners_kit': return '☠️';
            default: return '🛠️';
        }
    };

    const getCategoryIcon = (category: CraftingRecipe['category']) => {
        switch (category) {
            case 'potion': return '🧪';
            case 'oil': return '🛢️';
            case 'poison': return '💀';
            case 'bomb': return '💣';
            case 'ink': return '🖋️';
            case 'utility': return '⚙️';
            default: return '📦';
        }
    };

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 8);
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${minutes} min`;
    };

    // Render tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'experiment':
                return (
                    <ExperimentPanel
                        progression={{
                            ...craftingState,
                            knownRecipes: knownRecipesSet,
                            toolProficiencies: new Set(craftingState.toolProficiencies),
                            stats: craftingState.stats
                        } as any}
                        onProgressionUpdate={handleProgressionUpdate}
                    />
                );

            case 'glossary':
                return <IngredientGlossaryPanel />;

            case 'recipes':
            default:
                return renderRecipesBrowser();
        }
    };

    const renderRecipesBrowser = () => (
        <>
            {/* Location Selector */}
            <div className="location-selector">
                <label>📍 Location:</label>
                <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value as CraftingLocationType)}
                >
                    {Object.values(CRAFTING_LOCATIONS).map(loc => (
                        <option key={loc.id} value={loc.id}>
                            {loc.icon} {loc.name} (DC {loc.dcModifier >= 0 ? '+' : ''}{loc.dcModifier})
                        </option>
                    ))}
                </select>
                <span className="location-info" title={currentLocation.description}>
                    Max: {currentLocation.maxRarity.replace('_', ' ')}
                </span>
            </div>

            {/* Filters */}
            <div className="crafting-filters">
                <div className="tool-tabs">
                    <button
                        className={selectedTool === 'all' ? 'active' : ''}
                        onClick={() => setSelectedTool('all')}
                    >
                        All
                    </button>
                    <button
                        className={selectedTool === 'alchemist_supplies' ? 'active' : ''}
                        onClick={() => setSelectedTool('alchemist_supplies')}
                    >
                        ⚗️ Alchemy
                    </button>
                    <button
                        className={selectedTool === 'herbalism_kit' ? 'active' : ''}
                        onClick={() => setSelectedTool('herbalism_kit')}
                    >
                        🌿 Herbalism
                    </button>
                    <button
                        className={selectedTool === 'poisoners_kit' ? 'active' : ''}
                        onClick={() => setSelectedTool('poisoners_kit')}
                    >
                        ☠️ Poison
                    </button>
                </div>
                <div className="filter-toggles">
                    <label className="filter-toggle">
                        <input
                            type="checkbox"
                            checked={filterCraftable}
                            onChange={(e) => setFilterCraftable(e.target.checked)}
                        />
                        Craftable only
                    </label>
                    <label className="filter-toggle">
                        <input
                            type="checkbox"
                            checked={showUnknown}
                            onChange={(e) => setShowUnknown(e.target.checked)}
                        />
                        Show undiscovered
                    </label>
                </div>
            </div>

            <div className="crafting-content">
                {/* Recipe List */}
                <div className="recipe-list">
                    {displayedRecipes.length === 0 ? (
                        <div className="no-recipes">No recipes match the current filters.</div>
                    ) : (
                        displayedRecipes.map(status => (
                            <button
                                key={status.recipe.id}
                                className={`recipe-item ${status.canCraft ? 'craftable' : 'locked'} ${!status.isKnown ? 'unknown' : ''} ${selectedRecipe?.recipe.id === status.recipe.id ? 'selected' : ''}`}
                                onClick={() => { setSelectedRecipe(status); setBatchSize(1); }}
                            >
                                <span className="recipe-icon">{getCategoryIcon(status.recipe.category)}</span>
                                <div className="recipe-info">
                                    <span className="recipe-name">
                                        {status.isKnown ? status.recipe.name : '???'}
                                    </span>
                                    <span className="recipe-rarity" style={{ color: getRarityColor(status.recipe.rarity) }}>
                                        {status.recipe.rarity.replace('_', ' ')}
                                    </span>
                                </div>
                                <span className="recipe-tool">{getToolIcon(status.recipe.toolRequired)}</span>
                                <span className={`recipe-status ${status.canCraft ? 'ready' : status.isKnown ? 'missing' : 'locked'}`}>
                                    {status.canCraft ? '✓' : status.isKnown ? '✗' : '🔒'}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                {/* Recipe Details */}
                <div className="recipe-details">
                    {selectedRecipe ? (
                        <>
                            <div className="detail-header">
                                <span className="detail-icon">{getCategoryIcon(selectedRecipe.recipe.category)}</span>
                                <div>
                                    <h3>{selectedRecipe.isKnown ? selectedRecipe.recipe.name : 'Unknown Recipe'}</h3>
                                    <span className="detail-rarity" style={{ color: getRarityColor(selectedRecipe.recipe.rarity) }}>
                                        {selectedRecipe.recipe.rarity.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            {selectedRecipe.isKnown ? (
                                <>
                                    <p className="detail-description">{selectedRecipe.recipe.description}</p>

                                    <div className="detail-stats">
                                        <div className="detail-stat">
                                            <span className="label">DC:</span>
                                            <span className="value">
                                                {batchSize > 1
                                                    ? getBatchDCDisplay(selectedRecipe.recipe.craftingDC, batchSize)
                                                    : selectedRecipe.recipe.craftingDC}
                                            </span>
                                        </div>
                                        <div className="detail-stat">
                                            <span className="label">Time:</span>
                                            <span className="value">{formatTime(selectedRecipe.recipe.craftingDays * 480 * currentLocation.timeModifier)}</span>
                                        </div>
                                        <div className="detail-stat">
                                            <span className="label">Cost:</span>
                                            <span className={`value ${selectedRecipe.hasEnoughGold ? '' : 'missing'}`}>
                                                {selectedRecipe.recipe.goldCost * batchSize} GP
                                            </span>
                                        </div>
                                        <div className="detail-stat">
                                            <span className="label">Output:</span>
                                            <span className="value">{selectedRecipe.recipe.outputQuantity * batchSize}x</span>
                                        </div>
                                    </div>

                                    <div className="ingredients-section">
                                        <h4>Required Ingredients:</h4>
                                        <ul className="ingredient-list">
                                            {selectedRecipe.ingredientStatuses.map(ing => (
                                                <li key={ing.itemId} className={ing.available >= ing.required * batchSize ? 'satisfied' : 'missing'}>
                                                    <span className="ing-name">{ing.name}</span>
                                                    <span className="ing-count">
                                                        {ing.available}/{ing.required * batchSize}
                                                        {ing.available >= ing.required * batchSize ? ' ✓' : ' ✗'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Batch Size Selector */}
                                    {batchInfo && batchInfo.maxCraftable > 1 && (
                                        <div className="batch-selector">
                                            <h4>📦 Batch Size:</h4>
                                            <div className="batch-buttons">
                                                {[1, 2, 3, 4, 5].map(qty => (
                                                    <button
                                                        key={qty}
                                                        className={`batch-btn ${batchSize === qty ? 'active' : ''} ${qty > batchInfo.maxCraftable ? 'disabled' : ''}`}
                                                        onClick={() => setBatchSize(qty)}
                                                        disabled={qty > batchInfo.maxCraftable}
                                                    >
                                                        {qty}x
                                                    </button>
                                                ))}
                                            </div>
                                            {batchSize > 1 && (
                                                <p className="batch-info">
                                                    DC +{batchSize - 1} | Each item rolled separately
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Quality Preview */}
                                    <div className="quality-preview">
                                        <h4>Quality Chances:</h4>
                                        <div className="quality-tiers">
                                            <span style={{ color: getQualityColor('ruined') }}>{getQualityIcon('ruined')} Ruined</span>
                                            <span style={{ color: getQualityColor('standard') }}>{getQualityIcon('standard')} Standard</span>
                                            <span style={{ color: getQualityColor('masterwork') }}>{getQualityIcon('masterwork')} Masterwork</span>
                                            <span style={{ color: getQualityColor('legendary') }}>{getQualityIcon('legendary')} Legendary</span>
                                        </div>
                                    </div>

                                    <button
                                        className="craft-button"
                                        disabled={!selectedRecipe.canCraft || isCrafting || (batchSize > 1 && (!batchInfo || batchInfo.maxCraftable < batchSize))}
                                        onClick={handleCraft}
                                    >
                                        {isCrafting ? '⏳ Crafting...' : `🔨 Craft ${batchSize}x ${selectedRecipe.recipe.name}`}
                                    </button>

                                    {!selectedRecipe.canCraft && (
                                        <div className="craft-warning">
                                            {!selectedRecipe.hasEnoughGold && (
                                                <p>⚠️ Need {selectedRecipe.missingGold.toFixed(0)} more gold</p>
                                            )}
                                            {!selectedRecipe.hasAllIngredients && (
                                                <p>⚠️ Missing required ingredients</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="unknown-recipe">
                                        <p>🔒 This recipe has not been discovered yet.</p>
                                        <p className="research-info">
                                            You can research this recipe for:
                                        </p>
                                        <div className="research-cost">
                                            <span>💰 {getResearchCost(selectedRecipe.recipe.rarity).gold} GP</span>
                                            <span>⏱️ {getResearchCost(selectedRecipe.recipe.rarity).days} days</span>
                                        </div>
                                        <button
                                            className="research-button"
                                            disabled={state.gold < getResearchCost(selectedRecipe.recipe.rarity).gold || isResearching}
                                            onClick={handleResearch}
                                        >
                                            {isResearching ? '📚 Researching...' : '📜 Research Recipe'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="no-selection">
                            <p>Select a recipe to view details</p>
                            <div className="stats-summary">
                                <p>📊 Crafting Stats:</p>
                                <ul>
                                    <li>Total Crafted: {craftingState.stats.totalCrafted}</li>
                                    <li>Successes: {craftingState.stats.successfulCrafts}</li>
                                    <li>Masterworks: {craftingState.stats.masterworkCrafts}</li>
                                    <li>Legendary: {craftingState.stats.legendaryRolls}</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <WindowFrame
            title="⚗️ Alchemy & Crafting Bench"
            onClose={onClose}
            storageKey={WINDOW_KEYS.ALCHEMY_BENCH}
        >
            <div className="alchemy-bench-panel">

                {/* Tab Navigation */}
                <div className="tab-navigation">
                    <button
                        className={`tab-btn ${activeTab === 'recipes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('recipes')}
                    >
                        📜 Recipes
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'experiment' ? 'active' : ''}`}
                        onClick={() => setActiveTab('experiment')}
                    >
                        🔬 Experiment
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'glossary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('glossary')}
                    >
                        📖 Glossary
                    </button>
                </div>

                {/* Crafter Progression Bar (only on recipes tab) */}
                {activeTab === 'recipes' && (
                    <div className="progression-bar">
                        <div className="level-badge">
                            <span className="level-num">Lv {craftingState.level}</span>
                            <span className="level-title">
                                {craftingState.level >= 10 ? 'Master Alchemist' :
                                    craftingState.level >= 7 ? 'Expert' :
                                        craftingState.level >= 4 ? 'Journeyman' : 'Apprentice'}
                            </span>
                        </div>
                        <div className="xp-bar-container">
                            <div
                                className="xp-bar-fill"
                                style={{ width: craftingState.level >= 10 ? '100%' : `${(craftingState.xp / craftingState.xpToNextLevel) * 100}%` }}
                            />
                            <span className="xp-text">
                                {craftingState.level >= 10 ? 'MAX' : `${craftingState.xp} / ${craftingState.xpToNextLevel} XP`}
                            </span>
                        </div>
                        {craftingState.bonusModifier > 0 && (
                            <span className="bonus-badge">+{craftingState.bonusModifier}</span>
                        )}
                    </div>
                )}

                {/* Stats Bar (only on recipes tab) */}
                {activeTab === 'recipes' && (
                    <div className="crafting-stats">
                        <div className="stat">
                            <span className="stat-value">{summary.craftable}</span>
                            <span className="stat-label">Craftable</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{summary.known}</span>
                            <span className="stat-label">Known</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{summary.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat gold">
                            <span className="stat-value">{state.gold.toFixed(0)}</span>
                            <span className="stat-label">Gold</span>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="tab-content">
                    {renderTabContent()}
                </div>

                {/* Crafting Log (only on recipes tab) */}
                {activeTab === 'recipes' && craftingLog.length > 0 && (
                    <div className="crafting-log">
                        <h4>Recent Activity:</h4>
                        <ul>
                            {craftingLog.map((log, i) => (
                                <li key={i} className={`quality-${log.quality}`}>
                                    <span className="log-quality" style={{ color: getQualityColor(log.quality) }}>
                                        {getQualityIcon(log.quality)}
                                    </span>
                                    <span className="log-message">{log.message}</span>
                                    {log.xpGained > 0 && (
                                        <span className="log-xp">+{log.xpGained} XP</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </WindowFrame>
    );
};

export default AlchemyBenchPanel;
