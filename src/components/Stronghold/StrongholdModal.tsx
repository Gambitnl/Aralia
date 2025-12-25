
import React, { useState } from 'react';
import { Stronghold } from '../../types/stronghold';
import { UPGRADE_CATALOG, getAvailableUpgrades, calculateDefense } from '../../services/strongholdService';
import { Shield, Hammer, Users, Flag, Scroll, Coins, Map as MapIcon, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface StrongholdModalProps {
    isOpen: boolean;
    stronghold: Stronghold;
    onClose: () => void;
    onUpgrade: (upgradeId: string) => void;
    onHire: (role: string, name: string) => void;
    onMissionStart: (staffId: string, missionType: string) => void;
}

export const StrongholdModal: React.FC<StrongholdModalProps> = ({
    isOpen,
    stronghold,
    onClose,
    onUpgrade,
    onHire,
    onMissionStart
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'upgrades' | 'staff' | 'missions'>('overview');
    const [recruitName, setRecruitName] = useState('');
    const [recruitRole, setRecruitRole] = useState('guard');

    if (!isOpen) return null;

    const availableUpgrades = getAvailableUpgrades(stronghold);
    const defense = calculateDefense(stronghold);

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col items-center">
                    <Coins className="text-yellow-500 mb-2" />
                    <span className="text-gray-400 text-sm">Treasury</span>
                    <span className="text-xl font-bold">{stronghold.resources.gold} gp</span>
                    <span className="text-xs text-green-400">+{stronghold.dailyIncome}/day</span>
                </div>
                <div className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col items-center">
                    <Shield className="text-blue-500 mb-2" />
                    <span className="text-gray-400 text-sm">Defense</span>
                    <span className="text-xl font-bold">{defense}</span>
                </div>
                <div className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col items-center">
                    <Users className="text-purple-500 mb-2" />
                    <span className="text-gray-400 text-sm">Staff</span>
                    <span className="text-xl font-bold">{stronghold.staff.length}</span>
                </div>
                <div className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col items-center">
                    <Scroll className="text-amber-500 mb-2" />
                    <span className="text-gray-400 text-sm">Supplies</span>
                    <span className="text-xl font-bold">{stronghold.resources.supplies}</span>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Flag className="text-red-500" size={20} />
                    Active Threats
                </h3>
                {stronghold.threats.length === 0 ? (
                    <p className="text-gray-500 italic">No immediate threats detected.</p>
                ) : (
                    <div className="space-y-2">
                        {stronghold.threats.map(threat => (
                            <div key={threat.id} className="bg-red-900/20 border border-red-800 p-3 rounded">
                                <div className="flex justify-between">
                                    <span className="font-bold text-red-300">{threat.name}</span>
                                    <span className="text-red-400">Severity: {threat.severity}</span>
                                </div>
                                <p className="text-sm text-gray-300">{threat.description}</p>
                                <p className="text-xs text-red-500 mt-1">Triggers in {threat.daysUntilTrigger} days</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <h3 className="text-lg font-bold mb-3">Recent Logs</h3>
                {/* Placeholder for logs - ideally passed in via props or selector */}
                <p className="text-gray-500 italic">No recent activity logged.</p>
            </div>
        </div>
    );

    const renderUpgrades = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableUpgrades.length === 0 ? (
                <div className="col-span-2 text-center text-gray-500 italic py-8">
                    No upgrades available at this time.
                </div>
            ) : (
                availableUpgrades.map(upgrade => (
                    <div key={upgrade.id} className="bg-gray-800 p-4 rounded border border-gray-600 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-lg mb-1">{upgrade.name}</h4>
                            <p className="text-gray-400 text-sm mb-3">{upgrade.description}</p>
                            <div className="text-sm space-y-1 mb-4">
                                <p className="text-yellow-500">Cost: {upgrade.cost.gold} gp</p>
                                <p className="text-amber-500">Supplies: {upgrade.cost.supplies}</p>
                                <ul className="text-xs text-blue-300 mt-2 list-disc list-inside">
                                    {upgrade.effects.map((e, i) => (
                                        <li key={i}>{e.type.replace('_', ' ')}: +{e.value}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <Button
                            onClick={() => onUpgrade(upgrade.id)}
                            disabled={stronghold.resources.gold < upgrade.cost.gold || stronghold.resources.supplies < upgrade.cost.supplies}
                            className="w-full"
                        >
                            Construct
                        </Button>
                    </div>
                ))
            )}

            <div className="col-span-2 mt-6">
                <h3 className="text-lg font-bold text-gray-400 mb-2">Completed Upgrades</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {stronghold.upgrades.map(id => (
                        <div key={id} className="bg-gray-900 border border-gray-700 p-2 rounded text-sm text-gray-300">
                            {UPGRADE_CATALOG[id]?.name || id}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderStaff = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <h3 className="font-bold mb-4">Recruit New Staff</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={recruitName}
                        onChange={(e) => setRecruitName(e.target.value)}
                        placeholder="Name"
                        className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white flex-1"
                    />
                    <select
                        value={recruitRole}
                        onChange={(e) => setRecruitRole(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                    >
                        <option value="guard">Guard (5gp)</option>
                        <option value="steward">Steward (10gp)</option>
                        <option value="spy">Spy (15gp)</option>
                        <option value="merchant">Merchant (8gp)</option>
                        <option value="blacksmith">Blacksmith (6gp)</option>
                        <option value="priest">Priest (4gp)</option>
                    </select>
                    <Button onClick={() => {
                        onHire(recruitRole, recruitName);
                        setRecruitName('');
                    }} disabled={!recruitName}>
                        Hire
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stronghold.staff.map(staff => (
                    <div key={staff.id} className="bg-gray-800 p-4 rounded border border-gray-600 relative">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold">{staff.name}</h4>
                                <span className="text-xs uppercase text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{staff.role}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm text-gray-400">Wage: {staff.dailyWage}gp</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-700 h-2 rounded-full mb-2">
                            <div
                                className={`h-full rounded-full ${staff.morale > 50 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${staff.morale}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Morale: {staff.morale}%</p>

                        {staff.currentMissionId ? (
                             <div className="bg-amber-900/30 border border-amber-800/50 p-2 rounded text-xs text-amber-200 text-center">
                                On Mission
                            </div>
                        ) : (
                            <div className="flex gap-2 mt-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full text-xs"
                                    onClick={() => onMissionStart(staff.id, 'scout')} // Simple default for now
                                >
                                    Assign Mission
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMissions = () => (
        <div className="space-y-4">
             {stronghold.missions.length === 0 ? (
                <div className="text-center text-gray-500 py-8 bg-gray-800 rounded border border-gray-700">
                    No active missions. Assign staff in the Staff tab.
                </div>
            ) : (
                stronghold.missions.map(mission => (
                    <div key={mission.id} className="bg-gray-800 p-4 rounded border border-purple-500/50">
                        <div className="flex justify-between mb-2">
                            <h4 className="font-bold text-purple-300">{mission.description}</h4>
                            <span className="text-xs text-gray-400">{mission.daysRemaining} days left</span>
                        </div>
                        <div className="text-sm text-gray-300 mb-2">
                            Type: <span className="uppercase">{mission.type}</span> | Diff: {mission.difficulty}
                        </div>
                        <div className="text-xs text-gray-500">
                            Assigned Staff ID: {mission.staffId}
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-amber-900 rounded-lg max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
                 {/* Header */}
                 <div className="bg-gray-800 p-4 border-b border-amber-900 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                            <Shield size={24} />
                            {stronghold.name}
                        </h2>
                        <div className="text-sm text-gray-400 capitalize">{stronghold.type} • Level {stronghold.level}</div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700 bg-gray-900">
                    <button
                        className={`flex-1 py-4 text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-amber-900/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <MapIcon size={18} /> Overview
                    </button>
                    <button
                        className={`flex-1 py-4 text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'upgrades' ? 'bg-amber-900/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('upgrades')}
                    >
                        <Hammer size={18} /> Upgrades
                    </button>
                    <button
                        className={`flex-1 py-4 text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'staff' ? 'bg-amber-900/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('staff')}
                    >
                        <Users size={18} /> Staff
                    </button>
                    <button
                        className={`flex-1 py-4 text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'missions' ? 'bg-amber-900/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('missions')}
                    >
                        <Flag size={18} /> Missions
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-900/50">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'upgrades' && renderUpgrades()}
                    {activeTab === 'staff' && renderStaff()}
                    {activeTab === 'missions' && renderMissions()}
                </div>
            </div>
        </div>
    );
};
