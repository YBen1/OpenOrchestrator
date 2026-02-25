/**
 * openOrchestrator Agent Runner Server
 * 
 * Standalone HTTP server that wraps the pi-ai LLM engine with OpenClaw tools.
 * Python backend calls POST /agent/run to execute bot runs.
 * 
 * Usage: node --import tsx src/agent-runner-server.ts
 * Port: 18810
 */

import express from "express";
import crypto from "node:crypto";
import { getModel, getModels, getProviders, stream, completeSimple, Type } from "@mariozechner/pi-ai";
import type { AssistantMessage, Context, Model, ToolCall, Tool, Api } from "@mariozechner/pi-ai";

const PORT = Number(process.env.AGENT_RUNNER_PORT || 18810);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Track active runs
const activeRuns = new Map<string, { abortController: AbortController; status: string }>();

// --------------- Tool Definitions ---------------

function getToolSchemas(enabledTools: string[]): Tool[] {
  const allTools: Record<string, Tool> = {
    web_search: {
      name: "web_search",
      description: "Search the web using Brave Search API. Returns titles, URLs, and snippets.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        count: Type.Optional(Type.Number({ description: "Number of results (1-10)", default: 5 })),
      }),
    },
    web_fetch: {
      name: "web_fetch",
      description: "Fetch a URL and extract readable content as markdown or text.",
      parameters: Type.Object({
        url: Type.String({ description: "URL to fetch" }),
        maxChars: Type.Optional(Type.Number({ description: "Max characters to return", default: 20000 })),
      }),
    },
    browser: {
      name: "browser",
      description: "Control a real web browser. Navigate to URLs, click elements, fill forms, extract content, take screenshots. Use for sites that block simple HTTP requests (eBay, Amazon, etc). Actions: navigate (url), snapshot (get page text), click (selector), type (selector, text), evaluate (script — JS in page context), screenshot.",
      parameters: Type.Object({
        action: Type.Union([
          Type.Literal("navigate"), Type.Literal("snapshot"), Type.Literal("click"),
          Type.Literal("type"), Type.Literal("evaluate"), Type.Literal("screenshot"),
        ], { description: "Browser action to perform" }),
        url: Type.Optional(Type.String({ description: "URL to navigate to" })),
        selector: Type.Optional(Type.String({ description: "CSS selector for click/type" })),
        text: Type.Optional(Type.String({ description: "Text to type" })),
        script: Type.Optional(Type.String({ description: "JavaScript to evaluate in page context" })),
      }),
    },
    exec: {
      name: "exec",
      description: "Execute a shell command and return stdout/stderr. Use for running scripts, checking files, system commands.",
      parameters: Type.Object({
        command: Type.String({ description: "Shell command to execute" }),
        timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default 30)", default: 30 })),
      }),
    },
    read_file: {
      name: "read_file",
      description: "Read the contents of a file.",
      parameters: Type.Object({
        path: Type.String({ description: "Path to the file" }),
      }),
    },
    write_file: {
      name: "write_file",
      description: "Write content to a file. Creates directories if needed.",
      parameters: Type.Object({
        path: Type.String({ description: "Path to the file" }),
        content: Type.String({ description: "Content to write" }),
      }),
    },
    image: {
      name: "image",
      description: "Analyze an image using a vision model. Pass a URL or file path.",
      parameters: Type.Object({
        image: Type.String({ description: "Image URL or file path" }),
        prompt: Type.Optional(Type.String({ description: "What to analyze", default: "Describe this image." })),
      }),
    },
    edit: {
      name: "edit",
      description: "Edit a file by replacing exact text. The old_string must match exactly (including whitespace).",
      parameters: Type.Object({
        path: Type.String({ description: "Path to the file to edit" }),
        old_string: Type.String({ description: "Exact text to find and replace" }),
        new_string: Type.String({ description: "New text to replace with" }),
      }),
    },
    tts: {
      name: "tts",
      description: "Convert text to speech and save as audio file. Returns the file path.",
      parameters: Type.Object({
        text: Type.String({ description: "Text to convert to speech" }),
        voice: Type.Optional(Type.String({ description: "Voice name (default: alloy)", default: "alloy" })),
        output: Type.Optional(Type.String({ description: "Output file path (default: /tmp/tts-<timestamp>.mp3)" })),
      }),
    },
    message: {
      name: "message",
      description: "Send a message to a channel (Telegram, Discord, etc). Requires channel to be configured in openOrchestrator settings.",
      parameters: Type.Object({
        channel_type: Type.Union([Type.Literal("telegram"), Type.Literal("webhook"), Type.Literal("discord")], { description: "Channel type" }),
        text: Type.String({ description: "Message text to send" }),
        chat_id: Type.Optional(Type.String({ description: "Chat/channel ID (uses default if not specified)" })),
      }),
    },
    memory_search: {
      name: "memory_search",
      description: "Search through the bot's memory files for relevant information.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        path: Type.Optional(Type.String({ description: "Directory to search in (default: bot workspace)" })),
      }),
    },
    memory_get: {
      name: "memory_get",
      description: "Read a specific memory file or section of it.",
      parameters: Type.Object({
        path: Type.String({ description: "Path to memory file" }),
        from: Type.Optional(Type.Number({ description: "Start line (1-indexed)" })),
        lines: Type.Optional(Type.Number({ description: "Number of lines to read" })),
      }),
    },
  };

  return enabledTools.filter(t => allTools[t]).map(t => allTools[t]);
}

