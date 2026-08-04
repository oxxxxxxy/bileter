from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


VALID_TEXT_ALIGNMENT = {"left", "center", "right"}


@dataclass(frozen=True, slots=True)
class TicketLayoutField:
    x: int
    y: int
    size: int
    align: str

    @classmethod
    def from_mapping(
        cls,
        data: Mapping[str, Any] | None,
        fallback: Mapping[str, Any],
    ) -> "TicketLayoutField":
        source = data or {}
        align_value = str(source.get("align", fallback["align"])).strip()
        align = align_value if align_value in VALID_TEXT_ALIGNMENT else str(fallback["align"])
        return cls(
            x=int(source.get("x", fallback["x"])),
            y=int(source.get("y", fallback["y"])),
            size=max(1, int(source.get("size", fallback["size"]))),
            align=align,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "x": self.x,
            "y": self.y,
            "size": self.size,
            "align": self.align,
        }


@dataclass(frozen=True, slots=True)
class ReportSettings:
    font_size: int

    @classmethod
    def from_mapping(
        cls,
        data: Mapping[str, Any] | None,
        default_font_size: int,
    ) -> "ReportSettings":
        source = data or {}
        return cls(font_size=max(12, int(source.get("font_size", default_font_size))))

    def to_dict(self) -> dict[str, int]:
        return {"font_size": self.font_size}
