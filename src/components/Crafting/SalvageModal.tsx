/**
 * This file renders the Salvage Workshop interface (SalvageModal).
 *
 * Players use this modal to break down unneeded, mundane, or damaged equipment
 * into raw crafting materials (iron scrap, leather strips, wood splinters, and
 * magical dust) alongside reclaimed scrap gold.
 *
 * A party crafter rolls against the item's complexity DC (Smith's Tools, Tinker's Tools,
 * or physical proficiency). High rolls yield bonus materials, while poor rolls recover
 * only partial scrap.
 *
 * Called by: CraftingTab.tsx, GameModals.tsx, or ActionPane
 * Depends on: WindowFrame, crafterAdapter, GameContext, ALL_ITEMS, CRAFTING_MATERIALS
 */

// ============================================================================
// Imports
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
    Anvil,
    Coins,
    Flame,
    Hammer,
    Info,
    PackageCheck,
    RotateCcw,
    Shield,
    Sparkles,
    Sword,
    UserCheck,
    Wrench,
    Zap,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { ALL_ITEMS } from '../../data/items';
import { CRAFTING_MATERIALS } from '../../data/craftingMaterials';
import { Item, PlayerCharacter } from '../../types';
import { resolveCraftingCrafter, NO_CRAFTER_MESSAGE } from './crafterAdapter';
import { formatGpAsCoins } from '../../utils/character';

// ============================================================================
// Types & Yield Formulas
// ============================================================================
export interface SalvageModalProps {
    // Optional close callback; when omitted, the modal will close its window
    onClose?: () => void;
}

export type SalvageFilterCategory = 'all' | 'weapons' | 'armor' | 'gear' | 'magical';

/**
 * One filter tab in the inventory pane. The icon is optional (the "All" tab has
 * none), so this is declared as a named type rather than inferred via `as const`
 * — an inferred const tuple gives each entry its own shape and makes `tab.icon`
 * unreadable across the union.
 */
