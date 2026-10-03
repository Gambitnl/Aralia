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
  LightDomainDemo,
  LIGHT_DOMAIN_RUNTIME_BOUNDARY,
  createLightDomainLevel2,
  createLightDomainLevel3,
  getLightDomainFeatures,
} from './LightDomainDemo';

/**
 * This test proves Light Domain from canonical source through production progression,
 * then checks deterministic controls, registry order, and the honest missing-runtime
 * boundary. Rendered 2D/3D and console proof remain deferred until Rules mounts this
 * domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Light Domain canonical progression pipeline', () => {
  it('resolves Light Domain through both canonical subclass helpers', () => {
    const lightDomain = findSubclass(CLASSES_DATA.cleric.id, 'light_domain');

    expect(lightDomain?.id).toBe('light_domain');
    expect(lightDomain?.classId).toBe(CLASSES_DATA.cleric.id);
    expect(lightDomain?.name).toBe('Light Domain');
    expect(subclassesForClass(CLASSES_DATA.cleric.id)).toContainEqual(lightDomain);
    expect(lightDomain?.features).toEqual([
      expect.objectContaining({
        id: 'warding_flare',
        name: 'Warding Flare',
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'light_domain_spells',
        name: 'Domain Spells',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows both Light Domain feature IDs absent at level 2 and present at level 3', () => {
    const level2 = createLightDomainLevel2();
    const level3 = createLightDomainLevel3(level2);
    const level2Features = getLightDomainFeatures(level2).map(feature => feature.id);
    const level3Features = getLightDomainFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('warding_flare');
    expect(level2Features).not.toContain('light_domain_spells');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('light_domain');
    expect(level3Features).toEqual(
      expect.arrayContaining(['warding_flare', 'light_domain_spells']),
    );
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.cleric, 3, 'light_domain').map(feature => feature.id),
    );
    expect(level3.class.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'warding_flare', name: 'Warding Flare' }),
        expect.objectContaining({ id: 'light_domain_spells', name: 'Domain Spells' }),
      ]),
    );
  });

  it('uses performLevelUp for the explicit level-3 Light Domain choice', () => {
    const level2 = createLightDomainLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'light_domain' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('light_domain');
    expect(productionLevel3.class.features.map(feature => feature.id)).toEqual(
      expect.arrayContaining(['warding_flare', 'light_domain_spells']),
    );
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Light Domain Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<LightDomainDemo />);

    expect(screen.getByTestId('light-domain-level')).toHaveTextContent('2');
    expect(screen.getByTestId('light-domain-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('light-domain-feature-list')).not.toHaveTextContent('warding_flare');
    expect(screen.getByTestId('light-domain-feature-list')).not.toHaveTextContent('light_domain_spells');
    expect(screen.getByTestId('light-domain-grant-status')).toHaveTextContent(
      'warding_flare and light_domain_spells',
    );
    expect(screen.getByTestId('light-domain-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Light Domain / Level 3' }));
    expect(screen.getByTestId('light-domain-level')).toHaveTextContent('3');
    expect(screen.getByTestId('light-domain-subclass')).toHaveTextContent('Light Domain');
    expect(screen.getByTestId('light-domain-feature-list')).toHaveTextContent('warding_flare');
    expect(screen.getByTestId('light-domain-feature-list')).toHaveTextContent('Warding Flare');
    expect(screen.getByTestId('light-domain-feature-list')).toHaveTextContent('light_domain_spells');
    expect(screen.getByTestId('light-domain-feature-list')).toHaveTextContent('Domain Spells');
    expect(screen.getByTestId('light-domain-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('light-domain-transition-log')).toHaveTextContent('light_domain');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('light-domain-level')).toHaveTextContent('2');
    expect(screen.getByTestId('light-domain-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('light-domain-feature-list')).not.toHaveTextContent('warding_flare');
    expect(screen.getByTestId('light-domain-feature-list')).not.toHaveTextContent('light_domain_spells');
  });

  it('appends Light Domain after the seven prior class leaves and resolves it', () => {
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
    expect(getSubclassDemo('cleric', 'light_domain')?.label).toBe('Light Domain');
    expect(getSubclassDemo('cleric', 'light_domain')?.Component).toBe(LightDomainDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<LightDomainDemo />);

    expect(screen.getByTestId('light-domain-runtime-boundary')).toHaveTextContent(
      'no executable subclass-aware Warding Flare reaction',
    );
    expect(screen.getByTestId('light-domain-runtime-boundary')).toHaveTextContent(
      'no executable subclass-aware Warding Flare reaction, attack-disadvantage, resource-spend, or Light Domain prepared-spell transaction',
    );
    expect(screen.getByTestId('light-domain-runtime-boundary')).toHaveTextContent(
      'Generic reaction economy and spell-list paths are not subclass proof',
    );
    expect(screen.getByTestId('light-domain-runtime-boundary')).toHaveTextContent(
      'does not grant feature IDs for them',
    );
    expect(screen.getByTestId('light-domain-runtime-boundary')).toHaveTextContent(
      'does not simulate reaction choice, resource spend, prepared spells, damage, or combat results',
    );
    // The boundary may name unsupported outcomes, but it must not claim a fabricated
    // numeric attack result, prepared-spell payload, damage result, or resource total.
    expect(LIGHT_DOMAIN_RUNTIME_BOUNDARY).not.toMatch(/attack roll:|prepared spells:|damage dealt|uses remaining:/i);
    expect(screen.queryByRole('button', { name: /warding|flare|prepare|cast|reaction/i })).not.toBeInTheDocument();
  });
});
