"""Settings & API key management routes."""
import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Setting, utcnow

router = APIRouter(prefix="/api", tags=["settings"])

SENSITIVE_KEYS = {"openai_api_key", "anthropic_api_key", "google_api_key", "mistral_api_key", "brave_api_key"}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    result = {}
    for s in settings:
        if s.key in SENSITIVE_KEYS and s.value:
            result[s.key] = "•" * 20 + s.value[-4:] if len(s.value) > 4 else s.value
            result[f"{s.key}_set"] = True
        else:
            result[s.key] = s.value
    return result


class SettingsUpdate(BaseModel):
    settings: dict


@router.put("/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in data.settings.items():
        if value and "•" in str(value):
            continue
        existing = db.query(Setting).get(key)
        if existing:
            existing.value = str(value)
            existing.updated_at = utcnow()
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return {"ok": True}


class ValidateKeyRequest(BaseModel):
    provider: str
    key: str


@router.post("/settings/validate-key")
async def validate_key(data: ValidateKeyRequest):
    provider = data.provider.lower()
    key = data.key.strip()

    try:
        if provider == "openai":
            import openai
            client = openai.AsyncOpenAI(api_key=key)
            models = await client.models.list()
            model_ids = sorted([m.id for m in models.data if any(m.id.startswith(p) for p in ("gpt", "o1", "o3", "o4"))])[:20]
            return {"valid": True, "models": model_ids}

        elif provider == "anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=key)
            await client.messages.create(
                model="claude-haiku-4-20250414", max_tokens=1,
                messages=[{"role": "user", "content": "hi"}]
            )
            return {"valid": True, "models": ["claude-haiku-4-20250414", "claude-sonnet-4-20250514", "claude-opus-4-20250514"]}

        elif provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=key)
            models = await asyncio.to_thread(genai.list_models)
            model_ids = [m.name.replace("models/", "") for m in models if "generateContent" in (m.supported_generation_methods or [])]
            return {"valid": True, "models": model_ids[:20]}

        elif provider == "mistral":
            from mistralai import Mistral
            client = Mistral(api_key=key)
            models = await asyncio.to_thread(client.models.list)
            model_ids = [m.id for m in models.data] if models.data else ["mistral-small-latest", "mistral-large-latest"]
            return {"valid": True, "models": model_ids[:20]}

        elif provider == "ollama":
            import openai
            client = openai.AsyncOpenAI(base_url=f"{key}/v1", api_key="ollama")
            models = await client.models.list()
            model_ids = [m.id for m in models.data]
            return {"valid": True, "models": model_ids}

        else:
            return {"valid": False, "error": f"Unbekannter Anbieter: {provider}"}

    except Exception as e:
        err = str(e).lower()
        if "authentication" in err or "401" in err or "invalid" in err:
            return {"valid": False, "error": "API-Key ungültig"}
        elif "rate" in err or "429" in err:
            return {"valid": False, "error": "Rate-Limit — Key scheint gültig, aber überlastet"}
        elif "quota" in err or "billing" in err:
            return {"valid": False, "error": "Kein Guthaben — bitte beim Anbieter aufladen"}
        elif "connection" in err or "connect" in err:
            return {"valid": False, "error": "Verbindung fehlgeschlagen — URL/Server nicht erreichbar"}
        else:
            return {"valid": False, "error": str(e)[:200]}
