// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 * 
 * Last Sync: 26/01/2026, 01:39:12
 * Dependents: contextUtils.ts, core/index.ts, factionUtils.ts, timeUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const GAME_EPOCH_YEAR = 351;
export const GAME_EPOCH_MONTH = 0; // January
export const GAME_EPOCH_DAY = 1;
export const GAME_EPOCH_HOUR = 0;
export const GAME_EPOCH_MINUTE = 0;
export const GAME_EPOCH_SECOND = 0;

export interface GameDuration {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export const getGameEpoch = () => new Date(Date.UTC(
  GAME_EPOCH_YEAR,
  GAME_EPOCH_MONTH,
  GAME_EPOCH_DAY,
  GAME_EPOCH_HOUR,
  GAME_EPOCH_MINUTE,
  GAME_EPOCH_SECOND
));

export const formatGameTime = (date: Date, options: Intl.DateTimeFormatOptions = {}): string => {
  return date.toLocaleTimeString([], { ...options, timeZone: 'UTC' });
};

export const formatGameDate = (date: Date, options: Intl.DateTimeFormatOptions = {}): string => {
  return date.toLocaleDateString([], { ...options, timeZone: 'UTC' });
};

export const formatGameDateTime = (date: Date, options: Intl.DateTimeFormatOptions = {}): string => {
  return date.toLocaleString([], { ...options, timeZone: 'UTC' });
};

export const getGameDay = (date: Date): number => {
  const diffMs = date.getTime() - getGameEpoch().getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

export const addGameTime = (date: Date, duration: GameDuration): Date => {
  const newDate = new Date(date.getTime());

  if (duration.years) newDate.setUTCFullYear(newDate.getUTCFullYear() + duration.years);
  if (duration.months) newDate.setUTCMonth(newDate.getUTCMonth() + duration.months);
  if (duration.weeks) newDate.setUTCDate(newDate.getUTCDate() + duration.weeks * 7);
  if (duration.days) newDate.setUTCDate(newDate.getUTCDate() + duration.days);
  if (duration.hours) newDate.setUTCHours(newDate.getUTCHours() + duration.hours);
  if (duration.minutes) newDate.setUTCMinutes(newDate.getUTCMinutes() + duration.minutes);
  if (duration.seconds) newDate.setUTCSeconds(newDate.getUTCSeconds() + duration.seconds);

  return newDate;
};

export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "a moment";

  const years = Math.floor(totalSeconds / 31536000);
  let remainingSeconds = totalSeconds % 31536000;

  const months = Math.floor(remainingSeconds / 2592000);
  remainingSeconds %= 2592000;

  const weeks = Math.floor(remainingSeconds / 604800);
  remainingSeconds %= 604800;

  const days = Math.floor(remainingSeconds / 86400);
  remainingSeconds %= 86400;

  const hours = Math.floor(remainingSeconds / 3600);
  remainingSeconds %= 3600;

  const minutes = Math.floor(remainingSeconds / 60);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : "less than a minute";
};

// --- Timekeeper Extensions ---

export enum Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Autumn = 'Autumn',
  Winter = 'Winter',
}

export enum TimeOfDay {
  Dawn = 'Dawn',
  Day = 'Day',
  Dusk = 'Dusk',
  Night = 'Night',
}

export interface TimeModifiers {
  travelCostMultiplier: number; // > 1 is slower
  visionModifier: number; // -1 to 1 (conceptually) or light level 0-1
  description: string;
}

export const getSeason = (date: Date): Season => {
  const month = date.getUTCMonth(); // 0-11
  // Winter: Dec (11), Jan (0), Feb (1)
  if (month === 11 || month === 0 || month === 1) return Season.Winter;
  // Spring: Mar (2), Apr (3), May (4)
  if (month >= 2 && month <= 4) return Season.Spring;
  // Summer: Jun (5), Jul (6), Aug (7)
  if (month >= 5 && month <= 7) return Season.Summer;
  // Autumn: Sep (8), Oct (9), Nov (10)
  return Season.Autumn;
};

export const getTimeOfDay = (date: Date): TimeOfDay => {
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 7) return TimeOfDay.Dawn;
  if (hour >= 7 && hour < 17) return TimeOfDay.Day;
  if (hour >= 17 && hour < 20) return TimeOfDay.Dusk;
  return TimeOfDay.Night;
};

// TODO(FEATURES): Extend season/time modifiers beyond travel cost (encounters, visuals, resource yields) and surface them in UI (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
export const getTimeModifiers = (date: Date): TimeModifiers => {
  const season = getSeason(date);
  const timeOfDay = getTimeOfDay(date);
  let travelCostMultiplier = 1.0;
  let description = '';

  // Season Modifiers
  switch (season) {
    case Season.Winter:
      travelCostMultiplier *= 1.25; // Snow/Cold slows travel
      description += 'The air is biting cold. ';
      break;
    case Season.Summer:
      // travelCostMultiplier *= 1.0; // Standard
      description += 'The air is warm and heavy. ';
      break;
    case Season.Autumn:
      description += 'Leaves crunch underfoot. ';
      break;
    case Season.Spring:
      description += 'The world is blooming. ';
      break;
  }

  // Time of Day Modifiers
  switch (timeOfDay) {
    case TimeOfDay.Night:
      travelCostMultiplier *= 1.5; // Difficult to navigate in dark
      description += 'Darkness covers the land.';
      break;
    case TimeOfDay.Dawn:
      description += 'The sun is rising.';
      break;
    case TimeOfDay.Dusk:
      description += 'Shadows are lengthening.';
      break;
    case TimeOfDay.Day:
      description += 'The sun is high.';
      break;
  }

  return {
    travelCostMultiplier,
    visionModifier: timeOfDay === TimeOfDay.Night ? 0.2 : 1.0,
    description: description.trim(),
  };
};
