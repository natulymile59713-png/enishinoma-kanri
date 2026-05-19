# 縁の間 - えにしのま - 引継ぎドキュメント

最終更新: 2026-05-20

## 概要
四柱推命に基づくマッチングサービス。プラン制で、ユーザー側 + 管理サイト + 予約ページの3つで構成。

---

## 📂 プロジェクト構成

### ローカル
```
~/Desktop/enishinoma/                  ← gitリポジトリ（ローカル）
├── index.html                         ← ユーザーアプリ（モジュール版）
├── css/styles.css
├── manifest.json, service-worker.js, icons/  ← PWA アセット
├── js/                                ← 15ファイル（sentry-init, recaptcha-init, utils, config, pillars, state, supabase, ui-orient/register/match/chat/other/shindan/calendar, app）
├── admin/                             ← 管理サイト
│   ├── index.html, css/, js/{sentry-init.js, recaptcha-init.js, utils.js, admin-app.js}
│   ├── manifest.json, service-worker.js, icons/
│   └── setup-*.sql / setup-*.md       ← DB マイグレーション SQL と操作手順書
├── booking/                           ← 予約ページ（公開）
│   ├── index.html, css/, js/{sentry-init.js, recaptcha-init.js, utils.js, booking.js}
│   └── manifest.json, service-worker.js, icons/
├── supabase/functions/send-push/      ← Push 配信 Edge Function（Deno / index.ts）
├── dist/                              ← バンドル版（インライン化済み + PWA アセット同梱）
│   ├── index.html       (ユーザー)
│   ├── admin.html       (管理)
│   ├── booking.html     (予約)
│   └── {manifest.json, service-worker.js, icons/, admin/, booking/}
├── build.py / build.sh                ← dist 生成 + Downloads コピー
├── .github/workflows/                 ← GitHub Actions（build.yml）
└── HANDOVER.md                        ← このファイル
```

### Downloads（GitHub Pages 用）
```
~/Downloads/
├── enishinoma-user-app/               ← enisinma-app1.1 へアップ用
│   └── index.html
└── enishinoma-kanri-files/            ← enishinoma-kanri へアップ用
    ├── README.md
    ├── admin/index.html
    └── booking/index.html
```

---

## 🌐 公開URL

| 用途 | URL | リポジトリ |
|---|---|---|
| ユーザーアプリ | https://natulymile59713-png.github.io/enisinma-app1.1/ | `enisinma-app1.1` |
| 管理画面 | https://natulymile59713-png.github.io/enishinoma-kanri/admin/ | `enishinoma-kanri` |
| 予約ページ | https://natulymile59713-png.github.io/enishinoma-kanri/booking/ | 同上 |

GitHub: natulymile59713-png

---

## 🗄️ データベース（Supabase）

URL: `https://ogshjcqkvuidlaenawth.supabase.co`

### テーブル一覧
- `profiles` — ユーザープロフィール（plan, profile_text, banned_at, bank_*, など）
- `matches` — マッチング申請（status: pending/matched/chatting/date_set/coupled/reviewed/rejected）
- `reviews` — 卒業時のレビュー
- `contacts` — 問い合わせ・運営チャット（contact_type で分岐）
- `reports` — 通報
- `sotsugyou_requests` — 卒業申請（双方申請＋運営承認）
- `cashbacks` — 紹介キャッシュバック
- `bookings` — 鑑定予約
- `announcements` — 全体アナウンス

### 主なRPC
- `is_admin()` — 管理者判定（SECURITY DEFINER）
- `is_phone_banned(p_phone)` — 退会処分済電話番号チェック
- `lookup_user_by_member_id(p_member_id)` — 会員IDからユーザー検索
- `get_booked_slots(p_year, p_month)` — 予約済枠の取得（公開）

### 実行済み SQL ファイル（admin/ 内）
- setup.sql （contacts + admin role基盤）
- setup-users.sql（phone, banned 関連）
- setup-reports.sql（reports + 警告メッセージ用 contacts admin INSERT）
- setup-sotsugyou.sql（sotsugyou_requests + cashbacks）
- setup-bookings.sql（bookings + attendance_type）
- setup-announcements.sql（announcements）
- setup-plans.sql（plan, created_at, profile_text）

---

## ✅ 実装完了した機能

### ユーザー側
- 3プラン制（trial/no_matching/total）プラン選択画面 + プラン別オリエンテーション
- 命式自動計算、生時刻・場所は任意
- 推しページ（マッチング申請）
- 縁リスト（マッチング管理）
- メッセージ（マッチ相手 + 運営チャット）
- 相性診断 + 結果メモ（plan制限あり）
- 運勢カレンダー（plan制限あり）
- 紹介プログラム + QRコード生成
- 卒業申請（双方申請）+ 卒業鑑定プラン申し込み + 銀行口座入力
- プロフィール編集（生まれの情報、口座、プロフィール文 max500文字）
- 退会フォーム
- プラン変更（その他→プランで非active タップ）
- 鑑定予約カレンダー（公開URL、1人/2人受け対応）
- メッセージのURL自動リンク化、改行表示、未読バッジ、ベル通知連動
- 全角→半角自動変換（メアド・電話番号）
- マッチ後の相手プロフィール画像のタップ拡大表示（フルスクリーンオーバーレイ。背景タップ/✕/ESCで閉じる。マッチ前のぼかしには未適用）

