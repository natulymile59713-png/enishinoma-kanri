-- ============================================
-- 縁の間 Web Push 通知の購読情報
-- 実行タイミング: 他の setup-*.sql の後、いつでも
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 目的:
--   ブラウザの PushManager.subscribe() で取得した subscription オブジェクトを
--   profiles.push_subscription に保存する。Edge Function 経由で配信する時に
--   このカラムを SELECT して使う。
--
-- データ形式 (JSON):
--   {
--     "endpoint": "https://fcm.googleapis.com/...",
--     "keys": { "p256dh": "...", "auth": "..." }
--   }
--
-- 注意:
--   - 1ユーザー 1サブスクリプション（最後に購読した端末のみ送信される）
--   - 複数端末対応にしたい場合は、別テーブル `push_subscriptions` を切る方が良い
--     （ユーザー×端末で複数行）。MVP では 1:1 で進める。

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscribed_at timestamptz;

-- インデックス（Edge Function で「購読済みユーザーだけ抽出」する時用）
CREATE INDEX IF NOT EXISTS profiles_push_subscribed_idx
  ON profiles ((push_subscription IS NOT NULL));

-- ============================================
-- 取り消し:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS push_subscription;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS push_subscribed_at;
-- ============================================
