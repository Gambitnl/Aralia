/**
 * @file LedgerBook.tsx
 * Main economy UI styled as an enchanted ledger book.
 * Parchment texture, bookmark tabs for Treasury, Investments, Businesses, Debts.
 * The primary in-world interface for the player's financial life.
 */
import React from 'react';
interface LedgerBookProps {
    isOpen: boolean;
    onClose: () => void;
}
declare const LedgerBook: React.FC<LedgerBookProps>;
export default LedgerBook;