// --------------- Tool Execution ---------------

import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(execCb);

// Lazy Playwright browser instance
let _browser: any = null;
let _browserContext: any = null;
let _currentPage: any = null;

async function getBrowserPage() {
  if (!_browser) {
    const { chromium } = await import("playwright");
    _browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    _browserContext = await _browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
    });
  }
  if (!_currentPage || _currentPage.isClosed()) {
    _currentPage = await _browserContext.newPage();
  }
  return _currentPage;
}

async function executeTool(name: string, args: Record<string, any>, apiKeys: Record<string, string>): Promise<string> {
  try {
    switch (name) {
      case "web_search": {
        const braveKey = apiKeys.BRAVE_API_KEY;
        if (!braveKey) {return "Error: No Brave API key configured. Add BRAVE_API_KEY in Settings.";}
        const count = args.count || 5;
        const resp = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=${count}`,
          { headers: { "X-Subscription-Token": braveKey, Accept: "application/json" } }
        );
        const data = await resp.json();
        if (!data.web?.results?.length) {return "No results found.";}
        return data.web.results
          .map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ""}`)
          .join("\n\n");
      }

      case "web_fetch": {
        const resp = await fetch(args.url, {
          headers: { "User-Agent": "openOrchestrator/1.0" },
          signal: AbortSignal.timeout(20000),
        });
        const html = await resp.text();
        // Simple HTML → text
        let text = html
          .replace(/<script[^>]*>.*?<\/script>/gs, "")
          .replace(/<style[^>]*>.*?<\/style>/gs, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const maxChars = args.maxChars || 20000;
        return text.substring(0, maxChars);
      }

      case "browser": {
        const page = await getBrowserPage();
        switch (args.action) {
          case "navigate": {
            await page.goto(args.url, { waitUntil: "networkidle", timeout: 30000 }).catch(() =>
              page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 })
            );
            // Auto-dismiss cookie banners (try multiple selectors)
            for (const sel of [
              "#gdpr-banner-accept", "[data-testid='uc-accept-all-button']",
              "button:has-text('Alle akzeptieren')", "button:has-text('Accept all')",
              "button:has-text('Alle Cookies akzeptieren')", "#consent-page .btn--primary",
              "button:has-text('Accept All')", "button:has-text('Akzeptieren')",
              "#onetrust-accept-btn-handler", "[data-gdpr-consent='accept']",
            ]) {
              try {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 1000 })) {
                  await btn.click();
                  await page.waitForTimeout(1500);
                  break;
                }
              } catch { /* ignore */ }
            }
            await page.waitForTimeout(2000);
            // Try structured extraction for listing pages (eBay, Amazon, etc.)
            const structured = await page.evaluate(() => {
              // eBay listing extraction
              const items = document.querySelectorAll("li.s-item, [data-viewport]");
              if (items.length > 2) {
                const results: string[] = [];
                items.forEach((item, i) => {
                  if (i > 15) {return;}
                  const link = item.querySelector('a[href*="/itm/"]') as HTMLAnchorElement;
                  const priceEl = item.querySelector('[class*="price"]');
                  const titleEl = link?.querySelector('span[role="heading"]') || link;
                  if (link && titleEl) {
                    const title = titleEl.textContent?.trim()?.substring(0, 100) || "";
                    const price = priceEl?.textContent?.trim() || "";
                    const url = link.href.split("?")[0];
                    if (title.length > 3 && !title.includes("Shop on eBay"))
                      {results.push(`${title} — ${price}\n${url}`);}
                  }
                });
                if (results.length > 0) {return results.join("\n\n");}
              }
              // Fallback: readable text
              return document.body.innerText.substring(0, 8000);
            });
            return `Navigated to ${args.url}\n\n${structured}`;
          }
          case "click": {
            await page.click(args.selector, { timeout: 5000 });
            await page.waitForTimeout(1000);
            return `Clicked: ${args.selector}`;
          }
          case "type": {
            await page.fill(args.selector, args.text);
            return `Typed "${args.text}" into ${args.selector}`;
          }
          case "evaluate": {
            const result = await page.evaluate(args.script);
            return typeof result === "string" ? result : JSON.stringify(result, null, 2);
          }
          case "snapshot": {
            const text = await page.evaluate(() => document.body.innerText.substring(0, 8000));
            return text;
          }
          case "screenshot": {
            const buf = await page.screenshot({ type: "png" });
            const screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
            await fs.writeFile(screenshotPath, buf);
            return `Screenshot saved to ${screenshotPath}`;
          }
          default:
            return `Unknown browser action: ${args.action}`;
        }
      }

      case "exec": {
        const timeout = (args.timeout || 30) * 1000;
        try {
          const { stdout, stderr } = await execAsync(args.command, { 
            timeout, 
            maxBuffer: 1024 * 1024,
            cwd: "/tmp",
          });
          const output = (stdout + (stderr ? `\nSTDERR: ${stderr}` : "")).trim();
          return output || "(no output)";
        } catch (e: any) {
          return `Command failed: ${e.message}\n${e.stdout || ""}\n${e.stderr || ""}`.trim();
        }
      }

      case "read_file": {
        const content = await fs.readFile(args.path, "utf-8");
        return content.substring(0, 50000);
      }

      case "write_file": {
        await fs.mkdir(path.dirname(args.path), { recursive: true });
        await fs.writeFile(args.path, args.content, "utf-8");
        return `Written ${args.content.length} bytes to ${args.path}`;
      }

      case "image": {
        // Use the vision model to analyze the image
        // For now, return a placeholder — full implementation needs vision API
        return `Image analysis not yet implemented for standalone runner. Image: ${args.image}`;
      }

      case "edit": {
        const content = await fs.readFile(args.path, "utf-8");
        if (!content.includes(args.old_string)) {
          return `Error: old_string not found in ${args.path}. Make sure it matches exactly (including whitespace).`;
        }
        const newContent = content.replace(args.old_string, args.new_string);
        await fs.writeFile(args.path, newContent, "utf-8");
        return `Edited ${args.path}: replaced ${args.old_string.length} chars with ${args.new_string.length} chars`;
      }

      case "tts": {
        const openaiKey = apiKeys.OPENAI_API_KEY;
        if (!openaiKey) return "Error: No OpenAI API key configured. Add OPENAI_API_KEY in Settings for TTS.";
        const voice = args.voice || "alloy";
        const outputPath = args.output || `/tmp/tts-${Date.now()}.mp3`;
        const resp = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "tts-1", input: args.text, voice }),
        });
        if (!resp.ok) return `TTS error: ${resp.status} ${await resp.text()}`;
        const buf = Buffer.from(await resp.arrayBuffer());
        await fs.writeFile(outputPath, buf);
        return `Audio saved to ${outputPath} (${buf.length} bytes, voice: ${voice})`;
      }

      case "message": {
        // Send via openOrchestrator backend API (which handles channel configs)
        try {
          const resp = await fetch("http://127.0.0.1:8080/api/message/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_type: args.channel_type, text: args.text, chat_id: args.chat_id }),
          });
          if (!resp.ok) return `Message send failed: ${resp.status} ${await resp.text()}`;
          return `Message sent via ${args.channel_type}`;
        } catch (e: any) {
          return `Message error: ${e.message}`;
        }
      }

      case "memory_search": {
        // Simple grep-based search through memory/workspace files
        const searchDir = args.path || "/tmp/bot-workspace";
        try {
          const { stdout } = await execAsync(
            `grep -ril --include="*.md" --include="*.txt" --include="*.json" ${JSON.stringify(args.query)} ${JSON.stringify(searchDir)} 2>/dev/null | head -10`,
            { timeout: 5000 }
          );
          if (!stdout.trim()) return `No results found for "${args.query}" in ${searchDir}`;
          // Read snippets from matching files
          const files = stdout.trim().split("\n");
          const results: string[] = [];
          for (const file of files.slice(0, 5)) {
            const { stdout: grepOut } = await execAsync(
              `grep -n -i -C 2 ${JSON.stringify(args.query)} ${JSON.stringify(file)} | head -20`,
              { timeout: 3000 }
            );
            results.push(`## ${file}\n${grepOut.trim()}`);
          }
          return results.join("\n\n");
        } catch {
          return `No results found for "${args.query}"`;
        }
      }

      case "memory_get": {
        const content = await fs.readFile(args.path, "utf-8");
        const allLines = content.split("\n");
        const from = (args.from || 1) - 1;
        const count = args.lines || allLines.length;
        return allLines.slice(from, from + count).join("\n");
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    return `Tool error (${name}): ${e.message}`;
  }
}

