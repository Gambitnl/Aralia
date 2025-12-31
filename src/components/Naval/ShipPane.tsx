// [Captain] New component to visualize the player's ship state
import React, { useState } from 'react';
import { Ship } from '../../types/naval';
import { motion } from 'framer-motion';
import { X, Anchor, Users, Package } from 'lucide-react';

interface ShipPaneProps {
  ship: Ship;
  onClose: () => void;
}

export const ShipPane: React.FC<ShipPaneProps> = ({ ship, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'crew' | 'cargo'>('overview');

  const getHealthColor = (current: number, max: number) => {
    const pct = current / max;
    if (pct > 0.66) return 'text-green-400';
    if (pct > 0.33) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-800/50">
              <Anchor className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-cinzel">{ship.name}</h2>
              <p className="text-xs text-blue-300 uppercase tracking-wider">{ship.size} {ship.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex p-2 gap-2 bg-gray-900/50 border-b border-gray-800">
          <NavButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<Anchor className="w-4 h-4" />}
            label="Overview"
          />
          <NavButton
            active={activeTab === 'crew'}
            onClick={() => setActiveTab('crew')}
            icon={<Users className="w-4 h-4" />}
            label="Crew"
          />
          <NavButton
            active={activeTab === 'cargo'}
            onClick={() => setActiveTab('cargo')}
            icon={<Package className="w-4 h-4" />}
            label="Cargo"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900/80">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Hull Integrity"
                  value={`${ship.stats.hullPoints} / ${ship.stats.maxHullPoints}`}
                  subtext="Structural Health"
                  colorClass={getHealthColor(ship.stats.hullPoints, ship.stats.maxHullPoints)}
                />
                <StatCard
                  label="Speed"
                  value={`${ship.stats.speed} ft`}
                  subtext="Combat Movement"
                />
                <StatCard
                  label="Maneuverability"
                  value={ship.stats.maneuverability > 0 ? `+${ship.stats.maneuverability}` : `${ship.stats.maneuverability}`}
                  subtext="Steering Modifier"
                />
              </div>

              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-gray-300 italic">&quot;{ship.description}&quot;</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Modifications</h3>
                    {ship.modifications.length === 0 ? (
                      <p className="text-gray-500 text-sm">No modifications installed.</p>
                    ) : (
                      <ul className="space-y-2">
                        {ship.modifications.map(mod => (
                          <li key={mod.id} className="text-sm text-gray-300 flex justify-between">
                            <span>{mod.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                 </div>
                 <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Weapons</h3>
                    {ship.weapons.length === 0 ? (
                      <p className="text-gray-500 text-sm">No weapons mounted.</p>
                    ) : (
                      <ul className="space-y-2">
                        {ship.weapons.map(w => (
                          <li key={w.id} className="text-sm text-gray-300 flex justify-between">
                            <span>{w.name} ({w.type})</span>
                            <span className="text-gray-500">{w.damage}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'crew' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-400">
                  <span className="text-gray-200 font-bold">{ship.crew.members.length}</span> / {ship.stats.crewMax} Crew
                </div>
                <div className="text-sm text-gray-400">
                  Morale: <span className={ship.crew.averageMorale < 40 ? 'text-red-400' : 'text-green-400'}>{ship.crew.averageMorale}%</span>
                </div>
              </div>

              <div className="grid gap-2">
                {ship.crew.members.map(member => (
                  <div key={member.id} className="flex items-center justify-between bg-gray-800/40 p-3 rounded border border-gray-700/50">
                    <div>
                      <div className="font-medium text-gray-200">{member.name}</div>
                      <div className="text-xs text-blue-400 uppercase">{member.role}</div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                       <div>Wage: {member.dailyWage}gp</div>
                       <div>Loyalty: {member.loyalty}%</div>
                    </div>
                  </div>
                ))}
              </div>

              {ship.crew.members.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  No crew assigned. Visit a tavern to recruit.
                </div>
              )}
            </div>
          )}

          {activeTab === 'cargo' && (
            <div className="space-y-4">
               <div className="bg-gray-800/50 p-4 rounded mb-4 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 uppercase">Capacity</div>
                    <div className="text-xl font-mono text-gray-200">
                      {ship.cargo.totalWeight} / {ship.stats.cargoCapacity} <span className="text-sm text-gray-500">tons</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase">Supplies</div>
                    <div className="text-sm text-gray-300">Food: {ship.cargo.supplies.food} days</div>
                    <div className="text-sm text-gray-300">Water: {ship.cargo.supplies.water} days</div>
                  </div>
               </div>

               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b border-gray-700 text-gray-500 uppercase text-xs">
                     <th className="pb-2">Item</th>
                     <th className="pb-2 text-right">Qty</th>
                     <th className="pb-2 text-right">Weight</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                   {ship.cargo.items.map(item => (
                     <tr key={item.id} className="text-gray-300">
                       <td className="py-2">{item.name} {item.isContraband && <span className="ml-2 text-xs text-red-400 bg-red-900/20 px-1 rounded">ILLEGAL</span>}</td>
                       <td className="py-2 text-right">{item.quantity}</td>
                       <td className="py-2 text-right">{item.weightPerUnit * item.quantity}t</td>
                     </tr>
                   ))}
                   {ship.cargo.items.length === 0 && (
                     <tr>
                       <td colSpan={3} className="py-8 text-center text-gray-600">Empty Hold</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors text-sm font-medium ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
        : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
    }`}
  >
    {icon}
    {label}
  </button>
);

const StatCard = ({ label, value, subtext, colorClass = 'text-white' }: { label: string, value: string, subtext: string, colorClass?: string }) => (
  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col items-center text-center">
    <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</span>
    <span className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</span>
    <span className="text-xs text-gray-600 mt-1">{subtext}</span>
  </div>
);
