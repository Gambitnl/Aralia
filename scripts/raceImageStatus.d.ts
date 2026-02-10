export type Provider = "gemini" | "whisk";
interface VerificationRecord {
    tool: string;
    complies: boolean;
    message: string;
}
export interface RaceImageStatusEntry {
    race?: string;
    variant?: string;
    gender?: string;
    category?: string;
    reason?: string;
    activity?: string;
    prompt?: string;
    provider?: Provider;
    imagePath: string;
    sha256: string;
    downloadedAt: string;
    verifiedRace?: string;
    verifiedAt?: string;
    verification?: VerificationRecord;
}
export declare function computeFileSha(imagePath: string): string;
export declare function recordRaceImageDownload(input: {
    race?: string;
    variant?: string;
    gender?: string;
    category?: string;
    reason?: string;
    activity?: string;
    prompt?: string;
    provider?: Provider;
    imagePath: string;
}): {
    entry: RaceImageStatusEntry;
    duplicates: RaceImageStatusEntry[];
};
export declare function recordRaceImageVerification(imagePath: string, verification: VerificationRecord & {
    verifiedRace?: string;
}): RaceImageStatusEntry;
export declare function loadRaceImageEntries(): RaceImageStatusEntry[];
export {};
