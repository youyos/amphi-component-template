#!/usr/bin/env python3
"""Compile and execute representative Java programs through the embedded runtime."""

from __future__ import annotations

import base64
import os
from pathlib import Path
import re
import shutil
import tempfile

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "javaRuntime.ts"


def encode(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def load_runtime():
    source = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`(?P<code>.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError("Embedded Java runtime was not found.")
    namespace: dict[str, object] = {}
    exec(compile(match.group("code"), "javaRuntime.ts", "exec"), namespace)
    return namespace["run_amphi_java_program"]


def main() -> int:
    if not shutil.which("javac") or not shutil.which("java"):
        raise RuntimeError("Java runtime test requires javac and java on PATH.")

    source = pd.DataFrame(
        {
            "name": ["张三", "李四"],
            "score": [90, 85],
        }
    )
    copying_program = """
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

public class Main {
    public static void main(String[] args) throws Exception {
        System.out.println("rows copied");
        Files.copy(
            Paths.get(args[0]),
            Paths.get(args[1]),
            StandardCopyOption.REPLACE_EXISTING
        );
    }
}
""".strip()
    run = load_runtime()
    result, metrics = run(
        dataframe=source,
        source_mode="inline",
        inline_code_base64=encode(copying_program),
        source_path_base64=encode(""),
        main_class_base64=encode(""),
        arguments_base64=encode(""),
        classpath_base64=encode(""),
        artifact_directory_base64=encode(""),
        javac_command_base64=encode("javac"),
        java_command_base64=encode("java"),
        timeout_seconds=30,
        result_mode="auto",
    )

    pd.testing.assert_frame_equal(result, source)
    assert metrics["main_class"] == "Main"
    assert metrics["exit_code"] == 0
    assert metrics["result_csv_created"] is True
    assert "rows copied" in metrics["stdout"]

    file_program = """
public class FileMain {
    public static void main(String[] args) {
        System.out.println("source file mode");
    }
}
""".strip()
    original_directory = Path.cwd()
    with tempfile.TemporaryDirectory(prefix="amphi-java-jupyter-root-") as directory:
        jupyter_root = Path(directory)
        source_directory = jupyter_root / "sources"
        source_directory.mkdir()
        (source_directory / "FileMain.java").write_text(
            file_program, encoding="utf-8"
        )
        os.chdir(jupyter_root)
        try:
            log_result, file_metrics = run(
                dataframe=source,
                source_mode="file",
                source_path_base64=encode("/sources/FileMain.java"),
                inline_code_base64=encode(""),
                main_class_base64=encode(""),
                arguments_base64=encode(""),
                classpath_base64=encode(""),
                artifact_directory_base64=encode(""),
                javac_command_base64=encode("javac"),
                java_command_base64=encode("java"),
                timeout_seconds=30,
                result_mode="logs",
            )
        finally:
            os.chdir(original_directory)
    assert file_metrics["main_class"] == "FileMain"
    assert log_result["message"].str.contains("source file mode").any()

    invalid_program = "public class Broken { this is not Java; }"
    try:
        run(
            dataframe=source,
            source_mode="inline",
            inline_code_base64=encode(invalid_program),
            source_path_base64=encode(""),
            main_class_base64=encode(""),
            arguments_base64=encode(""),
            classpath_base64=encode(""),
            artifact_directory_base64=encode(""),
            javac_command_base64=encode("javac"),
            java_command_base64=encode("java"),
            timeout_seconds=30,
            result_mode="auto",
        )
    except RuntimeError as error:
        assert "compilation failed" in str(error)
    else:
        raise AssertionError("Invalid Java source should fail during compilation.")

    print(
        "Java runtime test passed: inline/file modes, Jupyter paths, %d CSV row(s), "
        "and invalid-source diagnostics." % len(result)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
