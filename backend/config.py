"""App configuration with environment fallbacks for Electron compatibility."""
import os

class Config:
    DATA_DIR = os.getenv("OPENORCH_DATA_DIR", "/srv/openOrchestrator")
    DB_PATH = os.getenv("OPENORCH_DB_PATH", os.path.join(DATA_DIR, "openorch.db"))
    BOT_DATA_PATH = os.getenv("BOT_DATA_PATH", os.path.join(DATA_DIR, "bot-data"))
    MASTER_KEY_FILE = os.getenv("OPENORCH_KEY_FILE", os.path.join(DATA_DIR, ".master.key"))
    HOST = os.getenv("OPENORCH_HOST", "127.0.0.1")
    PORT = int(os.getenv("OPENORCH_PORT", "8080"))
    CORS_ORIGINS = os.getenv("OPENORCH_CORS_ORIGINS", "http://localhost:3333,http://localhost:5173").split(",")
