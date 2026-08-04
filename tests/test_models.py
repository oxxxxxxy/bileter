from server.app.models import ReportSettings, TicketLayoutField


def test_ticket_layout_field_uses_fallback_for_invalid_align() -> None:
    field = TicketLayoutField.from_mapping(
        {"x": "10", "y": "20", "size": "30", "align": "bad"},
        {"x": 1, "y": 2, "size": 3, "align": "left"},
    )
    assert field.to_dict() == {"x": 10, "y": 20, "size": 30, "align": "left"}


def test_report_settings_clamps_font_size() -> None:
    settings = ReportSettings.from_mapping({"font_size": 1}, default_font_size=28)
    assert settings.to_dict() == {"font_size": 12}
