#!/usr/bin/env python3
"""Render all 50 AI22 charts with a representative DataFrame."""

from __future__ import annotations

import base64
import json
from pathlib import Path
import re
import tempfile

import IPython.display
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SOURCE = ROOT / "packages" / "amphi-ai22-components" / "src"
RUNTIME_SOURCE = PACKAGE_SOURCE / "chartRuntime.ts"
CATALOG_SOURCE = PACKAGE_SOURCE / "chartCatalog.ts"


def encode(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def load_runtime() -> dict[str, object]:
    source = RUNTIME_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded AI22 chart runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), RUNTIME_SOURCE.name, "exec"), namespace)
    return namespace


def load_definitions() -> list[tuple[str, str, list[str]]]:
    source = CATALOG_SOURCE.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\['(?P<id>[^']+)',\s*'[^']+',\s*'(?P<renderer>[^']+)',"
        r"\s*'[^']*',\s*\[(?P<roles>[^\]]*)\],\s*'[^']+'\]"
    )
    definitions = []
    for match in pattern.finditer(source):
        roles = re.findall(r"'([^']+)'", match.group("roles"))
        definitions.append((match.group("id"), match.group("renderer"), roles))
    if len(definitions) != 50:
        raise AssertionError("Expected 50 chart definitions, found %s" % len(definitions))
    return definitions


def representative_data() -> pd.DataFrame:
    rows = 18
    return pd.DataFrame(
        {
            "category": ["A", "B", "C", "A", "B", "C"] * 3,
            "numeric_x": [float(index) for index in range(rows)],
            "value": [12, 18, 9, 16, 22, 11, 20, 25, 13, 24, 28, 17, 26, 30, 19, 32, 35, 21],
            "value_two": [8, 13, 15, 10, 16, 18, 12, 20, 21, 14, 23, 25, 17, 26, 28, 19, 29, 31],
            "size": [2, 5, 3, 7, 4, 8, 6, 9, 5, 10, 7, 11, 8, 12, 9, 13, 10, 14],
            "series": ["一组", "一组", "一组", "二组", "二组", "二组"] * 3,
            "label": ["北京", "上海", "广东", "浙江", "四川", "湖北"] * 3,
            "longitude": [116.4, 121.5, 113.3, 120.2, 104.1, 114.3] * 3,
            "latitude": [39.9, 31.2, 23.1, 30.3, 30.7, 30.6] * 3,
            "source": ["北京", "上海", "广东", "北京", "浙江", "四川"] * 3,
            "target": ["上海", "广东", "浙江", "四川", "湖北", "北京"] * 3,
            "start": pd.date_range("2026-01-01", periods=rows, freq="D"),
            "end": pd.date_range("2026-01-03", periods=rows, freq="D"),
            "time": pd.date_range("2026-01-01", periods=rows, freq="h"),
        }
    )


def roles_for(renderer: str, roles: list[str]) -> dict[str, object]:
    values: dict[str, object] = {
        "x": "category",
        "y": "value",
        "value": "value_two",
        "series": "series",
        "label": "label",
        "latitude": "latitude",
        "longitude": "longitude",
        "source": "source",
        "target": "target",
        "start": "start",
        "end": "end",
        "size": "size",
        "display": ["category", "value", "series"],
    }
    if renderer in ("scatter", "bubble"):
        values["x"] = "numeric_x"
    if renderer.startswith("time_") or renderer.startswith("realtime_"):
        values["x"] = "time"
    if renderer == "calendar_heatmap":
        values["x"] = "time"
    return {role: values[role] for role in roles}


def main() -> int:
    runtime = load_runtime()
    definitions = load_definitions()
    dataframe = representative_data()
    original_display = IPython.display.display
    IPython.display.display = lambda *_args, **_kwargs: None
    try:
        with tempfile.TemporaryDirectory(prefix="amphi-ai22-test-") as directory:
            root = Path(directory)
            for chart_id, renderer, roles in definitions:
                output_path = root / (chart_id + ".html")
                result, metrics = runtime["render_amphi_ai22_chart"](
                    dataframe=dataframe,
                    chart_type=renderer,
                    chart_id=chart_id,
                    column_roles_base64=encode(
                        json.dumps(
                            roles_for(renderer, roles),
                            ensure_ascii=False,
                        )
                    ),
                    title_base64=encode(chart_id),
                    output_path_base64=encode(str(output_path)),
                    aggregation="sum",
                    width=800,
                    height=480,
                    top_n=50,
                    refresh_seconds=1,
                    window_size=10,
                )
                assert output_path.is_file(), chart_id
                rendered = output_path.read_text(encoding="utf-8")
                assert "<!doctype html>" in rendered.lower(), chart_id
                assert "ai22_chart_path" in result.columns, chart_id
                assert metrics["chart_id"] == chart_id
                assert metrics["input_rows"] == len(dataframe)
    finally:
        IPython.display.display = original_display

    print(
        "AI22 runtime test passed: 50 self-contained charts in one unified "
        "sidebar category."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
