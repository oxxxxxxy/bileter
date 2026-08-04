from server.app.models import ReportSettings, TicketLayoutField


def test_ticket_layout_field_uses_fallback_for_invalid_align() -> None:
    field = TicketLayoutField.from_mapping(
        {"x": "10", "y": "20", "size": "30", "align": "bad"},
        {"x": 1, "y": 2, "size": 3, "align": "left"},
    )
    assert field.to_dict() == {"x": 10, "y": 20, "size": 30, "align": "left"}


def test_ticket_layout_field_accepts_alignment_and_clamps_size() -> None:
    fallback = {"x": 1, "y": 2, "size": 3, "align": "left"}
    field = TicketLayoutField.from_mapping(
        {"x": 4, "y": 5, "size": 0, "align": " right "},
        fallback,
    )
    assert field.to_dict() == {"x": 4, "y": 5, "size": 1, "align": "right"}


def test_ticket_layout_field_uses_all_fallback_values() -> None:
    fallback = {"x": 1, "y": 2, "size": 3, "align": "center"}
    assert TicketLayoutField.from_mapping(None, fallback).to_dict() == fallback


def test_report_settings_clamps_font_size() -> None:
    settings = ReportSettings.from_mapping({"font_size": 1}, default_font_size=28)
    assert settings.to_dict() == {"font_size": 12}


def test_report_settings_uses_default_font_size() -> None:
    settings = ReportSettings.from_mapping(None, default_font_size=28)
    assert settings.to_dict() == {"font_size": 28}
