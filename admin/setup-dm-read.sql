-- ============================================
-- 縁の間 ユーザー間DM 既読機能
-- 実行タイミング: setup-messages.sql 実行後
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文貼り付けて Run
-- ============================================

-- 1. messages.read_at カラム追加（NULL = 未読、値あり = 既読）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_match_read ON messages(match_id, read_at);

-- 2. 既読化 RPC（クライアントから呼ぶ）
-- SECURITY DEFINER で RLS をバイパス → 「相手が送ったメッセージを自分が読んだ」更新を実行
DROP FUNCTION IF EXISTS mark_messages_read(uuid);

CREATE OR REPLACE FUNCTION mark_messages_read(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mmr$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  -- 自分がこのマッチの当事者か確認
  IF NOT EXISTS (
    SELECT 1 FROM matches WHERE id = p_match_id
      AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_match_member';
  END IF;
  -- 相手が送った未読メッセージを既読化
  UPDATE messages
     SET read_at = now()
   WHERE match_id = p_match_id
     AND sender_id <> auth.uid()
     AND read_at IS NULL;
END;
$mmr$;

GRANT EXECUTE ON FUNCTION mark_messages_read(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT id, sender_id, read_at FROM messages WHERE match_id='<some>' ORDER BY created_at DESC;
--
-- 完全削除:
--   DROP FUNCTION IF EXISTS mark_messages_read(uuid);
--   ALTER TABLE messages DROP COLUMN IF EXISTS read_at;
-- ============================================
