import React from 'react';
import { Organization } from '../../types/organizations';

interface OrgOverviewProps {
  organization: Organization;
}

const OrgOverview: React.FC<OrgOverviewProps> = ({ organization }) => {
  // Rough estimate for game day display, assuming foundedDate is a timestamp
  // In a real scenario, this might need a proper date formatter from timeUtils
  const foundedDay = new Date(organization.foundedDate).toLocaleDateString();

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className="text-2xl font-bold text-amber-500">{organization.name}</h2>
            <p className="text-gray-400 capitalize text-sm">{organization.type} • {organization.members.length} Members</p>
        </div>
        <div className="text-right">
            <div className="text-xs text-gray-500">Founded</div>
            <div className="text-sm text-gray-300">{foundedDay}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ResourceCard label="Gold" value={organization.resources.gold} color="text-yellow-400" />
        <ResourceCard label="Influence" value={organization.resources.influence} color="text-purple-400" />
        <ResourceCard label="Connections" value={organization.resources.connections} color="text-blue-400" />
        <ResourceCard label="Secrets" value={organization.resources.secrets} color="text-emerald-400" />
      </div>

      <div className="mt-4 text-sm text-gray-400 italic">
        {organization.description}
      </div>
    </div>
  );
};

const ResourceCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="bg-gray-900 p-3 rounded border border-gray-700 text-center">
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
);

export default OrgOverview;
// [Castellan] UI component to display high-level organization stats and resources.
