import React from 'react';
import { motion } from 'framer-motion';
import { X, Activity } from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { DEITIES } from '../../data/deities';

interface DivineFavorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FavorBar = ({ favor }: { favor: number }) => {
  // Normalize -100 to 100 range to 0 to 100% for the bar
  const _normalizedValue = (favor + 100) / 2;

  let colorClass = 'bg-gray-400';
  if (favor >= 80) colorClass = 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]';
  else if (favor >= 25) colorClass = 'bg-blue-400';
  else if (favor <= -80) colorClass = 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.6)]';
  else if (favor <= -25) colorClass = 'bg-orange-500';

  return (
    <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden relative border border-gray-600">
      {/* Center Marker */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10 opacity-50" />

      {/* Bar */}
      <motion.div
        className={`h-full ${colorClass}`}
        initial={{ width: '0%' }}
        animate={{
            width: `${Math.abs(favor) / 2}%`,
            left: favor >= 0 ? '50%' : undefined,
            right: favor < 0 ? '50%' : undefined
        }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
};

export const DivineFavorPanel: React.FC<DivineFavorPanelProps> = ({ isOpen, onClose }) => {
  const { state } = useGameState();
  const knownDeityIds = state.religion?.discoveredDeities || [];

  // Also include any deities we have non-zero favor with, even if not explicitly "known"
  const activeFavorIds = Object.keys(state.religion?.divineFavor || {});
  const allDisplayIds = Array.from(new Set([...knownDeityIds, ...activeFavorIds]));

  const displayDeities = allDisplayIds
    .map(id => {
      const def = DEITIES.find(d => d.id === id);
      const favor = state.religion?.divineFavor[id];
      return { def, favor };
    })
    // TODO: tighten these types once deity discovery/favor flows are modeled; right now we allow partial data to still render.
    .filter((item) => item.def) as { def: import('../../types/religion').Deity; favor: import('../../types/religion').DivineFavor | undefined }[];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-100 font-serif tracking-wide">Divine Favor</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {displayDeities.length === 0 ? (
            <div className="text-center py-20 text-gray-500 italic">
              <p>The gods are silent. You have not yet drawn the gaze of the divine.</p>
              <p className="text-sm mt-2">Visit temples or perform significant deeds to attract their attention.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayDeities.map(({ def, favor }) => {
                const favorVal = favor?.score || 0;
                const status = favor?.rank || 'Neutral';

                return (
                  <div key={def.id} className="bg-gray-800/40 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-200">{def.name}</h3>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">
                           {/* Enum values are strings like "Lawful Good", need to be careful with access if using Enum directly */}
                           {def.alignment} • {def.domains.join(', ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded
                          ${status === 'Chosen' ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-700' :
                            status === 'Champion' || status === 'Devotee' ? 'bg-blue-900/50 text-blue-200 border border-blue-700' :
                            status === 'Shunned' ? 'bg-orange-900/50 text-orange-200 border border-orange-700' :
                            status === 'Heretic' ? 'bg-red-900/50 text-red-200 border border-red-700' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Heretic (-100)</span>
                        <span>Neutral (0)</span>
                        <span>Chosen (100)</span>
                      </div>
                      <FavorBar favor={favorVal} />
                      <div className="text-center text-xs text-gray-400 mt-1">
                        Current Favor: {favorVal}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Commandments</h4>
                        <ul className="text-sm text-gray-300 list-disc list-inside space-y-0.5">
                          {def.commandments.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      {favor?.history && favor.history.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Recent History</h4>
                          <div className="space-y-1">
                            {favor.history.slice(0, 3).map((h, i) => (
                              <div key={i} className="text-xs flex justify-between text-gray-400 border-b border-gray-700/50 pb-1 last:border-0">
                                <span>{h.reason}</span>
                                <span className={h.change > 0 ? 'text-green-400' : 'text-red-400'}>
                                  {h.change > 0 ? '+' : ''}{h.change}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
