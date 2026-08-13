#!/usr/bin/env python3
"""Exercise language, chart, template, generation, and export runtimes."""

from __future__ import annotations

import base64
from pathlib import Path
import re
import shutil
import tempfile

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "packages"
    / "amphi-ai27-components"
    / "src"
    / "scriptReportRuntime.ts"
)


def encode(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def load_runtime() -> dict[str, object]:
    source = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded script/report runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), "scriptReportRuntime.ts", "exec"), namespace)
    return namespace


def run_script(
    runtime: dict[str, object],
    dataframe: pd.DataFrame,
    language: str,
    code: str,
    command: str,
):
    return runtime["run_amphi_script_program"](
        dataframe=dataframe,
        language=language,
        source_mode="inline",
        source_path_base64=encode(""),
        inline_code_base64=encode(code),
        arguments_base64=encode(""),
        command_base64=encode(command),
        artifact_directory_base64=encode(""),
        timeout_seconds=30,
    )


def main() -> int:
    runtime = load_runtime()
    source = pd.DataFrame(
        {
            "name": ["张三", "李四", "王五"],
            "score": [90, 80, 70],
        }
    )

    python_result, python_metrics = run_script(
        runtime,
        source,
        "python",
        'output = input.copy()\noutput["double_score"] = output["score"] * 2',
        "",
    )
    assert python_result["double_score"].tolist() == [180, 160, 140]
    assert python_metrics["language"] == "python"

    if shutil.which("node"):
        javascript_result, javascript_metrics = run_script(
            runtime,
            source,
            "javascript",
            """
output = input.map(row => Object.assign({}, row, {
  triple_score: Number(row.score) * 3
}));
""".strip(),
            "node",
        )
        assert javascript_result["triple_score"].tolist() == [270, 240, 210]
        assert javascript_metrics["language"] == "javascript"
    else:
        print("JavaScript runtime test skipped: node is not installed.")

    if shutil.which("Rscript"):
        r_result, r_metrics = run_script(
            runtime,
            source,
            "r",
            "output <- input\noutput$half_score <- output$score / 2",
            "Rscript",
        )
        assert r_result["half_score"].tolist() == [45, 40, 35]
        assert r_metrics["language"] == "r"
    else:
        try:
            run_script(
                runtime,
                source,
                "r",
                "output <- input",
                "amphi-missing-rscript",
            )
        except RuntimeError as error:
            assert "was not found" in str(error)
        else:
            raise AssertionError("Missing Rscript should produce a clear error.")
        print("R runtime execution skipped; missing-runtime diagnostics passed.")

    with tempfile.TemporaryDirectory(prefix="amphi-report-test-") as directory:
        root = Path(directory)
        chart_path = root / "score.svg"
        charted, chart_metrics = runtime["create_amphi_chart"](
            dataframe=source,
            chart_type="bar",
            x_column_base64=encode("name"),
            y_column_base64=encode("score"),
            title_base64=encode("学生成绩"),
            output_path_base64=encode(str(chart_path)),
            width=640,
            height=360,
        )
        assert chart_path.is_file()
        assert "<svg" in chart_path.read_text(encoding="utf-8")
        assert charted["amphi_chart_path"].eq(chart_metrics["chart_path"]).all()
        assert chart_metrics["points"] == 3

        template_path = root / "template.html"
        template_path.write_text(
            """
<h1>学生成绩报告</h1>
<p>人数：{{ metric:rows }}</p>
<p>平均分：{{ metric:平均分 }}</p>
<p>最高分：{{ calc:max:score }}</p>
{{ table:成绩表 }}
{{ chart:default }}
""".strip(),
            encoding="utf-8",
        )
        template = runtime["load_amphi_report_template"](
            template_path_base64=encode(str(template_path))
        )
        bindings = """
{
  "metrics": {"平均分": "mean:score"},
  "tables": {"成绩表": {"columns": ["name", "score"], "limit": 10}},
  "charts": {"default": "auto"}
}
""".strip()
        report, report_metrics = runtime["generate_amphi_report"](
            first_dataframe=charted,
            second_dataframe=template,
            bindings_base64=encode(bindings),
            suggested_name_base64=encode("student-report"),
        )
        rendered = base64.b64decode(
            report.iloc[0]["report_content_base64"]
        ).decode("utf-8")
        assert "人数：3" in rendered
        assert "平均分：80.0" in rendered
        assert "<table" in rendered
        assert "data:image/svg+xml;base64," in rendered
        assert report_metrics["report_format"] == "html"

        exported_path = root / "student-report.html"
        actual_path = runtime["export_amphi_report"](
            report_dataframe=report,
            output_path_base64=encode(str(exported_path)),
        )
        assert Path(actual_path).read_bytes() == base64.b64decode(
            report.iloc[0]["report_content_base64"]
        )

    print(
        "Script/report runtime test passed: Python, JavaScript, chart, "
        "template bindings, generation, and export."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
