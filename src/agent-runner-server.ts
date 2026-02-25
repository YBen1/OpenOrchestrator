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
    process: {
      name: "process",
      description: "Manage background exec sessions. Actions: list (show running), poll (check status), log (get output), write (send input), kill (terminate).",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("list"), Type.Literal("poll"), Type.Literal("log"), Type.Literal("write"), Type.Literal("kill")]),
        sessionId: Type.Optional(Type.String({ description: "Session ID (required for poll/log/write/kill)" })),
        data: Type.Optional(Type.String({ description: "Data to write to stdin (for write action)" })),
      }),
    },
    apply_patch: {
      name: "apply_patch",
      description: "Apply a unified diff patch to a file. Supports multi-hunk edits.",
      parameters: Type.Object({
        path: Type.String({ description: "Path to the file to patch" }),
        patch: Type.String({ description: "Unified diff content" }),
      }),
    },
    cron: {
      name: "cron",
      description: "Manage scheduled jobs via OpenClaw Gateway. Actions: list, add, remove, run, enable, disable. For 'add': provide schedule (cron expression) and payload (command to run).",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("list"), Type.Literal("add"), Type.Literal("remove"), Type.Literal("run"), Type.Literal("enable"), Type.Literal("disable")]),
        jobId: Type.Optional(Type.String({ description: "Job ID (for remove/run/enable/disable)" })),
        name: Type.Optional(Type.String({ description: "Job name (for add)" })),
        schedule: Type.Optional(Type.String({ description: "Cron expression e.g. '0 9 * * *' (for add)" })),
        command: Type.Optional(Type.String({ description: "Command/message to execute (for add)" })),
      }),
    },
    sessions_spawn: {
      name: "sessions_spawn",
      description: "Spawn a background sub-agent run in an isolated session. The agent runs independently and announces results when done.",
      parameters: Type.Object({
        task: Type.String({ description: "Task description for the sub-agent" }),
        model: Type.Optional(Type.String({ description: "Model to use (default: configured default)" })),
        label: Type.Optional(Type.String({ description: "Label for the session" })),
      }),
    },
    subagents: {
      name: "subagents",
      description: "List, steer, or kill spawned sub-agents. Actions: list (show active), steer (send message), kill (terminate).",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("list"), Type.Literal("steer"), Type.Literal("kill")]),
        target: Type.Optional(Type.String({ description: "Session key or label (for steer/kill)" })),
        message: Type.Optional(Type.String({ description: "Message to send (for steer)" })),
      }),
    },
    sessions_list: {
      name: "sessions_list",
      description: "List active sessions with optional filters.",
      parameters: Type.Object({
        activeMinutes: Type.Optional(Type.Number({ description: "Only sessions active in last N minutes" })),
        limit: Type.Optional(Type.Number({ description: "Max results" })),
      }),
    },
    sessions_send: {
      name: "sessions_send",
      description: "Send a message into another session.",
      parameters: Type.Object({
        sessionKey: Type.String({ description: "Target session key" }),
        message: Type.String({ description: "Message to send" }),
      }),
    },
    nodes: {
      name: "nodes",
      description: "Discover and control paired nodes/devices. Actions: status, camera_snap, screen_record, location_get, notify, run.",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("status"), Type.Literal("camera_snap"), Type.Literal("screen_record"), Type.Literal("location_get"), Type.Literal("notify"), Type.Literal("run")]),
        node: Type.Optional(Type.String({ description: "Node id or name" })),
        command: Type.Optional(Type.String({ description: "Command to run on node (for run)" })),
        title: Type.Optional(Type.String({ description: "Notification title (for notify)" })),
        body: Type.Optional(Type.String({ description: "Notification body (for notify)" })),
      }),
    },
    canvas: {
      name: "canvas",
      description: "Control node canvases — present HTML/URL content, evaluate JS, take snapshots.",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("present"), Type.Literal("hide"), Type.Literal("navigate"), Type.Literal("eval"), Type.Literal("snapshot")]),
        url: Type.Optional(Type.String({ description: "URL to present/navigate to" })),
        javaScript: Type.Optional(Type.String({ description: "JS to evaluate (for eval)" })),
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

// Gateway token for OpenClaw CLI calls
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

