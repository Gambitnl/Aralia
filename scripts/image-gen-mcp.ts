import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from 'url';
import { Provider, recordRaceImageDownload, recordRaceImageVerification } from "./raceImageStatus.js";


/**
 * Unified Image Generation MCP Server
 * Consolidates Gemini and Whisk browser automation.
 */
interface ProviderConfig {
    url: string;
    userDataDir: string;
    selectors: {
        input: string[];
        submit: string[];
        image: string;
        indicator?: string;
        newChat?: string;
        menuButton?: string[];
    };
}

const CONFIG: Record<Provider, ProviderConfig> = {
    gemini: {
        url: "https://gemini.google.com/app",
        userDataDir: path.join(os.homedir(), ".gemini", "gemini-browser-profile"),
        selectors: {
            input: [
                'div[contenteditable="true"]',
                'textarea[aria-label*="prompt" i]',
                '.ql-editor',
                'rich-textarea',
                '[data-placeholder*="Enter" i]'
            ],
            submit: [
                'button[aria-label*="Send" i]',
                'button[aria-label*="Submit" i]',
                'button.send-button',
                '[data-testid="send-button"]'
            ],
            image: 'img[src*="googleusercontent.com"], img[src*="lh3.google"]',
            // Gemini frequently hides "New chat" behind the left-side nav / hamburger menu.
            // We try direct first, then click menuButton selectors and retry.
            newChat: 'a:has-text("New chat"), button:has-text("New chat")',
            menuButton: [
                'button[aria-label*="Menu" i]',
                'button[aria-label*="Main menu" i]',
                'button[aria-label*="Navigation" i]',
                '[data-testid*="menu" i]',
                '[data-testid*="nav" i] button',
                'button:has-text("Menu")',
            ],
        }
    },
    whisk: {
        url: "https://labs.google/fx/tools/whisk",
        userDataDir: path.join(os.homedir(), ".gemini", "whisk-browser-profile"),
        selectors: {
            input: ["textarea[placeholder*='Describe']"],
            submit: ["button[aria-label='Submit prompt']"],
            image: ".sc-3c44e5a1-4", // Container class from original script
            indicator: "[aria-busy='true']"
        }
    }
};

const LOGIN_SELECTORS = [
    'a[href*="accounts.google.com/ServiceLogin"]',
    'input[type="email"]',
    '#identifierId',
    'input[name="identifier"]'
];

// Cookie/consent interstitial that can appear before Gemini loads.
const GOOGLE_CONSENT_SELECTORS = [
    'text="Before you continue to Google"',
    'text="Before you continue"',
];

// Selectors that indicate a "clean" state (ready for new prompt)
const WELCOME_SELECTORS = [
    'h1:has-text("Hello")',
    'h1:has-text("Hi there")',
    '[data-testid="starter-prompt-container"]',
    'text="How can I help you today?"'
];

const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), ".gemini", "generated-images");

// When set to "1", generations will fail if we cannot positively start a new chat on Gemini.
const STRICT_NEW_CHAT = String(process.env.IMAGE_GEN_STRICT_NEW_CHAT || "").trim() === "1";

// Gemini image generation can be slow or rate-limited; allow tuning the wait timeout.
const GEMINI_IMAGE_WAIT_TIMEOUT_MS = (() => {
    const raw = String(process.env.IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS || "").trim();
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 240_000;
})();

export interface GeminiCdpDoctorResult {
    ok: boolean;
    stage: "cdp_down" | "no_context" | "consent" | "logged_out" | "ready" | "blocked" | "error";
    message: string;
    url?: string;
    title?: string;
    bodyPreview?: string;
}

