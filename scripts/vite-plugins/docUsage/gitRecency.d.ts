export declare function computeAgeDays(commitSec: number | null, nowMs: number): number | null;
export declare function gitAgeDays(rootDir: string, relPaths: string[], now?: number): Map<string, number | null>;
