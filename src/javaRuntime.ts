export const javaRuntime = String.raw`
import base64
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile
import uuid

import pandas as pd


def _amphi_java_decode(value):
    try:
        return base64.b64decode(str(value or "").encode("ascii")).decode("utf-8")
    except Exception as error:
        raise ValueError("Java component configuration contains invalid text encoding.") from error


def _amphi_java_existing_file(value):
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Select a Java source file or switch to inline-code mode.")
    path = Path(raw).expanduser()
    candidates = [path]
    if path.is_absolute():
        candidates.append(Path.cwd() / raw.lstrip("/\\"))
    else:
        candidates.append(Path.cwd() / path)
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise FileNotFoundError("Java source file does not exist: %s" % raw)


def _amphi_java_directory(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    if path.is_absolute() and not path.exists():
        jupyter_path = Path.cwd() / raw.lstrip("/\\")
        if jupyter_path.parent.exists():
            path = jupyter_path
    elif not path.is_absolute():
        path = Path.cwd() / path
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _amphi_java_executable(value, label):
    command = str(value or "").strip()
    if not command:
        command = label
    if os.path.sep in command:
        path = Path(command).expanduser()
        if not path.is_file():
            raise FileNotFoundError("%s executable does not exist: %s" % (label, command))
        return str(path.resolve())
    resolved = shutil.which(command)
    if not resolved:
        raise RuntimeError(
            "%s was not found. Install a JDK and ensure %s is available on PATH."
            % (label, command)
        )
    return resolved


def _amphi_java_main_class(source_code, source_path, configured):
    configured_name = str(configured or "").strip()
    package_match = re.search(
        r"(?m)^\s*package\s+([A-Za-z_$][A-Za-z0-9_$.]*)\s*;",
        source_code,
    )
    class_match = re.search(
        r"\bpublic\s+(?:final\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)",
        source_code,
    )
    simple_name = class_match.group(1) if class_match else source_path.stem
    package_name = package_match.group(1) if package_match else ""
    main_class = configured_name or (
        ("%s.%s" % (package_name, simple_name)) if package_name else simple_name
    )
    if not re.fullmatch(
        r"[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*",
        main_class,
    ):
        raise ValueError("Invalid Java main class: %s" % main_class)
    return main_class, simple_name, package_name


def _amphi_java_process(command, cwd, timeout_seconds, stage):
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
            "Java %s timed out after %s seconds." % (stage, timeout_seconds)
        ) from error
    if completed.returncode != 0:
        details = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            "Java %s failed with exit code %s.\n%s"
            % (stage, completed.returncode, details)
        )
    return completed


def run_amphi_java_program(
    dataframe,
    source_mode="file",
    source_path_base64="",
    inline_code_base64="",
    main_class_base64="",
    arguments_base64="",
    classpath_base64="",
    artifact_directory_base64="",
    javac_command_base64="amF2YWM=",
    java_command_base64="amF2YQ==",
    timeout_seconds=30,
    result_mode="auto",
):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Java component input must be a pandas DataFrame.")

    source_path_text = _amphi_java_decode(source_path_base64)
    inline_code = _amphi_java_decode(inline_code_base64)
    configured_main_class = _amphi_java_decode(main_class_base64)
    arguments_text = _amphi_java_decode(arguments_base64)
    classpath = _amphi_java_decode(classpath_base64).strip()
    artifact_directory = _amphi_java_directory(
        _amphi_java_decode(artifact_directory_base64)
    )
    javac = _amphi_java_executable(
        _amphi_java_decode(javac_command_base64), "javac"
    )
    java = _amphi_java_executable(
        _amphi_java_decode(java_command_base64), "java"
    )
    timeout_value = max(1, min(600, int(timeout_seconds or 30)))
    mode = "inline" if source_mode == "inline" else "file"
    output_mode = result_mode if result_mode in ("auto", "input", "logs") else "auto"

    with tempfile.TemporaryDirectory(prefix="amphi-java-") as temporary_directory:
        work_directory = Path(temporary_directory)
        classes_directory = work_directory / "classes"
        classes_directory.mkdir(parents=True, exist_ok=True)
        input_csv = work_directory / "input.csv"
        output_csv = work_directory / "output.csv"
        dataframe.to_csv(input_csv, index=False)

        if mode == "file":
            source_path = _amphi_java_existing_file(source_path_text)
            source_code = source_path.read_text(encoding="utf-8")
        else:
            source_code = inline_code
            if not source_code.strip():
                raise ValueError("Inline Java code cannot be empty.")
            provisional = work_directory / "Main.java"
            main_class, simple_name, package_name = _amphi_java_main_class(
                source_code, provisional, configured_main_class
            )
            source_directory = work_directory
            if package_name:
                source_directory = work_directory.joinpath(*package_name.split("."))
                source_directory.mkdir(parents=True, exist_ok=True)
            source_path = source_directory / ("%s.java" % simple_name)
            source_path.write_text(source_code, encoding="utf-8")

        main_class, _simple_name, _package_name = _amphi_java_main_class(
            source_code, source_path, configured_main_class
        )
        compile_command = [
            javac,
            "-encoding",
            "UTF-8",
            "-d",
            str(classes_directory),
        ]
        if classpath:
            compile_command.extend(["-classpath", classpath])
        compile_command.append(str(source_path))
        compile_result = _amphi_java_process(
            compile_command, source_path.parent, timeout_value, "compilation"
        )

        runtime_classpath = str(classes_directory)
        if classpath:
            runtime_classpath = runtime_classpath + os.pathsep + classpath
        try:
            user_arguments = shlex.split(arguments_text, posix=os.name != "nt")
        except ValueError as error:
            raise ValueError("Invalid Java program arguments: %s" % error) from error
        run_command = [
            java,
            "-classpath",
            runtime_classpath,
            main_class,
            str(input_csv),
            str(output_csv),
        ] + user_arguments
        run_result = _amphi_java_process(
            run_command, source_path.parent, timeout_value, "execution"
        )

        if compile_result.stdout.strip():
            print("[javac stdout]\n" + compile_result.stdout.rstrip())
        if compile_result.stderr.strip():
            print("[javac stderr]\n" + compile_result.stderr.rstrip())
        if run_result.stdout.strip():
            print("[Java stdout]\n" + run_result.stdout.rstrip())
        if run_result.stderr.strip():
            print("[Java stderr]\n" + run_result.stderr.rstrip())

        if output_mode == "logs":
            rows = []
            for stream_name, text in (
                ("stdout", run_result.stdout),
                ("stderr", run_result.stderr),
            ):
                for line_number, line in enumerate(text.splitlines(), start=1):
                    rows.append(
                        {
                            "stream": stream_name,
                            "line_number": line_number,
                            "message": line,
                        }
                    )
            if not rows:
                rows.append(
                    {
                        "stream": "status",
                        "line_number": 1,
                        "message": "Java program completed without console output.",
                    }
                )
            result = pd.DataFrame(rows)
        elif output_mode == "auto" and output_csv.is_file():
            try:
                result = pd.read_csv(output_csv)
            except Exception as error:
                raise ValueError("Java output CSV could not be read: %s" % error) from error
        else:
            result = dataframe.copy()

        persisted_directory = None
        if artifact_directory is not None:
            persisted_directory = artifact_directory / (
                "java-run-%s" % uuid.uuid4().hex[:12]
            )
            persisted_directory.mkdir(parents=True, exist_ok=False)
            shutil.copy2(source_path, persisted_directory / source_path.name)
            shutil.copy2(input_csv, persisted_directory / "input.csv")
            if output_csv.is_file():
                shutil.copy2(output_csv, persisted_directory / "output.csv")
            log_data = {
                "main_class": main_class,
                "compile_command": compile_command,
                "run_command": run_command,
                "compile_stdout": compile_result.stdout,
                "compile_stderr": compile_result.stderr,
                "stdout": run_result.stdout,
                "stderr": run_result.stderr,
                "exit_code": int(run_result.returncode),
            }
            (persisted_directory / "execution.json").write_text(
                json.dumps(log_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        metrics = {
            "main_class": main_class,
            "source_mode": mode,
            "input_rows": int(len(dataframe)),
            "output_rows": int(len(result)),
            "result_csv_created": bool(output_csv.is_file()),
            "exit_code": int(run_result.returncode),
            "stdout": run_result.stdout,
            "stderr": run_result.stderr,
            "artifact_directory": (
                str(persisted_directory) if persisted_directory is not None else None
            ),
        }
        return result, metrics
`;
