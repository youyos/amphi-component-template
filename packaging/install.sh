#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_EXTENSION="$PACKAGE_DIR/labextension"
PACKAGE_SCOPE="@local-ai"
LEGACY_PACKAGE_SCOPE="@local"
PACKAGE_BASENAME="amphi-custom-components"
CHECK_ONLY=false
USER_INSTALL=false
PYTHON_OVERRIDE=""
VENV_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --user)
      USER_INSTALL=true
      shift
      ;;
    --python)
      if [[ $# -lt 2 ]]; then
        echo "错误：--python 后必须提供 Python 可执行文件绝对路径。"
        exit 2
      fi
      PYTHON_OVERRIDE="$2"
      shift 2
      ;;
    -*)
      echo "错误：未知参数 $1"
      exit 2
      ;;
    *)
      if [[ -n "$VENV_DIR" ]]; then
        echo "错误：只能指定一个虚拟环境路径。"
        exit 2
      fi
      VENV_DIR="$1"
      shift
      ;;
  esac
done

if [[ -n "$PYTHON_OVERRIDE" ]]; then
  PYTHON_BIN="$PYTHON_OVERRIDE"
elif [[ -n "$VENV_DIR" ]]; then
  if [[ "$VENV_DIR" != /* ]]; then
    echo "错误：虚拟环境路径必须是绝对路径：$VENV_DIR"
    exit 2
  fi
  PYTHON_BIN="$VENV_DIR/bin/python"
elif [[ -n "${VIRTUAL_ENV:-}" ]]; then
  VENV_DIR="$VIRTUAL_ENV"
  PYTHON_BIN="$VENV_DIR/bin/python"
else
  PYTHON_BIN="$(command -v python3 || true)"
  USER_INSTALL=true
fi

if [[ -z "$PYTHON_BIN" || "$PYTHON_BIN" != /* || ! -x "$PYTHON_BIN" ]]; then
  echo "错误：找不到可用的 Python。请使用 --python /absolute/path/to/python3。"
  exit 1
fi

if ! "$PYTHON_BIN" -m jupyter --version >/dev/null 2>&1; then
  echo "错误：该 Python 环境中未安装 Jupyter：$PYTHON_BIN"
  exit 1
fi

if [[ ! -f "$SOURCE_EXTENSION/package.json" || ! -d "$SOURCE_EXTENSION/static" ]]; then
  echo "错误：发布包不完整，labextension/package.json 或 static/ 不存在。"
  exit 1
fi

"$PYTHON_BIN" - <<'PY'
from importlib.metadata import PackageNotFoundError, version
import sys

errors = []
if sys.version_info < (3, 11):
    errors.append("需要 Python 3.11 或更高版本，当前为 %s" % sys.version.split()[0])

installed = {}
for package, label in (
    ("jupyterlab", "JupyterLab"),
    ("jupyterlab-amphi", "jupyterlab-amphi"),
    ("pandas", "pandas"),
    ("numpy", "numpy"),
    ("scikit-learn", "scikit-learn"),
):
    try:
        installed[package] = version(package)
        print("%s: %s" % (label, installed[package]))
    except PackageNotFoundError:
        errors.append("缺少 Python 包：%s" % package)

def numeric_version(value):
    parts = []
    for part in value.split("."):
        digits = "".join(character for character in part if character.isdigit())
        if not digits:
            break
        parts.append(int(digits))
        if len(parts) == 3:
            break
    return tuple(parts + [0] * (3 - len(parts)))

if "jupyterlab" in installed:
    current = numeric_version(installed["jupyterlab"])
    if current < (4, 3, 4) or current >= (5, 0, 0):
        errors.append(
            "jupyterlab 版本不兼容：需要 >=4.3.4,<5，当前为 %s"
            % installed["jupyterlab"]
        )

if "jupyterlab-amphi" in installed:
    current = numeric_version(installed["jupyterlab-amphi"])
    if current < (0, 9, 0) or current >= (1, 0, 0):
        errors.append(
            "jupyterlab-amphi 版本不兼容：需要 >=0.9.0,<1，当前为 %s"
            % installed["jupyterlab-amphi"]
        )

if errors:
    raise SystemExit("环境检查失败：\n- " + "\n- ".join(errors))
PY

if [[ "$CHECK_ONLY" == true ]]; then
  echo "环境兼容性检查通过；未写入任何文件。"
  exit 0
fi

if [[ "$USER_INSTALL" == true ]]; then
  JUPYTER_DATA_DIR="$("$PYTHON_BIN" -m jupyter --data-dir)"
  TARGET="$JUPYTER_DATA_DIR/labextensions/$PACKAGE_SCOPE/$PACKAGE_BASENAME"
  BACKUP_ROOT="$JUPYTER_DATA_DIR/labextension-backups/$PACKAGE_SCOPE"
  LEGACY_TARGET="$JUPYTER_DATA_DIR/labextensions/$LEGACY_PACKAGE_SCOPE/$PACKAGE_BASENAME"
  LEGACY_BACKUP_ROOT="$JUPYTER_DATA_DIR/labextension-backups/$LEGACY_PACKAGE_SCOPE"
else
  DATA_DIR="$("$PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("data"))')"
  TARGET="$DATA_DIR/share/jupyter/labextensions/$PACKAGE_SCOPE/$PACKAGE_BASENAME"
  BACKUP_ROOT="$DATA_DIR/share/jupyter/labextension-backups/$PACKAGE_SCOPE"
  LEGACY_TARGET="$DATA_DIR/share/jupyter/labextensions/$LEGACY_PACKAGE_SCOPE/$PACKAGE_BASENAME"
  LEGACY_BACKUP_ROOT="$DATA_DIR/share/jupyter/labextension-backups/$LEGACY_PACKAGE_SCOPE"
fi
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [[ -d "$LEGACY_TARGET" ]]; then
  mkdir -p "$LEGACY_BACKUP_ROOT"
  LEGACY_BACKUP="$LEGACY_BACKUP_ROOT/${PACKAGE_BASENAME}.scope-migration-${TIMESTAMP}"
  mv "$LEGACY_TARGET" "$LEGACY_BACKUP"
  echo "旧 @local 扩展已迁移到备份：$LEGACY_BACKUP"
fi

if [[ -d "$TARGET" ]]; then
  mkdir -p "$BACKUP_ROOT"
  BACKUP="$BACKUP_ROOT/${PACKAGE_BASENAME}.backup-${TIMESTAMP}"
  mv "$TARGET" "$BACKUP"
  echo "旧版本已备份到：$BACKUP"
fi

mkdir -p "$TARGET"
cp -R "$SOURCE_EXTENSION/." "$TARGET/"

INSTALLED_VERSION="$("$PYTHON_BIN" -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text())["version"])' "$TARGET/package.json")"
echo "已安装：$PACKAGE_SCOPE/$PACKAGE_BASENAME v$INSTALLED_VERSION"
echo "安装目录：$TARGET"

"$PYTHON_BIN" -m jupyter labextension list

echo
echo "安装完成。请完全重启 JupyterLab，并在浏览器中硬刷新。"
