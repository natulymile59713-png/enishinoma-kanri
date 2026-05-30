-- ============================================
-- 縁の間 退会の種類を区別する（処分 / 承認）
-- 退会処分(banned): 同電話・同メアド再登録不可
-- 退会承認(approved): 同電話・同メアド再登録可（旧データはアプリ内に残る、auth.users.email はアーカイブ化）
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. profiles に種別カラム追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_type text
  CHECK (withdrawal_type IS NULL OR withdrawal_type IN ('banned','approved'));

-- 既存の banned_at がある(処分済)ユーザーは 'banned' 扱いに移行
UPDATE profiles
   SET withdrawal_type = 'banned'
 WHERE banned_at IS NOT NULL AND withdrawal_type IS NULL;

-- 2. is_phone_banned を更新: 'banned' のみブロック、approved は許可
CREATE OR REPLACE FUNCTION is_phone_banned(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE phone_number = p_phone
      AND banned_at IS NOT NULL
      AND withdrawal_type = 'banned'
  );
$$;
GRANT EXECUTE ON FUNCTION is_phone_banned(text) TO anon, authenticated;

-- 3. 退会処分 RPC（同電話 + 同メアド 完全ブロック）+ 運営通知 INSERT
DROP FUNCTION IF EXISTS ban_user_account(uuid, text);
CREATE OR REPLACE FUNCTION ban_user_account(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $bua$
DECLARE
  v_member_id text;
  v_nickname text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  SELECT member_id, nickname INTO v_member_id, v_nickname FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET
    banned_at = now(),
    banned_reason = p_reason,
    banned_by = auth.uid(),
    withdrawal_type = 'banned'
  WHERE id = p_user_id;
  -- ユーザーの運営チャットに通知（Realtime で picked up → ポップアップ表示）
  INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
    (p_user_id, v_member_id, v_nickname, '退会処分通知', p_reason, 'replied');
END;
$bua$;
GRANT EXECUTE ON FUNCTION ban_user_account(uuid, text) TO authenticated;

-- 4. 退会承認 RPC（同電話・同メアド 再登録可。auth.users.email をアーカイブ化）+ 運営通知 INSERT
-- ⚠️ auth.users へ書込するため SECURITY DEFINER + postgres 権限が必要
DROP FUNCTION IF EXISTS approve_withdrawal(uuid, text);
CREATE OR REPLACE FUNCTION approve_withdrawal(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $apw$
DECLARE
  archive_email text;
  v_member_id text;
  v_nickname text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  SELECT member_id, nickname INTO v_member_id, v_nickname FROM profiles WHERE id = p_user_id;
  archive_email := 'archived_' || replace(p_user_id::text, '-', '') || '@enishinoma.local';
  -- profile を退会承認状態に
  UPDATE profiles SET
    banned_at = now(),
    banned_reason = p_reason,
    banned_by = auth.uid(),
    withdrawal_type = 'approved'
  WHERE id = p_user_id;
  -- 運営通知を contacts に追加（24h後のログイン拒否までは継続使用可、その間に通知表示）
  INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
    (p_user_id, v_member_id, v_nickname, '退会承認通知', p_reason, 'replied');
  -- auth.users.email を退避（同メアド再登録を可能にする）
  UPDATE auth.users SET
    email = archive_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'original_email_archived', true,
        'archived_at', now()::text
      )
  WHERE id = p_user_id;
END;
$apw$;
GRANT EXECUTE ON FUNCTION approve_withdrawal(uuid, text) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT id, nickname, banned_at, withdrawal_type FROM profiles WHERE banned_at IS NOT NULL;
--   SELECT is_phone_banned('09012345678');
-- ============================================
