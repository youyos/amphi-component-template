#!/usr/bin/env python3
"""Exercise all AI14 evaluation and model lifecycle runtime paths."""

from __future__ import annotations

import base64
from pathlib import Path
import re
import tempfile

import pandas as pd
from sklearn.linear_model import LogisticRegression


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "packages"
    / "amphi-ai14-components"
    / "src"
    / "modelEvaluationRuntime.ts"
)


def encode(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def load_runtime() -> dict[str, object]:
    source = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded AI14 runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), SOURCE.name, "exec"), namespace)
    return namespace


def evaluate(
    runtime: dict[str, object],
    dataframe: pd.DataFrame,
    method: str,
    prediction: str = "prediction",
    score: str = "score",
):
    return runtime["evaluate_amphi_ai14_model"](
        dataframe=dataframe,
        method=method,
        target_column_base64=encode("target"),
        prediction_column_base64=encode(prediction),
        score_column_base64=encode(score),
        positive_label_base64=encode("1"),
        model_name_base64=encode("candidate-a"),
        model_path_base64=encode("models/candidate-a.joblib"),
    )


def main() -> int:
    runtime = load_runtime()
    classification = pd.DataFrame(
        {
            "feature_a": [0.0, 0.2, 0.8, 1.0, 0.1, 0.9],
            "feature_b": [1.0, 0.8, 0.2, 0.0, 0.9, 0.1],
            "target": [0, 0, 1, 1, 0, 1],
            "prediction": [0, 0, 1, 1, 0, 1],
            "score": [0.05, 0.2, 0.8, 0.95, 0.1, 0.9],
        }
    )

    ks_result, ks_metrics = evaluate(runtime, classification, "ks")
    assert ks_metrics["metric_name"] == "ks_statistic"
    assert ks_result["is_best_threshold"].sum() == 1

    pr_result, pr_metrics = evaluate(runtime, classification, "pr")
    assert pr_metrics["metric_name"] == "average_precision"
    assert {"precision", "recall"}.issubset(pr_result.columns)

    roc_result, roc_metrics = evaluate(runtime, classification, "roc")
    assert roc_metrics["metric_name"] == "roc_auc"
    assert roc_metrics["metric_value"] == 1.0
    assert {"false_positive_rate", "true_positive_rate"}.issubset(
        roc_result.columns
    )

    classification_result, classification_metrics = evaluate(
        runtime, classification, "classification", score=""
    )
    assert classification_metrics["accuracy"] == 1.0
    assert classification_result.iloc[0]["metric_name"] == "f1_weighted"

    regression = pd.DataFrame(
        {
            "target": [1.0, 2.0, 3.0, 4.0],
            "prediction": [1.1, 1.9, 3.2, 3.8],
        }
    )
    regression_result, regression_metrics = evaluate(
        runtime, regression, "regression", score=""
    )
    assert regression_metrics["rmse"] > 0
    assert regression_result.iloc[0]["metric_name"] == "rmse"

    candidates = pd.DataFrame(
        {
            "model_name": ["candidate-a", "candidate-b"],
            "model_path": ["a.joblib", "b.joblib"],
            "metric_value": [0.9, 0.8],
        }
    )
    selected, selection_metrics = runtime["select_amphi_ai14_best_model"](
        dataframe=candidates,
        metric_column_base64=encode("metric_value"),
        model_column_base64=encode("model_name"),
        path_column_base64=encode("model_path"),
        direction="max",
    )
    assert selection_metrics["best_model"] == "candidate-a"
    assert selected.iloc[0]["is_best_model"]

    features = classification[["feature_a", "feature_b"]]
    model = LogisticRegression(random_state=42).fit(
        features, classification["target"]
    )
    runtime["trained_model"] = model

    with tempfile.TemporaryDirectory(prefix="amphi-ai14-test-") as directory:
        model_path = Path(directory) / "classifier.joblib"
        descriptor, export_metrics = runtime["export_amphi_ai14_model"](
            dataframe=classification,
            model_variable_base64=encode("trained_model"),
            output_path_base64=encode(str(model_path)),
            serialization_format="joblib",
        )
        assert model_path.is_file()
        assert len(export_metrics["amphi_model_sha256"]) == 64

        loaded_descriptor, read_metrics = runtime["read_amphi_ai14_model"](
            model_path_base64=encode(str(model_path)),
            registry_key_base64=encode("loaded-classifier"),
        )
        assert read_metrics["amphi_model_registry_key"] == "loaded-classifier"

        scored, use_metrics = runtime["use_amphi_ai14_model"](
            first_dataframe=features,
            second_dataframe=loaded_descriptor,
            feature_columns=[],
            output_column_base64=encode("model_prediction"),
            include_probability=True,
        )
        assert "model_prediction" in scored.columns
        assert "model_prediction_probability" in scored.columns
        assert use_metrics["rows"] == len(classification)

        rescored, _ = runtime["use_amphi_ai14_model"](
            first_dataframe=descriptor,
            second_dataframe=features,
            feature_columns=["feature_a", "feature_b"],
            output_column_base64=encode("model_prediction"),
            include_probability=False,
        )
        assert "model_prediction" in rescored.columns

    print(
        "AI14 runtime test passed: K-S, PR, ROC, classification, regression, "
        "best-model selection, model export, read, and use."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