// --------------- Model Resolution ---------------

function resolveModelFromString(modelStr: string, apiKey: string): Model<any> | null {
  // Try provider/model format first (e.g. "openai/gpt-5")
  const parts = modelStr.split("/");
  if (parts.length === 2) {
    try {
      const model = getModel(parts[0] as any, parts[1] as any);
      return model;
    } catch { /* fall through */ }
  }
  
  // Try common aliases
  const aliases: Record<string, [string, string]> = {
    "gpt-4o": ["openai", "gpt-4o"],
    "gpt-4o-mini": ["openai", "gpt-4o-mini"],
    "gpt-5": ["openai", "gpt-5"],
    "gpt-5-mini": ["openai", "gpt-5-mini"],
    "claude-sonnet-4": ["anthropic", "claude-sonnet-4-20250514"],
    "claude-opus-4": ["anthropic", "claude-opus-4-0"],
    "claude-3.5-sonnet": ["anthropic", "claude-3-5-sonnet-20241022"],
    "claude-sonnet-4-20250514": ["anthropic", "claude-sonnet-4-20250514"],
    "gemini-2.5-flash": ["google", "gemini-2.5-flash-preview-05-20"],
    "gemini-2.5-pro": ["google", "gemini-2.5-pro-preview-06-05"],
  };
  
  // Normalize: remove "Advanced: " prefix that UI adds
  const normalized = modelStr.replace(/^Advanced:\s*/, "").trim();
  
  if (aliases[normalized]) {
    try {
      const [provider, model] = aliases[normalized];
      return getModel(provider as any, model as any);
    } catch { /* fall through */ }
  }
  
  // Try to find by searching all providers
  for (const provider of getProviders()) {
    try {
      const models = getModels(provider);
      const match = models.find(m => 
        m.id === modelStr || m.name === modelStr || m.id.includes(normalized.toLowerCase())
      );
      if (match) {return match;}
    } catch { /* ignore */ }
  }
  
  return null;
}

