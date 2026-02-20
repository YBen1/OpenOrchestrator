"""Simple SQLite migrations — add missing columns/tables on startup."""
import sqlite3
import os

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./openorchestrator.db").replace("sqlite:///", "")


def run_migrations():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Settings table
    c.execute("""CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")

    # New columns on bots
    for col, typ, default in [
        ("enabled", "BOOLEAN", "1"),
        ("max_runtime_seconds", "INTEGER", "120"),
    ]:
        try:
            c.execute(f"ALTER TABLE bots ADD COLUMN {col} {typ} DEFAULT {default}")
        except sqlite3.OperationalError:
            pass  # column exists

    # New columns on runs
    for col, typ, default in [
        ("tokens_in", "INTEGER", "NULL"),
        ("tokens_out", "INTEGER", "NULL"),
        ("cost_estimate", "REAL", "NULL"),
        ("error_message", "TEXT", "NULL"),
        ("output_hash", "TEXT", "NULL"),
    ]:
        try:
            c.execute(f"ALTER TABLE runs ADD COLUMN {col} {typ} DEFAULT {default}")
        except sqlite3.OperationalError:
            pass

    # Channels table
    c.execute("""CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT DEFAULT '',
        config TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error_msg TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")

    # Bot-Channel mapping
    c.execute("""CREATE TABLE IF NOT EXISTS bot_channels (
        bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,
        channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
        notify_rule TEXT DEFAULT 'always',
        PRIMARY KEY (bot_id, channel_id)
    )""")

    conn.commit()
    conn.close()
    print("[migrations] done")
