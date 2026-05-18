-- ============================================
-- 縁の間 既読状態を DB へ
-- 実行タイミング: setup.sql の後、いつでも
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 目的:
--   現状は運営チャットの最終既読時刻を localStorage に保存しているため、
--   デバイスを変えると「未読バッジ」がリセットされる問題があった。
--   profiles.last_official_chat_read_at に同じ情報を DB へ保存し、
--   localStorage と DB の新しい方を採用することでデバイス間で同期させる。
--
-- 必要権限:
--   ユーザーは自分の profile を更新できることが前提（既存のポリシーで充足）。

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_official_chat_read_at timestamptz;

-- 既存ユーザーの初期値は NULL のままで OK
-- （初回ログイン時に openOfficialChat() で更新される）
