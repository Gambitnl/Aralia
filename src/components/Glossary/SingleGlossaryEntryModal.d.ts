import React from 'react';
interface SingleGlossaryEntryModalProps {
    isOpen: boolean;
    initialTermId: string | null;
    onClose: () => void;
}
declare const SingleGlossaryEntryModal: React.FC<SingleGlossaryEntryModalProps>;
export default SingleGlossaryEntryModal;
