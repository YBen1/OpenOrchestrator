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
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const text = await resp.text();
    // HTML → text extraction
    const clean = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim()
      .slice(0, maxChars);
    return { content: clean, url, length: clean.length, status: resp.status };
  } catch (e) {
    return { error: e.message };
  }
}

// Browser via Playwright — built-in, no external server needed
let _browser = null;
async function getBrowser() {
  if (_browser) {
    return _browser;
  }
  const pw = await import("playwright-core");
  const execPath =
    process.env.BROWSER_EXECUTABLE ||
    "/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
  _browser = await pw.chromium.launch({
    executablePath: execPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return _browser;
}

async function executeBrowserAction(args) {
  const { url } = args;
  if (!url) {
    return { error: "url is required" };
  }
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Try to dismiss cookie banners
    try {
      const cookieBtn = await page.$(
        'button:has-text("Alle akzeptieren"), button:has-text("Accept All"), #onetrust-accept-btn-handler',
      );
      if (cookieBtn) {
        await cookieBtn.click().catch(() => {});
      }
      await page.waitForTimeout(1000);
    } catch {}

    const text = await page.evaluate(() => {
      // Try to extract main content area only
      const main = document.querySelector(
        "main, [role='main'], .srp-results, #srp-river-results, .s-main-slot, #mainContent, article, .content",
      );
      const target = main || document.body;
      target
        .querySelectorAll(
          "script,style,nav,header,footer,iframe,noscript,[role='banner'],[role='navigation']",
        )
        .forEach((el) => el.remove());
      return target.innerText || document.body?.innerText || "";
    });
    await page.close();
    return { content: text.slice(0, 8000), url, length: text.length };
  } catch (e) {
    return { error: `Browser error: ${e.message}` };
  }
}

async function executeExec(args) {
  const { command, timeoutMs = 30000 } = args;
  const { execSync } = await import("node:child_process");
  try {
    const output = execSync(command, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: output.slice(0, 10000) };
  } catch (e) {
    return {
      stdout: (e.stdout || "").slice(0, 5000),
      stderr: (e.stderr || "").slice(0, 2000),
      exitCode: e.status,
    };
  }
}

// Tool definitions for pi-ai
const AVAILABLE_TOOLS = {
  web_search: {
    name: "web_search",
    description:
      "Search the web using Brave Search API. Returns titles, URLs, and snippets. Requires BRAVE_API_KEY. If unavailable, use web_fetch to visit URLs directly instead.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      count: Type.Optional(Type.Number({ description: "Number of results (1-10)", default: 5 })),
    }),
    execute: executeWebSearch,
  },
  web_fetch: {
    name: "web_fetch",
    description:
      "Fetch and extract readable text content from any URL. Use this to visit websites directly, read articles, check prices, scrape pages. No API key needed.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
      maxChars: Type.Optional(
        Type.Number({ description: "Max characters to return", default: 10000 }),
      ),
    }),
    execute: executeWebFetch,
  },
  exec: {
    name: "exec",
    description:
      "Execute a shell command. Use for: curl, data processing, file operations, running scripts. Returns stdout/stderr.",
    parameters: Type.Object({
      command: Type.String({ description: "Shell command to execute" }),
      timeoutMs: Type.Optional(Type.Number({ description: "Timeout in ms", default: 30000 })),
    }),
    execute: executeExec,
  },
  browser: {
    name: "browser",
    description:
      "Open a real web browser (Chrome) to visit a URL and read the fully rendered page content including JavaScript. Use for dynamic sites like eBay, Amazon, social media.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to visit and read" }),
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

  // Build tool list — all tools by default, agent decides what to use
  // Skip web_search if no BRAVE_API_KEY (avoids wasting a round on a tool that will fail)
  const toolDefs = [];
  const toolExecutors = {};
  const allTools = Object.keys(AVAILABLE_TOOLS);
  const toolNames =
    enabledTools?.length > 0
      ? enabledTools
      : allTools.filter((t) => t !== "web_search" || process.env.BRAVE_API_KEY);
  for (const toolName of toolNames) {
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

    // Execute tool calls and add results per pi-ai format
    context.messages.push({ role: "assistant", content: response.content });
    for (const tc of toolCalls) {
      const executor = toolExecutors[tc.name];
      let resultText;
      if (executor) {
        toolLog.push({ tool: tc.name, args: tc.arguments });
        const result = await executor(tc.arguments || {});
        resultText = JSON.stringify(result).slice(0, 8000);
      } else {
        resultText = `Unknown tool: ${tc.name}`;
      }
      context.messages.push({
        role: "toolResult",
        toolCallId: tc.id,
        toolName: tc.name,
        content: [{ type: "text", text: resultText }],
        isError: false,
        timestamp: Date.now(),
      });
    }
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
