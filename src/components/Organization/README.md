# Organization Components

This directory contains the UI components for the Organization Management system, allowing players to manage their guilds, orders, and syndicates.

## Components

- **`OrganizationDashboard.tsx`**: The main container component (modal/screen) that orchestrates the UI. It holds the local state and handles service calls.
- **`OrgOverview.tsx`**: Displays the organization's name, type, and current resources (Gold, Influence, Connections, Secrets).
- **`OrgMembersList.tsx`**: Lists current members with their ranks and loyalty. Provides UI for recruiting new members and promoting existing ones.
- **`OrgMissionsList.tsx`**: Shows active missions and allows the player to plan new operations by assigning members.
- **`OrgUpgradesList.tsx`**: A shop interface for purchasing organization upgrades (facilities) that provide bonuses.

## Usage

```tsx
import OrganizationDashboard from '@/components/Organization/OrganizationDashboard';

// ... inside a parent component
{isOrgOpen && (
  <OrganizationDashboard
    initialOrganization={myOrganization}
    onClose={() => setIsOrgOpen(false)}
    onUpdate={(updatedOrg) => saveOrg(updatedOrg)}
  />
)}
```

## Styling
Components use Tailwind CSS with a dark theme consistent with the rest of the application (`bg-gray-900`, `bg-gray-800`).

## Dependencies
- `src/services/organizationService.ts`: For business logic (recruit, promote, mission logic).
- `src/types/organizations.ts`: For Type definitions.