// MCP Server setup
const server = new Server(
    {
        name: "image-gen-server",
        version: "2.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const IMAGE_GUIDELINES = [
    "Full body view, showing the character from head to toe (CRITICAL)",
    "Subject is a Common Villager or Worker (not an adventurer/hero)",
    "Setting is a slice-of-life setting (mundane, not combat)",
    "Art style is high-quality D&D 5e canon illustration",
    "No text, UI elements, or blurry artifacts"
];

interface VerifyImageResult {
    success: boolean;
    complies: boolean;
    message: string;
    verifiedRace?: string;
}

async function verifyImageAdherence(imagePath: string): Promise<VerifyImageResult> {
    try {
        if (!activePage || activePage.isClosed() || !currentProvider) {
            throw new Error("No active browser session. Generate an image first.");
        }

        const provider = currentProvider;
        const config = CONFIG[provider];

        if (provider !== 'gemini') {
            return { success: false, complies: false, message: "Verification is currently only supported on Gemini provider." };
        }

        if (!fs.existsSync(imagePath)) {
            return { success: false, complies: false, message: `Image not found at ${imagePath}` };
        }

        log("Starting visual verification...");

        // 1. Start New Chat
        const newChatBtn = await activePage.$(config.selectors.newChat!);
        if (newChatBtn) {
            await newChatBtn.click();
            await activePage.waitForTimeout(1000);
        }

        // 2. Upload Image
        const fileInput = await activePage.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 });
        if (!fileInput) throw new Error("Could not find file input for image upload");

        await activePage.setInputFiles('input[type="file"]', imagePath);
        await activePage.waitForTimeout(2000); // Wait for upload

        // 3. Send Prompt
        const prompt = `Analyze this image against the following guidelines:\n` +
            IMAGE_GUIDELINES.map(g => `- ${g}`).join('\n') +
            `\n\nDoes the image adhere to these guidelines? Answer EXACTLY in this JSON format: { "complies": boolean, "race": "string|null", "reason": "concise explanation" }`;

        let input = null;
        for (const selector of config.selectors.input) {
            input = await activePage.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
            if (input) break;
        }
        if (!input) throw new Error("Could not find prompt input");

        await input.click({ clickCount: 3 });
        await activePage.keyboard.press("Backspace");
        await input.fill(prompt);
        await activePage.waitForTimeout(500);
        await activePage.keyboard.press("Enter");

        // 4. Wait for Response
        log("Waiting for verification analysis...");
        await activePage.waitForFunction(() => {
            const responses = document.querySelectorAll('.model-response-text');
            return responses.length > 0 && !document.querySelector('[aria-label="Stop generation"]');
        }, { timeout: 30000 });

        // 5. Extract Text
        const responseText = await activePage.evaluate(() => {
            const responses = Array.from(document.querySelectorAll('.markdown'));
            const lastResponse = responses[responses.length - 1];
            return lastResponse ? lastResponse.textContent : null;
        });

        if (!responseText) throw new Error("Could not read response from Gemini");

        // 6. Parse JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: true, complies: false, message: "Could not parse JSON response from Gemini. Raw response: " + responseText.substring(0, 100) };
        }

        const analysis = JSON.parse(jsonMatch[0]);
        const verifiedRace = typeof analysis.race === "string" && analysis.race.trim() ? analysis.race.trim() : undefined;
        const reason = typeof analysis.reason === "string" ? analysis.reason : "";
        try {
            recordRaceImageVerification(imagePath, {
                tool: "verify_image_adherence",
                complies: !!analysis.complies,
                message: reason,
                verifiedRace,
            });
        } catch (recordError: unknown) {
            log(`Verification status error: ${getErrorMessage(recordError)}`);
        }
        return {
            success: true,
            complies: !!analysis.complies,
            message: reason,
            verifiedRace,
        };

    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        return { success: false, complies: false, message: `Verification failed: ${errorMessage}` };
    }
}

