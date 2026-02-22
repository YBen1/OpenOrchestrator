"""Bot tools — web search, file operations, code execution."""
import os
import json
import httpx
import asyncio
from typing import Optional


class WebSearchTool:
    """Search the web using Brave Search API."""
    name = "web_search"
    description = "Suche im Internet nach Informationen."

    schema = {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for information. Returns titles, URLs and snippets.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "count": {"type": "integer", "description": "Number of results (1-10)", "default": 5},
                },
                "required": ["query"],
            },
        },
    }

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def execute(self, query: str, count: int = 5) -> str:
        if not self.api_key:
            return "Fehler: Kein Brave Search API-Key konfiguriert. Bitte in den Einstellungen hinterlegen."
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": min(count, 10)},
                headers={"X-Subscription-Token": self.api_key, "Accept": "application/json"},
                timeout=15,
            )
            if resp.status_code != 200:
                return f"Suchfehler: {resp.status_code} {resp.text[:200]}"
            data = resp.json()
            results = []
            for r in (data.get("web", {}).get("results", []))[:count]:
                results.append(f"**{r.get('title', '')}**\n{r.get('url', '')}\n{r.get('description', '')}")
            return "\n\n".join(results) if results else "Keine Ergebnisse gefunden."


class FilesTool:
    """Read and write files in the bot's docs directory."""
    name = "files"

    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)

    read_schema = {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read contents of a file from the bot's storage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Name of the file to read"},
                },
                "required": ["filename"],
            },
        },
    }

    write_schema = {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file in the bot's storage. Creates or overwrites.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Name of the file"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["filename", "content"],
            },
        },
    }

    list_schema = {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files in the bot's storage.",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    async def read_file(self, filename: str) -> str:
        safe = os.path.basename(filename)
        path = os.path.join(self.base_path, safe)
        if not os.path.isfile(path):
            return f"Datei '{safe}' nicht gefunden."
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()[:8000]
        except Exception as e:
            return f"Fehler beim Lesen: {e}"

    async def write_file(self, filename: str, content: str) -> str:
        safe = os.path.basename(filename)
        path = os.path.join(self.base_path, safe)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return f"Datei '{safe}' gespeichert ({len(content)} Zeichen)."
        except Exception as e:
            return f"Fehler beim Schreiben: {e}"

    async def list_files(self) -> str:
        if not os.path.isdir(self.base_path):
            return "Keine Dateien vorhanden."
        files = os.listdir(self.base_path)
        if not files:
            return "Keine Dateien vorhanden."
        return "Dateien:\n" + "\n".join(f"- {f}" for f in sorted(files))


class CodeTool:
    """Execute shell commands on the host system."""
    name = "code"

    schema = {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a shell command on the host system and return stdout+stderr. Use for system administration, checking updates, reading system info, etc. Timeout: 60s.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute (e.g. 'apt list --upgradable', 'df -h', 'uname -a')"},
                },
                "required": ["command"],
            },
        },
    }

    # Commands that are never allowed
    BLOCKED = {"rm -rf /", "mkfs", "dd if=", ":(){", "fork bomb", "shutdown", "reboot", "halt", "poweroff", "init 0", "init 6"}

    async def execute(self, command: str) -> str:
        cmd_lower = command.lower().strip()
        for blocked in self.BLOCKED:
            if blocked in cmd_lower:
                return f"⛔ Befehl blockiert aus Sicherheitsgründen: {command}"
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            output = ""
            if stdout:
                output += stdout.decode("utf-8", errors="replace")
            if stderr:
                output += ("\n--- stderr ---\n" if output else "") + stderr.decode("utf-8", errors="replace")
            if not output.strip():
                output = f"(Befehl ausgeführt, Exit-Code: {proc.returncode})"
            # Truncate very long output
            if len(output) > 8000:
                output = output[:7900] + f"\n... (gekürzt, {len(output)} Zeichen gesamt)"
            return output
        except asyncio.TimeoutError:
            return f"⏰ Timeout nach 60s: {command}"
        except Exception as e:
            return f"Fehler: {e}"


class BrowserTool:
    """Fetch a URL and return readable content."""
    name = "browser"

    schema = {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch a URL and return the readable text content (HTML converted to plain text). Use for reading web pages, APIs, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to fetch (http or https)"},
                },
                "required": ["url"],
            },
        },
    }

    async def execute(self, url: str) -> str:
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(url, timeout=20, headers={"User-Agent": "openOrchestrator/1.0"})
                content_type = resp.headers.get("content-type", "")
                text = resp.text[:8000]
                if "html" in content_type:
                    # Simple HTML to text
                    import re
                    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                return text[:6000] if text else "(Leere Antwort)"
        except Exception as e:
            return f"Fehler beim Abruf: {e}"


def get_tool_schemas(enabled_tools: list, brave_key: str = None, docs_path: str = None) -> list:
    """Return OpenAI-compatible tool schemas for enabled tools."""
    schemas = []
    if "web_search" in enabled_tools and brave_key:
        schemas.append(WebSearchTool.schema)
    if "files" in enabled_tools and docs_path:
        ft = FilesTool(docs_path)
        schemas.append(ft.read_schema)
        schemas.append(ft.write_schema)
        schemas.append(ft.list_schema)
    if "code" in enabled_tools:
        schemas.append(CodeTool.schema)
    if "browser" in enabled_tools:
        schemas.append(BrowserTool.schema)
    return schemas


async def execute_tool_call(name: str, args: dict, enabled_tools: list, brave_key: str = None, docs_path: str = None) -> str:
    """Execute a tool call and return the result string."""
    if name == "web_search" and "web_search" in enabled_tools:
        tool = WebSearchTool(brave_key)
        return await tool.execute(**args)
    elif name in ("read_file", "write_file", "list_files") and "files" in enabled_tools and docs_path:
        tool = FilesTool(docs_path)
        if name == "read_file":
            return await tool.read_file(**args)
        elif name == "write_file":
            return await tool.write_file(**args)
        elif name == "list_files":
            return await tool.list_files()
    elif name == "run_command" and "code" in enabled_tools:
        tool = CodeTool()
        return await tool.execute(**args)
    elif name == "fetch_url" and "browser" in enabled_tools:
        tool = BrowserTool()
        return await tool.execute(**args)
    return f"Tool '{name}' nicht verfügbar."
