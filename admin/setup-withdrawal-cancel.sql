-- ============================================
-- 縁の間 退会申請の取り消し（ユーザー側）
--   ユーザーが「退会申請を取り消す」ボタンを押した時に呼ばれる
--   contacts の自分の open な退会申請を 'cancelled_by_user' にする
--   （contacts の UPDATE は admin のみ許可されているため SECURITY DEFINER で迂回）
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

DROP FUNCTION IF EXISTS cancel_withdrawal_request();
CREATE OR REPLACE FUNCTION cancel_withdrawal_request()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cwr$
DECLARE
  caller uuid := auth.uid();
  v_count int := 0;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- 自分の open な退会申請をすべて 'cancelled_by_user' に
  UPDATE contacts
     SET status = 'cancelled_by_user'
   WHERE user_id = caller
     AND contact_type = '退会申請'
     AND status = 'open';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cancelled_count', v_count
  );
END;
$cwr$;
GRANT EXECUTE ON FUNCTION cancel_withdrawal_request() TO authenticated;

-- ============================================
-- 動作確認:
--   -- 呼出側で実行
--   SELECT cancel_withdrawal_request();
--
--   -- 取り消し済みになったか確認:
--   SELECT id, contact_type, status, left(body, 30) FROM contacts
--    WHERE contact_type='退会申請'
--    ORDER BY created_at DESC LIMIT 5;
-- ============================================
