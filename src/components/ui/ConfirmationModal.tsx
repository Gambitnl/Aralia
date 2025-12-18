import React from 'react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  children,
}) => {
  // Use the standard hook for focus trapping
  // This automatically handles:
  // 1. Initial focus (first button)
  // 2. Trapping Tab/Shift+Tab
  // 3. Handling Escape key
  // 4. Restoring focus on close
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={dialogRef}
            className="bg-gray-900 border border-amber-500/60 rounded-xl shadow-xl max-w-md w-full p-6 text-gray-100 focus:outline-none"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={title}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <h3 className="text-xl font-bold text-amber-300 mb-3">{title}</h3>
            <div className="text-sm text-gray-300 leading-relaxed">
              {children}
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <Button
                onClick={onClose}
                variant="secondary"
                size="md"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={onConfirm}
                variant="action"
                size="md"
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
