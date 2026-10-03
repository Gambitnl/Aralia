import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  ARCHFEY_PATRON_RUNTIME_BOUNDARY,
  ArchfeyPatronDemo,
  createArchfeyPatronLevel2,
  createArchfeyPatronLevel3,
  FEY_PRESENCE_CONTRACT,
  getArchfeyPatronFeatures,
  getArchfeyPatronNativeAudit,
} from './ArchfeyPatronDemo';

/**
 * This test proves the Archfey Patron leaf from canonical subclass data through
 * production character creation, level-up, and player-to-combat conversion.
 * It audits the requested Fey Presence contract and proves the exact absence
 * boundary without treating generic conditions or area effects as subclass proof.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Warlock Archfey Patron canonical progression pipeline', () => {
  it('resolves the exact subclass id and canonical Steps of the Fey feature', () => {
    const archfey = findSubclass(CLASSES_DATA.warlock.id, 'archfey');

    expect(archfey?.id).toBe('archfey');
    expect(archfey?.classId).toBe(CLASSES_DATA.warlock.id);
    expect(archfey?.name).toBe('Archfey Patron');
    expect(subclassesForClass(CLASSES_DATA.warlock.id)).toContainEqual(archfey);
    expect(archfey?.features).toEqual([
      expect.objectContaining({
        id: 'steps_of_the_fey',
        name: 'Steps of the Fey',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows the canonical feature only after the explicit level-3 patron choice', () => {
    const level2 = createArchfeyPatronLevel2();
    const level3 = createArchfeyPatronLevel3(level2);
    const level2Features = getArchfeyPatronFeatures(level2).map(feature => feature.id);
    const level3Features = getArchfeyPatronFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('steps_of_the_fey');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('archfey');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.warlock, 3, 'archfey').map(feature => feature.id),
    );
    expect(level3Features).toContain('steps_of_the_fey');
  });

  it('uses production level-up and preserves the same fixture for the explicit patron choice', () => {
    const level2 = createArchfeyPatronLevel2();
    const level3 = createArchfeyPatronLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'archfey' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('archfey');
  });
});

// ============================================================================
// Native Fey Presence contract and exact boundary proof
// ============================================================================
describe('Archfey Patron native Fey Presence boundary', () => {
  it('records the requested action, area, save, outcomes, and resource exactly', () => {
    expect(FEY_PRESENCE_CONTRACT).toEqual({
      action: 'Action',
      area: '10-foot cube originating from you',
      save: 'Wisdom saving throw',
      outcomes: 'Choose Charmed or Frightened on a failed save',
      resource: 'Once per Short or Long Rest',
    });
  });

  it('does not mistake generic combat metadata for a Fey Presence transaction', () => {
    const level2Audit = getArchfeyPatronNativeAudit(createArchfeyPatronLevel2());
    const level3Audit = getArchfeyPatronNativeAudit(createArchfeyPatronLevel3());

    expect(level2Audit.hasFeyPresenceAbility).toBe(false);
    expect(level2Audit.hasFeyPresenceResource).toBe(false);
    expect(level3Audit.hasFeyPresenceAbility).toBe(false);
    expect(level3Audit.hasFeyPresenceResource).toBe(false);
    expect(level3Audit.hasStepsOfTheFeyAbility).toBe(false);
    expect(level3Audit.abilityIds).not.toContain('fey_presence');
    expect(level3Audit.limitedUseIds).not.toContain('fey_presence');
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary proof
// ============================================================================
describe('Archfey Patron Classes-domain registration', () => {
  it('renders canonical facts, the exact audit gap, and Reset', () => {
    render(<ArchfeyPatronDemo />);

    expect(screen.getByTestId('archfey-patron-level')).toHaveTextContent('2');
    expect(screen.getByTestId('archfey-patron-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('archfey-patron-feature-list')).not.toHaveTextContent('steps_of_the_fey');
    expect(screen.getByTestId('archfey-patron-action-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('archfey-patron-area-audit')).toHaveTextContent(FEY_PRESENCE_CONTRACT.area);
    expect(screen.getByTestId('archfey-patron-save-audit')).toHaveTextContent(FEY_PRESENCE_CONTRACT.save);
    expect(screen.getByTestId('archfey-patron-outcome-audit')).toHaveTextContent('Charmed or Frightened');
    expect(screen.getByTestId('archfey-patron-resource-audit')).toHaveTextContent(FEY_PRESENCE_CONTRACT.resource);
    expect(screen.getByTestId('archfey-patron-ability-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('archfey-patron-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Archfey / Level 3' }));
    expect(screen.getByTestId('archfey-patron-level')).toHaveTextContent('3');
    expect(screen.getByTestId('archfey-patron-subclass')).toHaveTextContent('Archfey Patron');
    expect(screen.getByTestId('archfey-patron-feature-list')).toHaveTextContent('steps_of_the_fey');
    expect(screen.getByTestId('archfey-patron-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('archfey-patron-transition-log')).toHaveTextContent(
      "subclassId: 'archfey'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('archfey-patron-level')).toHaveTextContent('2');
    expect(screen.getByTestId('archfey-patron-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('archfey-patron-feature-list')).not.toHaveTextContent('steps_of_the_fey');
  });

  it('appends Archfey Patron directly after Fiend Patron', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('warlock', 'archfey')?.label).toBe('Archfey Patron');
    expect(getSubclassDemo('warlock', 'archfey')?.Component).toBe(ArchfeyPatronDemo);
  });

  it('does not expose generic Fey Presence, condition, or area controls', () => {
    render(<ArchfeyPatronDemo />);

    expect(screen.getByTestId('archfey-patron-runtime-boundary')).toHaveTextContent(
      ARCHFEY_PATRON_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('archfey-patron-runtime-boundary')).toHaveTextContent(
      'Generic conditions, area-of-effect helpers, Wisdom saves',
    );
    expect(screen.queryAllByRole('button', { name: /fey presence|charm|frighten|wisdom save|area/i })).toHaveLength(0);
  });
});
