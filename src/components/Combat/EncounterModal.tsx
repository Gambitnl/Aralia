/**
 * @file EncounterModal.tsx
 * A modal component to display a generated D&D encounter.
 * This is now a display-only component. Generation logic is handled before it's shown.
 */
import React, { useEffect, useRef } from 'react';
import { Monster, GroundingChunk, Action, TempPartyMember } from '../../types';
import { CLASSES_DATA } from '../../constants'; // To get class names
import { t } from '../../utils/i18n';
import { WindowFrame } from '../ui/WindowFrame';

interface EncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: Monster[] | null;
  sources: GroundingChunk[] | null;
  error: string | null;
  isLoading: boolean;
  onAction: (action: Action) => void;
  partyUsed?: TempPartyMember[]; // The party used for generation
}

const EncounterModal: React.FC<EncounterModalProps> = ({
  isOpen,
  onClose,
  encounter,
  sources,
  error,
  isLoading,
  onAction,
  partyUsed
}) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Don't focus immediately if still loading
    if (isOpen && !isLoading) {
      // firstFocusableElementRef.current?.focus(); // Removed ref usage as WindowFrame doesn't support passing ref easily to children for focus, and standardized windows don't usually auto-focus internal buttons
    }
  }, [isOpen, isLoading]);

  if (!isOpen) {
    return null;
  }

  const handleSimulateBattle = () => {
    if (encounter) {
      onAction({
        type: 'START_BATTLE_MAP_ENCOUNTER',
        label: 'Simulate Battle',
        payload: { startBattleMapEncounterData: { monsters: encounter } }
      });
      // The modal will be closed by the state update in the reducer
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center p-8">
          <p className="text-xl text-amber-300">{t('encounter_modal.loading')}</p>
          <p className="text-sm text-gray-400 mt-2">{t('encounter_modal.loading_flavor')}</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-6 bg-red-900/30 border border-red-500 rounded-lg">
          <h3 className="text-xl font-bold text-red-400 mb-2">{t('encounter_modal.error_title')}</h3>
          <p className="text-red-300">{error}</p>
        </div>
      );
    }
    if (!encounter || encounter.length === 0) {
      return <p className="text-gray-500 italic text-center p-8">{t('encounter_modal.no_encounter')}</p>;
    }
    return (
      <>
        {partyUsed && partyUsed.length > 0 && (
          <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
            <h5 className="text-xs font-semibold text-sky-400 mb-1">{t('encounter_modal.generated_for')}</h5>
            <p className="text-xs text-gray-400">
              {partyUsed.map(p => `Lvl ${p.level} ${CLASSES_DATA[p.classId]?.name || 'Adventurer'}`).join(', ')}
            </p>
          </div>
        )}
        <div className="space-y-4">
          {encounter.map((monster, index) => (
            <div key={index} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
              <div className="flex justify-between items-baseline">
                <h4 className="text-xl font-bold text-amber-300">{monster.name} x {monster.quantity}</h4>
                <p className="text-sm text-sky-300">CR: {monster.cr}</p>
              </div>
              <p className="text-gray-400 italic mt-1">{monster.description}</p>
            </div>
          ))}
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-600">
            <h4 className="text-md font-semibold text-sky-400 mb-2">{t('encounter_modal.sources')}</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {sources.map((source, index) => (
                <li key={index}>
                  <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-300 underline break-all">
                    {source.web.title || source.web.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  const canSimulate = !isLoading && !error && encounter && encounter.length > 0;

  return (
    <WindowFrame
      title={t('encounter_modal.title')}
      onClose={onClose}
      storageKey="encounter-gen-window"
    >
      <div className="flex flex-col h-full bg-gray-800 p-6">
        <div className="overflow-y-auto scrollable-content flex-grow p-1 pr-2">
          {renderContent()}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={handleSimulateBattle}
            disabled={!canSimulate}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg shadow disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {t('encounter_modal.simulate')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            {t('encounter_modal.close')}
          </button>
        </div>
      </div>
    </WindowFrame>
  );
};

export default EncounterModal;