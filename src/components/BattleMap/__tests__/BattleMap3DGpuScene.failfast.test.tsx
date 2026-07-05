import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BattleMap3D from '../BattleMap3D';
import type { BattleMapData, CombatCharacter } from '../../../types/combat';

/**
 * FAIL-FAST proof for the WebGPU battle-map path (Remy's no-fallback rule):
 *
 * With ?gpu=1 and NO WebGPU adapter (jsdom has no navigator.gpu), the GPU scene
 * must NOT render any battlefield — no silent WebGL2 fallback. It must show the
 * error panel, and the panel's "Use WebGL instead" button must — on an explicit
 * USER click — remount the normal WebGL scene.
 */

const mockUseBattleMap = vi.fn<(...args: unknown[]) => unknown>();
const mockUseTargetSelection = vi.fn<(...args: unknown[]) => unknown>();
const mockUseVisibility = vi.fn<(...args: unknown[]) => unknown>();
const mockTerrainMesh = vi.fn<(...args: unknown[]) => null>(() => null);

// The WebGPU flag reads window.location; force it ON for this suite.
vi.mock('../webgpuBattleMapFlag', () => ({
  WEBGPU_BATTLE_MAP_DEFAULT: false,
  isWebGpuBattleMapEnabled: () => true,
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>,
  extend: () => {},
  useFrame: () => {},
  useThree: () => ({ camera: {}, gl: {} }),
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MapControls: () => null,
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bloom: () => null,
  Vignette: () => null,
}));

vi.mock('postprocessing', () => ({ BlendFunction: { NORMAL: 'normal' } }));

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args),
}));
vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args),
}));
vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args),
}));

vi.mock('../terrain', () => ({
  TerrainMesh: (...args: unknown[]) => mockTerrainMesh(...args),
  GridOverlay: () => null,
  GrassLayer: () => null,
  WaterSystem: () => null,
  DecorationProps: () => null,
  GroundScatter: () => null,
  EzTreeLayer: () => null,
  DistantTerrain: () => null,
  GroundMist: () => null,
  makeTerrainHeightSampler: () => () => 0,
}));

vi.mock('../characters', () => ({ CharacterActor: () => null }));
vi.mock('../TargetingDecals', () => ({ default: () => null }));
vi.mock('../camera', () => ({ CameraController: () => null }));
vi.mock('../vfx', () => ({ VFXSystem: () => null, LivingWorld: () => null }));

const makeTile = (id: string, x: number, y: number) => ({
  id,
  coordinates: { x, y },
  terrain: 'grass',
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: [],
});

const hero = {
  id: 'hero',
  name: 'Hero',
  team: 'player',
  position: { x: 0, y: 0 },
  currentHP: 10,
  maxHP: 10,
  abilities: [],
  statusEffects: [],
  stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, speed: 30, baseInitiative: 0 },
  actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} },
} as unknown as CombatCharacter;

const mapData = {
  dimensions: { width: 2, height: 2 },
  tiles: new Map([
    ['0-0', makeTile('0-0', 0, 0)],
    ['1-0', makeTile('1-0', 1, 0)],
    ['0-1', makeTile('0-1', 0, 1)],
    ['1-1', makeTile('1-1', 1, 1)],
  ]),
  theme: 'forest',
  seed: 1,
} as unknown as BattleMapData;

/* eslint-disable @typescript-eslint/no-explicit-any */
const combatState = {
  turnManager: {
    turnState: { currentTurn: 0, turnOrder: [hero.id], currentCharacterId: hero.id, phase: 'action', actionsThisTurn: [] },
    activeLightSources: [],
    reactiveTriggers: [],
    damageNumbers: [],
    spellZones: [],
    scheduledSpellEffects: [],
    movementDebuffs: [],
    spellMovementVisuals: [],
    spellDeliveryVisuals: [],
  } as any,
  turnState: { currentTurn: 0, turnOrder: [hero.id], currentCharacterId: hero.id, phase: 'action', actionsThisTurn: [] } as any,
  abilitySystem: {
    targetingMode: false,
    selectedAbility: null,
    aoePreview: null,
    teleportDestinationPreview: null,
    targetValidationReason: null,
    pendingTeleportAssignment: null,
    isValidTarget: vi.fn(),
  } as any,
  isCharacterTurn: vi.fn(() => false),
  onCharacterUpdate: vi.fn(),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('BattleMap3D WebGPU fail-fast (flag on, no adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: null,
      validMoves: new Set(),
      activePath: [],
      actionMode: null,
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn(),
    });
    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(),
      teleportDestinationSet: new Set(),
    });
    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => 'bright'),
    });
    // jsdom has no navigator.gpu — that IS the no-adapter environment under test.
    expect((navigator as Navigator & { gpu?: unknown }).gpu).toBeUndefined();
  });

  it('shows the error panel (not a scene) when WebGPU is unavailable', async () => {
    render(<BattleMap3D mapData={mapData} characters={[hero]} combatState={combatState} />);

    // The lazy GPU scene mounts, probes, and fail-fasts into the error panel.
    const panel = await screen.findByTestId('battlemap-3d-webgpu-error');
    expect(panel.textContent).toContain('WebGPU unavailable');
    expect(panel.textContent).toContain('navigator.gpu is not available');
    expect(panel.textContent).toContain('Remove');

    // NO scene rendered: no canvas mount, no WebGL terrain, no success badge.
    expect(screen.queryByTestId('mock-canvas')).toBeNull();
    expect(screen.queryByTestId('battlemap-3d-webgpu')).toBeNull();
    expect(screen.queryByTestId('webgpu-badge')).toBeNull();
    expect(mockTerrainMesh).not.toHaveBeenCalled();
  });

  it('offers "Use WebGL instead" and mounts the WebGL scene on explicit click', async () => {
    render(<BattleMap3D mapData={mapData} characters={[hero]} combatState={combatState} />);

    const button = await screen.findByTestId('webgpu-use-webgl-button');
    expect(button.textContent).toMatch(/use webgl instead/i);

    fireEvent.click(button);

    // One explicit USER click — the normal WebGL scene remounts in place.
    await waitFor(() => {
      expect(screen.queryByTestId('battlemap-3d-webgpu-error')).toBeNull();
      expect(screen.getByTestId('mock-canvas')).toBeTruthy();
      expect(mockTerrainMesh).toHaveBeenCalled();
    });
  });
});
