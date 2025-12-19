
import { describe, it, expect, vi } from 'vitest';
import { generateLandmark } from '../landmarkService';
import * as submapUtils from '../../utils/submapUtils';

// Mock LANDMARK_TEMPLATES to ensure deterministic tests
vi.mock('../../data/landmarks', () => ({
  LANDMARK_TEMPLATES: [
    {
      id: 'test_landmark',
      nameTemplate: ['Test Monument'],
      descriptionTemplate: ['A test monument description.'],
      biomes: ['plains', 'all'],
      weight: 10,
      possibleRewards: [
        {
          type: 'gold',
          amountRange: [100, 100],
          chance: 1.0,
          descriptionTemplate: 'Found {amount} gold.'
        }
      ],
      possibleConsequences: [
        {
            type: 'reputation',
            targetId: 'test_faction',
            value: 5,
            chance: 1.0,
            descriptionTemplate: 'Reputation increased.'
        }
      ]
    }
  ]
}));

describe('landmarkService', () => {
  it('should generate a landmark with rewards and consequences', () => {
    // Mock the RNG to ensure all checks pass
    vi.spyOn(submapUtils, 'createSeededRandom').mockReturnValue(() => 0.01);

    const landmark = generateLandmark(12345, { x: 10, y: 10 }, 'plains');

    expect(landmark).not.toBeNull();
    if (landmark) {
      expect(landmark.id).toContain('test_landmark');
      expect(landmark.rewards.length).toBeGreaterThan(0);
      expect(landmark.rewards[0].amount).toBe(100);
      expect(landmark.consequences.length).toBeGreaterThan(0);
      expect(landmark.consequences[0].type).toBe('reputation');
      expect(landmark.consequences[0].description).toBe('Reputation increased.');
    }
  });

  it('should return null if random roll is too high', () => {
    vi.spyOn(submapUtils, 'createSeededRandom').mockReturnValue(() => 0.9);

    const landmark = generateLandmark(12345, { x: 10, y: 10 }, 'plains');
    expect(landmark).toBeNull();
  });
});
