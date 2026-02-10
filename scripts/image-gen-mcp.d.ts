import { type Page } from "playwright";
import { Provider } from "./raceImageStatus.js";
export interface GeminiCdpDoctorResult {
    ok: boolean;
    stage: "cdp_down" | "no_context" | "consent" | "logged_out" | "ready" | "blocked" | "error";
    message: string;
    url?: string;
    title?: string;
    bodyPreview?: string;
}
interface VerifyImageResult {
    success: boolean;
    complies: boolean;
    message: string;
    verifiedRace?: string;
}
export declare function verifyImageAdherence(imagePath: string): Promise<VerifyImageResult>;
export declare function startNewGeminiChat(): Promise<{
    success: boolean;
    message: string;
}>;
export declare function doctorGeminiCDP(options?: {
    cdpUrl?: string;
    openIfMissing?: boolean;
    attemptConsent?: boolean;
}): Promise<GeminiCdpDoctorResult>;
declare function ensureBrowser(provider: Provider): Promise<Page>;
declare function generateImage(prompt: string, provider?: Provider): Promise<{
    success: boolean;
    message: string;
}>;
declare function downloadImage(optionsOrPath: string | {
    outputPath?: string;
    race?: string;
    variant?: string;
    gender?: string;
    prompt?: string;
}): Promise<{
    success: boolean;
    path: string;
    message: string;
}>;
declare const cleanup: () => Promise<never>;
export { generateImage, downloadImage, cleanup, ensureBrowser };
