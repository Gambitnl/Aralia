import React, { useState } from 'react';
import { SaveSlotSummary } from '../../services/saveLoadService';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface LoadGameModalProps {
  slots: SaveSlotSummary[];
  onClose: () => void;
  onLoadSlot: (slotId: string) => void;
  onDeleteSlot: (slotId: string) => void;
}

/**
 * Modal for browsing and loading saves. This component focuses purely on
 * presentation/selection; persistence and side-effects remain in the caller.
 */
const LoadGameModal: React.FC<LoadGameModalProps> = ({ slots, onClose, onLoadSlot, onDeleteSlot }) => {
  const [slotToDelete, setSlotToDelete] = useState<SaveSlotSummary | null>(null);

  const manualSlots = slots.filter(slot => !slot.isAutoSave);
  const autoSlots = slots.filter(slot => slot.isAutoSave);

  const handleDeleteClick = (slot: SaveSlotSummary) => {
    setSlotToDelete(slot);
  };

  const handleConfirmDelete = () => {
    if (slotToDelete) {
      onDeleteSlot(slotToDelete.slotId);
      setSlotToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setSlotToDelete(null);
  };

  const renderSlotCard = (slot: SaveSlotSummary) => (
    <div key={slot.slotId} className="border border-gray-700 rounded-lg p-4 bg-gray-800 flex flex-col shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-amber-200">{slot.slotName}</h3>
          <p className="text-xs text-gray-400">Saved {new Date(slot.lastSaved).toLocaleString()}</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => onLoadSlot(slot.slotId)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold"
          >
            Load
          </button>
          <button
            onClick={() => handleDeleteClick(slot)}
            className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-semibold"
            aria-label={`Delete save ${slot.slotName}`}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-300 mt-3">
        <div className="flex flex-col">
          <span className="text-gray-400">Location</span>
          <span>{slot.locationName || 'Unknown'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400">Avg. Level</span>
          <span>{slot.partyLevel ?? '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400">Playtime</span>
          <span>{formatPlaytime(slot.playtimeSeconds)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <WindowFrame
      title="Resume Journey"
      onClose={onClose}
      storageKey={WINDOW_KEYS.LOAD_GAME}
      initialMaximized={false}
    >
      <div className="flex flex-col h-full text-gray-100">
        <div className="shrink-0 px-6 pt-6 pb-3">
          <p className="text-sm text-gray-400">Choose a moment in time to return to.</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {autoSlots.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-sky-200">Echoes (Auto-Saves)</h3>
                <span className="text-xs text-gray-400">Moments preserved automatically by the Weave.</span>
              </div>
              <div className="space-y-3">
                {autoSlots.map(renderSlotCard)}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-amber-200">Chronicles</h3>
              <span className="text-xs text-gray-400">Permanent records of your legend.</span>
            </div>
            {manualSlots.length > 0 ? (
              <div className="space-y-3">
                {manualSlots.map(renderSlotCard)}
              </div>
            ) : (
              <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-400 italic">
                The archives are silent. Begin your journey and use &quot;Chronicle Journey&quot; to chronicle your deeds.
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!slotToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Erase Chronicle"
        confirmLabel="Erase Forever"
        cancelLabel="Keep Memory"
      >
        <p>
          Are you sure you want to strike <span className="font-semibold text-amber-200">{slotToDelete?.slotName}</span> from the archives?
        </p>
        <p className="mt-2 text-red-300">
          This timeline will be lost to the void. This action cannot be undone.
        </p>
      </ConfirmationModal>
    </WindowFrame>
  );
};

function formatPlaytime(playtimeSeconds?: number) {
  if (!playtimeSeconds || playtimeSeconds <= 0) return '—';
  const hours = Math.floor(playtimeSeconds / 3600);
  const minutes = Math.floor((playtimeSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export default LoadGameModal;
