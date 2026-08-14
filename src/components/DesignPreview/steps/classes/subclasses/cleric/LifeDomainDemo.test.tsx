import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import {
  getSubclassDemo,
  SUBCLASS_DEMO_REGISTRY,
} from '../..';
import {
  LifeDomainDemo,
  LIFE_DOMAIN_RUNTIME_BOUNDARY,
  createLifeDomainLevel2,
  createLifeDomainLevel3,
  getLifeDomainFeatures,
} from './LifeDomainDemo';

/**
 * This test proves the Life Domain leaf against canonical source and production
 * progression, then checks deterministic controls, reset, registry order, and the
 * honest missing-runtime boundary. Rendered 2D/3D and console proof remain deferred
 * until the Rules host mounts this domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Life Domain canonical progression pipeline', () => {
  it('resolves Life Domain through both canonical subclass helpers', () => {
    const lifeDomain = findSubclass(CLASSES_DATA.cleric.id, 'life_domain');

    expect(lifeDomain?.id).toBe('life_domain');
    expect(lifeDomain?.classId).toBe(CLASSES_DATA.cleric.id);
    expect(lifeDomain?.name).toBe('Life Domain');
    expect(subclassesForClass(CLASSES_DATA.cleric.id)).toContainEqual(lifeDomain);
    expect(lifeDomain?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'disciple_of_life', name: 'Disciple of Life', levelAvailable: 3 }),
        expect.objectContaining({ id: 'life_domain_spells', name: 'Domain Spells', levelAvailable: 3 }),
      ]),
    );
  });

  it('shows both Life Domain feature IDs absent at level 2 and present at level 3', () => {
    const level2 = createLifeDomainLevel2();
    const level3 = createLifeDomainLevel3(level2);
    const level2Features = getLifeDomainFeatures(level2).map(feature => feature.id);
    const level3Features = getLifeDomainFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('disciple_of_life');
    expect(level2Features).not.toContain('life_domain_spells');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('life_domain');
    expect(level3Features).toEqual(
      expect.arrayContaining(['disciple_of_life', 'life_domain_spells']),
    );
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.cleric, 3, 'life_domain').map(feature => feature.id),
    );
    expect(level3.class.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'disciple_of_life', name: 'Disciple of Life' }),
        expect.objectContaining({ id: 'life_domain_spells', name: 'Domain Spells' }),
      ]),
    );
  });

  it('uses performLevelUp for the explicit level-3 Life Domain choice', () => {
    const level2 = createLifeDomainLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'life_domain' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('life_domain');
    expect(productionLevel3.class.features.map(feature => feature.id)).toEqual(
      expect.arrayContaining(['disciple_of_life', 'life_domain_spells']),
    );
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Life Domain Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<LifeDomainDemo />);

    expect(screen.getByTestId('life-domain-level')).toHaveTextContent('2');
    expect(screen.getByTestId('life-domain-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('life-domain-feature-list')).not.toHaveTextContent('disciple_of_life');
    expect(screen.getByTestId('life-domain-feature-list')).not.toHaveTextContent('life_domain_spells');
    expect(screen.getByTestId('life-domain-grant-status')).toHaveTextContent(
      'disciple_of_life and life_domain_spells',
    );
    expect(screen.getByTestId('life-domain-transition-log')).toHaveTextContent('Level 1 → Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Life Domain / Level 3' }));
    expect(screen.getByTestId('life-domain-level')).toHaveTextContent('3');
    expect(screen.getByTestId('life-domain-subclass')).toHaveTextContent('Life Domain');
    expect(screen.getByTestId('life-domain-feature-list')).toHaveTextContent('disciple_of_life');
    expect(screen.getByTestId('life-domain-feature-list')).toHaveTextContent('Disciple of Life');
    expect(screen.getByTestId('life-domain-feature-list')).toHaveTextContent('life_domain_spells');
    expect(screen.getByTestId('life-domain-feature-list')).toHaveTextContent('Domain Spells');
    expect(screen.getByTestId('life-domain-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('life-domain-transition-log')).toHaveTextContent('life_domain');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('life-domain-level')).toHaveTextContent('2');
    expect(screen.getByTestId('life-domain-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('life-domain-feature-list')).not.toHaveTextContent('disciple_of_life');
    expect(screen.getByTestId('life-domain-feature-list')).not.toHaveTextContent('life_domain_spells');
  });

  it('appends Life Domain after the six prior class leaves and resolves it', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId)).toEqual([
      'champion',
      'battle_master',
      'berserker',
      'wild_heart',
      'college_of_lore',
      'college_of_valor',
      'life_domain',
      'light_domain',
      'circle_of_the_land',
      'circle_of_the_moon',
      'hunter',
      'beast_master',
      'thief',
      'assassin',
      'oath_of_devotion',
      'oath_of_vengeance',
      'open_hand',
      'shadow',
      'draconic',
      'wild_magic',
      'fiend',
      'archfey',
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('cleric', 'life_domain')?.label).toBe('Life Domain');
    expect(getSubclassDemo('cleric', 'life_domain')?.Component).toBe(LifeDomainDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<LifeDomainDemo />);

    expect(screen.getByTestId('life-domain-runtime-boundary')).toHaveTextContent(
      'no executable subclass-aware healing bonus',
    );
    expect(screen.getByTestId('life-domain-runtime-boundary')).toHaveTextContent(
      'no executable subclass-aware healing bonus or Life Domain prepared-spell transaction',
    );
    expect(screen.getByTestId('life-domain-runtime-boundary')).toHaveTextContent(
      'Generic healing and spell-list paths are not subclass proof',
    );
    expect(screen.getByTestId('life-domain-runtime-boundary')).toHaveTextContent(
      'does not simulate healing totals, prepared spells, resource spend, or combat results',
    );
    // The boundary may name unsupported outcomes, but it must not claim a fabricated
    // numeric heal, prepared-spell payload, or damage result.
    expect(LIFE_DOMAIN_RUNTIME_BOUNDARY).not.toMatch(/heals? \d+|prepared spells:|damage dealt/i);
    expect(screen.queryByRole('button', { name: /heal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prepare/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cast/i })).not.toBeInTheDocument();
  });
});
