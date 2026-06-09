// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:44
 * Dependents: components/Combat/CombatView.tsx, components/Crafting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/Crafting/CreatureHarvestPanel.tsx
 * UI component for harvesting parts from defeated creatures using Poisoner's Kit.
 */
import React, { useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { attemptCreatureHarvest, getHarvestableParts } from '../../systems/crafting/creatureHarvestSystem';
import { HarvestableCreature, CreaturePart, getCreatureById } from '../../systems/crafting/creatureHarvestData';
import { resolveCraftingCrafter } from './crafterAdapter';
import './CreatureHarvestPanel.css';

interface CreatureHarvestPanelProps {
    creatureId: string;
    onClose?: () => void;
}

export const CreatureHarvestPanel: React.FC<CreatureHarvestPanelProps> = ({ creatureId, onClose }) => {
    const { state, dispatch } = useGameState();
    const [harvestLog, setHarvestLog] = useState<string[]>([]);
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [harvestedParts, setHarvestedParts] = useState<Set<string>>(new Set());

    const creature = getCreatureById(creatureId);
    const parts = getHarvestableParts(creatureId);
    const crafter = useMemo(
        () => resolveCraftingCrafter(state, { allowCharacterSheetSelection: false }).crafter,
        [state.party]
    );

    if (!creature) {
        return (
            <div className="creature-harvest-panel error">
                <p>Unknown creature: {creatureId}</p>
                {onClose && <button onClick={onClose}>Close</button>}
            </div>
        );
    }

    const handleHarvest = (part: CreaturePart) => {
        if (harvestedParts.has(part.id)) return; // Already harvested

        setIsHarvesting(true);
        setTimeout(() => {
            const result = attemptCreatureHarvest(crafter, creatureId, part.id);

            if ('message' in result) {
                setHarvestLog(prev => [...prev, result.message]);
            } else {
                setHarvestLog(prev => [...prev, result.yieldMessage]);

                if (result.success && result.yield > 0) {
                    // Add harvested items to inventory
                    for (let i = 0; i < result.yield; i++) {
                        dispatch({ type: 'ADD_ITEM', payload: { itemId: part.id, count: 1 } });
                    }
                }

                // Mark as harvested (can only attempt once per part per creature)
                setHarvestedParts(prev => new Set([...prev, part.id]));
            }

            setIsHarvesting(false);
        }, 500);
    };

    const getToolIcon = (tool: CreaturePart['harvestTool']) => {
        switch (tool) {
            case 'poisoners_kit': return '☠️';
            case 'alchemists_kit': return '⚗️';
            case 'knife': return '🔪';
            case 'none': return '👐';
            default: return '🛠️';
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

    return (
        <div className="creature-harvest-panel">
            <div className="harvest-header">
                <h2>🦴 Harvest: {creature.name}</h2>
                {onClose && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            <div className="creature-info">
                <span className="cr-badge">CR {creature.cr}</span>
                <span className="locations">{creature.locations.join(', ')}</span>
            </div>

            <div className="parts-list">
                <h3>Harvestable Parts:</h3>
                {parts.map(part => (
                    <div
                        key={part.id}
                        className={`part-item ${harvestedParts.has(part.id) ? 'harvested' : ''}`}
                    >
                        <div className="part-info">
                            <div className="part-header">
                                <span className="tool-icon">{getToolIcon(part.harvestTool)}</span>
                                <span className="part-name">{part.name}</span>
                                <span className="part-rarity" style={{ color: getRarityColor(part.rarity) }}>
                                    {part.rarity}
                                </span>
                            </div>
                            {part.description && <p className="part-description">{part.description}</p>}
                            <div className="part-stats">
                                <span>DC {part.harvestDC}</span>
                                <span>Yield: {part.baseYield}</span>
                            </div>
                        </div>
                        <button
                            className="harvest-btn"
                            onClick={() => handleHarvest(part)}
                            disabled={isHarvesting || harvestedParts.has(part.id)}
                        >
                            {harvestedParts.has(part.id) ? 'Harvested' : isHarvesting ? '...' : 'Harvest'}
                        </button>
                    </div>
                ))}
            </div>

            {harvestLog.length > 0 && (
                <div className="harvest-log">
                    <h3>Harvest Results:</h3>
                    <ul>
                        {harvestLog.map((log, index) => (
                            <li key={index}>{log}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CreatureHarvestPanel;