async function startGeminiNewChat(page: Page): Promise<boolean> {
    const config = CONFIG.gemini;
    if (!config.selectors.newChat) return false;

    async function dismissOverlays(): Promise<void> {
        // Gemini (and Google) frequently render interstitial overlays in cdk containers.
        // If present, they can intercept clicks on New chat / Send.
        try {
            await page.keyboard.press("Escape").catch(() => undefined);
            await page.keyboard.press("Escape").catch(() => undefined);
        } catch {
            // ignore
        }

        // Common CDK overlay backdrop.
        try {
            const backdrop = page.locator(".cdk-overlay-backdrop").first();
            const hasBackdrop = await backdrop.isVisible({ timeout: 200 }).catch(() => false);
            if (hasBackdrop) {
                await backdrop.click({ timeout: 1000, force: true }).catch(() => undefined);
            }
        } catch {
            // ignore
        }

        // "Canvas" (and similar) discovery cards can appear and swallow pointer events.
        // Try close/decline buttons inside the overlay container.
        const closeCandidates = [
            'button[aria-label*="Close" i]',
            'button:has-text("No thanks")',
            'button:has-text("Not now")',
            'button:has-text("Got it")',
            'button:has-text("Dismiss")',
            'button:has-text("Continue")',
        ];
        for (const sel of closeCandidates) {
            const btn = page.locator(".cdk-overlay-container " + sel).first();
            const visible = await btn.isVisible({ timeout: 150 }).catch(() => false);
            if (!visible) continue;
            await btn.click({ timeout: 3000, force: true }).catch(() => undefined);
        }
    }

    await dismissOverlays();

    async function clickNewChatIfVisible(): Promise<boolean> {
        const btn = await page.$(config.selectors.newChat!).catch(() => null);
        if (!btn) return false;
        try {
            await btn.click({ timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    // 1) Try direct (sometimes visible already).
    let clicked = await clickNewChatIfVisible();

    // 2) If hidden, attempt to open the nav/hamburger menu and retry.
    if (!clicked && Array.isArray(config.selectors.menuButton) && config.selectors.menuButton.length) {
        for (const sel of config.selectors.menuButton) {
            const menuBtn = page.locator(sel).first();
            const visible = await menuBtn.isVisible({ timeout: 500 }).catch(() => false);
            if (!visible) continue;
            await menuBtn.click({ timeout: 5000 }).catch(() => undefined);
            await page.waitForTimeout(350);
            clicked = await clickNewChatIfVisible();
            if (clicked) break;
        }
    }

    if (!clicked) return false;

    // Wait for the starter UI to appear or for the chat history to clear (best-effort).
    try {
        await Promise.race([
            page.waitForSelector(WELCOME_SELECTORS.join(","), { timeout: 8000 }),
            page.waitForFunction(() => document.querySelectorAll(".user-query").length === 0, { timeout: 8000 }),
        ]);
    } catch {
        // If Gemini UI changes, we don't want this to hard-fail generations.
    }
    await page.waitForTimeout(500);
    return true;
}

export async function startNewGeminiChat(): Promise<{ success: boolean; message: string }> {
    try {
        const page = await ensureBrowser("gemini");
        const ok = await startGeminiNewChat(page);
        return ok
            ? { success: true, message: "Started a new Gemini chat." }
            : { success: false, message: "Could not find a 'New chat' control in Gemini UI." };
    } catch (e: unknown) {
        return { success: false, message: getErrorMessage(e) };
    }
}



// Debug logging

// Debug logging
function log(message: string) {
    const logPath = path.resolve(process.cwd(), "image-gen-mcp.log");
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, entry);
    process.stderr.write(entry);
}

// Normalize thrown values from browser automation into a safe message string.
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// Browser state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let activePage: Page | null = null;
let currentProvider: Provider | null = null;
let usingCDP = false;
let lastGeminiImageUrl: string | null = null;

async function anyVisible(page: Page, selectors: string[], timeoutMs: number): Promise<boolean> {
    for (const sel of selectors) {
        const visible = await page.locator(sel).first().isVisible({ timeout: timeoutMs }).catch(() => false);
        if (visible) return true;
    }
    return false;
}

async function maybeDismissGoogleConsent(page: Page): Promise<boolean> {
    const onConsent = await anyVisible(page, GOOGLE_CONSENT_SELECTORS, 500);
    if (!onConsent) return false;

    log("[gemini] Consent screen detected. Attempting to accept...");

    const acceptCandidates = [
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
        'button:has-text("Accept")',
    ];

    for (const sel of acceptCandidates) {
        const btn = page.locator(sel).first();
        const canClick = await btn.isVisible({ timeout: 500 }).catch(() => false);
        if (!canClick) continue;
        await btn.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined);
        // If we got here, try to navigate back to Gemini app.
        if (!page.url().includes("gemini.google.com")) {
            await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" }).catch(() => undefined);
        }
        return true;
    }

    log("[gemini] Consent screen present but no known accept button was clickable.");
    return false;
}

function normalizeGeminiImageUrl(src: string): string {
    // Gemini images often carry sizing params; normalize to original ("s0") so downloads are full-res.
    return String(src || "").replace(/=w\d+-h\d+.*$/, '=s0').replace(/=s\d+(-rj)?$/, '=s0');
}

async function snapshotLargeImageUrls(page: Page, selector: string): Promise<string[]> {
    return page.evaluate((sel) => {
        const images = Array.from(document.querySelectorAll(sel));
        // Do not size-filter here: Gemini sometimes renders generated images as small thumbnails
        // (or in collapsed layouts) until interacted with, which would cause false "no image" timeouts.
        return (images as HTMLImageElement[]).map((img) => String(img.src || "")).filter(Boolean);
    }, selector);
}

export async function doctorGeminiCDP(options?: {
    cdpUrl?: string;
    openIfMissing?: boolean;
    attemptConsent?: boolean;
}): Promise<GeminiCdpDoctorResult> {
    const cdpUrl = String(options?.cdpUrl || "http://localhost:9222");
    const openIfMissing = options?.openIfMissing !== false;
    const attemptConsent = options?.attemptConsent !== false;

    let b: Browser | null = null;
    try {
        try {
            b = await chromium.connectOverCDP(cdpUrl, { timeout: 3000 });
        } catch (e: unknown) {
            return {
                ok: false,
                stage: "cdp_down",
                message: `Could not connect to Chrome DevTools on ${cdpUrl}. Start it with: npm run mcp:chrome. Underlying error: ${getErrorMessage(e)}`,
            };
        }

        const contexts = b.contexts();
        const ctx = contexts.length > 0 ? contexts[0] : null;
        if (!ctx) {
            return { ok: false, stage: "no_context", message: "Connected to CDP, but no browser context is available yet." };
        }

        let page =
            ctx.pages().find((p) => p.url().includes("gemini.google.com")) ||
            ctx.pages()[0] ||
            null;

        if (!page && openIfMissing) {
            page = await ctx.newPage();
        }

        if (!page) {
            return { ok: false, stage: "blocked", message: "No tab found/created to inspect." };
        }

        if (openIfMissing && !page.url().includes("gemini.google.com")) {
            await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });
        }

        const title = await page.title().catch(() => "");
        const url = page.url();

        if (attemptConsent) {
            const onConsent = await anyVisible(page, GOOGLE_CONSENT_SELECTORS, 400);
            if (onConsent) {
                const clicked = await maybeDismissGoogleConsent(page).catch(() => false);
                const msg = clicked
                    ? "Consent screen detected and an accept button was clicked. Re-check readiness."
                    : "Consent screen detected but no known accept button was clickable. You may need to accept manually in the debug Chrome window.";
                return { ok: false, stage: "consent", message: msg, title, url };
            }
        }

        const loggedOut = await anyVisible(page, LOGIN_SELECTORS, 400);
        if (loggedOut) {
            return {
                ok: false,
                stage: "logged_out",
                message: "Gemini is not logged in in the debug Chrome profile. Sign in in that Chrome window and retry.",
                title,
                url,
            };
        }

        // Check that at least one prompt input selector is visible.
        for (const sel of CONFIG.gemini.selectors.input) {
            const visible = await page.locator(sel).first().isVisible({ timeout: 700 }).catch(() => false);
            if (visible) {
                return { ok: true, stage: "ready", message: "Gemini looks ready (prompt input is visible).", title, url };
            }
        }

        const bodyPreview = await page
            .evaluate(() => String(document.body?.innerText || "").slice(0, 400))
            .catch(() => "");

        return {
            ok: false,
            stage: "blocked",
            message: "Connected to Gemini tab, but prompt input was not found. The page may be blocked by a modal/interstitial.",
            title,
            url,
            bodyPreview,
        };
    } catch (e: unknown) {
        return { ok: false, stage: "error", message: getErrorMessage(e) };
    } finally {
        // Don't close the user's debug Chrome. Disconnect if supported.
        try {
            (b as any)?.disconnect?.();
        } catch {
            // ignore
        }
    }
}

