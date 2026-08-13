#!/usr/bin/env python3
"""Validate embedded Python after Amphi's formatVariables transformation."""

from __future__ import annotations

import ast
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "src"
ADDITIONAL_SOURCE_DIRS = [
    ROOT / "packages" / "amphi-ai27-components" / "src",
    ROOT / "packages" / "amphi-ai14-components" / "src",
    ROOT / "packages" / "amphi-ai22-components" / "src",
    ROOT / "packages" / "amphi-ai24-components" / "src",
]
STRING_RAW_PATTERN = re.compile(r"String\.raw`(?P<code>.*?)`;", re.DOTALL)


def amphi_format_variables(code: str) -> str:
    """Mirror the relevant transformations in Amphi 0.9.7."""

    transformed: list[str] = []
    for line in code.splitlines():
        if (
            re.search(r"""r(['"]).*\1""", line)
            or re.search(r"""f(['"])""", line)
            or re.search(r"""f(""" + '"""' + r"""|''')""", line)
        ):
            transformed.append(line)
            continue

        line = re.sub(
            r"""(['"])\{(os\.[^}]+)\}\1""",
            lambda match: match.group(2),
            line,
        )
        line = re.sub(
            r"""(['"])\{(\w+)\}\1""",
            lambda match: match.group(2),
            line,
        )
        line = re.sub(
            r"""(['"])(.*\{.*\}.*)\1""",
            lambda match: "f" + match.group(1) + match.group(2) + match.group(1),
            line,
        )
        transformed.append(line)

    result = "\n".join(transformed)
    result = re.sub(
        r"""(?<![fr])(['"])([^'"\n]*\{os\.getenv\([^}]+\)\}[^'"\n]*)\1""",
        lambda match: "f" + match.group(1) + match.group(2) + match.group(1),
        result,
    )
    return result


def main() -> int:
    source_directories = [SOURCE_DIR, *ADDITIONAL_SOURCE_DIRS]
    source_files = []
    for source_directory in source_directories:
        source_files.extend(sorted(source_directory.glob("*.ts")))
        source_files.extend(sorted(source_directory.glob("*.tsx")))
    checked = 0
    failures: list[str] = []

    for source_file in source_files:
        source = source_file.read_text(encoding="utf-8")
        for index, match in enumerate(STRING_RAW_PATTERN.finditer(source), start=1):
            checked += 1
            embedded = match.group("code")
            formatted = amphi_format_variables(embedded)
            try:
                ast.parse(formatted, filename=f"{source_file.name}:String.raw#{index}")
            except SyntaxError as error:
                lines = formatted.splitlines()
                start = max(1, (error.lineno or 1) - 2)
                stop = min(len(lines), (error.lineno or 1) + 2)
                context = "\n".join(
                    f"{line_number:04d}: {lines[line_number - 1]}"
                    for line_number in range(start, stop + 1)
                )
                failures.append(
                    f"{source_file}:{error.lineno}: {error.msg}\n{context}"
                )

    if failures:
        print("Embedded Python validation failed:\n", file=sys.stderr)
        print("\n\n".join(failures), file=sys.stderr)
        return 1
    if checked == 0:
        print("No String.raw embedded Python blocks were found.", file=sys.stderr)
        return 1

    print(
        "Embedded Python validation passed: "
        f"{checked} block(s), including Amphi formatVariables compatibility."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
