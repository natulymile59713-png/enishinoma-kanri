-- ============================================
-- 縁の間 カップル成立時：他相手への「成立報告＋24時間後消去」通知
--   1. get_coupled_user_ids を拡張し coupled_at も返す
--      （フロントが「相手が他とカップル成立した時刻」を取得し、24時間で非表示にするため）
--   2. notify_couple_closures(p_match_id): カップル成立した両者それぞれの
--      「メッセージのやり取りがあった他の相手」の運営チャットへ通知を INSERT
--      （メッセージが無い相手には送らない。既存の縁リストフィルタで即非表示になる）
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- 前提: setup-couple-exclusive.sql / setup-messages.sql 実行済み
-- ============================================

-- ---------------------------------------------------------
-- 1. get_coupled_user_ids を (user_id, coupled_at) を返す形に拡張
--    既存呼び出し（user_id のみ参照）は後方互換で動作する。
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS get_coupled_user_ids(uuid[]);

CREATE OR REPLACE FUNCTION get_coupled_user_ids(user_ids uuid[])
RETURNS TABLE(user_id uuid, coupled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u, max(c) AS coupled_at
  FROM (
    SELECT from_user_id AS u, coupled_at AS c FROM matches WHERE status='coupled' AND from_user_id = ANY(user_ids)
    UNION ALL
    SELECT to_user_id   AS u, coupled_at AS c FROM matches WHERE status='coupled' AND to_user_id   = ANY(user_ids)
  ) t
  GROUP BY u;
$$;

GRANT EXECUTE ON FUNCTION get_coupled_user_ids(uuid[]) TO authenticated;

-- ---------------------------------------------------------
-- 2. notify_couple_closures: 成立した両者の「やり取りのあった他相手」へ通知
--    - 「やり取りあり」= その match に messages が1件以上
--    - 通知文：「〇〇さんが別の方とカップル成立されました。24時間後に…」(〇〇=成立した本人)
--    - メッセージ無しの相手には送らない（縁リストの既存フィルタで即非表示）
--    - 二重送信防止：同一相手・同一本文が既にあればスキップ
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS notify_couple_closures(uuid);

CREATE OR REPLACE FUNCTION notify_couple_closures(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ncc$
DECLARE
  m matches%ROWTYPE;
  caller uuid := auth.uid();
  members uuid[];
  z uuid;                 -- カップル成立した本人
  z_nick text;
  rec RECORD;             -- z の他マッチ + 相手
  other_prof profiles%ROWTYPE;
  body_text text;
  sent_count int := 0;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- 呼び出し元が当事者であること
  IF caller <> m.from_user_id AND caller <> m.to_user_id THEN
    RAISE EXCEPTION 'not_match_member';
  END IF;

  -- 成立済みのマッチに対してのみ
  IF m.status <> 'coupled' THEN
    RAISE EXCEPTION 'not_coupled_yet: %', m.status;
  END IF;

  members := ARRAY[m.from_user_id, m.to_user_id];

  FOREACH z IN ARRAY members LOOP
    SELECT nickname INTO z_nick FROM profiles WHERE id = z;

    -- z の「他の相手」マッチ（このカップルマッチ以外 / 終了済み除外 / messages が1件以上）
    FOR rec IN
      SELECT mm.id AS match_id,
             CASE WHEN mm.from_user_id = z THEN mm.to_user_id ELSE mm.from_user_id END AS other_id
      FROM matches mm
      WHERE mm.id <> p_match_id
        AND (mm.from_user_id = z OR mm.to_user_id = z)
        AND mm.status NOT IN ('coupled','rejected','dismissed')
        AND EXISTS (SELECT 1 FROM messages msg WHERE msg.match_id = mm.id)
    LOOP
      -- 通知先が新カップルの当事者なら除外（念のため）
      CONTINUE WHEN rec.other_id = m.from_user_id OR rec.other_id = m.to_user_id;

      SELECT * INTO other_prof FROM profiles WHERE id = rec.other_id;
      IF NOT FOUND THEN CONTINUE; END IF;

      body_text :=
        COALESCE(z_nick, 'お相手') || 'さんが別の方とカップル成立されました。24時間後に' ||
        COALESCE(z_nick, 'お相手') || 'さんとのメッセージは自動で消去されます。' ||
        'お祝いのお言葉、もしくは最後に話したいことがある場合は24時間以内にメッセージを送りましょう！';

      -- 二重送信防止：同一相手・同一本文が既にあればスキップ
      IF EXISTS (
        SELECT 1 FROM contacts
        WHERE user_id = rec.other_id
          AND contact_type = '運営通知'
          AND body = body_text
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status)
      VALUES (other_prof.id, other_prof.member_id, other_prof.nickname, '運営通知', body_text, 'replied');
      sent_count := sent_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('sent', sent_count);
END;
$ncc$;

GRANT EXECUTE ON FUNCTION notify_couple_closures(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT notify_couple_closures('<coupled_match_id>');
--   SELECT user_id, left(body,40) FROM contacts WHERE contact_type='運営通知' ORDER BY created_at DESC LIMIT 5;
-- ============================================
