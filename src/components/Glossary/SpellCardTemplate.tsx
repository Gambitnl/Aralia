// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 06/04/2026, 03:47:23
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/GlossaryEntryPanel.tsx, components/Glossary/index.ts, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import GlossaryTooltip from './GlossaryTooltip';

/**
 * Spell data structure from V2 JSON schema
 * This interface represents the spell JSON format used in public/data/spells/level-{N}/*.json
 */
type DistanceUnit = 'feet' | 'miles' | 'inches';
type SpatialMeasuredUnit = DistanceUnit | 'gallons' | 'minutes';
type GeometrySizeType = 'radius' | 'diameter' | 'length' | 'edge' | 'side';

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
        distanceUnit?: DistanceUnit;
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
        range?: number;
        rangeUnit?: DistanceUnit;
        areaOfEffect?: {
            shape: string;
            size: number;
            sizeType?: GeometrySizeType;
            sizeUnit?: DistanceUnit;
            height?: number;
            heightUnit?: DistanceUnit;
            followsCaster?: boolean;
            thickness?: number;
            thicknessUnit?: DistanceUnit;
            width?: number;
            widthUnit?: DistanceUnit;
            shapeVariant?: {
                options: string[];
                default: string;
            };
            triggerZone?: {
                triggerDistance?: number;
                triggerSide?: string;
            };
        };
        spatialDetails?: {
            forms?: Array<{
                label?: string;
                shape: string;
                size?: number;
                sizeType?: GeometrySizeType;
                sizeUnit?: DistanceUnit;
                height?: number;
                heightUnit?: DistanceUnit;
                width?: number;
                widthUnit?: DistanceUnit;
                thickness?: number;
                thicknessUnit?: DistanceUnit;
                segmentCount?: number;
                segmentWidth?: number;
                segmentWidthUnit?: DistanceUnit;
                segmentHeight?: number;
                segmentHeightUnit?: DistanceUnit;
                notes?: string;
            }>;
            measuredDetails?: Array<{
                label: string;
                kind: string;
                subject?: string;
                value?: number;
                unit?: SpatialMeasuredUnit;
                qualifier?: string;
                notes?: string;
            }>;
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
    referencedRules?: Array<{
        label: string;
        description: string;
        glossaryTermId?: string;
    }>;
    onNavigateToGlossary?: (termId: string) => void;
}

interface ReferencedRuleChipRecord {
    label: string;
    description: string;
    glossaryTermId?: string;
}

// ============================================================================
// Range And Area Formatting
// ============================================================================
// The spell JSON is moving away from "all geometry is secretly feet" toward an
// explicit unit-bearing model. These helpers keep the glossary readable during
// that migration by honoring explicit units when present and falling back to the
// old implicit-feet convention when a spell has not been backfilled yet.
// ============================================================================

/**
 * Render a measured spell distance in player-facing text.
 *
 * Why it exists:
 * The old glossary hard-coded "ft." everywhere. That worked for most of the
 * current corpus, but it made the runtime layer weaker than the structured and
 * canonical layers whenever mile-based, inch-based, or future non-default
 * distances appear.
 */
const formatMeasuredDistance = (value: number, unit: DistanceUnit = 'feet'): string => {
    if (unit === 'miles') {
        return `${value} ${value === 1 ? 'mile' : 'miles'}`;
    }

    if (unit === 'inches') {
        return `${value} ${value === 1 ? 'inch' : 'inches'}`;
    }

    return `${value} ft.`;
};

/**
 * Render one measured value from the additive spatial-details lane.
 *
 * Why it exists:
 * risky spells now pull out a few geometry-adjacent facts that are not strictly
 * distances, such as gallons of water or minutes needed to clear rubble. The
 * spell card should keep those values explicit instead of flattening them back
 * into prose notes.
 */
const formatMeasuredValue = (value: number, unit: SpatialMeasuredUnit): string => {
    if (unit === 'gallons') {
        return `${value} ${value === 1 ? 'gallon' : 'gallons'}`;
    }

    if (unit === 'minutes') {
        return `${value} ${value === 1 ? 'minute' : 'minutes'}`;
    }

    return formatMeasuredDistance(value, unit);
};

/**
 * Render the meaning of the main scalar on a spatial form.
 *
 * Why it exists:
 * a spell card can show `20`, but that is only useful if the player also knows
 * whether the number means radius, diameter, wall length, or square edge.
 */
