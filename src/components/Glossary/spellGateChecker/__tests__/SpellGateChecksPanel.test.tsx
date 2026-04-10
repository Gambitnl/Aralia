import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpellGateChecksPanel } from '../SpellGateChecksPanel';
import type { GateResult } from '../useSpellGateChecks';
import type { GlossaryEntry } from '../../../../types';

const selectedEntry: GlossaryEntry = {
  id: 'spell-entry',
  title: 'Spell Entry',
  category: 'Spells',
  filePath: '/spells/spell-entry.md',
};

function renderPanel(gate: GateResult) {
  const gateWithSpellTruth = {
    ...gate,
    spellTruth: gate.spellTruth ?? {
      localFlags: [],
      canonicalMismatchFields: [],
      canonicalMismatchSummaries: [],
      structuredJsonMismatchFields: [],
      structuredJsonMismatchSummaries: [],
    },
  } as GateResult;

  return render(
    <SpellGateChecksPanel
      selectedEntry={selectedEntry}
      gateResults={{ 'spell-entry': gateWithSpellTruth }}
      spellJsonData={null}
    />,
  );
}

describe('SpellGateChecksPanel', () => {
  it('shows the basic checklist and failure messaging for a failing spell gate', () => {
    renderPanel({
      status: 'fail',
      reasons: ['Spell JSON not found'],
      issueSummaries: ['Spell JSON could not be loaded for this glossary entry.'],
      level: 3,
      checklist: { manifestPathOk: true, spellJsonExists: false, spellJsonValid: false, noKnownGaps: true },
    });

    expect(screen.getByText(/Spell Gate Checks/)).toBeInTheDocument();
    expect(screen.getByText(/What is wrong:/)).toBeInTheDocument();
    expect(screen.getAllByText(/Spell JSON not found/).length).toBeGreaterThan(0);
  });

  it('renders description review details from the description bucket', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Canonical review mismatches: Description'],
      issueSummaries: ['Description: Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.'],
      level: 2,
      checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: true },
      bucketDetails: {
        description: {
          structuredValue: 'You create three glowing darts of magical force.',
          canonicalValue: '',
          summary: 'Magic Missile has structured Description data, but the canonical snapshot does not currently expose a comparable Description value.',
          classification: 'audit_shape_residue',
          interpretation: 'Canonical prose is likely present under raw Rules Text, but the audit did not derive a directly comparable canonical Description field.',
        },
      },
    });

    expect(screen.getByText('Description Review')).toBeInTheDocument();
    expect(screen.getByText(/Informational/)).toBeInTheDocument();
    expect(screen.getByText(/audit_shape_residue/)).toBeInTheDocument();
    expect(screen.getAllByText(/raw Rules Text/).length).toBeGreaterThan(0);
  });

  it('renders description runtime review details when runtime JSON is behind', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Structured -> JSON mismatches: Description'],
      issueSummaries: ['Description Runtime: The structured spell block has Description text, but the runtime spell JSON is still missing its Description value.'],
      level: 2,
      checklist: {
        manifestPathOk: true,
        spellJsonExists: true,
        spellJsonValid: true,
        noKnownGaps: true,
        structuredJsonAligned: false,
      },
      bucketDetails: {
        descriptionRuntime: {
          structuredValue: 'You create three glowing darts of magical force.',
          currentJsonValue: '',
          summary: 'Spell Entry still has structured Description data, but the runtime spell JSON does not currently store a comparable Description value.',
          problemStatement: 'The structured spell block has Description text, but the runtime spell JSON is still missing its Description value.',
          classification: 'missing_runtime_description',
          reviewVerdict: 'Copy the structured Description into the runtime spell JSON so the glossary spell card is no longer missing spell prose.',
          explanation: 'This is real implementation drift because the glossary renders from the runtime spell JSON, not from the structured markdown block.',
        },
      },
    });

    expect(screen.getByText('Description Runtime Review')).toBeInTheDocument();
    expect(screen.getByText(/missing_runtime_description/)).toBeInTheDocument();
    expect(screen.getByText(/Copy the structured Description into the runtime spell JSON/i)).toBeInTheDocument();
  });

  it('renders subclass review details from the sub-classes bucket', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Canonical review mismatches: Sub-Classes'],
      issueSummaries: ['Sub-Classes: Spell Entry records Sub-Classes differently in the structured block and the canonical snapshot.'],
      level: 1,
      checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: true },
      bucketDetails: {
        subClasses: {
          structuredValue: 'Warlock - Fiend Patron',
          canonicalValue: 'Cleric - Order Domain (TCoE), Warlock - Fiend Patron',
          summary: 'Spell Entry records Sub-Classes differently in the structured block and the canonical snapshot.',
          classification: 'repeated_base_normalization',
          interpretation: "The canonical snapshot preserves subclass/domain lines whose base classes are already present in the spell's base class list. The normalized structured data intentionally omits those repeated-base entries to satisfy the current validator policy.",
          currentClasses: ['Cleric', 'Wizard'],
          currentSubClasses: ['Warlock - Fiend Patron'],
          verificationState: 'verified',
          repeatedBaseEntries: ['Cleric - Order Domain (TCoE)'],
          canonicalOnlyEntries: ['Cleric - Order Domain (TCoE)'],
          structuredOnlyEntries: [],
          malformedEntries: [],
        },
      },
    });

    expect(screen.getByText('Sub-Classes Review')).toBeInTheDocument();
    expect(screen.getByText(/repeated_base_normalization/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cleric - Order Domain \(TCoE\)/).length).toBeGreaterThan(0);
  });

  it('renders components review and runtime review details', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Canonical review mismatches: Components'],
      issueSummaries: ['Components: The V/S/M letters still match (V, M), but the canonical page uses a different component footnote marker than the structured header.'],
      level: 1,
      checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: true },
      bucketDetails: {
        components: {
          structuredValue: 'V, M *',
          canonicalValue: 'V, M **',
          summary: 'The V/S/M letters still match (V, M), but the canonical page uses a different component footnote marker than the structured header.',
          classification: 'footnote_marker_residue',
          interpretation: 'The structured header is storing the same component facts, but the canonical display uses a different footnote marker because the source page also assigns \'*\' to another note lane. This is source-display residue, not a disagreement about which components the spell requires.',
          reviewVerdict: 'The actual V/S/M requirement still matches. The mismatch is only in how the source labels the material footnote.',
          structuredLetters: 'V, M',
          canonicalLetters: 'V, M',
          lettersMatch: true,
          currentJsonValue: 'V, M | material=a small feather or piece of down | cost=0 gp | consumed=false',
          materialRequired: true,
          materialDescription: 'a small feather or piece of down',
        },
        componentsRuntime: {
          structuredValue: 'V, M *',
          currentJsonValue: 'V, M | material=a small feather or piece of down | cost=0 gp | consumed=false',
          summary: 'The canonical Components review is already active for this spell, so this runtime lane checks whether the structured V/S/M header still matches the live spell JSON.',
          problemStatement: 'The structured Components line and the runtime spell JSON are carrying the same V/S/M facts. The remaining difference is only how the runtime layer decomposes those facts.',
          classification: 'model_display_boundary',
          reviewVerdict: 'Treat this as a runtime display/model boundary unless the project later decides the structured header must round-trip the decomposed JSON format exactly.',
          explanation: 'The structured layer stores one compact V/S/M header, while the runtime spell JSON stores separate booleans plus material metadata. That storage-shape difference does not mean the app is using the wrong component facts.',
          structuredMatchesJson: false,
          structuredLetters: 'V, M',
          jsonLetters: 'V, M',
          lettersMatch: true,
          materialRequired: true,
          materialDescription: 'a small feather or piece of down',
        },
      },
    });

    expect(screen.getByText('Components Review')).toBeInTheDocument();
    expect(screen.getByText(/Subbucket: footnote_marker_residue/)).toBeInTheDocument();
    expect(screen.getAllByText(/footnote_marker_residue/)).toHaveLength(2);
    expect(screen.getByText('Components Runtime Review')).toBeInTheDocument();
    expect(screen.getByText(/Subbucket: model_display_boundary/)).toBeInTheDocument();
    expect(screen.getAllByText(/model_display_boundary/)).toHaveLength(2);
  });

  it('renders material component review details', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Canonical review mismatches: Material Component'],
      issueSummaries: ['Material Component: Spell Entry records Material Component differently in the structured block and the canonical snapshot.'],
      level: 4,
      checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: true },
      bucketDetails: {
        materialComponent: {
          structuredValue: '* - (incense worth 25+ GP)',
          canonicalValue: '* - (incense worth 25+ GP, which the spell consumes)',
          summary: 'Spell Entry records Material Component differently in the structured block and the canonical snapshot.',
          problemStatement: 'The canonical material note adds an explicit consumed-state clause that is missing from the structured material note text.',
          classification: 'consumed_state_drift',
          interpretation: 'The canonical material note explicitly says the spell consumes the component, while the structured material line does not carry that clause. The live JSON consumed flag below shows whether the runtime spell data already captured that fact.',
          currentJsonValue: 'material=true | description=incense worth 25+ GP | cost=25 gp | consumed=true',
          materialRequired: true,
          materialDescription: 'incense worth 25+ GP',
          materialCostGp: 25,
          consumed: true,
          canonicalComparableField: true,
          canonicalCostGp: 25,
          canonicalConsumed: true,
          normalizedStructuredNote: 'incense worth 25+ GP',
          normalizedCanonicalNote: 'incense worth 25+ GP',
          descriptionAligned: true,
          costAligned: true,
          consumedAligned: true,
        },
      },
    });

    expect(screen.getByText('Material Component Review')).toBeInTheDocument();
    expect(screen.getByText(/consumed_state_drift/)).toBeInTheDocument();
    expect(screen.getByText(/Consumed by spell: Yes/)).toBeInTheDocument();
  });

  it('renders material component runtime review details', () => {
    renderPanel({
      status: 'gap',
      reasons: ['Structured JSON mismatches: Material Component'],
      issueSummaries: ['Material Component Runtime: The structured Material Component line and the runtime spell JSON disagree about whether the component is consumed by the spell.'],
      level: 4,
      checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: true },
      bucketDetails: {
        materialComponent: {
          structuredValue: '* - (incense worth 25+ GP, which the spell consumes)',
          canonicalValue: '* - (incense worth 25+ GP, which the spell consumes)',
          summary: 'The canonical material note and the structured material note currently agree.',
          problemStatement: 'The canonical material note and the structured material note currently agree.',
          classification: 'consumed_state_drift',
          interpretation: 'No canonical drift is present for the material note itself in this fixture.',
          currentJsonValue: '* - (incense worth 25+ GP)',
          materialRequired: true,
          materialDescription: 'incense worth 25+ GP',
          materialCostGp: 25,
          consumed: false,
          canonicalComparableField: true,
          canonicalCostGp: 25,
          canonicalConsumed: true,
          normalizedStructuredNote: 'incense worth 25+ GP',
          normalizedCanonicalNote: 'incense worth 25+ GP',
          descriptionAligned: true,
          costAligned: true,
          consumedAligned: false,
        },
        materialComponentRuntime: {
          structuredValue: '* - (incense worth 25+ GP, which the spell consumes)',
          currentJsonValue: '* - (incense worth 25+ GP)',
          summary: 'The structured and runtime material notes still differ on whether the component is consumed.',
          problemStatement: 'The structured Material Component line and the runtime spell JSON disagree about whether the component is consumed by the spell.',
          classification: 'consumed_state_runtime_drift',
          reviewVerdict: 'Update the runtime JSON consumed flag or material note so the glossary spell card reflects the same consumed-state the structured layer now carries.',
          explanation: 'This is real implementation drift because consumed-state changes the practical meaning of the material requirement.',
          structuredMatchesJson: false,
          structuredMaterialRequired: true,
          jsonMaterialRequired: true,
          structuredDescription: 'incense worth 25+ GP',
          jsonDescription: 'incense worth 25+ GP',
          structuredCostGp: 25,
          jsonCostGp: 25,
          structuredConsumed: true,
          jsonConsumed: false,
          descriptionAligned: true,
          costAligned: true,
          consumedAligned: false,
        },
      },
    });

    expect(screen.getByText('Material Component Runtime Review')).toBeInTheDocument();
    expect(screen.getByText(/consumed_state_runtime_drift/)).toBeInTheDocument();
    expect(screen.getByText(/Runtime JSON consumed-state: No/)).toBeInTheDocument();
  });
});
