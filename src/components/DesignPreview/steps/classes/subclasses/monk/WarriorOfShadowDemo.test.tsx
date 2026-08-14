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
  getWarriorOfShadowFeatures,
  getWarriorOfShadowNativeAudit,
  SHADOW_ARTS_SPELL_IDS,
  WARRIOR_OF_SHADOW_RUNTIME_BOUNDARY,
  WarriorOfShadowDemo,
  createWarriorOfShadowLevel2,
  createWarriorOfShadowLevel3,
} from './WarriorOfShadowDemo';

/**
 * This test proves Warrior of Shadow against canonical subclass data and the
 * production progression/combat assemblers. It also proves Reset, the cumulative
 * registry append, the Shadow Arts audit, and the exact missing runtime boundary.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Monk Warrior of Shadow canonical progression pipeline', () => {
  it('resolves the exact subclass id and Shadow Arts feature', () => {
    const shadow = findSubclass(CLASSES_DATA.monk.id, 'shadow');

    expect(shadow?.id).toBe('shadow');
    expect(shadow?.classId).toBe(CLASSES_DATA.monk.id);
    expect(shadow?.name).toBe('Warrior of Shadow');
    expect(subclassesForClass(CLASSES_DATA.monk.id)).toContainEqual(shadow);
    expect(shadow?.features).toEqual([
      expect.objectContaining({
        id: 'shadow_arts',
        name: 'Shadow Arts',
        levelAvailable: 3,
      }),
    ]);
    expect(shadow?.features[0]?.description).toContain('Darkness');
    expect(shadow?.features[0]?.description).toContain('Darkvision');
    expect(shadow?.features[0]?.description).toContain('Pass without Trace');
    expect(shadow?.features[0]?.description).toContain('Silence');
  });

  it('shows Monk Focus at level 2 and Shadow Arts only after the level-3 choice', () => {
    const level2 = createWarriorOfShadowLevel2();
    const level3 = createWarriorOfShadowLevel3(level2);
    const level2Features = getWarriorOfShadowFeatures(level2).map(feature => feature.id);
    const level3Features = getWarriorOfShadowFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toEqual(expect.arrayContaining(['monks_focus', 'unarmored_movement']));
    expect(level2Features).not.toContain('shadow_arts');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('shadow');
    expect(level3Features).toContain('shadow_arts');
    expect(level3Features).toContain('deflect_attacks');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.monk, 3, 'shadow').map(feature => feature.id),
    );
  });

  it('audits native state without mistaking generic mechanics for Shadow proof', () => {
    const level2 = createWarriorOfShadowLevel2();
    const level3 = createWarriorOfShadowLevel3(level2);
    const native = getWarriorOfShadowNativeAudit(level3);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'shadow' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(native.flurry).toEqual(expect.objectContaining({
      id: 'flurry_of_blows',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
    }));
    expect(native.focus).toBeUndefined();
    expect(native.darkvisionRange).toBe(0);
    expect(native.spellbookIds).toEqual([]);
    expect(native.hasShadowStep).toBe(false);
    expect(SHADOW_ARTS_SPELL_IDS).toEqual([
      'darkness',
      'darkvision',
      'pass-without-trace',
      'silence',
      'minor-illusion',
    ]);
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary
// ============================================================================
describe('Warrior of Shadow Classes-domain registration', () => {
  it('renders level checkpoints, Shadow Arts audit facts, transition log, and Reset', () => {
    render(<WarriorOfShadowDemo />);

    expect(screen.getByTestId('shadow-level')).toHaveTextContent('2');
    expect(screen.getByTestId('shadow-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('shadow-feature-list')).toHaveTextContent('monks_focus');
    expect(screen.getByTestId('shadow-feature-list')).not.toHaveTextContent('shadow_arts');
    expect(screen.getByTestId('shadow-arts-audit')).toHaveTextContent('darkness');
    expect(screen.getByTestId('shadow-arts-audit')).toHaveTextContent('pass-without-trace');
    expect(screen.getByTestId('shadow-focus-audit')).toHaveTextContent('No native Focus resource binding');
    expect(screen.getByTestId('shadow-darkvision-audit')).toHaveTextContent('No Shadow Arts darkvision mutation');
    expect(screen.getByTestId('shadow-step-audit')).toHaveTextContent('No subclass-bound teleport ability');
    expect(screen.getByTestId('shadow-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Shadow / Level 3' }));
    expect(screen.getByTestId('shadow-level')).toHaveTextContent('3');
    expect(screen.getByTestId('shadow-subclass')).toHaveTextContent('Warrior of Shadow');
    expect(screen.getByTestId('shadow-feature-list')).toHaveTextContent('shadow_arts');
    expect(screen.getByTestId('shadow-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('shadow-transition-log')).toHaveTextContent("subclassId: 'shadow'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('shadow-level')).toHaveTextContent('2');
    expect(screen.getByTestId('shadow-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('shadow-feature-list')).not.toHaveTextContent('shadow_arts');
  });

  it('appends Warrior of Shadow after Open Hand and resolves the cumulative registry', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('monk', 'shadow')?.label).toBe('Warrior of Shadow');
    expect(getSubclassDemo('monk', 'shadow')?.Component).toBe(WarriorOfShadowDemo);
  });

  it('shows the exact partial-runtime boundary without fake combat output', () => {
    render(<WarriorOfShadowDemo />);

    expect(screen.getByTestId('shadow-runtime-boundary')).toHaveTextContent(
      WARRIOR_OF_SHADOW_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('shadow-runtime-boundary')).toHaveTextContent('no production path binds');
    expect(screen.getByTestId('shadow-runtime-boundary')).toHaveTextContent('Focus payment');
    expect(screen.getByTestId('shadow-runtime-boundary')).toHaveTextContent('magical-darkness vision');
    expect(screen.getByTestId('shadow-runtime-boundary')).toHaveTextContent('Shadow Step');
    expect(screen.queryByRole('button', { name: /cast|teleport|activate|attack|roll|damage/i })).not.toBeInTheDocument();
  });
});
