-- ============================================
-- 縁の間 卒業認定 機能
-- 実行方法: Supabase SQL Editor に全文貼り付けて Run
-- ============================================
-- 卒業鑑定の予約後、運営が「認定」ボタンを押すとこの RPC が呼ばれる。
-- profiles.graduated_at にタイムスタンプを記録 + 運営通知メッセージを INSERT。
-- 認定済ユーザーのみ「卒業生の間」(NOマッチングプラン) を利用可能。

-- 1. graduated_at / graduated_by カラム追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduated_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduated_by uuid REFERENCES auth.users(id);

-- 2. RPC: 卒業認定（管理者専用、複数ユーザー一括対応）
DROP FUNCTION IF EXISTS certify_graduation(uuid[]);

CREATE OR REPLACE FUNCTION certify_graduation(p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cg$
DECLARE
  uid uuid;
  prof record;
  msg_body text := '🎓 卒業が認定されました！

NOマッチングプランに切り替えで「卒業生の間」へ参加できます🎉

「その他」→「プラン」→「NOマッチング」を選択してください。';
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  FOREACH uid IN ARRAY p_user_ids LOOP
    SELECT id, member_id, nickname, graduated_at
      INTO prof
      FROM profiles WHERE id = uid;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- 既に認定済ならスキップ（重複通知防止）
    IF prof.graduated_at IS NOT NULL THEN CONTINUE; END IF;
    -- 認定タイムスタンプ
    UPDATE profiles
       SET graduated_at = now(),
           graduated_by = auth.uid()
     WHERE id = uid;
    -- 運営通知をユーザーの公式チャットへ
    INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status)
    VALUES (uid, prof.member_id, prof.nickname, '運営通知', msg_body, 'replied');
  END LOOP;
END;
$cg$;

GRANT EXECUTE ON FUNCTION certify_graduation(uuid[]) TO authenticated;

-- ============================================
-- 動作確認:
--   認定済ユーザー一覧:
--   SELECT member_id, nickname, graduated_at FROM profiles WHERE graduated_at IS NOT NULL;
--
--   解除（再テスト用、特定ユーザー）:
--   UPDATE profiles SET graduated_at=NULL, graduated_by=NULL WHERE member_id IN ('EN-XXXXXXXX');
--   DELETE FROM contacts WHERE contact_type='運営通知' AND body LIKE '🎓 卒業が認定%';
-- ============================================
