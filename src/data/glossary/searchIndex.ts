/**
 * @file src/data/glossary/searchIndex.ts
 *
 * This file provides indexing and multi-table search capabilities across all PHB 2024
 * structured rule datasets (Conditions, Cover & Obscurement, Combat Actions, and Weapon Masteries).
 *
 * Why it exists:
 * Players and DM tools need to quickly look up rule mechanics by keyword (e.g. "disadvantage",
 * "prone", "reaction", "heavy", "constitution save", "darkness", "dc 15"). This search
 * engine normalizes search queries, scores results, highlights relevant snippets, and
 * returns structured match cards suitable for rendering in the Compendium search interface.
 *
 * Connects to:
 * - src/data/glossary/conditionsData.ts
 * - src/data/glossary/coverObscurementData.ts
 * - src/data/glossary/combatActionsData.ts
 * - src/data/glossary/weaponMasteryData.ts
 * - src/components/Compendium/CompendiumModal.tsx for live search filtering
 */

import {
  RuleTableCategory,
  RuleSearchResult,
  ConditionRuleEntry,
  CoverObscurementEntry,
  CombatActionEntry,
  WeaponMasteryEntry,
} from './types';
import { CONDITIONS_DATA } from './conditionsData';
import { COVER_OBSCUREMENT_DATA } from './coverObscurementData';
import { COMBAT_ACTIONS_DATA } from './combatActionsData';
import { WEAPON_MASTERY_DATA } from './weaponMasteryData';

// ============================================================================
// Index Building Helpers
// ============================================================================
// Converts raw domain records into unified search result items with indexed tokens.
// ============================================================================

/**
 * Builds a search item from a Condition rule entry.
 */
function mapConditionToSearchItem(condition: ConditionRuleEntry): RuleSearchResult {
  const tags = ['condition', condition.id];
  if (condition.attackModifications?.attacksAgainstHaveAdvantage) tags.push('advantage against');
  if (condition.attackModifications?.attacksMadeHaveDisadvantage) tags.push('disadvantage on attacks');
  if (condition.exhaustionTiers) tags.push('exhaustion', 'levels');

  return {
    category: 'conditions',
    id: condition.id,
    title: condition.name,
    subtitle: condition.id === 'exhaustion' ? 'Exhaustion (6 Tiers)' : 'Condition',
    snippet: condition.summary,
    tags,
    entry: condition,
  };
}

/**
 * Builds a search item from a Cover or Obscurement entry.
 */
function mapCoverObscurementToSearchItem(item: CoverObscurementEntry): RuleSearchResult {
  const tags = [item.type, item.id];
  if (item.acBonus) tags.push(`+${item.acBonus} AC`);
  if (item.dexSaveBonus) tags.push(`+${item.dexSaveBonus} Dex Save`);

  const subtitle = item.type === 'cover'
    ? (item.acBonus ? `+${item.acBonus} AC & Dex Saves` : 'Direct Targeting Blocked')
    : 'Perception & Vision Modifier';

  return {
    category: 'cover_obscurement',
    id: item.id,
    title: item.name,
    subtitle: `${item.type.toUpperCase()} • ${subtitle}`,
    snippet: item.description,
    tags,
    entry: item,
  };
}

/**
 * Builds a search item from a Combat Action entry.
 */
function mapCombatActionToSearchItem(action: CombatActionEntry): RuleSearchResult {
  const tags = ['combat action', action.actionType.toLowerCase(), action.id];
  if (action.subtypesOrOptions) {
    tags.push(...action.subtypesOrOptions.map((s) => s.toLowerCase()));
  }

  return {
    category: 'combat_actions',
    id: action.id,
    title: action.name,
    subtitle: `${action.actionType}`,
    snippet: action.summary,
    tags,
    entry: action,
  };
}

/**
 * Builds a search item from a Weapon Mastery entry.
 */