### 管理画面
- ダッシュボード（要対応サマリー、KPI、プラン別件数）
- 問い合わせ管理（返信機能）
- 通報管理（退会処分／警告メッセージ／却下）+ 通報数ヒートマップ + 通報者通知
- 卒業申請承認（双方→承認時にキャッシュバック自動生成）
- 鑑定予約管理（一覧 + カレンダービュー）
- キャッシュバック管理（口座情報閲覧＋振込済マーク）
- アナウンス（全体配信＋削除）+ 個別メッセージ送信
- ユーザー管理（検索、退会処分、メッセージ送信、口座情報閲覧）

---

## ⚠️ 未完了タスク

### ✅ 解消済み
- ~~メッセージページ下部の入力 → 管理画面メッセージタブ・返信フロー~~ → 2026-05-11 実装
- ~~ダッシュボードのプラン別件数を 4 プラン化~~ → 2026-05-11 実装
- ~~コード品質・運用改善（utils.js 共通化 / build.sh / Sentry 雛形 / 管理者ロール / DB 既読同期 / nav バッジ）~~ → 2026-05-11 実装
- ~~月額プラン料金の改定（trial/no_matching/total）~~ → 2026-05-20 反映（料金は `js/ui-other.js` の `PLANS_INFO` と `index.html` プラン選択画面、`js/ui-orient.js` のオリエンテーションスライドで管理）
- ~~NOマッチングプラン中の「その他」サブメニューに、相性診断/相性結果メモ/運勢カレンダーが鍵付きで残存する不具合~~ → 2026-05-20 修正（`applyPlanUI` 冒頭で `ungrayoutAllSubMenuItems()` を呼ぶように）

### 後日対応
- **メールテンプレート**: Supabase の Confirm signup を日本語化（ダッシュボード設定のみ）
- **カスタムSMTP**: Resend 等の設定（無料3000通/月、本番運用に必須）
- **決済機能**: プラン変更・新規登録・退会時の課金処理（Stripe等）
- **メール認証ON**: テスト中は Authentication > Email > Confirm email を OFF にしているはず（要確認）

### 既知の制約
- 既存ユーザーの `created_at` はマイグレーション時刻になっている（過去のアナウンスは見えない）
- 退会処分時の電話番号BANは setup-users.sql の `is_phone_banned` で実装済み
- 退会フォームの「再登録できる」仕様は、admin が手動で auth.users + profiles を完全削除する想定

---

## 🚀 開発再開時の手順

### 1. ローカル開発サーバー起動
```bash
cd /Users/kazmac/Desktop/enishinoma && python3 -m http.server 8766 &
cd /Users/kazmac/Desktop/enishinoma && python3 -m http.server 8767 &
```

URL：
- ユーザーA: http://localhost:8766/index.html
- ユーザーB: http://localhost:8767/index.html
- 管理: http://localhost:8766/admin/
- 予約: http://localhost:8766/booking/

### 2. 変更後の dist 再ビルド & Downloads コピー
```bash
cd /Users/kazmac/Desktop/enishinoma
./build.sh           # dist 生成のみ
./build.sh --deploy  # dist 生成 + Downloads コピーまで（GitHub にアップする時）
```

### 3. GitHub にアップロード
ブラウザで該当リポジトリの `Add file → Upload files` から差し替え。
将来的には `.github/workflows/build.yml` で自動化可能（`.github/workflows/README.md` 参照）。

---

## 🆕 追加された SQL マイグレーション（実行漏れに注意）

| ファイル | 内容 | 必須 |
|---|---|---|
| `admin/setup-admin-roles.sql` | `admin_role` カラム + `can_edit_admin()` / `my_admin_role()` 関数 | viewer ロールを使うなら必須 |
| `admin/setup-read-state.sql` | `profiles.last_official_chat_read_at` カラム | 複数デバイス間で運営チャットの既読を同期するなら必須 |
| `admin/setup-rate-limits.sql` | contacts/reports/matches/bookings の BEFORE INSERT トリガーで連投制限 | bot 対策の二重防御。必須推奨 |
| `admin/setup-email-confirmation.md` | Supabase ダッシュボード設定手順 + 日本語メールテンプレ（SQL ではなく操作手順書） | メール認証を有効化するなら必須 |
| `admin/setup-realtime.sql` | supabase_realtime publication に 7 テーブル追加（WebSocket push 有効化） | Realtime 即時反映を使うなら必須 |
| `admin/setup-avatars.sql` | `profiles.avatar_url` カラム + Storage `avatars` バケット + RLS ポリシー | プロフィール画像を使うなら必須 |
| `admin/setup-push.sql` | `profiles.push_subscription` (jsonb) + `push_subscribed_at` カラム | Web Push 通知を使うなら必須 |
| `admin/setup-edge-function-push.md` | VAPID キー発行 + Edge Function `send-push` デプロイ手順書 | Push 配信を有効化するなら必須（操作手順書） |
| `supabase/functions/send-push/index.ts` | Push 配信 Edge Function コード本体 | 上記手順書からデプロイする対象ファイル |

両方とも Supabase ダッシュボード → SQL Editor で全文貼り付けて実行してください。

---

## 📝 開発スタイル・好み

- 大きな変更は提案 → 合意 → 実行
- 段階的な進行を好む
- 動作確認を都度行う
- 全角→半角の自動変換などUX配慮を入れる
