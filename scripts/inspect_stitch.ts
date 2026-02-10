import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "fs";

const TOOLS_MODE = process.argv.includes("--list-tools");
const CALL_TOOL = process.argv.find(a => a.startsWith("--call="))?.split("=")[1];
const PROMPT_FILE = process.argv.find(a => a.startsWith("--prompt-file="))?.split("=")[1];
const PROMPT_TEXT = process.argv.find(a => a.startsWith("--prompt="))?.split("=").slice(1).join("=");
const PROJECT_ID = process.argv.find(a => a.startsWith("--project-id="))?.split("=")[1];
const CLOUD_PROJECT_ID_ARG = process.argv.find(a => a.startsWith("--cloud-project-id="))?.split("=")[1];
const MODEL_ID = process.argv.find(a => a.startsWith("--model-id="))?.split("=")[1];
const TEST_ALL_MODELS = process.argv.includes("--test-all-models");

// Valid model IDs from Stitch API
const MODEL_IDS = ["GEMINI_3_PRO", "GEMINI_3_FLASH"];
const REQUEST_TIMEOUT = 180000; // 3 minutes

// Generate a unique prompt for each model so we can identify the output
function getModelTestPrompt(modelId: string): string {
    const basePrompt = `Create a simple card component prominently displaying the text "MODEL: ${modelId}" as a large, visible header. Below the header, add a stylized info box with: "This was generated using ${modelId}" and a sample button labeled "Test ${modelId}".`;

    if (modelId === "GEMINI_3_PRO") {
        return `${basePrompt} Use a premium, high-quality design with rich purple (#7c3aed) gradients, subtle shadows, and refined typography.`;
    } else if (modelId === "GEMINI_3_FLASH") {
        return `${basePrompt} Use a clean, fast-loading design with bright teal (#14b8a6) accents and minimalist styling.`;
    }
    return basePrompt;
}

async function createClient(cloudProjectId: string) {
    const configPath = process.env.CLOUDSDK_CONFIG || "C:\\Users\\gambi\\.stitch-mcp\\config";

    console.error(`[Bridge] Proxy using Cloud Project: ${cloudProjectId}`);
    console.error(`[Bridge] Proxy using Config Path: ${configPath}`);

    const transport = new StdioClientTransport({
        command: "C:\\Program Files\\nodejs\\node.exe",
        args: [
            "C:\\Users\\gambi\\AppData\\Roaming\\npm\\node_modules\\@_davideast\\stitch-mcp\\dist\\cli.js",
            "proxy",
            "--transport",
            "stdio"
        ],
        env: {
            ...process.env,
            GOOGLE_CLOUD_PROJECT: "gen-lang-client-0692467106", // Hardcoded for auth context
            STITCH_PROJECT_ID: cloudProjectId, // This will be the numeric ID passed from main
            CLOUDSDK_CONFIG: configPath
        }
    });

    const client = new Client(
        { name: "stitch-bridge", version: "1.0.0" },
        { capabilities: {} }
    );

    return { client, transport };
}

