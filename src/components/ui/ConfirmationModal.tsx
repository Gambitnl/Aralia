import React, { useRef, useEffect } from 'react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // We can't immediately focus because the element might be animating in.
    // Framer motion mounts immediately, but let's ensure we focus.
    const focusTarget = confirmRef.current || dialogRef.current;

    // Slight delay or requestAnimationFrame can sometimes help if the DOM node isn't ready
    // but typically useEffect runs after mount.
    focusTarget?.focus({ preventScroll: true });

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
        event.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
        focusable[nextIndex]?.focus({ preventScroll: true });
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={dialogRef}
            className="bg-gray-900 border border-amber-500/60 rounded-xl shadow-xl max-w-md w-full p-6 text-gray-100"
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
