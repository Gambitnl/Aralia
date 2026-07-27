import type { PlayerCharacter } from '../../types';
interface ThreeDModalProps {
    isOpen: boolean;
    onClose: () => void;
    worldSeed: number;
    biomeId: string;
    gameTime: Date;
    playerSpeed: number;
    partyMembers: PlayerCharacter[];
    parentWorldMapCoords: {
        x: number;
        y: number;
    };
    playerSubmapCoords: {
        x: number;
        y: number;
    };
    onMove?: (direction: 'North' | 'South' | 'East' | 'West') => void;
    isDevModeEnabled?: boolean;
    devModelOverride?: string | null;
}
declare const ThreeDModal: ({ isOpen, onClose, worldSeed, biomeId, gameTime, playerSpeed, partyMembers, parentWorldMapCoords, playerSubmapCoords, onMove, isDevModeEnabled, devModelOverride, }: ThreeDModalProps) => import("react").JSX.Element;
export default ThreeDModal;
