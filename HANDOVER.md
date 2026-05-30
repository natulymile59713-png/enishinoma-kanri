# 縁の間 - えにしのま - 引継ぎドキュメント

最終更新: 2026-05-28

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
├── js/                                ← 16ファイル（sentry-init, recaptcha-init, utils, config, pillars, state, supabase, ui-orient/register/match/chat/other/shindan/calendar, interests, app）
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
- `profiles` — ユーザープロフィール（plan, profile_text, banned_at, bank_*, **withdrawal_type ('banned'|'approved')**, **interest_tags (jsonb)**, **graduated_at**, push_subscription, avatar_url, last_official_chat_read_at, など）
- `matches` — マッチング申請（status: pending/matched/chatting/date_set/coupled/reviewed/rejected）
- `reviews` — 卒業時のレビュー
- `contacts` — 問い合わせ・運営チャット（contact_type で分岐。`退会申請` で振り分け）
- `reports` — 通報
- `sotsugyou_requests` — 卒業申請（双方申請＋運営承認）
- `cashbacks` — 紹介キャッシュバック
- `bookings` — 鑑定予約（**kantei_method** カラムで鑑定方式記録）
- `messages` — ユーザー間メッセージ（match_id, sender_id, body, **read_at**。1人30通上限トリガー付き）
- `announcements` — 全体アナウンス

### 主なRPC
- `is_admin()` — 管理者判定（SECURITY DEFINER）
- `is_phone_banned(p_phone)` — 退会処分済電話番号チェック（`withdrawal_type='banned'` のみブロック、`approved` は許可）
- `lookup_user_by_member_id(p_member_id)` — 会員IDからユーザー検索
- `get_booked_slots(p_year, p_month)` — 予約済枠の取得（公開）
- `ban_user_account(uuid, text)` — 退会処分（withdrawal_type='banned'）
- `approve_withdrawal(uuid, text)` — 退会承認（withdrawal_type='approved' + auth.users.email をアーカイブ化 → 同メアド再登録可）

### 実行済み SQL ファイル（admin/ 内）
- setup.sql （contacts + admin role基盤）
- setup-users.sql（phone, banned 関連）
- setup-reports.sql（reports + 警告メッセージ用 contacts admin INSERT）
- setup-sotsugyou.sql（sotsugyou_requests + cashbacks）
- setup-bookings.sql（bookings + attendance_type + kantei_method）
- setup-announcements.sql（announcements）
- setup-plans.sql（plan, created_at, profile_text）
- setup-messages.sql（messages テーブル + RLS + 30通上限）
- setup-message-moderation.sql（メッセージモデレーション強化）
- setup-couple-exclusive.sql（カップル成立後の他マッチ排他制御）
- setup-couple-notice.sql（カップル成立通知）
- setup-graduation-certify.sql（グルメ卒業認定）
- setup-dm-read.sql（messages.read_at + 既読同期）
- setup-withdrawal-type.sql（退会2系統化 + ban_user_account / approve_withdrawal RPC）
- setup-matches-admin-rls.sql（管理者用 matches SELECT ポリシー）
- setup-interest-tags.sql（profiles.interest_tags jsonb）

---

## ✅ 実装完了した機能

### ユーザー側
- 3プラン制（trial/no_matching/total）プラン選択画面 + プラン別オリエンテーション
- 命式自動計算、生時刻・場所は任意
- 推しページ（マッチング申請）
- 縁リスト（マッチング管理）+ pending カードに「🔍 詳細」ボタン → `partner-profile-modal`（マッチ前はアバターぼかし、profile_text + 興味タグ表示）
- メッセージ（マッチ相手 + 運営チャット）
- 相性診断 + 結果メモ（plan制限あり）
- 運勢カレンダー（plan制限あり、**3ヶ月先まで**表示制限。上限時 ▶ ボタン半透明 + インライン通知）
- 紹介プログラム + QRコード生成
- 卒業申請（双方申請）+ 卒業鑑定プラン申し込み + 銀行口座入力
- プロフィール編集（生まれの情報、口座、プロフィール文 max500文字、**興味のあるカテゴリー編集ボタン**）
- 退会フォーム（重複防止: 申請済みなら「退会申請済み」灰色表示）
- 退会通知モーダル（処分: 強制ログアウト、承認: 24時間後ログイン不可。`localStorage` で再表示防止）
- プラン変更（その他→プランで非active タップ）
- 鑑定予約カレンダー（公開URL、1人/2人受け対応）
- ユーザー間メッセージ（マッチ相手とのリアルタイムチャット。1人30通上限。モデレーション・レート制限付き、既読 read_at 同期）
- メッセージのURL自動リンク化、改行表示、未読バッジ、ベル通知連動
- 全角→半角自動変換（メアド・電話番号）
- マッチ後の相手プロフィール画像のタップ拡大表示（フルスクリーンオーバーレイ。背景タップ/✕/ESCで閉じる。マッチ前のぼかしには未適用）
- **興味のあるカテゴリー機能**（12カテゴリ × 約180項目。最大10個選択、最大3個を「外せない⭐」強調。各カテゴリでカスタムワード1つ10文字以内入力可。新規登録時は任意「後で設定する」でスキップ可）
- カップル成立後の他マッチ排他制御 + カップル成立通知

