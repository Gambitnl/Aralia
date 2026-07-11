import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

// ============================================================================
// Bucket detail helpers
// ============================================================================
// The gate panel now has a bucket-specific branch for Range/Area. The purpose of
// this section is to turn the live spell JSON into a short geometry summary so the
// user can compare three things at once:
// - the normalized spell JSON
// - the validator-facing structured header display
// - the copied canonical source display
//
// This is intentionally not a full generic spell inspector. It exists so the
// current Range/Area normalization work can be reviewed inside the glossary
// without jumping between files and reports.
// ============================================================================

function formatGateMeasuredDistance(value: number, unit: 'feet' | 'miles' | 'inches' = 'feet'): string {
    if (unit === 'miles') {
        return `${value} ${value === 1 ? 'mile' : 'miles'}`;
    }

    if (unit === 'inches') {
        return `${value} ${value === 1 ? 'inch' : 'inches'}`;
    }

    return `${value} ft.`;
}

function formatGateSizeType(sizeType?: string): string {
    switch (sizeType) {
        case 'radius':
            return 'radius';
        case 'diameter':
            return 'diameter';
        case 'length':
            return 'length';
        case 'edge':
            return 'edge';
        case 'side':
            return 'side';
        case 'square':
            return 'square';
        default:
            return '';
    }
}

function formatRangeAreaGeometry(spell: SpellData | null): string | null {
    if (!spell?.range || !spell.targeting) return null;

    const parts: string[] = [];

    // Range answers "where can the cast be initiated or placed from?"
    // We keep that separate from the resulting geometry below so self-centered
    // bursts and point-origin zones do not collapse into one vague label.
    if (spell.range.type === 'self') {
        parts.push('range=self');
    } else if (spell.range.type === 'touch') {
        parts.push('range=touch');
    } else if (spell.range.type === 'ranged') {
        parts.push(`range=${formatGateMeasuredDistance(spell.range.distance ?? 0, spell.range.distanceUnit ?? 'feet')}`);
    } else {
        parts.push(`range=${spell.range.type}`);
    }

    parts.push(`targeting=${spell.targeting.type}`);

    // Area geometry is where most of this bucket lives. Keep the shape, size, and
    // "moves with caster" state visible because those are the main normalization
    // decisions now being reviewed.
    if (spell.targeting.areaOfEffect) {
        const area = spell.targeting.areaOfEffect;
        const sizePrefix = formatGateSizeType(area.sizeType);
        let areaLabel = `area=${area.shape}`;

        if (typeof area.size === 'number') {
            areaLabel += area.sizeType === 'square'
                ? ` ${area.size.toLocaleString('en-US')} sq. ft.`
                : ` ${sizePrefix ? `${sizePrefix} ` : ''}${formatGateMeasuredDistance(area.size, area.sizeUnit ?? 'feet')}`;
        }

        if (typeof area.height === 'number' && area.height > 0) {
            areaLabel += ` | height=${formatGateMeasuredDistance(area.height, area.heightUnit ?? 'feet')}`;
        }

        if (typeof area.width === 'number' && area.width > 0) {
            areaLabel += ` | width=${formatGateMeasuredDistance(area.width, area.widthUnit ?? 'feet')}`;
        }

        if (typeof area.thickness === 'number' && area.thickness > 0) {
            areaLabel += ` | thickness=${formatGateMeasuredDistance(area.thickness, area.thicknessUnit ?? 'feet')}`;
        }

        if (area.followsCaster) {
            areaLabel += ' (follows caster)';
        }

        parts.push(areaLabel);
    }

    // Risky geometry spells now expose extra forms and measured details. Keep
    // those visible in the gate checker so the reviewer can tell whether the
    // runtime JSON is actually carrying the pulled-apart variables or whether
    // the work is still stranded only in prose.
    const forms = spell.targeting.spatialDetails?.forms ?? [];
    if (forms.length > 0) {
        parts.push(`forms=${forms.length}:${forms.map((form) => form.label || form.shape).join(', ')}`);
    }

    const measuredDetails = spell.targeting.spatialDetails?.measuredDetails ?? [];
    if (measuredDetails.length > 0) {
        parts.push(`details=${measuredDetails.length}:${measuredDetails.map((detail) => detail.label).join(', ')}`);
    }

    return parts.join(' | ');
}

