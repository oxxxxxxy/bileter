from __future__ import annotations

import io
import functools
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .db import DEFAULT_TICKET_LAYOUT, TEMPLATE_DIR
from .models import TicketLayoutField
from .repository import get_hall_settings


ROOT_DIR = Path(__file__).resolve().parents[2]
INTER_REGULAR = "Inter-Regular.ttf"
INTER_BOLD = "Inter-Bold.ttf"
INTER_FONT_DIRS = (
    Path(ROOT_DIR / "interface" / "dist" / "fonts" / "inter"),
    Path(ROOT_DIR / "interface" / "public" / "fonts" / "inter"),
    Path(ROOT_DIR / "server" / "app" / "fonts" / "inter"),
)
PAPER_WIDTH_MM = 57.0
PRINTER_DPI = 203
PAPER_WIDTH_PX = max(1, round(PAPER_WIDTH_MM / 25.4 * PRINTER_DPI))
TICKET_RATIO_W = 3780
TICKET_RATIO_H = 1358
TICKET_SHORT_SIDE_PX = PAPER_WIDTH_PX
TICKET_LONG_SIDE_PX = max(
    1,
    round(TICKET_SHORT_SIDE_PX * TICKET_RATIO_W / TICKET_RATIO_H),
)
DITHER_THRESHOLD = 175


def mm_to_px(mm: float) -> int:
    return max(0, round(float(mm) / 25.4 * PRINTER_DPI))


@functools.lru_cache(maxsize=16)
def _resolve_project_font(filename: str) -> Path | None:
    for directory in INTER_FONT_DIRS:
        candidate = directory / filename
        if candidate.exists():
            return candidate
    return None


