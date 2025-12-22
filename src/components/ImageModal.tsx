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
    <motion.div
      {...modalMotion}
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-8"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Image viewer"
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
      />
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
