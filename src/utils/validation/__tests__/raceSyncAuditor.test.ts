/**
 * @file raceSyncAuditor.test.ts
 * Tests for the race synchronization auditor that compares character creator
 * races against glossary entries to identify mismatches and missing entries.
 */

import { describe, it, expect } from 'vitest';
import {
  auditRaceSync,
  RaceSyncAuditResult,
  RaceSyncIssue,
} from '../raceSyncAuditor';

describe('raceSyncAuditor', () => {
  /**
   * Test that the auditor function exists and returns the expected structure.
   * This is the most basic test to verify the module exports correctly.
   */
  it('returns an audit result with expected structure', () => {
    const result = auditRaceSync();

    // Verify the result has the expected shape
    expect(result).toHaveProperty('totalCharacterCreatorRaces');
    expect(result).toHaveProperty('totalGlossaryEntries');
    expect(result).toHaveProperty('missingGlossaryEntries');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('summary');

    // Types should be correct
    expect(typeof result.totalCharacterCreatorRaces).toBe('number');
    expect(typeof result.totalGlossaryEntries).toBe('number');
    expect(Array.isArray(result.missingGlossaryEntries)).toBe(true);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  /**
   * Test that the auditor correctly identifies the count of character creator races.
   * We expect at least 100 races based on our exploration (105 files).
   */
  it('reports correct count of character creator races', () => {
    const result = auditRaceSync();

    // We know there are ~105 character creator race files
    expect(result.totalCharacterCreatorRaces).toBeGreaterThanOrEqual(100);
  });

  /**
   * Test that the auditor correctly identifies the count of glossary entries.
   * We expect around 50 based on our exploration.
   */
  it('reports correct count of glossary entries', () => {
    const result = auditRaceSync();

    // We know there are ~50 glossary entry files
    expect(result.totalGlossaryEntries).toBeGreaterThanOrEqual(40);
  });

  /**
   * Test that the auditor identifies missing glossary entries.
   * We know there's a gap of ~55 races without glossary entries.
   */
  it('identifies missing glossary entries', () => {
    const result = auditRaceSync();

    // There should be missing entries (105 - 50 = ~55 missing)
    expect(result.missingGlossaryEntries.length).toBeGreaterThan(0);

    // Each missing entry should be a race ID string
    result.missingGlossaryEntries.forEach((raceId) => {
      expect(typeof raceId).toBe('string');
      expect(raceId.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test that issues have the correct structure.
   */
  it('issues have correct structure', () => {
    const result = auditRaceSync();

    // Each issue should have type, severity, raceId, and message
    result.issues.forEach((issue: RaceSyncIssue) => {
      expect(issue).toHaveProperty('type');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('raceId');
      expect(issue).toHaveProperty('message');

      // Type should be one of the expected values
      expect(['missing_glossary', 'id_mismatch', 'image_path_mismatch']).toContain(
        issue.type
      );

      // Severity should be one of the expected values
      expect(['error', 'warning', 'info']).toContain(issue.severity);
    });
  });

  /**
   * Test that the summary includes key statistics.
   */
  it('generates a human-readable summary', () => {
    const result = auditRaceSync();

    // Summary should mention counts
    expect(result.summary).toContain('character creator');
    expect(result.summary).toContain('glossary');

    // Summary should be non-empty
    expect(result.summary.length).toBeGreaterThan(50);
  });

  /**
   * Test that known races are correctly identified as present or missing.
   * 'elf' should have a glossary entry, 'high_elf' might not.
   */
  it('correctly identifies known race presence', () => {
    const result = auditRaceSync();

    // 'elf' has a glossary entry (elf.json exists)
    expect(result.missingGlossaryEntries).not.toContain('elf');

    // 'human' has a glossary entry (human.json exists)
    expect(result.missingGlossaryEntries).not.toContain('human');
  });
});
