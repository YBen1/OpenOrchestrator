"""Secret encryption using Fernet (symmetric AES-128-CBC + HMAC)."""
from cryptography.fernet import Fernet, InvalidToken
import hashlib, base64, os

_fernet = None

def init_crypto(master_password: str = None, key_file: str = None):
    """Initialize encryption. Derives key from password or loads/generates from file."""
    global _fernet
    if master_password:
        key = base64.urlsafe_b64encode(hashlib.sha256(master_password.encode()).digest())
        _fernet = Fernet(key)
    elif key_file:
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                _fernet = Fernet(f.read().strip())
        else:
            key = Fernet.generate_key()
            os.makedirs(os.path.dirname(key_file) or '.', exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            os.chmod(key_file, 0o600)
            _fernet = Fernet(key)

def encrypt(plaintext: str) -> str:
    """Encrypt a string. Returns original if crypto not initialized."""
    if not _fernet or not plaintext:
        return plaintext
    return _fernet.encrypt(plaintext.encode()).decode()

def decrypt(ciphertext: str) -> str:
    """Decrypt a string. Returns original if not encrypted or crypto not initialized."""
    if not _fernet or not ciphertext:
        return ciphertext
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        # Legacy plaintext value — return as-is
        return ciphertext

def is_encrypted(value: str) -> bool:
    """Check if a value looks like a Fernet token."""
    if not value:
        return False
    return value.startswith("gAAAAA")

def is_initialized() -> bool:
    return _fernet is not None