async function openclawCli(args: string, timeout = 30000): Promise<string> {
  try {
    const tokenArg = GATEWAY_TOKEN ? `--token ${GATEWAY_TOKEN}` : "";
    const { stdout, stderr } = await execAsync(`openclaw ${args} ${tokenArg} --json 2>/dev/null || openclaw ${args} ${tokenArg} 2>&1`, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: GATEWAY_TOKEN },
    });
    return (stdout + (stderr || "")).trim();
  } catch (e: any) {
    return `OpenClaw CLI error: ${e.message}\n${e.stdout || ""}\n${e.stderr || ""}`.trim();
  }
}

// Background process tracking for the process tool
const bgProcesses = new Map<string, { proc: any; output: string[]; done: boolean; exitCode: number | null }>();

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
        const openaiKey = apiKeys.OPENAI_API_KEY;
        const anthropicKey = apiKeys.ANTHROPIC_API_KEY;
        const googleKey = apiKeys.GOOGLE_API_KEY;
        const imageInput = args.image;
        const prompt = args.prompt || "Describe this image in detail.";

        // Determine image content: URL or file path
        let imageUrl = imageInput;
        let base64Data: string | null = null;
        if (!imageInput.startsWith("http")) {
          // Local file — read and base64 encode
          try {
            const buf = await fs.readFile(imageInput);
            const ext = imageInput.split(".").pop()?.toLowerCase() || "png";
            const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";
            base64Data = `data:${mime};base64,${buf.toString("base64")}`;
          } catch (e: any) {
            return `Error reading image file: ${e.message}`;
          }
        }

        // Try OpenAI Vision first
        if (openaiKey) {
          try {
            const content: any[] = [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: base64Data || imageUrl } },
            ];
            const resp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content }], max_tokens: 1000 }),
            });
            if (resp.ok) {
              const data = await resp.json() as any;
              return data.choices?.[0]?.message?.content || "No response from vision model.";
            }
          } catch { /* fall through */ }
        }

        // Try Anthropic Vision
        if (anthropicKey) {
          try {
            const imgSource = base64Data
              ? { type: "base64", media_type: base64Data.split(";")[0].split(":")[1], data: base64Data.split(",")[1] }
              : { type: "url", url: imageUrl };
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [{ role: "user", content: [{ type: "image", source: imgSource }, { type: "text", text: prompt }] }],
              }),
            });
            if (resp.ok) {
              const data = await resp.json() as any;
              return data.content?.map((b: any) => b.text).join("") || "No response.";
            }
          } catch { /* fall through */ }
        }

        // Try Google Gemini Vision
        if (googleKey) {
          try {
            const parts: any[] = [{ text: prompt }];
            if (base64Data) {
              parts.push({ inline_data: { mime_type: base64Data.split(";")[0].split(":")[1], data: base64Data.split(",")[1] } });
            } else {
              parts.push({ file_data: { file_uri: imageUrl, mime_type: "image/jpeg" } });
            }
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts }] }),
            });
            if (resp.ok) {
              const data = await resp.json() as any;
              return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "No response.";
            }
          } catch { /* fall through */ }
        }

        return "Error: No vision-capable API key configured. Add OpenAI, Anthropic, or Google API key in Settings.";
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

      case "process": {
        switch (args.action) {
          case "list": {
            const entries: string[] = [];
            for (const [id, p] of bgProcesses) {
              entries.push(`${id}: ${p.done ? `exited(${p.exitCode})` : "running"} (${p.output.length} lines)`);
            }
            return entries.length ? entries.join("\n") : "No background processes.";
          }
          case "poll": {
            const p = bgProcesses.get(args.sessionId || "");
            if (!p) return `Session not found: ${args.sessionId}`;
            return p.done ? `Completed (exit ${p.exitCode}). Last output:\n${p.output.slice(-10).join("\n")}` : "Still running...";
          }
          case "log": {
            const p = bgProcesses.get(args.sessionId || "");
            if (!p) return `Session not found: ${args.sessionId}`;
            return p.output.slice(-50).join("\n") || "(no output)";
          }
          case "write": {
            const p = bgProcesses.get(args.sessionId || "");
            if (!p || p.done) return `Session not found or already finished: ${args.sessionId}`;
            try { p.proc.stdin?.write(args.data + "\n"); return "Written."; }
            catch { return "Failed to write to process."; }
          }
          case "kill": {
            const p = bgProcesses.get(args.sessionId || "");
            if (!p) return `Session not found: ${args.sessionId}`;
            try { p.proc.kill("SIGTERM"); p.done = true; return "Killed."; }
            catch { return "Failed to kill process."; }
          }
          default: return `Unknown process action: ${args.action}`;
        }
      }

      case "apply_patch": {
        // Write patch to temp file and apply with patch command
        const patchFile = `/tmp/patch-${Date.now()}.diff`;
        await fs.writeFile(patchFile, args.patch, "utf-8");
        try {
          const { stdout } = await execAsync(`cd / && patch -p0 < ${patchFile} 2>&1`, { timeout: 10000 });
          await fs.unlink(patchFile).catch(() => {});
          return `Patch applied:\n${stdout}`;
        } catch (e: any) {
          await fs.unlink(patchFile).catch(() => {});
          return `Patch failed: ${e.message}\n${e.stdout || ""}`;
        }
      }

      case "cron": {
        switch (args.action) {
          case "list": return await openclawCli("cron list");
          case "add": {
            const name = args.name ? `--name "${args.name}"` : "";
            const sched = args.schedule ? `--schedule "${args.schedule}"` : "";
            const cmd = args.command ? `--text "${args.command}"` : "";
            return await openclawCli(`cron add ${name} ${sched} ${cmd}`);
          }
          case "remove": return await openclawCli(`cron rm ${args.jobId}`);
          case "run": return await openclawCli(`cron run ${args.jobId}`);
          case "enable": return await openclawCli(`cron enable ${args.jobId}`);
          case "disable": return await openclawCli(`cron disable ${args.jobId}`);
          default: return `Unknown cron action: ${args.action}`;
        }
      }

      case "sessions_spawn": {
        // Run in background — don't block the bot's tool loop
        const model = args.model ? `--model "${args.model}"` : "";
        const label = args.label ? `--label "${args.label}"` : "";
        const sessionId = `spawn-${Date.now()}`;
        const tokenArg = GATEWAY_TOKEN ? `--token ${GATEWAY_TOKEN}` : "";
        const cmd = `openclaw agent -m "${args.task.replace(/"/g, '\\"')}" ${model} ${label} --deliver ${tokenArg}`;
        const { spawn } = await import("node:child_process");
        const proc = spawn("bash", ["-c", cmd], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: GATEWAY_TOKEN } });
        const entry = { proc, output: [] as string[], done: false, exitCode: null as number | null };
        proc.stdout?.on("data", (d: Buffer) => entry.output.push(d.toString()));
        proc.stderr?.on("data", (d: Buffer) => entry.output.push(d.toString()));
        proc.on("close", (code: number) => { entry.done = true; entry.exitCode = code; });
        bgProcesses.set(sessionId, entry);
        return `Sub-agent spawned in background (session: ${sessionId}). Use process tool with action=poll/log to check progress.`;
      }

      case "subagents": {
        switch (args.action) {
          case "list": return await openclawCli("system presence");
          case "steer": {
            if (!args.target || !args.message) return "Error: target and message required for steer";
            return await openclawCli(`agent -m "${args.message}" --session "${args.target}"`);
          }
          case "kill": return `Kill not directly supported via CLI. Use 'process kill' if you have the session ID.`;
          default: return `Unknown subagents action: ${args.action}`;
        }
      }

      case "sessions_list": {
        return await openclawCli("system presence");
      }

      case "sessions_send": {
        return await openclawCli(`agent -m "${args.message}" --session "${args.sessionKey}" --deliver`);
      }

      case "nodes": {
        switch (args.action) {
          case "status": return await openclawCli("nodes status 2>/dev/null || echo 'No nodes paired'");
          case "camera_snap": {
            const node = args.node ? `--node "${args.node}"` : "";
            return await openclawCli(`nodes camera snap ${node}`);
          }
          case "notify": {
            const node = args.node ? `--node "${args.node}"` : "";
            const title = args.title || "Notification";
            return await openclawCli(`nodes notify --title "${title}" --body "${args.body || ""}" ${node}`);
          }
          case "run": {
            const node = args.node ? `--node "${args.node}"` : "";
            return await openclawCli(`nodes run -- ${args.command || "echo ok"} ${node}`, 60000);
          }
          default: return await openclawCli(`nodes ${args.action} ${args.node ? "--node " + args.node : ""}`);
        }
      }

      case "canvas": {
        switch (args.action) {
          case "present": return await openclawCli(`canvas present --url "${args.url || "about:blank"}"`);
          case "hide": return await openclawCli("canvas hide");
          case "navigate": return await openclawCli(`canvas navigate --url "${args.url}"`);
          case "eval": return await openclawCli(`canvas eval --js '${(args.javaScript || "").replace(/'/g, "\\'")}'`);
          case "snapshot": return await openclawCli("canvas snapshot");
          default: return `Unknown canvas action: ${args.action}`;
        }
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
    // GPT-5 family
    "gpt-5.2": ["openai", "gpt-5.2"],
    "gpt-5.2-pro": ["openai", "gpt-5.2-pro"],
    "gpt-5.1": ["openai", "gpt-5.1"],
    "gpt-5": ["openai", "gpt-5"],
    "gpt-5-pro": ["openai", "gpt-5-pro"],
    "gpt-5-mini": ["openai", "gpt-5-mini"],
    "gpt-5-nano": ["openai", "gpt-5-nano"],
    // GPT-4.1
    "gpt-4.1": ["openai", "gpt-4.1"],
    "gpt-4.1-mini": ["openai", "gpt-4.1-mini"],
    "gpt-4.1-nano": ["openai", "gpt-4.1-nano"],
    // GPT-4o
    "gpt-4o": ["openai", "gpt-4o"],
    "gpt-4o-mini": ["openai", "gpt-4o-mini"],
    // Reasoning
    "o3": ["openai", "o3"],
    "o3-mini": ["openai", "o3-mini"],
    "o4-mini": ["openai", "o4-mini"],
    "o3-pro": ["openai", "o3-pro"],
    // Search
    "gpt-4o-search-preview": ["openai", "gpt-4o-search-preview"],
    "gpt-4o-mini-search-preview": ["openai", "gpt-4o-mini-search-preview"],
    // Codex
    "gpt-5.3-codex": ["openai", "gpt-5.3-codex"],
    "gpt-5.2-codex": ["openai", "gpt-5.2-codex"],
    "gpt-5.1-codex": ["openai", "gpt-5.1-codex"],
    // Anthropic
    "claude-sonnet-4": ["anthropic", "claude-sonnet-4-20250514"],
    "claude-sonnet-4-20250514": ["anthropic", "claude-sonnet-4-20250514"],
    "claude-opus-4": ["anthropic", "claude-opus-4-20250514"],
    "claude-opus-4-20250514": ["anthropic", "claude-opus-4-20250514"],
    "claude-haiku-4": ["anthropic", "claude-haiku-4-20250414"],
    "claude-haiku-4-20250414": ["anthropic", "claude-haiku-4-20250414"],
    // Google
    "gemini-2.5-flash": ["google", "gemini-2.5-flash-preview-05-20"],
    "gemini-2.5-pro": ["google", "gemini-2.5-pro-preview-06-05"],
    "gemini-2.0-flash": ["google", "gemini-2.0-flash"],
    // Mistral
    "mistral-large-latest": ["mistral", "mistral-large-latest"],
    "mistral-small-latest": ["mistral", "mistral-small-latest"],
    "codestral-latest": ["mistral", "codestral-latest"],
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
      { name: "process", description: "Manage background exec sessions", group: "core" },
      { name: "apply_patch", description: "Apply unified diff patches", group: "core" },
      { name: "image", description: "Image analysis (vision)", group: "ai" },
      { name: "tts", description: "Text-to-speech (needs OPENAI_API_KEY)", group: "ai" },
      { name: "message", description: "Send messages to Telegram/Discord/Webhook", group: "communication" },
      { name: "memory_search", description: "Search bot memory files", group: "memory" },
      { name: "memory_get", description: "Read bot memory files", group: "memory" },
      { name: "cron", description: "Schedule jobs via OpenClaw Gateway", group: "gateway" },
      { name: "sessions_spawn", description: "Spawn background sub-agents", group: "gateway" },
      { name: "subagents", description: "List/steer/kill sub-agents", group: "gateway" },
      { name: "sessions_list", description: "List active sessions", group: "gateway" },
      { name: "sessions_send", description: "Send message to another session", group: "gateway" },
      { name: "nodes", description: "Control paired devices/nodes", group: "gateway" },
      { name: "canvas", description: "Present/control UI canvases", group: "gateway" },
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
