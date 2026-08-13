#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/python-venv"
  exit 2
fi

VENV_DIR="$1"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
PYTHON_BIN="$VENV_DIR/bin/python"
JUPYTER_BIN="$VENV_DIR/bin/jupyter"
JLPM_BIN="$VENV_DIR/bin/jlpm"
PACKAGE_SCOPE="@local-ai"
PACKAGE_BASENAME="amphi-ai24-components"
export YARN_GLOBAL_FOLDER="$REPOSITORY_DIR/.yarn/global"
export YARN_CACHE_FOLDER="$REPOSITORY_DIR/.yarn/cache"
export YARN_ENABLE_GLOBAL_CACHE=false
export PATH="$VENV_DIR/bin:$PATH"

for executable in "$PYTHON_BIN" "$JUPYTER_BIN" "$JLPM_BIN"; do
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable: $executable"
    exit 1
  fi
done

cd "$REPOSITORY_DIR"
"$PYTHON_BIN" scripts/validate_embedded_python.py
"$JLPM_BIN" install
"$JLPM_BIN" run build:lib
"$PYTHON_BIN" scripts/test_ai24_runtime.py
node scripts/test_generated_component_code.mjs

cd "$PROJECT_DIR"
"$JUPYTER_BIN" labextension build --development True .

DATA_DIR="$("$PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("data"))')"
TARGET="$DATA_DIR/share/jupyter/labextensions/$PACKAGE_SCOPE/$PACKAGE_BASENAME"
BACKUP_ROOT="$DATA_DIR/share/jupyter/labextension-backups/$PACKAGE_SCOPE"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [[ -d "$TARGET" ]]; then
  mkdir -p "$BACKUP_ROOT"
  BACKUP="$BACKUP_ROOT/${PACKAGE_BASENAME}.backup-${TIMESTAMP}"
  mv "$TARGET" "$BACKUP"
  echo "Previous extension moved to: $BACKUP"
fi

mkdir -p "$TARGET"
cp -R "$PROJECT_DIR/labextension/." "$TARGET/"
echo "Installed to: $TARGET"
"$JUPYTER_BIN" labextension list
echo "Restart JupyterLab, then hard-refresh the browser."
