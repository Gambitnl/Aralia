/**
 * @file CombatLog.tsx
 * Displays a log of combat events.
 */
import React, { useRef, useEffect } from 'react';
import { CombatLogEntry } from '../../types/combat';

interface CombatLogProps {
  logEntries: CombatLogEntry[];
}

const CombatLog: React.FC<CombatLogProps> = ({ logEntries }) => {
    const logEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logEntries]);

    const getEntryStyle = (type: CombatLogEntry['type']) => {
        switch(type) {
            case 'damage': return 'text-red-400';
            case 'heal': return 'text-green-400';
            case 'status': return 'text-purple-400';
            case 'turn_start': return 'text-amber-300 font-semibold';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 h-48 overflow-y-auto scrollable-content">
            <h3 className="text-center text-sm font-bold text-amber-300 mb-2 sticky top-0 bg-gray-800/90 py-1">Combat Log</h3>
            <div className="space-y-1 text-sm">
                {logEntries.map(entry => (
                    <p key={entry.id} className={getEntryStyle(entry.type)}>
                        {entry.message}
                    </p>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};

export default CombatLog;