@functools.lru_cache(maxsize=16)
def _resolve_font_path_family(family: str, preferred: Path | None = None) -> Path | None:
    if preferred is not None and preferred.exists():
        return preferred

    fc_match = shutil.which("fc-match")
    if fc_match is None:
        return None

    proc = subprocess.run(
        [fc_match, "-f", "%{file}\n", family],
        capture_output=True,
        text=True,
        check=False,
    )
    path = proc.stdout.strip().splitlines()[0] if proc.stdout.strip() else ""
    if path and Path(path).exists():
        return Path(path)
    return None


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    bundled = _resolve_project_font(INTER_BOLD if bold else INTER_REGULAR)
    path = bundled or _resolve_font_path_family("Inter:style=Bold" if bold else "Inter")
    if path is not None:
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def load_mono_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = _resolve_project_font(INTER_REGULAR) or _resolve_font_path_family("Inter")
    if path is not None:
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def get_default_printer_name() -> str | None:
    if os.name == "nt":
        try:
            import win32print  # type: ignore

            name = str(win32print.GetDefaultPrinter()).strip()
            return name or None
        except Exception:
            powershell = shutil.which("powershell")
            if powershell is None:
                return None
            proc = subprocess.run(
                [
                    powershell,
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -First 1 -ExpandProperty Name)",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            name = proc.stdout.strip()
            return name or None

    _ensure_cups_running()
    try:
        proc = subprocess.run(["lpstat", "-d"], capture_output=True, text=True, check=False)
    except Exception:
        return None

    output = f"{proc.stdout}\n{proc.stderr}".strip()
    marker = "system default destination:"
    for line in output.splitlines():
        lower = line.lower()
        if marker in lower:
            return line.split(":", 1)[1].strip() or None
    return None


def list_available_printers() -> list[str]:
    if os.name == "nt":
        try:
            import win32print  # type: ignore

            flags = getattr(win32print, "PRINTER_ENUM_LOCAL", 2) | getattr(win32print, "PRINTER_ENUM_CONNECTIONS", 4)
            printers = []
            for entry in win32print.EnumPrinters(flags, None, 4):
                name = str(entry[2]).strip()
                if name:
                    printers.append(name)
            default_name = get_default_printer_name()
            if default_name and default_name not in printers:
                printers.insert(0, default_name)
            return list(dict.fromkeys(printers))
        except Exception:
            powershell = shutil.which("powershell")
            if powershell is None:
                return []
            proc = subprocess.run(
                [
                    powershell,
                    "-NoProfile",
                    "-Command",
                    "Get-Printer | Select-Object -ExpandProperty Name",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            printers = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
            default_name = get_default_printer_name()
            if default_name and default_name not in printers:
                printers.insert(0, default_name)
            return list(dict.fromkeys(printers))

    _ensure_cups_running()
    try:
        res = subprocess.run(["lpstat", "-e"], capture_output=True, text=True, check=False)
        printers = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        default_name = get_default_printer_name()
        if default_name and default_name not in printers:
            printers.insert(0, default_name)
        return list(dict.fromkeys(printers))
    except Exception:
        return []


def _template_path(template_path: str | None) -> Path | None:
    if not template_path:
        return None
    path = Path(template_path)
    if path.exists():
        return path
    return TEMPLATE_DIR / path.name if (TEMPLATE_DIR / path.name).exists() else None


def _resolve_ticket_template_path(event: dict[str, Any]) -> Path | None:
    event_path = _template_path(event.get("template_path"))
    if event_path is not None:
        return event_path
    try:
        default_path = get_hall_settings().get("default_ticket_template_path")
    except Exception:
        default_path = None
    return _template_path(str(default_path or "")) if default_path else None
def _ticket_layout(event: dict[str, Any]) -> dict[str, dict[str, Any]]:
    layout = event.get("ticket_layout")
    if isinstance(layout, dict) and layout:
        return {
            key: TicketLayoutField.from_mapping(
                layout.get(key, {}),
                fallback,
            ).to_dict()
            for key, fallback in DEFAULT_TICKET_LAYOUT.items()
        }
    try:
        default_layout = get_hall_settings().get("default_ticket_layout")
    except Exception:
        default_layout = None
    if isinstance(default_layout, dict) and default_layout:
        return {
            key: TicketLayoutField.from_mapping(
                default_layout.get(key, {}),
                fallback,
            ).to_dict()
            for key, fallback in DEFAULT_TICKET_LAYOUT.items()
        }
    return {key: dict(value) for key, value in DEFAULT_TICKET_LAYOUT.items()}


def _aligned_x(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    font: ImageFont.ImageFont | ImageFont.FreeTypeFont,
    align: str,
) -> int:
    if align == "left" or not text:
        return x
    left, _, right, _ = draw.textbbox((0, 0), text, font=font)
    width = right - left
    if align == "center":
        return int(x - width / 2)
    return x - width


def _fit_to_printer_width(image: Image.Image) -> Image.Image:
    if image.width == PAPER_WIDTH_PX:
        return image
    height = max(1, round(image.height * PAPER_WIDTH_PX / image.width))
    return image.resize((PAPER_WIDTH_PX, height), Image.Resampling.LANCZOS)


def _fit_within(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    if image.width <= 0 or image.height <= 0:
        return image
    scale = min(max_width / image.width, max_height / image.height)
    if scale >= 1:
        return image.copy()
    width = max(1, int(round(image.width * scale)))
    height = max(1, int(round(image.height * scale)))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def _wrap_fixed_width_lines(lines: list[str], inner_width: int = 20) -> list[str]:
    wrapped: list[str] = []
    for raw_line in lines:
        if not raw_line:
            wrapped.append(" " * (inner_width + 2))
            continue
        text = str(raw_line)
        for start in range(0, len(text), inner_width):
            chunk = text[start : start + inner_width]
            wrapped.append(f" {chunk.ljust(inner_width)} ")
    return wrapped


def _wrap_text_to_pixel_width(
    lines: list[str],
    draw: ImageDraw.ImageDraw,
    font: ImageFont.ImageFont | ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    wrapped: list[str] = []
    for raw_line in lines:
        text = str(raw_line or "").strip()
        if not text:
            wrapped.append("")
            continue

        words = text.split()
        if not words:
            wrapped.append("")
            continue

        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            left, _, right, _ = draw.textbbox((0, 0), candidate, font=font)
            if right - left <= max_width:
                current = candidate
                continue
            wrapped.append(current)
            current = word
        wrapped.append(current)
    return wrapped


def build_report_lines(event: dict[str, Any], stats: dict[str, Any]) -> list[str]:
    lines = [
        event.get("title") or "Без названия",
        "",
        f"Всего мест: {stats['total_seats']}",
        f"Продано: {stats['sold_count']}",
        f"В резерве: {stats['reserved_count']}",
        f"Свободно: {stats['free_count']}",
        f"Продажи: {stats['sold_percent']}%",
        f"Выручка: {stats['revenue_cents']} ₽",
        "",
        "ПО ЦЕНАМ",
    ]
    for item in stats["price_breakdown"]:
        lines.append(f"{item['label']}: {item['amount_cents']} ₽")
        lines.append(f"Продано: {item['sold_count']}")
        lines.append(f"Сумма: {item['revenue_cents']} ₽")
        lines.append("")
    return lines


def _report_settings(override: dict[str, Any] | None = None) -> dict[str, int]:
    try:
        settings = get_hall_settings().get("default_report_settings", {})
    except Exception:
        settings = {}
    merged = dict(settings or {})
    if override:
        merged.update(override)
    return {
        "font_size": max(12, int(merged.get("font_size", 28))),
    }


def atkinson_dither(gray: Image.Image, threshold: int = DITHER_THRESHOLD) -> Image.Image:
    src = gray.convert("L")
    pixels = src.load()
    width, height = src.size

    for y in range(height):
        for x in range(width):
            old = pixels[x, y]
            new = 255 if old >= threshold else 0
            err = old - new
            pixels[x, y] = new
            if not err:
                continue

            delta = err / 8.0
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                nx = x + dx
                ny = y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    pixels[nx, ny] = max(
                        0,
                        min(255, int(round(pixels[nx, ny] + delta))),
                    )

    return src.convert("1")


def _prepare_printer_image(image: Image.Image, dither_enabled: bool) -> Image.Image:
    print_image = _fit_to_printer_width(image)
    if dither_enabled:
        return atkinson_dither(print_image.convert("L")).convert("RGB")
    # Let the OS/printer driver decide whether to dither or print as-is.
    return print_image.convert("RGB")


def _rotate_ticket_for_print(image: Image.Image) -> Image.Image:
    # Ticket artwork is designed horizontally, but on 57 mm roll paper
    # it prints larger when rotated into portrait orientation first.
    return image.rotate(90, expand=True)


def _ensure_cups_running() -> None:
    status = subprocess.run(["lpstat", "-t"], capture_output=True, text=True, check=False)
    output = f"{status.stdout}\n{status.stderr}".strip()
    if "Scheduler is not running" not in output and "scheduler is not running" not in output:
        return

    cupsd = shutil.which("cupsd")
    if cupsd is None:
        return

    sudo = shutil.which("sudo")
    commands = []
    if sudo is not None:
        commands.append([sudo, "-n", cupsd, "-f"])
    commands.append([cupsd, "-f"])

    for cmd in commands:
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            continue
        break
    # Give CUPS a moment to come up before the print job is submitted.
    time.sleep(1)


def _lp_print(
    image: Image.Image,
    printer_name: str | None,
    label: str,
    dither_enabled: bool,
) -> str:
    if not printer_name:
        return "preview-only"

    _ensure_cups_running()

    lp = shutil.which("lp")
    if lp is None:
        raise RuntimeError("lp не найден в системе")

    print_image = _prepare_printer_image(image, dither_enabled)
    page_width_mm = int(round(PAPER_WIDTH_MM))
    page_height_mm = max(1, round(print_image.height / PRINTER_DPI * 25.4))

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        print_image.save(tmp, format="PNG", dpi=(PRINTER_DPI, PRINTER_DPI))
        tmp_path = tmp.name

    base_cmd = [lp, "-d", printer_name, tmp_path]
    tuned_cmd = [
        lp,
        "-d",
        printer_name,
        "-o",
        f"PageSize=Custom.{page_width_mm}x{page_height_mm}mm",
        "-o",
        "zeMediaTracking=Continuous",
        "-o",
        "MediaMethod=Direct",
        "-o",
        "Rotate=0",
        tmp_path,
    ]

    try:
        proc = subprocess.run(tuned_cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            proc = subprocess.run(base_cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise RuntimeError(
                proc.stderr.strip() or proc.stdout.strip() or f"{label} print failed"
            )
        return proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else "printed"
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _windows_print_image(
    image: Image.Image,
    printer_name: str | None,
    label: str,
    dither_enabled: bool,
) -> str:
    if not printer_name:
        return "preview-only"

    try:
        import win32ui  # type: ignore
        from PIL import ImageWin
    except Exception as exc:
        raise RuntimeError("Windows printing requires pywin32") from exc

    print_image = _prepare_printer_image(image, dither_enabled)
    dib = ImageWin.Dib(print_image)

    hdc = win32ui.CreateDC()
    hdc.CreatePrinterDC(printer_name)
    try:
        hdc.StartDoc(label)
        hdc.StartPage()
        horzres = hdc.GetDeviceCaps(8)
        vertres = hdc.GetDeviceCaps(10)
        scale = min(horzres / print_image.width, vertres / print_image.height)
        draw_w = max(1, int(print_image.width * scale))
        draw_h = max(1, int(print_image.height * scale))
        left = max(0, (horzres - draw_w) // 2)
        top = max(0, (vertres - draw_h) // 2)
        dib.draw(hdc.GetHandleOutput(), (left, top, left + draw_w, top + draw_h))
        hdc.EndPage()
        hdc.EndDoc()
        return "printed"
    finally:
        try:
            hdc.DeleteDC()
        except Exception:
            pass


def _print_image(image: Image.Image, printer_name: str | None, label: str, dither_enabled: bool) -> str:
    if os.name == "nt":
        return _windows_print_image(image, printer_name, label, dither_enabled)
    return _lp_print(image, printer_name, label, dither_enabled)


def _lp_print_text(text: str, printer_name: str | None, label: str) -> str:
    if not printer_name:
        return "preview-only"

    _ensure_cups_running()

    lp = shutil.which("lp")
    if lp is None:
        raise RuntimeError("lp не найден в системе")

    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as tmp:
        tmp.write(text)
        tmp_path = tmp.name

    try:
        proc = subprocess.run([lp, "-d", printer_name, tmp_path], capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"{label} print failed")
        return proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else "printed"
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _base_canvas(event: dict[str, Any]) -> Image.Image:
    template = _resolve_ticket_template_path(event)
    if template and template.exists():
        return Image.open(template).convert("RGBA")

    image = Image.new("RGBA", (1800, 800), (244, 231, 213, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((24, 24, 1776, 776), radius=36, outline=(122, 32, 32, 255), width=8)
    draw.rectangle((0, 0, 1800, 70), fill=(111, 27, 33, 255))
    draw.rectangle((0, 730, 1800, 800), fill=(111, 27, 33, 255))
    return image


def _resize_ticket_canvas(image: Image.Image) -> Image.Image:
    return image.resize((TICKET_LONG_SIDE_PX, TICKET_SHORT_SIDE_PX), Image.Resampling.LANCZOS)


def render_ticket(event: dict[str, Any], sale: dict[str, Any]) -> Image.Image:
    canvas = _resize_ticket_canvas(_base_canvas(event))
    draw = ImageDraw.Draw(canvas)
    layout = _ticket_layout(event)
    price_layout = layout["price"]
    row_layout = layout["row"]
    seat_layout = layout["seat"]

    price_font = load_font(price_layout["size"], bold=False)
    field_value_font = load_font(row_layout["size"], bold=False)

    row_value = str(sale.get("row_label") or "")
    seat_value = str(sale.get("seat_display_label") or sale.get("seat_label") or "")
    price_raw = sale.get("price_text")
    if price_raw is None:
        amount_cents = sale.get("amount_cents")
        price_text = f"{amount_cents:.0f} ₽" if amount_cents is not None else ""
    else:
        price_text = str(price_raw)

    if price_text:
        draw.text(
            (
                _aligned_x(
                    draw,
                    price_text,
                    price_layout["x"],
                    price_font,
                    str(price_layout.get("align", "left")),
                ),
                price_layout["y"],
            ),
            price_text,
            fill=(111, 27, 33, 255),
            font=price_font,
        )
    if row_value:
        draw.text(
            (
                _aligned_x(
                    draw,
                    row_value,
                    row_layout["x"],
                    field_value_font,
                    str(row_layout.get("align", "left")),
                ),
                row_layout["y"],
            ),
            row_value,
            fill=(111, 27, 33, 255),
            font=field_value_font,
        )
    if seat_value:
        seat_font = load_font(seat_layout["size"], bold=False)
        draw.text(
            (
                _aligned_x(
                    draw,
                    seat_value,
                    seat_layout["x"],
                    seat_font,
                    str(seat_layout.get("align", "left")),
                ),
                seat_layout["y"],
            ),
            seat_value,
            fill=(111, 27, 33, 255),
            font=seat_font,
        )

    return canvas.convert("RGB")


def ticket_to_png_bytes(event: dict[str, Any], sale: dict[str, Any]) -> bytes:
    image = _rotate_ticket_for_print(render_ticket(event, sale))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def ticket_preview_to_png_bytes(event: dict[str, Any], sale: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    render_ticket(event, sale).save(buffer, format="PNG")
    return buffer.getvalue()


def ticket_template_to_png_bytes(event: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    _base_canvas(event).convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


def render_ticket_batch(
    event: dict[str, Any],
    sales: list[dict[str, Any]],
    ticket_gap_mm: float = 4.0,
) -> Image.Image:
    if not sales:
        raise ValueError("No tickets to render")

    tickets = [_rotate_ticket_for_print(render_ticket(event, sale)) for sale in sales]
    gap_px = mm_to_px(ticket_gap_mm)
    width = max(ticket.width for ticket in tickets)
    height = sum(ticket.height for ticket in tickets) + gap_px * (len(tickets) - 1)
    image = Image.new("RGB", (width, height), (255, 255, 255))

    y = 0
    for index, ticket in enumerate(tickets):
        x = max(0, (width - ticket.width) // 2)
        image.paste(ticket, (x, y))
        y += ticket.height
        if index < len(tickets) - 1:
            y += gap_px

    return image


def tickets_to_png_bytes(
    event: dict[str, Any],
    sales: list[dict[str, Any]],
    ticket_gap_mm: float = 4.0,
) -> bytes:
    image = render_ticket_batch(event, sales, ticket_gap_mm=ticket_gap_mm)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _with_trailing_gap(image: Image.Image, gap_mm: float) -> Image.Image:
    gap_px = mm_to_px(gap_mm)
    if gap_px <= 0:
        return image
    padded = Image.new("RGB", (image.width, image.height + gap_px), (255, 255, 255))
    padded.paste(image, (0, 0))
    return padded


def print_ticket(
    event: dict[str, Any],
    sale: dict[str, Any],
    printer_name: str | None,
    ticket_gap_mm: float = 0,
    dither_enabled: bool = True,
) -> str:
    image = _with_trailing_gap(render_ticket_batch(event, [sale], ticket_gap_mm=0), ticket_gap_mm)
    return _print_image(image, printer_name, "ticket", dither_enabled)


def print_tickets(
    event: dict[str, Any],
    sales: list[dict[str, Any]],
    printer_name: str | None,
    ticket_gap_mm: float = 4.0,
    dither_enabled: bool = True,
) -> str:
    image = render_ticket_batch(event, sales, ticket_gap_mm=ticket_gap_mm)
    return _print_image(image, printer_name, "ticket", dither_enabled)


def render_report(
    event: dict[str, Any],
    stats: dict[str, Any],
    report_settings: dict[str, Any] | None = None,
) -> Image.Image:
    settings = _report_settings(report_settings)
    body_size = settings["font_size"]
    title_size = max(body_size + 20, int(body_size * 1.8))
    small_size = max(12, body_size - 3)
    line_height = body_size + 7
    preview_canvas = Image.new("RGB", (840, 32), (255, 255, 255))
    preview_draw = ImageDraw.Draw(preview_canvas)
    mono_font = load_mono_font(body_size)
    mono_small = load_mono_font(small_size)
    wrapped_lines = _wrap_text_to_pixel_width(
        build_report_lines(event, stats),
        preview_draw,
        mono_font,
        760,
    )
    content_height = 110 + line_height * len(wrapped_lines) + 90
    image = Image.new("RGB", (840, max(900, content_height)), (255, 255, 255))
    draw = ImageDraw.Draw(image)
    title_font = load_font(title_size, bold=True)
    draw.text((36, 34), "ОТЧЁТ", fill=(0, 0, 0), font=title_font)
    y = 132
    for line in wrapped_lines:
        font = mono_font if len(line.strip()) > 0 else mono_small
        draw.text((36, y), line, fill=(0, 0, 0), font=font)
        y += line_height
    return image


def report_to_png_bytes(
    event: dict[str, Any],
    stats: dict[str, Any],
    report_settings: dict[str, Any] | None = None,
) -> bytes:
    image = render_report(event, stats, report_settings=report_settings)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def render_combined_report(
    event: dict[str, Any],
    stats: dict[str, Any],
    report_settings: dict[str, Any] | None = None,
) -> Image.Image:
    report_image = render_report(event, stats, report_settings=report_settings)
    ticket_thumb = _fit_within(_base_canvas(event).convert("RGB"), 760, 270)

    padding = 40
    gap = 28
    width = max(report_image.width, ticket_thumb.width + padding * 2)
    height = padding + ticket_thumb.height + gap + report_image.height + padding
    image = Image.new("RGB", (width, height), (255, 255, 255))

    thumb_x = max(0, (width - ticket_thumb.width) // 2)
    thumb_y = padding
    report_x = max(0, (width - report_image.width) // 2)
    report_y = thumb_y + ticket_thumb.height + gap

    image.paste(ticket_thumb, (thumb_x, thumb_y))
    image.paste(report_image, (report_x, report_y))
    return image


def report_combined_to_png_bytes(
    event: dict[str, Any],
    stats: dict[str, Any],
    report_settings: dict[str, Any] | None = None,
) -> bytes:
    image = render_combined_report(event, stats, report_settings=report_settings)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def print_report(
    event: dict[str, Any],
    stats: dict[str, Any],
    printer_name: str | None,
    dither_enabled: bool = True,
    mode: str = "separate",
    report_settings: dict[str, Any] | None = None,
) -> str:
    if mode == "combined":
        return _print_image(
            render_combined_report(
                event,
                stats,
                report_settings=report_settings,
            ),
            printer_name,
            "report-combined",
            dither_enabled,
        )

    if os.name == "nt":
        image_job_id = _print_image(_base_canvas(event), printer_name, "ticket-art", dither_enabled)
        text_job_id = _print_image(
            render_report(event, stats, report_settings=report_settings),
            printer_name,
            "report",
            dither_enabled,
        )
    else:
        image_job_id = _print_image(_base_canvas(event), printer_name, "ticket-art", dither_enabled)
        text_lines = _wrap_fixed_width_lines(build_report_lines(event, stats), inner_width=20)
        text_job_id = _lp_print_text("\n".join(text_lines) + "\n", printer_name, "report")
    if text_job_id == image_job_id:
        return text_job_id
    return f"{image_job_id}, {text_job_id}"


def render_event_card(event: dict[str, Any]) -> Image.Image:
    image = Image.new("RGB", (1200, 500), (245, 236, 226))
    draw = ImageDraw.Draw(image)
    title_font = load_font(56, bold=True)
    body_font = load_font(28)
    small_font = load_font(22)

    draw.rounded_rectangle((24, 24, 1176, 476), radius=28, outline=(111, 27, 33), width=6)

    template_path = event.get("template_path")
    if template_path and Path(template_path).exists():
        # Use the uploaded ticket image as the visual identity for the card.
        frame_x1, frame_y1, frame_x2, frame_y2 = 64, 70, 484, 430
        tpl = Image.open(template_path).convert("RGB")
        tpl = _fit_within(tpl, frame_x2 - frame_x1, frame_y2 - frame_y1)
        image.paste(
            tpl,
            (
                frame_x1 + ((frame_x2 - frame_x1) - tpl.width) // 2,
                frame_y1 + ((frame_y2 - frame_y1) - tpl.height) // 2,
            ),
        )
        draw.rounded_rectangle((64, 70, 484, 430), radius=18, outline=(255, 255, 255), width=2)
    else:
        draw.rounded_rectangle((64, 70, 484, 430), radius=18, fill=(111, 27, 33))
        draw.text((112, 180), "Билет", fill=(255, 255, 255), font=title_font)

    draw.text((540, 90), event["title"], fill=(111, 27, 33), font=title_font)

    prices = event.get("prices", [])
    price_line = ", ".join(f"{item['label']} {item['amount_cents']:.0f} ₽" for item in prices[:4])
    draw.text((540, 300), price_line or "Нет ценовых вариантов", fill=(80, 70, 65), font=small_font)
    draw.text((540, 360), f"Продано: {event.get('sold_count', 0)}", fill=(80, 70, 65), font=small_font)

    return image


def event_card_to_png_bytes(event: dict[str, Any]) -> bytes:
    image = render_event_card(event)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
