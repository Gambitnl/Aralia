import React from 'react';
import { Organization } from '../../types/organizations';
interface OrgMissionsListProps {
    organization: Organization;
    onStartMission: (description: string, difficulty: number, assignedMemberIds: string[]) => void;
}
declare const OrgMissionsList: React.FC<OrgMissionsListProps>;
export default OrgMissionsList;