const formatSizeTypeLabel = (sizeType?: GeometrySizeType): string => {
    switch (sizeType) {
        case 'radius':
            return 'Radius';
        case 'diameter':
            return 'Diameter';
        case 'length':
            return 'Length';
        case 'edge':
            return 'Edge';
        case 'side':
            return 'Side';
        default:
            return 'Size';
    }
};

/**
 * Turn one explicit spatial form into readable spell-card text.
 *
 * Why it exists:
 * risky spells now store alternate walls, globes, disks, and other forms as
 * separate structured records. This helper keeps those records legible without
 * forcing the spell card back into one flattened "Range/Area" string.
 */
const formatSpatialForm = (form: NonNullable<NonNullable<SpellData['targeting']>['spatialDetails']>['forms'][number]): string => {
    const parts: string[] = [];

    if (form.label) {
        parts.push(`${form.label} (${form.shape})`);
    } else {
        parts.push(form.shape);
    }

    if (form.size != null) {
        parts.push(`${formatSizeTypeLabel(form.sizeType)} ${formatMeasuredDistance(form.size, form.sizeUnit ?? 'feet')}`);
    }

    if (form.height != null) {
        parts.push(`Height ${formatMeasuredDistance(form.height, form.heightUnit ?? 'feet')}`);
    }

    if (form.width != null) {
        parts.push(`Width ${formatMeasuredDistance(form.width, form.widthUnit ?? 'feet')}`);
    }

    if (form.thickness != null) {
        parts.push(`Thickness ${formatMeasuredDistance(form.thickness, form.thicknessUnit ?? 'feet')}`);
    }

    if (form.segmentCount != null) {
        parts.push(`Segments ${form.segmentCount}`);
    }

    if (form.segmentWidth != null) {
        parts.push(`Segment Width ${formatMeasuredDistance(form.segmentWidth, form.segmentWidthUnit ?? 'feet')}`);
    }

    if (form.segmentHeight != null) {
        parts.push(`Segment Height ${formatMeasuredDistance(form.segmentHeight, form.segmentHeightUnit ?? 'feet')}`);
    }

    if (form.notes) {
        parts.push(form.notes);
    }

    return parts.join(' | ');
};

/**
 * Turn one extra spatial measurement into readable spell-card text.
 *
 * Why it exists:
 * details like "blocked by 1 inch of metal" or "passes through a 1-inch opening"
 * matter to gameplay, but they do not belong inside the main area shape. This
 * helper keeps those rules visible once they have been pulled out of prose.
 */
const formatMeasuredDetail = (detail: NonNullable<NonNullable<SpellData['targeting']>['spatialDetails']>['measuredDetails'][number]): string => {
    const parts: string[] = [detail.label];

    if (detail.subject) {
        parts.push(detail.subject);
    }

    if (detail.value != null && detail.unit) {
        parts.push(formatMeasuredValue(detail.value, detail.unit));
    } else if (detail.value != null) {
        parts.push(String(detail.value));
    }

    if (detail.qualifier) {
        parts.push(detail.qualifier);
    }

    if (detail.notes) {
        parts.push(detail.notes);
    }

    return parts.join(': ');
};

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
 * For melee blade cantrips (range.type: "self" but targeting.range exists), show the weapon reach
 * Extended to display new AoE shapes and semantic properties
 */
