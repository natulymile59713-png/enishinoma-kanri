#!/usr/bin/env python3
"""縁の間 - dist バンドラ

外部参照の <link rel="stylesheet" href="..."> と <script src="..."> をすべて
インライン化して dist/*.html を生成する。

使い方:
    python3 build.py           # dist 生成のみ
    python3 build.py --deploy  # dist 生成 + Downloads/ コピーまで

build.sh 経由で呼ばれることを想定。
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ユーザーアプリで読み込む JS（HTML 側 <script src="js/xxx.js"> の順と一致）
# utils は他全モジュールから使われるので先頭に置く必要がある
USER_JS = [
    'sentry-init',
    'recaptcha-init',
    'utils',
    'config', 'pillars', 'state', 'supabase',
    'ui-orient', 'ui-register', 'ui-match',
    'ui-chat', 'ui-other', 'ui-shindan', 'ui-calendar',
    'interests',
    'app',
]


def bundle(html_path: Path, css_path: Path, js_files: list[Path], output: Path) -> None:
    """HTML 内の <link rel="stylesheet"> と <script src="..."> をインライン化して書き出す。

    対応する置換対象が見つからなければエラーを投げる（パスタイポ検知）。
    """
    html = html_path.read_text(encoding='utf-8')
    css = css_path.read_text(encoding='utf-8')

    css_link = '<link rel="stylesheet" href="css/styles.css">'
    if css_link not in html:
        raise RuntimeError(f'CSS link not found in {html_path}: {css_link!r}')
    html = html.replace(css_link, f'<style>\n{css}\n</style>')

    for js in js_files:
        code = js.read_text(encoding='utf-8')
        rel = os.path.relpath(js, html_path.parent)
        script_tag = f'<script src="{rel}"></script>'
        if script_tag not in html:
            raise RuntimeError(f'Script tag not found in {html_path}: {script_tag!r}')
        html = html.replace(script_tag, f'<script>\n{code}\n</script>')

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')


def build_all() -> None:
    """3アプリ（user / admin / booking）の dist を再生成する。"""
    # user
    bundle(
        ROOT / 'index.html',
        ROOT / 'css' / 'styles.css',
        [ROOT / 'js' / f'{n}.js' for n in USER_JS],
        ROOT / 'dist' / 'index.html',
    )
    # admin（sentry-init, recaptcha-init, utils を先頭に）
    bundle(
        ROOT / 'admin' / 'index.html',
        ROOT / 'admin' / 'css' / 'styles.css',
        [
            ROOT / 'admin' / 'js' / 'sentry-init.js',
            ROOT / 'admin' / 'js' / 'recaptcha-init.js',
            ROOT / 'admin' / 'js' / 'utils.js',
            ROOT / 'admin' / 'js' / 'admin-app.js',
        ],
        ROOT / 'dist' / 'admin.html',
    )
    # booking（sentry-init, recaptcha-init, utils を先頭に）
    bundle(
        ROOT / 'booking' / 'index.html',
        ROOT / 'booking' / 'css' / 'styles.css',
        [
            ROOT / 'booking' / 'js' / 'sentry-init.js',
            ROOT / 'booking' / 'js' / 'recaptcha-init.js',
            ROOT / 'booking' / 'js' / 'utils.js',
            ROOT / 'booking' / 'js' / 'booking.js',
        ],
        ROOT / 'dist' / 'booking.html',
    )
    # PWA アセット（manifest / service-worker / icons）を dist へコピー
    # SW は HTML と同じ階層に置く必要がある（scope のため）
    copy_pwa_assets()
    print('[build] dist/index.html, admin.html, booking.html を生成しました')


def copy_pwa_assets() -> None:
    """各アプリの manifest.json / service-worker.js / icons/ を dist 配下へコピー。

    GitHub Pages では下記の構造でデプロイされる想定:
      enisinma-app1.1/
        index.html
        manifest.json
        service-worker.js
        icons/icon.svg
      enishinoma-kanri/
        admin/{index.html, manifest.json, service-worker.js, icons/}
        booking/{index.html, manifest.json, service-worker.js, icons/}
    """
    dist = ROOT / 'dist'

    # user (= dist/ 直下)
    shutil.copyfile(ROOT / 'manifest.json', dist / 'manifest.json')
    shutil.copyfile(ROOT / 'service-worker.js', dist / 'service-worker.js')
    _copy_dir(ROOT / 'icons', dist / 'icons')

    # admin (=dist/admin/)
    admin_dist = dist / 'admin'
    admin_dist.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'admin' / 'manifest.json', admin_dist / 'manifest.json')
    shutil.copyfile(ROOT / 'admin' / 'service-worker.js', admin_dist / 'service-worker.js')
    _copy_dir(ROOT / 'admin' / 'icons', admin_dist / 'icons')

    # booking (=dist/booking/)
    booking_dist = dist / 'booking'
    booking_dist.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'booking' / 'manifest.json', booking_dist / 'manifest.json')
    shutil.copyfile(ROOT / 'booking' / 'service-worker.js', booking_dist / 'service-worker.js')
    _copy_dir(ROOT / 'booking' / 'icons', booking_dist / 'icons')


def _copy_dir(src: Path, dst: Path) -> None:
    """ディレクトリ内のファイルを再帰的にコピー（既存は上書き）。"""
    if not src.exists():
        return
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            _copy_dir(item, target)
        else:
            shutil.copyfile(item, target)


# GitHub Pages 用 Downloads ディレクトリ
# HTML 本体に加え、PWA アセット（manifest / SW / icons）もコピーする
USER_DEPLOY_DIR = Path.home() / 'Downloads' / 'enishinoma-user-app'
KANRI_DEPLOY_DIR = Path.home() / 'Downloads' / 'enishinoma-kanri-files'

DEPLOY_TARGETS = [
    (ROOT / 'dist' / 'index.html',   USER_DEPLOY_DIR / 'index.html'),
    (ROOT / 'dist' / 'admin.html',   KANRI_DEPLOY_DIR / 'admin' / 'index.html'),
    (ROOT / 'dist' / 'booking.html', KANRI_DEPLOY_DIR / 'booking' / 'index.html'),
]


def deploy() -> None:
    """dist の3ファイル + PWA アセットを GitHub Pages 用 Downloads/ へコピー。"""
    missing = [str(src) for src, _ in DEPLOY_TARGETS if not src.exists()]
    if missing:
        raise RuntimeError(f'dist にまだ生成されていません: {missing}（先に build を実行）')
    for src, dst in DEPLOY_TARGETS:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        print(f'[deploy] {src.name} -> {dst}')

    # PWA アセットも Downloads/ へ
    # user: USER_DEPLOY_DIR/{manifest.json, service-worker.js, icons/}
    shutil.copyfile(ROOT / 'manifest.json', USER_DEPLOY_DIR / 'manifest.json')
    shutil.copyfile(ROOT / 'service-worker.js', USER_DEPLOY_DIR / 'service-worker.js')
    _copy_dir(ROOT / 'icons', USER_DEPLOY_DIR / 'icons')
    print(f'[deploy] PWA assets -> {USER_DEPLOY_DIR}')

    # admin: KANRI_DEPLOY_DIR/admin/{manifest.json, service-worker.js, icons/}
    shutil.copyfile(ROOT / 'admin' / 'manifest.json', KANRI_DEPLOY_DIR / 'admin' / 'manifest.json')
    shutil.copyfile(ROOT / 'admin' / 'service-worker.js', KANRI_DEPLOY_DIR / 'admin' / 'service-worker.js')
    _copy_dir(ROOT / 'admin' / 'icons', KANRI_DEPLOY_DIR / 'admin' / 'icons')
    print(f'[deploy] PWA assets -> {KANRI_DEPLOY_DIR}/admin')

    # booking: KANRI_DEPLOY_DIR/booking/{manifest.json, service-worker.js, icons/}
    shutil.copyfile(ROOT / 'booking' / 'manifest.json', KANRI_DEPLOY_DIR / 'booking' / 'manifest.json')
    shutil.copyfile(ROOT / 'booking' / 'service-worker.js', KANRI_DEPLOY_DIR / 'booking' / 'service-worker.js')
    _copy_dir(ROOT / 'booking' / 'icons', KANRI_DEPLOY_DIR / 'booking' / 'icons')
    print(f'[deploy] PWA assets -> {KANRI_DEPLOY_DIR}/booking')


def main() -> int:
    parser = argparse.ArgumentParser(description='縁の間 dist ビルダ')
    parser.add_argument('--deploy', action='store_true', help='dist 生成後 Downloads/ へコピー')
    args = parser.parse_args()
    try:
        build_all()
        if args.deploy:
            deploy()
    except Exception as e:
        print(f'[error] {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
