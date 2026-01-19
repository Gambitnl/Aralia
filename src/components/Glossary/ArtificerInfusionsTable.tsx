/**
 * @file ArtificerInfusionsTable.tsx
 * Premium table layout for displaying Artificer Infusions in the glossary.
 * Parses infusion data from markdown content and renders in a structured table.
 */
import React, { useState, useMemo } from 'react';
import { GlossaryIcon } from './IconRegistry';

interface InfusionData {
    name: string;
    type: string;
    levelReq: string;
    attunement: string;
    targetItem: string;
    icon: string;
    description: string;
}

interface ArtificerInfusionsTableProps {
    markdownContent: string;
    onNavigate?: (termId: string) => void;
}

/**
 * Map infusion names to icons and types for display
 * Icons can be from GlossaryIcon SVG registry or Material Symbols (fallback)
 */
const infusionMetadata: Record<string, { icon: string; type: string }> = {
    'Arcane Propulsion Armor': { icon: 'settings_input_component', type: 'Articulated Exoskeleton' },
    'Armor of Magical Strength': { icon: 'fitness_center', type: 'Strength Enhancement' },
    'Boots of the Winding Path': { icon: 'directions_walk', type: 'Teleportation' },
    'Enhanced Arcane Focus': { icon: 'auto_fix_high', type: 'Spellcasting Enhancement' },
    'Enhanced Defense': { icon: 'shield', type: 'Protective Ward' },
    'Enhanced Weapon': { icon: 'sword', type: 'Combat Enhancement' },
    'Helm of Awareness': { icon: 'visibility', type: 'Perceptual Augmentation' },
    'Homunculus Servant': { icon: 'smart_toy', type: 'Mechanical Construct' },
    'Mind Sharpener': { icon: 'psychology', type: 'Concentration Aid' },
    'Radiant Weapon': { icon: 'light_mode', type: 'Radiant Enhancement' },
    'Repeating Shot': { icon: 'gps_fixed', type: 'Ranged Enhancement' },
    'Repulsion Shield': { icon: 'security', type: 'Defensive Ward' },
    'Resistant Armor': { icon: 'verified_user', type: 'Elemental Protection' },
    'Returning Weapon': { icon: 'redo', type: 'Thrown Enhancement' },
    'Spell-Refueling Ring': { icon: 'diamond', type: 'Spell Recovery' },
    'Replicate Magic Item': { icon: 'auto_awesome_motion', type: 'Fabrication' },
};

/**
 * Parse infusion data from markdown content
 */
function parseInfusions(markdown: string): InfusionData[] {
    const infusions: InfusionData[] = [];

    // Match <details> blocks containing infusion data
    const detailsRegex = /<details[^>]*>\s*<summary>\s*<h3>([^<]+)<\/h3>\s*<\/summary>\s*<div>([\s\S]*?)<\/div>\s*<\/details>/gi;

    let match;
    while ((match = detailsRegex.exec(markdown)) !== null) {
        const name = match[1].trim();
        const content = match[2];

        // Extract prerequisite level
        const prereqMatch = content.match(/Prerequisite:\s*(\d+)(?:th|st|nd|rd)-level/i);
        const levelReq = prereqMatch ? prereqMatch[1] : '1';

        // Extract item type
        const itemMatch = content.match(/Item:\s*([^<(]+)/i);
        const targetItem = itemMatch ? itemMatch[1].trim() : 'Varies';

        // Check for attunement
        const attunement = content.includes('requires attunement') ? 'Yes' : 'No';

        // Get description (everything after the item line)
        const descMatch = content.match(/<\/p>\s*<p>([^]*)/i);
        let description = '';
        if (descMatch) {
            description = descMatch[1]
                .replace(/<\/?[^>]+(>|$)/g, '') // Strip HTML tags
                .replace(/\s+/g, ' ')
                .trim();
        }

        const meta = infusionMetadata[name] || { icon: 'magic', type: 'Infusion' };

        infusions.push({
            name,
            type: meta.type,
            levelReq,
            attunement,
            targetItem,
            icon: meta.icon,
            description,
        });
    }

    return infusions;
}

export const ArtificerInfusionsTable: React.FC<ArtificerInfusionsTableProps> = ({
    markdownContent,
}) => {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const infusions = useMemo(() => {
        const parsed = parseInfusions(markdownContent);
        // Sort by level requirement (ascending)
        return parsed.sort((a, b) => parseInt(a.levelReq) - parseInt(b.levelReq));
    }, [markdownContent]);

    const toggleRow = (name: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const highLevelCount = infusions.filter(i => parseInt(i.levelReq) >= 10).length;

    if (infusions.length === 0) {
        return null; // Fall back to default rendering
    }

    return (
        <div className="infusions-table-container">
            {/* Table Header */}
            <div className="infusions-header">
                <div className="infusions-col infusions-col-name">Infusion Name & Type</div>
                <div className="infusions-col infusions-col-level">Level Req.</div>
                <div className="infusions-col infusions-col-attune">Attunement</div>
                <div className="infusions-col infusions-col-item">Target Item</div>
            </div>

            {/* Infusion Rows */}
            <div className="infusions-list">
                {infusions.map((infusion) => {
                    const isExpanded = expandedRows.has(infusion.name);
                    const isHighLevel = parseInt(infusion.levelReq) >= 10;

                    return (
                        <div
                            key={infusion.name}
                            className={`infusion-row ${isExpanded ? 'infusion-row-expanded' : ''}`}
                        >
                            <div
                                className="infusion-row-header"
                                onClick={() => toggleRow(infusion.name)}
                            >
                                {/* Name & Type Column */}
                                <div className="infusions-col infusions-col-name">
                                    <div className="infusion-icon">
                                        <GlossaryIcon name={infusion.icon} className="w-5 h-5" />
                                    </div>
                                    <div className="infusion-name-group">
                                        <h3 className="infusion-name">{infusion.name}</h3>
                                        <span className="infusion-type">{infusion.type}</span>
                                    </div>
                                </div>

                                {/* Level Column */}
                                <div className="infusions-col infusions-col-level">
                                    <span className={`infusion-level-badge ${isHighLevel ? 'infusion-level-high' : ''}`}>
                                        Lv {infusion.levelReq}
                                    </span>
                                </div>

                                {/* Attunement Column */}
                                <div className="infusions-col infusions-col-attune">
                                    <span className={infusion.attunement === 'Yes' ? 'infusion-attune-yes' : ''}>
                                        {infusion.attunement}
                                    </span>
                                </div>

                                {/* Target Item Column */}
                                <div className="infusions-col infusions-col-item">
                                    <span className="infusion-target">{infusion.targetItem}</span>
                                    <svg
                                        className={`infusion-expand-icon ${isExpanded ? 'rotate-180' : ''}`}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </div>
                            </div>

                            {/* Expandable Description */}
                            {isExpanded && infusion.description && (
                                <div className="infusion-description">
                                    <p>{infusion.description}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary Footer */}
            <div className="infusions-footer">
                <div className="infusions-stats">
                    <div className="infusions-stat">
                        <div className="infusions-stat-value">{infusions.length}</div>
                        <div className="infusions-stat-label">Total Infusions</div>
                    </div>
                    <div className="infusions-stat-divider" />
                    <div className="infusions-stat">
                        <div className="infusions-stat-value infusions-stat-secondary">{highLevelCount}</div>
                        <div className="infusions-stat-label">High Level (10+)</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtificerInfusionsTable;
