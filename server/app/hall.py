from __future__ import annotations

from typing import Any


def build_hall_layout(rows_count: int = 20, seats_count: int = 20) -> list[dict[str, Any]]:
    rows_count = max(1, int(rows_count))
    seats_count = max(1, int(seats_count))
    rows: list[dict[str, Any]] = []
    for row_index in range(rows_count, 0, -1):
        seats: list[dict[str, Any]] = []
        for seat_number in range(seats_count, 0, -1):
            seats.append({"label": str(seat_number)})
        rows.append(
            {
                "label": str(row_index),
                "seats": seats,
            }
        )
    return rows


HALL_LAYOUT = build_hall_layout(20, 20)
