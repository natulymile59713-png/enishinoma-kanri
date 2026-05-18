# Web Push 配信 Edge Function セットアップ手順

クライアント側の Push 購読（PWA）は実装済み。あとは下記の手順で **VAPID キーの発行 → 設定 → Edge Function デプロイ** をすれば、配信が動き出します。

---

## 1. VAPID キーペアを生成

VAPID = Web Push 通知の認証規格。**公開鍵**（クライアント側）と **秘密鍵**（Edge Function 側）のペアが必要です。

### 方法 A: ターミナルで生成（推奨）

```bash
npx web-push generate-vapid-keys
```

実行すると下記のような出力が出ます：

```
=======================================
Public Key:
BNbXC...（長い base64url 文字列）

Private Key:
H3pV...（秘密鍵、絶対に公開禁止）
=======================================
```

両方をメモしておく。

### 方法 B: オンラインジェネレーター
https://vapidkeys.com で生成も可能。

---

## 2. クライアント側に **公開鍵** をセット

`js/config.js` を開いて、冒頭の `window.VAPID_PUBLIC_KEY` に **公開鍵** を貼り付け：

```js
window.VAPID_PUBLIC_KEY = 'BNbXC...';   // ← 1. で発行した Public Key
```

その後、ビルド・デプロイし直し：

```bash
./build.sh --deploy
```

→ Downloads/ の中身を GitHub に再アップロード。

---

## 3. Supabase に **秘密鍵** をセット

ダッシュボード → **Project Settings → Edge Functions → Secrets** で下記を登録：

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | 1. の公開鍵（同じものを Edge Function 側でも使う） |
| `VAPID_PRIVATE_KEY` | 1. の秘密鍵 |
| `VAPID_SUBJECT` | `mailto:your-email@example.com`（連絡先メアド or URL） |

> `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は自動でセットされているので追加不要。

---

## 4. Edge Function をデプロイ

### 方法 A: Supabase CLI（推奨）

CLI 未インストールなら：
```bash
brew install supabase/tap/supabase
supabase login
```

プロジェクトをリンク：
```bash
cd ~/Desktop/enishinoma
supabase link --project-ref ogshjcqkvuidlaenawth
```

デプロイ：
```bash
supabase functions deploy send-push --no-verify-jwt
```

> `--no-verify-jwt` でクライアントの auth トークン無しでも呼べる（ただし RLS は引き続き効く）。
> 認証強化したい時はこのフラグを外して、ログイン済みユーザーだけが呼べるように制限。

### 方法 B: Supabase ダッシュボード経由

CLI が面倒な場合：

1. ダッシュボード → **Edge Functions → Create a new function**
2. Name: `send-push`
3. インラインエディタで `supabase/functions/send-push/index.ts` の中身を全部コピペ
4. **Deploy function**

---

## 5. 動作確認

### a) クライアント側で通知購読

1. ローカルサーバを起動：`python3 -m http.server 8766`
2. http://localhost:8766/ にログイン
3. プロフィールモーダル下の **「🔔 通知をオンにする」** ボタンをクリック
4. ブラウザが通知許可を求めるので **「許可」**
5. ダイアログで「通知をオンにしました」と出れば購読 OK

### b) admin からテスト送信

1. http://localhost:8766/admin/ にログイン
2. ダッシュボード下の **「▼ Web Push 通知」** セクションで **「📡 全ユーザーにテスト Push を送信」** をクリック
3. **「✓ 送信しました\n配信:1 / 失敗:0 / 失効:0」** と出れば成功
4. 同じブラウザで通知バーに「📡 縁の間 テスト通知」が表示される 🎯

### c) 自動トリガー確認（実運用）

下記のタイミングで自動的に Push が飛ぶようになっている：

| トリガー | 受信側 | 通知内容 |
|---|---|---|
| マッチング申請（「話してみたい」） | 申請を受けたユーザー | 💝 マッチング申請が届きました |
| マッチ承認（「お話しOK」） | 申請を送った人 | 🎉 マッチが成立しました！ |
| カップル成立（「付き合いました！」） | 相手 | 🎊 カップル成立！ |
| 管理者が問い合わせに返信 | 問い合わせ送信者 | 📩 運営からの返信が届きました |
| 管理者がメッセージに返信 | メッセージ送信者 | 💬 運営からのメッセージ |
| 全体アナウンス送信 | 全ユーザー（購読済み） | 📢 縁の間からのお知らせ |

---

## 6. トラブルシュート

| 症状 | 確認ポイント |
|---|---|
| 「VAPID keys are not configured」エラー | Supabase の Secrets に `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` が登録されているか |
| クライアントで「通知機能は現在準備中です」アラート | `js/config.js` の `window.VAPID_PUBLIC_KEY` が空 |
| 「Edge Function not found」エラー | デプロイがまだ。`supabase functions deploy send-push` を実行 |
| 「failed for ..., 410」のログ | subscription が期限切れ。自動で DB からクリアされるので問題なし |
| 通知が来ない（送信は成功） | ブラウザの通知許可 / OS の通知設定を確認 |

---

## 7. 削除・無効化

### 一時的に Push を止めたい
`js/config.js` の `window.VAPID_PUBLIC_KEY` を空に → ビルド → デプロイ。
クライアント側で UI が消える＋ `sendPushNotification` が即 return する。

### Edge Function を削除
```bash
supabase functions delete send-push
```

---

## 8. 将来の拡張アイデア

- **複数端末対応**：現状 `profiles.push_subscription` は 1 ユーザー 1 件。複数端末で受け取りたいなら `push_subscriptions` テーブルを切る
- **通知種別ごとの ON/OFF**：マッチだけ受け取りたい、メッセージは受け取らない…のような細かい設定
- **時間帯フィルタ**：深夜は配信しない（quiet hours）
- **iOS Safari (16.4+)**：PWA インストール後ならフル対応。それ以前の Safari は Push 未対応
