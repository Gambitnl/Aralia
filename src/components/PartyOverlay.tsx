/**
 * @file PartyOverlay.tsx
 * A modal overlay to display the player's party members.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { PlayerCharacter, MissingChoice, GameState } from '../types';
import PartyPane from './PartyPane';
import { RelationshipsPane } from './RelationshipsPane';
import { COMPANIONS } from '../constants'; // Fallback

// We need to access GameState companions if possible, but props might limit us.
// Let's assume we can pass companions as a prop or fallback to constants.
// I'll update the interface to accept optional companions record.

interface PartyOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  party: PlayerCharacter[];
  onViewCharacterSheet: (character: PlayerCharacter) => void;
  onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
  companions?: Record<string, any>; // Optional for now
}

type Tab = 'party' | 'relationships';

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: 30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 30, opacity: 0 },
};

const PartyOverlay: React.FC<PartyOverlayProps> = ({ isOpen, onClose, party, onViewCharacterSheet, onFixMissingChoice, companions }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('party');
  
  // Use passed companions or fallback to static data if not provided (e.g. from tests/legacy)
  const activeCompanions = companions || COMPANIONS;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      // closeButtonRef.current?.focus(); // Removed auto-focus on close button to let user tab naturally
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        {...modalMotion}
        className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
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
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900/50">
            <button
                onClick={() => setActiveTab('party')}
                className={`flex-1 py-3 px-4 text-center font-cinzel font-bold transition-colors ${
                    activeTab === 'party'
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-800'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
            >
                Party Roster
            </button>
            <button
                onClick={() => setActiveTab('relationships')}
                className={`flex-1 py-3 px-4 text-center font-cinzel font-bold transition-colors ${
                    activeTab === 'relationships'
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-800'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
            >
                Relationships
            </button>
        </div>

        <div className="overflow-y-auto scrollable-content p-4">
          {activeTab === 'party' ? (
              <PartyPane party={party} onViewCharacterSheet={onViewCharacterSheet} onFixMissingChoice={onFixMissingChoice} />
          ) : (
              <RelationshipsPane companions={activeCompanions} />
          )}
        </div>

      </motion.div>
    </motion.div>
  );
};

export default PartyOverlay;
