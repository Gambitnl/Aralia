/**
 * Lightweight toast system that replaces browser alerts and provides
 * non-blocking feedback to the player.
 */
import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Notification } from '../types';
import type { AppAction } from '../state/actionTypes';

interface NotificationSystemProps {
  notifications: Notification[];
  dispatch: React.Dispatch<AppAction>;
}

const NotificationToast: React.FC<{ notification: Notification; onDismiss: (id: string) => void }> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const duration = notification.duration || 5000;
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[notification.type];

  // Respect reduced motion preference
  const shouldReduceMotion = useReducedMotion();

  const animations = shouldReduceMotion ? {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.1 }
  } : {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
    transition: { duration: 0.2 }
  };

  return (
    <motion.div
      layout={!shouldReduceMotion}
      {...animations}
      className={`
        pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 ${bgColor} text-white
      `}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
             <p className="text-sm font-medium">{notification.message}</p>
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-transparent text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
              onClick={() => onDismiss(notification.id)}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, dispatch }) => {
  const handleDismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: { id } });
  }, [dispatch]);

  // Mounted at the App root so every pane can dispatch notifications instead of using blocking alerts.
  // Cap at 5 notifications to prevent layout thrash
  const visibleNotifications = notifications.slice(-5);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex flex-col items-end px-4 py-6 sm:items-start sm:p-6 z-50 gap-2"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleNotifications.map((notification) => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={handleDismiss}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
