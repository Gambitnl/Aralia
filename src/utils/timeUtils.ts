export const GAME_EPOCH_YEAR = 351;
export const GAME_EPOCH_MONTH = 0; // January
export const GAME_EPOCH_DAY = 1;
export const GAME_EPOCH_HOUR = 0;
export const GAME_EPOCH_MINUTE = 0;
export const GAME_EPOCH_SECOND = 0;

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
