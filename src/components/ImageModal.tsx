/**
 * @file ImageModal.tsx
 * A component for displaying a large image in a full-screen modal overlay.
 */
import React, { useEffect } from 'react';
import { motion, MotionProps } from 'framer-motion';

interface ImageModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const modalMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const ImageModal: React.FC<ImageModalProps> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
    TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
    TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
    */
    <motion.div
      {...modalMotion}
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-8"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClose();
        }
      }}
      tabIndex={0}
      aria-modal="true"
      role="dialog"
      aria-label="Image viewer"
    >


      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="p-0 border-0 bg-transparent focus:outline-none"
        aria-label="Image preview"
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </button>
       <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-4xl font-bold bg-black/50 p-1 rounded-full leading-none"
            aria-label="Close image viewer"
        >
            &times;
        </button>
    </motion.div>
  );
};

export default ImageModal;
