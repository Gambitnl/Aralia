import React, { useState } from 'react';
import { Organization, OrgMember } from '../../types/organizations';
import { Button } from '../ui/Button';

interface OrgMembersListProps {
  organization: Organization;
  onRecruit: (name: string, className: string) => void;
  onPromote: (memberId: string) => void;
}

const OrgMembersList: React.FC<OrgMembersListProps> = ({ organization, onRecruit, onPromote }) => {
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [recruitName, setRecruitName] = useState('');
  const [recruitClass, setRecruitClass] = useState('Fighter');

  const handleRecruitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recruitName) {
      onRecruit(recruitName, recruitClass);
      setRecruitName('');
      setIsRecruiting(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-200">Members</h3>
        <Button onClick={() => setIsRecruiting(!isRecruiting)} variant="primary" size="sm">
          {isRecruiting ? 'Cancel' : 'Recruit'}
        </Button>
      </div>

      {isRecruiting && (
        <form onSubmit={handleRecruitSubmit} className="bg-gray-700 p-4 rounded mb-4 border border-gray-600">
            <h4 className="text-lg text-white mb-2">Recruit New Member</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/*
                  TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
                  TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
                  TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
                */}
                <div>
                    
                    
                    <label htmlFor="org-recruit-name" className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                        id="org-recruit-name"
                        type="text"
                        value={recruitName}
                        onChange={(e) => setRecruitName(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1"
                        placeholder="Character Name"
                    />
                </div>
                {/*
                  TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
                  TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
                  TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
                */}
                <div>
                    
                    
                    <label htmlFor="org-recruit-class" className="block text-xs text-gray-400 mb-1">Class</label>
                    <select
                        id="org-recruit-class"
                        value={recruitClass}
                        onChange={(e) => setRecruitClass(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1"
                    >
                        <option value="Fighter">Fighter</option>
                        <option value="Rogue">Rogue</option>
                        <option value="Wizard">Wizard</option>
                        <option value="Cleric">Cleric</option>
                        <option value="Bard">Bard</option>
                    </select>
                </div>
            </div>
            <div className="text-right">
                <Button type="submit" variant="secondary" size="sm" disabled={!recruitName}>Confirm (50gp)</Button>
            </div>
        </form>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {organization.members.length === 0 ? (
            <div className="text-gray-500 text-center italic py-4">No members yet.</div>
        ) : (
            organization.members.map(member => (
                <MemberCard key={member.id} member={member} onPromote={() => onPromote(member.id)} />
            ))
        )}
      </div>
    </div>
  );
};

const MemberCard: React.FC<{ member: OrgMember; onPromote: () => void }> = ({ member, onPromote }) => (
    <div className="bg-gray-900 p-3 rounded border border-gray-700 flex justify-between items-center">
        <div>
            <div className="font-bold text-gray-200">{member.name}</div>
            <div className="text-xs text-gray-400">
                Lvl {member.level} {member.class} • <span className="text-amber-400 capitalize">{member.rank}</span>
            </div>
        </div>
        <div className="text-right flex items-center gap-4">
            <div className="text-xs">
                <div className="text-gray-500">Loyalty</div>
                <div className={`${member.loyalty > 70 ? 'text-green-400' : member.loyalty < 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {member.loyalty}%
                </div>
            </div>
            {member.rank !== 'master' && (
                 <button
                    onClick={onPromote}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded border border-gray-600 transition-colors"
                    title="Promote Member"
                >
                    Promote
                 </button>
            )}
        </div>
    </div>
);

export default OrgMembersList;
// [Castellan] UI component for managing organization members (recruit, promote).
