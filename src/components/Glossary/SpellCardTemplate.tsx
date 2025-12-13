import React from 'react';

/**
 * Spell data structure from V2 JSON schema
 * This interface represents the spell JSON format used in public/data/spells/level-{N}/*.json
 */
export interface SpellData {
    id: string;
    name: string;
    level: number;
    school: string;
    classes?: string[];
    description: string;
    higherLevels?: string;
    tags?: string[];
    ritual?: boolean;
    castingTime?: {
        value: number;
        unit: string;
        reactionCondition?: string;
        combatCost?: { type: string };
    };
    range?: {
        type: string;
        distance?: number;
    };
    components?: {
        verbal: boolean;
        somatic: boolean;
        material: boolean;
        materialDescription?: string;
    };
    duration?: {
        type: string;
        value?: number;
        unit?: string;
        concentration?: boolean;
    };
    targeting?: {
        type: string;
        areaOfEffect?: {
            shape: string;
            size: number;
        };
    };
    effects?: Array<{
        type: string;
        damage?: { dice: string; type: string };
        condition?: { type: string; saveType?: string };
    }>;
}

interface SpellCardTemplateProps {
    spell: SpellData;
}

/**
 * Helper to format the level display (Cantrip vs 1st, 2nd, etc.)
 */
const formatLevel = (level: number): string => {
    if (level === 0) return 'Cantrip';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    const suffix = suffixes[level] || 'th';
    return `${level}${suffix}`;
};

/**
 * Helper to format casting time
 */
const formatCastingTime = (castingTime?: SpellData['castingTime']): string => {
    if (!castingTime) return '1 Action';
    const { value, unit } = castingTime;
    const unitCapitalized = unit.charAt(0).toUpperCase() + unit.slice(1);
    return `${value} ${unitCapitalized}`;
};

/**
 * Helper to format range/area
 */
const formatRange = (range?: SpellData['range'], targeting?: SpellData['targeting']): string => {
    if (!range) return 'Self';

    if (range.type === 'self') return 'Self';
    if (range.type === 'touch') return 'Touch';

    let result = range.distance ? `${range.distance} ft.` : range.type;

    // Add area of effect if present
    if (targeting?.areaOfEffect) {
        const { shape, size } = targeting.areaOfEffect;
        const shapeEmoji = shape === 'Sphere' ? '🌐' : shape === 'Cone' ? '📐' : shape === 'Cube' ? '⬜' : '';
        result += ` (${size} ft. ${shapeEmoji})`;
    }

    return result;
};

/**
 * Helper to format components
 */
const formatComponents = (components?: SpellData['components']): string => {
    if (!components) return 'V, S';

    const parts: string[] = [];
    if (components.verbal) parts.push('V');
    if (components.somatic) parts.push('S');
    if (components.material) {
        parts.push(components.materialDescription ? 'M *' : 'M');
    }

    return parts.join(', ') || 'None';
};

/**
 * Helper to format duration
 */
const formatDuration = (duration?: SpellData['duration']): string => {
    if (!duration) return 'Instantaneous';

    if (duration.type === 'instantaneous') return 'Instantaneous';

    let result = '';
    if (duration.value && duration.unit) {
        const unitCapitalized = duration.unit.charAt(0).toUpperCase() + duration.unit.slice(1);
        result = `${duration.value} ${unitCapitalized}${duration.value > 1 ? 's' : ''}`;
    } else {
        result = duration.type.charAt(0).toUpperCase() + duration.type.slice(1);
    }

    if (duration.concentration) {
        result = `Up to ${result} (Concentration)`;
    }

    return result;
};

/**
 * Helper to determine attack/save type
 */
const formatAttackSave = (effects?: SpellData['effects']): string => {
    if (!effects || effects.length === 0) return 'None';

    for (const effect of effects) {
        if (effect.condition?.type === 'hit') return 'Ranged';
        if (effect.condition?.type === 'save' && effect.condition.saveType) {
            return `${effect.condition.saveType.slice(0, 3).toUpperCase()} Save`;
        }
    }

    return 'None';
};

/**
 * Helper to determine damage/effect type
 */
const formatDamageEffect = (effects?: SpellData['effects']): string => {
    if (!effects || effects.length === 0) return 'Utility';

    for (const effect of effects) {
        if (effect.type === 'DAMAGE' && effect.damage?.type) {
            return effect.damage.type;
        }
        if (effect.type === 'HEALING') return 'Healing';
        if (effect.type === 'DEFENSIVE') return 'Defense';
        if (effect.type === 'STATUS_CONDITION') return 'Control';
    }

    return 'Utility';
};

/**
 * SpellCardTemplate - Renders a spell card from JSON data
 * 
 * This component renders the same visual output as the markdown spell cards,
 * using the spell-card CSS classes for consistency.
 * 
 * Template structure matches scripts/add_spell.js lines 66-134
 */
const SpellCardTemplate: React.FC<SpellCardTemplateProps> = ({ spell }) => {
    return (
        <div className="spell-card">
            <div className="spell-card-header">
                <h1 className="spell-card-title">{spell.name}</h1>
                {spell.duration?.concentration && (
                    <div className="spell-card-symbol" title="Concentration">
                        <span className="spell-card-symbol-inner">C</span>
                    </div>
                )}
            </div>

            <div className="spell-card-divider"></div>

            <div className="spell-card-stats-grid">
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Level</span>
                    <span className="spell-card-stat-value">{formatLevel(spell.level)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Casting Time</span>
                    <span className="spell-card-stat-value">{formatCastingTime(spell.castingTime)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Range/Area</span>
                    <span className="spell-card-stat-value">{formatRange(spell.range, spell.targeting)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Components</span>
                    <span className="spell-card-stat-value">{formatComponents(spell.components)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Duration</span>
                    <span className="spell-card-stat-value">{formatDuration(spell.duration)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">School</span>
                    <span className="spell-card-stat-value">{spell.school}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Attack/Save</span>
                    <span className="spell-card-stat-value">{formatAttackSave(spell.effects)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Damage/Effect</span>
                    <span className="spell-card-stat-value">{formatDamageEffect(spell.effects)}</span>
                </div>
            </div>

            <div className="spell-card-divider"></div>

            <p className="spell-card-description">
                {spell.description}
            </p>

            {spell.higherLevels && (
                <p className="spell-card-description">
                    <strong>{spell.level === 0 ? 'Cantrip Upgrade.' : 'At Higher Levels.'}</strong> {spell.higherLevels}
                </p>
            )}

            {spell.components?.material && spell.components.materialDescription && (
                <p className="spell-card-material-note">
                    * - ({spell.components.materialDescription})
                </p>
            )}

            {spell.tags && spell.tags.length > 0 && (
                <div className="spell-card-tags-section">
                    <span className="spell-card-tags-label">Spell Tags:</span>
                    {spell.tags.map((tag, idx) => (
                        <span key={idx} className="spell-card-tag">{tag.toUpperCase()}</span>
                    ))}
                </div>
            )}

            {spell.classes && spell.classes.length > 0 && (
                <div className="spell-card-tags-section">
                    <span className="spell-card-tags-label">Available For:</span>
                    {spell.classes.map((cls, idx) => (
                        <span key={idx} className="spell-card-tag">{cls.toUpperCase()}</span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SpellCardTemplate;
