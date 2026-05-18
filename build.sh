#!/usr/bin/env bash
# 縁の間 - 開発用ビルドスクリプト
#
# 使い方:
#   ./build.sh           # dist 生成のみ（ローカル確認用）
#   ./build.sh --deploy  # dist 生成 + Downloads コピー（GitHub にアップする前）
#
set -euo pipefail
cd "$(dirname "$0")"
exec python3 build.py "$@"