async function callToolWithTimeout(
    client: Client,
    name: string,
    args: Record<string, any>
): Promise<any> {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        console.error(`[Bridge] Tool Call: ${name}`);
        console.error(`[Bridge] Arguments: ${JSON.stringify(args, null, 2)}`);

        const result = await client.callTool(
            { name, arguments: args },
            undefined,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        return result;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${REQUEST_TIMEOUT / 1000} seconds`);
        }
        throw error;
    }
}

async function generateScreen(
    client: Client,
    projectId: string,
    prompt: string,
    modelId: string = "GEMINI_3_FLASH"
): Promise<any> {
    const args: Record<string, any> = {
        projectId: projectId,   // Numeric ID
        project_id: projectId,  // Redundant numeric ID
        prompt: prompt,
        deviceType: "DESKTOP"
    };

    // Only add modelId if specified (otherwise uses default)
    if (modelId && modelId !== "DEFAULT") {
        args.modelId = modelId;
    }

    console.error(`[Bridge] Generating with modelId: ${modelId || "DEFAULT"}`);
    console.error(`[Bridge] Project: ${projectId}`);
    console.error(`[Bridge] Prompt: ${prompt.substring(0, 100)}...`);

    return callToolWithTimeout(client, "generate_screen_from_text", args);
}

async function main() {
    // Determine which Google Cloud project context to use for the proxy.
    // This should generally be your GCP project ID (e.g. gen-lang-client-...)
    // If not provided, the proxy will rely on gcloud default setting or fail.
    const cloudProjectId = CLOUD_PROJECT_ID_ARG || process.env.STITCH_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

    if (!cloudProjectId) {
        console.error("[Bridge] WARNING: No Cloud Project ID found in args or env.");
        console.error("[Bridge] Proxy will use gcloud default project.");
    }

    const { client, transport } = await createClient(cloudProjectId || "");

    try {
        console.error("[Bridge] Connecting to Stitch...");
        await client.connect(transport);
        console.error("[Bridge] Connected!");

        if (TOOLS_MODE) {
            console.error("[Bridge] Listing tools...");
            const tools = await client.listTools();
            console.log(JSON.stringify(tools, null, 2));
        }
        else if (TEST_ALL_MODELS) {
            if (!PROJECT_ID) {
                console.error("Error: Provide --project-id=NUMERIC_ID for testing");
                return;
            }

            console.error("[Bridge] Testing ALL models...");
            const results: Record<string, any> = {};

            for (const modelId of MODEL_IDS) {
                console.error(`\n[Bridge] === Testing ${modelId} ===`);
                const prompt = getModelTestPrompt(modelId);

                try {
                    const result = await generateScreen(client, PROJECT_ID, prompt, modelId);
                    results[modelId] = { success: true, result };
                    console.error(`[Bridge] ${modelId}: SUCCESS`);
                } catch (error: any) {
                    results[modelId] = { success: false, error: error.message };
                    console.error(`[Bridge] ${modelId}: FAILED - ${error.message}`);
                }
            }

            console.log(JSON.stringify(results, null, 2));
        }
        else if (CALL_TOOL) {
            let args: Record<string, any> = {};

            // Get prompt from file or command line
            let prompt = PROMPT_TEXT;
            if (PROMPT_FILE && fs.existsSync(PROMPT_FILE)) {
                prompt = fs.readFileSync(PROMPT_FILE, "utf-8").trim();
            }

            // Build args based on tool
            if (CALL_TOOL === "generate_screen_from_text") {
                if (!prompt) {
                    console.error("Error: Provide --prompt='...' or --prompt-file=path");
                    return;
                }
                if (!PROJECT_ID) {
                    console.error("Error: Provide --project-id=NUMERIC_ID (e.g., 14416455431383903182)");
                    return;
                }

                const modelId = MODEL_ID || "GEMINI_3_FLASH";
                const result = await generateScreen(client, PROJECT_ID, prompt, modelId);
                console.log(JSON.stringify(result, null, 2));
            }
            else if (CALL_TOOL === "create_project") {
                args = { title: prompt || "Aralia UI Test" };
                console.error(`[Bridge] Creating project: ${args.title}`);
                const result = await callToolWithTimeout(client, CALL_TOOL, args);
                console.log(JSON.stringify(result, null, 2));
            }
            else if (CALL_TOOL === "list_projects") {
                args = {};
                console.error("[Bridge] Listing projects...");
                const result = await callToolWithTimeout(client, CALL_TOOL, args);
                console.log(JSON.stringify(result, null, 2));
            }
            else if (CALL_TOOL === "list_screens") {
                if (!PROJECT_ID) {
                    console.error("Error: Provide --project-id=NUMERIC_ID");
                    return;
                }
                // list_screens requires "projects/{id}" format
                args = { projectId: `projects/${PROJECT_ID}` };
                console.error(`[Bridge] Listing screens for projects/${PROJECT_ID}...`);
                const result = await callToolWithTimeout(client, CALL_TOOL, args);
                console.log(JSON.stringify(result, null, 2));
            }
            else if (CALL_TOOL === "get_screen") {
                if (!PROJECT_ID) {
                    console.error("Error: Provide --project-id=NUMERIC_ID");
                    return;
                }
                const screenId = process.argv.find(a => a.startsWith("--screen-id="))?.split("=")[1];
                if (!screenId) {
                    console.error("Error: Provide --screen-id=SCREEN_ID");
                    return;
                }
                // get_screen uses separate projectId and screenId parameters
                args = { projectId: PROJECT_ID, screenId: screenId };
                console.error(`[Bridge] Getting screen ${screenId}...`);
                const result = await callToolWithTimeout(client, CALL_TOOL, args);
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                args = prompt ? { prompt } : {};
                console.error(`[Bridge] Calling tool: ${CALL_TOOL}`);
                const result = await callToolWithTimeout(client, CALL_TOOL, args);
                console.log(JSON.stringify(result, null, 2));
            }
        }
        else {
            console.log("Stitch MCP Bridge - Usage:");
            console.log("");
            console.log("  List tools:");
            console.log("    --list-tools");
            console.log("");
            console.log("  Projects:");
            console.log("    --call=create_project --prompt='Project Title'");
            console.log("    --call=list_projects");
            console.log("");
            console.log("  Generate screens:");
            console.log("    --call=generate_screen_from_text --project-id=ID --prompt='UI description'");
            console.log("    --call=generate_screen_from_text --project-id=ID --prompt-file=path.txt");
            console.log("    --call=generate_screen_from_text --project-id=ID --prompt='...' --model-id=GEMINI_3_PRO");
            console.log("");
            console.log("  Test all models:");
            console.log("    --test-all-models --project-id=ID");
            console.log("");
            console.log("  Model IDs: " + MODEL_IDS.join(", "));
        }

    } catch (error) {
        console.error("[Bridge] Error:", error);
    } finally {
        try { await client.close(); } catch { /* ignore shutdown errors */ }
    }
}

main();