// --------------- Agent Run (Tool Loop) ---------------

interface RunParams {
  prompt: string;        // System prompt (bot description + instructions)
  input: string;         // User input message
  model: string;         // Model identifier
  tools: string[];       // Enabled tool names
  apiKeys: Record<string, string>;  // Provider API keys
  maxTimeSeconds: number;           // Max runtime
  maxToolCalls: number;             // Max tool iterations
}

async function* runAgent(params: RunParams, runId: string): AsyncGenerator<any> {
  const { prompt, input, model: modelStr, tools, apiKeys, maxTimeSeconds, maxToolCalls } = params;
  
  // Resolve model
  const apiKey = apiKeys.OPENAI_API_KEY || apiKeys.ANTHROPIC_API_KEY || apiKeys.GOOGLE_API_KEY || "";
  const model = resolveModelFromString(modelStr, apiKey);
  if (!model) {
    yield { type: "error", message: `Model not found: ${modelStr}. Available: gpt-4o, gpt-5, claude-sonnet-4, gemini-2.5-flash` };
    return;
  }

  // Determine API key for the provider
  const providerKeyMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    mistral: "MISTRAL_API_KEY",
    xai: "XAI_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const keyName = providerKeyMap[model.provider] || `${model.provider.toUpperCase()}_API_KEY`;
  const modelApiKey = apiKeys[keyName];
  if (!modelApiKey) {
    yield { type: "error", message: `No API key for provider "${model.provider}". Set ${keyName} in Settings.` };
    return;
  }

  // Build tool schemas
  const toolSchemas = getToolSchemas(tools);
  
  // Build context (pi-ai Context interface)
  const context: Context = {
    systemPrompt: prompt,
    messages: [
      { role: "user", content: [{ type: "text", text: input }] },
    ],
    tools: toolSchemas.length > 0 ? toolSchemas : undefined,
  };

  const startTime = Date.now();
  let toolCallCount = 0;
  const maxTime = maxTimeSeconds * 1000;

  yield { type: "started", model: model.id, provider: model.provider, tools: tools.length };

  // Tool loop
  while (true) {
    // Time check
    if (Date.now() - startTime > maxTime) {
      yield { type: "error", message: `Timeout after ${maxTimeSeconds}s` };
      return;
    }

    // Call LLM
    let assistantMessage: AssistantMessage;
    try {
      yield { type: "llm_call", iteration: toolCallCount + 1 };
      
      const streamOptions: any = {
        apiKey: modelApiKey,
        maxTokens: 4096,
      };

      // Stream LLM response (tools are in context.tools)
      const eventStream = stream(model, context, streamOptions);
      
      let fullMessage: AssistantMessage | null = null;
      for await (const event of eventStream) {
        if (event.type === "text_delta") {
          yield { type: "text_delta", delta: event.delta };
        } else if (event.type === "done") {
          fullMessage = event.message;
        } else if (event.type === "error") {
          yield { type: "error", message: `LLM error: ${JSON.stringify(event.error)}` };
          return;
        }
      }
      if (!fullMessage) {
        yield { type: "error", message: "No response from LLM" };
        return;
      }
      assistantMessage = fullMessage;
    } catch (e: any) {
      yield { type: "error", message: `LLM call failed: ${e.message}` };
      return;
    }

    // Add assistant response to context
    context.messages.push(assistantMessage);

    // Check for tool calls
    const toolCalls = assistantMessage.content.filter(
      (c: any): c is ToolCall => c.type === "toolCall"
    );

    if (toolCalls.length === 0) {
      // No tool calls — we're done
      const textContent = assistantMessage.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      
      yield { 
        type: "complete", 
        output: textContent,
        usage: assistantMessage.usage,
        toolCalls: toolCallCount,
        durationMs: Date.now() - startTime,
      };
      return;
    }

    // Execute tool calls
    toolCallCount += toolCalls.length;
    if (toolCallCount > maxToolCalls) {
      yield { type: "error", message: `Max tool calls exceeded (${maxToolCalls})` };
      return;
    }

    for (const tc of toolCalls) {
      yield { type: "tool_call", name: tc.name, args: tc.arguments };
      
      const result = await executeTool(tc.name, tc.arguments, apiKeys);
      
      yield { type: "tool_result", name: tc.name, result: result.substring(0, 500) };
      
      // Each tool result is a separate message in pi-ai format
      context.messages.push({
        role: "toolResult",
        toolCallId: tc.id,
        toolName: tc.name,
        content: [{ type: "text", text: result }],
        isError: false,
        timestamp: Date.now(),
      });
    }
  }
}

