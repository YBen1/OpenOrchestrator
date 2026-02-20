from cryptography.fernet import Fernet
import os

KEY_PATH = os.path.join(os.path.dirname(__file__), '.credential_key')

def _get_key():
    env_key = os.getenv('CREDENTIAL_SECRET')
    if env_key:
        return env_key.encode()
    if os.path.exists(KEY_PATH):
        return open(KEY_PATH, 'rb').read()
    key = Fernet.generate_key()
    with open(KEY_PATH, 'wb') as f:
        f.write(key)
    os.chmod(KEY_PATH, 0o600)
    return key

_fernet = None
def get_fernet():
    global _fernet
    if not _fernet:
        _fernet = Fernet(_get_key())
    return _fernet

def encrypt(value: str) -> str:
    return get_fernet().encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return get_fernet().decrypt(value.encode()).decode()
