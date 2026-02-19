from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx


def log(message: str) -> None:
    print(message, flush=True)


def call_openai(prompt: str, model: str, api_key: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a focused bot for openOrchestrator."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    response = httpx.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def call_anthropic(prompt: str, model: str, api_key: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 800,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }
    response = httpx.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["content"][0]["text"].strip()


def run(context_path: Path) -> int:
    context = json.loads(context_path.read_text(encoding="utf-8"))
    bot_id = context["bot_id"]
    prompt = context["prompt"]
    model = context["model"]
    docs_path = Path(context["docs_path"])
    result_path = Path(context["result_path"])

    docs_path.mkdir(parents=True, exist_ok=True)

    log(f"[runner] Bot {bot_id} starting with model {model}.")
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    output = ""
    provider = "mock"

    if openai_key:
        provider = "openai"
        log("[runner] Using OpenAI API.")
        output = call_openai(prompt, model, openai_key)
    elif anthropic_key:
        provider = "anthropic"
        log("[runner] Using Anthropic API.")
        output = call_anthropic(prompt, model, anthropic_key)
    else:
        log("[runner] No API key found, using mock output.")
        time.sleep(1)
        output = (
            "Mock run complete. Provide OPENAI_API_KEY or ANTHROPIC_API_KEY for live runs.\n\n"
            f"Prompt: {prompt}"
        )

    log("[runner] Writing latest_result.md")
    (docs_path / "latest_result.md").write_text(output, encoding="utf-8")

    result_payload = {
        "title": f"Run {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
        "content": output,
        "url": "",
        "metadata": {"provider": provider},
    }
    result_path.write_text(json.dumps(result_payload, ensure_ascii=False), encoding="utf-8")

    log("[runner] Done.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True)
    args = parser.parse_args()
    try:
        return run(Path(args.context))
    except Exception as exc:  # noqa: BLE001 - keep runner resilient
        log(f"[runner] Failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
