
import { describe, it, expect } from 'vitest';
import { createSkillChallenge, attemptSkillChallenge } from '../skillChallengeSystem';
import { PlayerCharacter } from '../../../types/character';
import { createMockPlayerCharacter } from '../../../utils/core';

/**
 * Helper to create a test character with specific ability scores.
 */
function createTestCharacter(name: string, str: number, dex: number, int: number): PlayerCharacter {
  const base = createMockPlayerCharacter();

  // Set Ability Scores
  base.abilityScores = {
    ...base.abilityScores,
    Strength: str,
    Dexterity: dex,
    Intelligence: int,
    Wisdom: 10,
    Charisma: 10,
    Constitution: 10
  };

  base.name = name;
  return base;
}

describe('SkillChallengeSystem', () => {
  it('should initialize a challenge correctly', () => {
    const challenge = createSkillChallenge(
      'chase_01',
      'Rooftop Chase',
      'Catch the thief before he escapes',
      3, // Successes
      3, // Failures
      10, // Base DC
      [{ skillName: 'Athletics', description: 'Jump gaps' }],
      'Caught him!',
      'He escaped.'
    );

    expect(challenge.status).toBe('active');
    expect(challenge.currentSuccesses).toBe(0);
    expect(challenge.availableSkills[0].uses).toBe(0);
  });

  it('should track successes', () => {
    const challenge = createSkillChallenge(
      'test_success', 'Test', 'Desc', 2, 3, 5, // Low DC
      [{ skillName: 'Athletics', description: 'Run' }],
      'Win', 'Lose'
    );

    // 18 Strength -> +4 Modifier
    // Roll (1..20) + 4 => Range 5..24.
    // DC 5. Always success.
    const char = createTestCharacter('Hero', 18, 10, 10);

    const result = attemptSkillChallenge(challenge, char, 'Athletics');

    expect(result.success).toBe(true);
    expect(challenge.currentSuccesses).toBe(1);
    expect(challenge.status).toBe('active');
  });

  it('should track failures and end challenge', () => {
    const challenge = createSkillChallenge(
      'test_fail', 'Test', 'Desc', 5, 1, 30, // Impossible DC
      [{ skillName: 'Arcana', description: 'Think' }],
      'Win', 'Lose'
    );

    const char = createTestCharacter('Wizard', 10, 10, 10); // +0 mod

    const result = attemptSkillChallenge(challenge, char, 'Arcana');

    expect(result.success).toBe(false);
    expect(challenge.currentFailures).toBe(1);
    expect(result.challengeStatus).toBe('failure');
    expect(challenge.status).toBe('failure');
    expect(result.message).toContain('CHALLENGE FAILED');
  });

  it('should restrict usage limits', () => {
    const challenge = createSkillChallenge(
      'test_limit', 'Test', 'Desc', 5, 5, 5,
      [{ skillName: 'Athletics', description: 'Run', maxUses: 1 }],
      'Win', 'Lose'
    );
    const char = createTestCharacter('Hero', 18, 10, 10);

    // First use: OK
    attemptSkillChallenge(challenge, char, 'Athletics');
    expect(challenge.availableSkills[0].uses).toBe(1);

    // Second use: Blocked
    const result = attemptSkillChallenge(challenge, char, 'Athletics');
    expect(result.success).toBe(false);
    expect(result.message).toContain('exhausted');
    // Counts shouldn't change on invalid attempt
    expect(challenge.currentSuccesses).toBe(1);
  });
  // #916: a proficient character adds their proficiency bonus. Every run below
  // shares ability scores and differs only in the skill list. The bonus is set
  // absurdly high on purpose: a proficient total can then never fall inside the
  // untrained 1-20 band, so the assertions are exact rather than probabilistic.
  describe('proficiency bonus (#916)', () => {
    function runAt(dc: number, skills: PlayerCharacter['skills']): boolean {
      const challenge = createSkillChallenge(
        'test_prof', 'Test', 'Desc', 1, 1, dc,
        [{ skillName: 'Athletics', description: 'Heave' }],
        'Win', 'Lose'
      );
      const char = createTestCharacter('Hero', 10, 10, 10);
      char.proficiencyBonus = 100;
      char.skills = skills;

      return attemptSkillChallenge(challenge, char, 'Athletics').success;
    }

    it('adds the bonus for a skill listed by id', () => {
      // Strength 10 gives +0, so an untrained total can never reach 50.
      expect(runAt(50, [{ id: 'athletics', name: 'Athletics', ability: 'Strength' }])).toBe(true);
    });

    it('adds the bonus for a skill listed by display name', () => {
      expect(runAt(50, [{ id: 'ath_legacy', name: 'Athletics', ability: 'Strength' }])).toBe(true);
    });

    it('withholds the bonus from a character proficient in a different skill', () => {
      expect(runAt(50, [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }])).toBe(false);
    });

    it('leaves an untrained total unchanged', () => {
      expect(runAt(50, [])).toBe(false);
      // Strength 10, no proficiency: the best possible total is exactly 20.
      expect(runAt(21, [])).toBe(false);
      expect(runAt(1, [])).toBe(true);
    });
  });
});
