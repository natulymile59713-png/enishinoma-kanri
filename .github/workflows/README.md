# GitHub Actions 設定メモ

`build.yml` は `main` への push で `dist/*.html` を再生成して artifact として保管します。**デプロイは含まれていません**（URL/リポジトリ構成の選択肢があるため、別途設定が必要）。

---

## 自動デプロイの選択肢

### A) このリポジトリ単体で GitHub Pages 配信

最もシンプル。`enishinoma-kanri` リポジトリ自身で Pages を有効化し、`gh-pages` ブランチに `dist/` を push する。
ユーザーアプリ・管理画面・予約ページが**同じ URL** 配下になる。

例：
- https://natulymile59713-png.github.io/enishinoma-kanri/
- https://natulymile59713-png.github.io/enishinoma-kanri/admin/
- https://natulymile59713-png.github.io/enishinoma-kanri/booking/

**やること:**
1. GitHub の `Settings → Pages` で source を「Deploy from a branch」→ `gh-pages` に設定
2. `build.yml` の末尾に下記ステップを追加：
   ```yaml
   - name: Deploy to gh-pages
     uses: peaceiris/actions-gh-pages@v4
     with:
       github_token: ${{ secrets.GITHUB_TOKEN }}
       publish_dir: ./dist
       keep_files: false
   ```
3. ただし URL が変わるため、既存ユーザーへ周知が必要。

---

### B) 既存の 2 リポジトリ運用を維持して別 repo に push

`enisinma-app1.1` と `enishinoma-kanri` の URL を変えずに自動化したい場合。**Personal Access Token (PAT) が必要**。

**やること:**
1. GitHub の `Settings → Developer settings → Personal access tokens → Fine-grained tokens` で
   - 対象リポジトリ: `enisinma-app1.1`, `enishinoma-kanri`
   - 権限: `Contents: Read and Write`
   を持つ token を発行
2. このリポジトリの `Settings → Secrets and variables → Actions` に
   - `DEPLOY_TOKEN` という名前で上の PAT を登録
3. `build.yml` に下記ステップを追加：
   ```yaml
   - name: Checkout user-app repo
     uses: actions/checkout@v4
     with:
       repository: natulymile59713-png/enisinma-app1.1
       token: ${{ secrets.DEPLOY_TOKEN }}
       path: deploy-user
   - run: cp dist/index.html deploy-user/index.html
   - name: Push user-app
     working-directory: deploy-user
     run: |
       git config user.name "github-actions"
       git config user.email "actions@github.com"
       git add index.html
       git diff --quiet --cached || git commit -m "Deploy from $GITHUB_SHA"
       git push

   - name: Checkout kanri repo
     uses: actions/checkout@v4
     with:
       repository: natulymile59713-png/enishinoma-kanri
       token: ${{ secrets.DEPLOY_TOKEN }}
       path: deploy-kanri
   - run: |
       cp dist/admin.html   deploy-kanri/admin/index.html
       cp dist/booking.html deploy-kanri/booking/index.html
   - name: Push kanri
     working-directory: deploy-kanri
     run: |
       git config user.name "github-actions"
       git config user.email "actions@github.com"
       git add admin/index.html booking/index.html
       git diff --quiet --cached || git commit -m "Deploy from $GITHUB_SHA"
       git push
   ```

---

## ローカル運用は今まで通り

CI を入れた後も以下は変わらず動きます：
- `./build.sh` … dist 生成だけ（ローカル確認用）
- `./build.sh --deploy` … dist + Downloads コピー（手動アップ用）
