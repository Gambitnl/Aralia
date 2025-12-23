import React from 'react';
import { Season, TimeOfDay, getTimeOfDay, getSeason, getTimeModifiers } from '@/utils/timeUtils';
import { getMoonPhase, MoonPhase, getHoliday, getMonthName } from '@/systems/time/CalendarSystem';
import { motion } from 'framer-motion';
import Tooltip from '@/components/Tooltip';

interface TimeWidgetProps {
  gameTime: Date;
  onPassTimeClick?: () => void;
  disabled?: boolean;
}

const SEASON_ICONS: Record<Season, string> = {
  [Season.Spring]: '🌸',
  [Season.Summer]: '☀️',
  [Season.Autumn]: '🍂',
  [Season.Winter]: '❄️',
};

const TIME_ICONS: Record<TimeOfDay, string> = {
  [TimeOfDay.Dawn]: '🌅',
  [TimeOfDay.Day]: '☀️',
  [TimeOfDay.Dusk]: '🌇',
  [TimeOfDay.Night]: '🌙',
};

const MOON_ICONS: Record<MoonPhase, string> = {
  [MoonPhase.NewMoon]: '🌑',
  [MoonPhase.WaxingCrescent]: '🌒',
  [MoonPhase.FirstQuarter]: '🌓',
  [MoonPhase.WaxingGibbous]: '🌔',
  [MoonPhase.FullMoon]: '🌕',
  [MoonPhase.WaningGibbous]: '🌖',
  [MoonPhase.LastQuarter]: '🌗',
  [MoonPhase.WaningCrescent]: '🌘',
};

export const TimeWidget: React.FC<TimeWidgetProps> = ({ gameTime, onPassTimeClick, disabled }) => {
  const season = getSeason(gameTime);
  const timeOfDay = getTimeOfDay(gameTime);
  const moonPhase = getMoonPhase(gameTime);
  const holiday = getHoliday(gameTime);
  const modifiers = getTimeModifiers(gameTime);
  const monthName = getMonthName(gameTime.getUTCMonth());
  const day = gameTime.getUTCDate();

  // Determine color based on time of day
  const timeColor =
    timeOfDay === TimeOfDay.Night ? 'text-indigo-300' :
    timeOfDay === TimeOfDay.Dawn ? 'text-orange-300' :
    timeOfDay === TimeOfDay.Dusk ? 'text-purple-300' :
    'text-amber-400';

  const seasonColor =
    season === Season.Winter ? 'text-blue-200' :
    season === Season.Spring ? 'text-pink-300' :
    season === Season.Autumn ? 'text-orange-400' :
    'text-yellow-300';

  return (
    <div className="bg-gray-800 p-3 rounded-lg shadow-md border border-gray-700 flex flex-col gap-2 relative z-10">
      {/* Date Header */}
      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <span className={`font-cinzel font-bold text-sm ${seasonColor} flex items-center gap-1`}>
          {SEASON_ICONS[season]} {day} {monthName}
        </span>
        <Tooltip content={`Moon Phase: ${moonPhase}`}>
            <span className="text-gray-400 text-xs flex items-center gap-1 cursor-help">
            {MOON_ICONS[moonPhase]}
            </span>
        </Tooltip>
      </div>

      {/* Time & Phase */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
            <span className={`text-lg font-bold ${timeColor} flex items-center gap-2`}>
                {TIME_ICONS[timeOfDay]} {timeOfDay}
            </span>
            <span className="text-xs text-gray-500 italic">
                {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
            </span>
        </div>

        {/* Action Button */}
        {onPassTimeClick && (
             <Tooltip content="Pass Time">
                <motion.button
                    onClick={onPassTimeClick}
                    disabled={disabled}
                    whileTap={!disabled ? { scale: 0.95 } : undefined}
                    whileHover={!disabled ? { scale: 1.05 } : undefined}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"
                    aria-label="Pass Time"
                >
                    ⏳
                </motion.button>
            </Tooltip>
        )}
      </div>

      {/* Atmospheric Text / Holiday */}
      <div className="text-xs text-gray-400 mt-1 min-h-[1.5em]">
        {holiday ? (
            <span className="text-yellow-400 font-semibold">🎉 {holiday.name}</span>
        ) : (
            <span>{modifiers.description}</span>
        )}
      </div>

       {/* Risk Indicator (Only at Night) */}
       {timeOfDay === TimeOfDay.Night && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
            ⚠️ <span>Danger increases at night.</span>
        </div>
       )}
    </div>
  );
};
