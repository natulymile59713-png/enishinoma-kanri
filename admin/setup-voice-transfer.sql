-- ============================================
-- 縁の間 卒業生の間「転入」機能 + 婚姻状態
--
-- ・NOマッチングプランの人が「卒業生の間 転入申請」→ 運営承認で卒業生の間に参加可能。
--   profiles.voice_transfer_at に承認日時を入れる（卒業認定 graduated_at とは別ルート）。
-- ・メンバーの婚姻状態（未婚/既婚/離婚）を profiles.marital_status に保持（バッジ表示用）。
--   卒業生は基本「既婚」（未設定なら既婚扱い）。転入生は申請時に申告。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS voice_transfer_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marital_status text
  CHECK (marital_status IS NULL OR marital_status IN ('未婚','既婚','離婚'));

-- 転入承認 RPC（管理者のみ）。承認すると卒業生の間に参加できるようになる。
CREATE OR REPLACE FUNCTION approve_voice_transfer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE profiles SET voice_transfer_at = now() WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION approve_voice_transfer(uuid) TO authenticated;

-- 転入承認の解除（取り消し）RPC（管理者のみ）
CREATE OR REPLACE FUNCTION revoke_voice_transfer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE profiles SET voice_transfer_at = NULL WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION revoke_voice_transfer(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT id, nickname, graduated_at, voice_transfer_at, marital_status FROM profiles
--     WHERE graduated_at IS NOT NULL OR voice_transfer_at IS NOT NULL;
-- ============================================
