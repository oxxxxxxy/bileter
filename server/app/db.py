from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import shutil
from pathlib import Path


ROOT_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))

DEFAULT_PRICE_OPTIONS = [
    {"label": "Полная", "amount": 200, "sort_order": 0},
    {"label": "Льготная", "amount": 100, "sort_order": 1},
    {"label": "Бесплатно", "amount": 0, "sort_order": 2},
]
DEFAULT_PRICE_OPTIONS_JSON = json.dumps(DEFAULT_PRICE_OPTIONS, ensure_ascii=False)
DEFAULT_TICKET_LAYOUT = {
    "price": {"x": 550, "y": 365, "size": 47, "align": "left"},
    "row": {"x": 840, "y": 365, "size": 45, "align": "left"},
    "seat": {"x": 990, "y": 365, "size": 45, "align": "left"},
}
DEFAULT_TICKET_LAYOUT_JSON = json.dumps(DEFAULT_TICKET_LAYOUT, ensure_ascii=False)
DEFAULT_REPORT_SETTINGS = {
    "font_size": 28,
}
DEFAULT_REPORT_SETTINGS_JSON = json.dumps(DEFAULT_REPORT_SETTINGS, ensure_ascii=False)


def _is_directory_writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=path,
            prefix=".webexe-write-test-",
            delete=True,
        ):
            pass
        return True
    except Exception:
        return False


def _fallback_data_root() -> Path:
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home())
        return Path(base) / "WebExeStarter"
    return Path.home() / ".webexe_starter"


def _default_data_root() -> Path:
    override = os.environ.get("WEBEXE_DATA_DIR", "").strip()
    if override:
        return Path(override)
    if getattr(sys, "frozen", False):
        portable_root = Path(sys.executable).resolve().parent
        if _is_directory_writable(portable_root):
            return portable_root
        return _fallback_data_root()
    return ROOT_DIR


DB_DIR = _default_data_root() / "db"
DB_PATH = DB_DIR / "app.sqlite3"
TEMPLATE_DIR = DB_DIR / "templates"
SEED_DB_DIR = ROOT_DIR / "db"
SEED_DB_PATH = SEED_DB_DIR / "app.sqlite3"
SEED_TEMPLATE_DIR = SEED_DB_DIR / "templates"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _seed_portable_data_if_needed() -> None:
    if DB_PATH.exists():
        return
    if not SEED_DB_PATH.exists():
        return
    if SEED_DB_PATH.resolve() == DB_PATH.resolve():
        return

    DB_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SEED_DB_PATH, DB_PATH)

    if SEED_TEMPLATE_DIR.exists():
        TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
        for item in SEED_TEMPLATE_DIR.iterdir():
            target = TEMPLATE_DIR / item.name
            if target.exists():
                continue
            if item.is_dir():
                shutil.copytree(item, target)
            else:
                shutil.copy2(item, target)


