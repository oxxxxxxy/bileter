from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .hall import build_hall_layout
from .models import ReportSettings, TicketLayoutField
from .db import (
    DEFAULT_REPORT_SETTINGS,
    DEFAULT_TICKET_LAYOUT,
    DEFAULT_TICKET_LAYOUT_JSON,
    TEMPLATE_DIR,
    connect,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_seat_status(status: str) -> str:
    if status == "available":
        return "free"
    return status


def parse_prices(raw: str) -> list[dict[str, Any]]:
    data = json.loads(raw or "[]")
    prices: list[dict[str, Any]] = []
    for item in data:
        label = str(item.get("label", "")).strip()
        raw_amount = item.get("amount", item.get("amount_cents", 0))
        amount = int(float(raw_amount))
        if not label:
            continue
        prices.append(
            {
                "label": label,
                "amount_cents": max(0, amount),
                "sort_order": len(prices),
            }
        )
    return prices


def _default_ticket_layout_copy() -> dict[str, dict[str, Any]]:
    return {key: dict(value) for key, value in DEFAULT_TICKET_LAYOUT.items()}


def parse_ticket_layout(raw: str) -> dict[str, dict[str, Any]]:
    if not raw or not str(raw).strip():
        return _default_ticket_layout_copy()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    layout: dict[str, dict[str, Any]] = {}
    for key, fallback in DEFAULT_TICKET_LAYOUT.items():
        item = data.get(key, {}) if isinstance(data, dict) else {}
        layout[key] = TicketLayoutField.from_mapping(item, fallback).to_dict()
    return layout


def ticket_layout_to_json(layout: dict[str, dict[str, Any]]) -> str:
    normalized = {}
    for key, fallback in DEFAULT_TICKET_LAYOUT.items():
        item = layout.get(key, {}) if isinstance(layout, dict) else {}
        normalized[key] = TicketLayoutField.from_mapping(item, fallback).to_dict()
    return json.dumps(normalized, ensure_ascii=False)


def parse_inactive_seats(raw: str) -> set[tuple[str, str]]:
    data = json.loads(raw or "[]")
    inactive: set[tuple[str, str]] = set()
    for item in data:
        if isinstance(item, dict):
            row_label = str(item.get("row_label", "")).strip()
            seat_label = str(item.get("seat_label", "")).strip()
        else:
            row_label = ""
            seat_label = ""
        if row_label and seat_label:
            inactive.add((row_label, seat_label))
    return inactive


def inactive_seats_to_json(inactive_seats: list[dict[str, Any]]) -> str:
    return json.dumps(
        [
            {
                "row_label": str(item.get("row_label", "")).strip(),
                "seat_label": str(item.get("seat_label", "")).strip(),
            }
            for item in inactive_seats
            if (
                str(item.get("row_label", "")).strip()
                and str(item.get("seat_label", "")).strip()
            )
        ],
        ensure_ascii=False,
    )


def parse_report_settings(raw: str) -> dict[str, int]:
    if not raw or not str(raw).strip():
        return ReportSettings.from_mapping(None, int(DEFAULT_REPORT_SETTINGS["font_size"])).to_dict()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    return ReportSettings.from_mapping(data, int(DEFAULT_REPORT_SETTINGS["font_size"])).to_dict()


def report_settings_to_json(settings: dict[str, Any]) -> str:
    normalized = ReportSettings.from_mapping(
        settings,
        int(DEFAULT_REPORT_SETTINGS["font_size"]),
    ).to_dict()
    return json.dumps(normalized, ensure_ascii=False)


def get_hall_settings() -> dict[str, Any]:
    with connect() as conn:
        try:
            row = conn.execute(
                """
                SELECT
                    rows_count,
                    seats_count,
                    inactive_seats_json,
                    default_prices_json,
                    default_ticket_template_path,
                    default_ticket_layout_json,
                    default_report_settings_json,
                    updated_at
                FROM hall_settings
                WHERE id = 1
                """
            ).fetchone()
        except sqlite3.OperationalError:
            return {
                "rows_count": 20,
                "seats_count": 20,
                "inactive_seats": [],
                "default_prices": [],
                "default_ticket_template_path": None,
                "default_ticket_layout": _default_ticket_layout_copy(),
                "default_report_settings": dict(DEFAULT_REPORT_SETTINGS),
                "updated_at": None,
            }
        if row is None:
            return {
                "rows_count": 20,
                "seats_count": 20,
                "inactive_seats": [],
                "default_prices": [],
                "default_ticket_template_path": None,
                "default_ticket_layout": _default_ticket_layout_copy(),
                "default_report_settings": dict(DEFAULT_REPORT_SETTINGS),
                "updated_at": None,
            }
        inactive = [
            {"row_label": row_label, "seat_label": seat_label}
            for row_label, seat_label in sorted(
                parse_inactive_seats(row["inactive_seats_json"])
            )
        ]
        return {
            "rows_count": int(row["rows_count"]),
            "seats_count": int(row["seats_count"]),
            "inactive_seats": inactive,
            "default_prices": [
                {
                    "label": price["label"],
                    "amount_cents": price["amount_cents"],
                    "sort_order": price["sort_order"],
                }
                for price in parse_prices(row["default_prices_json"])
            ],
            "default_ticket_template_path": row["default_ticket_template_path"] or None,
            "default_ticket_layout": parse_ticket_layout(row["default_ticket_layout_json"]),
            "default_report_settings": parse_report_settings(
                row["default_report_settings_json"]
            ),
            "updated_at": row["updated_at"],
        }


def update_hall_settings(
    rows_count: int,
    seats_count: int,
    inactive_seats_raw: str,
    default_prices_raw: str,
    default_ticket_layout_raw: str,
    default_report_settings_raw: str | None = None,
    default_ticket_template_bytes: bytes | None = None,
    default_ticket_template_name: str | None = None,
) -> dict[str, Any]:
    rows_count = max(1, int(rows_count))
    seats_count = max(1, int(seats_count))
    inactive_seats = parse_inactive_seats(inactive_seats_raw)
    default_prices = parse_prices(default_prices_raw)
    default_ticket_layout = parse_ticket_layout(default_ticket_layout_raw)
    default_report_settings = parse_report_settings(default_report_settings_raw or "")
    if not default_prices:
        raise ValueError("Нужно добавить хотя бы один вариант цены")
    normalized_default_prices_raw = json.dumps(
        [
            {
                "label": price["label"],
                "amount": price["amount_cents"],
                "sort_order": price["sort_order"],
            }
            for price in default_prices
        ],
        ensure_ascii=False,
    )
    normalized_default_ticket_layout_raw = ticket_layout_to_json(default_ticket_layout)
    normalized_default_report_settings_raw = report_settings_to_json(
        default_report_settings
    )
    with connect() as conn:
        current = conn.execute(
            "SELECT default_ticket_template_path FROM hall_settings WHERE id = 1"
        ).fetchone()
        default_ticket_template_path = (
            str(current["default_ticket_template_path"] or "")
            if current
            else ""
        )
        if default_ticket_template_bytes and default_ticket_template_name:
            suffix = Path(default_ticket_template_name).suffix.lower() or ".png"
            template_path = TEMPLATE_DIR / f"hall-default-ticket{suffix}"
            template_path.write_bytes(default_ticket_template_bytes)
            default_ticket_template_path = str(template_path)
        conn.execute(
            """
            INSERT INTO hall_settings (id, rows_count, seats_count, inactive_seats_json, default_prices_json, default_ticket_template_path, default_ticket_layout_json, default_report_settings_json, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                rows_count = excluded.rows_count,
                seats_count = excluded.seats_count,
                inactive_seats_json = excluded.inactive_seats_json,
                default_prices_json = excluded.default_prices_json,
                default_ticket_template_path = excluded.default_ticket_template_path,
                default_ticket_layout_json = excluded.default_ticket_layout_json,
                default_report_settings_json = excluded.default_report_settings_json,
                updated_at = excluded.updated_at
            """,
            (
                rows_count,
                seats_count,
                inactive_seats_raw,
                normalized_default_prices_raw,
                default_ticket_template_path,
                normalized_default_ticket_layout_raw,
                normalized_default_report_settings_raw,
                now_iso(),
            ),
        )
    return get_hall_settings()


def update_report_settings(font_size: int) -> dict[str, Any]:
    normalized = report_settings_to_json({"font_size": font_size})
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO hall_settings (id, rows_count, seats_count, inactive_seats_json, default_prices_json, default_ticket_template_path, default_ticket_layout_json, default_report_settings_json, updated_at)
            VALUES (1, 20, 20, '[]', '[]', '', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                default_report_settings_json = excluded.default_report_settings_json,
                updated_at = excluded.updated_at
            """,
            (DEFAULT_TICKET_LAYOUT_JSON, normalized, now_iso()),
        )
    return get_hall_settings()


def list_events() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, template_path, ticket_layout_json, active, created_at
            FROM events
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        default_settings = get_hall_settings()
        events = []
        for row in rows:
            prices = conn.execute(
                "SELECT id, label, amount_cents, sort_order FROM price_options WHERE event_id = ? ORDER BY sort_order ASC, id ASC",
                (row["id"],),
            ).fetchall()
            seats = conn.execute(
                "SELECT status, active, COUNT(*) AS count FROM seats WHERE event_id = ? GROUP BY status, active",
                (row["id"],),
            ).fetchall()
            seat_counts = {"free": 0, "reserved": 0, "sold": 0, "inactive": 0}
            for item in seats:
                status = normalize_seat_status(str(item["status"]))
                if int(item["active"]) == 0:
                    seat_counts["inactive"] += item["count"]
                elif status in seat_counts:
                    seat_counts[status] += item["count"]
            sold = conn.execute(
                "SELECT COUNT(*) AS count FROM sales WHERE event_id = ? AND status = 'sold'",
                (row["id"],),
            ).fetchone()["count"]
            events.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "template_path": row["template_path"],
                    "ticket_layout": parse_ticket_layout(
                        row["ticket_layout_json"]
                        or json.dumps(
                            default_settings["default_ticket_layout"],
                            ensure_ascii=False,
                        )
                    ),
                    "active": bool(row["active"]),
                    "created_at": row["created_at"],
                    "prices": [
                        {
                            "id": price["id"],
                            "label": price["label"],
                            "amount_cents": price["amount_cents"],
                            "sort_order": price["sort_order"],
                        }
                        for price in prices
                    ],
                    "sold_count": sold,
                    "seat_counts": seat_counts,
                }
            )
        return events


def get_event(event_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, title, template_path, ticket_layout_json, active, created_at FROM events WHERE id = ?",
            (event_id,),
        ).fetchone()
        if row is None:
            return None
        default_settings = get_hall_settings()
        prices = conn.execute(
            """
            SELECT id, label, amount_cents, sort_order
            FROM price_options
            WHERE event_id = ?
            ORDER BY sort_order ASC, id ASC
            """,
            (event_id,),
        ).fetchall()
        return {
            "id": row["id"],
            "title": row["title"],
            "template_path": row["template_path"],
            "ticket_layout": parse_ticket_layout(
                row["ticket_layout_json"]
                or json.dumps(
                    default_settings["default_ticket_layout"],
                    ensure_ascii=False,
                )
            ),
            "active": bool(row["active"]),
            "created_at": row["created_at"],
            "prices": [
                {
                    "id": price["id"],
                    "label": price["label"],
                    "amount_cents": price["amount_cents"],
                    "sort_order": price["sort_order"],
                }
                for price in prices
            ],
        }


def create_event(
    title: str,
    prices_raw: str,
    template_bytes: bytes | None,
    template_name: str | None,
    hall_rows: int,
    hall_seats: int,
    inactive_seats_raw: str,
    ticket_layout_raw: str,
) -> dict[str, Any]:
    prices = parse_prices(prices_raw)
    if not prices:
        prices = parse_prices(
            json.dumps(
                get_hall_settings().get("default_prices", []),
                ensure_ascii=False,
            )
        )
    if not prices:
        raise ValueError("Нужно добавить хотя бы один вариант цены")
    if hall_rows <= 0 or hall_seats <= 0:
        raise ValueError("Размеры зала должны быть больше нуля")
    inactive_seats = parse_inactive_seats(inactive_seats_raw)
    if str(ticket_layout_raw or "").strip():
        ticket_layout = ticket_layout_to_json(parse_ticket_layout(ticket_layout_raw))
    else:
        ticket_layout = ticket_layout_to_json(
            get_hall_settings().get("default_ticket_layout", DEFAULT_TICKET_LAYOUT)
        )

    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events (
                title,
                template_path,
                ticket_layout_json,
                active,
                created_at
            )
            VALUES (?, NULL, ?, 1, ?)
            """,
            (title.strip(), ticket_layout, now_iso()),
        )
        event_id = int(cursor.lastrowid)
        template_path = None
        if template_bytes and template_name:
            suffix = Path(template_name).suffix.lower() or ".png"
            template_path = TEMPLATE_DIR / f"event-{event_id}{suffix}"
            template_path.write_bytes(template_bytes)
            conn.execute(
                "UPDATE events SET template_path = ? WHERE id = ?",
                (str(template_path), event_id),
            )

        hall_layout = build_hall_layout(hall_rows, hall_seats)
        for price in prices:
            conn.execute(
                "INSERT INTO price_options (event_id, label, amount_cents, sort_order) VALUES (?, ?, ?, ?)",
                (event_id, price["label"], price["amount_cents"], price["sort_order"]),
            )
        for row in hall_layout:
            for seat in row["seats"]:
                if seat is None:
                    continue
                active = (row["label"], seat["label"]) not in inactive_seats
                conn.execute(
                    """
                    INSERT INTO seats (
                        event_id,
                        row_label,
                        seat_label,
                        status,
                        active
                    )
                    VALUES (?, ?, ?, 'free', ?)
                    """,
                    (event_id, row["label"], seat["label"], 1 if active else 0),
                )

    event = get_event(event_id)
    assert event is not None
    return event


def update_event(
    event_id: int,
    title: str,
    template_bytes: bytes | None,
    template_name: str | None,
    ticket_layout_raw: str,
) -> dict[str, Any]:
    with connect() as conn:
        existing = conn.execute(
            "SELECT id, template_path, ticket_layout_json FROM events WHERE id = ?",
            (event_id,),
        ).fetchone()
        if existing is None:
            raise ValueError("Event not found")
        if str(ticket_layout_raw or "").strip():
            ticket_layout = ticket_layout_to_json(parse_ticket_layout(ticket_layout_raw))
        else:
            ticket_layout = existing["ticket_layout_json"] or ticket_layout_to_json(
                get_hall_settings().get(
                    "default_ticket_layout",
                    DEFAULT_TICKET_LAYOUT,
                )
            )

        conn.execute(
            "UPDATE events SET title = ?, ticket_layout_json = ? WHERE id = ?",
            (title.strip(), ticket_layout, event_id),
        )

        if template_bytes and template_name:
            suffix = Path(template_name).suffix.lower() or ".png"
            template_path = TEMPLATE_DIR / f"event-{event_id}{suffix}"
            template_path.write_bytes(template_bytes)
            conn.execute(
                "UPDATE events SET template_path = ? WHERE id = ?",
                (str(template_path), event_id),
            )

    event = get_event(event_id)
    assert event is not None
    return event


def list_sales(event_id: int | None = None) -> list[dict[str, Any]]:
    with connect() as conn:
        if event_id is None:
            rows = conn.execute(
                """
                SELECT s.id, s.event_id, s.price_option_id, s.row_label, s.seat_label, s.created_at, s.printed_at,
                       p.label AS price_label, p.amount_cents, s.status, s.cancelled_at
                FROM sales s
                JOIN price_options p ON p.id = s.price_option_id
                ORDER BY s.created_at DESC, s.id DESC
                """
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT s.id, s.event_id, s.price_option_id, s.row_label, s.seat_label, s.created_at, s.printed_at,
                       p.label AS price_label, p.amount_cents, s.status, s.cancelled_at
                FROM sales s
                JOIN price_options p ON p.id = s.price_option_id
                WHERE s.event_id = ?
                ORDER BY s.created_at DESC, s.id DESC
                """,
                (event_id,),
            ).fetchall()
        return [dict(row) for row in rows]


def _create_sale_in_conn(
    conn: sqlite3.Connection,
    event_id: int,
    price_option_id: int,
    row_label: str,
    seat_label: str,
) -> dict[str, Any]:
    if not row_label.strip() or not seat_label.strip():
        raise ValueError("Ряд и место обязательны")

    seat = conn.execute(
        "SELECT id, status, active, sale_id FROM seats WHERE event_id = ? AND row_label = ? AND seat_label = ?",
        (event_id, row_label.strip(), seat_label.strip()),
    ).fetchone()
    if seat is None:
        raise ValueError("Место не найдено")
    if seat["active"] == 0:
        raise ValueError("Место отключено")
    if seat["status"] == "sold":
        raise ValueError("Это место уже продано")

    price = conn.execute(
        "SELECT id, label, amount_cents FROM price_options WHERE id = ? AND event_id = ?",
        (price_option_id, event_id),
    ).fetchone()
    if price is None:
        raise ValueError("Цена не найдена")

    cursor = conn.execute(
        """
        INSERT INTO sales (event_id, price_option_id, row_label, seat_label, amount_cents, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'sold', ?, ?)
        """,
        (event_id, price_option_id, row_label.strip(), seat_label.strip(), int(price["amount_cents"]), now_iso(), now_iso()),
    )
    sale_id = int(cursor.lastrowid)
    conn.execute(
        "UPDATE seats SET status = 'sold', sale_id = ?, updated_at = ? WHERE id = ?",
        (sale_id, now_iso(), seat["id"]),
    )
    row = conn.execute(
        """
        SELECT s.id, s.event_id, s.price_option_id, s.row_label, s.seat_label, s.amount_cents, s.created_at, s.printed_at,
               s.status, p.label AS price_label
        FROM sales s
        JOIN price_options p ON p.id = s.price_option_id
        WHERE s.id = ?
        """,
        (sale_id,),
    ).fetchone()
    assert row is not None
    return dict(row)


def create_sale(event_id: int, price_option_id: int, row_label: str, seat_label: str) -> dict[str, Any]:
    with connect() as conn:
        return _create_sale_in_conn(conn, event_id, price_option_id, row_label, seat_label)


def create_sales(event_id: int, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        raise ValueError("Нужно выбрать хотя бы одно место")

    seen: set[tuple[str, str]] = set()
    normalized: list[dict[str, Any]] = []
    for item in items:
        row_label = str(item.get("row_label", "")).strip()
        seat_label = str(item.get("seat_label", "")).strip()
        price_option_id = int(item.get("price_option_id", 0))
        key = (row_label, seat_label)
        if not row_label or not seat_label:
            raise ValueError("Ряд и место обязательны")
        if key in seen:
            raise ValueError(f"Место {row_label}-{seat_label} выбрано дважды")
        seen.add(key)
        normalized.append(
            {
                "row_label": row_label,
                "seat_label": seat_label,
                "price_option_id": price_option_id,
            }
        )

    with connect() as conn:
        sales: list[dict[str, Any]] = []
        try:
            for item in normalized:
                sales.append(
                    _create_sale_in_conn(
                        conn,
                        event_id,
                        int(item["price_option_id"]),
                        item["row_label"],
                        item["seat_label"],
                    )
                )
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()
        return sales


def mark_printed(sale_id: int) -> None:
    with connect() as conn:
        conn.execute("UPDATE sales SET printed_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), sale_id))


def get_seats(event_id: int) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, row_label, seat_label, status, active, sale_id, updated_at FROM seats WHERE event_id = ? ORDER BY CAST(row_label AS INTEGER) DESC, CAST(seat_label AS INTEGER) DESC",
            (event_id,),
        ).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["status"] = normalize_seat_status(str(item["status"]))
        return items


def update_seat_status(event_id: int, row_label: str, seat_label: str, status: str) -> dict[str, Any]:
    status = normalize_seat_status(status)
    with connect() as conn:
        seat = conn.execute(
            "SELECT id, status, active, sale_id FROM seats WHERE event_id = ? AND row_label = ? AND seat_label = ?",
            (event_id, row_label, seat_label),
        ).fetchone()
        if seat is None:
            raise ValueError("Место не найдено")
        if seat["active"] == 0:
            raise ValueError("Место отключено")

        current_status = normalize_seat_status(str(seat["status"]))
        if status == "reserved" and current_status == "sold":
            raise ValueError("Нельзя зарезервировать проданное место")
        if status == "free" and current_status == "sold":
            sale_id = seat["sale_id"]
            if sale_id is not None:
                conn.execute(
                    "UPDATE sales SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
                    (now_iso(), now_iso(), sale_id),
                )

        if status == "free":
            sale_id = None
        else:
            sale_id = seat["sale_id"]

        conn.execute(
            "UPDATE seats SET status = ?, sale_id = ?, updated_at = ? WHERE id = ?",
            (status, sale_id, now_iso(), seat["id"]),
        )
        updated = conn.execute(
            "SELECT id, row_label, seat_label, status, sale_id, updated_at FROM seats WHERE id = ?",
            (seat["id"],),
        ).fetchone()
        assert updated is not None
        return dict(updated)


def reserve_row(event_id: int, row_label: str) -> int:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, status, active FROM seats WHERE event_id = ? AND row_label = ?",
            (event_id, row_label),
        ).fetchall()
        updated = 0
        for row in rows:
            if normalize_seat_status(str(row["status"])) == "free" and row["active"] == 1:
                conn.execute(
                    "UPDATE seats SET status = 'reserved', updated_at = ? WHERE id = ?",
                    (now_iso(), row["id"]),
                )
                updated += 1
        return updated


def release_row(event_id: int, row_label: str) -> int:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, status, active FROM seats WHERE event_id = ? AND row_label = ?",
            (event_id, row_label),
        ).fetchall()
        updated = 0
        for row in rows:
            if normalize_seat_status(str(row["status"])) == "reserved" and row["active"] == 1:
                conn.execute(
                    "UPDATE seats SET status = 'free', sale_id = NULL, updated_at = ? WHERE id = ?",
                    (now_iso(), row["id"]),
                )
                updated += 1
        return updated


def sell_row(event_id: int, row_label: str, price_option_id: int) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, row_label, seat_label, status, active FROM seats WHERE event_id = ? AND row_label = ? ORDER BY CAST(seat_label AS INTEGER) DESC",
            (event_id, row_label),
        ).fetchall()
        sales: list[dict[str, Any]] = []
        try:
            for row in rows:
                if row["active"] != 1:
                    continue
                if normalize_seat_status(str(row["status"])) != "free":
                    continue
                sales.append(_create_sale_in_conn(conn, event_id, price_option_id, str(row["row_label"]), str(row["seat_label"])))
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()
        return sales


def cancel_row_sales(event_id: int, row_label: str) -> int:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, row_label, seat_label, status, active FROM seats WHERE event_id = ? AND row_label = ?",
            (event_id, row_label),
        ).fetchall()
        updated = 0
        for row in rows:
            if row["active"] != 1:
                continue
            if normalize_seat_status(str(row["status"])) != "sold":
                continue
            sale_id = conn.execute(
                "SELECT sale_id FROM seats WHERE id = ?",
                (row["id"],),
            ).fetchone()["sale_id"]
            if sale_id is not None:
                conn.execute(
                    "UPDATE sales SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
                    (now_iso(), now_iso(), sale_id),
                )
            conn.execute(
                "UPDATE seats SET status = 'free', sale_id = NULL, updated_at = ? WHERE id = ?",
                (now_iso(), row["id"]),
            )
            updated += 1
        return updated


def cancel_ticket(event_id: int, row_label: str, seat_label: str) -> dict[str, Any]:
    return update_seat_status(event_id, row_label, seat_label, "free")


def reset_event(event_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sales WHERE event_id = ?", (event_id,))
        conn.execute(
            """
            UPDATE seats
            SET status = 'free', sale_id = NULL, active = 1, updated_at = ?
            WHERE event_id = ?
            """,
            (now_iso(), event_id),
        )


def delete_event(event_id: int) -> None:
    with connect() as conn:
        template_row = conn.execute("SELECT template_path FROM events WHERE id = ?", (event_id,)).fetchone()
        if template_row is None:
            raise ValueError("Event not found")
        template_path = str(template_row["template_path"] or "").strip()

        conn.execute("DELETE FROM sales WHERE event_id = ?", (event_id,))
        conn.execute("DELETE FROM seats WHERE event_id = ?", (event_id,))
        conn.execute("DELETE FROM price_options WHERE event_id = ?", (event_id,))
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))

        if template_path:
            try:
                Path(template_path).unlink(missing_ok=True)
            except OSError:
                pass


def get_stats(event_id: int) -> dict[str, Any]:
    with connect() as conn:
        event = get_event(event_id)
        if event is None:
            raise ValueError("Event not found")
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_total,
                SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold,
                SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved,
                SUM(CASE WHEN status IN ('free', 'available') AND active = 1 THEN 1 ELSE 0 END) AS free,
                SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS inactive
            FROM seats
            WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()
        price_rows = conn.execute(
            """
            SELECT p.id, p.label, p.amount_cents,
                   SUM(CASE WHEN s.status = 'sold' THEN 1 ELSE 0 END) AS sold_count,
                   SUM(CASE WHEN s.status = 'sold' THEN s.amount_cents ELSE 0 END) AS revenue_cents
            FROM price_options p
            LEFT JOIN sales s ON s.price_option_id = p.id
            WHERE p.event_id = ?
            GROUP BY p.id, p.label, p.amount_cents, p.sort_order
            ORDER BY p.sort_order ASC, p.id ASC
            """,
            (event_id,),
        ).fetchall()
        total = int(row["total"] or 0)
        active_total = int(row["active_total"] or 0)
        sold = int(row["sold"] or 0)
        reserved = int(row["reserved"] or 0)
        free = int(row["free"] or 0)
        inactive = int(row["inactive"] or 0)
        revenue_cents = conn.execute(
            "SELECT COALESCE(SUM(amount_cents), 0) AS revenue FROM sales WHERE event_id = ? AND status = 'sold'",
            (event_id,),
        ).fetchone()["revenue"]
        price_breakdown = [
            {
                "price_id": item["id"],
                "label": item["label"],
                "amount_cents": item["amount_cents"],
                "sold_count": int(item["sold_count"] or 0),
                "revenue_cents": int(item["revenue_cents"] or 0),
            }
            for item in price_rows
        ]
        return {
            "event": event,
            "total_seats": active_total,
            "active_seats": active_total,
            "sold_count": sold,
            "reserved_count": reserved,
            "free_count": free,
            "inactive_count": inactive,
            "sold_percent": round((sold / active_total * 100) if active_total else 0, 1),
            "revenue_cents": int(revenue_cents or 0),
            "price_breakdown": price_breakdown,
        }


def reserve_seat(event_id: int, row_label: str, seat_label: str) -> dict[str, Any]:
    return update_seat_status(event_id, row_label, seat_label, "reserved")


def set_seat_active(event_id: int, row_label: str, seat_label: str, active: bool) -> dict[str, Any]:
    with connect() as conn:
        seat = conn.execute(
            "SELECT id, status, active, sale_id FROM seats WHERE event_id = ? AND row_label = ? AND seat_label = ?",
            (event_id, row_label, seat_label),
        ).fetchone()
        if seat is None:
            raise ValueError("Место не найдено")
        if not active and seat["status"] != "free":
            raise ValueError("Отключать можно только свободные места")
        conn.execute(
            "UPDATE seats SET active = ?, updated_at = ? WHERE id = ?",
            (1 if active else 0, now_iso(), seat["id"]),
        )
        updated = conn.execute(
            "SELECT id, row_label, seat_label, status, active, sale_id, updated_at FROM seats WHERE id = ?",
            (seat["id"],),
        ).fetchone()
        assert updated is not None
        return dict(updated)


def set_row_active(event_id: int, row_label: str, active: bool) -> int:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, status, active FROM seats WHERE event_id = ? AND row_label = ?",
            (event_id, row_label),
        ).fetchall()
        if not active and any(normalize_seat_status(str(row["status"])) != "free" for row in rows):
            raise ValueError("Отключать ряд можно только если все места свободны")
        updated = 0
        for row in rows:
            conn.execute(
                "UPDATE seats SET active = ?, updated_at = ? WHERE id = ?",
                (1 if active else 0, now_iso(), row["id"]),
            )
            updated += 1
        return updated


def set_column_active(event_id: int, seat_label: str, active: bool) -> int:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, status, active FROM seats WHERE event_id = ? AND seat_label = ?",
            (event_id, seat_label),
        ).fetchall()
        if not active and any(normalize_seat_status(str(row["status"])) != "free" for row in rows):
            raise ValueError("Отключать столбец можно только если все места свободны")
        updated = 0
        for row in rows:
            conn.execute(
                "UPDATE seats SET active = ?, updated_at = ? WHERE id = ?",
                (1 if active else 0, now_iso(), row["id"]),
            )
            updated += 1
        return updated


def remove_seat_from_scheme(event_id: int, row_label: str, seat_label: str) -> dict[str, Any]:
    return set_seat_active(event_id, row_label, seat_label, False)
