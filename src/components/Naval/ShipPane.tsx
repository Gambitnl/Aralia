// [Captain] New component to visualize the player's ship state
import React, { useState } from 'react';
import { Ship } from '../../types/naval';
import { Anchor, Users, Package } from 'lucide-react';
import { WindowFrame } from '../ui/WindowFrame';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';

interface ShipPaneProps {
  ship: Ship;
  onClose: () => void;
}

export const ShipPane: React.FC<ShipPaneProps> = ({ ship, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'crew' | 'cargo'>('overview');

  return (
    <WindowFrame
      title={ship.name}
      onClose={onClose}
      storageKey="ship-pane-window"
    >
      <div className="flex flex-col h-full bg-gray-900">
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
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Hull" value={`${ship.stats.hullPoints}/${ship.stats.maxHullPoints}`} subtext="Hit Points" colorClass="text-green-400" />
                <StatCard label="Speed" value={ship.stats.speed.toString()} subtext="Knots" />
                {/* TODO: Replace simple count (ship.weapons.length) with a calculated "Firepower" rating or Damage Per Second (DPS) metric.
                    Currently just shows number of weapons, which gives little indication of actual combat effectiveness.
                    Naval battle mechanics need to be looked up online to ensure that proper D&D mechanics are used.
                    Find official rules where possible, and lean into addendum rules which are widely accepted by community where official rules don't cover the logic completely. */}
                <StatCard label="Weapons" value={ship.weapons.length.toString()} subtext="Installed" />
                <StatCard label="Manuever" value={ship.stats.maneuverability.toString()} subtext="Rating" />
              </div>

              <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Modifications</h3>
                <div className="flex flex-wrap gap-2">
                  {ship.modifications.length > 0 ? (
                    ship.modifications.map((u, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded border border-blue-800/50">
                        {u.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm italic">No modifications installed</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'crew' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-800/50 p-3 rounded">
                <span className="text-gray-400 uppercase text-xs">Crew Size</span>
                <span className="text-xl font-mono text-white">{ship.crew.members.length} / {ship.stats.crewMax}</span>
              </div>

              <div className="space-y-2">
                {ship.crew.members.map(member => (
                  <div key={member.id} className="bg-gray-800 p-3 rounded flex justify-between items-center border border-gray-700">
                    <div>
                      <div className="font-bold text-gray-200">{member.name}</div>
                      <div className="text-xs text-gray-500">{member.role}</div>
                    </div>
                    <div className="text-sm text-gray-400">Loyalty: {member.loyalty}%</div>
                  </div>
                ))}
                {ship.crew.members.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    No crew assigned. Visit a tavern to recruit.
                  </div>
                )}
              </div>
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
                  {/* TODO: Verify supply unit conversion logic.
                      Currently displaying raw values as "days". Ensure that 1 unit of food/water strictly equates to 1 day of consumption for the current crew size to prevent player confusion.
                      Naval battle mechanics need to be looked up online to ensure that proper D&D mechanics are used.
                      Find official rules where possible, and lean into addendum rules which are widely accepted by community where official rules don't cover the logic completely. */}
                  <div className="text-sm text-gray-300">Food: {ship.cargo.supplies.food} days</div>
                  <div className="text-sm text-gray-300">Water: {ship.cargo.supplies.water} days</div>
                </div>
              </div>

              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-b border-gray-700">
                    <TableHead className="pb-2 text-gray-500 uppercase text-xs">Item</TableHead>
                    <TableHead className="pb-2 text-right text-gray-500 uppercase text-xs">Qty</TableHead>
                    <TableHead className="pb-2 text-right text-gray-500 uppercase text-xs">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-800">
                  {ship.cargo.items.map(item => (
                    <TableRow key={item.id} className="text-gray-300">
                      <TableCell className="py-2">{item.name} {item.isContraband && <span className="ml-2 text-xs text-red-400 bg-red-900/20 px-1 rounded">ILLEGAL</span>}</TableCell>
                      <TableCell className="py-2 text-right">{item.quantity}</TableCell>
                      <TableCell className="py-2 text-right">{item.weightPerUnit * item.quantity}t</TableCell>
                    </TableRow>
                  ))}
                  {ship.cargo.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-gray-600">Empty Hold</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors text-sm font-medium ${active
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
