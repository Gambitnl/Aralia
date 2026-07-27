/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 20:12:27
 * Dependents: commands/effects/GrantedActionCommand.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file resolves a service request made to a creature controlled by a social spell.
 *
 * Fast Friends stores the request rule on the target's live status, but the ordinary
 * combat turn engine has no generic "ask for a service" event. This adapter gives the
 * granted Request Service action one canonical owner and reuses the existing save,
 * penalty, and concentration-cleanup paths. It deliberately leaves free-form social
 * roleplay outside the combat state while recording the rules-facing outcome.
 *
 * Called by: GrantedActionCommand when a Fast Friends follow-up action is used.
 * Depends on: the live combat status mirror, SavePenaltySystem, saving-throw utilities,
 * and BreakConcentrationCommand for early spell termination and post-charm awareness.
 */
import type { CommandContext } from '../../commands/base/SpellCommand';
import type { CombatState } from '../../types/combat';
export interface SocialServiceRequest {
    description?: string;
    harmful?: boolean;
    conflictsWithDesires?: boolean;
    certainDeath?: boolean;
}
export declare const parseSocialServiceRequest: (input?: string) => SocialServiceRequest;
export declare const resolveFastFriendsServiceRequest: (state: CombatState, context: CommandContext, request?: SocialServiceRequest) => CombatState;
