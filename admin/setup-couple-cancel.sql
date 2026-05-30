-- ============================================
-- 縁の間 「付き合いました！」申請キャンセル / マッチ終了通知
--   date_set 状態でユーザーがレビューを送信したとき:
--     - 相手の運営チャットに通知 INSERT
--     - 申請が立っていた場合: 「○○さんが付き合いました！申請をキャンセルしました…」
--     - 申請が無かった場合: 「○○さんがマッチを終了しました…」
--   さらに 縁リスト表示用に「相手がレビュー済か」を確認する RPC
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. マッチ終了通知 RPC（呼出者が自分側のレビューを送信した直後に呼ぶ）
DROP FUNCTION IF EXISTS notify_match_terminated(uuid);
CREATE OR REPLACE FUNCTION notify_match_terminated(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $nmt$
DECLARE
  m matches%ROWTYPE;
  caller uuid := auth.uid();
  my_nickname text;
  partner_id uuid;
  partner_nickname text;
  partner_member_id text;
  was_request_pending boolean;
  notice_body text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF caller = m.from_user_id THEN
    partner_id := m.to_user_id;
  ELSIF caller = m.to_user_id THEN
    partner_id := m.from_user_id;
  ELSE
    RAISE EXCEPTION 'not_match_member';
  END IF;

  -- どちらかが「付き合いました！」申請済みなら "申請をキャンセル" 文言
  was_request_pending := (m.from_user_coupled_at IS NOT NULL OR m.to_user_coupled_at IS NOT NULL);

  SELECT nickname INTO my_nickname FROM profiles WHERE id = caller;
  SELECT nickname, member_id INTO partner_nickname, partner_member_id
    FROM profiles WHERE id = partner_id;

  IF was_request_pending THEN
    notice_body := COALESCE(my_nickname, 'お相手') ||
      E'さんが付き合いました！申請をキャンセルしました。\nレビューをして新しい相手を探しましょう。';
  ELSE
    notice_body := COALESCE(my_nickname, 'お相手') ||
      E'さんがマッチを終了しました。\nレビューをして新しい相手を探しましょう。';
  END IF;

  -- 重複防止: 同じマッチ・同じ申請者の終了通知が既にあればスキップ
  IF NOT EXISTS (
    SELECT 1 FROM contacts
     WHERE contact_type = '運営通知'
       AND user_id = partner_id
       AND (body LIKE (COALESCE(my_nickname, 'お相手') || E'さんが付き合いました！申請をキャンセルしました%')
         OR body LIKE (COALESCE(my_nickname, 'お相手') || E'さんがマッチを終了しました%'))
  ) THEN
    INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
      (partner_id, partner_member_id, partner_nickname, '運営通知', notice_body, 'replied');
  END IF;

  RETURN jsonb_build_object(
    'partner_id', partner_id,
    'was_request_pending', was_request_pending
  );
END;
$nmt$;
GRANT EXECUTE ON FUNCTION notify_match_terminated(uuid) TO authenticated;


-- 2. 相手レビュー有無判定 RPC（縁リスト描画時に「○○さんが申請をキャンセル」バッジへ切替える判定用）
--   - 呼出者が当事者である match のみ対象
--   - 相手 (= 呼出者ではない側) がそのマッチでレビューを送信していれば match_id を返す
DROP FUNCTION IF EXISTS get_partner_reviewed_match_ids(uuid[]);
CREATE OR REPLACE FUNCTION get_partner_reviewed_match_ids(p_match_ids uuid[])
RETURNS TABLE(match_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT r.match_id
    FROM reviews r
    JOIN matches m ON m.id = r.match_id
   WHERE r.match_id = ANY(p_match_ids)
     AND r.user_id <> auth.uid()
     AND (m.from_user_id = auth.uid() OR m.to_user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION get_partner_reviewed_match_ids(uuid[]) TO authenticated;

-- ============================================
-- 動作確認:
--   -- 呼出側で実行（matches に当事者として参加している必要あり）
--   SELECT notify_match_terminated('<match_id>');
--   SELECT * FROM get_partner_reviewed_match_ids(ARRAY['<match_id>']::uuid[]);
--
--   -- 通知が相手の contacts に入ったか確認:
--   SELECT user_id, contact_type, left(body, 60) FROM contacts
--    WHERE contact_type='運営通知'
--    ORDER BY created_at DESC LIMIT 5;
-- ============================================
