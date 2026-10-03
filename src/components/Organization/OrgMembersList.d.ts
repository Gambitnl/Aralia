import React from 'react';
import { Organization } from '../../types/organizations';
interface OrgMembersListProps {
    organization: Organization;
    onRecruit: (name: string, className: string) => void;
    onPromote: (memberId: string) => void;
}
declare const OrgMembersList: React.FC<OrgMembersListProps>;
export default OrgMembersList;
