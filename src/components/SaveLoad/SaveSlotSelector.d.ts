import React from 'react';
import { SaveSlotSummary } from '../../services/saveLoadService';
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
declare const SaveSlotSelector: React.FC<SaveSlotSelectorProps>;
export default SaveSlotSelector;
