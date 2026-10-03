import React from 'react';
import { Organization } from '../../types/organizations';
interface OrganizationDashboardProps {
    initialOrganization: Organization;
    onUpdate?: (updatedOrg: Organization) => void;
    onClose?: () => void;
}
declare const OrganizationDashboard: React.FC<OrganizationDashboardProps>;
export default OrganizationDashboard;
