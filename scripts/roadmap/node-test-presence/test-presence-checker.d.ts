import type { RoadmapNode } from '../../roadmap-server-logic';
/**
 * This file determines whether a roadmap node declares a test file and whether that
 * declared file actually exists on disk.
 *
 * The roadmap data pipeline calls this helper while preparing node payloads so the UI
 * can show health signals for "test declared" versus "test truly present."
 */
export interface TestPresenceResult {
    testFileDeclared: boolean;
    testFileExists: boolean;
    resolvedPath?: string;
}
export declare function checkTestPresence(node: RoadmapNode, repoRoot: string): TestPresenceResult;
