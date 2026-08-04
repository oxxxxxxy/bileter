from __future__ import annotations

import base64
import mimetypes
import os
import subprocess
import sys
from pathlib import Path
from typing import Callable

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .renderer import (
    event_card_to_png_bytes,
    get_default_printer_name,
    list_available_printers,
    print_report,
    report_combined_to_png_bytes,
    print_ticket,
    report_to_png_bytes,
    ticket_template_to_png_bytes,
    ticket_preview_to_png_bytes,
    ticket_to_png_bytes,
)
from .repository import (
    cancel_ticket,
    cancel_row_sales,
    create_event,
    create_sale,
    create_sales,
    get_event,
    get_hall_settings,
    get_seats,
    get_stats,
    list_events,
    list_sales,
    mark_printed,
    release_row,
    remove_seat_from_scheme,
    reserve_row,
    reserve_seat,
    sell_row,
    delete_event,
    set_column_active,
    set_row_active,
    set_seat_active,
    update_hall_settings,
    update_report_settings,
    update_event,
)
from .hall import HALL_LAYOUT


ROOT_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
FRONTEND_DIST = ROOT_DIR / "interface" / "dist"
PRINTER_NAME = os.environ.get("WEBEXE_PRINTER", "AIYIN_IP802BT").strip() or "AIYIN_IP802BT"
AUTO_OPEN_URL = os.environ.get("WEBEXE_URL", "http://127.0.0.1:8000")

app = FastAPI(title="WebExeStarter")


