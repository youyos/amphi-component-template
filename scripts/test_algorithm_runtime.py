#!/usr/bin/env python3
"""Run every zero-code algorithm against a representative DataFrame."""

from __future__ import annotations

from pathlib import Path
import re
import warnings

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "src" / "algorithmRuntime.ts"
CATALOG = ROOT / "src" / "algorithmCatalog.ts"


def load_runtime():
    source = RUNTIME.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded algorithm runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), str(RUNTIME), "exec"), namespace)
    return namespace["run_amphi_zero_code_algorithm"]


def ids_for(kind: str) -> list[str]:
    source = CATALOG.read_text(encoding="utf-8")
    block = re.search(
        rf"const {kind}:.*?= \[(?P<body>.*?)\]\.map",
        source,
        re.DOTALL,
    )
    if not block:
        raise RuntimeError("Catalog block was not found: %s" % kind)
    return re.findall(r"\['([^']+)'", block.group("body"))


def main() -> int:
    rng = np.random.default_rng(42)
    rows = 36
    base = pd.DataFrame(
        {
            "x1": np.r_[rng.normal(-2, 0.4, rows // 2), rng.normal(2, 0.4, rows // 2)],
            "x2": rng.normal(0, 1, rows),
            "category": ["甲", "乙", "丙"] * (rows // 3),
        }
    )
    base.loc[[2, 9], "x1"] = np.nan
    base["class_target"] = np.where(base["x2"] > 0, "正类", "负类")
    base.loc[[5, 17], "class_target"] = None
    base["reg_target"] = base["x2"] * 2.5 + rng.normal(0, 0.2, rows)
    base.loc[[4, 19], "reg_target"] = np.nan

    cases: list[tuple[str, str, pd.DataFrame, str, list[str], float]] = []
    cases.extend(
        (algorithm, "classification", base, "class_target", ["x1", "x2", "category"], 3)
        for algorithm in ids_for("classification")
    )
    cases.extend(
        (algorithm, "clustering", base, "", ["x1", "x2"], 3)
        for algorithm in ids_for("clustering")
    )
    cases.extend(
        (
            algorithm,
            "regression",
            base,
            "reg_target",
            ["x1"] if algorithm == "isotonicRegression" else ["x1", "x2", "category"],
            3,
        )
        for algorithm in ids_for("regression")
    )

    baskets = pd.DataFrame(
        {"items": ["牛奶,面包", "牛奶,鸡蛋", "面包,鸡蛋", "牛奶,面包,鸡蛋"] * 3}
    )
    cases.extend(
        (algorithm, "association", baskets, "items", [], 10)
        for algorithm in ids_for("association")
    )

    series = pd.DataFrame({"value": np.linspace(10, 30, 24) + np.sin(np.arange(24))})
    cases.extend(
        (algorithm, "timeseries", series, "value", [], 3)
        for algorithm in ids_for("timeseries")
    )

    evaluation = pd.DataFrame(
        {"quality": [80, 90, 70, 95], "cost": [60, 45, 75, 50], "service": [72, 88, 81, 93]}
    )
    cases.extend(
        (algorithm, "evaluation", evaluation, "", list(evaluation.columns), 3)
        for algorithm in ids_for("evaluation")
    )

    interactions = pd.DataFrame(
        {
            "user": ["u1", "u1", "u2", "u2", "u3", "u3"],
            "item": ["a", "b", "a", "c", "b", "c"],
            "rating": [5, 3, 4, 5, 4, 2],
        }
    )
    cases.extend(
        (algorithm, "recommendation", interactions, "user", ["item", "rating"], 2)
        for algorithm in ids_for("recommendation")
    )

    for algorithm in ids_for("ensemble"):
        if algorithm.endswith("Classifier"):
            cases.append(
                (algorithm, "ensemble", base, "class_target", ["x1", "x2", "category"], 3)
            )
        else:
            cases.append(
                (algorithm, "ensemble", base, "reg_target", ["x1", "x2", "category"], 3)
            )

    for algorithm in ids_for("deeplearning"):
        if algorithm == "lstmForecast":
            cases.append((algorithm, "deeplearning", series, "value", [], 3))
        elif algorithm.endswith("Classifier"):
            cases.append(
                (algorithm, "deeplearning", base, "class_target", ["x1", "x2"], 3)
            )
        else:
            cases.append(
                (algorithm, "deeplearning", base, "reg_target", ["x1", "x2"], 3)
            )

    text_data = pd.DataFrame(
        {
            "text": [
                "北京大学发布优秀 AI 课程",
                "这个产品很好，我非常喜欢",
                "服务很差，体验糟糕",
                "联系 test@example.com 或 13800138000",
                "上海公司在2026年7月28日发布报告",
                "机器学习课程内容丰富",
                "great product and excellent service",
                "bad experience and poor support",
            ] * 2,
            "text2": [
                "北京大学开设人工智能课程",
                "我喜欢这个优秀产品",
                "服务体验不好",
                "邮箱和电话联系方式",
                "公司发布年度报告",
                "课程介绍机器学习",
                "excellent product service",
                "terrible support experience",
            ] * 2,
            "label": ["教育", "正向", "负向", "联系", "新闻", "教育", "正向", "负向"] * 2,
        }
    )
    for algorithm in ids_for("text"):
        if algorithm == "textClassifier":
            cases.append((algorithm, "text", text_data, "label", ["text"], 3))
        elif algorithm == "textSimilarity":
            cases.append((algorithm, "text", text_data, "text", ["text2"], 3))
        else:
            cases.append((algorithm, "text", text_data, "text", [], 3))

    for algorithm in ids_for("autolearning"):
        if algorithm == "autoClustering":
            cases.append((algorithm, "autolearning", base, "", ["x1", "x2"], 3))
        elif algorithm == "oneClickModeling":
            cases.append((algorithm, "autolearning", base, "", [], 3))
        elif algorithm == "autoRegression":
            cases.append(
                (algorithm, "autolearning", base, "reg_target", ["x1", "x2", "category"], 3)
            )
        else:
            cases.append(
                (algorithm, "autolearning", base, "class_target", ["x1", "x2", "category"], 3)
            )

    run = load_runtime()
    failures: list[str] = []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for algorithm, kind, frame, target, features, parameter in cases:
            try:
                output, model, metrics = run(
                    frame,
                    algorithm,
                    kind,
                    target,
                    features,
                    "verified_output",
                    parameter,
                    42,
                )
                if len(output) != len(frame) or "verified_output" not in output:
                    raise AssertionError("Output DataFrame shape or column is invalid.")
                if model is None or metrics.get("algorithm") != algorithm:
                    raise AssertionError("Model or metrics output is invalid.")
            except Exception as error:
                failures.append("%s: %s" % (algorithm, error))

    if failures:
        print("Algorithm runtime test failed:")
        print("\n".join(failures))
        return 1
    print("Algorithm runtime test passed: %d component(s)." % len(cases))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
