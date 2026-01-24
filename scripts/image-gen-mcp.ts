import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, type BrowserContext, type Page } from "playwright";
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
            newChat: 'a:has-text("New chat"), button:has-text("New chat")'
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
    'text="Sign in"',
    'text="Sign in with Google"'
];

// Selectors that indicate a "clean" state (ready for new prompt)
const WELCOME_SELECTORS = [
    'h1:has-text("Hello")',
    'h1:has-text("Hi there")',
    '[data-testid="starter-prompt-container"]',
    'text="How can I help you today?"'
];

const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), ".gemini", "generated-images");

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
let context: BrowserContext | null = null;
let activePage: Page | null = null;
let currentProvider: Provider | null = null;

async function ensureBrowser(provider: Provider): Promise<Page> {
    const config = CONFIG[provider];

    // If we change providers or browser is closed, restart
    if (currentProvider !== provider || !activePage || activePage.isClosed()) {
        if (context) {
            log(`Closing existing context for ${currentProvider}...`);
            await context.close();
        }

        log(`Launching browser for ${provider}...`);
        fs.mkdirSync(config.userDataDir, { recursive: true });

        context = await chromium.launchPersistentContext(config.userDataDir, {
            headless: false,
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

    // Navigate if needed
    const currentUrl = activePage.url();
    if (!currentUrl.includes(config.url)) {
        log(`Navigating to ${config.url}...`);
        await activePage.goto(config.url, { waitUntil: "domcontentloaded" });
    }

    // Login Check
    try {
        const loginEl = await activePage.waitForSelector(LOGIN_SELECTORS.join(','), { timeout: 3000 });
        if (loginEl) {
            const msg = `[${provider}] 🛑 LOGGED OUT! You must manually log in to the browser window.`;
            log(msg);
            throw new Error("User is not logged in. Please log in manually in the browser window and try again.");
        }
    } catch (e) {
        // Timeout means we didn't find login selectors, which is GOOD (usually).
        // But we should double check if we can see the input.
    }

    return activePage;
}

async function generateImage(prompt: string, provider: Provider = "gemini"): Promise<{ success: boolean; message: string }> {
    try {
        const page = await ensureBrowser(provider);
        const config = CONFIG[provider];

        log(`[${provider}] Generating: ${prompt.substring(0, 50)}...`);

        // Handle New Chat for Gemini to avoid context bleed
        if (provider === "gemini" && config.selectors.newChat) {
            const newChatBtn = await page.$(config.selectors.newChat);
            if (newChatBtn) {
                log("Starting new chat...");
                await newChatBtn.click();
                // Wait for the old chat to disappear or welcome message to appear
                try {
                    await Promise.race([
                        page.waitForSelector(WELCOME_SELECTORS.join(','), { timeout: 5000 }),
                        page.waitForFunction(() => {
                            // Wait for chat history to be cleared (heuristic)
                            return document.querySelectorAll('.user-query').length === 0;
                        }, { timeout: 5000 })
                    ]);
                } catch (e) {
                    log("Warning: Timed out waiting for new chat clear, proceeding anyway...");
                }
                await page.waitForTimeout(1000);
            }
        }

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

        // Submit
        let submitBtn = null;
        for (const selector of config.selectors.submit) {
            submitBtn = await page.$(selector);
            if (submitBtn && await submitBtn.isEnabled()) break;
            submitBtn = null;
        }

        if (submitBtn) {
            await submitBtn.click();
        } else {
            log("Submit button not found/disabled, using Enter");
            await page.keyboard.press("Enter");
        }

        // Wait for completion
        if (provider === "gemini") {
            await page.waitForFunction(
                (sel) => {
                    const images = Array.from(document.querySelectorAll(sel));
                    return images.some(img => {
                        const rect = (img as HTMLElement).getBoundingClientRect();
                        return rect.width > 200 && rect.height > 200;
                    }) || document.body.innerText.includes("Download");
                },
                config.selectors.image,
                { timeout: 120000 }
            );
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

async function downloadImage(options: { outputPath?: string; race?: string; variant?: string; gender?: string; prompt?: string }): Promise<{ success: boolean; path: string; message: string }> {
    try {
        if (!activePage || activePage.isClosed() || !currentProvider) {
            throw new Error("No active browser session. Generate an image first.");
        }

        const { outputPath, race, variant, gender, prompt } = options;
        const provider = currentProvider;
        const config = CONFIG[provider];
        fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const finalPath = outputPath || path.join(DEFAULT_OUTPUT_DIR, `${provider}-${timestamp}.png`);

        if (provider === "gemini") {
            const imageUrl = await activePage.evaluate((sel) => {
                const images = Array.from(document.querySelectorAll(sel));
                const largeImages = images.filter(img => {
                    const rect = (img as HTMLElement).getBoundingClientRect();
                    return rect.width > 200 && rect.height > 200;
                });
                const lastImage = largeImages[largeImages.length - 1] as HTMLImageElement | undefined;
                if (!lastImage?.src) return null;
                return lastImage.src.replace(/=w\d+-h\d+.*$/, '=s0').replace(/=s\d+(-rj)?$/, '=s0');
            }, config.selectors.image);

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
        const status = result.complies ? "✅ Complies" : "❌ Does not comply";
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
