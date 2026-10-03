/**
 * @file ForgeAssetContext.ts
 * React Context provider definition for 3D Forge Asset Services.
 *
 * Extracted from World3DScene.tsx to decouple React Context definitions from component files,
 * ensuring React Fast Refresh works without module invalidation in Vite.
 */
import React from 'react';
import type { ForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';

export const ForgeAssetContext = React.createContext<ForgeAssetService | undefined>(undefined);
