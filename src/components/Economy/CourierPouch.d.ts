/**
 * @file CourierPouch.tsx
 * Courier message delivery UI — sealed scrolls and letters.
 * Wax seal icon on unread messages. Click to "break seal" and read.
 * Sorted by arrival day. Gives the medieval feel of information trickling in.
 */
import React from 'react';
import { PendingCourier } from '../../types/economy';
interface CourierPouchProps {
    isOpen: boolean;
    onClose: () => void;
    deliveredMessages?: PendingCourier[];
}
declare const CourierPouch: React.FC<CourierPouchProps>;
export default CourierPouch;
