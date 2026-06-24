import path from 'path';

import type { DiscoveredDocument, DocRole, DocumentClassification, PlanStatus } from './types';
import { titleFromSlug } from './pathUtils';

/**
 * Deterministic v1 classifier for Aralia Atlas.
 *
 * Local Ollama/Gemma can later propose classifications, but the first version
 * needs a safe baseline that Codex and tests can verify. These rules attach docs
 * to obvious project branches from their paths and infer plan health from
 * checklist/evidence markers without allowing AI text alone to close a plan.
 *
 * Called by: reconciliation and tests
 * Depends on: DiscoveredDocument records from discovery.ts
 */

// ============================================================================
// Role And Branch Detection
// ============================================================================
// This section maps Aralia's existing documentation vocabulary onto Atlas roles
// and branch names. It favors path evidence over fuzzy content matches.
// ============================================================================

function roleFromPath(relativePath: string): DocRole {
    const fileName = path.basename(relativePath).toLowerCase();
    const lowerPath = relativePath.toLowerCase();

    if (fileName === 'north_star.md') return 'north_star';
    if (fileName === 'gaps.md' || lowerPath.includes('/gaps/')) return 'gap';
    if (fileName === 'tracker.md' || fileName.includes('tracker')) return 'tracker';
    if (fileName.includes('handoff') || fileName.includes('cold_start')) return 'handoff';
    if (fileName.includes('runbook')) return 'runbook';
    if (fileName.includes('decision')) return 'decision';
    if (fileName.includes('proof') || fileName.includes('audit')) return 'proof';
    if (lowerPath.includes('/architecture/')) return 'architecture';
    if (lowerPath.includes('/plans/') || fileName.includes('plan')) return 'plan';
    if (lowerPath.includes('/agent-workflows/') || lowerPath.includes('/workflows/')) return 'process';
    return 'reference';
}

function primaryBranchFromPath(document: DiscoveredDocument): string {
    const projectMatch = document.relativePath.match(/^docs\/projects\/([^/]+)/i);
    if (projectMatch) return titleFromSlug(projectMatch[1]);

    const taskMatch = document.relativePath.match(/^docs\/tasks\/([^/]+)/i);
    if (taskMatch) return titleFromSlug(taskMatch[1]);

    const architectureMatch = document.relativePath.match(/^docs\/architecture\/(?:domains\/)?([^/.]+)/i);
    if (architectureMatch) return titleFromSlug(architectureMatch[1]);

    if (/worldforge/i.test(`${document.relativePath}\n${document.content}`)) return 'Worldforge';
    if (/roadmap/i.test(`${document.relativePath}\n${document.content}`)) return 'Roadmap Maintenance';
    return 'General Documentation';
}

function secondaryBranches(document: DiscoveredDocument, primaryBranch: string): string[] {
    const text = `${document.relativePath}\n${document.title}\n${document.content}`.toLowerCase();
    const candidates = [
        ['Town', /\btown\b|village|settlement/],
        ['World 3D UI', /world\s*3d|three[- ]?d|ground[- ]?level/],
        ['Combat System', /\bcombat\b|battle map|initiative/],
        ['Spells Parent', /\bspell\b|cantrip|caster/],
        ['Roadmap Maintenance', /\broadmap\b|knowledge tree|atlas/],
        ['UI Primitives', /\bui\b|button|modal|panel/],
    ] as const;

    return candidates
        .filter(([name, pattern]) => name !== primaryBranch && pattern.test(text))
        .map(([name]) => name);
}

// ============================================================================
// Plan Health Detection
// ============================================================================
// This section keeps plan completion conservative. A fully checked list is not
// enough by itself; Atlas only marks done when the text also carries proof,
// verification, accepted, or supersession evidence.
// ============================================================================

function planStatusFromContent(content: string): { status: PlanStatus; reason: string } {
    const checked = (content.match(/- \[[xX]\]/g) ?? []).length;
    const unchecked = (content.match(/- \[ \]/g) ?? []).length;
    const lower = content.toLowerCase();

    if (/superseded by|replaced by/.test(lower)) {
        return { status: 'superseded', reason: 'Plan text says it was superseded.' };
    }
    if (/\bblocked\b|blocker/.test(lower)) {
        return { status: 'blocked', reason: 'Plan text contains a blocker signal.' };
    }
    if (checked > 0 && unchecked > 0) {
        return { status: 'partially_done', reason: 'Plan has checked and unchecked checklist items.' };
    }
    if (checked > 0 && unchecked === 0 && /\b(proof|verified|verification|accepted|merged)\b/.test(lower)) {
        return { status: 'done', reason: 'Plan checklist is complete and completion evidence is present.' };
    }
    if (checked > 0 && unchecked === 0) {
        return { status: 'active', reason: 'Checklist is checked, but no completion evidence closes the plan.' };
    }
    return { status: 'active', reason: 'Plan has no completion evidence and remains open.' };
}

// ============================================================================
// Public Classification Entry Point
// ============================================================================
// This section returns one stable classification for a document. Every result is
// unreviewed in v1 so humans and future agents can distinguish machine routing
// from accepted Knowledge Tree ownership.
// ============================================================================

export function classifyDocument(document: DiscoveredDocument): DocumentClassification {
    const docRole = roleFromPath(document.relativePath);
    const primaryBranch = primaryBranchFromPath(document);
    const secondaries = secondaryBranches(document, primaryBranch);
    const plan = docRole === 'plan' ? planStatusFromContent(document.content) : null;

    return {
        primaryBranch,
        secondaryBranches: secondaries,
        docRole,
        planStatus: plan?.status ?? null,
        confidence: primaryBranch === 'General Documentation' ? 0.45 : 0.82,
        reason: plan?.reason ?? `Path and title attach this ${docRole} document to ${primaryBranch}.`,
        reviewedState: 'unreviewed',
    };
}
