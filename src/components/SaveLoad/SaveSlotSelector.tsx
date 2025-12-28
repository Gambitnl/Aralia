import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { AUTO_SAVE_SLOT_KEY, SaveSlotSummary, getSlotStorageKey } from '../../services/saveLoadService';
import { ConfirmationModal } from '../ui/ConfirmationModal';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    slotId: string;
    displayName?: string;
    isAutoSave?: boolean;
    targetName: string;
  } | null>(null);

  const manualSlots = useMemo(
    () => slots.filter(slot => !slot.isAutoSave),
    [slots],
  );

  const normalizedNameLookup = useMemo(() => {
    // Normalize slot names once so repeated overwrite checks during typing are cheap.
    return slots.reduce<Record<string, SaveSlotSummary>>((acc, slot) => {
      acc[slot.slotName.trim().toLowerCase()] = slot;
      return acc;
    }, {});
  }, [slots]);

  const finalizeSave = useCallback(
    (slotId: string, displayName?: string, isAutoSave?: boolean) => {
      // Always send the normalized storage key forward so the invoked save flow
      // writes to the exact slot we vetted for overwrite conflicts. This avoids
      // any mismatch between UI validation and service resolution (e.g., when
      // callers pass human-readable names that need prefixing).
      const resolvedSlotId = getSlotStorageKey(slotId, isAutoSave);
      const trimmedDisplayName = displayName?.trim();
      onSaveSlot(resolvedSlotId, trimmedDisplayName || undefined, isAutoSave);
      setPendingOverwrite(null);
      onClose();
    },
    [onClose, onSaveSlot],
  );

  const handleSave = (slotId: string, displayName?: string, isAutoSave?: boolean) => {
    if (isSavingDisabled) return;
    const trimmedDisplayName = displayName?.trim();
    const targetName = trimmedDisplayName || slotId;
    // Normalize the requested slot so ID collision checks run against the same
    // key shape the save service ultimately uses.
    const normalizedSlotId = getSlotStorageKey(slotId, isAutoSave);
    const hasIdCollision = slots.some(slot => slot.slotId === normalizedSlotId);
    const normalizedTargetName = targetName.trim().toLowerCase();
    const hasNameCollision = Boolean(normalizedNameLookup[normalizedTargetName]);

    if (hasIdCollision || hasNameCollision) {
      // Defer the write until the player explicitly confirms to avoid accidental data loss.
      setPendingOverwrite({ slotId, displayName: trimmedDisplayName, isAutoSave, targetName });
      return;
    }

    finalizeSave(slotId, trimmedDisplayName, isAutoSave);
  };

  useEffect(() => {
    // TODO(QOL): Add automated accessibility tests (axe) to verify focus trap and keyboard navigation in SaveSlotSelector (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path).
    // The dependency axe-core is large, so we only want to load it in development.
    // NOTE: We explicitly use import.meta.env.DEV here instead of ENV.DEV.
    // ENV.DEV is an object property and cannot be statically analyzed by Vite for tree-shaking,
    // causing the heavy 'axe-core' dependency to remain in production bundles. Do not revert.
    if (import.meta.env.DEV && rootRef.current) {
      const node = rootRef.current;
      import('../../utils/testUtils').then(({ runAxe }) => {
        runAxe(node);
      });
    }
  }, []);

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
    <div ref={rootRef} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl p-6 text-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-amber-300">Chronicle Journey</h2>
            <p className="text-sm text-gray-400">Preserve your current state in the archives.</p>
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
            The ink is dry. You cannot chronicle your journey at this moment.
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
          <h3 className="text-lg font-semibold text-amber-200 mb-2">New Entry</h3>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder="Name this memory..."
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
              Scribe Entry
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

      <ConfirmationModal
        isOpen={!!pendingOverwrite}
        onClose={() => setPendingOverwrite(null)}
        onConfirm={() =>
          pendingOverwrite &&
          finalizeSave(pendingOverwrite.slotId, pendingOverwrite.displayName, pendingOverwrite.isAutoSave)
        }
        title="Confirm Overwrite"
        confirmLabel="Overwrite Save"
        cancelLabel="Keep Existing"
      >
        <p>
          Overwriting <span className="font-semibold text-amber-200">{pendingOverwrite?.targetName}</span> will
          replace the existing save data for that slot. This action cannot be undone.
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

export default SaveSlotSelector;
