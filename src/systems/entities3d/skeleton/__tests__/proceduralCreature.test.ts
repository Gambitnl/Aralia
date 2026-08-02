/**
 * @file proceduralCreature.test.ts — AAA Unit & Integration test suite for procedural creature generation.
 */

import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { validateGenome } from '../../genome/creatureGenomeSchema';
import { HingeConstraint, FixedConstraint } from '../jointConstraints';
import { assembleFromGenome } from '../skeletonAssembler';
import { generateCreatureMesh } from '../proceduralCreatureMesh';
import { CreatureLocomotionController } from '../proceduralLocomotion';
import { createAAACreatureMaterials } from '../creatureMaterials';
import { createAAAWorldPreset } from '../../../../services/ai/deepseekCreatureGenerator';

describe('AAA Procedural Creature Engine', () => {
  // ==========================================================================
  // 1. Genome Schema & AAA Presets
  // ==========================================================================
  describe('Genome Schema & Presets', () => {
    it('creates a valid AAA Fenrir wolf preset', () => {
      const genome = createAAAWorldPreset('a four-legged wolf beast');
      const validation = validateGenome(genome);
      expect(validation.success).toBe(true);
      expect(genome.archetype).toBe('quadruped');
    });

    it('creates a valid AAA Wyrm serpentine dragon preset', () => {
      const genome = createAAAWorldPreset('a spined wyrm dragon serpent');
      const validation = validateGenome(genome);
      expect(validation.success).toBe(true);
      expect(genome.archetype).toBe('serpentine');
    });

    it('creates a valid AAA Mantis hexapod preset', () => {
      const genome = createAAAWorldPreset('a six-legged mantis scorpion');
      const validation = validateGenome(genome);
      expect(validation.success).toBe(true);
      expect(genome.archetype).toBe('hexapod');
    });
  });

  // ==========================================================================
  // 2. AAA Materials & Procedural Normal Maps
  // ==========================================================================
  describe('AAA Materials', () => {
    it('creates PBR physical material bundle with procedural normal maps', () => {
      const genome = createAAAWorldPreset('beast');
      const materials = createAAACreatureMaterials(genome.skin, 'pbr');

      expect(materials.bodyMaterial).toBeDefined();
      expect(materials.outlineMaterial).toBeDefined();
      expect(materials.eyeMaterial).toBeDefined();
      expect(materials.ringMaterial).toBeDefined();
    });

    it('creates Cel-shaded Toon material bundle', () => {
      const genome = createAAAWorldPreset('beast');
      const materials = createAAACreatureMaterials(genome.skin, 'toon');

      expect(materials.bodyMaterial).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. Joint Constraints
  // ==========================================================================
  describe('Joint Constraints', () => {
    it('enforces hinge joint limits', () => {
      const hinge = new HingeConstraint(new Vector3(1, 0, 0), 0, 90);
      const rest = new Quaternion();
      const target = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (120 * Math.PI) / 180);

      hinge.enforce(target, rest);

      const angle = 2 * Math.acos(target.w);
      const angleDeg = (angle * 180) / Math.PI;
      expect(angleDeg).toBeCloseTo(90, 1);
    });

    it('enforces fixed joint locks', () => {
      const fixed = new FixedConstraint();
      const rest = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5);
      const target = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2);

      fixed.enforce(target, rest);

      expect(target.x).toBeCloseTo(rest.x);
      expect(target.y).toBeCloseTo(rest.y);
      expect(target.z).toBeCloseTo(rest.z);
      expect(target.w).toBeCloseTo(rest.w);
    });
  });

  // ==========================================================================
  // 4. Skeleton Assembler & AAA Mesh Generator
  // ==========================================================================
  describe('Skeleton & AAA Mesh Generator', () => {
    it('assembles a skeleton with mirrored limbs', () => {
      const genome = createAAAWorldPreset('quadruped beast');
      const assembled = assembleFromGenome(genome);

      expect(assembled.bones.length).toBeGreaterThan(5);
      expect(assembled.root).toBeDefined();
      expect(assembled.limbChains.length).toBeGreaterThan(0);
    });

    it('generates a skinned mesh with flared junction collars and skin weights', () => {
      const genome = createAAAWorldPreset('wolf');
      const assembled = assembleFromGenome(genome);
      const mesh = generateCreatureMesh(assembled, genome, { style: 'pbr' });

      expect(mesh.isSkinnedMesh).toBe(true);
      expect(mesh.geometry.attributes.position.count).toBeGreaterThan(0);
      expect(mesh.geometry.attributes.skinIndex).toBeDefined();
      expect(mesh.geometry.attributes.skinWeight).toBeDefined();
      expect(mesh.geometry.attributes.color).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. AAA Locomotion Simulation
  // ==========================================================================
  describe('AAA Locomotion Simulation', () => {
    it('simulates locomotion steps, speed acceleration, and idle breathing without crashing', () => {
      const genome = createAAAWorldPreset('creature');
      const assembled = assembleFromGenome(genome);
      const controller = new CreatureLocomotionController(assembled, genome);

      // Moving simulation frame
      expect(() => {
        controller.update(0.016, 2.0);
      }).not.toThrow();

      // Idle breathing frame
      expect(() => {
        controller.update(0.016, 0.0);
      }).not.toThrow();
    });
  });
});
