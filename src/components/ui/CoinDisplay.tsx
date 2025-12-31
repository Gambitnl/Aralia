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
    
    
    {/*
      TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
      TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
      TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
    */}
    <button
      type="button"
      className={`flex flex-col items-center justify-center p-2 rounded bg-gray-800 border border-gray-600 min-w-[3.5rem] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent cursor-help`}
      aria-label={`${amount} ${tooltip}`}
      tabIndex={0}
    >
      <span className="text-lg filter drop-shadow-md" aria-hidden="true">{icon}</span>
      <span className={`text-xs font-bold ${color}`} aria-hidden="true">{amount}</span>
      <span className="text-[9px] text-gray-500 uppercase tracking-wider" aria-hidden="true">{label}</span>
    </button>
  </Tooltip>
);

export default CoinDisplay;
