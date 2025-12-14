import React, { useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Small timeout to ensure element is in DOM after animation starts
    // though AnimatePresence mounts it immediately, focus sometimes needs a tick
    const timer = setTimeout(() => {
      const focusTarget = confirmRef.current || dialogRef.current;
      focusTarget?.focus({ preventScroll: true });
    }, 10);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
        return;
      }

      if (event.key === 'Tab') {
        // Simple focus trap
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

        if (event.shiftKey) {
             if (currentIndex <= 0) {
                 event.preventDefault();
                 focusable[focusable.length - 1]?.focus();
             }
        } else {
            if (currentIndex === focusable.length - 1) {
                event.preventDefault();
                focusable[0]?.focus();
            }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-gray-900 border border-amber-500/60 rounded-xl shadow-xl max-w-md w-full p-6 text-gray-100"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={title}
          >
            <h3 className="text-xl font-bold text-amber-300 mb-3">{title}</h3>
            <div className="text-sm text-gray-300 leading-relaxed">
              {children}
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <Button
                ref={cancelRef}
                onClick={onClose}
                variant="secondary"
                size="md"
              >
                {cancelLabel}
              </Button>
              <Button
                ref={confirmRef}
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

export default ConfirmationModal;
