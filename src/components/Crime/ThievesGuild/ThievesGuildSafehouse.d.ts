import React from 'react';
import { GuildMembership } from '../../../types/crime';
interface ThievesGuildSafehouseProps {
    membership: GuildMembership;
    onUseService: (serviceId: string, cost: number, description: string) => void;
    onClose: () => void;
}
export declare const ThievesGuildSafehouse: React.FC<ThievesGuildSafehouseProps>;
export {};
