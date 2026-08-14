import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  createFiendPatronLevel2,
  createFiendPatronLevel3,
  FIEND_PATRON_RUNTIME_BOUNDARY,
  getFiendPatronFeatures,
  getFiendPatronNativeAudit,
  FiendPatronDemo,
} from './FiendPatronDemo';

/**
 * This test proves the Fiend Patron leaf from canonical subclass data through the
 * production quick-character, level-up, and player-to-combat conversion helpers.
 * It audits Dark One's Blessing's event boundary, amount formula, patron binding,
 * and Reset without treating generic temporary HP or generic downing as proof.
 * Rendered 2D/3D and console proof remain deferred until the Rules host mounts
 * Classes, and the missing hostile-target guard prevents a fake kill control here.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Warlock Fiend Patron canonical progression pipeline', () => {
  it('resolves the exact subclass id and Dark One feature through both helpers', () => {
    const fiend = findSubclass(CLASSES_DATA.warlock.id, 'fiend');

    expect(fiend?.id).toBe('fiend');
    expect(fiend?.classId).toBe(CLASSES_DATA.warlock.id);
    expect(fiend?.name).toBe('Fiend Patron');
    expect(subclassesForClass(CLASSES_DATA.warlock.id)).toContainEqual(fiend);
    expect(fiend?.features).toEqual([
      expect.objectContaining({
        id: 'dark_ones_blessing',
        name: "Dark One's Blessing",
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows the Dark One feature only after the explicit level-3 patron choice', () => {
    const level2 = createFiendPatronLevel2();
    const level3 = createFiendPatronLevel3(level2);
    const level2Features = getFiendPatronFeatures(level2).map(feature => feature.id);
    const level3Features = getFiendPatronFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('dark_ones_blessing');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('fiend');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.warlock, 3, 'fiend').map(feature => feature.id),
    );
    expect(level3Features).toContain('dark_ones_blessing');
  });

  it('uses production level-up and preserves the same fixture for the explicit patron choice', () => {
    const level2 = createFiendPatronLevel2();
    const level3 = createFiendPatronLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'fiend' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('fiend');
  });
});

// ============================================================================
// Native binding, formula, event audit, and explicit gap proof
// ============================================================================
describe("Fiend Patron native Dark One's Blessing audit", () => {
  it('binds only the level-3 Fiend combat character and resolves the source formula', () => {
    const level2Audit = getFiendPatronNativeAudit(createFiendPatronLevel2());
    const level3Audit = getFiendPatronNativeAudit(createFiendPatronLevel3());

    expect(level2Audit.combatClassId).toBe('warlock');
    expect(level2Audit.hasFiendBinding).toBe(false);
    expect(level2Audit.boundTemporaryHitPoints).toBeUndefined();
    expect(level3Audit.combatClassId).toBe('warlock');
    expect(level3Audit.hasFiendBinding).toBe(true);
    expect(level3Audit.formulaMatches).toBe(true);
    expect(level3Audit.boundTemporaryHitPoints).toBe(level3Audit.expectedTemporaryHitPoints);
    expect(level3Audit.formula).toContain('Charisma modifier');
    expect(level3Audit.formula).toContain('Warlock level 3');
  });

  it('records the native positive-to-zero event boundary but refuses incomplete hostile proof', () => {
    const audit = getFiendPatronNativeAudit(createFiendPatronLevel3());

    expect(audit.nativeEventBoundary).toContain('positive target HP -> post-damage 0 HP');
    expect(audit.hasHostileTargetGuard).toBe(false);
    expect(FIEND_PATRON_RUNTIME_BOUNDARY).toContain('target.team !== caster.team');
    expect(FIEND_PATRON_RUNTIME_BOUNDARY).toContain('does not expose a deterministic kill/downing control');
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary proof
// ============================================================================
describe('Fiend Patron Classes-domain registration', () => {
  it('renders canonical facts, the exact audit gap, and Reset', () => {
    render(<FiendPatronDemo />);

    expect(screen.getByTestId('fiend-patron-level')).toHaveTextContent('2');
    expect(screen.getByTestId('fiend-patron-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('fiend-patron-feature-list')).not.toHaveTextContent('dark_ones_blessing');
    expect(screen.getByTestId('fiend-patron-binding-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('fiend-patron-hostile-guard-audit')).toHaveTextContent('Missing');
    expect(screen.getByTestId('fiend-patron-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Fiend / Level 3' }));
    expect(screen.getByTestId('fiend-patron-level')).toHaveTextContent('3');
    expect(screen.getByTestId('fiend-patron-subclass')).toHaveTextContent('Fiend Patron');
    expect(screen.getByTestId('fiend-patron-feature-list')).toHaveTextContent('dark_ones_blessing');
    expect(screen.getByTestId('fiend-patron-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('fiend-patron-binding-audit')).toHaveTextContent('Present');
    expect(screen.getByTestId('fiend-patron-formula-audit')).toHaveTextContent('=');
    expect(screen.getByTestId('fiend-patron-transition-log')).toHaveTextContent(
      "subclassId: 'fiend'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('fiend-patron-level')).toHaveTextContent('2');
    expect(screen.getByTestId('fiend-patron-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('fiend-patron-feature-list')).not.toHaveTextContent('dark_ones_blessing');
    expect(screen.getByTestId('fiend-patron-binding-audit')).toHaveTextContent('Not present');
  });

  it('appends Fiend Patron directly after Wild Magic Sorcery', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('warlock', 'fiend')?.label).toBe('Fiend Patron');
    expect(getSubclassDemo('warlock', 'fiend')?.Component).toBe(FiendPatronDemo);
  });

  it('does not expose a generic kill, downing, or temporary-HP control while the guard is missing', () => {
    render(<FiendPatronDemo />);

    expect(screen.getByTestId('fiend-patron-runtime-boundary')).toHaveTextContent(
      FIEND_PATRON_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('fiend-patron-runtime-boundary')).toHaveTextContent(
      'hostile-target guard',
    );
    expect(screen.queryAllByRole('button', { name: /kill|down|damage|temp hp|grant/i })).toHaveLength(0);
  });
});
