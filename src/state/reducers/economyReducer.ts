/**
 * @file src/state/reducers/economyReducer.ts
 * Slice reducer for player-initiated economy actions:
 * investments, loans, speculation, and business management.
 */

import { GameState } from '../../types';
import { PlayerInvestment } from '../../types/economy';
import { AppAction } from '../actionTypes';
import { getGameDay } from '../../utils/core';
import { v4 as uuidv4 } from 'uuid';
import {
    executePurchase,
    executeCoercedSale,
    createPartnership,
    executeFactionGrant,
    executeFreshStart,
} from '../../systems/economy/BusinessAcquisition';
import { SeededRandom } from '@/utils/random';

export function economyReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'INVEST_IN_CARAVAN': {
            const { tradeRouteId, goldAmount } = action.payload;
            if (state.gold < goldAmount || goldAmount <= 0) return {};

            const route = state.economy.tradeRoutes.find(r => r.id === tradeRouteId);
            if (!route) return {};

            const investment: PlayerInvestment = {
                id: uuidv4(),
                type: 'caravan',
                principalGold: goldAmount,
                currentValue: goldAmount,
                startDay: getGameDay(state.gameTime),
                durationDays: 7 + Math.floor(route.riskLevel * 14), // 7-21 days based on risk
                riskLevel: route.riskLevel,
                tradeRouteId,
                regionId: route.destinationId,
                status: 'active',
                lastUpdateDay: getGameDay(state.gameTime)
            };

            return {
                gold: state.gold - goldAmount,
                playerInvestments: [...(state.playerInvestments || []), investment]
            };
        }

        case 'COLLECT_INVESTMENT': {
            const { investmentId } = action.payload;
            const investments = state.playerInvestments || [];
            const investment = investments.find(i => i.id === investmentId);
            if (!investment || investment.status !== 'completed') return {};

            return {
                gold: state.gold + investment.currentValue,
                playerInvestments: investments.filter(i => i.id !== investmentId)
            };
        }

        case 'TAKE_LOAN': {
            const { lenderId: _lenderId, factionId, amount, interestRate, durationDays } = action.payload;
            if (amount <= 0) return {};

            const loan: PlayerInvestment = {
                id: uuidv4(),
                type: 'loan_taken',
                principalGold: amount,
                currentValue: amount, // Amount owed
                startDay: getGameDay(state.gameTime),
                durationDays,
                riskLevel: 0,
                factionId,
                status: 'active',
                interestRate,
                lastUpdateDay: getGameDay(state.gameTime)
            };

            return {
                gold: state.gold + amount,
                playerInvestments: [...(state.playerInvestments || []), loan]
            };
        }

        case 'REPAY_LOAN': {
            const { investmentId, amount } = action.payload;
            const investments = state.playerInvestments || [];
            const loan = investments.find(i => i.id === investmentId && i.type === 'loan_taken');
            if (!loan || loan.status !== 'active') return {};
            if (state.gold < amount) return {};

            const remainingDebt = loan.currentValue - amount;
            const updatedLoan: PlayerInvestment = {
                ...loan,
                currentValue: Math.max(0, remainingDebt),
                status: remainingDebt <= 0 ? 'completed' : 'active',
                lastUpdateDay: getGameDay(state.gameTime)
            };

            return {
                gold: state.gold - amount,
                playerInvestments: investments.map(i =>
                    i.id === investmentId ? updatedLoan : i
                )
            };
        }

        case 'SPECULATE_ON_GOODS': {
            const { goodCategory, quantity, regionId, buyPrice } = action.payload;
            const totalCost = buyPrice * quantity;
            if (state.gold < totalCost || totalCost <= 0) return {};

            const speculation: PlayerInvestment = {
                id: uuidv4(),
                type: 'speculation',
                principalGold: totalCost,
                currentValue: totalCost,
                startDay: getGameDay(state.gameTime),
                durationDays: 0, // No fixed duration — player sells when ready
                riskLevel: 0.3,
                regionId,
                goodCategory,
                status: 'active',
                lastUpdateDay: getGameDay(state.gameTime)
            };

            return {
                gold: state.gold - totalCost,
                playerInvestments: [...(state.playerInvestments || []), speculation]
            };
        }

        case 'SELL_SPECULATION': {
            const { investmentId, regionId: _sellRegionId } = action.payload;
            const investments = state.playerInvestments || [];
            const spec = investments.find(i => i.id === investmentId && i.type === 'speculation');
            if (!spec || spec.status !== 'active') return {};

            // Current value already updated by daily processing based on regional prices
            return {
                gold: state.gold + spec.currentValue,
                playerInvestments: investments.map(i =>
                    i.id === investmentId ? { ...i, status: 'completed' as const } : i
                )
            };
        }

        case 'TOGGLE_ECONOMY_LEDGER': {
            return {
                isEconomyLedgerVisible: !state.isEconomyLedgerVisible
            };
        }

        case 'TOGGLE_COURIER_POUCH': {
            return {
                isCourierPouchVisible: !state.isCourierPouchVisible
            };
        }

        // Business actions (will be fully implemented in Phase 4)
        case 'FOUND_BUSINESS': {
            const { strongholdId, businessType } = action.payload;
            const stronghold = state.strongholds?.[strongholdId];
            if (!stronghold) return {};

            const newBusiness = {
                strongholdId,
                businessType,
                metrics: {
                    customerSatisfaction: 50,
                    reputation: 10,
                    competitorPressure: 30,
                    supplyChainHealth: 50,
                    staffEfficiency: 50
                },
                supplyContracts: [],
                dailyCustomers: 5,
                priceMultiplier: 1.0,
                competitorIds: [],
                lastDailyReport: {
                    day: getGameDay(state.gameTime),
                    revenue: 0,
                    costs: 0,
                    profit: 0,
                    customersSatisfied: 0,
                    customersLost: 0,
                    supplyIssues: [],
                    competitorActions: [],
                    staffIssues: []
                }
            };

            return {
                businesses: {
                    ...(state.businesses || {}),
                    [strongholdId]: newBusiness
                }
            };
        }

        case 'SET_BUSINESS_PRICES': {
            const { businessId, priceMultiplier } = action.payload;
            const business = state.businesses?.[businessId];
            if (!business) return {};

            const clamped = Math.max(0.5, Math.min(2.0, priceMultiplier));
            return {
                businesses: {
                    ...state.businesses,
                    [businessId]: { ...business, priceMultiplier: clamped }
                }
            };
        }

        case 'SIGN_SUPPLY_CONTRACT': {
            const { businessId, contract } = action.payload;
            const business = state.businesses?.[businessId];
            if (!business) return {};

            return {
                businesses: {
                    ...state.businesses,
                    [businessId]: {
                        ...business,
                        supplyContracts: [...business.supplyContracts, contract]
                    }
                }
            };
        }

        case 'CANCEL_SUPPLY_CONTRACT': {
            const { businessId, contractId } = action.payload;
            const business = state.businesses?.[businessId];
            if (!business) return {};

            return {
                businesses: {
                    ...state.businesses,
                    [businessId]: {
                        ...business,
                        supplyContracts: business.supplyContracts.filter(c => c.id !== contractId)
                    }
                }
            };
        }

        // --- World Business Actions (NPC-owned & acquisition) ---

        case 'REGISTER_WORLD_BUSINESS': {
            const { business } = action.payload;
            return {
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [business.id]: business
                }
            };
        }

        case 'MANAGE_BUSINESS': {
            const { businessId } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || wb.ownerType !== 'player') return {};

            return {
                worldBusinesses: {
                    ...state.worldBusinesses,
                    [businessId]: { ...wb, daysSinceManaged: 0 }
                }
            };
        }

        case 'ASSIGN_MANAGER': {
            const { businessId, npcId } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || wb.ownerType !== 'player') return {};

            return {
                worldBusinesses: {
                    ...state.worldBusinesses,
                    [businessId]: { ...wb, managerId: npcId }
                }
            };
        }

        case 'REMOVE_MANAGER': {
            const { businessId } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb) return {};

            return {
                worldBusinesses: {
                    ...state.worldBusinesses,
                    [businessId]: { ...wb, managerId: undefined, managerEfficiency: 0 }
                }
            };
        }

        case 'PURCHASE_BUSINESS': {
            const { businessId, negotiatedPrice } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || wb.ownerType !== 'npc') return {};
            if (state.gold < negotiatedPrice) return {};

            const { business: updatedBiz } = executePurchase(wb, negotiatedPrice);
            return {
                gold: state.gold - negotiatedPrice,
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [businessId]: updatedBiz
                }
            };
        }

        case 'COERCE_BUSINESS_SALE': {
            const { businessId, discountPercent } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || wb.ownerType !== 'npc') return {};

            const { business: updatedBiz, goldSpent } = executeCoercedSale(wb, state.economy, discountPercent);
            if (state.gold < goldSpent) return {};

            return {
                gold: state.gold - goldSpent,
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [businessId]: updatedBiz
                }
            };
        }

        case 'CREATE_PARTNERSHIP': {
            const { businessId, investmentAmount, playerSharePercent } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || wb.ownerType !== 'npc') return {};
            if (state.gold < investmentAmount) return {};

            const { business: updatedBiz } = createPartnership(
                wb, investmentAmount, playerSharePercent / 100, getGameDay(state.gameTime)
            );
            return {
                gold: state.gold - investmentAmount,
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [businessId]: updatedBiz
                }
            };
        }

        case 'BUYOUT_PARTNER': {
            const { businessId, buyoutPrice } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || !wb.partnershipTerms) return {};
            if (state.gold < buyoutPrice) return {};

            return {
                gold: state.gold - buyoutPrice,
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [businessId]: {
                        ...wb,
                        partnershipTerms: undefined,
                        managerId: undefined,
                        managerEfficiency: 0,
                    }
                }
            };
        }

        case 'DISSOLVE_PARTNERSHIP': {
            const { businessId } = action.payload;
            const wb = state.worldBusinesses?.[businessId];
            if (!wb || !wb.partnershipTerms) return {};

            // Dissolving returns the business to the NPC partner
            return {
                gold: state.gold + Math.round(wb.partnershipTerms.investedByPlayer * 0.8), // 80% of investment back
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [businessId]: {
                        ...wb,
                        ownerId: wb.partnershipTerms.partnerId,
                        ownerType: 'npc',
                        partnershipTerms: undefined,
                        acquisitionType: undefined,
                        managerId: undefined,
                        managerEfficiency: 0,
                    }
                }
            };
        }

        case 'ACCEPT_FACTION_GRANT': {
            const { factionId, locationId, businessType } = action.payload;
            const rng = new SeededRandom((state.worldSeed || 42) + getGameDay(state.gameTime));
            const newBiz = executeFactionGrant(locationId, businessType, factionId, getGameDay(state.gameTime), rng);
            return {
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [newBiz.id]: newBiz
                }
            };
        }

        case 'FOUND_STANDALONE_BUSINESS': {
            const { locationId, businessType } = action.payload;
            const rng = new SeededRandom((state.worldSeed || 42) + getGameDay(state.gameTime) + 5555);
            const { business: newBiz, goldSpent } = executeFreshStart(locationId, businessType, getGameDay(state.gameTime), rng);
            if (!newBiz || state.gold < goldSpent) return {};

            return {
                gold: state.gold - goldSpent,
                worldBusinesses: {
                    ...(state.worldBusinesses || {}),
                    [newBiz.id]: newBiz
                }
            };
        }

        default:
            return {};
    }
}