export const RangeAreaSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate, spellJsonData }) => {
    return (
        <>
                    {/* This bucket panel exists to make the current Range/Area normalization
                        pass reviewable inside the glossary. It shows the live JSON geometry,
                        the validator-facing structured header display, and the copied canonical
                        display side by side, plus a short interpretation of what kind of
                        mismatch this appears to be. */}
                    {gate.bucketDetails?.rangeArea && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Range/Area Bucket</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.rangeArea.summary)}
                                <li>- Problem statement: {gate.bucketDetails.rangeArea.problemStatement}</li>
                                <li>- Classification: {gate.bucketDetails.rangeArea.classification}</li>
                                <li>- Structured header: {gate.bucketDetails.rangeArea.structuredValue}</li>
                                <li>- Canonical display: {gate.bucketDetails.rangeArea.canonicalValue}</li>
                                {formatRangeAreaGeometry(spellJsonData) && (
                                    <li>- Current spell JSON: {formatRangeAreaGeometry(spellJsonData)}</li>
                                )}
                                {gate.bucketDetails.rangeArea.structuredBreakdown && (
                                    <li>
                                        - Parsed geometry facts: rangeType={gate.bucketDetails.rangeArea.structuredBreakdown.rangeType}
                                        {typeof gate.bucketDetails.rangeArea.structuredBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeArea.structuredBreakdown.rangeDistance}`
                                            : ''}
                                        {` | targetingType=${gate.bucketDetails.rangeArea.structuredBreakdown.targetingType}`}
                                        {gate.bucketDetails.rangeArea.structuredBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeArea.structuredBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeArea.structuredBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeArea.structuredBreakdown.areaSize}`
                                            : ''}
                                        {gate.bucketDetails.rangeArea.structuredBreakdown.followsCaster
                                            ? ' | followsCaster=true'
                                            : ''}
                                    </li>
                                )}
                                <li>- Interpretation: {gate.bucketDetails.rangeArea.interpretation}</li>
                                <li>- Review verdict: {gate.bucketDetails.rangeArea.reviewVerdict}</li>
                            </ul>
                        </div>
                    )}
                    {/* Canonical -> structured is only half of the Range/Area story.
                        The glossary spell card renders from runtime spell JSON, so this
                        second block answers the runtime question directly: is the live
                        spell JSON still behind the interpreted structured Range/Area
                        data for the currently selected spell? */}
                    {gate.bucketDetails?.rangeAreaRuntime && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Range/Area Runtime Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.rangeAreaRuntime.problemStatement)}
                                <li>- Classification: {gate.bucketDetails.rangeAreaRuntime.classification}</li>
                                <li>- Structured value: {gate.bucketDetails.rangeAreaRuntime.structuredValue || '(none)'}</li>
                                <li>- Current JSON value: {gate.bucketDetails.rangeAreaRuntime.currentJsonValue || '(none)'}</li>
                                {gate.bucketDetails.rangeAreaRuntime.structuredBreakdown && (
                                    <li>
                                        - Parsed structured facts: rangeType={gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeType ?? '(unknown)'}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistance}${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistanceUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistanceUnit}` : ''}`
                                            : ''}
                                        {gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSize}${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSizeUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSizeUnit}` : ''}`
                                            : ''}
                                    </li>
                                )}
                                {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown && (
                                    <li>
                                        - Parsed runtime facts: rangeType={gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeType}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistance}${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistanceUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistanceUnit}` : ''}`
                                            : ''}
                                        {` | targetingType=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.targetingType}`}
                                        {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSize}${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSizeUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSizeUnit}` : ''}`
                                            : ''}
                                        {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.followsCaster
                                            ? ' | followsCaster=true'
                                            : ''}
                                    </li>
                                )}
                                <li>- Structured matches current JSON: {gate.bucketDetails.rangeAreaRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                <li>- Explanation: {gate.bucketDetails.rangeAreaRuntime.explanation}</li>
                                <li>- Review verdict: {gate.bucketDetails.rangeAreaRuntime.reviewVerdict}</li>
                            </ul>
                        </div>
                    )}
        </>
    );
};