def _file_media_type(path: str | Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def _spawn_windows_process(command: list[str]) -> None:
    creationflags = 0
    if os.name == "nt":
        creationflags = (
            getattr(subprocess, "DETACHED_PROCESS", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )
    subprocess.Popen(command, close_fds=True, creationflags=creationflags)


def _open_windows_printer_settings(printer_name: str) -> None:
    if os.name != "nt":
        raise HTTPException(
            status_code=501,
            detail="Настройки принтера доступны только на Windows",
        )

    target = printer_name.strip()
    attempts: list[Callable[[], None]] = []

    if target:
        attempts.extend(
            [
                lambda: _spawn_windows_process(["rundll32.exe", "printui.dll,PrintUIEntry", "/p", "/n", target]),
                lambda: _spawn_windows_process(
                    ["rundll32.exe", "printui.dll,PrintUIEntry", "/e", "/n", target]
                ),
            ]
        )

    attempts.extend(
        [
            lambda: os.startfile("ms-settings:printers"),  # type: ignore[attr-defined]
            lambda: _spawn_windows_process(["control.exe", "printers"]),
            lambda: _spawn_windows_process(["control.exe", "/name", "Microsoft.DevicesAndPrinters"]),
            lambda: _spawn_windows_process(["explorer.exe", "shell:PrintersFolder"]),
        ]
    )

    last_error: Exception | None = None
    for attempt in attempts:
        try:
            attempt()
            return
        except Exception as exc:
            last_error = exc
            continue

    raise HTTPException(
        status_code=500,
        detail=f"Не удалось открыть настройки принтера{f' {target}' if target else ''}: {last_error}",
    )


def _extract_ticket_items(payload: dict, event: dict) -> list[dict]:
    raw_items = payload.get("tickets")
    if raw_items is None:
        raw_items = [
            {
                "row_label": payload.get("row_label", ""),
                "seat_label": payload.get("seat_label", ""),
                "price_option_id": payload.get("price_option_id", 0),
            }
        ]
    if not raw_items:
        raise HTTPException(status_code=400, detail="Нужно выбрать хотя бы одно место")

    items: list[dict] = []
    for item in raw_items:
        row_label = str(item.get("row_label", "")).strip()
        seat_label = str(item.get("seat_label", "")).strip()
        price_option_id = int(item.get("price_option_id", 0))
        if not row_label or not seat_label:
            raise HTTPException(status_code=400, detail="Ряд и место обязательны")
        price = next((entry for entry in event["prices"] if entry["id"] == price_option_id), None)
        if price is None:
            raise HTTPException(status_code=400, detail="Price option not found")
        items.append(
            {
                "row_label": row_label,
                "seat_label": seat_label,
                "price_option_id": price_option_id,
                "price_label": price["label"],
                "amount_cents": price["amount_cents"],
            }
        )
    return items


def _seat_display_labels(seats: list[dict]) -> dict[tuple[str, str], str]:
    grouped: dict[str, list[dict]] = {}
    for seat in seats:
        grouped.setdefault(str(seat["row_label"]), []).append(seat)
    labels: dict[tuple[str, str], str] = {}
    for row_label, items in grouped.items():
        sorted_items = sorted(
            items,
            key=lambda item: int(item["seat_label"]),
            reverse=True,
        )
        visible_seat_number = 1
        for seat in reversed(sorted_items):
            key = (row_label, str(seat["seat_label"]))
            if not seat.get("active", True):
                labels[key] = ""
                continue
            labels[key] = str(visible_seat_number)
            visible_seat_number += 1
    return labels


def _decorate_sales_with_display_labels(event_id: int, sales: list[dict]) -> list[dict]:
    display_labels = _seat_display_labels(get_seats(event_id))
    decorated: list[dict] = []
    for sale in sales:
        seat_display_label = display_labels.get(
            (str(sale["row_label"]), str(sale["seat_label"])),
            "",
        )
        decorated.append({**sale, "seat_display_label": seat_display_label})
    return decorated


def _template_file_response(template_path: str | None) -> Response | None:
    if template_path and Path(template_path).exists():
        file_path = Path(template_path)
        return Response(
            file_path.read_bytes(),
            media_type=_file_media_type(file_path),
        )
    return None


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/events")
def api_events() -> list[dict]:
    return list_events()


@app.get("/api/events/{event_id}")
def api_event(event_id: int) -> dict:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.get("/api/events/{event_id}/image")
def api_event_image(event_id: int) -> Response:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    template_response = _template_file_response(event.get("template_path"))
    if template_response is not None:
        return template_response
    return Response(event_card_to_png_bytes(event), media_type="image/png")


@app.get("/api/events/{event_id}/template-image")
def api_event_template_image(event_id: int) -> Response:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return Response(ticket_template_to_png_bytes(event), media_type="image/png")


@app.get("/api/sales")
def api_sales(event_id: int | None = None) -> list[dict]:
    return list_sales(event_id)


@app.get("/api/hall-layout")
def api_hall_layout() -> list[dict]:
    return HALL_LAYOUT


@app.get("/api/hall-settings")
def api_hall_settings() -> dict:
    return get_hall_settings()


@app.get("/api/report-settings")
def api_report_settings() -> dict:
    return get_hall_settings().get("default_report_settings", {})


@app.get("/api/hall-settings/template-image")
def api_hall_settings_template_image() -> Response:
    settings = get_hall_settings()
    template_response = _template_file_response(
        settings.get("default_ticket_template_path")
    )
    if template_response is not None:
        return template_response
    raise HTTPException(status_code=404, detail="Template not found")


@app.post("/api/hall-settings/ticket-preview")
def api_hall_settings_ticket_preview(payload: dict = Body(default_factory=dict)) -> dict:
    settings = get_hall_settings()
    ticket_layout = payload.get("ticket_layout")
    event = {
        "template_path": settings.get("default_ticket_template_path"),
        "ticket_layout": (
            ticket_layout
            if isinstance(ticket_layout, dict) and ticket_layout
            else settings.get("default_ticket_layout", {})
        ),
        "prices": [],
        "title": "",
    }
    sale = {
        "row_label": str(payload.get("row_text") or ""),
        "seat_label": "",
        "seat_display_label": str(payload.get("seat_text") or ""),
        "amount_cents": None,
        "price_text": str(payload.get("price_text") or ""),
        "price_label": "",
    }
    png = ticket_preview_to_png_bytes(event, sale)
    return {"preview_png_base64": base64.b64encode(png).decode("ascii")}


@app.post("/api/report-settings/preview")
def api_report_settings_preview(payload: dict = Body(default_factory=dict)) -> dict:
    settings = get_hall_settings()
    report_settings = {
        "font_size": int(
            payload.get(
                "font_size",
                settings.get("default_report_settings", {}).get("font_size", 28),
            )
        )
    }
    sample_event = {
        "title": "Пример сводки",
        "template_path": settings.get("default_ticket_template_path"),
        "ticket_layout": settings.get("default_ticket_layout", {}),
        "prices": [],
    }
    sample_stats = {
        "total_seats": 283,
        "active_seats": 283,
        "sold_count": 126,
        "reserved_count": 14,
        "free_count": 143,
        "inactive_count": 0,
        "fill_percent": 44.5,
        "sold_percent": 44.5,
        "revenue_cents": 18200,
        "price_breakdown": [
            {
                "price_id": 1,
                "label": "Полная",
                "amount_cents": 200,
                "sold_count": 62,
                "revenue_cents": 12400,
            },
            {
                "price_id": 2,
                "label": "Льготная",
                "amount_cents": 100,
                "sold_count": 44,
                "revenue_cents": 4400,
            },
            {
                "price_id": 3,
                "label": "Бесплатно",
                "amount_cents": 0,
                "sold_count": 20,
                "revenue_cents": 0,
            },
        ],
    }
    preview = report_to_png_bytes(sample_event, sample_stats, report_settings=report_settings)
    return {"preview_png_base64": base64.b64encode(preview).decode("ascii")}


@app.get("/api/printers")
def api_printers() -> dict:
    printers = list_available_printers()
    default_printer = get_default_printer_name()
    active = None

    if PRINTER_NAME and PRINTER_NAME in printers:
        active = PRINTER_NAME
    elif default_printer and default_printer in printers:
        active = default_printer
    elif printers:
        active = printers[0]
    elif PRINTER_NAME:
        active = PRINTER_NAME
        printers = [PRINTER_NAME]
    elif default_printer:
        active = default_printer
        printers = [default_printer]

    return {"printers": printers, "active": active}


@app.post("/api/printers/open-settings")
def api_open_printer_settings(payload: dict = Body(default_factory=dict)) -> dict:
    printer_name = str(payload.get("printer_name", "")).strip()
    _open_windows_printer_settings(printer_name)
    return {"status": "opened", "printer_name": printer_name or None}


@app.get("/api/events/{event_id}/seats")
def api_event_seats(event_id: int) -> list[dict]:
    return get_seats(event_id)


@app.get("/api/events/{event_id}/stats")
def api_event_stats(event_id: int) -> dict:
    try:
        return get_stats(event_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/events")
async def api_create_event(
    title: str = Form(""),
    prices_json: str = Form("[]"),
    hall_rows: int = Form(20),
    hall_seats: int = Form(20),
    inactive_seats_json: str = Form("[]"),
    ticket_layout_json: str = Form("{}"),
    template: UploadFile | None = File(None),
) -> dict:
    template_bytes = await template.read() if template is not None else None
    template_name = template.filename if template is not None else None
    try:
        return create_event(
            title,
            prices_json,
            template_bytes,
            template_name,
            hall_rows,
            hall_seats,
            inactive_seats_json,
            ticket_layout_json,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/hall-settings")
async def api_update_hall_settings(
    rows_count: int = Form(20),
    seats_count: int = Form(20),
    inactive_seats_json: str = Form("[]"),
    default_prices_json: str = Form("[]"),
    default_ticket_layout_json: str = Form("{}"),
    default_report_settings_json: str = Form(""),
    default_template: UploadFile | None = File(None),
) -> dict:
    try:
        return update_hall_settings(
            rows_count,
            seats_count,
            inactive_seats_json,
            default_prices_json,
            default_ticket_layout_json,
            default_report_settings_json,
            await default_template.read() if default_template is not None else None,
            default_template.filename if default_template is not None else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/report-settings")
async def api_update_report_settings(font_size: int = Form(28)) -> dict:
    try:
        return update_report_settings(font_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/events/{event_id}")
async def api_update_event(
    event_id: int,
    title: str = Form(""),
    ticket_layout_json: str = Form("{}"),
    template: UploadFile | None = File(None),
) -> dict:
    template_bytes = await template.read() if template is not None else None
    template_name = template.filename if template is not None else None
    try:
        return update_event(
            event_id,
            title,
            template_bytes,
            template_name,
            ticket_layout_json,
        )
    except ValueError as exc:
        if str(exc) == "Event not found":
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/tickets/preview")
def api_preview(payload: dict) -> dict:
    event_id = int(payload.get("event_id", 0))
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ticket_layout = payload.get("ticket_layout")
    if isinstance(ticket_layout, dict) and ticket_layout:
        event = {**event, "ticket_layout": ticket_layout}
    preview_blank = bool(payload.get("preview_blank", False))
    if preview_blank:
        first_sale = {
            "row_label": "",
            "seat_label": "",
            "seat_display_label": "",
            "amount_cents": None,
            "price_label": "",
        }
    elif any(
        payload.get(key) is not None
        for key in ("price_text", "row_text", "seat_text")
    ):
        first_sale = {
            "row_label": str(payload.get("row_text") or ""),
            "seat_label": "",
            "seat_display_label": str(payload.get("seat_text") or ""),
            "amount_cents": None,
            "price_text": str(payload.get("price_text") or ""),
            "price_label": "",
        }
    else:
        sales = _decorate_sales_with_display_labels(
            event_id,
            _extract_ticket_items(payload, event),
        )
        first_sale = sales[0]
    png = ticket_preview_to_png_bytes(event, first_sale)
    return {"preview_png_base64": base64.b64encode(png).decode("ascii")}


@app.post("/api/tickets/print")
def api_print(payload: dict) -> dict:
    event_id = int(payload.get("event_id", 0))
    seat_action = str(payload.get("mode", "sell")).lower()
    printer_name = str(payload.get("printer_name", "")).strip() or PRINTER_NAME
    dither_enabled = bool(payload.get("dither", True))
    ticket_gap_mm = float(payload.get("ticket_gap_mm", 4))

    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    try:
        if seat_action == "reserve":
            row_label = str(payload.get("row_label", "")).strip()
            seat_label = str(payload.get("seat_label", "")).strip()
            seat = reserve_seat(event_id, row_label, seat_label)
            return {"status": "reserved", "seat": seat}
        tickets = _extract_ticket_items(payload, event)
        if len(tickets) == 1:
            sale = create_sale(
                event_id,
                int(tickets[0]["price_option_id"]),
                tickets[0]["row_label"],
                tickets[0]["seat_label"],
            )
            sales = [sale]
        else:
            sales = create_sales(event_id, tickets)
    except ValueError as exc:
        status_code = 409 if "продано" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    sales = _decorate_sales_with_display_labels(event_id, sales)
    preview = ticket_preview_to_png_bytes(event, sales[0])
    job_ids: list[str] = []
    for sale in sales:
        job_id = print_ticket(
            event,
            sale,
            printer_name,
            ticket_gap_mm=ticket_gap_mm,
            dither_enabled=dither_enabled,
        )
        job_ids.append(job_id)
        mark_printed(int(sale["id"]))
    return {
        "sale_id": sales[0]["id"] if len(sales) == 1 else [sale["id"] for sale in sales],
        "job_id": job_ids[0] if len(job_ids) == 1 else job_ids,
        "preview_png_base64": base64.b64encode(preview).decode("ascii"),
        "event": event,
    }


@app.post("/api/events/{event_id}/rows/{row_label}/reserve")
def api_reserve_row(event_id: int, row_label: str) -> dict:
    updated = reserve_row(event_id, row_label)
    return {"updated": updated}


@app.post("/api/events/{event_id}/rows/{row_label}/release")
def api_release_row(event_id: int, row_label: str) -> dict:
    updated = release_row(event_id, row_label)
    return {"updated": updated}


@app.post("/api/events/{event_id}/rows/{row_label}/sell")
def api_sell_row(
    event_id: int,
    row_label: str,
    payload: dict = Body(default_factory=dict),
) -> dict:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    price_option_id = int(payload.get("price_option_id", 0))
    if not any(int(price["id"]) == price_option_id for price in event["prices"]):
        raise HTTPException(status_code=400, detail="Price option not found")

    try:
        sales = sell_row(event_id, row_label, price_option_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sales = _decorate_sales_with_display_labels(event_id, sales)
    return {"sales": sales}


@app.post("/api/events/{event_id}/rows/{row_label}/cancel-sold")
def api_cancel_row_sold(event_id: int, row_label: str) -> dict:
    updated = cancel_row_sales(event_id, row_label)
    return {"updated": updated}


@app.post("/api/events/{event_id}/seats/{row_label}/{seat_label}/reserve")
def api_reserve_seat(event_id: int, row_label: str, seat_label: str) -> dict:
    seat = reserve_seat(event_id, row_label, seat_label)
    return {"seat": seat}


@app.post("/api/events/{event_id}/seats/{row_label}/{seat_label}/remove")
def api_remove_seat_from_scheme(event_id: int, row_label: str, seat_label: str) -> dict:
    seat = remove_seat_from_scheme(event_id, row_label, seat_label)
    return {"seat": seat}


@app.post("/api/events/{event_id}/seats/{row_label}/{seat_label}/active")
def api_set_seat_active(
    event_id: int,
    row_label: str,
    seat_label: str,
    payload: dict = Body(default_factory=dict),
) -> dict:
    seat = set_seat_active(event_id, row_label, seat_label, bool(payload.get("active", True)))
    return {"seat": seat}


@app.post("/api/events/{event_id}/rows/{row_label}/active")
def api_set_row_active(
    event_id: int,
    row_label: str,
    payload: dict = Body(default_factory=dict),
) -> dict:
    updated = set_row_active(event_id, row_label, bool(payload.get("active", True)))
    return {"updated": updated}


@app.post("/api/events/{event_id}/columns/{seat_label}/active")
def api_set_column_active(
    event_id: int,
    seat_label: str,
    payload: dict = Body(default_factory=dict),
) -> dict:
    updated = set_column_active(event_id, seat_label, bool(payload.get("active", True)))
    return {"updated": updated}


@app.post("/api/events/{event_id}/seats/{row_label}/{seat_label}/cancel")
def api_cancel_seat(event_id: int, row_label: str, seat_label: str) -> dict:
    seat = cancel_ticket(event_id, row_label, seat_label)
    return {"seat": seat}


@app.post("/api/events/{event_id}/reset")
def api_reset_event(event_id: int) -> dict:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    delete_event(event_id)
    return {"status": "deleted"}


@app.post("/api/events/{event_id}/report/print")
def api_report_print(event_id: int, payload: dict = Body(default_factory=dict)) -> dict:
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    stats = get_stats(event_id)
    report_mode = str(payload.get("report_mode", "separate")).strip().lower()
    if report_mode not in {"combined", "separate"}:
        report_mode = "separate"
    preview = (
        report_combined_to_png_bytes(event, stats)
        if report_mode == "combined"
        else report_to_png_bytes(event, stats)
    )
    printer_name = str(payload.get("printer_name", "")).strip() or PRINTER_NAME
    dither_enabled = bool(payload.get("dither", True))
    job_id = print_report(
        event,
        stats,
        printer_name,
        dither_enabled=dither_enabled,
        mode=report_mode,
    )
    return {
        "job_id": job_id,
        "report_mode": report_mode,
        "preview_png_base64": base64.b64encode(preview).decode("ascii"),
        "stats": stats,
    }


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
