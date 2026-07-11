/**
 * This file tests the glossary spell gate hook in isolation.
 *
 * The hook now combines three sources of truth:
 * 1. the spell manifest
 * 2. the live spell JSON schema validator
 * 3. the generated public spell gate artifact
 *
 * These tests keep that merge behavior stable so the glossary dev surface can
 * trust the gate results it renders for each spell entry.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSpellGateChecks } from '../useSpellGateChecks';
import currentMagicMissileJson from '../../../public/data/spells/level-1/magic-missile.json';

// The hook owns result merging, while spellGateBootstrap owns optional local
// artifact loading. Mock that boundary directly so clean CI and local machines
// exercise the same deterministic report inputs without requiring ignored
// `.agent/roadmap-local` files to exist on disk.
const mockFetchSpellGateBootstrap = vi.hoisted(() => vi.fn());
vi.mock('../../components/Glossary/spellGateChecker/spellGateBootstrap', () => ({
  fetchSpellGateBootstrap: mockFetchSpellGateBootstrap,
}));

// ============================================================================
// Mock wiring
// ============================================================================
// This section replaces the raw markdown imports and network helper so the hook
// can run in a small deterministic test environment.
// ============================================================================

vi.mock('../../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw', () => ({ default: '**Magic Missile**' }));
vi.mock('../../../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw', () => ({ default: '**Magic Missile**' }));
vi.mock('../../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw', () => ({ default: '' }));
vi.mock('../../../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw', () => ({ default: '' }));
vi.mock('../../../.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json', () => ({
  default: {
    mismatches: [
      {
        spellId: 'magic-missile',
        field: 'Sub-Classes',
        structuredValue: 'Warlock - Fiend Patron',
        canonicalValue: 'Cleric - Order Domain (TCoE), Warlock - Fiend Patron',
        summary: 'Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.',
      },
      {
        spellId: 'magic-missile',
        field: 'Casting Time',
        structuredValue: '1 Action',
        canonicalValue: '1 Action *',
        summary: 'Canonical display appends a trigger-style footnote marker.',
      },
      {
        spellId: 'magic-missile',
        field: 'Description',
        mismatchKind: 'missing-canonical-field',
        structuredValue: 'You create three glowing darts of magical force.',
        canonicalValue: '',
        summary: 'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
      },
      {
        spellId: 'magic-missile',
        field: 'Components',
        structuredValue: 'V, S, M *',
        canonicalValue: 'V, S, M **',
        summary: 'Magic Missile records Components differently in the structured block and the canonical snapshot.',
      },
    ],
  },
}));
vi.mock('../../../../.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json', () => ({
  default: {
    mismatches: [
      {
        spellId: 'magic-missile',
        field: 'Sub-Classes',
        structuredValue: 'Warlock - Fiend Patron',
        canonicalValue: 'Cleric - Order Domain (TCoE), Warlock - Fiend Patron',
        summary: 'Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.',
      },
      {
        spellId: 'magic-missile',
        field: 'Casting Time',
        structuredValue: '1 Action',
        canonicalValue: '1 Action *',
        summary: 'Canonical display appends a trigger-style footnote marker.',
      },
      {
        spellId: 'magic-missile',
        field: 'Description',
        mismatchKind: 'missing-canonical-field',
        structuredValue: 'You create three glowing darts of magical force.',
        canonicalValue: '',
        summary: 'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
      },
      {
        spellId: 'magic-missile',
        field: 'Components',
        structuredValue: 'V, S, M *',
        canonicalValue: 'V, S, M **',
        summary: 'Magic Missile records Components differently in the structured block and the canonical snapshot.',
      },
    ],
  },
}));
vi.mock('../../../.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json', () => ({
  default: {
    mismatches: [
      {
        spellId: 'magic-missile',
        field: 'Description',
        mismatchKind: 'missing-json-field',
        structuredValue: 'You create three glowing darts of magical force.',
        jsonValue: '',
        summary: 'Magic Missile still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
      },
    ],
  },
}));
vi.mock('../../../../.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json', () => ({
  default: {
    mismatches: [
      {
        spellId: 'magic-missile',
        field: 'Description',
        mismatchKind: 'missing-json-field',
        structuredValue: 'You create three glowing darts of magical force.',
        jsonValue: '',
        summary: 'Magic Missile still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
      },
    ],
  },
}));

// Hoist the network spy for the same reason as the bootstrap spy: Vitest moves
// module mock factories above ordinary declarations, and the restored tests
// must not depend on factory-evaluation timing to receive their live JSON.
const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('../../utils/networkUtils', () => ({
  fetchWithTimeout: (url: string) => mockFetch(url),
}));
vi.mock('../../../components/Glossary/spellGateChecker/../../../utils/networkUtils', () => ({
  fetchWithTimeout: (url: string) => mockFetch(url),
}));
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../components/Glossary/spellGateChecker/../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.stubGlobal('import.meta', { env: { BASE_URL: '/' } });

// ============================================================================
// Test fixtures
// ============================================================================
// This section uses a current-schema Magic Missile payload so the hook exercises
// the same validation rules the real glossary now depends on.
// ============================================================================

const manifest = {
  'magic-missile': {
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    path: '/data/spells/level-1/magic-missile.json',
  },
};

const fidelity = {
  spells: {
    'magic-missile': {
      state: 'analyzed_clean',
      gaps: [],
      notes: 'No known combat-system behavior gaps in this test fixture.',
      lastAuditDate: '2026-03-24',
    },
  },
};

const spellJson = {
  // Begin with the checked-in production payload so this restored schema test
  // evolves with required targeting/effect fields instead of preserving a
  // second, silently stale copy of the spell schema in test code.
  ...currentMagicMissileJson,
  classes: ['Cleric', 'Wizard'],
  subClasses: ['Warlock - Fiend Patron'],
  subClassesVerification: 'verified',
  components: {
    ...currentMagicMissileJson.components,
    verbal: true,
    somatic: true,
    material: false,
  },
  // This fixture intentionally models the outstanding structured-to-runtime
  // description gap asserted below, while every unrelated schema field stays
  // inherited from the current checked-in spell payload.
  description: '',
};

const spellGateArtifact = {
  generatedAt: '2026-03-24T14:30:33.045Z',
  spellCount: 1,
  spells: {
    'magic-missile': {
      spellId: 'magic-missile',
      spellName: 'Magic Missile',
      level: 1,
      jsonPath: 'public/data/spells/level-1/magic-missile.json',
      schema: {
        valid: true,
        issues: [],
      },
      localData: {
        classesCount: 2,
        subClassesCount: 0,
        subClassesVerification: 'verified',
        flags: [],
      },
      canonicalReview: {
        state: 'mismatch',
        generatedAt: '2026-03-23T13:54:02.602Z',
        mismatchCount: 4,
        mismatchFields: ['Sub-Classes', 'Casting Time', 'Description', 'Components'],
        mismatchSummaries: [
          'Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.',
          'Canonical display appends a trigger-style footnote marker.',
          'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
          'Magic Missile records Components differently in the structured block and the canonical snapshot.',
        ],
      },
      structuredJsonReview: {
        state: 'mismatch',
        generatedAt: '2026-03-24T14:30:33.045Z',
        mismatchCount: 1,
        mismatchFields: ['Description'],
        mismatchSummaries: [
          'Magic Missile still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
        ],
      },
    },
  },
};

// These are the optional local report payloads the bootstrap normally imports
// from ignored `.agent` files. Keeping the exact mismatch fields in the test
// fixture lets clean CI prove every bucket classification without filesystem
// state becoming a hidden prerequisite.
const structuredCanonicalReport = {
  mismatches: [
    {
      spellId: 'magic-missile',
      field: 'Sub-Classes',
      structuredValue: 'Warlock - Fiend Patron',
      canonicalValue: 'Cleric - Order Domain (TCoE), Warlock - Fiend Patron',
      summary: 'Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.',
    },
    {
      spellId: 'magic-missile',
      field: 'Casting Time',
      structuredValue: '1 Action',
      canonicalValue: '1 Action *',
      summary: 'Canonical display appends a trigger-style footnote marker.',
    },
    {
      spellId: 'magic-missile',
      field: 'Description',
      mismatchKind: 'missing-canonical-field',
      structuredValue: 'You create three glowing darts of magical force.',
      canonicalValue: '',
      summary: 'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
    },
    {
      spellId: 'magic-missile',
      field: 'Components',
      structuredValue: 'V, S, M *',
      canonicalValue: 'V, S, M **',
      summary: 'Magic Missile records Components differently in the structured block and the canonical snapshot.',
    },
  ],
};

const structuredJsonReport = {
  mismatches: [
    {
      spellId: 'magic-missile',
      field: 'Description',
      mismatchKind: 'missing-json-field',
      structuredValue: 'You create three glowing darts of magical force.',
      jsonValue: '',
      summary: 'Magic Missile still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
    },
  ],
};

// ============================================================================
// Hook behavior checks
// ============================================================================
// These assertions prove that the hook still recognizes markdown gap flags while
// also carrying through the richer spell-truth artifact details.
// ============================================================================

// Production still loads optional local reports through a Vite-ignored dynamic
// import and falls back cleanly when they are absent. This test mocks the
// bootstrap boundary itself, so local and CI runs receive the same report data
// without changing that production fallback contract.
// The focused fixtures above preserve the optional reports' exact mismatch
// shapes without requiring a new production injection API.
describe('useSpellGateChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSpellGateBootstrap.mockResolvedValue({
      manifest,
      fidelity,
      gateArtifact: spellGateArtifact,
      knownGaps: new Set(['magic-missile']),
      structuredCanonicalReport,
      structuredJsonReport,
    });
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('spells_manifest.json')) return manifest;
      if (url.includes('spells_fidelity.json')) return fidelity;
      if (url.includes('spell_gate_report.json')) return spellGateArtifact;
      // The bootstrap data above is mocked at its public boundary, so the only
      // remaining network request made by the hook is the manifest entry's live
      // spell payload. Returning that payload as the bounded fallback keeps this
      // fixture independent of assetUrl's environment-specific path prefix.
      return spellJson;
    });
  });

  it('merges schema checks, legacy gap knowledge, and spell-truth artifact warnings', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.status).toBe('gap');
    expect(gate.checklist.spellJsonValid).toBe(true);
    expect(gate.checklist.noKnownGaps).toBe(true);
    expect(gate.checklist.classAccessVerified).toBe(true);
    expect(gate.checklist.canonicalTopLevelAligned).toBe(false);
    expect(gate.reasons).toContain('Canonical review mismatches: Sub-Classes, Casting Time, Description, Components');
    expect(gate.issueSummaries).toContain('Sub-Classes: Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.');
    expect(gate.issueSummaries).toContain('Structured -> JSON mismatches: Description');
    expect(gate.spellTruth?.canonicalMismatchFields).toEqual(['Sub-Classes', 'Casting Time', 'Description', 'Components']);
    expect(gate.bucketDetails?.castingTime).toMatchObject({
      structuredValue: '1 Action',
      canonicalValue: '1 Action *',
      summary: 'Canonical display appends a trigger-style footnote marker.',
      classification: 'trigger_footnote_display',
      interpretation: 'The canonical page adds a footnote marker to signal trigger context, while the structured data stores that context separately instead of keeping the raw source marker.',
      baseCastingTime: '1 action',
      ritual: false,
      ritualCastingTime: undefined,
    });
  });

  it('classifies description audit-shape residue as a bucket detail instead of a generic prose failure', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.bucketDetails?.description).toEqual({
      structuredValue: 'You create three glowing darts of magical force.',
      canonicalValue: '',
      summary: 'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
      classification: 'audit_shape_residue',
      interpretation: 'Canonical prose is likely present under raw Rules Text, but the audit did not derive a directly comparable canonical Description field.',
    });
  });

  it('adds a separate description runtime review when the spell JSON is still missing text the structured layer already has', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.bucketDetails?.descriptionRuntime).toEqual({
      structuredValue: 'You create three glowing darts of magical force.',
      currentJsonValue: '',
      summary: 'Magic Missile still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
      problemStatement: 'The structured spell block has Description text, but the runtime spell JSON is still missing its Description value.',
      classification: 'missing_runtime_description',
      reviewVerdict: 'Copy the structured Description into the runtime spell JSON so the glossary spell card is no longer missing spell prose.',
      explanation: 'This is real implementation drift because the glossary renders from the runtime spell JSON, not from the structured markdown block.',
    });
  });

  it('classifies repeated-base canonical subclass evidence separately from real subclass drift', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.bucketDetails?.subClasses).toEqual({
      structuredValue: 'Warlock - Fiend Patron',
      canonicalValue: 'Cleric - Order Domain (TCoE), Warlock - Fiend Patron',
      summary: 'Magic Missile records Sub-Classes differently in the structured block and the canonical snapshot.',
      classification: 'repeated_base_normalization',
      interpretation: "The canonical snapshot preserves subclass/domain lines whose base classes are already present in the spell's base class list. The normalized structured data intentionally omits those repeated-base entries to satisfy the current validator policy.",
      currentClasses: ['Cleric', 'Wizard'],
      currentSubClasses: ['Warlock - Fiend Patron'],
      verificationState: 'verified',
      repeatedBaseEntries: ['Cleric - Order Domain (TCoE)'],
      canonicalOnlyEntries: ['Cleric - Order Domain (TCoE)'],
      structuredOnlyEntries: [],
      malformedEntries: [],
    });
  });

  it('classifies component footnote-marker residue separately from true component drift', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.bucketDetails?.components).toEqual({
      structuredValue: 'V, S, M *',
      canonicalValue: 'V, S, M **',
      summary: 'The V/S/M letters still match (V, S, M), but the canonical page uses a different component footnote marker than the structured header.',
      classification: 'footnote_marker_residue',
      interpretation: 'The structured header is storing the same component facts, but the canonical display uses a different footnote marker because the source page also assigns \'*\' to another note lane. This is source-display residue, not a disagreement about which components the spell requires.',
      reviewVerdict: 'The actual V/S/M requirement still matches. The mismatch is only in how the source labels the material footnote.',
      structuredLetters: 'V, S, M',
      canonicalLetters: 'V, S, M',
      lettersMatch: true,
      currentJsonValue: 'V, S',
      materialRequired: false,
      materialDescription: '',
    });
  });

  it('adds a separate components runtime review when the runtime spell JSON still differs from the structured component header', async () => {
    const { result } = renderHook(() => useSpellGateChecks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const gate = result.current.results['magic-missile'];
    expect(gate.bucketDetails?.componentsRuntime).toEqual({
      structuredValue: 'V, S, M *',
      currentJsonValue: 'V, S',
      summary: 'The canonical Components review is already active for this spell, so this runtime lane checks whether the structured V/S/M header still matches the live spell JSON.',
      problemStatement: 'The structured Components line still differs from the runtime spell JSON for this spell.',
      classification: 'real_runtime_drift',
      reviewVerdict: 'Review the structured component header against the runtime spell JSON and update the JSON if the structured layer now carries the intended V/S/M requirement.',
      explanation: 'This is real implementation drift until the glossary-facing runtime JSON carries the same component facts as the interpreted structured layer.',
      structuredMatchesJson: false,
      structuredLetters: 'V, S, M',
      jsonLetters: 'V, S',
      lettersMatch: false,
      materialRequired: false,
      materialDescription: '',
    });
  });
});
