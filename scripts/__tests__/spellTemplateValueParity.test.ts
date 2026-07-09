/**
 * This file tests the value-set comparison helper used by the spell template validator.
 *
 * The validator already knew whether structured fields and JSON paths were mapped,
 * but it could still miss a more dangerous failure: both templates referring to the
 * same field while allowing different vocabularies for that field. These tests keep
 * that coverage in place so "template contract is clean" means the two layers agree
 * on the non-prose values they allow.
 *
 * Called by: Vitest
 * Depends on: scripts/spellTemplateValueParity.ts
 */

import { describe, expect, it } from 'vitest';
import { compareAcceptedValueSets } from '../spellTemplateValueParity';
import {
  validateTemplateParity,
  type TemplateContract,
  type ValidationIssue,
} from '../validateSpellTemplateContracts';

// ============================================================================
// Value-Set Alignment
// ============================================================================
// This section covers the small pure helper that tells the validator whether a
// mapped structured/runtime field pair agrees on its legal enum vocabulary.
// ============================================================================

describe('compareAcceptedValueSets', () => {
  it('treats the same values as aligned even when casing differs', () => {
    const comparison = compareAcceptedValueSets('Area Shape', ['Cube', 'Sphere'], ['cube', 'sphere']);

    expect(comparison).toBeNull();
  });

  it('reports values that exist in only one side of the mapped template pair', () => {
    const comparison = compareAcceptedValueSets(
      'Effect Type',
      ['DAMAGE', 'UTILITY', 'BUFF'],
      ['DAMAGE', 'UTILITY'],
    );

    expect(comparison).toEqual({
      fieldName: 'Effect Type',
      structuredOnly: ['BUFF'],
      runtimeOnly: [],
    });
  });
});

// ============================================================================
// Contract Validation Regression
// ============================================================================
// The pure helper agreeing is not enough: the validator has to actually surface
// the divergence as a template contract error. This section drives the value-set
// check through validateTemplateParity so a mapped structured/runtime field pair
// that permits different vocabularies fails the contract, while a field explicitly
// declared as a narrowing runtime subset stays clean.
// ============================================================================

describe('validateTemplateParity accepted-value divergence', () => {
  const structuredTemplate: TemplateContract = {
    schemaVersion: 1,
    templateKind: 'spell-structured-template',
    fields: [
      { label: 'Effect Type', acceptedValues: ['damage', 'healing', 'utility', 'buff'] },
      { label: 'Cast Unit', acceptedValues: ['seconds', 'minutes', 'hours'] },
    ],
  };

  it('flags a mapped field pair whose runtime template narrows the vocabulary without declaring a subset', () => {
    const jsonTemplate: TemplateContract = {
      schemaVersion: 1,
      templateKind: 'spell-json-template',
      fields: [
        { path: 'effect.type', structuredLabel: 'Effect Type', acceptedValues: ['damage', 'healing'] },
      ],
    };

    const issues: ValidationIssue[] = [];
    validateTemplateParity(structuredTemplate, jsonTemplate, issues);

    const divergence = issues.filter((issue) => issue.code === 'template-accepted-values-diverge');
    expect(divergence).toHaveLength(1);
    expect(divergence[0]).toMatchObject({
      severity: 'error',
      source: 'template-parity',
      field: 'Effect Type',
    });
    expect(divergence[0].actualValue).toContain('buff');
    expect(divergence[0].actualValue).toContain('utility');
  });

  it('accepts a mapped field explicitly declared as a runtime subset', () => {
    const jsonTemplate: TemplateContract = {
      schemaVersion: 1,
      templateKind: 'spell-json-template',
      fields: [
        {
          path: 'casting.unit',
          structuredLabel: 'Cast Unit',
          acceptedValues: ['minutes', 'hours'],
          acceptedValueParity: 'runtime_subset_ok',
        },
      ],
    };

    const issues: ValidationIssue[] = [];
    validateTemplateParity(structuredTemplate, jsonTemplate, issues);

    expect(issues.filter((issue) => issue.code === 'template-accepted-values-diverge')).toHaveLength(0);
  });
});
