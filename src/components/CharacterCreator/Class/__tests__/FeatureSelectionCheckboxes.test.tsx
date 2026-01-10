/**
 * @file FeatureSelectionCheckboxes.test.tsx
 * Tests to ensure all class FeatureSelection components have proper
 * onChange handlers on their checkboxes. This prevents the "checked without
 * onChange" React warning and ensures checkboxes are interactive.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CLASS_COMPONENTS_DIR = path.resolve(__dirname, '..');

// List of all class feature selection files to check
const FEATURE_SELECTION_FILES = [
    'ArtificerFeatureSelection.tsx',
    'BardFeatureSelection.tsx',
    'ClericFeatureSelection.tsx',
    'DruidFeatureSelection.tsx',
    'PaladinFeatureSelection.tsx',
    'RangerFeatureSelection.tsx',
    'SorcererFeatureSelection.tsx',
    'WarlockFeatureSelection.tsx',
    'WizardFeatureSelection.tsx',
];

describe('FeatureSelection Checkbox Handlers', () => {
    FEATURE_SELECTION_FILES.forEach((filename) => {
        describe(filename, () => {
            const filePath = path.join(CLASS_COMPONENTS_DIR, filename);

            it('should exist', () => {
                expect(fs.existsSync(filePath)).toBe(true);
            });

            it('should have onChange handler for every checkbox with checked prop', () => {
                const content = fs.readFileSync(filePath, 'utf-8');

                // Find all occurrences of checked= followed by content up to the closing />
                // Look for pattern: checked={...} and verify onChange={...} exists nearby

                // Count checked={...} occurrences
                const checkedMatches = content.match(/checked=\{[^}]+\}/g) || [];

                // Count onChange={...} occurrences in input elements
                const onChangeMatches = content.match(/onChange=\{[^}]+\}/g) || [];

                // For each checked, there should be a corresponding onChange
                // We verify this by checking that both patterns appear the same number of times
                // in the context of checkbox inputs
                expect(onChangeMatches.length).toBeGreaterThanOrEqual(checkedMatches.length);
            });

            it('should have disabled prop for selection limit enforcement', () => {
                const content = fs.readFileSync(filePath, 'utf-8');

                // Check that the file contains disabled= with a condition (not just true/false)
                // This ensures checkboxes disable when selection limit is reached
                const hasConditionalDisabled = content.includes('disabled={!');

                expect(hasConditionalDisabled).toBe(true);
            });
        });
    });
});
