import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  createWildMagicSorceryLevel2,
  createWildMagicSorceryLevel3,
  getWildMagicSorceryFeatures,
  getWildMagicSorceryNativeAudit,
  WILD_MAGIC_SORCERY_RUNTIME_BOUNDARY,
  WildMagicSorceryDemo,
} from './WildMagicSorceryDemo';

/**
 * This test proves Wild Magic Sorcery from canonical subclass data through the
 * production quick-character, level-up, and persistent-player-to-combat helpers.
 * It also proves that the UI exposes progression and the exact native absence
 * boundary rather than inventing a surge roll, table effect, or resource.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Sorcerer Wild Magic Sorcery canonical progression pipeline', () => {
  it('resolves the exact subclass id and canonical feature ids', () => {
    const wildMagic = findSubclass(CLASSES_DATA.sorcerer.id, 'wild_magic');

    expect(wildMagic?.id).toBe('wild_magic');
    expect(wildMagic?.classId).toBe(CLASSES_DATA.sorcerer.id);
    expect(wildMagic?.name).toBe('Wild Magic Sorcery');
    expect(subclassesForClass(CLASSES_DATA.sorcerer.id)).toContainEqual(wildMagic);
    expect(wildMagic?.features).toEqual([
      expect.objectContaining({
        id: 'wild_magic_surge',
        name: 'Wild Magic Surge',
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'tides_of_chaos',
        name: 'Tides of Chaos',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows both Wild Magic feature grants only after the explicit level-3 choice', () => {
    const level2 = createWildMagicSorceryLevel2();
    const level3 = createWildMagicSorceryLevel3(level2);
    const level2Features = getWildMagicSorceryFeatures(level2).map(feature => feature.id);
    const level3Features = getWildMagicSorceryFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('wild_magic_surge');
    expect(level2Features).not.toContain('tides_of_chaos');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('wild_magic');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.sorcerer, 3, 'wild_magic').map(feature => feature.id),
    );
    expect(level3Features).toEqual(expect.arrayContaining(['wild_magic_surge', 'tides_of_chaos']));
  });

  it('uses production level-up and preserves the same fixture for the explicit choice', () => {
    const level2 = createWildMagicSorceryLevel2();
    const level3 = createWildMagicSorceryLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'wild_magic' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('wild_magic');
  });
});

// ============================================================================
// Native metadata and exact boundary proof
// ============================================================================
describe('Wild Magic Sorcery native metadata boundary', () => {
  it('does not mistake generic combat metadata for a Wild Magic transaction', () => {
    const level2Audit = getWildMagicSorceryNativeAudit(createWildMagicSorceryLevel2());
    const level3Audit = getWildMagicSorceryNativeAudit(createWildMagicSorceryLevel3());

    expect(level2Audit.hasWildMagicSurgeAbility).toBe(false);
    expect(level2Audit.hasTidesOfChaosAbility).toBe(false);
    expect(level2Audit.hasSubclassResource).toBe(false);
    expect(level3Audit.hasWildMagicSurgeAbility).toBe(false);
    expect(level3Audit.hasTidesOfChaosAbility).toBe(false);
    expect(level3Audit.hasSubclassResource).toBe(false);
    expect(level3Audit.abilityIds).not.toContain('wild_magic_surge');
    expect(level3Audit.abilityIds).not.toContain('tides_of_chaos');
    expect(level3Audit.spellbookIds).toEqual(expect.any(Array));
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary
// ============================================================================
describe('Wild Magic Sorcery Classes-domain registration', () => {
  it('renders canonical facts, native absence output, transition log, and Reset', () => {
    render(<WildMagicSorceryDemo />);

    expect(screen.getByTestId('wild-magic-level')).toHaveTextContent('2');
    expect(screen.getByTestId('wild-magic-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('wild-magic-feature-list')).not.toHaveTextContent('wild_magic_surge');
    expect(screen.getByTestId('wild-magic-surge-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('wild-magic-tides-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('wild-magic-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Wild Magic / Level 3' }));
    expect(screen.getByTestId('wild-magic-level')).toHaveTextContent('3');
    expect(screen.getByTestId('wild-magic-subclass')).toHaveTextContent('Wild Magic Sorcery');
    expect(screen.getByTestId('wild-magic-feature-list')).toHaveTextContent('wild_magic_surge');
    expect(screen.getByTestId('wild-magic-feature-list')).toHaveTextContent('tides_of_chaos');
    expect(screen.getByTestId('wild-magic-grant-status')).toHaveTextContent('Canonical grants present');
    expect(screen.getByTestId('wild-magic-transition-log')).toHaveTextContent(
      "subclassId: 'wild_magic'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('wild-magic-level')).toHaveTextContent('2');
    expect(screen.getByTestId('wild-magic-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('wild-magic-feature-list')).not.toHaveTextContent('wild_magic_surge');
  });

  it('appends Wild Magic Sorcery directly after Draconic Sorcery', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('sorcerer', 'wild_magic')?.label).toBe('Wild Magic Sorcery');
    expect(getSubclassDemo('sorcerer', 'wild_magic')?.Component).toBe(WildMagicSorceryDemo);
  });

  it('shows the exact partial-runtime boundary without fake controls or outcomes', () => {
    render(<WildMagicSorceryDemo />);

    expect(screen.getByTestId('wild-magic-runtime-boundary')).toHaveTextContent(
      WILD_MAGIC_SORCERY_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('wild-magic-runtime-boundary')).toHaveTextContent(
      'spell-cast trigger check, deterministic d20 roll, Wild Magic table lookup, effect resolution',
    );
    expect(screen.getByTestId('wild-magic-runtime-boundary')).toHaveTextContent(
      'Tides advantage application, resource payment, surge replacement, or short/long-rest reset',
    );
    expect(screen.queryAllByRole('button', { name: /surge|tides|roll|cast|advantage/i })).toHaveLength(0);
  });
});