### 管理画面
- ダッシュボード（要対応サマリー、KPI、プラン別件数）
- 問い合わせ管理（返信機能、**退会申請タップ → ユーザー詳細画面に直接遷移**）
- 通報管理（退会処分／警告メッセージ／却下）+ 通報数ヒートマップ + 通報者通知
- 卒業申請承認（双方→承認時にキャッシュバック自動生成）+ グルメ卒業認定
- 鑑定予約管理（一覧 + カレンダービュー、kantei_method 記録）
- キャッシュバック管理（口座情報閲覧＋振込済マーク）
- アナウンス（全体配信＋削除）+ 個別メッセージ送信
- ユーザー管理
  - **退会2系統ボタン**: 横並び「✅ 退会を承認」(緑) / 「🚫 退会処分」(赤)。承認は退会申請が届いている時のみ押下可（無いとグレーアウト）、デフォルト文面を自動投入
  - **ステータスバッジ**: ①フリー / ②マッチング中（ゴールド） / ③カップル成立 / ④卒業準備中（ピンク）
  - **カップル相手欄**: ③④ のみ「💕 ◯◯さん(EN-xxx)」表示
  - **利用日数欄**: 「15日」「2ヶ月12日」「1年3ヶ月5日」
  - **フィルタタブ**: 全員 / フリー / マッチング中 / カップル / 退会処分 / **卒業生**
  - **7種類のソート**: 五十音 / 歴長 / 歴浅 / 評価高低 / 年齢高低
  - ユーザー行に ★平均評価 / 📨退会申請中 バッジ
  - 検索、メッセージ送信、口座情報閲覧

---

## ⚠️ 未完了タスク