interface SalvageFilterTab {
    id: SalvageFilterCategory;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export interface SalvageMaterialYield {
    itemId: string;
    name: string;
    icon: string;
    minQuantity: number;
    maxQuantity: number;
    isBonus?: boolean;
}

export interface SalvageRecipePreview {
    item: Item;
    dc: number;
    skillName: string;
    baseGoldValue: number;
    yields: SalvageMaterialYield[];
    estimatedMinutes: number;
}

export interface SalvageLogEntry {
    id: string;
    itemName: string;
    itemIcon: string;
    success: boolean;
    isSuperior: boolean;
    roll: number;
    dc: number;
    goldRecovered: number;
    itemsRecovered: { name: string; quantity: number; icon: string }[];
    timestamp: number;
}

// ============================================================================
// Yield & Recipe Helpers
// ============================================================================
// Helper that figures out what materials an item breaks down into based on its
// type, weight, armor category, and magical properties.
// ============================================================================
/**
 * Builds a yield row for one salvage material. Name and icon are read from
 * CRAFTING_MATERIALS rather than restated here, so the workshop always shows
 * the same label the item will carry once ADD_ITEM puts it in the inventory —
 * and an id that no longer exists in the data file becomes visible ("Unknown
 * Material") instead of silently granting nothing.
 */
function materialYield(
    itemId: string,
    minQuantity: number,
    maxQuantity: number,
    isBonus?: boolean,
): SalvageMaterialYield {
    const material = CRAFTING_MATERIALS[itemId];
    return {
        itemId,
        name: material?.name ?? 'Unknown Material',
        icon: material?.icon ?? '\u2753',
        minQuantity,
        maxQuantity,
        isBonus,
    };
}

export function calculateSalvagePreview(item: Item): SalvageRecipePreview {
    const itemType = (item.type || '').toLowerCase();
    const itemNameLower = item.name.toLowerCase();
    // Rarity is the ItemRarity enum ('Common'), but legacy/authored data has been
    // seen carrying lowercase strings. Comparing the lowercased string keeps that
    // runtime tolerance while staying type-safe against the enum.
    const isMagical = Boolean(
        item.rarity && String(item.rarity).toLowerCase() !== 'common' ||
        itemNameLower.includes('+1') ||
        itemNameLower.includes('+2') ||
        itemNameLower.includes('magic') ||
        itemNameLower.includes('wand') ||
        itemNameLower.includes('ring of')
    );

    // Calculate base gold value (extract numeric value from cost string or item.value)
    // Item.value is typed `number | string` for legacy data sources, so normalize
    // to a number before the arithmetic below.
    let rawCost = typeof item.value === 'number'
        ? item.value
        : parseFloat(String(item.value ?? '')) || 0;
    if (!rawCost && typeof item.cost === 'string') {
        const costParts = item.cost.split(' ');
        const num = parseFloat(costParts[0]?.replace(/,/g, '') || '0');
        const unit = (costParts[1] || 'GP').toUpperCase();
        if (unit === 'GP') rawCost = num;
        else if (unit === 'SP') rawCost = num * 0.1;
        else if (unit === 'CP') rawCost = num * 0.01;
    }
    // Salvage gold is 20% of base item value in coins (rounded down, minimum 0.5 gp for valuable gear)
    const baseGoldValue = Math.max(0, Math.round(rawCost * 0.2 * 10) / 10);

    const yields: SalvageMaterialYield[] = [];
    let dc = 10;
    let skillName = "Smith's Tools";
    let estimatedMinutes = 15;

    // 1. Metal Weapons
    const isMetalWeapon =
        itemType === 'weapon' &&
        !itemNameLower.includes('club') &&
        !itemNameLower.includes('staff') &&
        !itemNameLower.includes('bow') &&
        !itemNameLower.includes('sling');

    // 2. Wooden Weapons / Staves
    const isWoodenWeapon =
        itemType === 'weapon' &&
        (itemNameLower.includes('club') ||
            itemNameLower.includes('staff') ||
            itemNameLower.includes('bow') ||
            itemNameLower.includes('sling'));

    // 3. Heavy / Metal Armor
    const isHeavyArmor =
        itemType === 'armor' &&
        (item.armorCategory === 'Heavy' ||
            item.armorCategory === 'Medium' ||
            itemNameLower.includes('mail') ||
            itemNameLower.includes('plate') ||
            itemNameLower.includes('breastplate') ||
            itemNameLower.includes('shield'));

    // 4. Leather / Light Armor
    const isLeatherArmor =
        itemType === 'armor' &&
        (item.armorCategory === 'Light' ||
            itemNameLower.includes('leather') ||
            itemNameLower.includes('hide') ||
            itemNameLower.includes('padded'));

    if (isMetalWeapon) {
        dc = item.category?.includes('Martial') ? 12 : 10;
        skillName = "Smith's Tools";
        estimatedMinutes = 20;
        yields.push(materialYield('iron_scrap', 1, Math.max(2, Math.floor((item.weight || 2) / 1.5))));
        yields.push(materialYield('leather_strip', 1, 1));
    } else if (isWoodenWeapon) {
        dc = 10;
        skillName = "Woodcarver's Tools";
        estimatedMinutes = 15;
        yields.push(materialYield('wood_splinters', 1, Math.max(2, Math.floor((item.weight || 2) / 1.5))));
        yields.push(materialYield('leather_strip', 1, 1));
    } else if (isHeavyArmor) {
        dc = 14;
        skillName = "Smith's Tools";
        estimatedMinutes = 30;
        yields.push(materialYield('iron_scrap', 2, Math.max(3, Math.floor((item.weight || 10) / 5))));
        yields.push(materialYield('leather_strip', 1, 2));
    } else if (isLeatherArmor) {
        dc = 11;
        skillName = "Leatherworker's Tools";
        estimatedMinutes = 20;
        yields.push(materialYield('leather_strip', 2, Math.max(3, Math.floor((item.weight || 8) / 3))));
        yields.push(materialYield('iron_scrap', 1, 1));
    } else {
        // General gear, accessories, or other mundane items
        dc = 10;
        skillName = "Tinker's Tools";
        estimatedMinutes = 15;
        yields.push(materialYield('iron_scrap', 1, 1));
        yields.push(materialYield('wood_splinters', 1, 1));
    }

    // Magical items also release magical dust
    if (isMagical) {
        dc = Math.max(dc, 14);
        skillName = 'Arcana';
        yields.push(materialYield('dust_arcane', 1, 2, false));
    }

    return {
        item,
        dc,
        skillName,
        baseGoldValue,
        yields,
        estimatedMinutes,
    };
}

// ============================================================================
// Main Component
// ============================================================================
export const SalvageModal: React.FC<SalvageModalProps> = ({ onClose }) => {
    const { state, dispatch } = useGameState();

    const [selectedCategory, setSelectedCategory] = useState<SalvageFilterCategory>('all');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [salvageQuantity, setSalvageQuantity] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [logEntries, setLogEntries] = useState<SalvageLogEntry[]>([]);

    // Resolve the active party crafter and their tool check ability
    const crafterResolution = useMemo(
        () => resolveCraftingCrafter(state),
        [state.party, state.characterSheetModal],
    );
    const crafterCharacter = crafterResolution.sourceCharacter;
    const hasCrafter = crafterResolution.status === 'resolved';

    // Filter player inventory for items that can be broken down
    // Exclude basic crafting reagents, currency, and quest items
    const salvageableItems = useMemo(() => {
        return (state.inventory || []).filter(item => {
            if (!item || !item.id) return false;
            const type = (item.type || '').toLowerCase();
            const category = (item.category || '').toLowerCase();

            // Ignore raw materials and items explicitly tagged as non-salvageable
            if (type === 'reagent' || category.includes('raw material') || category.includes('refined component')) {
                return false;
            }
            if (type === 'quest' || category.includes('quest')) {
                return false;
            }

            // Keep weapons, armor, accessories, tools, adventuring gear, household items
            return (
                type === 'weapon' ||
                type === 'armor' ||
                type === 'accessory' ||
                type === 'gear' ||
                type === 'consumable' ||
                category.includes('weapon') ||
                category.includes('armor') ||
                category.includes('gear') ||
                category.includes('household') ||
                category.includes('tool')
            );
        });
    }, [state.inventory]);

    // Apply active category tab filter
    const displayedItems = useMemo(() => {
        return salvageableItems.filter(item => {
            const type = (item.type || '').toLowerCase();
            const itemNameLower = item.name.toLowerCase();
            const isMagical =
                (item.rarity && String(item.rarity).toLowerCase() !== 'common') ||
                itemNameLower.includes('+1') ||
                itemNameLower.includes('magic');

            if (selectedCategory === 'weapons') return type === 'weapon';
            if (selectedCategory === 'armor') return type === 'armor';
            if (selectedCategory === 'gear') return type === 'gear' || type === 'consumable' || type === 'accessory';
            if (selectedCategory === 'magical') return isMagical;
            return true;
        });
    }, [salvageableItems, selectedCategory]);

    // Auto-select the first available item if none selected or current selection missing
    const activeItem = useMemo(() => {
        if (!selectedItemId) return displayedItems[0] || null;
        return salvageableItems.find(i => i.id === selectedItemId) || displayedItems[0] || null;
    }, [salvageableItems, displayedItems, selectedItemId]);

    // Calculate recipe and material yields for the currently selected item
    const recipePreview = useMemo(() => {
        if (!activeItem) return null;
        return calculateSalvagePreview(activeItem);
    }, [activeItem]);

    // Execute the salvage breakdown for the selected item and quantity
    const handleExecuteSalvage = () => {
        if (!activeItem || !recipePreview || isProcessing) return;
        // No fallbacks: dismantling needs a real crafter to roll the tool check.
        if (crafterResolution.status !== 'resolved') return;
        const { crafter } = crafterResolution;

        const maxAvailable = activeItem.quantity || 1;
        const countToBreak = Math.min(salvageQuantity, maxAvailable);
        if (countToBreak <= 0) return;

        setIsProcessing(true);

        // Perform skill check for each individual item being dismantled
        let totalGold = 0;
        const recoveredTotals: Record<string, { quantity: number; name: string; icon: string }> = {};
        let anySuccess = false;
        let bestRoll = 0;
        let wasSuperior = false;

        for (let i = 0; i < countToBreak; i++) {
            const roll = crafter.rollSkill(recipePreview.skillName);
            bestRoll = Math.max(bestRoll, roll);
            const isSuccess = roll >= recipePreview.dc;
            const isCrit = roll >= recipePreview.dc + 5;

            if (isCrit) wasSuperior = true;

            if (isSuccess) {
                anySuccess = true;
                totalGold += recipePreview.baseGoldValue;

                // Standard outputs with possible 50% bonus yield on critical mastery
                for (const y of recipePreview.yields) {
                    let qty = Math.floor(
                        Math.random() * (y.maxQuantity - y.minQuantity + 1) + y.minQuantity,
                    );
                    if (isCrit) {
                        qty = Math.ceil(qty * 1.5);
                    }
                    if (qty > 0) {
                        if (!recoveredTotals[y.itemId]) {
                            recoveredTotals[y.itemId] = { quantity: 0, name: y.name, icon: y.icon };
                        }
                        recoveredTotals[y.itemId].quantity += qty;
                    }
                }
            } else {
                // Failure yields half of primary scrap
                const primaryYield = recipePreview.yields[0];
                if (primaryYield) {
                    const scrapQty = Math.max(1, Math.floor(primaryYield.minQuantity / 2));
                    if (!recoveredTotals[primaryYield.itemId]) {
                        recoveredTotals[primaryYield.itemId] = {
                            quantity: 0,
                            name: primaryYield.name,
                            icon: primaryYield.icon,
                        };
                    }
                    recoveredTotals[primaryYield.itemId].quantity += scrapQty;
                }
            }
        }

        // Apply state changes through reducer actions
        // 1. Remove the broken-down items from inventory
        dispatch({
            type: 'REMOVE_ITEM',
            payload: { itemId: activeItem.id, count: countToBreak },
        });

        // 2. Add all recovered material items to inventory
        for (const [itemId, info] of Object.entries(recoveredTotals)) {
            if (info.quantity > 0) {
                dispatch({
                    type: 'ADD_ITEM',
                    payload: { itemId, count: info.quantity },
                });
            }
        }

        // 3. Add reclaimed scrap gold to party purse
        if (totalGold > 0) {
            dispatch({
                type: 'MODIFY_GOLD',
                payload: { amount: totalGold },
            });
        }

        // 4. Advance world simulation time (15 mins per item dismantled)
        dispatch({
            type: 'ADVANCE_TIME',
            payload: { seconds: recipePreview.estimatedMinutes * countToBreak * 60 },
        });

        // Record entry in the local work log
        const logEntry: SalvageLogEntry = {
            id: `salvage-log-${Date.now()}`,
            itemName: activeItem.name,
            itemIcon: activeItem.icon || '⚔️',
            success: anySuccess,
            isSuperior: wasSuperior,
            roll: bestRoll,
            dc: recipePreview.dc,
            goldRecovered: totalGold,
            itemsRecovered: Object.values(recoveredTotals),
            timestamp: Date.now(),
        };

        setLogEntries(prev => [logEntry, ...prev.slice(0, 9)]);
        setIsProcessing(false);

        // Reset batch quantity if item was fully consumed
        if (maxAvailable <= countToBreak) {
            setSalvageQuantity(1);
            setSelectedItemId(null);
        }
    };

    return (
        <WindowFrame
            title="Salvage Workshop"
            storageKey={WINDOW_KEYS.SALVAGE}
            onClose={onClose}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
                {/* Header Subtitle */}
                <div className="shrink-0 px-6 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Anvil className="w-4 h-4 text-amber-400" />
                        <span>Break down equipment into crafting scrap, leather, wood splinters, and arcane dust.</span>
                    </div>
                    {crafterCharacter ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/60 border border-amber-800/50 px-2.5 py-1 rounded-full">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Crafter: {crafterCharacter.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-950/60 border border-rose-800/50 px-2.5 py-1 rounded-full">
                            <span>{NO_CRAFTER_MESSAGE}</span>
                        </div>
                    )}
                </div>

                {/* Main 2-Pane Content Area */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Column: Inventory Item Selector */}
                    <div className="w-full md:w-1/2 flex flex-col border-r border-slate-800 bg-slate-900/40">
                        {/* Filter Tabs */}
                        <div className="shrink-0 p-3 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
                            {(
                                [
                                    { id: 'all', label: 'All' },
                                    { id: 'weapons', label: 'Weapons', icon: Sword },
                                    { id: 'armor', label: 'Armor', icon: Shield },
                                    { id: 'gear', label: 'Gear', icon: Wrench },
                                    { id: 'magical', label: 'Magical', icon: Sparkles },
                                ] as SalvageFilterTab[]
                            ).map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(tab.id)}
                                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                        selectedCategory === tab.id
                                            ? 'bg-amber-600 text-white shadow-sm'
                                            : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                                    }`}
                                >
                                    {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Inventory Item List */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 scrollable-content">
                            {displayedItems.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 space-y-2">
                                    <Hammer className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">No salvageable items in this category.</p>
                                    <p className="text-xs text-slate-400">
                                        Collect weapons, armor, and gear during exploration to break them down into materials.
                                    </p>
                                </div>
                            ) : (
                                displayedItems.map(item => {
                                    const isSelected = activeItem?.id === item.id;
                                    const qty = item.quantity || 1;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                setSalvageQuantity(1);
                                            }}
                                            className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                                                isSelected
                                                    ? 'bg-amber-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                                                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-2xl shrink-0">{item.icon || '📦'}</span>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-200 truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                                        <span>{item.type || 'equipment'}</span>
                                                        {item.weight && <span>• {item.weight} lbs</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                {qty > 1 && (
                                                    <span className="px-2 py-0.5 text-xs font-semibold bg-slate-800 text-amber-300 rounded border border-slate-700">
                                                        x{qty}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Column: Recipe Breakdown Preview & Actions */}
                    <div className="w-full md:w-1/2 flex flex-col bg-slate-950/90 overflow-y-auto p-4 space-y-4">
                        {recipePreview && activeItem ? (
                            <>
                                {/* Selected Item Summary Card */}
                                <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{activeItem.icon || '⚔️'}</span>
                                            <div>
                                                <h3 className="text-base font-bold text-amber-300">{activeItem.name}</h3>
                                                <p className="text-xs text-slate-400">{activeItem.description || 'Standard equipment item.'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Breakdown Stats Badges */}
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                                        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                                            <div className="text-slate-400">Skill Check</div>
                                            <div className="font-semibold text-amber-300">DC {recipePreview.dc} {recipePreview.skillName}</div>
                                        </div>
                                        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                                            <div className="text-slate-400">Scrap Gold</div>
                                            <div className="font-semibold text-amber-400">{recipePreview.baseGoldValue} GP</div>
                                        </div>
                                        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                                            <div className="text-slate-400">Work Time</div>
                                            <div className="font-semibold text-slate-200">{recipePreview.estimatedMinutes}m</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Material Yields Preview */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Estimated Yields (per item)</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {recipePreview.yields.map(y => (
                                            <div
                                                key={y.itemId}
                                                className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{y.icon}</span>
                                                    <span className="text-xs font-medium text-slate-200">{y.name}</span>
                                                </div>
                                                <span className="text-xs font-bold text-amber-300">
                                                    {y.minQuantity === y.maxQuantity ? `${y.minQuantity}` : `${y.minQuantity}–${y.maxQuantity}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Batch Quantity Controls */}
                                {(activeItem.quantity || 1) > 1 && (
                                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                                        <span className="text-xs text-slate-300 font-medium">Salvage Quantity:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSalvageQuantity(q => Math.max(1, q - 1))}
                                                className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-sm cursor-pointer"
                                            >
                                                -
                                            </button>
                                            <span className="px-3 text-sm font-semibold text-amber-300">
                                                {salvageQuantity} / {activeItem.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSalvageQuantity(q =>
                                                        Math.min(activeItem.quantity || 1, q + 1),
                                                    )
                                                }
                                                className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-sm cursor-pointer"
                                            >
                                                +
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSalvageQuantity(activeItem.quantity || 1)}
                                                className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer ml-1"
                                            >
                                                Max
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Dismantle Action Button */}
                                <button
                                    type="button"
                                    onClick={handleExecuteSalvage}
                                    disabled={isProcessing || !hasCrafter}
                                    className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Flame className="w-4 h-4 text-slate-950" />
                                    <span>
                                        {!hasCrafter
                                            ? 'No Crafter Available'
                                            : isProcessing
                                            ? 'Dismantling Equipment...'
                                            : `Dismantle ${salvageQuantity > 1 ? `${salvageQuantity} Items` : 'Equipment'}`}
                                    </span>
                                </button>
                            </>
                        ) : (
                            <div className="p-8 text-center text-slate-400 space-y-2 my-auto">
                                <Info className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                <p className="text-sm font-medium">Select an item from your inventory to preview salvage yields.</p>
                            </div>
                        )}

                        {/* Recent Work Log */}
                        {logEntries.length > 0 && (
                            <div className="pt-3 border-t border-slate-800/80 space-y-2">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                    Recent Salvage Log
                                </h4>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto scrollable-content text-xs">
                                    {logEntries.map(entry => (
                                        <div
                                            key={entry.id}
                                            className={`p-2 rounded border ${
                                                entry.success
                                                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                                                    : 'bg-red-950/30 border-red-800/40 text-red-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between font-medium">
                                                <span>
                                                    {entry.itemIcon} {entry.itemName}{' '}
                                                    {entry.isSuperior ? '(Masterwork Salvage)' : entry.success ? '(Success)' : '(Partial Salvage)'}
                                                </span>
                                                <span className="text-slate-400">
                                                    Roll {entry.roll} vs DC {entry.dc}
                                                </span>
                                            </div>
                                            <div className="text-slate-400 mt-0.5 text-[11px]">
                                                Recovered:{' '}
                                                {entry.itemsRecovered.map(i => `${i.icon} ${i.quantity}x ${i.name}`).join(', ') ||
                                                    'None'}
                                                {entry.goldRecovered > 0 && ` + ${entry.goldRecovered} GP`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </WindowFrame>
    );
};

export default SalvageModal;
