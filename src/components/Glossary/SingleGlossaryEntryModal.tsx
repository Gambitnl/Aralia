// TODO #84(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
import React, { useEffect, useMemo, useState, useContext } from 'react';
// Dedicated modal for showing a single glossary entry with navigation controls
import { GlossaryEntry } from '../../types';
import GlossaryContext from '../../context/GlossaryContext';
import { FullEntryDisplay } from './FullEntryDisplay';
import SpellCardTemplate, { SpellData } from './SpellCardTemplate';
import { AnimatePresence, motion, MotionProps } from 'framer-motion';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { findGlossaryEntryAndPath } from '../../utils/glossaryUtils';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';

/**
 * Spell glossary entries are manifest-driven: their content lives in a per-spell
 * JSON file (`data/spells/level-{n}/{id}.json`), not at a glossary `filePath`.
 * The level is encoded as a `level N` tag on the entry. Returns null when the
 * entry carries no recognizable level tag.
 */
const resolveSpellJsonLevelFromEntry = (entry: GlossaryEntry): number | null => {
  const levelTag = entry.tags?.find((tag) => /^level\s+\d+$/i.test(tag.trim()));
  const levelText = levelTag?.trim().match(/^level\s+(\d+)$/i)?.[1];
  return levelText ? Number.parseInt(levelText, 10) : null;
};

interface SingleGlossaryEntryModalProps {
  isOpen: boolean;
  initialTermId: string | null;
  onClose: () => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: 30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 30, opacity: 0 },
  transition: { type: 'spring', stiffness: 300, damping: 30 },
};

const SingleGlossaryEntryModal: React.FC<SingleGlossaryEntryModalProps> = ({ isOpen, initialTermId, onClose }) => {
  const [currentTermId, setCurrentTermId] = useState<string | null>(initialTermId);
  const allEntries = useContext(GlossaryContext);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const currentEntry = useMemo<GlossaryEntry | null>(
    () => (currentTermId && allEntries ? findGlossaryEntryAndPath(currentTermId, allEntries).entry : null),
    [currentTermId, allEntries]
  );

  const isSpellEntry = currentEntry?.category === 'Spells';
  const spellLevel = isSpellEntry && currentEntry ? resolveSpellJsonLevelFromEntry(currentEntry) : null;

  const [spellJsonData, setSpellJsonData] = useState<SpellData | null>(null);
  const [spellJsonLoading, setSpellJsonLoading] = useState(false);

  // Load the per-spell JSON when the active entry is a spell. Mirrors the main
  // glossary's loader so spell links opened in this single-entry modal render a
  // full spell card instead of failing (spell entries carry no `filePath`).
  useEffect(() => {
    if (!isSpellEntry || !currentEntry || spellLevel === null) {
      setSpellJsonData(null);
      setSpellJsonLoading(false);
      return;
    }
    const controller = new AbortController();
    const spellId = currentEntry.id;
    setSpellJsonLoading(true);
    fetchWithTimeout<SpellData>(
      assetUrl(`data/spells/level-${spellLevel}/${spellId}.json`),
      { signal: controller.signal }
    )
      .then((data) => {
        setSpellJsonData(data);
        setSpellJsonLoading(false);
      })
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') {
          setSpellJsonData(null);
          setSpellJsonLoading(false);
        }
      });
    return () => controller.abort();
  }, [isSpellEntry, currentEntry, spellLevel]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...overlayMotion}
        className="glossary-entry-modal-overlay"
        onClick={onClose}
      >
        <motion.div
          {...modalMotion}
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
                {isSpellEntry ? (
                  spellJsonLoading ? (
                    <p className="text-gray-400 italic">Loading spell data...</p>
                  ) : spellJsonData ? (
                    <SpellCardTemplate spell={spellJsonData} onNavigateToGlossary={handleInternalNavigation} />
                  ) : (
                    <p className="text-red-400">Failed to load spell data for this entry.</p>
                  )
                ) : (
                  <FullEntryDisplay entry={currentEntry} onNavigate={handleInternalNavigation} />
                )}
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
