/**
 * @file compatibilityFixtures.test.ts — Verification suite for gameplay integration.
 *
 * This test file imports Aralia's live adapters and feeds them with the decoupled,
 * structurally-compatible mock fixtures. It ensures that the gameplay-to-recipe converters
 * remain compatible with the core engine and produce correct 3D entity specifications.
 * This guarantees that when Entity Studio is extractable as a standalone library,
 * Aralia's core gameplay consumers will continue to compile and function correctly.
 *
 * Runs as: part of the Vitest unit testing suite.
 * Depends on: Vitest assertion tools, engine adapters, and the mock fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerAllParts } from '../parts';
import { generateEntityBlueprint } from '../generateEntityBlueprint';

// Import the live adapters that bridge Aralia gameplay to the 3D entity engine.
import { recipeFromCombatant } from '../recipeFromCombatant';
import { recipeFromCharacter } from '../recipeFromCharacter';
import { recipeFromOccupant } from '../recipeFromOccupant';

// Import the structurally-compatible mock fixtures we created.
import {
  MOCK_COMBATANT_HUMAN,
  MOCK_COMBATANT_ORC_MONSTER,
  MOCK_COMBATANT_ACCEPTED_MONSTER,
  MOCK_COMBATANT_UNKNOWN_MONSTER,
  MOCK_CHARACTER_ELF_FIGHTER,
  MOCK_CHARACTER_WIZARD,
  MOCK_OCCUPANT_HUMAN_ADULT,
  MOCK_OCCUPANT_DWARF_CHILD,
  MOCK_OCCUPANT_LEGACY,
} from '../compatibilityFixtures';

// Type casts are used here because the adapters expect the real gameplay types
// (CombatCharacter, PlayerCharacter), but the fixtures are structurally minimal
// to remain compatible when copied out to the standalone repository.
import type { CombatCharacter } from '../../../types/combat';
import type { PlayerCharacter } from '../../../types/character';
import type { OccupantIdentity } from '../recipeFromOccupant';

// Import approved entries setter and plan database to mock hand-approved creatures.
import { __setEntriesForTests } from '../library/acceptedEntities';
import gelatinousCubePlan from '../../../data/creatures3d/plans/gelatinous-cube-fix00005.json';

describe('Entity Studio gameplay integration & compatibility fixtures', () => {
  // Before running tests, register all the 3D part generators in the registry
  // so the blueprint generator does not throw on missing body parts, and mock
  // the accepted creatures library database so the prioritization path succeeds.
  beforeAll(() => {
    registerAllParts();
    __setEntriesForTests([
      {
        id: 'fix00005',
        name: 'Gelatinous Cube',
        plan: gelatinousCubePlan.plan as any,
      },
    ]);
  });

  // Restore the live creature library after all tests have completed.
  afterAll(() => {
    __setEntriesForTests(null);
  });

  // ============================================================================
  // Combatant Adapters Checks
  // ============================================================================
  // Ensures that combat character inputs resolve to valid procedural recipes
  // and approved hand-crafted plans.
  // ============================================================================

  it('converts a human fighter combatant to a valid humanoid recipe', () => {
    // Convert the mock combatant to an entity recipe using the live adapter.
    const recipe = recipeFromCombatant(MOCK_COMBATANT_HUMAN as unknown as CombatCharacter);
    
    // Ensure the output recipe has the correct kind and seed.
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.raceId).toBe('human');
    expect(recipe.seed).toBe('combat:combatant-human-101');

    // Prove that the core engine can compile the recipe into a 3D blueprint.
    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.gait).toBe('biped');
    expect(blueprint.parts.length).toBeGreaterThan(0);
  });

  it('converts an orc monster combatant to a valid humanoid recipe using tags', () => {
    const recipe = recipeFromCombatant(MOCK_COMBATANT_ORC_MONSTER as unknown as CombatCharacter);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.raceId).toBe('orc');

    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.gait).toBe('biped');
  });

  it('converts a monster with approved name to the exact accepted hand-approved recipe', () => {
    const recipe = recipeFromCombatant(MOCK_COMBATANT_ACCEPTED_MONSTER as unknown as CombatCharacter);
    
    // Hand-approved monsters resolve to planned kind instead of humanoid.
    expect(recipe.kind).toBe('planned');
    expect(recipe.seed).toBe('fix00005');

    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.gait).toBe('plan');
  });

  it('converts an unknown monster combatant to a generic creature recipe', () => {
    const recipe = recipeFromCombatant(MOCK_COMBATANT_UNKNOWN_MONSTER as unknown as CombatCharacter);
    
    expect(recipe.kind).toBe('creature');
    if (recipe.kind !== 'creature') throw new Error('Expected a creature recipe');
    if (recipe.kind !== 'creature') throw new Error('Expected a creature recipe');
    expect(recipe.creatureType).toBe('Beast');

    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.gait).toBe('plan');
  });

  // ============================================================================
  // Character/Party Equipment Adapters Checks
  // ============================================================================
  // Ensures that player characters equipped with weapons, shields, and armor
  // resolve to recipes with the appropriate visual gear overrides.
  // ============================================================================

  it('converts a geared elf fighter character to a recipe with gear overrides', () => {
    const recipe = recipeFromCharacter(MOCK_CHARACTER_ELF_FIGHTER as unknown as PlayerCharacter);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.raceId).toBe('wood_elf');
    expect(recipe.gearOverride).toBeDefined();

    // Verify the visual gear attachments are mapped to correct bone anchors.
    const gear = recipe.gearOverride || [];
    expect(gear).toContainEqual({ partId: 'swordMain', anchor: 'handR' });
    expect(gear).toContainEqual({ partId: 'shieldOff', anchor: 'handL' });
    expect(gear).toContainEqual({ partId: 'pauldrons', anchor: 'chest' });
    expect(gear).toContainEqual({ partId: 'helmet', anchor: 'head' });

    // Prove that the engine can generate a blueprint containing these gear parts.
    const blueprint = generateEntityBlueprint(recipe);
    const partIds = blueprint.parts.map(p => p.partId);
    expect(partIds).toContain('swordMain');
    expect(partIds).toContain('shieldOff');
    expect(partIds).toContain('pauldrons');
    expect(partIds).toContain('helmet');
  });

  it('converts a wizard character with quarterstaff and cloak to a valid recipe', () => {
    const recipe = recipeFromCharacter(MOCK_CHARACTER_WIZARD as unknown as PlayerCharacter);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    const gear = recipe.gearOverride || [];
    expect(gear).toContainEqual({ partId: 'staffMain', anchor: 'handR' });
    expect(gear).toContainEqual({ partId: 'capeCloak', anchor: 'back' });

    const blueprint = generateEntityBlueprint(recipe);
    const partIds = blueprint.parts.map(p => p.partId);
    expect(partIds).toContain('staffMain');
    expect(partIds).toContain('capeCloak');
  });

  // ============================================================================
  // Occupant (Townsfolk) Adapters Checks
  // ============================================================================
  // Ensures that interior villager occupant structures map to unarmed commoner
  // recipes with deterministic seeds and scaled ages.
  // ============================================================================

  it('converts a human occupant to an unarmed human commoner recipe', () => {
    const recipe = recipeFromOccupant(MOCK_OCCUPANT_HUMAN_ADULT as unknown as OccupantIdentity);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.raceId).toBe('human');
    expect(recipe.gearOverride).toEqual([]);
    expect(recipe.seed).toBe('occupant:301');

    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.gait).toBe('biped');
  });

  it('resolves a dwarf child occupant deterministically to dwarf and scales size', () => {
    const recipe = recipeFromOccupant(MOCK_OCCUPANT_DWARF_CHILD as unknown as OccupantIdentity);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.ageBand).toBe('child');
    // Dwarf ancestry groups map to hill_dwarf or mountain_dwarf deterministically.
    expect(recipe.raceId).toMatch(/_dwarf$/);

    const blueprint = generateEntityBlueprint(recipe);
    expect(blueprint.frame.heightFt).toBeLessThan(4.5);
  });

  it('converts a legacy occupant with no race property to a human commoner', () => {
    const recipe = recipeFromOccupant(MOCK_OCCUPANT_LEGACY as unknown as OccupantIdentity);
    
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    if (recipe.kind !== 'humanoid') throw new Error('Expected a humanoid recipe');
    expect(recipe.raceId).toBe('human');
  });
});
