/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/time/CalendarSystem.ts
 * Manages the game calendar, holidays, and moon phases.
 */

import { Season, getSeason, getGameDay, getGameEpoch } from '../../utils/timeUtils';

export interface GameDate {
  day: number;
  month: number;
  year: number;
}

export interface Holiday {
  id: string;
  name: string;
  description: string;
  month: number; // 0-11
  day: number; // 1-31
  season: Season;
  culturalNotes?: string;
}

// Moon phases cycle every 28 days
export enum MoonPhase {
  NewMoon = 'New Moon',
  WaxingCrescent = 'Waxing Crescent',
  FirstQuarter = 'First Quarter',
  WaxingGibbous = 'Waxing Gibbous',
  FullMoon = 'Full Moon',
  WaningGibbous = 'Waning Gibbous',
  LastQuarter = 'Last Quarter',
  WaningCrescent = 'Waning Crescent',
}

// 12 Months of 30 days each + 5 intercalary days (Festival of Seasons)?
// Or standard Gregorian-ish for simplicity?
// Let's stick to a standard 12 month, 30 days each (360 days) + 5 days special if needed, or just 365 days.
// The `timeUtils.ts` uses standard Date objects, so we are bound to Gregorian calendar math roughly.
// But we can rename the months.

export const MONTH_NAMES = [
  "Deepwinter",   // January
  "The Claw of Winter", // February
  "The Claw of Sunsets", // March
  "The Claw of Storms", // April
  "The Melting",   // May
  "The Time of Flowers", // June
  "Highsun",       // July
  "The Fading",    // August
  "Leaffall",      // September
  "The Rotting",   // October
  "The Drawing Down", // November
  "The Long Night"    // December
];

export const HOLIDAYS: Holiday[] = [
  {
    id: 'midwinter',
    name: 'Midwinter Festival',
    description: 'A celebration of the turning point of winter, marking the return of longer days.',
    month: 0,
    day: 15,
    season: Season.Winter
  },
  {
    id: 'greengrass',
    name: 'Greengrass',
    description: 'The official start of spring, celebrated with flower crowns and fresh planting.',
    month: 3, // April
    day: 1,
    season: Season.Spring
  },
  {
    id: 'midsummer',
    name: 'Midsummer Feast',
    description: 'A night of bonfires, dancing, and revelry under the shortest night of the year.',
    month: 6, // July
    day: 15,
    season: Season.Summer
  },
  {
    id: 'harvest_tide',
    name: 'Harvestide',
    description: 'Farmers gather to share the bounty of the fields before the cold sets in.',
    month: 9, // October
    day: 1,
    season: Season.Autumn
  },
  {
    id: 'feast_of_moon',
    name: 'Feast of the Moon',
    description: 'A somber occasion to honor the ancestors and tell stories of the dead.',
    month: 10, // November
    day: 10,
    season: Season.Autumn
  }
];

export const getGameDateStruct = (date: Date): GameDate => {
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear()
  };
};

export const getMonthName = (monthIndex: number): string => {
  return MONTH_NAMES[monthIndex % 12];
};

export const getMoonPhase = (date: Date): MoonPhase => {
  const day = getGameDay(date);
  const cycleDay = day % 28;

  if (cycleDay === 0) return MoonPhase.NewMoon;
  if (cycleDay < 7) return MoonPhase.WaxingCrescent;
  if (cycleDay === 7) return MoonPhase.FirstQuarter;
  if (cycleDay < 14) return MoonPhase.WaxingGibbous;
  if (cycleDay === 14) return MoonPhase.FullMoon;
  if (cycleDay < 21) return MoonPhase.WaningGibbous;
  if (cycleDay === 21) return MoonPhase.LastQuarter;
  return MoonPhase.WaningCrescent;
};

export const getHoliday = (date: Date): Holiday | null => {
  const d = getGameDateStruct(date);
  return HOLIDAYS.find(h => h.month === d.month && h.day === d.day) || null;
};

export const getNextHoliday = (date: Date): Holiday => {
  const d = getGameDateStruct(date);
  // Sort holidays by month/day
  const sorted = [...HOLIDAYS].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  // Find first holiday after today in current year
  const nextInYear = sorted.find(h =>
    h.month > d.month || (h.month === d.month && h.day > d.day)
  );

  if (nextInYear) return nextInYear;

  // Otherwise return first holiday of next year
  return sorted[0];
};

export const getCalendarDescription = (date: Date): string => {
  const season = getSeason(date);
  const monthName = getMonthName(date.getUTCMonth());
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const holiday = getHoliday(date);
  const moon = getMoonPhase(date);

  let desc = `It is ${day} ${monthName}, ${year} (${season}).\nMoon: ${moon}.`;

  if (holiday) {
    desc += `\n\n🎉 Today is ${holiday.name}! ${holiday.description}`;
  }

  return desc;
};