async function ensureBrowser(provider: Provider): Promise<Page> {
    const config = CONFIG[provider];
    const headless = ['1', 'true', 'on', 'yes'].includes(String(process.env.IMAGE_GEN_HEADLESS || '').toLowerCase());
    const wantCDP =
        provider === "gemini" &&
        ['1', 'true', 'on', 'yes'].includes(String(process.env.IMAGE_GEN_USE_CDP || '').toLowerCase());
    const cdpUrl = String(process.env.IMAGE_GEN_CDP_URL || 'http://localhost:9222');

    // If we change providers or browser is closed, restart
    if (currentProvider !== provider || !activePage || activePage.isClosed()) {
        if (context) {
            // If we're attached to a user-owned Chrome via CDP, never close the browser/context.
            if (!usingCDP) {
                log(`Closing existing context for ${currentProvider}...`);
                await context.close();
            }
        }

        if (wantCDP) {
            // Attach to an already-running Chrome instance (started via npm run mcp:chrome).
            // This shares a stable profile and avoids repeated consent/login screens.
            log(`Connecting to Chrome over CDP: ${cdpUrl}`);
            try {
                browser = await chromium.connectOverCDP(cdpUrl, { timeout: 5000 });
            } catch (e: unknown) {
                const msg = getErrorMessage(e);
                throw new Error(
                    `Could not connect to Chrome DevTools on ${cdpUrl}. Start it with: npm run mcp:chrome\nUnderlying error: ${msg}`
                );
            }
            usingCDP = true;

            const contexts = browser.contexts();
            context = contexts.length > 0 ? contexts[0] : await browser.newContext();
            const pages = context.pages();
            const existing = pages.find((p) => p.url().includes("gemini.google.com")) || pages[0];
            activePage = existing || await context.newPage();
            currentProvider = provider;
        } else {
            usingCDP = false;
            log(`Launching browser for ${provider}...`);
            fs.mkdirSync(config.userDataDir, { recursive: true });

            context = await chromium.launchPersistentContext(config.userDataDir, {
                headless,
                viewport: { width: 1280, height: 900 },
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            });

            const pages = context.pages();
            activePage = pages.length > 0 ? pages[0] : await context.newPage();
            currentProvider = provider;
        }
    }

    // Navigate if needed
    const currentUrl = activePage.url();
    if (!currentUrl.includes(config.url)) {
        log(`Navigating to ${config.url}...`);
        await activePage.goto(config.url, { waitUntil: "domcontentloaded" });
    }

    // Gemini can intermittently show a cookie consent interstitial in the profile.
    if (provider === "gemini") {
        await maybeDismissGoogleConsent(activePage).catch((e) => {
            log(`[gemini] Consent dismissal warning: ${getErrorMessage(e)}`);
        });
    }

    // Login Check
    const loggedOut = await anyVisible(activePage, LOGIN_SELECTORS, 800);
    if (loggedOut) {
        const msg = `[${provider}] LOGGED OUT. You must manually log in to the browser window.`;
        log(msg);
        if (wantCDP) {
            throw new Error(
                "Gemini session is not logged in in the debug Chrome profile. Start Chrome via: npm run mcp:chrome, then log in to Gemini in that window, then retry."
            );
        }
        throw new Error("User is not logged in. Please log in manually in the browser window and try again.");
    }

    return activePage;
}

