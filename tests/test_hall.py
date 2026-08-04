from server.app.hall import build_hall_layout


def test_build_hall_layout_defaults_to_descending_rows_and_seats() -> None:
    layout = build_hall_layout(2, 3)
    assert layout == [
        {"label": "2", "seats": [{"label": "3"}, {"label": "2"}, {"label": "1"}]},
        {"label": "1", "seats": [{"label": "3"}, {"label": "2"}, {"label": "1"}]},
    ]


def test_build_hall_layout_clamps_values_to_at_least_one() -> None:
    layout = build_hall_layout(0, 0)
    assert layout == [{"label": "1", "seats": [{"label": "1"}]}]
