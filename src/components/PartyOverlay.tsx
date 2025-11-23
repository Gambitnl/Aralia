/**
 * @file PartyOverlay.tsx
 * A modal overlay to display the player's party members.
 */
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PlayerCharacter, MissingChoice } from '../types';
import PartyPane from './PartyPane';

interface PartyOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  party: PlayerCharacter[];
  onViewCharacterSheet: (character: PlayerCharacter) => void;
  onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
}

const PartyOverlay: React.FC<PartyOverlayProps> = ({ isOpen, onClose, party, onViewCharacterSheet, onFixMissingChoice }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      closeButtonRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

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
    >
      <motion.div
        {...{
          initial: { y: 30, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 30, opacity: 0 },
        } as any}
        className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="party-overlay-title"
      >
        <button 
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-3xl p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-400 z-10"
          aria-label="Close Party View"
        >&times;</button>
        
        <div className="overflow-y-auto scrollable-content">
          <PartyPane party={party} onViewCharacterSheet={onViewCharacterSheet} onFixMissingChoice={onFixMissingChoice} />
        </div>

      </motion.div>
    </motion.div>
  );
};

export default PartyOverlay;