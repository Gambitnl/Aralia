/**
 * @file PassTimeModal.tsx
 * A modal component for granularly passing time in the game.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { formatGameTime, getGameDay, addGameTime, getTimeModifiers } from '@/utils/core';
import { getCalendarDescription } from '@/systems/time/CalendarSystem';
import { useFocusTrap } from '@/hooks/useFocusTrap';

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

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: -30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -30, opacity: 0 },
};

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

  const newTimePreview = useMemo(() => {
    return addGameTime(currentTime, time);
  }, [currentTime, time]);

  const totalSecondsToAdvance = useMemo(() => {
    return (newTimePreview.getTime() - currentTime.getTime()) / 1000;
  }, [newTimePreview, currentTime]);
  
  const formatGameTimeForModal = (date: Date): string => {
    const dayNumber = getGameDay(date);
    const timeString = formatGameTime(date, { hour: '2-digit', minute: '2-digit', hour12: true });
    return `Day ${dayNumber}, ${timeString}`;
  };

  const handleConfirm = () => {
    onConfirm(totalSecondsToAdvance);
    onClose();
  };

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && totalSecondsToAdvance > 0) {
      e.preventDefault();
      handleConfirm();
    }
  };
  
  const timeModifiers = useMemo(() => getTimeModifiers(newTimePreview), [newTimePreview]);
  const calendarDescription = useMemo(() => getCalendarDescription(newTimePreview), [newTimePreview]);

  useEffect(() => {
    if (!isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTime({ minutes: 0, hours: 0, days: 0, weeks: 0, months: 0, years: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[var(--z-index-modal-background)] p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="pass-time-title"
    >
      <motion.div
        ref={modalRef}
        {...modalMotion}
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md focus:outline-none"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="pass-time-title" className="text-2xl font-bold text-amber-400 font-cinzel text-center mb-4">Pass Time</h2>
        <div className="text-center mb-4 p-2 bg-gray-900/50 rounded flex flex-col gap-2">
            <div className="flex justify-between text-sm text-gray-400">
                <span>Current:</span>
                <span className="text-sky-300 font-semibold">{formatGameTimeForModal(currentTime)}</span>
            </div>
             <div className="flex justify-between text-sm text-gray-400">
                <span>Result:</span>
                <span className={`font-semibold ${totalSecondsToAdvance > 0 ? 'text-green-300' : 'text-gray-500'}`}>
                    {formatGameTimeForModal(newTimePreview)}
                </span>
            </div>

            {totalSecondsToAdvance > 0 && (
                <div className="mt-2 text-xs italic text-gray-300 border-t border-gray-700 pt-2">
                    <p>{calendarDescription}</p>
                    <p className="mt-1 text-amber-200/80">{timeModifiers.description}</p>
                </div>
            )}
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

        <div className="flex gap-4 mt-6">
            <button onClick={onClose} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Cancel</button>
            <button onClick={handleConfirm} disabled={totalSecondsToAdvance <= 0} className="w-1/2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow disabled:bg-gray-500">Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PassTimeModal;
