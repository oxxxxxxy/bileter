from server.app.repository import parse_inactive_seats, parse_prices, parse_report_settings, parse_ticket_layout, report_settings_to_json, ticket_layout_to_json


def test_parse_prices_skips_empty_labels_and_normalizes_amounts() -> None:
    prices = parse_prices('[{"label":" Полная ","amount":"200.4"},{"label":"","amount":100},{"label":"Льготная","amount_cents":100}]')
    assert prices == [
        {"label": "Полная", "amount_cents": 200, "sort_order": 0},
        {"label": "Льготная", "amount_cents": 100, "sort_order": 1},
    ]


def test_parse_ticket_layout_and_json_roundtrip() -> None:
    layout = parse_ticket_layout('{"price":{"x":10,"y":20,"size":30,"align":"center"}}')
    assert layout["price"]["x"] == 10
    assert layout["price"]["align"] == "center"
    serialized = ticket_layout_to_json(layout)
    assert '"align": "center"' in serialized or '"align":"center"' in serialized


def test_parse_inactive_seats_and_report_settings() -> None:
    inactive = parse_inactive_seats('[{"row_label":"1","seat_label":"2"},{"row_label":"3","seat_label":"4"}]')
    assert inactive == {("1", "2"), ("3", "4")}

    settings = parse_report_settings('{"font_size": 40}')
    assert settings == {"font_size": 40}
    assert report_settings_to_json(settings).startswith("{")
