#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$PROJECT_DIR/package.json').version")"
PACKAGE_NAME="amphi-custom-components-$VERSION"
DIST_DIR="$PROJECT_DIR/dist"
ARCHIVE="$DIST_DIR/$PACKAGE_NAME.tar.gz"
CHECKSUM="$ARCHIVE.sha256"
STAGING_ROOT="$(mktemp -d)"
STAGING_DIR="$STAGING_ROOT/$PACKAGE_NAME"

cleanup() {
  rm -rf "$STAGING_ROOT"
}
trap cleanup EXIT

if [[ ! -f "$PROJECT_DIR/labextension/package.json" || ! -d "$PROJECT_DIR/labextension/static" ]]; then
  echo "错误：请先构建 labextension。"
  exit 1
fi

BUILT_VERSION="$(node -p "require('$PROJECT_DIR/labextension/package.json').version")"
if [[ "$BUILT_VERSION" != "$VERSION" ]]; then
  echo "错误：源码版本 $VERSION 与构建版本 $BUILT_VERSION 不一致。"
  exit 1
fi

mkdir -p "$STAGING_DIR" "$DIST_DIR"
cp -R "$PROJECT_DIR/labextension" "$STAGING_DIR/labextension"
cp "$PROJECT_DIR/packaging/install.sh" "$STAGING_DIR/install.sh"
cp "$PROJECT_DIR/packaging/README-发布包.md" "$STAGING_DIR/README.md"
cp "$PROJECT_DIR/python-requirements.example.txt" "$STAGING_DIR/python-requirements.txt"
cp "$PROJECT_DIR/docs/75种零代码算法组件.md" "$STAGING_DIR/COMPONENTS.md"
chmod +x "$STAGING_DIR/install.sh"

tar -C "$STAGING_ROOT" -czf "$ARCHIVE" "$PACKAGE_NAME"
(
  cd "$DIST_DIR"
  shasum -a 256 "$(basename "$ARCHIVE")" > "$(basename "$CHECKSUM")"
)

echo "发布包：$ARCHIVE"
echo "校验文件：$CHECKSUM"