function mapWeaponMasteryToSearchItem(mastery: WeaponMasteryEntry): RuleSearchResult {
  const tags = [
    'weapon mastery',
    mastery.name.toLowerCase(),
    ...mastery.standardWeapons.map((w) => w.toLowerCase()),
    ...mastery.prerequisite.toLowerCase().split(',').map((p) => p.trim()),
  ];

  return {
    category: 'weapon_mastery',
    id: mastery.id,
    title: `Mastery: ${mastery.name}`,
    subtitle: `${mastery.prerequisite} • ${mastery.trigger}`,
    snippet: mastery.mechanic,
    tags,
    entry: mastery,
  };
}

// ============================================================================
// Master Search Index
// ============================================================================
// Cached aggregated list of all rule items for fast iteration.
// ============================================================================

export function buildAllRuleSearchResults(): RuleSearchResult[] {
  const items: RuleSearchResult[] = [];

  // 1. Conditions
  for (const condition of CONDITIONS_DATA) {
    items.push(mapConditionToSearchItem(condition));
  }

  // 2. Cover and Obscurement
  for (const cover of COVER_OBSCUREMENT_DATA) {
    items.push(mapCoverObscurementToSearchItem(cover));
  }

  // 3. Combat Actions
  for (const action of COMBAT_ACTIONS_DATA) {
    items.push(mapCombatActionToSearchItem(action));
  }

  // 4. Weapon Masteries
  for (const mastery of WEAPON_MASTERY_DATA) {
    items.push(mapWeaponMasteryToSearchItem(mastery));
  }

  return items;
}

// ============================================================================
// Search & Filter Functions
// ============================================================================
// Multi-token search with relevance scoring.
// ============================================================================

/**
 * Searches across rule tables given a text query and optional category filter.
 *
 * @param query - The user search string (e.g. "prone", "reaction", "light weapon")
 * @param category - Optional filter to limit results to a specific category
 * @returns Array of matching results sorted by match relevance
 */
export function searchRuleTables(
  query: string,
  category?: RuleTableCategory
): RuleSearchResult[] {
  const allItems = buildAllRuleSearchResults();
  const trimmed = query.trim().toLowerCase();

  // If query is empty, return all items for the given category (or all items if no category specified)
  if (!trimmed) {
    return category
      ? allItems.filter((item) => item.category === category)
      : allItems;
  }

  const searchTokens = trimmed.split(/\s+/).filter(Boolean);

  const scoredResults: { item: RuleSearchResult; score: number }[] = [];

  for (const item of allItems) {
    // Filter by category if requested
    if (category && item.category !== category) {
      continue;
    }

    const titleLower = item.title.toLowerCase();
    const snippetLower = item.snippet.toLowerCase();
    const tagsLower = item.tags.join(' ').toLowerCase();

    let score = 0;
    let allTokensMatch = true;

    for (const token of searchTokens) {
      const inTitle = titleLower.includes(token);
      const inSubtitle = item.subtitle.toLowerCase().includes(token);
      const inSnippet = snippetLower.includes(token);
      const inTags = tagsLower.includes(token);

      if (inTitle) {
        // High score for exact title matches
        score += titleLower === token ? 100 : (titleLower.startsWith(token) ? 50 : 25);
      } else if (inSubtitle) {
        score += 15;
      } else if (inTags) {
        score += 10;
      } else if (inSnippet) {
        score += 5;
      } else {
        allTokensMatch = false;
      }
    }

    if (allTokensMatch && score > 0) {
      scoredResults.push({ item, score });
    }
  }

  // Sort descending by relevance score
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.map((res) => res.item);
}

/**
 * Direct lookup to find a specific rule entry by its unique ID across any category.
 */
export function findRuleEntryById(
  id: string
): { category: RuleTableCategory; entry: ConditionRuleEntry | CoverObscurementEntry | CombatActionEntry | WeaponMasteryEntry } | null {
  const condition = CONDITIONS_DATA.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (condition) return { category: 'conditions', entry: condition };

  const cover = COVER_OBSCUREMENT_DATA.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (cover) return { category: 'cover_obscurement', entry: cover };

  const action = COMBAT_ACTIONS_DATA.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (action) return { category: 'combat_actions', entry: action };

  const mastery = WEAPON_MASTERY_DATA.find((m) => m.id.toLowerCase() === id.toLowerCase() || m.name.toLowerCase() === id.toLowerCase());
  if (mastery) return { category: 'weapon_mastery', entry: mastery };

  return null;
}