const formatRange = (range?: SpellData['range'], targeting?: SpellData['targeting']): string => {
    if (!range) return 'Self';

    // Handle melee blade cantrips: range is "self" but targeting.range specifies weapon reach
    if (range.type === 'self') {
        if (targeting?.range) {
            return formatMeasuredDistance(targeting.range, targeting.rangeUnit ?? range.distanceUnit ?? 'feet');
        }
        return 'Self';
    }
    if (range.type === 'touch') return 'Touch';
    if (range.type === 'sight') return 'Sight';
    if (range.type === 'unlimited') return 'Unlimited';

    let result = range.distance != null
        ? formatMeasuredDistance(range.distance, range.distanceUnit ?? 'feet')
        : range.type;

    // Add area of effect if present
    if (targeting?.areaOfEffect) {
        const { shape, size, sizeType, sizeUnit, followsCaster, shapeVariant, triggerZone } = targeting.areaOfEffect;

        // Shape emoji mapping (extended with new shapes)
        const shapeEmoji: Record<string, string> = {
            'Sphere': '🌐',
            'Cone': '📐',
            'Cube': '⬜',
            'Line': '➖',
            'Cylinder': '🛢️',
            'Square': '⬛',
            'Emanation': '🔄',
            'Wall': '🧱',
            'Hemisphere': '🏠',
            'Ring': '⭕'
        };

        let aoeLabel = `${formatSizeTypeLabel(sizeType)} ${formatMeasuredDistance(size, sizeUnit ?? 'feet')} ${shapeEmoji[shape] || shape}`;

        // Add semantic notes for extended AoE types
        if (followsCaster) aoeLabel += ' (follows caster)';
        if (shapeVariant) aoeLabel += ` [${shapeVariant.options.join(' or ')}]`;
        if (triggerZone?.triggerSide === 'one') aoeLabel += ' (one side)';

        result += ` (${aoeLabel})`;
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
 * Uses tags, targeting.type, and range.type to determine melee vs ranged attacks
 */
const formatAttackSave = (
    effects?: SpellData['effects'],
    tags?: string[],
    targeting?: SpellData['targeting'],
    range?: SpellData['range']
): string => {
    if (!effects || effects.length === 0) return 'None';

    for (const effect of effects) {
        if (effect.condition?.type === 'hit') {
            // Determine if this is a melee or ranged attack
            // Check tags first (most reliable indicator)
            if (tags?.includes('melee')) return 'Melee';
            // Check targeting type
            if (targeting?.type === 'melee') return 'Melee';
            // Check range type
            if (range?.type === 'ranged' || (range?.distance && range.distance > 10)) return 'Ranged';
            // Self-range with targeting.range typically means melee weapon reach
            if (range?.type === 'self' && targeting?.range) return 'Melee';
            // Default to Ranged for spell attacks without melee indicators
            return 'Ranged';
        }
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
 * Escape user/data text before putting it into a regular expression.
 *
 * Why it exists:
 * The referenced-rule labels come from data, not hardcoded source. If we want to
 * find terms like "Sphere" or future multi-word labels safely inside spell prose,
 * we need to escape any regex characters first instead of assuming the label is
 * plain text.
 */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Render spell prose while upgrading referenced-rule terms into chip-styled glossary links.
 *
 * Why it exists:
 * The owner explicitly wants the rule term to live inside the spell description text,
 * not only as a detached metadata row. This helper keeps the prose readable while
 * turning exact referenced-rule matches (for example "sphere") into the same chip-like
 * glossary links used elsewhere in the UI.
 *
 * What it preserves:
 * - the original sentence order and punctuation
 * - the rest of the spell description text as plain prose
 * - the existing glossary tooltip/navigation behavior through GlossaryTooltip
 *
 * Current limitation:
 * - matching is exact text replacement on the visible prose. If the JSON prose uses a
 *   very different synonym than the canonical referenced-rule label, the inline chip
 *   will not appear until the prose or the rule label is aligned.
 */
const renderDescriptionWithRuleChips = (
    text: string,
    referencedRules: ReferencedRuleChipRecord[],
    onNavigateToGlossary?: (termId: string) => void,
): React.ReactNode => {
    if (!text) return text;
    if (!referencedRules || referencedRules.length === 0) return text;

    const sortedRules = [...referencedRules].sort((a, b) => b.label.length - a.label.length);
    const pattern = new RegExp(`\\b(${sortedRules.map((rule) => escapeRegex(rule.label)).join('|')})\\b`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, index) => {
        const matchedRule = sortedRules.find((rule) => rule.label.toLowerCase() === part.toLowerCase());
        if (!matchedRule) {
            return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
        }

        const chip = (
            <button
                key={`rule-chip-${matchedRule.glossaryTermId || matchedRule.label}-${index}`}
                type="button"
                className="spell-card-tag inline-flex align-middle mx-0.5 cursor-pointer hover:bg-sky-700/60 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
                {matchedRule.label}
            </button>
        );

        if (matchedRule.glossaryTermId) {
            return (
                <GlossaryTooltip
                    key={`rule-tooltip-${matchedRule.glossaryTermId}-${index}`}
                    termId={matchedRule.glossaryTermId}
                    onNavigateToGlossary={onNavigateToGlossary}
                >
                    {chip}
                </GlossaryTooltip>
            );
        }

        // DEBT: The enrichment generator is supposed to supply a glossaryTermId for every
        // referenced rule. If one is still missing, we keep the chip styling so the prose
        // still signals "this is a rule concept," but it will not navigate anywhere yet.
        return chip;
    });
};

/**
 * This helper renders the rule-reference chips used inside the spell metadata rows.
 *
 * Why it exists:
 * Canonical spell pages can reference rules like Sphere or Concentration. The
 * owner wants those references visible on the spell card, but grouped with the
 * spell's existing tags rather than stranded in a separate metadata block.
 */
const SpellReferencedRuleChips: React.FC<{
    referencedRules: NonNullable<SpellCardTemplateProps['referencedRules']>;
    onNavigateToGlossary?: (termId: string) => void;
}> = ({ referencedRules, onNavigateToGlossary }) => {
    if (!referencedRules || referencedRules.length === 0) return null;

    return (
        <>
            {referencedRules.map((rule) => {
                const tagChipText = (rule.glossaryTermId || '').endsWith('_area')
                    ? `Area: ${rule.label}`
                    : rule.label;
                const chip = (
                    <button
                        key={`${rule.glossaryTermId || rule.label}-chip`}
                        type="button"
                        className="spell-card-tag cursor-pointer hover:bg-sky-700/60 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    >
                        {tagChipText}
                    </button>
                );

                // If the enrichment data knows which glossary entry owns this rule, use the
                // existing glossary tooltip/navigation component so spell cards behave like
                // the rest of the glossary surface instead of inventing a separate UX.
                if (rule.glossaryTermId) {
                    return (
                        <GlossaryTooltip
                            key={`${rule.glossaryTermId}-tooltip`}
                            termId={rule.glossaryTermId}
                            onNavigateToGlossary={onNavigateToGlossary}
                        >
                            {chip}
                        </GlossaryTooltip>
                    );
                }

                // DEBT: If a referenced rule still has no glossary term id, we degrade to a
                // plain non-navigating chip. The enrichment generator is meant to eliminate this
                // state by either resolving or generating a destination entry.
                return chip;
            })}
        </>
    );
};

/**
 * SpellCardTemplate - Renders a spell card from JSON data
 * 
 * This component renders the same visual output as the markdown spell cards,
 * using the spell-card CSS classes for consistency.
 * 
 * Template structure matches scripts/add_spell.js lines 66-134
 */
const SpellCardTemplate: React.FC<SpellCardTemplateProps> = ({
    spell,
    referencedRules = [],
    onNavigateToGlossary,
}) => {
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
                    <span className="spell-card-stat-value">{formatAttackSave(spell.effects, spell.tags, spell.targeting, spell.range)}</span>
                </div>
                <div className="spell-card-stat">
                    <span className="spell-card-stat-label">Damage/Effect</span>
                    <span className="spell-card-stat-value">{formatDamageEffect(spell.effects)}</span>
                </div>
            </div>

            <div className="spell-card-divider"></div>

            <p className="spell-card-description">
                {renderDescriptionWithRuleChips(spell.description, referencedRules, onNavigateToGlossary)}
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

            {(spell.targeting?.spatialDetails?.forms?.length || spell.targeting?.spatialDetails?.measuredDetails?.length) ? (
                <div className="spell-card-tags-section">
                    <span className="spell-card-tags-label">Spatial Details:</span>
                    {spell.targeting?.spatialDetails?.forms?.map((form, idx) => (
                        <span key={`spatial-form-${idx}`} className="spell-card-tag">
                            {formatSpatialForm(form)}
                        </span>
                    ))}
                    {spell.targeting?.spatialDetails?.measuredDetails?.map((detail, idx) => (
                        <span key={`spatial-detail-${idx}`} className="spell-card-tag">
                            {formatMeasuredDetail(detail)}
                        </span>
                    ))}
                </div>
            ) : null}

            {(spell.tags && spell.tags.length > 0) || referencedRules.length > 0 ? (
                <div className="spell-card-tags-section">
                    <span className="spell-card-tags-label">Spell Tags:</span>
                    {spell.tags?.map((tag, idx) => (
                        <span key={idx} className="spell-card-tag">{tag.toUpperCase()}</span>
                    ))}
                    <SpellReferencedRuleChips
                        referencedRules={referencedRules}
                        onNavigateToGlossary={onNavigateToGlossary}
                    />
                </div>
            ) : null}

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
