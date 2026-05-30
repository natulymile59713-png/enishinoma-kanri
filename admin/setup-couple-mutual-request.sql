-- ============================================
-- 縁の間 「付き合いました！」を双方申請式に変更
-- 既存: 片方が押すと即 coupled
-- 新規: 双方が押した時のみ coupled に遷移
--       片方だけ押した時は相手の運営チャットに通知を INSERT
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. 双方申請タイムスタンプを追加
ALTER TABLE matches ADD COLUMN IF NOT EXISTS from_user_coupled_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS to_user_coupled_at   TIMESTAMPTZ;

-- 2. 既存の coupled 行は「両者申請済み」として移行
UPDATE matches
   SET from_user_coupled_at = COALESCE(from_user_coupled_at, coupled_at),
       to_user_coupled_at   = COALESCE(to_user_coupled_at,   coupled_at)
 WHERE status = 'coupled' AND coupled_at IS NOT NULL;

-- 3. RPC: 「付き合いました！」申請
--   - 呼出者が from / to のどちらかを判定
--   - 該当の *_coupled_at に now() をセット
--   - 両方揃ったら status='coupled' + coupled_at=now() に昇格
--   - 片方だけのときは相手の運営チャット(contacts)に通知を INSERT
--   - 戻り値: jsonb { is_coupled, my_side, partner_already_requested, match_id }
DROP FUNCTION IF EXISTS request_couple(uuid);
CREATE OR REPLACE FUNCTION request_couple(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $rc$
DECLARE
  m matches%ROWTYPE;
  caller uuid := auth.uid();
  my_side text;
  partner_id uuid;
  my_nickname text;
  partner_nickname text;
  partner_member_id text;
  partner_already boolean := false;
  becomes_coupled boolean := false;
  notice_body text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO m FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- 呼出者が当事者か
  IF caller = m.from_user_id THEN
    my_side := 'from';
    partner_id := m.to_user_id;
    partner_already := (m.to_user_coupled_at IS NOT NULL);
  ELSIF caller = m.to_user_id THEN
    my_side := 'to';
    partner_id := m.from_user_id;
    partner_already := (m.from_user_coupled_at IS NOT NULL);
  ELSE
    RAISE EXCEPTION 'not_match_member';
  END IF;

  -- 現状ステータスチェック（date_set からのみ申請可能、coupled は冪等）
  IF m.status NOT IN ('date_set', 'coupled') THEN
    RAISE EXCEPTION 'invalid_status_for_couple_request: %', m.status;
  END IF;

  -- 既に coupled なら何もしない（冪等）
  IF m.status = 'coupled' THEN
    RETURN jsonb_build_object(
      'is_coupled', true,
      'my_side', my_side,
      'partner_already_requested', true,
      'match_id', p_match_id
    );
  END IF;

  -- 自分側のタイムスタンプをセット（既にあれば上書きしない）
  IF my_side = 'from' THEN
    UPDATE matches SET from_user_coupled_at = COALESCE(from_user_coupled_at, now())
      WHERE id = p_match_id;
  ELSE
    UPDATE matches SET to_user_coupled_at = COALESCE(to_user_coupled_at, now())
      WHERE id = p_match_id;
  END IF;

  -- 双方揃ったら coupled へ昇格（既存トリガー prevent_double_couple もここで発火）
  IF partner_already THEN
    UPDATE matches
       SET status = 'coupled',
           coupled_at = now()
     WHERE id = p_match_id;
    becomes_coupled := true;
  ELSE
    -- 自分が先に押したケース → 相手の運営チャットに通知を INSERT
    SELECT nickname INTO my_nickname FROM profiles WHERE id = caller;
    SELECT nickname, member_id INTO partner_nickname, partner_member_id
      FROM profiles WHERE id = partner_id;

    notice_body :=
      COALESCE(my_nickname, 'お相手') || E'さんがあなたと「付き合いました！」のボタンを押されました！\n' ||
      E'同じく「付き合いました！」を押すとカップル成立。\n' ||
      E'「感謝して終了」を押すとレビュー記入ページに移ります。';

    -- 重複防止: 同マッチ・同申請者の通知がまだ無い場合のみ INSERT
    IF NOT EXISTS (
      SELECT 1 FROM contacts
       WHERE contact_type = '運営通知'
         AND user_id = partner_id
         AND body LIKE (COALESCE(my_nickname, 'お相手') || E'さんがあなたと「付き合いました！」%')
    ) THEN
      INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
        (partner_id, partner_member_id, partner_nickname, '運営通知', notice_body, 'replied');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_coupled', becomes_coupled,
    'my_side', my_side,
    'partner_already_requested', partner_already,
    'match_id', p_match_id
  );
END;
$rc$;

GRANT EXECUTE ON FUNCTION request_couple(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   -- スキーマ確認
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name='matches' AND column_name LIKE '%coupled%';
--
--   -- 既存 coupled の移行確認
--   SELECT id, status, coupled_at, from_user_coupled_at, to_user_coupled_at
--     FROM matches WHERE status='coupled' LIMIT 5;
--
--   -- 申請(クライアント側で supa.rpc('request_couple', { p_match_id: '...' }) と等価)
--   -- 通知が相手の contacts に入ったか確認:
--   SELECT user_id, contact_type, left(body, 50) FROM contacts
--    WHERE contact_type='運営通知'
--    ORDER BY created_at DESC LIMIT 3;
-- ============================================
