/**
 * @file useDayNightOverlay.ts
 * Tiny helper to keep the day/night overlay logic reusable and isolated from SubmapPane.
 * Dependencies: relies on time utilities to translate Date -> TimeOfDay enum.
 */
import { getTimeOfDay, TimeOfDay } from '../../utils/core';

export const getDayNightOverlayClass = (gameTime: Date): string => {
  const timeOfDay = getTimeOfDay(gameTime);
  switch (timeOfDay) {
    case TimeOfDay.Dusk:
      return 'bg-amber-700/20 mix-blend-overlay';
    case TimeOfDay.Night:
      return 'bg-indigo-900/40 mix-blend-multiply';
    case TimeOfDay.Dawn:
      return 'bg-amber-300/10 mix-blend-soft-light';
    default:
      return '';
  }
};

export default getDayNightOverlayClass;
