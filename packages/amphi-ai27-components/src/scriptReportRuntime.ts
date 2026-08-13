export const scriptReportRuntime = String.raw`
import base64
from io import BytesIO
import html
import json
import math
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid

import pandas as pd


_AMPHI_NODE_RUNNER_BASE64 = "Y29uc3QgZnMgPSByZXF1aXJlKCJmcyIpOwooYXN5bmMgZnVuY3Rpb24gKCkgewogIGNvbnN0IGlucHV0ID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocHJvY2Vzcy5hcmd2WzFdLCAidXRmOCIpKTsKICBsZXQgb3V0cHV0ID0gaW5wdXQubWFwKGZ1bmN0aW9uIChyb3cpIHsgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHJvdyk7IH0pOwogIGNvbnN0IGFyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoNCk7CiAgY29uc3Qgc291cmNlID0gZnMucmVhZEZpbGVTeW5jKHByb2Nlc3MuYXJndlszXSwgInV0ZjgiKTsKICBjb25zdCBleGVjdXRlID0gbmV3IEZ1bmN0aW9uKCJpbnB1dCIsICJvdXRwdXQiLCAiYXJncyIsICJyZXF1aXJlIiwgImNvbnNvbGUiLCBzb3VyY2UgKyAiXG47IHJldHVybiBvdXRwdXQ7Iik7CiAgb3V0cHV0ID0gYXdhaXQgZXhlY3V0ZShpbnB1dCwgb3V0cHV0LCBhcmdzLCByZXF1aXJlLCBjb25zb2xlKTsKICBpZiAoIUFycmF5LmlzQXJyYXkob3V0cHV0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcigiSmF2YVNjcmlwdCBvdXRwdXQgbXVzdCBiZSBhbiBhcnJheSBvZiBvYmplY3RzLiIpOwogIGZzLndyaXRlRmlsZVN5bmMocHJvY2Vzcy5hcmd2WzJdLCBKU09OLnN0cmluZ2lmeShvdXRwdXQpLCAidXRmOCIpOwp9KSgpLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikgewogIGNvbnNvbGUuZXJyb3IoZXJyb3IgJiYgZXJyb3Iuc3RhY2sgPyBlcnJvci5zdGFjayA6IFN0cmluZyhlcnJvcikpOwogIHByb2Nlc3MuZXhpdCgxKTsKfSk7Cg=="


def _amphi_sr_decode(value):
    try:
        return base64.b64decode(str(value or "").encode("ascii")).decode("utf-8")
    except Exception as error:
        raise ValueError("Component configuration contains invalid UTF-8 encoding.") from error


def _amphi_sr_path(value, must_exist=False, file_only=False):
    raw = str(value or "").strip()
    if not raw:
        if must_exist:
            raise ValueError("A file path is required.")
        return None
    path = Path(raw).expanduser()
    candidates = [path]
    if path.is_absolute():
        candidates.append(Path.cwd() / raw.lstrip("/\\"))
    else:
        candidates.append(Path.cwd() / path)
    if must_exist:
        for candidate in candidates:
            if file_only and candidate.is_file():
                return candidate.resolve()
            if not file_only and candidate.exists():
                return candidate.resolve()
        raise FileNotFoundError("File does not exist: %s" % raw)
    if path.is_absolute() and not path.parent.exists():
        jupyter_path = Path.cwd() / raw.lstrip("/\\")
        if jupyter_path.parent.exists():
            path = jupyter_path
    elif not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def _amphi_sr_executable(command, default_name):
    value = str(command or "").strip() or default_name
    if os.path.sep in value:
        path = Path(value).expanduser()
        if not path.is_file():
            raise FileNotFoundError("Executable does not exist: %s" % value)
        return str(path.absolute())
    resolved = shutil.which(value)
    if not resolved:
        raise RuntimeError(
            "%s was not found. Install its runtime and make it available on PATH."
            % value
        )
    return resolved


def _amphi_sr_process(command, cwd, timeout_seconds, label):
    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise TimeoutError(
            "%s timed out after %s seconds." % (label, timeout_seconds)
        ) from error
    if completed.returncode != 0:
        details = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            "%s failed with exit code %s.\n%s"
            % (label, completed.returncode, details)
        )
    if completed.stdout.strip():
        print("[%s stdout]\n%s" % (label, completed.stdout.rstrip()))
    if completed.stderr.strip():
        print("[%s stderr]\n%s" % (label, completed.stderr.rstrip()))
    return completed


def _amphi_sr_source(source_mode, source_path, inline_code, work_directory, suffix):
    if source_mode == "file":
        return _amphi_sr_path(source_path, must_exist=True, file_only=True)
    if not str(inline_code or "").strip():
        raise ValueError("Inline source code cannot be empty.")
    path = work_directory / ("program.%s" % suffix)
    path.write_text(inline_code, encoding="utf-8")
    return path


def _amphi_sr_save_artifacts(
    artifact_directory,
    language,
    source_path,
    input_path,
    output_path,
    completed,
):
    if artifact_directory is None:
        return None
    artifact_directory.mkdir(parents=True, exist_ok=True)
    target = artifact_directory / (
        "%s-run-%s" % (language, uuid.uuid4().hex[:12])
    )
    target.mkdir(parents=True, exist_ok=False)
    shutil.copy2(source_path, target / source_path.name)
    shutil.copy2(input_path, target / input_path.name)
    if output_path.is_file():
        shutil.copy2(output_path, target / output_path.name)
    log_data = dict(
        command=completed.args,
        exit_code=int(completed.returncode),
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
    (target / "execution.json").write_text(
        json.dumps(log_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target


def run_amphi_script_program(
    dataframe,
    language,
    source_mode="inline",
    source_path_base64="",
    inline_code_base64="",
    arguments_base64="",
    command_base64="",
    artifact_directory_base64="",
    timeout_seconds=30,
):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Script component input must be a pandas DataFrame.")
    if language not in ("python", "r", "javascript"):
        raise ValueError("Unsupported script language: %s" % language)

    source_path_text = _amphi_sr_decode(source_path_base64)
    inline_code = _amphi_sr_decode(inline_code_base64)
    arguments_text = _amphi_sr_decode(arguments_base64)
    configured_command = _amphi_sr_decode(command_base64)
    artifact_text = _amphi_sr_decode(artifact_directory_base64)
    artifact_directory = (
        _amphi_sr_path(artifact_text) if artifact_text.strip() else None
    )
    timeout_value = max(1, min(600, int(timeout_seconds or 30)))
    try:
        user_arguments = shlex.split(arguments_text, posix=os.name != "nt")
    except ValueError as error:
        raise ValueError("Invalid script arguments: %s" % error) from error

    defaults = dict(python=sys.executable, r="Rscript", javascript="node")
    suffixes = dict(python="py", r="R", javascript="js")
    executable = _amphi_sr_executable(
        configured_command, defaults[language]
    )

    with tempfile.TemporaryDirectory(prefix="amphi-script-") as temporary:
        work_directory = Path(temporary)
        source_path = _amphi_sr_source(
            source_mode,
            source_path_text,
            inline_code,
            work_directory,
            suffixes[language],
        )
        if language == "javascript":
            input_path = work_directory / "input.json"
            output_path = work_directory / "output.json"
            input_path.write_text(
                dataframe.to_json(orient="records", force_ascii=False),
                encoding="utf-8",
            )
            runner = base64.b64decode(_AMPHI_NODE_RUNNER_BASE64).decode("utf-8")
            command = [
                executable,
                "-e",
                runner,
                str(input_path),
                str(output_path),
                str(source_path),
            ] + user_arguments
        elif language == "r":
            input_path = work_directory / "input.csv"
            output_path = work_directory / "output.csv"
            dataframe.to_csv(input_path, index=False)
            runner_path = work_directory / "runner.R"
            runner_path.write_text(
                "\n".join(
                    [
                        "args <- commandArgs(trailingOnly=TRUE)",
                        "input <- read.csv(args[[1]], check.names=FALSE, fileEncoding='UTF-8')",
                        "output <- input",
                        "amphi_args <- if (length(args) > 3) args[4:length(args)] else character(0)",
                        "sys.source(args[[3]], envir=environment())",
                        "if (!is.data.frame(output)) stop('R output must be a data.frame.')",
                        "write.csv(output, args[[2]], row.names=FALSE, fileEncoding='UTF-8')",
                    ]
                ),
                encoding="utf-8",
            )
            command = [
                executable,
                str(runner_path),
                str(input_path),
                str(output_path),
                str(source_path),
            ] + user_arguments
        else:
            input_path = work_directory / "input.csv"
            output_path = work_directory / "output.csv"
            dataframe.to_csv(input_path, index=False)
            runner = "\n".join(
                [
                    "import pandas as pd, sys",
                    "input = pd.read_csv(sys.argv[1])",
                    "output = input.copy()",
                    "arguments = sys.argv[4:]",
                    "namespace = dict(input=input, output=output, arguments=arguments)",
                    "source_path = sys.argv[3]",
                    "source = open(source_path, encoding='utf-8').read()",
                    "exec(compile(source, source_path, 'exec'), namespace)",
                    "output = namespace.get('output')",
                    "if not isinstance(output, pd.DataFrame): raise TypeError('Python output must be a pandas DataFrame.')",
                    "output.to_csv(sys.argv[2], index=False)",
                ]
            )
            command = [
                executable,
                "-c",
                runner,
                str(input_path),
                str(output_path),
                str(source_path),
            ] + user_arguments

        completed = _amphi_sr_process(
            command, source_path.parent, timeout_value, language
        )
        if not output_path.is_file():
            raise RuntimeError("%s script did not create its output file." % language)
        if language == "javascript":
            records = json.loads(output_path.read_text(encoding="utf-8"))
            result = pd.DataFrame(records)
        else:
            result = pd.read_csv(output_path)
        persisted = _amphi_sr_save_artifacts(
            artifact_directory,
            language,
            source_path,
            input_path,
            output_path,
            completed,
        )
        metrics = dict(
            language=language,
            input_rows=int(len(dataframe)),
            output_rows=int(len(result)),
            exit_code=int(completed.returncode),
            stdout=completed.stdout,
            stderr=completed.stderr,
            artifact_directory=str(persisted) if persisted else None,
        )
        return result, metrics


def _amphi_chart_values(dataframe, x_column, y_column):
    if x_column not in dataframe.columns:
        raise ValueError("Chart X column does not exist: %s" % x_column)
    if y_column not in dataframe.columns:
        raise ValueError("Chart Y column does not exist: %s" % y_column)
    values = pd.to_numeric(dataframe[y_column], errors="coerce")
    valid = values.notna()
    labels = dataframe.loc[valid, x_column].astype(str).tolist()
    numeric = values.loc[valid].astype(float).tolist()
    if not numeric:
        raise ValueError("Chart Y column has no numeric values.")
    return labels, numeric


def _amphi_chart_scale(values, top, bottom):
    minimum = min(values)
    maximum = max(values)
    if math.isclose(minimum, maximum):
        return [float((top + bottom) / 2) for _value in values]
    return [
        bottom - ((value - minimum) / (maximum - minimum)) * (bottom - top)
        for value in values
    ]


def create_amphi_chart(
    dataframe,
    chart_type,
    x_column_base64,
    y_column_base64,
    title_base64,
    output_path_base64,
    width=800,
    height=480,
):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Chart component input must be a pandas DataFrame.")
    x_column = _amphi_sr_decode(x_column_base64)
    y_column = _amphi_sr_decode(y_column_base64)
    title = _amphi_sr_decode(title_base64) or "数据图表"
    output_path = _amphi_sr_path(_amphi_sr_decode(output_path_base64))
    if output_path is None:
        raise ValueError("Chart output path is required.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    labels, values = _amphi_chart_values(dataframe, x_column, y_column)
    chart_kind = chart_type if chart_type in ("bar", "line", "scatter", "pie") else "bar"
    width_value = max(320, min(2400, int(width)))
    height_value = max(240, min(1600, int(height)))
    left, right, top, bottom = 70, width_value - 30, 60, height_value - 70
    plot_width = max(1, right - left)
    plot_height = max(1, bottom - top)
    colors = ["#1677ff", "#13a8a8", "#722ed1", "#fa8c16", "#eb2f96", "#52c41a"]
    elements = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 %s %s">'
        % (width_value, height_value, width_value, height_value),
        '<rect width="100%" height="100%" fill="white"/>',
        '<text x="%s" y="30" text-anchor="middle" font-size="20" fill="#1f2937">%s</text>'
        % (width_value / 2, html.escape(title)),
    ]
    if chart_kind == "pie":
        total = sum(abs(value) for value in values)
        if math.isclose(total, 0.0):
            raise ValueError("Pie chart values cannot all be zero.")
        offset = 0.0
        radius = min(plot_width, plot_height) * 0.3
        circumference = 2 * math.pi * radius
        for index, value in enumerate(values):
            fraction = abs(value) / total
            dash = circumference * fraction
            gap = circumference - dash
            elements.append(
                '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="%s %s" stroke-dashoffset="%s" transform="rotate(-90 %s %s)"/>'
                % (
                    width_value / 2,
                    (top + bottom) / 2,
                    radius,
                    colors[index % len(colors)],
                    radius,
                    dash,
                    gap,
                    -offset,
                    width_value / 2,
                    (top + bottom) / 2,
                )
            )
            offset += dash
    else:
        elements.extend(
            [
                '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#64748b"/>'
                % (left, bottom, right, bottom),
                '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#64748b"/>'
                % (left, top, left, bottom),
            ]
        )
        count = len(values)
        x_positions = [
            left + (index + 0.5) * plot_width / count for index in range(count)
        ]
        y_positions = _amphi_chart_scale(values, top, bottom)
        if chart_kind == "bar":
            bar_width = max(2, plot_width / count * 0.65)
            for index, (x_value, y_value) in enumerate(
                zip(x_positions, y_positions)
            ):
                elements.append(
                    '<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
                    % (
                        x_value - bar_width / 2,
                        y_value,
                        bar_width,
                        bottom - y_value,
                        colors[index % len(colors)],
                    )
                )
        else:
            if chart_kind == "line":
                points = " ".join(
                    "%s,%s" % pair for pair in zip(x_positions, y_positions)
                )
                elements.append(
                    '<polyline points="%s" fill="none" stroke="#1677ff" stroke-width="3"/>'
                    % points
                )
            for x_value, y_value in zip(x_positions, y_positions):
                elements.append(
                    '<circle cx="%s" cy="%s" r="4" fill="#1677ff"/>'
                    % (x_value, y_value)
                )
        label_step = max(1, int(math.ceil(len(labels) / 12)))
        for index, (label, x_value) in enumerate(zip(labels, x_positions)):
            if index % label_step == 0:
                elements.append(
                    '<text x="%s" y="%s" text-anchor="middle" font-size="11" fill="#475569">%s</text>'
                    % (x_value, bottom + 20, html.escape(label[:16]))
                )
    elements.append("</svg>")
    output_path.write_text("\n".join(elements), encoding="utf-8")
    result = dataframe.copy()
    output_column = "amphi_chart_path"
    if output_column in result.columns:
        raise ValueError("Chart output column already exists: %s" % output_column)
    result[output_column] = str(output_path)
    try:
        from IPython.display import SVG, display
        display(SVG(filename=str(output_path)))
    except Exception:
        pass
    metrics = dict(
        chart_type=chart_kind,
        chart_path=str(output_path),
        points=int(len(values)),
        x_column=x_column,
        y_column=y_column,
    )
    return result, metrics


def load_amphi_report_template(template_path_base64):
    path = _amphi_sr_path(
        _amphi_sr_decode(template_path_base64),
        must_exist=True,
        file_only=True,
    )
    suffix = path.suffix.lower()
    formats = dict(
        md="markdown",
        markdown="markdown",
        html="html",
        htm="html",
        docx="docx",
    )
    template_format = formats.get(suffix.lstrip("."))
    if not template_format:
        raise ValueError("Template must be Markdown, HTML, or DOCX.")
    content = base64.b64encode(path.read_bytes()).decode("ascii")
    return pd.DataFrame(
        [
            dict(
                template_path=str(path),
                template_name=path.name,
                template_format=template_format,
                template_content_base64=content,
            )
        ]
    )


def _amphi_report_inputs(first_dataframe, second_dataframe):
    marker = "template_content_base64"
    if marker in first_dataframe.columns:
        return second_dataframe.copy(), first_dataframe
    if marker in second_dataframe.columns:
        return first_dataframe.copy(), second_dataframe
    raise ValueError("Connect one data input and one Document Template Input.")


def _amphi_report_calculate(dataframe, rule):
    parts = str(rule or "").split(":", 1)
    operation = parts[0].strip().lower()
    column = parts[1].strip() if len(parts) > 1 else "*"
    if operation == "count":
        return int(len(dataframe)) if column == "*" else int(dataframe[column].count())
    if column not in dataframe.columns:
        raise ValueError("Report calculation column does not exist: %s" % column)
    values = pd.to_numeric(dataframe[column], errors="coerce")
    operations = dict(
        mean=values.mean,
        sum=values.sum,
        min=values.min,
        max=values.max,
        median=values.median,
        nunique=values.nunique,
    )
    function = operations.get(operation)
    if function is None:
        raise ValueError("Unsupported report calculation: %s" % operation)
    value = function()
    if pd.isna(value):
        return ""
    if hasattr(value, "item"):
        return value.item()
    return value


def _amphi_markdown_table(dataframe):
    columns = [str(column) for column in dataframe.columns]
    header = "| " + " | ".join(columns) + " |"
    divider = "| " + " | ".join(["---"] * len(columns)) + " |"
    rows = []
    for values in dataframe.fillna("").astype(str).itertuples(index=False, name=None):
        rows.append(
            "| "
            + " | ".join(value.replace("|", "\\|") for value in values)
            + " |"
        )
    return "\n".join([header, divider] + rows)


def _amphi_report_chart(path_value, output_format):
    path = _amphi_sr_path(path_value, must_exist=True, file_only=True)
    if output_format == "html":
        mime = "image/svg+xml" if path.suffix.lower() == ".svg" else "image/png"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return '<img src="data:%s;base64,%s" alt="%s"/>' % (
            mime,
            encoded,
            html.escape(path.stem),
        )
    return "![%s](%s)" % (path.stem, str(path))


def _amphi_report_replace_text(template, dataframe, bindings, output_format):
    metrics = bindings.get("metrics", dict())
    tables = bindings.get("tables", dict())
    charts = bindings.get("charts", dict())
    builtin_metrics = dict(rows=int(len(dataframe)), columns=int(len(dataframe.columns)))

    def replace_calc(match):
        return str(_amphi_report_calculate(dataframe, match.group(1).strip()))

    def replace_metric(match):
        name = match.group(1).strip()
        if name in builtin_metrics:
            return str(builtin_metrics[name])
        if name not in metrics:
            raise ValueError("Report metric binding does not exist: %s" % name)
        return str(_amphi_report_calculate(dataframe, metrics[name]))

    def replace_table(match):
        name = match.group(1).strip()
        definition = tables.get(name)
        if definition is None:
            if name != "all":
                raise ValueError("Report table binding does not exist: %s" % name)
            definition = dict()
        if isinstance(definition, list):
            definition = dict(columns=definition)
        columns = definition.get("columns") or list(dataframe.columns)
        missing = [column for column in columns if column not in dataframe.columns]
        if missing:
            raise ValueError("Report table columns do not exist: %s" % missing)
        limit = max(1, min(1000, int(definition.get("limit", 50))))
        selected = dataframe[columns].head(limit)
        return (
            selected.to_html(index=False, escape=True)
            if output_format == "html"
            else _amphi_markdown_table(selected)
        )

    def replace_chart(match):
        name = match.group(1).strip()
        path_value = charts.get(name)
        if path_value == "auto" or (path_value is None and name == "default"):
            if "amphi_chart_path" not in dataframe.columns or dataframe.empty:
                raise ValueError("No chart path is available for report binding.")
            path_value = dataframe["amphi_chart_path"].iloc[0]
        if not path_value:
            raise ValueError("Report chart binding does not exist: %s" % name)
        return _amphi_report_chart(path_value, output_format)

    result = re.sub(r"\{\{\s*calc:([^}]+)\}\}", replace_calc, template)
    result = re.sub(r"\{\{\s*metric:([^}]+)\}\}", replace_metric, result)
    result = re.sub(r"\{\{\s*table:([^}]+)\}\}", replace_table, result)
    result = re.sub(r"\{\{\s*chart:([^}]+)\}\}", replace_chart, result)
    return result


def _amphi_report_docx(content, dataframe, bindings):
    try:
        from docx import Document
    except ImportError as error:
        raise RuntimeError(
            "DOCX report generation requires python-docx. Install python-docx>=1.1,<2."
        ) from error
    document = Document(BytesIO(content))
    for paragraph in document.paragraphs:
        original = paragraph.text
        replaced = _amphi_report_replace_text(
            original, dataframe, bindings, "markdown"
        )
        if replaced != original:
            paragraph.text = replaced
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                original = cell.text
                replaced = _amphi_report_replace_text(
                    original, dataframe, bindings, "markdown"
                )
                if replaced != original:
                    cell.text = replaced
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def generate_amphi_report(
    first_dataframe,
    second_dataframe,
    bindings_base64,
    suggested_name_base64,
):
    if not isinstance(first_dataframe, pd.DataFrame) or not isinstance(
        second_dataframe, pd.DataFrame
    ):
        raise TypeError("Report generator requires two pandas DataFrames.")
    dataframe, template_dataframe = _amphi_report_inputs(
        first_dataframe, second_dataframe
    )
    if template_dataframe.empty:
        raise ValueError("Template input is empty.")
    row = template_dataframe.iloc[0]
    template_format = str(row["template_format"])
    content = base64.b64decode(str(row["template_content_base64"]))
    bindings_text = _amphi_sr_decode(bindings_base64).strip() or base64.b64decode(
        "e30="
    ).decode("ascii")
    try:
        bindings = json.loads(bindings_text)
    except json.JSONDecodeError as error:
        raise ValueError("Report bindings must be valid JSON: %s" % error) from error
    if not isinstance(bindings, dict):
        raise ValueError("Report bindings must be a JSON object.")
    if template_format == "docx":
        rendered = _amphi_report_docx(content, dataframe, bindings)
    else:
        template_text = content.decode("utf-8")
        rendered_text = _amphi_report_replace_text(
            template_text, dataframe, bindings, template_format
        )
        rendered = rendered_text.encode("utf-8")
    suggested_name = _amphi_sr_decode(suggested_name_base64).strip() or "student-report"
    extension = dict(markdown=".md", html=".html", docx=".docx")[template_format]
    if not suggested_name.lower().endswith(extension):
        suggested_name += extension
    result = pd.DataFrame(
        [
            dict(
                report_name=suggested_name,
                report_format=template_format,
                report_content_base64=base64.b64encode(rendered).decode("ascii"),
                source_rows=int(len(dataframe)),
            )
        ]
    )
    metrics = dict(
        report_name=suggested_name,
        report_format=template_format,
        source_rows=int(len(dataframe)),
        bytes=int(len(rendered)),
    )
    return result, metrics


def export_amphi_report(report_dataframe, output_path_base64):
    if not isinstance(report_dataframe, pd.DataFrame):
        raise TypeError("Report export input must be a pandas DataFrame.")
    required = ["report_name", "report_format", "report_content_base64"]
    missing = [column for column in required if column not in report_dataframe.columns]
    if missing or report_dataframe.empty:
        raise ValueError("Input is not a generated report: %s" % missing)
    output_path = _amphi_sr_path(_amphi_sr_decode(output_path_base64))
    if output_path is None:
        raise ValueError("Report output path is required.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = base64.b64decode(
        str(report_dataframe.iloc[0]["report_content_base64"])
    )
    output_path.write_bytes(content)
    print("Report exported to: %s" % output_path)
    return str(output_path)
`;
