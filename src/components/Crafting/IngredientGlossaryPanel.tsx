/**
 * @file src/components/Crafting/IngredientGlossaryPanel.tsx
 * UI for viewing all ingredients with search and filtering.
 */
import React, { useState, useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import {
    buildIngredientGlossary,
    IngredientEntry,
    searchGlossary,
    filterBySource,
    filterByRarity
} from '../../systems/crafting/ingredientGlossary';
import './IngredientGlossaryPanel.css';

interface IngredientGlossaryPanelProps {
    onClose?: () => void;
}

const RARITY_COLORS: Record<string, string> = {
    common: '#aaaaaa',
    uncommon: '#1eff00',
    rare: '#0070dd',
    very_rare: '#a335ee'
};

const SOURCE_ICONS: Record<string, string> = {
    flora: '🌿',
    creature: '🦴',
    purchased: '🪙'
};

export const IngredientGlossaryPanel: React.FC<IngredientGlossaryPanelProps> = ({ onClose }) => {
    const { state } = useGameState();

    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'flora' | 'creature' | 'purchased'>('all');
    const [rarityFilter, setRarityFilter] = useState<string>('all');
    const [selectedEntry, setSelectedEntry] = useState<IngredientEntry | null>(null);
    const [showOnlyOwned, setShowOnlyOwned] = useState(false);

    // Build the glossary
    const fullGlossary = useMemo(() => buildIngredientGlossary(), []);

    // Count owned items
    const ownedCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of state.inventory) {
            counts[item.id] = (counts[item.id] || 0) + 1;
        }
        return counts;
    }, [state.inventory]);

    // Apply filters
    const filteredGlossary = useMemo(() => {
        let result = fullGlossary;

        // Search
        if (searchQuery.trim()) {
            result = searchGlossary(result, searchQuery);
        }

        // Source filter
        result = filterBySource(result, sourceFilter);

        // Rarity filter
        result = filterByRarity(result, rarityFilter);

        // Owned filter
        if (showOnlyOwned) {
            result = result.filter(entry => ownedCounts[entry.id] > 0);
        }

        return result;
    }, [fullGlossary, searchQuery, sourceFilter, rarityFilter, showOnlyOwned, ownedCounts]);

    // Stats
    const stats = useMemo(() => {
        const total = fullGlossary.length;
        const owned = fullGlossary.filter(e => ownedCounts[e.id] > 0).length;
        return { total, owned, completion: Math.floor((owned / total) * 100) };
    }, [fullGlossary, ownedCounts]);

    return (
        <div className="glossary-panel">
            <div className="glossary-header">
                <h2>📖 Ingredient Glossary</h2>
                {onClose && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            {/* Stats Bar */}
            <div className="glossary-stats">
                <div className="stat">
                    <span className="stat-value">{stats.owned}</span>
                    <span className="stat-label">Collected</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat completion">
                    <span className="stat-value">{stats.completion}%</span>
                    <span className="stat-label">Complete</span>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="glossary-filters">
                <input
                    type="text"
                    placeholder="🔍 Search ingredients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />

                <div className="filter-row">
                    <div className="filter-group">
                        <label>Source:</label>
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
                        >
                            <option value="all">All</option>
                            <option value="flora">🌿 Flora</option>
                            <option value="creature">🦴 Creature</option>
                            <option value="purchased">🪙 Purchased</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Rarity:</label>
                        <select
                            value={rarityFilter}
                            onChange={(e) => setRarityFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="common">Common</option>
                            <option value="uncommon">Uncommon</option>
                            <option value="rare">Rare</option>
                            <option value="very_rare">Very Rare</option>
                        </select>
                    </div>

                    <label className="filter-toggle">
                        <input
                            type="checkbox"
                            checked={showOnlyOwned}
                            onChange={(e) => setShowOnlyOwned(e.target.checked)}
                        />
                        Owned only
                    </label>
                </div>
            </div>

            <div className="glossary-content">
                {/* Ingredient List */}
                <div className="ingredient-list">
                    {filteredGlossary.length === 0 ? (
                        <div className="no-results">No ingredients match the filters.</div>
                    ) : (
                        filteredGlossary.map(entry => (
                            <button
                                key={entry.id}
                                className={`ingredient-item ${ownedCounts[entry.id] ? 'owned' : ''} ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
                                onClick={() => setSelectedEntry(entry)}
                            >
                                <span className="ing-icon">{entry.icon}</span>
                                <div className="ing-info">
                                    <span className="ing-name">{entry.name}</span>
                                    <span className="ing-source">
                                        {SOURCE_ICONS[entry.source]} {entry.source}
                                    </span>
                                </div>
                                <span
                                    className="ing-rarity"
                                    style={{ color: RARITY_COLORS[entry.rarity] }}
                                >
                                    {entry.rarity.replace('_', ' ')}
                                </span>
                                {ownedCounts[entry.id] && (
                                    <span className="ing-owned">×{ownedCounts[entry.id]}</span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Detail View */}
                <div className="ingredient-detail">
                    {selectedEntry ? (
                        <>
                            <div className="detail-header">
                                <span className="detail-icon">{selectedEntry.icon}</span>
                                <div>
                                    <h3>{selectedEntry.name}</h3>
                                    <span
                                        className="detail-rarity"
                                        style={{ color: RARITY_COLORS[selectedEntry.rarity] }}
                                    >
                                        {selectedEntry.rarity.replace('_', ' ')}
                                    </span>
                                </div>
                                {ownedCounts[selectedEntry.id] && (
                                    <span className="owned-badge">
                                        Owned: {ownedCounts[selectedEntry.id]}
                                    </span>
                                )}
                            </div>

                            <p className="detail-description">{selectedEntry.description}</p>

                            <div className="detail-section">
                                <h4>📍 Locations</h4>
                                <div className="location-tags">
                                    {selectedEntry.locations.map((loc, i) => (
                                        <span key={i} className="location-tag">
                                            {loc.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {selectedEntry.harvestDC && (
                                <div className="detail-section">
                                    <h4>🎲 Harvest Info</h4>
                                    <p>DC: {selectedEntry.harvestDC}</p>
                                    {selectedEntry.toolRequired && (
                                        <p>Tool: {selectedEntry.toolRequired}</p>
                                    )}
                                </div>
                            )}

                            <div className="detail-section">
                                <h4>⚗️ Properties</h4>
                                <div className="property-tags">
                                    {selectedEntry.properties.map((prop, i) => (
                                        <span key={i} className={`property-tag ${prop}`}>
                                            {prop}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {selectedEntry.usedInRecipes.length > 0 && (
                                <div className="detail-section">
                                    <h4>📜 Used In Recipes ({selectedEntry.usedInRecipes.length})</h4>
                                    <div className="recipe-tags">
                                        {selectedEntry.usedInRecipes.slice(0, 6).map((recipeId, i) => (
                                            <span key={i} className="recipe-tag">
                                                {recipeId.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                        {selectedEntry.usedInRecipes.length > 6 && (
                                            <span className="recipe-tag more">
                                                +{selectedEntry.usedInRecipes.length - 6} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-selection">
                            <p>📋 Select an ingredient to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IngredientGlossaryPanel;
