/**
 * @file CommerceDesk.tsx
 * The Commerce Desk — the player's dedicated in-world home for commerce
 * (economy E-G1). One non-debug surface to inspect and manage businesses,
 * read the trade map, track ventures/debts, and review courier intel.
 *
 * Deeper single-purpose surfaces (Enchanted Ledger, Investment Notice Board,
 * Trade Route Monitor, Courier Pouch) stay reachable from here, but the desk
 * itself reads live state and carries the management affordances:
 * tend a business, dismiss a manager, set stronghold prices, collect matured
 * ventures, repay loans.
 */
import React from 'react';
interface CommerceDeskProps {
    isOpen: boolean;
    onClose: () => void;
}
declare const CommerceDesk: React.FC<CommerceDeskProps>;
export default CommerceDesk;
