#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/python-venv"
  exit 2
fi

VENV_DIR="$1"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$VENV_DIR/bin/python"
JUPYTER_BIN="$VENV_DIR/bin/jupyter"
JLPM_BIN="$VENV_DIR/bin/jlpm"
PACKAGE_SCOPE="@local"
PACKAGE_BASENAME="amphi-custom-components"
export YARN_GLOBAL_FOLDER="$PROJECT_DIR/.yarn/global"
export YARN_CACHE_FOLDER="$PROJECT_DIR/.yarn/cache"
export YARN_ENABLE_GLOBAL_CACHE=false

for executable in "$PYTHON_BIN" "$JUPYTER_BIN" "$JLPM_BIN"; do
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable: $executable"
    exit 1
  fi
done

cd "$PROJECT_DIR"

"$PYTHON_BIN" scripts/validate_embedded_python.py
"$JLPM_BIN" install
"$JLPM_BIN" run build:lib
"$JUPYTER_BIN" labextension build --development True .

DATA_DIR="$("$PYTHON_BIN" -c 'import sysconfig; print(sysconfig.get_path("data"))')"
TARGET="$DATA_DIR/share/jupyter/labextensions/$PACKAGE_SCOPE/$PACKAGE_BASENAME"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [[ -d "$TARGET" ]]; then
  BACKUP="${TARGET}.backup-${TIMESTAMP}"
  mv "$TARGET" "$BACKUP"
  echo "Previous extension moved to: $BACKUP"
fi

mkdir -p "$TARGET"
cp -R "$PROJECT_DIR/labextension/." "$TARGET/"

echo "Installed to: $TARGET"
"$JUPYTER_BIN" labextension list
echo "Restart JupyterLab, then hard-refresh the browser."
