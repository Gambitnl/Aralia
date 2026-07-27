import React from 'react';
import { Action } from '../../types';
import { Temple } from '../../types/religion';
interface TempleModalProps {
    isOpen: boolean;
    temple: Temple;
    playerGold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
}
declare const TempleModal: React.FC<TempleModalProps>;
export default TempleModal;
