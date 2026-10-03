/**
 * This file renders the Real Estate & Property Management interface (RealEstateModal).
 *
 * Players use this modal to inspect, acquire, and manage physical commercial
 * holdings (such as taverns, apothecaries, smithies, and trade strongholds).
 *
 * Features include:
 * - Reviewing player-owned properties, daily revenue, staff managers, and maintenance costs.
 * - Browsing commercial real estate listings available for acquisition in the current city.
 * - Adjusting pricing strategies (budget, standard, luxury) and hiring business managers.
 *
 * Called by: GameModals.tsx, PlayingScreen.tsx, or CommerceDesk.tsx
 * Depends on: WindowFrame, BusinessManagement, BusinessAcquisition, GameContext
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:29
 * Dependents: components/Economy/index.ts, components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// ============================================================================
// Imports
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgePercent,
    Building,
    CheckCircle2,
    Coins,
    Crown,
    DollarSign,
    Hammer,
    Home,
    Key,
    Landmark,
    PlusCircle,
    Store,
    TrendingUp,
    UserCheck,
    Users,
    Wallet,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { BusinessState, WorldBusiness } from '../../types/business';
import { canPurchaseBusiness } from '../../systems/economy/BusinessAcquisition';
import { formatGpAsCoins } from '../../utils/character';

// ============================================================================
// Props & Types
// ============================================================================
export interface RealEstateModalProps {
    // Controls modal visibility
    isOpen?: boolean;
    // Callback when the player closes the real estate modal
    onClose?: () => void;
    // Optional callback when purchasing a property
    onPurchaseProperty?: (businessId: string, cost: number) => void;
}

type RealEstateTab = 'holdings' | 'market';

// ============================================================================
// Main Component
// ============================================================================
export const RealEstateModal: React.FC<RealEstateModalProps> = ({
    isOpen = true,
    onClose,
    onPurchaseProperty,
}) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<RealEstateTab>('holdings');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    // List of player-owned businesses
    const ownedBusinesses = useMemo(() => {
        const list: { id: string; state: BusinessState; worldInfo?: WorldBusiness }[] = [];
        const busMap = state.businesses || {};
        const worldMap = state.worldBusinesses || {};

        // Legacy stronghold businesses already belong to the player's holdings.
        // Standalone deeds use the world-business ownership contract instead.
        for (const [id, bState] of Object.entries(busMap)) {
            list.push({ id, state: bState, worldInfo: worldMap[id] });
        }
        for (const business of Object.values(worldMap)) {
            if (business.ownerType === 'player' && !list.some(entry => entry.id === business.id)) {
                list.push({ id: business.id, state: { ...business, strongholdId: business.strongholdId ?? '' }, worldInfo: business });
            }
        }
        return list;
    }, [state.businesses, state.worldBusinesses]);

    // Commercial real estate listings available for acquisition
    const availableProperties = useMemo(() => {
        const list: WorldBusiness[] = [];
        const worldMap = state.worldBusinesses || {};

        for (const bus of Object.values(worldMap)) {
            if (bus.ownerType === 'npc' && canPurchaseBusiness(bus, state.gold, state.economy).npcWilling) {
                list.push(bus);
            }
        }
        return list;
    }, [state.worldBusinesses, state.gold, state.economy]);

    if (!isOpen) return null;

    // Handle acquiring a commercial listing
    const handleBuyProperty = (property: WorldBusiness) => {
        const eligibility = canPurchaseBusiness(property, state.gold, state.economy);
        const cost = eligibility.askingPrice;
        if (property.ownerType !== 'npc' || !eligibility.npcWilling || !eligibility.canAfford) return;

        if (onPurchaseProperty) {
            onPurchaseProperty(property.id, cost);
        } else {
            dispatch({
                // The native transaction transfers the deed and deducts gold once.
                type: 'PURCHASE_BUSINESS',
                payload: { businessId: property.id, negotiatedPrice: cost },
            });
        }
    };

    return (
        <WindowFrame
            title="Real Estate & Property Holdings"
            storageKey={WINDOW_KEYS.REAL_ESTATE}
            onClose={onClose}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
                {/* Header Banner */}
                <div className="shrink-0 px-6 py-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-amber-400" />
                        <div>
                            <div className="text-sm font-bold text-amber-200">Commercial Land Office &amp; Deeds</div>
                            <div className="text-xs text-slate-400">Manage business holdings, assign managers, and acquire regional deeds</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 font-bold text-sm">
                        <Wallet className="w-4 h-4 text-amber-400" />
                        <span>Purse: {formatGpAsCoins(state.gold || 0)}</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="shrink-0 px-6 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('holdings')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'holdings'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Home className="w-3.5 h-3.5" />
                        <span>Your Properties ({ownedBusinesses.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('market')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'market'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Store className="w-3.5 h-3.5" />
                        <span>Property Market ({availableProperties.length})</span>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 scrollable-content">
                    {/* Tab 1: Owned Holdings */}
                    {activeTab === 'holdings' && (
                        <div className="space-y-4">
                            {ownedBusinesses.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <Home className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">You currently own no physical real estate or businesses.</p>
                                    <p className="text-xs text-slate-400">
                                        Check the Property Market tab to acquire commercial properties, shops, or taverns.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {ownedBusinesses.map(({ id, state: bus, worldInfo }) => (
                                        <div
                                            key={id}
                                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-300">{worldInfo?.name || id}</h4>
                                                    <div className="text-xs text-slate-400 mt-0.5 capitalize">{bus.businessType.replaceAll('_', ' ')}</div>
                                                </div>
                                                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950/60 text-emerald-300 rounded border border-emerald-800/40">
                                                    Operating
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 p-2 rounded bg-slate-950/60 text-xs text-center">
                                                <div>
                                                    <div className="text-slate-400">Daily Net</div>
                                                    <div className="font-bold text-emerald-400">{bus.lastDailyReport.profit} GP</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-400">Customer satisfaction</div>
                                                    <div className="font-bold text-slate-200">{bus.metrics.customerSatisfaction}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-400">Manager</div>
                                                    <div className="font-bold text-amber-300">{worldInfo?.managerId ? 'Assigned' : 'None'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Available Property Market */}
                    {activeTab === 'market' && (
                        <div className="space-y-4">
                            {availableProperties.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <Store className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">No properties are listed for sale in this settlement.</p>
                                    <p className="text-xs text-slate-400">Check back after market days or inquire with local burgomasters.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {availableProperties.map(prop => {
                                        const price = canPurchaseBusiness(prop, state.gold, state.economy).askingPrice;
                                        const canAfford = (state.gold || 0) >= price;

                                        return (
                                            <div
                                                key={prop.id}
                                                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between">
                                                        <h4 className="text-sm font-bold text-slate-100">{prop.name}</h4>
                                                        <span className="font-bold text-amber-400 text-xs">{price} GP</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1 capitalize">{prop.businessType.replaceAll('_', ' ')} in {prop.locationId}</p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleBuyProperty(prop)}
                                                    disabled={!canAfford}
                                                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                >
                                                    {canAfford ? `Acquire Deed (${price} GP)` : `Requires ${price} GP`}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default RealEstateModal;
