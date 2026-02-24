"""Bridge to the OpenClaw Agent Runner Server (TypeScript engine on :18810).

Handles:
- SSE streaming from the engine
- API key decryption and passing
- Fallback detection (engine unavailable → return None)
"""
import os
import json
import httpx
from typing import Optional, AsyncGenerator

ENGINE_URL = os.getenv("ENGINE_URL", "http://127.0.0.1:18810")


async def engine_available() -> bool:
    """Check if the Agent Runner Server is running."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ENGINE_URL}/health", timeout=2)
            return resp.status_code == 200
    except Exception:
        return False


async def run_agent_sync(
    prompt: str,
    input_text: str,
    model: str,
    tools: list[str],
    api_keys: dict[str, str],
    max_time_seconds: int = 120,
    max_tool_calls: int = 20,
) -> Optional[dict]:
    """Run an agent synchronously via the engine. Returns result dict or None if engine unavailable.
    
    Returns:
        {
            "status": "completed" | "failed",
            "output": str,
            "error": str | None,
            "events": list,  # tool_call, tool_result, complete events
        }
    """
    if not await engine_available():
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ENGINE_URL}/agent/run/sync",
                json={
                    "prompt": prompt,
                    "input": input_text,
                    "model": model,
                    "tools": tools,
                    "apiKeys": api_keys,
                    "maxTimeSeconds": max_time_seconds,
                    "maxToolCalls": max_tool_calls,
                },
                timeout=max_time_seconds + 30,  # Extra buffer
            )
            return resp.json()
    except Exception as e:
        return {"status": "failed", "error": str(e), "output": "", "events": []}


async def run_agent_stream(
    prompt: str,
    input_text: str,
    model: str,
    tools: list[str],
    api_keys: dict[str, str],
    max_time_seconds: int = 120,
    max_tool_calls: int = 20,
) -> AsyncGenerator[dict, None]:
    """Run an agent with SSE streaming. Yields event dicts.
    
    Events:
        {"type": "started", "model": ..., "provider": ..., "tools": ...}
        {"type": "llm_call", "iteration": ...}
        {"type": "text_delta", "delta": ...}
        {"type": "tool_call", "name": ..., "args": ...}
        {"type": "tool_result", "name": ..., "result": ...}
        {"type": "complete", "output": ..., "usage": ..., "toolCalls": ..., "durationMs": ...}
        {"type": "error", "message": ...}
        {"type": "done"}
    """
    if not await engine_available():
        yield {"type": "error", "message": "Engine not available"}
        return

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{ENGINE_URL}/agent/run",
                json={
                    "prompt": prompt,
                    "input": input_text,
                    "model": model,
                    "tools": tools,
                    "apiKeys": api_keys,
                    "maxTimeSeconds": max_time_seconds,
                    "maxToolCalls": max_tool_calls,
                },
                timeout=max_time_seconds + 30,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            event = json.loads(line[6:])
                            yield event
                        except json.JSONDecodeError:
                            pass
    except Exception as e:
        yield {"type": "error", "message": str(e)}


def get_api_keys(db) -> dict[str, str]:
    """Decrypt all API keys from settings and return as dict for the engine."""
    from crypto import decrypt
    from models import Setting
    
    key_map = {
        "openai_api_key": "OPENAI_API_KEY",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "google_api_key": "GOOGLE_API_KEY",
        "mistral_api_key": "MISTRAL_API_KEY",
        "brave_api_key": "BRAVE_API_KEY",
        "xai_api_key": "XAI_API_KEY",
        "groq_api_key": "GROQ_API_KEY",
        "elevenlabs_api_key": "ELEVENLABS_API_KEY",
    }
    
    result = {}
    for db_key, engine_key in key_map.items():
        setting = db.query(Setting).get(db_key)
        if setting and setting.value:
            decrypted = decrypt(setting.value)
            if decrypted:
                result[engine_key] = decrypted
    
    return result
