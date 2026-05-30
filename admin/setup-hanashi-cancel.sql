-- ============================================
-- 縁の間 「話してみたい」(お話し申請) の通知 + キャンセル
--   1. send_hanashi_notice : 申請者が hanashi() 直後に呼ぶ。相手の運営チャットに通知 INSERT
--   2. cancel_hanashi_request : 申請者がキャンセルボタンを押した時に呼ぶ。
--      pending マッチを DELETE + 相手の運営チャットにキャンセル通知 INSERT
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. お話し申請 受信通知 RPC
DROP FUNCTION IF EXISTS send_hanashi_notice(uuid);
CREATE OR REPLACE FUNCTION send_hanashi_notice(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $shn$
DECLARE
  caller uuid := auth.uid();
  my_nickname text;
  partner_nickname text;
  partner_member_id text;
  notice_body text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT nickname INTO my_nickname FROM profiles WHERE id = caller;
  SELECT nickname, member_id INTO partner_nickname, partner_member_id
    FROM profiles WHERE id = p_partner_id;

  notice_body := COALESCE(my_nickname, 'お相手') || E'さんからお話し申請が来ました！';

  -- 毎回必ず INSERT（重複防止は撤廃。各申請ごとに通知を残す）
  INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
    (p_partner_id, partner_member_id, partner_nickname, '運営通知', notice_body, 'replied');

  RETURN jsonb_build_object('partner_id', p_partner_id, 'success', true, 'inserted', true);
END;
$shn$;
GRANT EXECUTE ON FUNCTION send_hanashi_notice(uuid) TO authenticated;


-- 2. お話し申請キャンセル RPC
DROP FUNCTION IF EXISTS cancel_hanashi_request(uuid);
CREATE OR REPLACE FUNCTION cancel_hanashi_request(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $chr$
DECLARE
  m matches%ROWTYPE;
  caller uuid := auth.uid();
  my_nickname text;
  partner_id uuid;
  partner_nickname text;
  partner_member_id text;
  notice_body text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- 申請者(from_user_id) からのみキャンセル可
  IF caller <> m.from_user_id THEN
    RAISE EXCEPTION 'only_sender_can_cancel';
  END IF;

  -- pending 状態でないとキャンセル不可（承認後/拒否後は別フロー）
  IF m.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status_for_cancel: %', m.status;
  END IF;

  partner_id := m.to_user_id;

  -- マッチを削除（pending のままだったので戻せる）
  DELETE FROM matches WHERE id = p_match_id;

  -- 相手の運営チャットにキャンセル通知 INSERT
  SELECT nickname INTO my_nickname FROM profiles WHERE id = caller;
  SELECT nickname, member_id INTO partner_nickname, partner_member_id
    FROM profiles WHERE id = partner_id;

  notice_body := COALESCE(my_nickname, 'お相手') || E'さんがお話し申請をキャンセルしました。';

  INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
    (partner_id, partner_member_id, partner_nickname, '運営通知', notice_body, 'replied');

  RETURN jsonb_build_object('partner_id', partner_id, 'success', true);
END;
$chr$;
GRANT EXECUTE ON FUNCTION cancel_hanashi_request(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT send_hanashi_notice('<partner_user_id>');
--   SELECT cancel_hanashi_request('<match_id>');
--
--   -- 通知が入ったか:
--   SELECT user_id, contact_type, left(body, 40) FROM contacts
--    WHERE contact_type='運営通知' ORDER BY created_at DESC LIMIT 5;
-- ============================================
