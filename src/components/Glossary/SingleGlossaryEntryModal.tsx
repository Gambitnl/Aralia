import React, { useEffect, useState, useContext, useRef } from 'react';
import { GlossaryEntry } from '../types';
import GlossaryContext from '../context/GlossaryContext';
import { FullEntryDisplay } from './Glossary/FullEntryDisplay';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { findGlossaryEntryAndPath } from '../utils/glossaryUtils';

interface SingleGlossaryEntryModalProps {
  isOpen: boolean;
  initialTermId: string | null;
  onClose: () => void;
}

const SingleGlossaryEntryModal: React.FC<SingleGlossaryEntryModalProps> = ({ isOpen, initialTermId, onClose }) => {
  const [currentTermId, setCurrentTermId] = useState<string | null>(initialTermId);
  const allEntries = useContext(GlossaryContext);

  useEffect(() => {
    if (isOpen) {
      setCurrentTermId(initialTermId);
    }
  }, [isOpen, initialTermId]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const handleInternalNavigation = (newTermId: string) => {
    setCurrentTermId(newTermId);
  };

  if (!isOpen) return null;

  const { entry: currentEntry } = currentTermId && allEntries ? findGlossaryEntryAndPath(currentTermId, allEntries) : { entry: null };

  return (
    <AnimatePresence>
      <motion.div
        {...{
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        } as any}
        className="glossary-entry-modal-overlay"
        onClick={onClose}
      >
        <motion.div
          {...{
            initial: { y: 30, opacity: 0 },
            animate: { y: 0, opacity: 1 },
            exit: { y: 30, opacity: 0 },
            transition: { type: 'spring', stiffness: 300, damping: 30 },
          } as any}
          className="glossary-entry-modal-content"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="glossary-entry-modal-title"
        >
          {allEntries === null ? (
            <LoadingSpinner message="Loading glossary..." />
          ) : (
            <>
              <div className="glossary-entry-modal-header">
                <h2 id="glossary-entry-modal-title" className="glossary-entry-modal-title">
                  {currentEntry?.title || 'Glossary Entry'}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-200 text-3xl font-bold p-1 leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="glossary-entry-modal-body scrollable-content">
                <FullEntryDisplay entry={currentEntry} onNavigate={handleInternalNavigation} />
              </div>
              <div className="glossary-entry-modal-footer">
                 <button
                    onClick={onClose}
                    className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                    aria-label="Close glossary entry"
                  >
                    Close
                  </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SingleGlossaryEntryModal;