async function generateImage(prompt: string, provider: Provider = "gemini"): Promise<{ success: boolean; message: string }> {
    try {
        const page = await ensureBrowser(provider);
        const config = CONFIG[provider];

        log(`[${provider}] Generating: ${prompt.substring(0, 50)}...`);
        if (provider === "gemini") lastGeminiImageUrl = null;

        // Handle New Chat for Gemini to avoid context bleed
        if (provider === "gemini" && config.selectors.newChat) {
            log("Starting new chat...");
            const ok = await startGeminiNewChat(page).catch(() => false);
            if (!ok) {
                const msg = "Could not confirm a fresh Gemini chat (New chat may be hidden behind the menu).";
                log(`[gemini] ${msg}`);
                if (STRICT_NEW_CHAT) {
                    throw new Error(msg + " Set IMAGE_GEN_STRICT_NEW_CHAT=0 to allow best-effort generations.");
                }
            }
        }

        // Snapshot existing images so we can reliably identify the new one (avoid re-downloading an older image).
        const beforeRawImages = provider === "gemini"
            ? await snapshotLargeImageUrls(page, config.selectors.image)
            : null;
        const beforeImages = beforeRawImages
            ? new Set(beforeRawImages.map(normalizeGeminiImageUrl))
            : null;

        // Find and fill input
        let input = null;
        for (const selector of config.selectors.input) {
            input = await page.waitForSelector(selector, { timeout: 15000 }).catch(() => null);
            if (input) break;
        }

        if (!input) {
            const title = await page.title().catch(e => "Error getting title");
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(e => "Error getting body");
            log(`DEBUG: Title: ${title}`);
            log(`DEBUG: Body start: ${bodyText}`);
            throw new Error(`Could not find prompt input for ${provider}`);
        }

        await input.click({ clickCount: 3 }); // Select all
        await page.keyboard.press("Backspace");
        await input.fill(prompt);
        await page.waitForTimeout(500);

        // Submit (prefer clicking an explicit send button; fallback to pressing Enter on the input itself).
        let submitted = false;
        for (const selector of config.selectors.submit) {
            const btn = await page.$(selector).catch(() => null);
            if (!btn) continue;
            const enabled = await btn.isEnabled().catch(() => false);
            if (!enabled) continue;
            try {
                await btn.click({ timeout: 5000 });
                submitted = true;
                break;
            } catch (e: unknown) {
                // If a backdrop/menu intercepts the click, try another selector or fall back to Enter.
                log(`[gemini] Submit click failed for selector "${selector}": ${getErrorMessage(e)}`);
                continue;
            }
        }

        if (!submitted) {
            log("Submit button not found/disabled, using Enter on prompt input");
            // Pressing Enter on the page can accidentally activate other focused controls (including Stop).
            await input.press("Enter");
        }

        // Wait for completion
        if (provider === "gemini") {
            // 1) Wait until we see a *new* image src appear (compared to the pre-submit snapshot).
            // This prevents the "re-download the previous image" failure mode.
            const beforeRaw = Array.isArray(beforeRawImages) ? beforeRawImages : [];
            await page.waitForFunction(
                ({ sel, before }) => {
                    const beforeSet = new Set(before || []);
                    const images = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
                    // Don't size-filter: Gemini may show the generated image as a small thumbnail first.
                    const srcs = images.map((img) => String(img.src || "")).filter(Boolean);
                    return srcs.some((src) => !beforeSet.has(src));
                },
                { sel: config.selectors.image, before: beforeRaw },
                { timeout: GEMINI_IMAGE_WAIT_TIMEOUT_MS }
            );

            // 2) If Gemini is actively generating, it shows a Stop button. Wait for it to go away (best-effort).
            const stopSel = '[aria-label="Stop generation"]';
            await page.waitForSelector(stopSel, { timeout: 15000 }).catch(() => null);
            await page.waitForSelector(stopSel, { state: "detached", timeout: GEMINI_IMAGE_WAIT_TIMEOUT_MS }).catch(() => null);

            // 3) Pick the newest image that wasn't present before.
            const afterRaw = await snapshotLargeImageUrls(page, config.selectors.image);
            const after = afterRaw.map(normalizeGeminiImageUrl);
            let fresh: string | null = null;
            if (beforeImages) {
                for (let i = after.length - 1; i >= 0; i--) {
                    const src = after[i];
                    if (src && !beforeImages.has(src)) {
                        fresh = src;
                        break;
                    }
                }
            } else {
                fresh = after.length ? after[after.length - 1] : null;
            }
            lastGeminiImageUrl = fresh;

            if (!lastGeminiImageUrl) {
                throw new Error(
                    "A new image appeared in the DOM, but the automation could not identify it as 'fresh'. " +
                    "This may indicate Gemini reused the same underlying URL or the selectors no longer match."
                );
            }
        } else {
            // Whisk logic
            if (config.selectors.indicator) {
                try {
                    await page.waitForSelector(config.selectors.indicator, { timeout: 5000 });
                    await page.waitForSelector(config.selectors.indicator, { state: "detached", timeout: 60000 });
                } catch {
                    await page.waitForTimeout(15000);
                }
            }
        }

        log("Generation complete");
        return { success: true, message: `Image generated via ${provider}. Use download_image to save.` };

    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        log(`Error: ${errorMessage}`);
        return { success: false, message: errorMessage };
    }
}

