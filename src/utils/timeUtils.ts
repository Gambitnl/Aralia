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
