import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter, resolveAttack } from '../../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import {
  ClassesDomainShell,
  classesDomainModule,
  getSubclassDemo,
  SUBCLASS_DEMO_REGISTRY,
} from '../..';
import { ChampionDemo, createChampionCombatCharacter } from './ChampionDemo';

/**
 * This test proves the Champion leaf's canonical data, production combat seams,
 * deterministic controls, and Classes-shell registration boundary. It is focused
 * proof for the unmounted domain; Rules-host and rendered 2D/3D proof stay outside
 * this leaf until the orchestrator mounts the domain.
 */

// ============================================================================
// Canonical Source and Combat Pipeline
// ============================================================================
describe('Champion Improved Critical canonical pipeline', () => {
  it('resolves Champion through the canonical class and subclass helpers', () => {
    const champion = findSubclass(CLASSES_DATA.fighter.id, 'champion');

    expect(subclassesForClass(CLASSES_DATA.fighter.id)).toContainEqual(champion);
    expect(champion?.classId).toBe(CLASSES_DATA.fighter.id);
    expect(champion?.name).toBe('Champion');
    expect(champion?.features.some(feature => feature.id === 'improved_critical')).toBe(true);
  });

  it('derives threshold 19 only for the canonical level-three Champion', () => {
    const championCharacter = createChampionCombatCharacter();
    expect(championCharacter.class).toBe(CLASSES_DATA.fighter);
    expect(championCharacter.level).toBe(3);
    expect(championCharacter.critThreshold).toBe(19);

    const basePlayer = createQuickCharacter({
      classId: CLASSES_DATA.fighter.id,
      raceId: 'human',
      level: 3,
      name: 'Threshold Boundary Tester',
      useRecommendedStats: true,
    });
    expect(basePlayer).not.toBeNull();

    if (!basePlayer) {
      return;
    }

    const youngChampion = createPlayerCombatCharacter({
      ...basePlayer,
      level: 2,
      subclassId: 'champion',
    });
    const battleMaster = createPlayerCombatCharacter({
      ...basePlayer,
      subclassId: 'battle_master',
    });

    expect(youngChampion.critThreshold).toBe(20);
    expect(battleMaster.critThreshold).toBe(20);
  });

  it('resolves fixed 19 as critical and fixed 18 as a non-critical hit', () => {
    const champion = createChampionCombatCharacter();
    const threshold = champion.critThreshold;

    expect(threshold).toBe(19);
    if (threshold === undefined) {
      return;
    }

    const critical = resolveAttack(19, 0, 10, threshold);
    const ordinaryHit = resolveAttack(18, 0, 10, threshold);

    expect(critical).toMatchObject({ isHit: true, isCritical: true, isAutoMiss: false });
    expect(ordinaryHit).toMatchObject({ isHit: true, isCritical: false, isAutoMiss: false });
  });
});

// ============================================================================
// Rendered Controls and Registry Boundary
// ============================================================================
describe('Champion Classes-domain registration', () => {
  it('renders derived facts, roll controls, event output, and deterministic Reset', () => {
    render(<ChampionDemo />);

    expect(screen.getByTestId('champion-raw-roll')).toHaveTextContent('18');
    expect(screen.getByTestId('champion-crit-threshold')).toHaveTextContent('19');
    expect(screen.getByTestId('champion-result')).toHaveTextContent('Hit (not critical)');
    expect(screen.getByTestId('champion-event-log')).toHaveTextContent('d20 18');

    fireEvent.click(screen.getByRole('button', { name: 'Roll 19' }));
    expect(screen.getByTestId('champion-raw-roll')).toHaveTextContent('19');
    expect(screen.getByTestId('champion-result')).toHaveTextContent('Critical hit');
    expect(screen.getByTestId('champion-event-log')).toHaveTextContent('critical hit');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('champion-raw-roll')).toHaveTextContent('18');
    expect(screen.getByTestId('champion-result')).toHaveTextContent('Hit (not critical)');
  });

  it('keeps Champion and Battle Master registered at the Classes shell boundary', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(getSubclassDemo('fighter', 'champion')?.label).toBe('Champion');
    expect(getSubclassDemo('fighter', 'battle_master')?.label).toBe('Battle Master');
    expect(classesDomainModule).toMatchObject({
      id: 'classes',
      label: 'Classes',
      description: 'Class and subclass mechanics',
    });

    render(<ClassesDomainShell initialClassId="fighter" initialSubclassId="champion" />);
    expect(screen.getByTestId('champion-improved-critical-demo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Battle Master' }));
    expect(screen.queryByTestId('champion-improved-critical-demo')).not.toBeInTheDocument();
    expect(screen.getByTestId('battle-master-progression-demo')).toBeInTheDocument();
  });
});
