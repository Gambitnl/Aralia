/**
 * @file proceduralCreature.test.ts — Unit & Integration tests for procedural creature generation.
 */

import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { validateGenome } from '../../genome/creatureGenomeSchema';
import { HingeConstraint, FixedConstraint } from '../jointConstraints';
import { assembleFromGenome } from '../skeletonAssembler';
import { generateCreatureMesh } from '../proceduralCreatureMesh';
import { CreatureLocomotionController } from '../proceduralLocomotion';
import { createFallbackGenome } from '../../../../services/ai/deepseekCreatureGenerator';

describe('Procedural Creature System', () => {
  describe('Genome Schema', () => {
    it('creates a valid fallback genome', () => {
      const genome = createFallbackGenome('a four-legged wolf beast');
      const validation = validateGenome(genome);
      expect(validation.success).toBe(true);
      expect(genome.archetype).toBe('quadruped');
    });

    it('detects hexapod archetype from keywords', () => {
      const genome = createFallbackGenome('a six-legged insectoid spider');
      expect(genome.archetype).toBe('hexapod');
    });
  });

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

  describe('Skeleton Assembler', () => {
    it('assembles a skeleton with mirrored limbs from fallback genome', () => {
      const genome = createFallbackGenome('quadruped beast');
      const assembled = assembleFromGenome(genome);

      expect(assembled.bones.length).toBeGreaterThan(5);
      expect(assembled.root).toBeDefined();
      expect(assembled.limbChains.length).toBeGreaterThan(0);
    });
  });

  describe('Procedural Mesh Generator', () => {
    it('generates a skinned mesh bound to assembled skeleton', () => {
      const genome = createFallbackGenome('wolf');
      const assembled = assembleFromGenome(genome);
      const mesh = generateCreatureMesh(assembled, genome);

      expect(mesh.isSkinnedMesh).toBe(true);
      expect(mesh.geometry.attributes.position.count).toBeGreaterThan(0);
      expect(mesh.geometry.attributes.skinIndex).toBeDefined();
      expect(mesh.geometry.attributes.skinWeight).toBeDefined();
    });
  });

  describe('IK Solver & Locomotion', () => {
    it('initializes locomotion controller and steps frame without crashing', () => {
      const genome = createFallbackGenome('creature');
      const assembled = assembleFromGenome(genome);
      const controller = new CreatureLocomotionController(assembled, genome);

      expect(() => {
        controller.update(0.016, 1.5);
      }).not.toThrow();
    });
  });
});
