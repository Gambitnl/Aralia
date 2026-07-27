/**
 * @file CoinDisplay.tsx
 *
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
interface CoinDisplayProps {
    label: string;
    amount: number;
    color: string;
    icon: string;
    tooltip: string;
}
declare const CoinDisplay: React.FC<CoinDisplayProps>;
export default CoinDisplay;
