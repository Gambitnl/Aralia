import React from 'react';
import { Organization, OrgUpgrade } from '../../types/organizations';
interface OrgUpgradesListProps {
    organization: Organization;
    availableUpgrades: OrgUpgrade[];
    onPurchase: (upgradeId: string) => void;
}
declare const OrgUpgradesList: React.FC<OrgUpgradesListProps>;
export default OrgUpgradesList;
