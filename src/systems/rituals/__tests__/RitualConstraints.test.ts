
import { describe, it, expect } from 'vitest';
import { validateRitualRequirements } from '../RitualManager';
import { RitualRequirement, RitualContext } from '../../../types/rituals';
// TODO(lint-intent): 'TimeOfDay' is unused in this test; use it in the assertion path or remove it.
import { TimeOfDay as _TimeOfDay } from '../../../utils/timeUtils';

describe('RitualConstraints', () => {
  // Setup standard dates for testing
  // Dawn: ~6am, Day: ~12pm, Dusk: ~6pm, Night: ~10pm
  // TODO(lint-intent): 'dateDawn' is unused in this test; use it in the assertion path or remove it.
  const _dateDawn = new Date(Date.UTC(2025, 0, 1, 6, 0));
  const dateDay = new Date(Date.UTC(2025, 0, 1, 12, 0));
  const dateDusk = new Date(Date.UTC(2025, 0, 1, 18, 0));
  const dateNight = new Date(Date.UTC(2025, 0, 1, 22, 0));

  describe('Time of Day Constraints', () => {
    it('validates correct time of day', () => {
      const requirements: RitualRequirement[] = [
        { type: 'time_of_day', value: 'Night', description: 'Must be night' }
      ];
      const context: RitualContext = { currentTime: dateNight };

      const result = validateRitualRequirements(requirements, context);
      expect(result.valid).toBe(true);
    });

    it('rejects incorrect time of day', () => {
        const requirements: RitualRequirement[] = [
          { type: 'time_of_day', value: 'Night' }
        ];
        const context: RitualContext = { currentTime: dateDay };

        const result = validateRitualRequirements(requirements, context);
        expect(result.valid).toBe(false);
        expect(result.failureReason).toContain('Night');
    });

    it('validates list of allowed times', () => {
        const requirements: RitualRequirement[] = [
            { type: 'time_of_day', value: ['Dusk', 'Night'] }
        ];

        expect(validateRitualRequirements(requirements, { currentTime: dateDusk }).valid).toBe(true);
        expect(validateRitualRequirements(requirements, { currentTime: dateNight }).valid).toBe(true);
        expect(validateRitualRequirements(requirements, { currentTime: dateDay }).valid).toBe(false);
    });
  });

  describe('Location Constraints', () => {
      it('validates location type', () => {
          const reqs: RitualRequirement[] = [{ type: 'location', value: 'indoors' }];
          expect(validateRitualRequirements(reqs, { locationType: 'indoors' }).valid).toBe(true);
          expect(validateRitualRequirements(reqs, { locationType: 'outdoors' }).valid).toBe(false);
      });
  });

  describe('Biome Constraints', () => {
      it('validates biome', () => {
          const reqs: RitualRequirement[] = [{ type: 'biome', value: 'forest' }];
          expect(validateRitualRequirements(reqs, { biomeId: 'forest' }).valid).toBe(true);
          expect(validateRitualRequirements(reqs, { biomeId: 'desert' }).valid).toBe(false);
      });
  });

  describe('Participant Constraints', () => {
      it('validates participant count', () => {
          const reqs: RitualRequirement[] = [{ type: 'participants_count', value: 3 }];

          expect(validateRitualRequirements(reqs, { participantCount: 3 }).valid).toBe(true);
          expect(validateRitualRequirements(reqs, { participantCount: 5 }).valid).toBe(true);
          expect(validateRitualRequirements(reqs, { participantCount: 2 }).valid).toBe(false);
      });
  });

  describe('Multiple Constraints', () => {
      it('requires all constraints to pass', () => {
          const requirements: RitualRequirement[] = [
              { type: 'time_of_day', value: 'Night' },
              { type: 'location', value: 'outdoors' }
          ];

          // Both match
          expect(validateRitualRequirements(requirements, {
              currentTime: dateNight,
              locationType: 'outdoors'
          }).valid).toBe(true);

          // One fails
          expect(validateRitualRequirements(requirements, {
              currentTime: dateDay,
              locationType: 'outdoors'
          }).valid).toBe(false);

          // Other fails
          expect(validateRitualRequirements(requirements, {
              currentTime: dateNight,
              locationType: 'indoors'
          }).valid).toBe(false);
      });
  });
});
