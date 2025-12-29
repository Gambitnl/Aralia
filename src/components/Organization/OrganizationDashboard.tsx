import React, { useState } from 'react';
import { Organization, OrgType } from '../../types/organizations';
import OrgOverview from './OrgOverview';
import OrgMembersList from './OrgMembersList';
import OrgUpgradesList from './OrgUpgradesList';
import OrgMissionsList from './OrgMissionsList';
import {
    getAvailableOrgUpgrades,
    recruitMember,
    promoteMember,
    purchaseOrgUpgrade,
    startMission
} from '../../services/organizationService';

interface OrganizationDashboardProps {
  initialOrganization: Organization;
  onUpdate?: (updatedOrg: Organization) => void;
  onClose?: () => void;
}

const OrganizationDashboard: React.FC<OrganizationDashboardProps> = ({ initialOrganization, onUpdate, onClose }) => {
  const [organization, setOrganization] = useState<Organization>(initialOrganization);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'upgrades' | 'missions'>('overview');
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = (updatedOrg: Organization) => {
    setOrganization(updatedOrg);
    if (onUpdate) onUpdate(updatedOrg);
    setError(null);
  };

  const handleRecruit = (name: string, className: string) => {
    try {
        const updated = recruitMember(organization, name, className, 1);
        handleUpdate(updated);
    } catch (e: any) {
        setError(e.message);
    }
  };

  const handlePromote = (memberId: string) => {
      try {
          const updated = promoteMember(organization, memberId);
          handleUpdate(updated);
      } catch (e: any) {
          setError(e.message);
      }
  };

  const handlePurchase = (upgradeId: string) => {
      try {
          const updated = purchaseOrgUpgrade(organization, upgradeId);
          handleUpdate(updated);
      } catch (e: any) {
          setError(e.message);
      }
  };

  const handleStartMission = (desc: string, diff: number, members: string[]) => {
      try {
          // Simple rewards logic for now
          const rewards = { gold: diff * 10, influence: 5 };
          const updated = startMission(organization, desc, diff, members, rewards);
          handleUpdate(updated);
      } catch (e: any) {
          setError(e.message);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-gray-700">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl">
            <h1 className="text-2xl font-bold text-white tracking-wider flex items-center gap-2">
                🏰 Organization Management
            </h1>
            {onClose && (
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors text-2xl"
                    aria-label="Close"
                >
                    &times;
                </button>
            )}
        </div>

        {/* Navigation */}
        <div className="flex border-b border-gray-700 bg-gray-800">
            <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</NavButton>
            <NavButton active={activeTab === 'members'} onClick={() => setActiveTab('members')}>Members ({organization.members.length})</NavButton>
            <NavButton active={activeTab === 'missions'} onClick={() => setActiveTab('missions')}>Missions ({organization.missions.length})</NavButton>
            <NavButton active={activeTab === 'upgrades'} onClick={() => setActiveTab('upgrades')}>Upgrades</NavButton>
        </div>

        {/* Error Message */}
        {error && (
            <div className="bg-red-900/50 border-b border-red-800 text-red-200 px-4 py-2 text-sm flex justify-between items-center">
                <span>⚠️ {error}</span>
                <button onClick={() => setError(null)} className="text-red-300 hover:text-white">&times;</button>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
            {activeTab === 'overview' && <OrgOverview organization={organization} />}

            {activeTab === 'members' && (
                <OrgMembersList
                    organization={organization}
                    onRecruit={handleRecruit}
                    onPromote={handlePromote}
                />
            )}

            {activeTab === 'missions' && (
                <OrgMissionsList
                    organization={organization}
                    onStartMission={handleStartMission}
                />
            )}

            {activeTab === 'upgrades' && (
                <OrgUpgradesList
                    organization={organization}
                    availableUpgrades={getAvailableOrgUpgrades(organization)}
                    onPurchase={handlePurchase}
                />
            )}
        </div>

      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            active
            ? 'border-amber-500 text-amber-500 bg-gray-700/50'
            : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
        }`}
    >
        {children}
    </button>
);

export default OrganizationDashboard;
// [Castellan] Main dashboard container for organization management.
