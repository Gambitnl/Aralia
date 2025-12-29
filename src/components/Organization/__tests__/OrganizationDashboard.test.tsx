import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import OrganizationDashboard from '../OrganizationDashboard';
import { createOrganization, recruitMember } from '../../../services/organizationService';
import { Organization } from '../../../types/organizations';

// Mock the service functions
vi.mock('../../../services/organizationService', async () => {
    const actual = await vi.importActual('../../../services/organizationService');
    return {
        ...actual as any,
        recruitMember: vi.fn((org, name, cls) => ({
            ...org,
            members: [...org.members, { id: 'new-mem', name, class: cls, rank: 'initiate', level: 1, loyalty: 50 }],
            resources: { ...org.resources, gold: org.resources.gold - 50 }
        })),
        startMission: vi.fn((org, desc) => ({
            ...org,
            missions: [...org.missions, { id: 'new-miss', description: desc, assignedMemberIds: ['mem-1'], daysRemaining: 3, difficulty: 15 }]
        }))
    };
});

describe('OrganizationDashboard', () => {
    let mockOrg: Organization;

    beforeEach(() => {
        mockOrg = createOrganization('Test Guild', 'guild', 'player-1');
        mockOrg.resources.gold = 1000;
        vi.clearAllMocks();
    });

    it('renders the dashboard with overview by default', () => {
        render(<OrganizationDashboard initialOrganization={mockOrg} />);

        expect(screen.getByText('Test Guild')).toBeInTheDocument();
        expect(screen.getByText(/Organization Management/i)).toBeInTheDocument();
        expect(screen.getByText('Overview')).toHaveClass('text-amber-500'); // Active tab
    });

    it('switches tabs correctly', () => {
        render(<OrganizationDashboard initialOrganization={mockOrg} />);

        const membersTabs = screen.getAllByText(/Members/i);
        const navButton = membersTabs.find(el => el.tagName === 'BUTTON');
        if (!navButton) throw new Error("Could not find Members tab button");

        fireEvent.click(navButton);

        expect(screen.getByText('No members yet.')).toBeInTheDocument();
        expect(screen.queryByText('Gold')).not.toBeInTheDocument();
    });

    it('handles recruitment flow', () => {
        render(<OrganizationDashboard initialOrganization={mockOrg} />);

        const membersTabs = screen.getAllByText(/Members/i);
        const navButton = membersTabs.find(el => el.tagName === 'BUTTON');
        if (!navButton) throw new Error("Could not find Members tab button");

        fireEvent.click(navButton);

        // Open recruit form
        fireEvent.click(screen.getByText('Recruit'));

        // Fill form
        const nameInput = screen.getByPlaceholderText('Character Name');
        fireEvent.change(nameInput, { target: { value: 'New Recruit' } });

        // Submit
        fireEvent.click(screen.getByText(/Confirm/i));

        // Check if update happened
        expect(screen.getByText('New Recruit')).toBeInTheDocument();
        // Use a more flexible matcher for "Lvl 1 Fighter" since it might be split by formatting
        expect(screen.getByText((content, element) => {
            return element?.textContent === 'Lvl 1 Fighter • initiate';
        })).toBeInTheDocument();
    });

    it('displays error message on failure', () => {
         mockOrg.resources.gold = 0;

         render(<OrganizationDashboard initialOrganization={mockOrg} />);

         const membersTabs = screen.getAllByText(/Members/i);
         const navButton = membersTabs.find(el => el.tagName === 'BUTTON');
         if (!navButton) throw new Error("Could not find Members tab button");

         fireEvent.click(navButton);
         fireEvent.click(screen.getByText('Recruit'));

         const nameInput = screen.getByPlaceholderText('Character Name');
         fireEvent.change(nameInput, { target: { value: 'Expensive Recruit' } });

         // Mock the implementation for this test to throw
         (recruitMember as any).mockImplementationOnce(() => { throw new Error('Not enough gold'); });

         fireEvent.click(screen.getByText(/Confirm/i));

         expect(screen.getByText(/⚠️ Not enough gold/i)).toBeInTheDocument();
    });
});
