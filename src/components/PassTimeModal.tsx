
/**
 * @file PassTimeModal.tsx
 * A modal component for granularly passing time in the game.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getGameEpoch, getTimeSinceEpoch } from '../utils/timeUtils';

interface TimeInputState {
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  years: number;
}

interface PassTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalSeconds: number) => void;
  currentTime: Date;
}

const PassTimeModal: React.FC<PassTimeModalProps> = ({ isOpen, onClose, onConfirm, currentTime }) => {
  const [time, setTime] = useState<TimeInputState>({
    minutes: 0,
    hours: 0,
    days: 0,
    weeks: 0,
    months: 0,
    years: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTime(prev => ({
      ...prev,
      [name]: Math.max(0, parseInt(value, 10) || 0),
    }));
  };

  // Calculate total seconds to advance.
  // Note: For months and years, this is an approximation for the preview.
  // The Date object handles the actual date changes correctly.
  const totalSecondsToAdvance = useMemo(() => {
    const newDate = new Date(currentTime.getTime());
    newDate.setFullYear(newDate.getFullYear() + time.years);
    newDate.setMonth(newDate.getMonth() + time.months);
    newDate.setDate(newDate.getDate() + (time.weeks * 7) + time.days);
    newDate.setHours(newDate.getHours() + time.hours);
    newDate.setMinutes(newDate.getMinutes() + time.minutes);
    
    return (newDate.getTime() - currentTime.getTime()) / 1000;

  }, [time, currentTime]);

  const newTimePreview = useMemo(() => {
    if (totalSecondsToAdvance <= 0) return null;
    const newDate = new Date(currentTime.getTime());
    // Use Date object methods for accurate date changes
    newDate.setFullYear(newDate.getFullYear() + time.years);
    newDate.setMonth(newDate.getMonth() + time.months);
    newDate.setDate(newDate.getDate() + (time.weeks * 7) + time.days);
    newDate.setHours(newDate.getHours() + time.hours);
    newDate.setMinutes(newDate.getMinutes() + time.minutes);
    return newDate;
  }, [currentTime, time, totalSecondsToAdvance]);
  
  const formatGameTimeForModal = (date: Date): string => {
    const diffMs = getTimeSinceEpoch(date);
    const dayNumber = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return `Day ${dayNumber}, ${timeString}`;
  };

  const handleConfirm = () => {
    onConfirm(totalSecondsToAdvance);
    onClose();
  };
  
  useEffect(() => {
    if (!isOpen) {
        setTime({ minutes: 0, hours: 0, days: 0, weeks: 0, months: 0, years: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      } as any}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="pass-time-title"
    >
      <motion.div
        {...{
          initial: { y: -30, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: -30, opacity: 0 },
        } as any}
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pass-time-title" className="text-2xl font-bold text-amber-400 font-cinzel text-center mb-4">Pass Time</h2>
        <div className="text-center mb-4 p-2 bg-gray-900/50 rounded">
            <p className="text-sm text-gray-400">Current Time:</p>
            <p className="text-md font-semibold text-sky-300">{formatGameTimeForModal(currentTime)}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            {(Object.keys(time) as Array<keyof TimeInputState>).map(unit => (
                <div key={unit}>
                    <label htmlFor={`time-${unit}`} className="block text-sm font-medium text-gray-300 capitalize">{unit}</label>
                    <input
                        type="number"
                        id={`time-${unit}`}
                        name={unit}
                        value={time[unit]}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    />
                </div>
            ))}
        </div>
        
        {newTimePreview && (
            <div className="text-center mt-4 p-2 bg-gray-900/50 rounded">
                <p className="text-sm text-gray-400">New Time will be:</p>
                <p className="text-md font-semibold text-amber-300">{formatGameTimeForModal(newTimePreview)}</p>
            </div>
        )}

        <div className="flex gap-4 mt-6">
            <button onClick={onClose} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Cancel</button>
            <button onClick={handleConfirm} disabled={totalSecondsToAdvance <= 0} className="w-1/2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow disabled:bg-gray-500">Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PassTimeModal;
