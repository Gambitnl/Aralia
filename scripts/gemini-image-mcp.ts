import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Resolve API Key from system environment variables
// This respects the hierarchy defined in src/config/env.ts but relies on process.env
const API_KEY = process.env.VITE_IMAGE_API_KEY || 
                process.env.IMAGE_API_KEY || 
                process.env.VITE_GEMINI_API_KEY || 
                process.env.GEMINI_API_KEY;

const server = new Server(
  {
    name: "gemini-custom-image-server",
    version: "1.5.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Debug logging function
function log(message: string) {
  const logPath = path.resolve(process.cwd(), "mcp-debug.log");
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, entry);
  process.stderr.write(entry);
}

log("Starting MCP Server initialization...");

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image_custom",
        description: "Generate an image using Gemini multimodal models.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Image prompt" },
            model: {
              type: "string",
              enum: ["gemini-2.5-flash-image", "gemini-3-flash"],
              default: "gemini-2.5-flash-image"
            },
            outputPath: { type: "string", description: "Path to save file" }
          },
          required: ["prompt", "outputPath"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Received CallToolRequest: ${name}`);
  
  if (name === "generate_image_custom") {
    const { prompt, model = "gemini-2.5-flash-image", outputPath } = args as any;
    
    try {
      if (!API_KEY) throw new Error("API Key is missing from environment variables.");
      const genAI = new GoogleGenerativeAI(API_KEY);
      const imageModel = genAI.getGenerativeModel({ model: model });
      
      log(`Calling model ${model} with prompt length: ${prompt.length}`);
      const result = await imageModel.generateContent(prompt);
      const response = await result.response;
      
      let imageBuffer: Buffer | null = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            break;
          }
        }
      }
      
      if (!imageBuffer) {
        throw new Error("Model did not return an image.");
      }
      
      const absolutePath = path.resolve(process.cwd(), outputPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, imageBuffer);
      log(`Success! Saved to ${absolutePath}`);
      
      return {
        content: [{ type: "text", text: `Image saved to ${outputPath}` }]
      };
    } catch (e: any) {
      log(`Execution Error: ${e.message}`);
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true
      };
    }
  }
  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server connected");
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