async function downloadImage(optionsOrPath: string | { outputPath?: string; race?: string; variant?: string; gender?: string; prompt?: string }): Promise<{ success: boolean; path: string; message: string }> {
    try {
        if (!activePage || activePage.isClosed() || !currentProvider) {
            throw new Error("No active browser session. Generate an image first.");
        }

        const options = typeof optionsOrPath === "string" ? { outputPath: optionsOrPath } : optionsOrPath;
        const { outputPath, race, variant, gender, prompt } = options;
        const provider = currentProvider;
        const config = CONFIG[provider];
        fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const finalPath = outputPath || path.join(DEFAULT_OUTPUT_DIR, `${provider}-${timestamp}.png`);

        if (provider === "gemini") {
            let imageUrl = lastGeminiImageUrl ? normalizeGeminiImageUrl(lastGeminiImageUrl) : null;
            if (!imageUrl) {
                const urls = (await snapshotLargeImageUrls(activePage, config.selectors.image)).map(normalizeGeminiImageUrl);
                imageUrl = urls.length ? urls[urls.length - 1] : null;
            }

            if (!imageUrl) throw new Error("Could not find generated image URL");

            const response = await activePage.context().request.get(imageUrl);
            fs.writeFileSync(finalPath, await response.body());
        } else {
            // Whisk download logic
            const imageContainer = await activePage.waitForSelector(config.selectors.image, { timeout: 5000 });
            if (!imageContainer) throw new Error("No generated images found");

            await imageContainer.hover();
            const downloadPromise = activePage.waitForEvent("download", { timeout: 30000 });
            const downloadBtn = await activePage.waitForSelector("button:has(i:text('download'))", { timeout: 5000 });
            await downloadBtn!.click();
            const download = await downloadPromise;
            await download.saveAs(finalPath);
        }

        log(`Saved to: ${finalPath}`);
        try {
            const { duplicates } = recordRaceImageDownload({
                race,
                variant,
                gender,
                prompt,
                provider,
                imagePath: finalPath,
            });
            if (duplicates.length > 0) {
                log(`Duplicate hash detected for ${finalPath} matching ${duplicates.map((dup) => dup.imagePath).join(", ")}`);
            }
        } catch (recordError: unknown) {
            log(`Status record error: ${getErrorMessage(recordError)}`);
        }
        return { success: true, path: finalPath, message: `Image downloaded to ${finalPath}` };

    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        log(`Download Error: ${errorMessage}`);
        return { success: false, path: "", message: errorMessage };
    }
}

