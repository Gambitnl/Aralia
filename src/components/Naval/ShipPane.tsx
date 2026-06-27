// [Captain] New component to visualize the player's ship state
import React, { useState, useEffect } from 'react';
import { Ship, VoyageState, VoyageLogEntry } from '../../types/naval';
import { Anchor, Users, Package, Navigation } from 'lucide-react';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';

interface ShipPaneProps {
  ship: Ship;
  onClose: () => void;
  voyage?: VoyageState | null;
  onAdvanceDay?: () => void;
}

type ActiveTab = 'overview' | 'crew' | 'cargo' | 'voyage';

export const ShipPane: React.FC<ShipPaneProps> = ({ ship, onClose, voyage, onAdvanceDay }) => {
  const hasVoyage = voyage != null;
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // If the voyage clears (e.g. on arrival, 3C-4) while the Voyage tab is active,
  // fall back to a valid tab so the content area never goes blank.
  useEffect(() => {
    if (!hasVoyage && activeTab === 'voyage') setActiveTab('overview');
  }, [hasVoyage, activeTab]);

  return (
    <WindowFrame
      title={ship.name}
      onClose={onClose}
      storageKey={WINDOW_KEYS.SHIP_PANE}
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
          {hasVoyage && (
            <NavButton
              active={activeTab === 'voyage'}
              onClick={() => setActiveTab('voyage')}
              icon={<Navigation className="w-4 h-4" />}
              label="Voyage"
            />
          )}
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

          {activeTab === 'voyage' && hasVoyage && (
            <VoyageTab voyage={voyage!} onAdvanceDay={onAdvanceDay} />
          )}
        </div>
      </div>
    </WindowFrame>
  );
};

// ── Voyage Tab ────────────────────────────────────────────────────────────────

interface VoyageTabProps {
  voyage: VoyageState;
  onAdvanceDay?: () => void;
}

const VoyageTab: React.FC<VoyageTabProps> = ({ voyage, onAdvanceDay }) => {
  const isDocked = voyage.status === 'Docked';
  const progressPct = voyage.distanceToDestination > 0
    ? Math.min(100, Math.round((voyage.distanceTraveled / voyage.distanceToDestination) * 100))
    : 100;

  // Most-recent entries first
  const logEntries = [...voyage.log].reverse();

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Status" value={voyage.status} subtext="Current" colorClass={isDocked ? 'text-green-400' : 'text-blue-300'} />
        <StatCard label="Days at Sea" value={voyage.daysAtSea.toString()} subtext="Elapsed" />
        <StatCard label="Weather" value={voyage.currentWeather} subtext="Conditions" />
        <StatCard label="Distance" value={`${voyage.distanceTraveled} / ${voyage.distanceToDestination}`} subtext="Miles" />
      </div>

      {/* Progress bar */}
      <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Supplies consumed */}
      <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Supplies Consumed</h3>
        <div className="flex gap-6">
          <span className="text-sm text-gray-300">Food: {voyage.suppliesConsumed.food} days</span>
          <span className="text-sm text-gray-300">Water: {voyage.suppliesConsumed.water} days</span>
        </div>
      </div>

      {/* Advance / Docked action */}
      {isDocked ? (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
          <p className="text-green-300 font-semibold">Arrived — docked at destination.</p>
          <p className="text-gray-400 text-sm mt-1">Close this pane to return to the world.</p>
        </div>
      ) : (
        <button
          onClick={onAdvanceDay}
          disabled={!onAdvanceDay}
          className="w-full py-3 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
        >
          Advance a day at sea
        </button>
      )}

      {/* Voyage log */}
      <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Voyage Log</h3>
        {logEntries.length === 0 ? (
          <p className="text-gray-600 text-sm italic">No entries yet.</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {logEntries.map((entry, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-gray-600 font-mono w-12 shrink-0">Day {entry.day}</span>
                <span className={logEntryColor(entry.type)}>{entry.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const logEntryColor = (type: VoyageLogEntry['type']): string => {
  switch (type) {
    case 'Info': return 'text-gray-300';
    case 'Warning': return 'text-yellow-300';
    case 'Combat': return 'text-red-400';
    case 'Discovery': return 'text-purple-300';
    case 'Fluff': return 'text-gray-400';
    default: return 'text-gray-300';
  }
};

// ── Shared sub-components ─────────────────────────────────────────────────────

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
