#!/usr/bin/env python3
"""Export API keys from DB to .env.engine file for the Node engine service."""
import sys, os
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)  # So SQLite finds the right DB

from crypto import init_crypto, decrypt
from database import SessionLocal
from models import Setting

KEY_MAP = {
    'openai_api_key': 'OPENAI_API_KEY',
    'anthropic_api_key': 'ANTHROPIC_API_KEY',
    'google_api_key': 'GOOGLE_API_KEY',  
    'mistral_api_key': 'MISTRAL_API_KEY',
    'brave_api_key': 'BRAVE_API_KEY',
    'ollama_base_url': 'OLLAMA_BASE_URL',
}

init_crypto(key_file='/srv/openOrchestrator/.master.key')
db = SessionLocal()

lines = []
for db_key, env_key in KEY_MAP.items():
    s = db.get(Setting, db_key)
    if s and s.value:
        val = decrypt(s.value)
        if val and not val.startswith('gAAAAA'):  # Skip broken encrypted values
            lines.append(f'{env_key}={val}')

db.close()

env_path = os.path.join(os.path.dirname(__file__), '..', '.env.engine')
with open(env_path, 'w') as f:
    f.write('\n'.join(lines) + '\n')
os.chmod(env_path, 0o600)
print(f'Exported {len(lines)} keys to .env.engine')
