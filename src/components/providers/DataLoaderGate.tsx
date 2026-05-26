import React, { useContext } from 'react';
import SpellContext from '../../context/SpellContext';
import GlossaryContext from '../../context/GlossaryContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface DataLoaderGateProps {
  children: React.ReactNode;
}

/**
 * A gate that blocks rendering of its children until core data (spells, glossary)
 * has been fully loaded into their respective contexts.
 * This is used to ensure the game or character creator doesn't crash on missing data,
 * without blocking the initial Main Menu load.
 */
export const DataLoaderGate: React.FC<DataLoaderGateProps> = ({ children }) => {
  const spellData = useContext(SpellContext);
  const glossaryData = useContext(GlossaryContext);

  if (spellData === null || glossaryData === null) {
    return <LoadingSpinner message="Loading ancient archives..." />;
  }

  return <>{children}</>;
};
