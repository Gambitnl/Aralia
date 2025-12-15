import React from 'react';
import Tooltip from './Tooltip';

interface CoinDisplayProps {
  label: string;
  amount: number;
  color: string;
  icon: string;
  tooltip: string;
}

const CoinDisplay: React.FC<CoinDisplayProps> = ({ label, amount, color, icon, tooltip }) => (
  <Tooltip content={tooltip}>
    <div
      className={`flex flex-col items-center justify-center p-2 rounded bg-gray-800 border border-gray-600 min-w-[3.5rem] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent cursor-help`}
      tabIndex={0}
      aria-label={`${amount} ${tooltip}`}
    >
      <span className="text-lg filter drop-shadow-md" aria-hidden="true">{icon}</span>
      <span className={`text-xs font-bold ${color}`} aria-hidden="true">{amount}</span>
      <span className="text-[9px] text-gray-500 uppercase tracking-wider" aria-hidden="true">{label}</span>
    </div>
  </Tooltip>
);

export default CoinDisplay;
