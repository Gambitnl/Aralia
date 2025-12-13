import React, { useState } from 'react';
import { SaveSlotSummary } from '../services/saveLoadService';
import { formatGameDateTime } from '../utils/timeUtils';
import ConfirmationModal from './ConfirmationModal';

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
          <p className="text-xs text-gray-400">Saved {formatGameDateTime(new Date(slot.lastSaved))}</p>
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl p-6 text-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-sky-300">Load Game</h2>
            <p className="text-sm text-gray-400">Select a slot to resume your adventure.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close load game dialog"
          >
            ✕
          </button>
        </div>

        {autoSlots.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-sky-200">Auto-Saves</h3>
              <span className="text-xs text-gray-400">Automatically captured safety nets.</span>
            </div>
            <div className="space-y-3">
              {autoSlots.map(renderSlotCard)}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-amber-200">Manual Slots</h3>
            <span className="text-xs text-gray-400">Create as many as you need to experiment.</span>
          </div>
          {manualSlots.length > 0 ? (
            <div className="space-y-3">
              {manualSlots.map(renderSlotCard)}
            </div>
          ) : (
            <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-400">
              No manual saves yet. Start a game and use the Save to Slot menu to capture your progress.
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!slotToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Save Slot"
        confirmLabel="Delete"
        cancelLabel="Keep Save"
      >
        <p>
          Are you sure you want to delete <span className="font-semibold text-amber-200">{slotToDelete?.slotName}</span>?
        </p>
        <p className="mt-2 text-red-300">
          This action cannot be undone. The save data will be permanently lost.
        </p>
      </ConfirmationModal>
    </div>
  );
};

function formatPlaytime(playtimeSeconds?: number) {
  if (!playtimeSeconds || playtimeSeconds <= 0) return '—';
  const hours = Math.floor(playtimeSeconds / 3600);
  const minutes = Math.floor((playtimeSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export default LoadGameModal;
