# メール認証 ON 化 手順書

コード側の対応はすでに完了済み（`js/ui-register.js` / `js/app.js`）。あとは Supabase ダッシュボードで以下の設定変更を行うとメール認証フローが動き出します。

---

## 1. Confirm email を ON にする

1. Supabase ダッシュボード → 左サイドバー **Authentication**
2. **Sign In / Up → Auth Providers → Email** を開く
3. **"Confirm email"** を **ON**
4. 下部の **Save** をクリック

> ⚠️ 既存ユーザー（未確認メール）は次回ログイン時に確認が必要になる場合があります。
> テスト用に作成した不要なアカウントは事前に削除しておくと安全。

---

## 2. Site URL / Redirect URLs を設定

確認メール内のリンクから戻ってきた時のリダイレクト先を許可します。

1. **Authentication → URL Configuration**
2. **Site URL** をデプロイ先 URL に設定
   - 例: `https://natulymile59713-png.github.io/enisinma-app1.1/`
3. **Redirect URLs** に下記を**全部**追加（複数登録可）
   - `https://natulymile59713-png.github.io/enisinma-app1.1/`
   - `https://natulymile59713-png.github.io/enisinma-app1.1/index.html`
   - `http://localhost:8766/` ※ローカル開発用
   - `http://localhost:8766/index.html`
   - `http://localhost:8767/` ※2人同時テスト用
   - `http://localhost:8767/index.html`
4. **Save**

> コードの `emailRedirectTo` には `window.location.origin + window.location.pathname` を渡しているので、ユーザーがアクセスしている URL に戻ります。Redirect URLs の許可リストに無いとリダイレクトが失敗するので、本番＋ローカルを必ず登録。

---

## 3. 日本語メールテンプレ（Confirm signup）

1. **Authentication → Email Templates → Confirm signup**
2. **Subject** と **Message body** を下記に書き換え → **Save**

### 件名 (Subject)
```
【縁の間】メールアドレス確認のお願い
```

### 本文 (Message body) ※HTML
```html
<div style="font-family:'Noto Sans JP',-apple-system,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.85">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-family:'Noto Serif JP',serif;font-size:22px;font-weight:700;color:#C9A96E;letter-spacing:.1em">縁の間 ― えにしのま ―</div>
    <div style="font-size:11px;color:#999;letter-spacing:.18em;margin-top:4px">必然的良縁を、あなたに</div>
  </div>
  <p style="font-size:15px;font-weight:500;color:#1a1a1a;margin-bottom:12px">この度はご登録ありがとうございます。</p>
  <p style="font-size:13px;color:#555;margin-bottom:24px">
    下のボタンをクリックすると、メールアドレスの確認が完了し、自動的にログインします。<br>
    （リンクは 24 時間で無効になります）
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;padding:13px 32px;background:#C9A96E;color:#fff;text-decoration:none;border-radius:8px;font-family:'Noto Serif JP',serif;font-size:14px;font-weight:500;letter-spacing:.05em">
      メールアドレスを確認する
    </a>
  </div>
  <p style="font-size:12px;color:#888;margin-bottom:8px">ボタンが押せない場合は、下の URL をブラウザに貼り付けてください：</p>
  <p style="font-size:11px;color:#555;word-break:break-all;background:#f5f5f5;padding:10px 12px;border-radius:6px;margin-bottom:24px">
    {{ .ConfirmationURL }}
  </p>
  <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0">
  <p style="font-size:11px;color:#999;line-height:1.8">
    このメールにお心当たりがない場合は、お手数ですがメールを破棄してください。<br>
    ご不明な点は <a href="mailto:support@example.com" style="color:#C9A96E">support@example.com</a> までお問い合わせください。
  </p>
  <p style="text-align:right;font-size:11px;color:#999;margin-top:16px">
    縁の間 運営チーム
  </p>
</div>
```

> `{{ .ConfirmationURL }}` は Supabase が自動で展開するプレースホルダー。**変えないでください**。

### 「Reset Password」「Magic Link」など他のテンプレも同様に日本語化推奨

同じ要領で **Reset Password** や **Magic Link** のテンプレも置き換えると、すべてのメールが日本語＆ブランドカラーで届きます。

---

## 4. 動作確認

1. ローカルサーバを再起動（既に動いていれば OK）
   ```bash
   cd ~/Desktop/enishinoma && python3 -m http.server 8766
   ```
2. http://localhost:8766/ で **新規登録 → 確認メールを送信しました画面に遷移** することを確認
3. 受信箱に縁の間からのメールが届いていることを確認（迷惑メールフォルダも）
4. メール内のボタンをクリック → 自動でログインしてアプリのトップに着地
5. 管理画面 (http://localhost:8766/admin/) → ユーザー一覧 にレコードが追加されているのを確認

---

## 5. ⚠️ 既知の制約・運用上の注意

### a) Supabase 標準 SMTP の制限
- **無料枠**: 1時間 4 通、1日 30 通まで
- 本番運用で大量送信するなら **Resend / SendGrid 等のカスタム SMTP** が必須
- 設定箇所: **Authentication → Auth Settings → SMTP Settings**

### b) localStorage に保留される profile データ
- メール認証 ON の場合、`pending_profile_<user_id>` というキーで一時保存
- 確認リンクをクリックして初回ログイン後、自動で DB に INSERT して削除される
- **別端末で確認リンクをクリックした場合** は localStorage が無いので INSERT 失敗 → 登録画面に再び誘導される
  - 対応策: ユーザーには「登録した端末と同じブラウザで確認メールを開いてください」と案内する
  - 将来的対策: `signUp` の `options.data` に profile データを乗せて、サーバー側のトリガで profiles へコピーする方式（追加実装が必要）

### c) Confirm email を後から OFF に戻したい時
1. **Authentication → Providers → Email → Confirm email を OFF** に戻すだけ
2. 既存ユーザーには影響なし。新規登録時のみ動作が変わる
