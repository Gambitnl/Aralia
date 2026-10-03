import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  EVOKER_RUNTIME_BOUNDARY,
  EvokerDemo,
  createEvokerLevel2,
  createEvokerLevel3,
  getEvokerFeatures,
  getEvokerNativeAudit,
  POTENT_CANTRIP_CONTRACT,
  SCULPT_SPELLS_CONTRACT,
} from './EvokerDemo';

/**
 * This test proves the Evoker leaf from canonical subclass data through production
 * character creation, level-up, and player-to-combat conversion. It checks the
 * exact Sculpt Spells and Potent Cantrip contracts while rejecting generic spell,
 * area, save, and damage helpers as subclass proof. Rendered 2D/3D proof remains
 * deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Wizard Evoker canonical progression pipeline', () => {
  it('resolves the exact subclass id, name, and canonical Sculpt Spells feature', () => {
    const evoker = findSubclass(CLASSES_DATA.wizard.id, 'evocation');

    expect(evoker?.id).toBe('evocation');
    expect(evoker?.classId).toBe(CLASSES_DATA.wizard.id);
    expect(evoker?.name).toBe('Evoker (School of Evocation)');
    expect(subclassesForClass(CLASSES_DATA.wizard.id)).toContainEqual(evoker);
    expect(evoker?.features).toEqual([
      expect.objectContaining({
        id: 'sculpt_spells',
        name: 'Sculpt Spells',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows the canonical feature only after the explicit level-3 Evoker choice', () => {
    const level2 = createEvokerLevel2();
    const level3 = createEvokerLevel3(level2);
    const level2Features = getEvokerFeatures(level2).map(feature => feature.id);
    const level3Features = getEvokerFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('sculpt_spells');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('evocation');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.wizard, 3, 'evocation').map(feature => feature.id),
    );
    expect(level3Features).toContain('sculpt_spells');
  });

  it('uses production level-up and preserves the same fixture for the explicit subclass choice', () => {
    const level2 = createEvokerLevel2();
    const level3 = createEvokerLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'evocation' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('evocation');
  });
});

// ============================================================================
// Native Evoker contract and exact boundary proof
// ============================================================================
describe('Evoker native Sculpt Spells and Potent Cantrip boundary', () => {
  it('records the requested ally-safe AoE/save and half-damage contracts exactly', () => {
    expect(SCULPT_SPELLS_CONTRACT).toEqual({
      trigger: 'Evocation spell affecting other creatures you can see',
      allySafety: 'Choose 1 + spell level creatures; chosen creatures automatically succeed on the save',
      area: 'The originating spell area must be resolved by the production spell path',
      save: 'Chosen creatures automatically succeed on the spell saving throw',
      damage: 'Chosen creatures take no damage when a successful save would normally deal half damage',
    });
    expect(POTENT_CANTRIP_CONTRACT).toEqual({
      trigger: 'Damaging cantrip attack miss or successful target saving throw',
      damage: "Target takes half the cantrip damage, if any",
      rider: 'Target suffers no additional effect from the cantrip',
    });
  });

  it('does not mistake generic combat metadata for an Evoker transaction', () => {
    const level2Audit = getEvokerNativeAudit(createEvokerLevel2());
    const level3Audit = getEvokerNativeAudit(createEvokerLevel3());

    expect(level2Audit.hasSculptSpellsAbility).toBe(false);
    expect(level2Audit.hasSculptSpellsResource).toBe(false);
    expect(level3Audit.hasSculptSpellsAbility).toBe(false);
    expect(level3Audit.hasSculptSpellsResource).toBe(false);
    expect(level3Audit.hasPotentCantripAbility).toBe(false);
    expect(level3Audit.hasPotentCantripResource).toBe(false);
    expect(level3Audit.abilityIds).not.toContain('sculpt_spells');
    expect(level3Audit.limitedUseIds).not.toContain('potent_cantrip');
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary proof
// ============================================================================
describe('Evoker Classes-domain registration', () => {
  it('renders canonical facts, the exact audit gap, and Reset', () => {
    render(<EvokerDemo />);

    expect(screen.getByTestId('evoker-level')).toHaveTextContent('2');
    expect(screen.getByTestId('evoker-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('evoker-feature-list')).not.toHaveTextContent('sculpt_spells');
    expect(screen.getByTestId('evoker-sculpt-trigger-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('evoker-ally-safety-audit')).toHaveTextContent('automatically succeed');
    expect(screen.getByTestId('evoker-area-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('evoker-save-audit')).toHaveTextContent('saving throw');
    expect(screen.getByTestId('evoker-no-half-damage-audit')).toHaveTextContent('no damage');
    expect(screen.getByTestId('evoker-potent-cantrip-audit')).toHaveTextContent('half the cantrip damage');
    expect(screen.getByTestId('evoker-ability-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('evoker-potent-ability-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('evoker-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Evoker / Level 3' }));
    expect(screen.getByTestId('evoker-level')).toHaveTextContent('3');
    expect(screen.getByTestId('evoker-subclass')).toHaveTextContent('Evoker (School of Evocation)');
    expect(screen.getByTestId('evoker-feature-list')).toHaveTextContent('sculpt_spells');
    expect(screen.getByTestId('evoker-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('evoker-transition-log')).toHaveTextContent("subclassId: 'evocation'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('evoker-level')).toHaveTextContent('2');
    expect(screen.getByTestId('evoker-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('evoker-feature-list')).not.toHaveTextContent('sculpt_spells');
  });

  it('appends Evoker directly after Archfey Patron and resolves it', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('wizard', 'evocation')?.label).toBe('Evoker (School of Evocation)');
    expect(getSubclassDemo('wizard', 'evocation')?.Component).toBe(EvokerDemo);
  });

  it('does not expose generic spell, AoE, save, damage, or resource controls', () => {
    render(<EvokerDemo />);

    expect(screen.getByTestId('evoker-runtime-boundary')).toHaveTextContent(EVOKER_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('evoker-runtime-boundary')).toHaveTextContent('Generic spell resolvers');
    expect(screen.getByTestId('evoker-runtime-boundary')).toHaveTextContent('ally selection, area targeting, saves, damage');
    expect(screen.queryAllByRole('button', { name: /cast|area|save|damage|cantrip|sculpt|target/i })).toHaveLength(0);
  });
});
