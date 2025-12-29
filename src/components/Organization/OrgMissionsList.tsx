import React, { useState } from 'react';
import { Organization, OrgMission } from '../../types/organizations';
import { Button } from '../ui/Button';

interface OrgMissionsListProps {
  organization: Organization;
  onStartMission: (description: string, difficulty: number, assignedMemberIds: string[]) => void;
}

const OrgMissionsList: React.FC<OrgMissionsListProps> = ({ organization, onStartMission }) => {
    const [isPlanning, setIsPlanning] = useState(false);
    const [description, setDescription] = useState('');
    const [difficulty, setDifficulty] = useState(15);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    // Filter available members (not already on mission)
    const activeMissionMemberIds = organization.missions.flatMap(m => m.assignedMemberIds);
    const availableMembers = organization.members.filter(m => !activeMissionMemberIds.includes(m.id));

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        if (description && selectedMembers.length > 0) {
            onStartMission(description, difficulty, selectedMembers);
            setIsPlanning(false);
            setDescription('');
            setSelectedMembers([]);
        }
    };

    const toggleMember = (id: string) => {
        if (selectedMembers.includes(id)) {
            setSelectedMembers(selectedMembers.filter(m => m !== id));
        } else {
            setSelectedMembers([...selectedMembers, id]);
        }
    };

    return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-200">Active Missions</h3>
        <Button onClick={() => setIsPlanning(!isPlanning)} variant="action" size="sm">
          {isPlanning ? 'Cancel' : 'New Mission'}
        </Button>
      </div>

      {isPlanning && (
        <form onSubmit={handleStart} className="bg-gray-700 p-4 rounded mb-4 border border-gray-600">
            <h4 className="text-lg text-white mb-2">Plan Operation</h4>

            <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">Objective</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1"
                    placeholder="e.g. Infiltrate the castle"
                />
            </div>

            <div className="mb-3">
                 <label className="block text-xs text-gray-400 mb-1">Difficulty (DC: {difficulty})</label>
                 <input
                    type="range"
                    min="10"
                    max="30"
                    value={difficulty}
                    onChange={(e) => setDifficulty(parseInt(e.target.value))}
                    className="w-full"
                 />
            </div>

            <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Assign Agents ({selectedMembers.length})</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-gray-900 p-2 rounded">
                    {availableMembers.length === 0 && <span className="text-xs text-gray-500">No agents available.</span>}
                    {availableMembers.map(m => (
                        <div
                            key={m.id}
                            onClick={() => toggleMember(m.id)}
                            className={`text-xs p-1 cursor-pointer rounded border ${selectedMembers.includes(m.id) ? 'bg-blue-900 border-blue-500 text-white' : 'border-transparent text-gray-400 hover:bg-gray-800'}`}
                        >
                            {m.name} (Lvl {m.level})
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-right">
                <Button type="submit" variant="primary" size="sm" disabled={!description || selectedMembers.length === 0}>
                    Deploy
                </Button>
            </div>
        </form>
      )}

      <div className="space-y-3">
        {organization.missions.length === 0 ? (
            <div className="text-gray-500 text-center italic py-4">No active operations.</div>
        ) : (
            organization.missions.map(mission => (
                <MissionCard key={mission.id} mission={mission} organization={organization} />
            ))
        )}
      </div>
    </div>
  );
};

const MissionCard: React.FC<{ mission: OrgMission; organization: Organization }> = ({ mission, organization }) => {
    // Get member names
    const agents = organization.members.filter(m => mission.assignedMemberIds.includes(m.id)).map(m => m.name).join(', ');

    return (
        <div className="bg-gray-900 p-3 rounded border border-gray-700">
            <div className="flex justify-between mb-1">
                <div className="font-bold text-gray-200">{mission.description}</div>
                <div className="text-xs text-amber-400 font-mono">{mission.daysRemaining} days left</div>
            </div>
            <div className="text-xs text-gray-400">
                <span className="text-gray-500">Agents:</span> {agents}
            </div>
            <div className="text-xs text-gray-400 mt-1">
                <span className="text-gray-500">Difficulty:</span> DC {mission.difficulty}
            </div>
        </div>
    );
};

export default OrgMissionsList;
// [Castellan] UI component for planning and viewing organization missions.
