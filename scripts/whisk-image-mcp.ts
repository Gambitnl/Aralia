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

// Configuration
const WHISK_URL = "https://labs.google/fx/tools/whisk";
const USER_DATA_DIR = path.join(os.homedir(), ".gemini", "whisk-browser-profile");
const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), ".gemini", "whisk-images");

// Selectors for Whisk UI elements
const SELECTORS = {
    promptTextarea: "textarea[placeholder*='Describe']",
    submitButton: "button[aria-label='Submit prompt']",
    outputImages: ".sc-3c44e5a1-4",
    downloadIcon: "i:text('download')",
    generatingIndicator: "[aria-busy='true']",
};

// MCP Server setup
const server = new Server(
    {
        name: "whisk-image-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Debug logging
function log(message: string) {
    const logPath = path.resolve(process.cwd(), "whisk-mcp-debug.log");
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, entry);
    process.stderr.write(entry);
}

// Browser state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function ensureBrowser(): Promise<Page> {
    if (page && !page.isClosed()) {
        return page;
    }

    log("Launching browser with persistent context...");

    // Ensure user data directory exists
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });

    // Launch with persistent context to preserve login
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
        ],
    });

    // Get or create page
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();

    log("Browser launched successfully");
    return page;
}

async function navigateToWhisk(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (!currentUrl.includes("labs.google/fx/tools/whisk")) {
        log("Navigating to Whisk...");
        await page.goto(WHISK_URL, { waitUntil: "networkidle" });
        await page.waitForTimeout(2000); // Allow page to fully stabilize
    }
}

async function generateImage(prompt: string): Promise<{ success: boolean; message: string }> {
    try {
        const activePage = await ensureBrowser();
        await navigateToWhisk(activePage);

        log(`Generating image with prompt: ${prompt.substring(0, 50)}...`);

        // Clear and fill the prompt textarea
        const textarea = await activePage.waitForSelector(SELECTORS.promptTextarea, { timeout: 10000 });
        if (!textarea) {
            throw new Error("Could not find prompt textarea");
        }

        await textarea.click({ clickCount: 3 }); // Select all existing text
        await textarea.fill(prompt);
        await activePage.waitForTimeout(500);

        // Click the submit button
        const submitBtn = await activePage.waitForSelector(SELECTORS.submitButton, { timeout: 5000 });
        if (!submitBtn) {
            throw new Error("Could not find submit button");
        }

        await submitBtn.click();
        log("Clicked submit, waiting for generation...");

        // Wait for generation to start and complete
        // First wait for busy indicator to appear
        try {
            await activePage.waitForSelector(SELECTORS.generatingIndicator, { timeout: 5000 });
            // Then wait for it to disappear
            await activePage.waitForSelector(SELECTORS.generatingIndicator, { state: "detached", timeout: 60000 });
        } catch {
            // Fallback: just wait a fixed time if indicators aren't found
            await activePage.waitForTimeout(10000);
        }

        log("Image generation complete");
        return { success: true, message: "Image(s) generated successfully. Use download_whisk_image to save." };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error generating image: ${errorMessage}`);
        return { success: false, message: `Error: ${errorMessage}` };
    }
}

async function downloadImage(outputPath?: string): Promise<{ success: boolean; path: string; message: string }> {
    try {
        if (!page || page.isClosed()) {
            throw new Error("No active browser session. Generate an image first.");
        }

        // Ensure output directory exists
        fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

        // Generate filename with timestamp if not provided
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const finalPath = outputPath || path.join(DEFAULT_OUTPUT_DIR, `whisk-${timestamp}.png`);

        log(`Attempting to download image to: ${finalPath}`);

        // Find the first output image
        const imageContainer = await page.waitForSelector(SELECTORS.outputImages, { timeout: 5000 });
        if (!imageContainer) {
            throw new Error("No generated images found");
        }

        // Hover to reveal download button
        await imageContainer.hover();
        await page.waitForTimeout(500);

        // Set up download listener
        const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

        // Click the download button
        const downloadBtn = await page.waitForSelector(`button:has(${SELECTORS.downloadIcon})`, { timeout: 5000 });
        if (!downloadBtn) {
            throw new Error("Could not find download button. Try hovering over the image.");
        }

        await downloadBtn.click();

        // Wait for and save download
        const download = await downloadPromise;
        await download.saveAs(finalPath);

        log(`Image saved to: ${finalPath}`);
        return { success: true, path: finalPath, message: `Image downloaded to ${finalPath}` };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error downloading image: ${errorMessage}`);
        return { success: false, path: "", message: `Error: ${errorMessage}` };
    }
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_whisk_image",
                description: "Generate an image using Google Labs Whisk (free, browser-based). Opens a browser window and automates the Whisk interface.",
                inputSchema: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Text description of the image to generate"
                        }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "download_whisk_image",
                description: "Download the most recently generated Whisk image to a local file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        outputPath: {
                            type: "string",
                            description: "Optional. Full path where to save the image. If not provided, saves to ~/.gemini/whisk-images/ with timestamp."
                        }
                    },
                    required: []
                }
            }
        ]
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`Received tool call: ${name}`);

    if (name === "generate_whisk_image") {
        const { prompt } = args as { prompt: string };

        if (!prompt || prompt.trim().length === 0) {
            return {
                content: [{ type: "text", text: "Error: Prompt cannot be empty" }],
                isError: true
            };
        }

        const result = await generateImage(prompt);
        return {
            content: [{ type: "text", text: result.message }],
            isError: !result.success
        };
    }

    if (name === "download_whisk_image") {
        const { outputPath } = args as { outputPath?: string };
        const result = await downloadImage(outputPath);
        return {
            content: [{ type: "text", text: result.message }],
            isError: !result.success
        };
    }

    throw new Error(`Unknown tool: ${name}`);
});

// Cleanup on exit
process.on("SIGINT", async () => {
    log("Shutting down...");
    if (context) await context.close();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    log("Shutting down...");
    if (context) await context.close();
    process.exit(0);
});

// Start server
async function main() {
    log("Starting Whisk MCP Server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("Server connected and ready");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