def init_db() -> None:
    _seed_portable_data_if_needed()
    DB_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

    with connect() as conn:
        table_sql = {
            row["name"]: row["sql"] or ""
            for row in conn.execute(
                "SELECT name, sql FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        hall_settings_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(hall_settings)").fetchall()
        } if "hall_settings" in table_sql else set()
        events_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(events)").fetchall()
        } if "events" in table_sql else set()
        legacy_events = (
            "starts_at" in table_sql.get("events", "")
            or "venue" in table_sql.get("events", "")
        )
        legacy_refs = any("events_old" in sql for sql in table_sql.values())
        seat_active_missing = (
            "seats" in table_sql
            and "active" not in table_sql.get("seats", "")
        )
        if legacy_events or legacy_refs:
            conn.execute("PRAGMA foreign_keys = OFF")
            for table in ("seats", "sales", "price_options", "events"):
                if table in table_sql:
                    conn.execute(f"ALTER TABLE {table} RENAME TO {table}_old")
            conn.executescript(
                """
            CREATE TABLE events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                template_path TEXT,
                ticket_layout_json TEXT NOT NULL DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

                CREATE TABLE price_options (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    price_option_id INTEGER NOT NULL REFERENCES price_options(id),
                    row_label TEXT NOT NULL,
                    seat_label TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'sold',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    cancelled_at TEXT,
                    printed_at TEXT,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE seats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    row_label TEXT NOT NULL,
                    seat_label TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'free',
                    active INTEGER NOT NULL DEFAULT 1,
                    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, row_label, seat_label)
                );
                """
            )
            if "events_old" in table_sql:
                conn.execute(
                    """
            INSERT INTO events (id, title, template_path, active, created_at)
                    SELECT id, COALESCE(title, ''), template_path, active, created_at
                    FROM events_old
                    """
                )
            if "price_options_old" in table_sql:
                conn.execute(
                    """
                    INSERT INTO price_options (id, event_id, label, amount_cents, sort_order)
                    SELECT id, event_id, label, amount_cents, sort_order
                    FROM price_options_old
                    """
                )
            if "sales_old" in table_sql:
                conn.execute(
                    """
                    INSERT INTO sales (id, event_id, price_option_id, row_label, seat_label, amount_cents, status, created_at, cancelled_at, printed_at, updated_at)
                    SELECT id, event_id, price_option_id, row_label, seat_label, amount_cents, status, created_at, cancelled_at, printed_at, updated_at
                    FROM sales_old
                    """
                )
            if "seats_old" in table_sql:
                conn.execute(
                    """
                    INSERT INTO seats (id, event_id, row_label, seat_label, status, sale_id, updated_at)
                    SELECT id, event_id, row_label, seat_label, status, sale_id, updated_at
                    FROM seats_old
                    """
                )
            for table in ("seats_old", "sales_old", "price_options_old", "events_old"):
                conn.execute(f"DROP TABLE IF EXISTS {table}")
            conn.execute("PRAGMA foreign_keys = ON")
        elif seat_active_missing:
            conn.execute("ALTER TABLE seats ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
        if "events" in table_sql and "ticket_layout_json" not in events_columns:
            conn.execute(
                "ALTER TABLE events ADD COLUMN ticket_layout_json TEXT NOT NULL DEFAULT ''"
            )
        if "hall_settings" in table_sql and "default_prices_json" not in hall_settings_columns:
            conn.execute(
                "ALTER TABLE hall_settings "
                "ADD COLUMN default_prices_json TEXT NOT NULL DEFAULT '[]'"
            )
        if "hall_settings" in table_sql and "default_ticket_template_path" not in hall_settings_columns:
            conn.execute(
                "ALTER TABLE hall_settings "
                "ADD COLUMN default_ticket_template_path TEXT NOT NULL DEFAULT ''"
            )
        if "hall_settings" in table_sql and "default_ticket_layout_json" not in hall_settings_columns:
            conn.execute(
                "ALTER TABLE hall_settings "
                "ADD COLUMN default_ticket_layout_json TEXT NOT NULL DEFAULT ''"
            )
        if "hall_settings" in table_sql and "default_report_settings_json" not in hall_settings_columns:
            conn.execute(
                "ALTER TABLE hall_settings "
                "ADD COLUMN default_report_settings_json TEXT NOT NULL DEFAULT ''"
            )

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                template_path TEXT,
                ticket_layout_json TEXT NOT NULL DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS price_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                price_option_id INTEGER NOT NULL REFERENCES price_options(id),
                row_label TEXT NOT NULL,
                seat_label TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'sold',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                cancelled_at TEXT,
                printed_at TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS seats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                row_label TEXT NOT NULL,
                seat_label TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'free',
                active INTEGER NOT NULL DEFAULT 1,
                sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, row_label, seat_label)
            );

            CREATE TABLE IF NOT EXISTS hall_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                rows_count INTEGER NOT NULL,
                seats_count INTEGER NOT NULL,
                inactive_seats_json TEXT NOT NULL DEFAULT '[]',
                default_prices_json TEXT NOT NULL DEFAULT '[]',
                default_ticket_template_path TEXT NOT NULL DEFAULT '',
                default_ticket_layout_json TEXT NOT NULL DEFAULT '',
                default_report_settings_json TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute("UPDATE seats SET status = 'free' WHERE status = 'available'")
        conn.execute(
            """
            INSERT OR IGNORE INTO hall_settings (id, rows_count, seats_count, inactive_seats_json, default_prices_json, default_ticket_template_path, default_ticket_layout_json, default_report_settings_json, updated_at)
            VALUES (1, 20, 20, '[]', ?, '', ?, ?, CURRENT_TIMESTAMP)
            """,
            (DEFAULT_PRICE_OPTIONS_JSON, DEFAULT_TICKET_LAYOUT_JSON, DEFAULT_REPORT_SETTINGS_JSON),
        )
        conn.execute(
            """
            UPDATE hall_settings
            SET default_prices_json = ?
            WHERE id = 1 AND TRIM(COALESCE(default_prices_json, '')) IN ('', '[]')
            """,
            (DEFAULT_PRICE_OPTIONS_JSON,),
        )
        conn.execute(
            """
            UPDATE hall_settings
            SET default_ticket_layout_json = ?
            WHERE id = 1 AND TRIM(COALESCE(default_ticket_layout_json, '')) = ''
            """,
            (DEFAULT_TICKET_LAYOUT_JSON,),
        )
        conn.execute(
            """
            UPDATE hall_settings
            SET default_report_settings_json = ?
            WHERE id = 1 AND TRIM(COALESCE(default_report_settings_json, '')) = ''
            """,
            (DEFAULT_REPORT_SETTINGS_JSON,),
        )
        conn.execute(
            """
            UPDATE events
            SET ticket_layout_json = ?
            WHERE TRIM(COALESCE(ticket_layout_json, '')) = ''
            """,
            (DEFAULT_TICKET_LAYOUT_JSON,),
        )
