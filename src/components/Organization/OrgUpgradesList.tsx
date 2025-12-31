import React from 'react';
import { Organization, OrgUpgrade } from '../../types/organizations';
import { Button } from '../ui/Button';

interface OrgUpgradesListProps {
  organization: Organization;
  availableUpgrades: OrgUpgrade[];
  onPurchase: (upgradeId: string) => void;
}

const OrgUpgradesList: React.FC<OrgUpgradesListProps> = ({ organization, availableUpgrades, onPurchase }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4 border border-gray-700">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Upgrades</h3>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {availableUpgrades.length === 0 ? (
            <div className="text-gray-500 text-center italic py-4">No new upgrades available.</div>
        ) : (
            availableUpgrades.map(upgrade => (
                <UpgradeCard
                    key={upgrade.id}
                    upgrade={upgrade}
                    organization={organization}
                    onPurchase={() => onPurchase(upgrade.id)}
                />
            ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Owned Upgrades</h4>
        <div className="flex flex-wrap gap-2">
            {organization.upgrades.length === 0 && <span className="text-xs text-gray-600">None</span>}
            {organization.upgrades.map(uid => (
                <span key={uid} className="text-xs bg-gray-900 border border-gray-600 px-2 py-1 rounded text-gray-300">
                    {/* Assuming we can fetch name from ID, or pass full map. For now just ID if not in available list */}
                     {/* In a real app we'd look up the name from the catalog */}
                    {uid.replace('_', ' ').toUpperCase()}
                </span>
            ))}
        </div>
      </div>
    </div>
  );
};

const UpgradeCard: React.FC<{ upgrade: OrgUpgrade; organization: Organization; onPurchase: () => void }> = ({ upgrade, organization, onPurchase }) => {
    const canAfford =
        (upgrade.cost.gold || 0) <= organization.resources.gold &&
        (upgrade.cost.influence || 0) <= organization.resources.influence &&
        (upgrade.cost.connections || 0) <= organization.resources.connections &&
        (upgrade.cost.secrets || 0) <= organization.resources.secrets;

    return (
        <div className="bg-gray-900 p-3 rounded border border-gray-700">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="font-bold text-gray-200">{upgrade.name}</div>
                    <div className="text-xs text-gray-400">{upgrade.description}</div>
                </div>
                <Button
                    onClick={onPurchase}
                    disabled={!canAfford}
                    variant={canAfford ? 'primary' : 'secondary'}
                    size="sm"
                >
                    Build
                </Button>
            </div>
            <div className="flex gap-3 text-xs">
                {upgrade.cost.gold && <span className="text-yellow-400">{upgrade.cost.gold} GP</span>}
                {upgrade.cost.influence && <span className="text-purple-400">{upgrade.cost.influence} Inf</span>}
                {upgrade.cost.connections && <span className="text-blue-400">{upgrade.cost.connections} Conn</span>}
                {upgrade.cost.secrets && <span className="text-emerald-400">{upgrade.cost.secrets} Sec</span>}
            </div>
        </div>
    );
};

export default OrgUpgradesList;
// [Castellan] UI component for purchasing organization upgrades.
