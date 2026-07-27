/**
 * @file InvestmentBoard.tsx
 * Tavern notice board UI with pinned parchments for investment opportunities.
 * Shows available caravan investments, loan offers, and speculation opportunities.
 * Styled as a wooden notice board with pinned notices.
 */
import React from 'react';
import { LoanOffer } from '../../types/economy';
interface InvestmentBoardProps {
    isOpen: boolean;
    onClose: () => void;
    onInvestInCaravan?: (routeId: string, amount: number) => void;
    onTakeLoan?: (offer: LoanOffer, amount: number, duration: number) => void;
}
declare const InvestmentBoard: React.FC<InvestmentBoardProps>;
export default InvestmentBoard;
