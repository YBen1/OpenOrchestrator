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
    return f"Tool '{name}' nicht verfügbar."
