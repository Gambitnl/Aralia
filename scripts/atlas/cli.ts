#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';

import { loadAtlasConfig } from './config';
import { discoverMarkdownDocuments } from './discovery';
import { exportAtlasState, reconcileAtlas } from './reconcile';

/**
 * Command-line entry point for Aralia Atlas.
 *
 * The CLI is the surface Codex automation can run at 1 AM and humans can run
 * manually when they want to refresh the Knowledge Tree. It keeps commands small
 * and explicit: scan, reconcile, report, and export.
 *
 * Called by: npm run atlas -- <command>
 * Depends on: Atlas config, scanner, and reconciliation modules
 */

// ============================================================================
// Argument Helpers
// ============================================================================
// This section parses the intentionally small v1 command surface without adding
// a CLI dependency. Unknown commands fail loudly so automation does not silently
// do the wrong thing.
// ============================================================================

function argValue(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function printUsage(): void {
    console.log([
        'Aralia Atlas',
        '',
        'Usage:',
        '  npm run atlas -- scan --target F:\\Repos\\Aralia',
        '  npm run atlas -- reconcile --target F:\\Repos\\Aralia',
        '  npm run atlas -- report --latest --target F:\\Repos\\Aralia',
        '  npm run atlas -- export --target F:\\Repos\\Aralia',
    ].join('\n'));
}

// ============================================================================
// Command Handlers
// ============================================================================
// This section executes the four public commands. Scan is read-only and does not
// write the database; reconcile performs the full store/export/report pass.
// ============================================================================

function main(): void {
    const args = process.argv.slice(2);
    const command = args[0];
    const config = loadAtlasConfig({
        target: argValue(args, '--target'),
        atlasRoot: argValue(args, '--atlas-root'),
    });

    if (!command || command === '--help' || command === '-h') {
        printUsage();
        return;
    }

    if (command === 'scan') {
        const documents = discoverMarkdownDocuments(config);
        console.log(`Atlas scan found ${documents.length} Markdown documents in ${config.targetRoot}.`);
        return;
    }

    if (command === 'reconcile') {
        const result = reconcileAtlas(config, { trigger: 'cli' });
        console.log(`Atlas reconciliation indexed ${result.documentsSeen} documents.`);
        console.log(`Report: ${result.reportPath}`);
        console.log(`Knowledge tree export: ${result.knowledgeTreeExportPath}`);
        console.log(`Plan health export: ${result.planHealthExportPath}`);
        return;
    }

    if (command === 'export') {
        const exported = exportAtlasState(config);
        console.log(`Atlas export wrote ${exported.documents.length} documents and ${exported.plans.length} plans.`);
        return;
    }

    if (command === 'report' && args.includes('--latest')) {
        const reportDir = path.join(config.atlasRoot, 'reports');
        const reports = fs.existsSync(reportDir)
            ? fs.readdirSync(reportDir).filter((file) => file.endsWith('-reconciliation.md')).sort()
            : [];
        if (!reports.length) {
            console.log('No Atlas reconciliation reports found yet.');
            return;
        }
        const latest = path.join(reportDir, reports[reports.length - 1]);
        console.log(fs.readFileSync(latest, 'utf-8'));
        return;
    }

    throw new Error(`Unknown Atlas command: ${args.join(' ')}`);
}

main();
