#!/usr/bin/env python3
"""Exercise every AI24 analytical calculation runtime path."""

from __future__ import annotations

import base64
import json
from pathlib import Path
import re
import tempfile

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SOURCE = ROOT / "packages" / "amphi-ai24-components" / "src"
RUNTIME_SOURCE = PACKAGE_SOURCE / "analysisRuntime.ts"
CATALOG_SOURCE = PACKAGE_SOURCE / "analysisCatalog.ts"


def encode(options: dict[str, object]) -> str:
    payload = json.dumps(options, ensure_ascii=False)
    return base64.b64encode(payload.encode("utf-8")).decode("ascii")


def load_runtime() -> dict[str, object]:
    source = RUNTIME_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded AI24 analysis runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), RUNTIME_SOURCE.name, "exec"), namespace)
    return namespace


def catalog_kinds() -> list[str]:
    source = CATALOG_SOURCE.read_text(encoding="utf-8")
    return re.findall(r"kind: '([^']+)'", source)


def representative_data() -> pd.DataFrame:
    rows = 36
    index = np.arange(rows, dtype=float)
    return pd.DataFrame(
        {
            "time": pd.date_range("2023-01-01", periods=rows, freq="MS"),
            "group": ["甲", "乙", "丙"] * 12,
            "value": 20.0 + index * 1.5 + np.sin(index) * 2.0,
            "value_two": 8.0 + index * 0.7,
            "text": [" Alpha ", "Beta", "Gamma"] * 12,
            "condition": [40, 60, 90] * 12,
        }
    )


def options_for(kind: str, report_path: Path) -> dict[str, object]:
    options: dict[str, object] = {
        "ai24ValueColumn": "value",
        "ai24TextColumn": "text",
        "ai24DateColumn": "time",
        "ai24ConditionColumn": "condition",
        "ai24OrderColumn": "time",
        "ai24TimeColumn": "time",
        "ai24XColumn": "value_two",
        "ai24YColumn": "value",
        "ai24GroupColumns": ["group"],
        "ai24FeatureColumns": ["value", "value_two", "condition"],
        "ai24MissingPolicy": "ignore",
        "ai24NumericOperation": "sqrt",
        "ai24Decimals": 2,
        "ai24Operand": 2,
        "ai24LowerBound": 0,
        "ai24UpperBound": 100,
        "ai24TextOperation": "contains",
        "ai24TextArgument": "a",
        "ai24TextReplacement": "X",
        "ai24DateOperation": "quarter",
        "ai24BaselineDate": "2023-01-01",
        "ai24ConditionOperator": "between",
        "ai24ConditionValue": 50,
        "ai24ConditionUpperValue": 80,
        "ai24TrueLabel": "命中",
        "ai24FalseLabel": "未命中",
        "ai24WindowOperation": "rolling_mean",
        "ai24WindowSize": 3,
        "ai24Ascending": "true",
        "ai24Frequency": "M",
        "ai24Aggregation": "sum",
        "ai24AlertRule": "gt",
        "ai24AlertThreshold": 50,
        "ai24AlertUpperThreshold": 100,
        "ai24WarningLevel": "高",
        "ai24WarningMessage": "指标过高",
        "ai24FormatType": "data_bar",
        "ai24TrueColor": "#ff4d4f",
        "ai24FalseColor": "#52c41a",
        "ai24FormatOutputPath": str(report_path),
        "ai24TrendMethod": "polynomial_2",
        "ai24ReferenceType": "quantile",
        "ai24ReferenceValue": 0,
        "ai24Quantile": 0.75,
        "ai24ForecastMethod": "exponential_smoothing",
        "ai24ForecastHorizon": 4,
        "ai24ForecastFrequency": "M",
        "ai24SmoothingAlpha": 0.4,
        "ai24ClusterCount": 3,
        "ai24Standardize": "true",
        "ai24RandomSeed": 42,
    }
    if kind == "aggregate_count":
        options["ai24ValueColumn"] = ""
    if kind == "period_over_period":
        options["ai24Frequency"] = "Q"
    return options


def main() -> int:
    runtime = load_runtime()
    kinds = catalog_kinds()
    if len(kinds) != 19 or len(set(kinds)) != 19:
        raise AssertionError("Expected 19 unique AI24 analysis kinds, found %s" % len(kinds))
    dataframe = representative_data()
    run = runtime["run_amphi_ai24_analysis"]

    with tempfile.TemporaryDirectory(prefix="amphi-ai24-test-") as directory:
        report_path = Path(directory) / "conditional-format.html"
        outputs: dict[str, tuple[pd.DataFrame, object, dict[str, object]]] = {}
        for kind in kinds:
            result, model, metrics = run(dataframe, kind, encode(options_for(kind, report_path)))
            assert isinstance(result, pd.DataFrame), kind
            assert not result.empty, kind
            assert metrics["analysis_id"] == kind, kind
            assert metrics["input_rows"] == len(dataframe), kind
            assert metrics["output_rows"] == len(result), kind
            outputs[kind] = (result, model, metrics)

        assert report_path.is_file()
        assert "<!doctype html>" in report_path.read_text(encoding="utf-8").lower()
        assert len(outputs["time_series_forecast"][0]) == len(dataframe) + 4
        assert outputs["trendline_fitting"][1] is not None
        assert outputs["time_series_forecast"][1] is not None
        assert outputs["cluster_analysis"][1] is not None
        assert outputs["year_over_year"][2]["comparable_periods"] > 0
        assert outputs["period_over_period"][2]["comparable_periods"] > 0
        assert outputs["alert_analysis"][2]["warning_rows"] > 0

        first_cluster = outputs["cluster_analysis"][0]["ai24_cluster_label"].tolist()
        second_cluster, _, _ = run(
            dataframe,
            "cluster_analysis",
            encode(options_for("cluster_analysis", report_path)),
        )
        assert first_cluster == second_cluster["ai24_cluster_label"].tolist()

        try:
            invalid = options_for("numeric_function", report_path)
            invalid["ai24ValueColumn"] = "missing"
            run(dataframe, "numeric_function", encode(invalid))
        except ValueError as error:
            assert "不存在" in str(error)
        else:
            raise AssertionError("Missing-column validation did not fail.")

    print("AI24 runtime test passed: 19 analytical components in one sidebar category.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
