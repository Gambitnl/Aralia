import React, { useMemo, useState } from 'react';
import { AUTO_SAVE_SLOT_KEY, SaveSlotSummary } from '../services/saveLoadService';

interface SaveSlotSelectorProps {
  slots: SaveSlotSummary[];
  onSaveSlot: (slotId: string, displayName?: string, isAutoSave?: boolean) => void;
  onClose: () => void;
  allowAutoSave?: boolean;
  isSavingDisabled?: boolean;
}

/**
 * SaveSlotSelector renders a lightweight dialog for choosing a manual save slot.
 * The component is intentionally stateless with respect to persistence; it
 * simply forwards the selected slotId back to the parent so the parent can
 * call the appropriate save action. This keeps save logic centralized in
 * the service/hook layer and avoids duplicating side-effects in the UI.
 */
const SaveSlotSelector: React.FC<SaveSlotSelectorProps> = ({
  slots,
  onSaveSlot,
  onClose,
  allowAutoSave = false,
  isSavingDisabled = false,
}) => {
  const [newSlotName, setNewSlotName] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const manualSlots = useMemo(
    () => slots.filter(slot => !slot.isAutoSave),
    [slots],
  );

  const handleSave = (slotId: string, displayName?: string, isAutoSave?: boolean) => {
    if (isSavingDisabled) return;
    const targetName = displayName || slotId;
    const shouldOverwrite = slots.some(slot => slot.slotId === slotId);
    if (shouldOverwrite) {
      // Use a simple confirm dialog to avoid accidental overwrites.
      const confirmed = window.confirm(`Overwrite existing save slot "${targetName}"?`);
      if (!confirmed) return;
    }
    onSaveSlot(slotId, displayName, isAutoSave);
    onClose();
  };

  const renderPreview = (slot: SaveSlotSummary) => (
    <div className="text-xs text-gray-300 mt-1">
      <div className="flex items-center justify-between">
        <span>Location</span>
        <span>{slot.locationName || 'Unknown'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Party Avg. Level</span>
        <span>{slot.partyLevel ?? '—'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Playtime</span>
        <span>{formatPlaytime(slot.playtimeSeconds)}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl p-6 text-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-amber-300">Save to Slot</h2>
            <p className="text-sm text-gray-400">Choose a slot to overwrite or create a new one.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close save slot selector"
          >
            ✕
          </button>
        </div>

        {isSavingDisabled && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
            Saving is currently unavailable. Return to your adventure to create manual saves.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {manualSlots.map(slot => (
            <button
              key={slot.slotId}
              onClick={() => setSelectedSlotId(slot.slotId)}
              className={`text-left border rounded-lg p-3 transition shadow-sm ${
                selectedSlotId === slot.slotId
                  ? 'border-emerald-400 bg-emerald-900/20'
                  : 'border-gray-700 hover:border-emerald-500 hover:bg-gray-700/30'
              } ${isSavingDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={isSavingDisabled}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-emerald-200">{slot.slotName}</span>
                <span className="text-xs text-gray-400">{new Date(slot.lastSaved).toLocaleString()}</span>
              </div>
              {renderPreview(slot)}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-amber-200 mb-2">Create New Slot</h3>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder="Enter slot name"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={() => {
                const trimmed = newSlotName.trim();
                if (!trimmed) return;
                handleSave(trimmed, trimmed);
              }}
              disabled={!newSlotName.trim() || isSavingDisabled}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                newSlotName.trim() && !isSavingDisabled
                  ? 'bg-amber-500 hover:bg-amber-400 text-gray-900'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Save New Slot
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-x-2">
            <button
              onClick={() => selectedSlotId && handleSave(selectedSlotId)}
              disabled={!selectedSlotId || isSavingDisabled}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                selectedSlotId && !isSavingDisabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Save to Selected
            </button>
            {allowAutoSave && (
              <button
                onClick={() => handleSave(AUTO_SAVE_SLOT_KEY, 'Auto-Save', true)}
                disabled={isSavingDisabled}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  !isSavingDisabled
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Update Auto-Save
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

function formatPlaytime(playtimeSeconds?: number) {
  if (!playtimeSeconds || playtimeSeconds <= 0) return '—';
  const hours = Math.floor(playtimeSeconds / 3600);
  const minutes = Math.floor((playtimeSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export default SaveSlotSelector;