// Tool Registration
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "generate_image",
            description: "Generate an image using Gemini or Whisk.",
            inputSchema: {
                type: "object",
                properties: {
                    prompt: { type: "string" },
                    provider: { type: "string", enum: ["gemini", "whisk"], default: "gemini" }
                },
                required: ["prompt"]
            }
        },
        {
            name: "download_image",
            description: "Download the last generated image.",
            inputSchema: {
                type: "object",
                properties: {
                    outputPath: { type: "string", description: "Absolute path to save the image" },
                    race: { type: "string", description: "Intended race portrayed by the image" },
                    variant: { type: "string", description: "Optional subrace or variant name" },
                    gender: { type: "string", description: "Gender portrayed in the image" },
                    prompt: { type: "string", description: "Prompt text used to generate the image" }
                }
            }
        },
        {
            name: "verify_image_adherence",
            description: "Check if an image adheres to style guidelines using Gemini Vision.",
            inputSchema: {
                type: "object",
                properties: {
                    imagePath: { type: "string", description: "Absolute path to the image" }
                },
                required: ["imagePath"]
            }
        }
    ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "generate_image") {
        const { prompt, provider } = args as { prompt: string; provider?: Provider };
        const result = await generateImage(prompt, provider);
        return { content: [{ type: "text", text: result.message }], isError: !result.success };
    }
    if (name === "download_image") {
        const { outputPath, race, variant, gender, prompt } = args as {
            outputPath?: string;
            race?: string;
            variant?: string;
            gender?: string;
            prompt?: string;
        };
        const result = await downloadImage({ outputPath, race, variant, gender, prompt });
        return { content: [{ type: "text", text: result.message }], isError: !result.success };
    }
    if (name === "verify_image_adherence") {
        const { imagePath } = args as { imagePath: string };
        const result = await verifyImageAdherence(imagePath);
        const status = result.complies ? "Complies" : "Does not comply";
        const extra = result.verifiedRace ? ` (verified race: ${result.verifiedRace})` : "";
        return {
            content: [{ type: "text", text: `${status}: ${result.message}${extra}` }],
            isError: !result.success
        };
    }
    throw new Error(`Unknown tool: ${name}`);
});

const cleanup = async () => {
    if (context) await context.close();
    process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

export { generateImage, downloadImage, cleanup, ensureBrowser, verifyImageAdherence };

// Only run server if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
