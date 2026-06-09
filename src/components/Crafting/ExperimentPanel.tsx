// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:52:38
 * Dependents: components/Crafting/AlchemyBenchPanel.tsx, components/Crafting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/Crafting/ExperimentPanel.tsx
 * UI for experimental alchemy - mix random ingredients to discover recipes.
 */
import React, { useState, useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import {
    attemptExperiment,
    getIngredientProperties,
    getPropertyHint,
    combineProperties
} from '../../systems/crafting/experimentalAlchemy';
import { learnRecipe, CrafterProgression } from '../../systems/crafting/crafterProgression';
import { REAGENT_DATABASE } from '../../systems/crafting/alchemySystem';
import './ExperimentPanel.css';

interface ExperimentPanelProps {
    onClose?: () => void;
    progression: CrafterProgression;
    onProgressionUpdate: (prog: CrafterProgression) => void;
}

interface SelectedIngredient {
    id: string;
    name: string;
    icon: string;
}

const PROPERTY_COLORS: Record<string, string> = {
    curative: '#4caf50',
    toxic: '#9c27b0',
    reactive: '#ff5722',
    psionic: '#3f51b5',
    ethereal: '#00bcd4',
    luminous: '#ffeb3b',
    inert: '#9e9e9e'
};

export const ExperimentPanel: React.FC<ExperimentPanelProps> = ({
    onClose,
    progression,
    onProgressionUpdate
}) => {
    const { state, dispatch } = useGameState();

    const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
    const [experimentResult, setExperimentResult] = useState<string | null>(null);
    const [isExperimenting, setIsExperimenting] = useState(false);
    const [experimentLog, setExperimentLog] = useState<string[]>([]);

    // Get unique ingredients from inventory.
    // Stackable reagents need to count their stored quantity, not just the
    // number of inventory records, so the experiment UI reflects real supply.
    const availableIngredients = useMemo(() => {
        const uniqueItems = new Map<string, { id: string; name: string; count: number }>();

        for (const item of state.inventory) {
            const stackSize = item.quantity ?? 1;
            const existing = uniqueItems.get(item.id);
            if (existing) {
                existing.count += stackSize;
            } else {
                uniqueItems.set(item.id, { id: item.id, name: item.name, count: stackSize });
            }
        }

        const sortedIngredients = Array.from(uniqueItems.values());

        // Filter: Only allow items present in the Reagent Database
        return sortedIngredients.filter(item => !!REAGENT_DATABASE[item.id]);
    }, [state.inventory]);

    // Get combined properties for selected ingredients
    const combinedProperties = useMemo(() => {
        const ids = selectedIngredients.map(i => i.id);
        return combineProperties(ids);
    }, [selectedIngredients]);

    // Get hint for current combination
    const hint = useMemo(() => {
        if (selectedIngredients.length < 2) return 'Select at least 2 ingredients';
        return getPropertyHint(combinedProperties);
    }, [combinedProperties, selectedIngredients.length]);

    const crafterModifier = useMemo(() => {
        if (state.party.length === 0) return 2;
        const profBonus = state.party[0].proficiencyBonus || 2;
        return profBonus + 2 + (progression.bonusModifier || 0);
    }, [state.party, progression.bonusModifier]);

    const handleAddIngredient = (item: { id: string; name: string }) => {
        if (selectedIngredients.length >= 4) return;
        if (selectedIngredients.some(i => i.id === item.id)) {
            // Check if we have enough
            const currentCount = selectedIngredients.filter(i => i.id === item.id).length;
            const available = availableIngredients.find(i => i.id === item.id)?.count || 0;
            if (currentCount >= available) return;
        }

        setSelectedIngredients(prev => [...prev, {
            id: item.id,
            name: item.name,
            icon: '🧪'
        }]);
        setExperimentResult(null);
    };

    // Drag-and-drop stays additive here so the existing click selection path
    // still works for players and for the current experiment-panel tests.
    const handleIngredientDragStart = (
        item: { id: string; name: string },
        event: React.DragEvent<HTMLButtonElement>
    ) => {
        if (selectedIngredients.length >= 4) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', item.id);
    };

    const handleCauldronDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleCauldronDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const itemId =
            event.dataTransfer.getData('application/x-aralia-crafting-ingredient') ||
            event.dataTransfer.getData('text/plain');
        const item = availableIngredients.find(ingredient => ingredient.id === itemId);

        if (item) {
            handleAddIngredient(item);
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setSelectedIngredients(prev => prev.filter((_, i) => i !== index));
        setExperimentResult(null);
    };

    const handleExperiment = () => {
        if (selectedIngredients.length < 2) return;

        setIsExperimenting(true);

        setTimeout(() => {
            const ingredientIds = selectedIngredients.map(i => i.id);
            const result = attemptExperiment(ingredientIds, crafterModifier, progression.knownRecipes);

            // Consume ingredients
            for (const id of ingredientIds) {
                dispatch({ type: 'REMOVE_ITEM', payload: { itemId: id, count: 1 } });
            }

            // Handle discovery
            if (result.discoveredRecipe) {
                const newProgression = learnRecipe(progression, result.discoveredRecipe);
                onProgressionUpdate(newProgression);
            }

            // Route explosion fallout through the shared party-health reducer.
            // ExperimentPanel does not own combat state, so this keeps the damage
            // visible in the same HP model the rest of the game already uses.
            if (result.damage) {
                const partyMemberIds = state.party.map(member => member.id);
                if (partyMemberIds.length > 0) {
                    dispatch({
                        type: 'MODIFY_PARTY_HEALTH',
                        payload: {
                            amount: -result.damage.amount,
                            characterIds: partyMemberIds
                        }
                    });
                }

                // Also log it locally so the player sees the narrative fallout
                // in this panel while HP is handled by shared party state.
                setExperimentLog(prev => [`💥 Explosion dealt ${result.damage?.amount} ${result.damage?.type} damage!`, ...prev].slice(0, 10));
            }

            // Update result display
            setExperimentResult(result.message);
            setExperimentLog(prev => [result.message, ...prev].slice(0, 10));

            // Clear selection
            setSelectedIngredients([]);
            setIsExperimenting(false);
        }, 1500);
    };

    const getPropertyColor = (prop: string): string => {
        return PROPERTY_COLORS[prop] || PROPERTY_COLORS.inert;
    };

    return (
        <div className="experiment-panel">
            <div className="experiment-header">
                <h2>🔬 Experimental Alchemy</h2>
                {onClose && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            <p className="experiment-intro">
                Mix ingredients without a recipe to discover new concoctions... or cause explosions!
            </p>

            <div className="experiment-content">
                {/* Ingredient Selection */}
                <div className="ingredient-selection">
                    <h3>Available Ingredients</h3>
                    <div className="ingredient-grid">
                        {availableIngredients.map(item => {
                            const props = getIngredientProperties(item.id);
                            return (
                                <button
                                    key={item.id}
                                    className="ingredient-btn"
                                    draggable={selectedIngredients.length < 4}
                                    onClick={() => handleAddIngredient(item)}
                                    onDragStart={(event) => handleIngredientDragStart(item, event)}
                                    disabled={selectedIngredients.length >= 4}
                                    title={`Properties: ${props.join(', ')}`}
                                >
                                    <span className="ing-name">{item.name}</span>
                                    <span className="ing-count">×{item.count}</span>
                                    <div className="ing-props">
                                        {props.map((p, i) => (
                                            <span
                                                key={i}
                                                className="prop-dot"
                                                style={{ background: getPropertyColor(p) }}
                                                title={p}
                                            />
                                        ))}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Mixing Area */}
                <div className="mixing-area">
                    <h3>Mixing Cauldron</h3>
                    <div
                        className="cauldron"
                        data-testid="alchemy-cauldron"
                        onDragOver={handleCauldronDragOver}
                        onDrop={handleCauldronDrop}
                    >
                        {[0, 1, 2, 3].map(slot => (
                            <div key={slot} className={`cauldron-slot ${selectedIngredients[slot] ? 'filled' : 'empty'}`}>
                                {selectedIngredients[slot] ? (
                                    <button
                                        className="slot-content"
                                        onClick={() => handleRemoveIngredient(slot)}
                                    >
                                        <span className="slot-name">{selectedIngredients[slot].name}</span>
                                        <span className="slot-remove">×</span>
                                    </button>
                                ) : (
                                    <span className="slot-empty">Slot {slot + 1}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Property Preview */}
                    {selectedIngredients.length > 0 && (
                        <div className="property-preview">
                            <span className="preview-label">Combined Properties:</span>
                            <div className="preview-props">
                                {combinedProperties.map((prop, i) => (
                                    <span
                                        key={i}
                                        className="prop-tag"
                                        style={{ background: getPropertyColor(prop) }}
                                    >
                                        {prop}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hint */}
                    <div className={`experiment-hint ${hint.includes('⚠️') || hint.includes('☠️') ? 'warning' : ''}`}>
                        {hint}
                    </div>

                    {/* Experiment Button */}
                    <button
                        className="experiment-btn"
                        onClick={handleExperiment}
                        disabled={selectedIngredients.length < 2 || isExperimenting}
                    >
                        {isExperimenting ? '⏳ Mixing...' : '🧪 Experiment!'}
                    </button>

                    {/* Result Display */}
                    {experimentResult && (
                        <div className={`experiment-result ${experimentResult.includes('DISCOVERY') ? 'success' : experimentResult.includes('EXPLOSION') || experimentResult.includes('TOXIC') ? 'danger' : ''}`}>
                            {experimentResult}
                        </div>
                    )}
                </div>
            </div>

            {/* Experiment Log */}
            {experimentLog.length > 0 && (
                <div className="experiment-log">
                    <h4>Experiment History</h4>
                    <ul>
                        {experimentLog.map((log, i) => (
                            <li key={i}>{log}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ExperimentPanel;