// --------------- HTTP Endpoints ---------------

// POST /agent/run — Start an agent run, returns SSE stream
app.post("/agent/run", async (req, res) => {
  const runId = crypto.randomUUID().substring(0, 8);
  const {
    prompt = "You are a helpful assistant.",
    input = "",
    model = "gpt-4o",
    tools = [],
    apiKeys = {},
    maxTimeSeconds = 120,
    maxToolCalls = 20,
  } = req.body;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Run-ID", runId);

  const abortController = new AbortController();
  activeRuns.set(runId, { abortController, status: "running" });

  res.on("close", () => {
    abortController.abort();
    activeRuns.delete(runId);
  });

  try {
    for await (const event of runAgent({
      prompt, input, model, tools, apiKeys, maxTimeSeconds, maxToolCalls,
    }, runId)) {
      if (abortController.signal.aborted) {break;}
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
  } finally {
    activeRuns.delete(runId);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  }
});

// POST /agent/run/sync — Synchronous run, returns JSON result
app.post("/agent/run/sync", async (req, res) => {
  const runId = crypto.randomUUID().substring(0, 8);
  const {
    prompt = "You are a helpful assistant.",
    input = "",
    model = "gpt-4o",
    tools = [],
    apiKeys = {},
    maxTimeSeconds = 120,
    maxToolCalls = 20,
  } = req.body;

  const events: any[] = [];
  let finalOutput = "";
  let error: string | null = null;

  try {
    for await (const event of runAgent({
      prompt, input, model, tools, apiKeys, maxTimeSeconds, maxToolCalls,
    }, runId)) {
      events.push(event);
      if (event.type === "complete") {
        finalOutput = event.output;
      } else if (event.type === "error") {
        error = event.message;
      }
    }
  } catch (e: any) {
    error = e.message;
  }

  res.json({
    runId,
    status: error ? "failed" : "completed",
    output: finalOutput,
    error,
    events,
  });
});

// GET /tools — List available tools
app.get("/tools", (_req, res) => {
  res.json({
    tools: [
      { name: "web_search", description: "Search the web (needs BRAVE_API_KEY)", group: "web" },
      { name: "web_fetch", description: "Fetch URL content as text", group: "web" },
      { name: "browser", description: "Real browser control (Playwright)", group: "browser" },
      { name: "exec", description: "Execute shell commands", group: "core" },
      { name: "read_file", description: "Read file contents", group: "core" },
      { name: "write_file", description: "Write files", group: "core" },
      { name: "edit", description: "Precise text replacement in files", group: "core" },
      { name: "image", description: "Image analysis (vision)", group: "ai" },
      { name: "tts", description: "Text-to-speech (needs OPENAI_API_KEY)", group: "ai" },
      { name: "message", description: "Send messages to Telegram/Discord/Webhook", group: "communication" },
      { name: "memory_search", description: "Search bot memory files", group: "memory" },
      { name: "memory_get", description: "Read bot memory files", group: "memory" },
    ],
  });
});

// GET /models — List available models
app.get("/models", (_req, res) => {
  const result: any[] = [];
  for (const provider of getProviders()) {
    try {
      const models = getModels(provider);
      for (const m of models) {
        result.push({
          id: m.id,
          name: m.name,
          provider: m.provider,
          reasoning: m.reasoning,
          input: m.input,
          contextWindow: m.contextWindow,
          cost: m.cost,
        });
      }
    } catch { /* skip providers with issues */ }
  }
  res.json({ models: result, count: result.length });
});

// GET /health — Health check
app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    activeRuns: activeRuns.size,
    uptime: process.uptime(),
  });
});

// DELETE /agent/run/:runId — Abort a run
app.delete("/agent/run/:runId", (req, res) => {
  const run = activeRuns.get(req.params.runId);
  if (run) {
    run.abortController.abort();
    activeRuns.delete(req.params.runId);
    res.json({ status: "aborted" });
  } else {
    res.status(404).json({ error: "Run not found" });
  }
});

// --------------- Start Server ---------------

app.listen(PORT, () => {
  console.log(`🚀 Agent Runner Server listening on http://localhost:${PORT}`);
  console.log(`   Tools: web_search, web_fetch, browser, exec, read_file, write_file, image`);
  console.log(`   Endpoints: POST /agent/run (SSE), POST /agent/run/sync, GET /tools, GET /models`);
});
