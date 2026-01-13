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

/**
 * Unified Image Generation MCP Server
 * Consolidates Gemini and Whisk browser automation.
 */

type Provider = "gemini" | "whisk";

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

// Debug logging
function log(message: string) {
    const logPath = path.resolve(process.cwd(), "image-gen-mcp.log");
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, entry);
    process.stderr.write(entry);
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
                await newChatBtn.click();
                await page.waitForTimeout(1000);
            }
        }

        // Find and fill input
        let input = null;
        for (const selector of config.selectors.input) {
            input = await page.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
            if (input) break;
        }

        if (!input) throw new Error(`Could not find prompt input for ${provider}`);

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

    } catch (error: any) {
        log(`Error: ${error.message}`);
        return { success: false, message: error.message };
    }
}

async function downloadImage(outputPath?: string): Promise<{ success: boolean; path: string; message: string }> {
    try {
        if (!activePage || activePage.isClosed() || !currentProvider) {
            throw new Error("No active browser session. Generate an image first.");
        }

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
        return { success: true, path: finalPath, message: `Image downloaded to ${finalPath}` };

    } catch (error: any) {
        log(`Download Error: ${error.message}`);
        return { success: false, path: "", message: error.message };
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
                    outputPath: { type: "string", description: "Absolute path to save the image" }
                }
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
        const { outputPath } = args as { outputPath?: string };
        const result = await downloadImage(outputPath);
        return { content: [{ type: "text", text: result.message }], isError: !result.success };
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

export { generateImage, downloadImage, cleanup };

// Only run server if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
