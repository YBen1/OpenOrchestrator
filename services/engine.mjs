/**
 * openOrchestrator Engine Service
 *
 * Thin HTTP wrapper around pi-ai for the Python bot runner.
 * Handles: LLM calls with tool-loop, web search, web fetch, browser.
 *
 * POST /run  — Execute a bot prompt with tools
 * GET /models — List available models
 * GET /health — Health check
 */

import http from "node:http";
import { getModel, complete, Type, getProviders, getModels } from "@mariozechner/pi-ai";

const PORT = parseInt(process.env.ENGINE_PORT || "18800");

// ── Tools ────────────────────────────────────────────────

async function executeWebSearch(args) {
  const { query, count = 5 } = args;
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return { error: "No BRAVE_API_KEY set" };
  }
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const resp = await fetch(url, { headers: { "X-Subscription-Token": apiKey } });
  const data = await resp.json();
  const results = (data.web?.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
  return { results };
}

async function executeWebFetch(args) {
  const { url, maxChars = 10000 } = args;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; openOrchestrator/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await resp.text();
    // Simple HTML → text extraction
    const clean = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
    return { content: clean, url, length: clean.length };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeBrowserAction(args) {
  const browserPort = parseInt(process.env.BROWSER_PORT || "18791");
  try {
    const resp = await fetch(`http://127.0.0.1:${browserPort}/api/browser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30000),
    });
    return await resp.json();
  } catch (e) {
    return { error: `Browser not available: ${e.message}` };
  }
}

// Tool definitions for pi-ai
const AVAILABLE_TOOLS = {
  web_search: {
    name: "web_search",
    description: "Search the web using Brave Search API. Returns titles, URLs, and snippets.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      count: Type.Optional(Type.Number({ description: "Number of results (1-10)", default: 5 })),
    }),
    execute: executeWebSearch,
  },
  web_fetch: {
    name: "web_fetch",
    description: "Fetch and extract readable text content from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
      maxChars: Type.Optional(
        Type.Number({ description: "Max characters to return", default: 10000 }),
      ),
    }),
    execute: executeWebFetch,
  },
  browser: {
    name: "browser",
    description:
      "Control a web browser. Can navigate to URLs, click elements, fill forms, take screenshots, and read page content.",
    parameters: Type.Object({
      action: Type.String({
        description: "Action: navigate, snapshot, screenshot, click, type, scroll",
      }),
      url: Type.Optional(Type.String({ description: "URL to navigate to" })),
      selector: Type.Optional(Type.String({ description: "CSS selector for element" })),
      text: Type.Optional(Type.String({ description: "Text to type" })),
    }),
    execute: executeBrowserAction,
  },
};

// ── Run endpoint ─────────────────────────────────────────

async function handleRun(body) {
  const {
    prompt,
    systemPrompt,
    model: modelStr,
    tools: enabledTools = [],
    maxTokens = 4000,
    maxRounds = 10,
  } = body;

  // Parse model string (e.g. "openai/gpt-4o-mini" or just "gpt-4o-mini")
  let provider, modelId;
  if (modelStr?.includes("/")) {
    [provider, modelId] = modelStr.split("/", 2);
  } else {
    // Auto-detect provider from model name
    const m = modelStr || "gpt-4o-mini";
    if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) {
      provider = "openai";
    } else if (m.startsWith("claude")) {
      provider = "anthropic";
    } else if (m.startsWith("gemini")) {
      provider = "google";
    } else if (m.startsWith("mistral") || m.startsWith("codestral")) {
      provider = "mistral";
    } else {
      provider = "openai";
    }
    modelId = m;
  }

  const model = getModel(provider, modelId);

  // Build tool list
  const toolDefs = [];
  const toolExecutors = {};
  for (const toolName of enabledTools) {
    const tool = AVAILABLE_TOOLS[toolName];
    if (tool) {
      toolDefs.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      });
      toolExecutors[tool.name] = tool.execute;
    }
  }

  // Build context
  const context = {
    systemPrompt: systemPrompt || "You are a helpful assistant.",
    messages: [{ role: "user", content: prompt }],
    tools: toolDefs.length > 0 ? toolDefs : undefined,
  };

  let totalIn = 0,
    totalOut = 0;
  const toolLog = [];

  // Tool-call loop
  for (let round = 0; round < maxRounds; round++) {
    const response = await complete(model, context, { maxTokens });

    totalIn += response.usage?.input || response.usage?.inputTokens || 0;
    totalOut += response.usage?.output || response.usage?.outputTokens || 0;

    // Check for tool calls
    const toolCalls = response.content.filter((b) => b.type === "toolCall");
    if (toolCalls.length === 0) {
      // No tool calls — extract text and return
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return {
        output: text,
        tokens_in: totalIn,
        tokens_out: totalOut,
        model: `${provider}/${modelId}`,
        rounds: round + 1,
        tool_log: toolLog,
      };
    }

    // Execute tool calls
    context.messages.push({ role: "assistant", content: response.content });
    const toolResults = [];
    for (const tc of toolCalls) {
      const executor = toolExecutors[tc.name];
      if (executor) {
        toolLog.push({ tool: tc.name, args: tc.arguments });
        const result = await executor(tc.arguments || {});
        toolResults.push({
          type: "toolResult",
          toolCallId: tc.toolCallId,
          content: JSON.stringify(result).slice(0, 8000),
        });
      } else {
        toolResults.push({
          type: "toolResult",
          toolCallId: tc.toolCallId,
          content: `Unknown tool: ${tc.name}`,
        });
      }
    }
    context.messages.push({ role: "user", content: toolResults });
  }

  return {
    output: "Max tool rounds reached",
    tokens_in: totalIn,
    tokens_out: totalOut,
    model: `${provider}/${modelId}`,
    rounds: maxRounds,
    tool_log: toolLog,
  };
}

// ── Models endpoint ──────────────────────────────────────

function handleModels() {
  const providers = getProviders();
  const models = [];
  for (const provider of providers) {
    for (const m of getModels(provider)) {
      models.push({
        id: `${provider}/${m.id}`,
        provider,
        name: m.id,
      });
    }
  }
  return models;
}

// ── HTTP Server ──────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && req.url === "/health") {
    res.end(JSON.stringify({ ok: true, service: "openOrchestrator-engine" }));
    return;
  }

  if (req.method === "GET" && req.url === "/models") {
    res.end(JSON.stringify(handleModels()));
    return;
  }

  if (req.method === "POST" && req.url === "/run") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    try {
      const parsed = JSON.parse(body);
      const result = await handleRun(parsed);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message?.slice(0, 500) }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 openOrchestrator Engine running on http://127.0.0.1:${PORT}`);
  console.log(`   Tools: ${Object.keys(AVAILABLE_TOOLS).join(", ")}`);
});
