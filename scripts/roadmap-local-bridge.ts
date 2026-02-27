/**
 * Technical:
 * Local subprocess bridge that exposes roadmap-engine functions over stdout JSON.
 *
 * Layman:
 * This file lets `scripts/roadmap-server-logic.ts` call the real local roadmap
 * engine without statically importing roadmap-engine files in Vite config.
 *
 * Important:
 * - This script is executed only when local roadmap-engine files exist.
 * - If those files are not present (GitHub/CI), the wrapper falls back safely.
 */

import { generateRoadmapData } from './roadmap-engine/generate';
import {
  loadLatestOpportunityScan,
  readOpportunitySettings,
  scanRoadmapOpportunities,
  writeOpportunitySettings
} from './roadmap-engine/opportunities';
import type { OpportunityScanPayload } from './roadmap-server-logic';

const action = process.argv[2] || '';
const payloadArg = process.argv[3];

const parsePayload = (): unknown => {
  if (!payloadArg) return undefined;
  try {
    return JSON.parse(payloadArg);
  } catch {
    return undefined;
  }
};

const emit = (value: unknown) => {
  process.stdout.write(JSON.stringify(value));
};

try {
  if (action === 'generate-roadmap') {
    emit(generateRoadmapData());
    process.exit(0);
  }

  if (action === 'load-latest-opportunities') {
    emit(loadLatestOpportunityScan());
    process.exit(0);
  }

  if (action === 'read-opportunity-settings') {
    emit(readOpportunitySettings());
    process.exit(0);
  }

  if (action === 'write-opportunity-settings') {
    emit(writeOpportunitySettings(parsePayload()));
    process.exit(0);
  }

  if (action === 'scan-opportunities') {
    const payload = (parsePayload() || {}) as {
      options?: Parameters<typeof scanRoadmapOpportunities>[1];
    };

    const roadmap = generateRoadmapData();
    const options = payload.options;
    const result = scanRoadmapOpportunities(roadmap, options) as OpportunityScanPayload;
    emit(result);
    process.exit(0);
  }

  process.stderr.write(`Unknown action: ${action}`);
  process.exit(2);
} catch (error) {
  process.stderr.write(String(error));
  process.exit(1);
}
