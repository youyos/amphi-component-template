#!/usr/bin/env python3
"""Verify representative generated-component behavior from a real CSV file."""

from __future__ import annotations

from pathlib import Path
import re
import tempfile
import warnings

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]


def load_runtime():
    source = (ROOT / "src" / "algorithmRuntime.ts").read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), "algorithmRuntime.ts", "exec"), namespace)
    return namespace["run_amphi_zero_code_algorithm"]


def main() -> int:
    rng = np.random.default_rng(42)
    source = pd.DataFrame(
        {
            "age": [22, 25, 31, 37, 44, 48, 53, 58, 29, 41, 35, 50],
            "income": [4.2, 5.1, np.nan, 8.4, 9.8, 10.2, 12.1, 13.4, 6.3, 8.9, 7.5, 11.2],
            "city": ["北京", "上海", "深圳"] * 4,
            "converted": ["否", "否", "否", "是", "是", "是", "是", "是", "否", "是", np.nan, np.nan],
            "review": [
                "服务很好，非常满意", "体验不错，推荐", "产品优秀", "服务很差",
                "非常喜欢", "good service", "糟糕的体验", "great product",
                "总体满意", "服务成功解决问题", "bad support", "非常开心"
            ],
        }
    )
    source["value"] = source["age"] * 1.7 + rng.normal(0, 1, len(source))
    source.loc[[3, 10], "value"] = np.nan

    with tempfile.TemporaryDirectory(prefix="amphi-ml-csv-") as directory:
        path = Path(directory) / "customers.csv"
        source.to_csv(path, index=False)
        dataframe = pd.read_csv(path)
        run = load_runtime()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            classified, classifier, classification_metrics = run(
                dataframe,
                "randomForestClassifier",
                "classification",
                "converted",
                ["age", "income", "city"],
                "predicted_conversion",
                3,
                42,
            )
            regressed, regressor, regression_metrics = run(
                dataframe,
                "gradientBoostingRegression",
                "regression",
                "value",
                ["age", "income", "city"],
                "predicted_value",
                3,
                42,
            )
            bagged, bagging_model, bagging_metrics = run(
                dataframe,
                "baggingClassifier",
                "ensemble",
                "converted",
                ["age", "income", "city"],
                "bagging_prediction",
                {"nEstimators": 20, "maxSamples": 0.8, "maxFeatures": 1},
                42,
            )
            sentiment, sentiment_model, sentiment_metrics = run(
                dataframe,
                "sentimentAnalysis",
                "text",
                "review",
                [],
                "sentiment_label",
                {"neutralThreshold": 0},
                42,
            )
            automatic, automatic_model, automatic_metrics = run(
                dataframe,
                "autoClassification",
                "autolearning",
                "converted",
                ["age", "income", "city"],
                "automatic_prediction",
                {"testSize": 0.2},
                42,
            )

    assert classified["predicted_conversion"].notna().all()
    assert regressed["predicted_value"].notna().all()
    assert classifier is not None and regressor is not None
    assert bagged["bagging_prediction"].notna().all()
    assert sentiment["sentiment_label"].isin(["正向", "中性", "负向"]).all()
    assert automatic["automatic_prediction"].notna().all()
    assert bagging_model is not None and sentiment_model is not None
    assert automatic_model is not None
    assert bagging_metrics["algorithm"] == "baggingClassifier"
    assert sentiment_metrics["algorithm"] == "sentimentAnalysis"
    assert automatic_metrics["selected_algorithm"]
    assert classification_metrics["scoring_rows"] == 2
    assert regression_metrics["scoring_rows"] == 2
    print(
        "CSV pipeline test passed: %d rows, classification accuracy %.3f, regression RMSE %.3f."
        % (
            len(source),
            classification_metrics["training_accuracy"],
            regression_metrics["rmse"],
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