### ✅ 解消済み
- ~~メッセージページ下部の入力 → 管理画面メッセージタブ・返信フロー~~ → 2026-05-11 実装
- ~~ダッシュボードのプラン別件数を 4 プラン化~~ → 2026-05-11 実装
- ~~コード品質・運用改善（utils.js 共通化 / build.sh / Sentry 雛形 / 管理者ロール / DB 既読同期 / nav バッジ）~~ → 2026-05-11 実装
- ~~月額プラン料金の改定（trial/no_matching/total）~~ → 2026-05-20 反映（料金は `js/ui-other.js` の `PLANS_INFO` と `index.html` プラン選択画面、`js/ui-orient.js` のオリエンテーションスライドで管理）
- ~~NOマッチングプラン中の「その他」サブメニューに、相性診断/相性結果メモ/運勢カレンダーが鍵付きで残存する不具合~~ → 2026-05-20 修正（`applyPlanUI` 冒頭で `ungrayoutAllSubMenuItems()` を呼ぶように）
- ~~ユーザー間メッセージのモデレーション強化~~ → 2026-05-22 実装（`setup-message-moderation.sql`）
- ~~カップル成立後の他マッチ排他制御 + カップル成立通知~~ → 2026-05-22 実装（`setup-couple-exclusive.sql` / `setup-couple-notice.sql`）
- ~~messages の既読 read_at 同期~~ → 2026-05-23 実装（`setup-dm-read.sql`）
- ~~グルメ卒業認定機能~~ → 2026-05-24 実装（`setup-graduation-certify.sql`）
- ~~bookings.kantei_method カラム追加~~ → 2026-05-24 実装（`setup-bookings.sql` に追記）
- ~~退会フローの2系統化（処分=banned / 承認=approved）~~ → 2026-05-26 実装（`setup-withdrawal-type.sql` + `ban_user_account` / `approve_withdrawal` RPC + 退会通知モーダル）
- ~~管理画面 ユーザー一覧のステータスバッジ・カップル相手欄・利用日数・卒業生フィルタ・7種ソート~~ → 2026-05-26 実装
- ~~matches テーブル admin SELECT ポリシー漏れ~~ → 2026-05-26 修正（`setup-matches-admin-rls.sql`）。これがないとユーザー一覧のステータス計算が壊れる
- ~~縁リスト pending カードに「🔍 詳細」ボタン~~ → 2026-05-27 実装
- ~~運勢カレンダー 3ヶ月先まで制限~~ → 2026-05-27 実装（Safari `title` 属性が効かないのでインライン通知）
- ~~興味のあるカテゴリー機能（12カテゴリ × 約180項目、最大10個 + ⭐3個 + カスタムワード）~~ → 2026-05-28 実装（`setup-interest-tags.sql` + `js/interests.js`）
- ~~推しページの自動閉じバグ（`loadEnList` 内の applyFilter が detail-panel.open 中も走っていた）~~ → 2026-05-28 修正
- ~~退会前のご確認文言修正 + 退会理由に「カップル成立したため」追加~~ → 2026-05-28 実装

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
| `admin/setup-messages.sql` | `messages` テーブル + RLS + レート制限 + 送信上限(30通/人) + Realtime | ユーザー間メッセージ機能を使うなら必須 |
| `admin/setup-message-moderation.sql` | メッセージ送信時の文言フィルタ・連投制限強化 | メッセージ機能を使うなら必須 |
| `admin/setup-couple-exclusive.sql` | カップル成立時に他の pending マッチを自動 reject する排他制御 | カップル成立フローを使うなら必須 |
| `admin/setup-couple-notice.sql` | カップル成立通知（双方通知 + push） | 同上 |
| `admin/setup-dm-read.sql` | `messages.read_at` カラム + 既読同期 | 既読バッジを使うなら必須 |
| `admin/setup-graduation-certify.sql` | グルメ卒業認定（運営承認時の処理） | 卒業認定を使うなら必須 |
| `admin/setup-withdrawal-type.sql` | `profiles.withdrawal_type` + `ban_user_account` / `approve_withdrawal` RPC + `is_phone_banned` 改修 | 退会2系統化を使うなら必須 |
| `admin/setup-matches-admin-rls.sql` | 管理者用 `matches` SELECT ポリシー | 管理画面ステータス計算に必須 |
| `admin/setup-interest-tags.sql` | `profiles.interest_tags jsonb` カラム | 興味カテゴリー機能を使うなら必須 |

すべて Supabase ダッシュボード → SQL Editor で全文貼り付けて実行してください。

---

## 📝 開発スタイル・好み

- 大きな変更は提案 → 合意 → 実行
- 段階的な進行を好む
- 動作確認を都度行う
- 全角→半角の自動変換などUX配慮を入れる

---

## 🧠 実装上の注意点（過去セッションで学んだこと）

- **`supa.rpc()` は `.then()` か `await` 必須**: lazy 評価のため、付けないと実際にクエリが飛ばない
- **admin RLS は `is_admin()` 関数で書く**: `admin_role IS NOT NULL` だと NULL の admin が抜ける
- **新テーブル追加時は admin SELECT ポリシーを忘れずに**: 過去 `matches` で漏れて管理画面のステータス計算が壊れた
- **auth.users への更新**: SECURITY DEFINER + `SET search_path = public, auth` で OK（postgres role なら auth スキーマも書ける）
- **flex 子の input が overflow** → `min-width: 0` を必ず付ける（flex item の min-size のデフォルトは auto = content size）
- **詳細パネル開いてる時にバックグラウンド更新で消える**: polling/realtime sub の re-render を `.detail-panel.open` ガードで抑制
- **Safari は SW + キャッシュが頑固**: SW unregister + ⌥+⌘+E（キャッシュ空に）+ ⌘+R が確実
- **Safari の `title` 属性は効かない**: ツールチップは title 属性ではなくインライン通知に変える
- **興味カテゴリ UI** は `.interest-selector-body` (class) を使う（登録 + モーダル両方で同じレンダラー）
- **ビルドは必ず `~/Desktop/enishinoma/` で**: Downloads/*.html はビルド成果物、直接編集禁止
- **⚠️ 新規 JS モジュール追加時は `build.py` の `USER_JS` リストにも追加する**: HTML 側に `<script src="js/xxx.js">` だけ書いても、`build.py` のリストに入れないとバンドルから漏れて、本番(GitHub Pages)では 404 になり関数が `undefined` になる。過去 `interests.js` でこの罠を踏んだ(2026-05-28)。確認方法: `grep -c "<script src=\"js/" ~/Downloads/enishinoma-user-app/index.html` が 0 になっていれば全部インライン化済み
