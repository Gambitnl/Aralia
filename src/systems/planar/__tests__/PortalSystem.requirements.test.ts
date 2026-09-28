/**
 * PK-14 / agora-b6a2 — lunar/astrological time conditions and active-spell checks.
 *
 * PortalSystem.test.ts covers items, dormancy and the Bloodied condition. This file
 * covers the requirement kinds that used to fail closed: anything on the calendar
 * beyond Day/Night, and any 'spell' requirement at all.
 */
import { describe, it, expect } from 'vitest';
import { PortalSystem } from '../PortalSystem';
import { Portal, PortalRequirement } from '../../../types/planes';
import { GameState } from '../../../types/index';
import { createMockGameState, createMockPlayerCharacter, getGameEpoch } from '../../../utils/core';
import { getMoonPhase, getHoliday, MoonPhase, HOLIDAYS } from '../../time/CalendarSystem';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const basePortal: Portal = {
  id: 'portal_calendar',
  originLocationId: 'loc1',
  destinationPlaneId: 'feywild',
  activationRequirements: [],
  stability: 'permanent',
  isActive: true
};

function portalRequiring(req: PortalRequirement): Portal {
  return { ...basePortal, activationRequirements: [req] };
}

function stateAt(gameTime: Date): GameState {
  const state = createMockGameState();
  state.gameTime = gameTime;
  return state;
}

/** First day at or after the epoch on which the moon shows the given phase. */
function findDayWithPhase(phase: MoonPhase): Date {
  const epoch = getGameEpoch();
  for (let day = 0; day < 60; day++) {
    const candidate = new Date(epoch.getTime() + day * MS_PER_DAY);
    if (getMoonPhase(candidate) === phase) return candidate;
  }
  throw new Error(`no day within 60 of the epoch shows ${phase}`);
}

describe('PortalSystem calendar requirements', () => {
  it('opens a Full Moon portal on a full moon', () => {
    const fullMoonDay = findDayWithPhase(MoonPhase.FullMoon);
    const portal = portalRequiring({ type: 'time', value: 'Full Moon', description: 'Only under a full moon' });

    const result = PortalSystem.activate(portal, stateAt(fullMoonDay));

    expect(result.success).toBe(true);
  });

  it('refuses a Full Moon portal on a new moon and names the phase it sees', () => {
    const newMoonDay = findDayWithPhase(MoonPhase.NewMoon);
    const portal = portalRequiring({ type: 'time', value: 'Full Moon', description: 'Only under a full moon' });

    const result = PortalSystem.activate(portal, stateAt(newMoonDay));

    expect(result.success).toBe(false);
    expect(result.message).toContain(MoonPhase.NewMoon);
  });

  it('checks the season named by the requirement', () => {
    // Deepwinter 20th is unambiguously Winter under getSeason.
    const winterDay = new Date(Date.UTC(1490, 0, 20, 12, 0, 0));
    const summerDay = new Date(Date.UTC(1490, 6, 20, 12, 0, 0));
    const portal = portalRequiring({ type: 'time', value: 'Winter', description: 'Only in winter' });

    expect(PortalSystem.activate(portal, stateAt(winterDay)).success).toBe(true);
    expect(PortalSystem.activate(portal, stateAt(summerDay)).success).toBe(false);
  });

  it('checks a holiday by name', () => {
    const holiday = HOLIDAYS[0];
    const onTheDay = new Date(Date.UTC(1490, holiday.month, holiday.day, 12, 0, 0));
    const offTheDay = new Date(onTheDay.getTime() + MS_PER_DAY);
    expect(getHoliday(onTheDay)?.id).toBe(holiday.id);

    const portal = portalRequiring({ type: 'time', value: holiday.name, description: `Only on ${holiday.name}` });

    expect(PortalSystem.activate(portal, stateAt(onTheDay)).success).toBe(true);
    expect(PortalSystem.activate(portal, stateAt(offTheDay)).success).toBe(false);
  });

  it('still honours the time-of-day conditions it always supported', () => {
    const noon = new Date(Date.UTC(1490, 5, 1, 12, 0, 0));
    const midnight = new Date(Date.UTC(1490, 5, 1, 0, 0, 0));
    const dayPortal = portalRequiring({ type: 'time', value: 'Day', description: 'Daylight only' });
    const nightPortal = portalRequiring({ type: 'time', value: 'Night', description: 'Night only' });

    expect(PortalSystem.activate(dayPortal, stateAt(noon)).success).toBe(true);
    expect(PortalSystem.activate(nightPortal, stateAt(noon)).success).toBe(false);
    expect(PortalSystem.activate(nightPortal, stateAt(midnight)).success).toBe(true);
  });

  it('reports an unrecognized condition as unrecognized, not as unmet', () => {
    const portal = portalRequiring({ type: 'time', value: 'Conjunction of Nessus', description: 'Astrology' });

    const result = PortalSystem.activate(portal, stateAt(getGameEpoch()));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unrecognized time condition');
  });
});

describe('PortalSystem spell requirements', () => {
  const portal = portalRequiring({ type: 'spell', value: 'Plane Shift', description: 'Requires Plane Shift' });

  function stateWithEffect(name: string, source: string): GameState {
    const caster = createMockPlayerCharacter({
      id: 'caster_1',
      activeEffects: [{
        type: 'other',
        name,
        duration: { type: 'minutes', value: 10 },
        appliedTurn: 0,
        source
      }]
    });
    const state = createMockGameState();
    state.party = [caster];
    return state;
  }

  it('refuses when no party member carries the spell', () => {
    const state = createMockGameState();
    state.party = [createMockPlayerCharacter({ id: 'caster_1' })];

    const result = PortalSystem.activate(portal, state);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Plane Shift');
  });

  it('opens when a party member carries an active effect named for the spell', () => {
    const result = PortalSystem.activate(portal, stateWithEffect('Plane Shift', 'spell_plane_shift'));

    expect(result.success).toBe(true);
  });

  it('matches on the effect source as well, ignoring case and padding', () => {
    const result = PortalSystem.activate(portal, stateWithEffect('Shimmering Rift', '  plane shift  '));

    expect(result.success).toBe(true);
  });
});
