/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 07/05/2026, 00:03:31
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/GlossaryEntryPanel.tsx, components/Glossary/index.ts, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
/**
 * Spell data structure from V2 JSON schema
 * This interface represents the spell JSON format used in public/data/spells/level-{N}/*.json
 */
type DistanceUnit = 'feet' | 'miles' | 'inches';
type SpatialMeasuredUnit = DistanceUnit | 'gallons' | 'minutes';
type GeometrySizeType = 'radius' | 'diameter' | 'length' | 'edge' | 'side' | 'square';
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
        combatCost?: {
            type: string;
        };
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
        damage?: {
            dice: string;
            type: string;
        };
        condition?: {
            type: string;
            saveType?: string;
        };
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
/**
 * SpellCardTemplate - Renders a spell card from JSON data
 *
 * This component renders the same visual output as the markdown spell cards,
 * using the spell-card CSS classes for consistency.
 *
 * Template structure matches scripts/add_spell.js lines 66-134
 */
declare const SpellCardTemplate: React.FC<SpellCardTemplateProps>;
export default SpellCardTemplate;
