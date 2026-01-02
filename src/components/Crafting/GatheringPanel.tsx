/**
 * @file src/components/Crafting/GatheringPanel.tsx
 * UI component for the herbalism gathering system.
 * Allows players to identify and harvest ingredients from the current biome.
 */
import React, { useState, useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import { attemptIdentification, attemptHarvest, IdentificationResult, HarvestingResult } from '../../systems/crafting/gatheringSystem';
import { GatherableResource, Biome } from '../../systems/crafting/gatheringData';
import { Crafter } from '../../systems/crafting/craftingSystem';
import './GatheringPanel.css';

// Mock crafter from party - in production, this would come from the selected character
function createCrafterFromParty(party: unknown[]): Crafter {
    // Use first party member with relevant skills
    // This is a simplified implementation
    return {
        id: 'party-gatherer',
        name: 'Party',
        inventory: [],
        rollSkill: (skillName: string) => {
            // Simulate a skill roll: d20 + modifier
            const d20 = Math.floor(Math.random() * 20) + 1;
            const modifier = skillName === 'Nature' || skillName === 'Herbalism Kit' ? 5 : 2;
            return d20 + modifier;
        }
    };
}

// Map location types to biomes (simplified)
function getBiomeFromLocation(locationId: string): Biome {
    if (locationId.includes('forest') || locationId.includes('wood')) return 'Forest';
    if (locationId.includes('swamp') || locationId.includes('marsh')) return 'Swamp';
    if (locationId.includes('mountain') || locationId.includes('peak')) return 'Mountain';
    if (locationId.includes('coast') || locationId.includes('beach')) return 'Coast';
    if (locationId.includes('desert') || locationId.includes('sand')) return 'Desert';
    if (locationId.includes('arctic') || locationId.includes('snow') || locationId.includes('frozen')) return 'Arctic';
    if (locationId.includes('underdark') || locationId.includes('cave')) return 'Underdark';
    if (locationId.includes('urban') || locationId.includes('city') || locationId.includes('town')) return 'Urban';
    return 'Grassland'; // Default
}

interface GatheringPanelProps {
    onClose?: () => void;
}

export const GatheringPanel: React.FC<GatheringPanelProps> = ({ onClose }) => {
    const { state, dispatch } = useGameState();

    const [identificationResult, setIdentificationResult] = useState<IdentificationResult | null>(null);
    const [harvestResults, setHarvestResults] = useState<HarvestingResult[]>([]);
    const [selectedResource, setSelectedResource] = useState<GatherableResource | null>(null);
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [timeMultiplier, setTimeMultiplier] = useState(1);

    const currentBiome = useMemo(() => getBiomeFromLocation(state.currentLocationId), [state.currentLocationId]);
    const crafter = useMemo(() => createCrafterFromParty(state.party), [state.party]);

    const handleIdentify = () => {
        setIsIdentifying(true);
        setTimeout(() => {
            const result = attemptIdentification(crafter, currentBiome, timeMultiplier);
            setIdentificationResult(result);
            setIsIdentifying(false);
            setHarvestResults([]);
            setSelectedResource(null);
        }, 500); // Brief delay for UX
    };

    const handleHarvest = () => {
        if (!selectedResource) return;

        setIsHarvesting(true);
        setTimeout(() => {
            const result = attemptHarvest(crafter, selectedResource, timeMultiplier);
            setHarvestResults(prev => [...prev, result]);

            // Add to inventory on success
            if (result.success && result.yield > 0) {
                for (let i = 0; i < result.yield; i++) {
                    dispatch({ type: 'ADD_ITEM', payload: { itemId: selectedResource.id, count: 1 } });
                }
            }

            setIsHarvesting(false);
        }, 500);
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
        <div className="gathering-panel">
            <div className="gathering-header">
                <h2>🌿 Herbalism & Gathering</h2>
                {onClose && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            <div className="gathering-info">
                <div className="biome-indicator">
                    <span className="label">Current Biome:</span>
                    <span className="value">{currentBiome}</span>
                </div>

                <div className="time-selector">
                    <span className="label">Time Spent:</span>
                    <select value={timeMultiplier} onChange={(e) => setTimeMultiplier(Number(e.target.value))}>
                        <option value={1}>30 minutes (+0)</option>
                        <option value={2}>60 minutes (+3)</option>
                        <option value={3}>90 minutes (+6)</option>
                    </select>
                </div>
            </div>

            <div className="gathering-actions">
                <button
                    className="identify-btn"
                    onClick={handleIdentify}
                    disabled={isIdentifying}
                >
                    {isIdentifying ? '🔍 Searching...' : '🔍 Search for Flora (Nature Check)'}
                </button>
            </div>

            {identificationResult && (
                <div className={`identification-result ${identificationResult.success ? 'success' : 'failure'}`}>
                    <p className="result-message">{identificationResult.message}</p>

                    {identificationResult.success && (
                        <div className="identified-resources">
                            <h3>Identified Flora:</h3>
                            <div className="resource-list">
                                {identificationResult.identifiedResources.map(resource => (
                                    <button
                                        key={resource.id}
                                        className={`resource-item ${selectedResource?.id === resource.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedResource(resource)}
                                        style={{ borderColor: getRarityColor(resource.rarity) }}
                                        title={resource.properties ? `Properties: ${resource.properties.join(', ')}` : ''}
                                    >
                                        <span className="resource-name">{resource.name}</span>
                                        <span className="resource-rarity" style={{ color: getRarityColor(resource.rarity) }}>
                                            {resource.rarity}
                                        </span>
                                        <span className="resource-dc">DC {resource.harvestDC}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedResource && (
                <div className="harvest-section">
                    <div className="selected-resource-info">
                        <h3>Selected: {selectedResource.name}</h3>
                        <p>Harvest DC: {selectedResource.harvestDC}</p>
                        <p>Expected Yield: {selectedResource.baseYield}</p>
                    </div>

                    <button
                        className="harvest-btn"
                        onClick={handleHarvest}
                        disabled={isHarvesting}
                    >
                        {isHarvesting ? '🌱 Harvesting...' : '🌱 Harvest (Herbalism Kit Check)'}
                    </button>
                </div>
            )}

            {harvestResults.length > 0 && (
                <div className="harvest-results">
                    <h3>Harvest Log:</h3>
                    <ul>
                        {harvestResults.map((result, index) => (
                            <li key={index} className={result.success ? 'success' : 'failure'}>
                                {result.yieldMessage}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default GatheringPanel;
