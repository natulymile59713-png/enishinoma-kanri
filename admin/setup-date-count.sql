-- ============================================
-- 縁の間 デート回数管理(最大3回)
--   ・matches.date_count (0-3) を追加
--   ・check_message_limit() を date_count 連動の動的上限に修正
--     - date_count=0: 30通 / =1: 60通 / >=2: 100通
--   ・set_match_date_count(p_match_id, p_count) RPC を追加（当事者なら更新可能）
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. date_count カラム追加
ALTER TABLE matches ADD COLUMN IF NOT EXISTS date_count int NOT NULL DEFAULT 0;

-- 制約: 0〜3 のみ
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_date_count_check;
ALTER TABLE matches ADD CONSTRAINT matches_date_count_check
  CHECK (date_count >= 0 AND date_count <= 3);

-- 2. 既存の coupled マッチは「3回デート済み」として埋める（旧データ整合）
UPDATE matches SET date_count = 3 WHERE status = 'coupled' AND date_count = 0;

-- 3. メッセージ上限トリガーを 100 通固定に変更（date_count 連動はしない）
--   仕様: チャット開始から3回目デート完了まで、1ユーザー / 1マッチ 最大 100 通
CREATE OR REPLACE FUNCTION check_message_limit()
RETURNS TRIGGER AS $$
DECLARE
  cnt int;
  max_per_person int := 100;
BEGIN
  SELECT count(*) INTO cnt FROM messages
   WHERE match_id = NEW.match_id AND sender_id = NEW.sender_id;
  IF cnt >= max_per_person THEN
    RAISE EXCEPTION 'message_limit_exceeded: あなたのメッセージ上限（%通）に達しました', max_per_person
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーは既存のまま使い回し(関数が新版を呼ぶようになる)
-- 念のため再作成
DROP TRIGGER IF EXISTS trg_check_message_limit ON messages;
CREATE TRIGGER trg_check_message_limit
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_message_limit();

-- 4. set_match_date_count RPC（当事者のみ呼び出し可、値は 0〜3）
DROP FUNCTION IF EXISTS set_match_date_count(uuid, int);
CREATE OR REPLACE FUNCTION set_match_date_count(p_match_id uuid, p_count int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $smdc$
DECLARE
  m matches%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_count < 0 OR p_count > 3 THEN
    RAISE EXCEPTION 'invalid_date_count: must be 0..3 (got %)', p_count;
  END IF;

  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF caller <> m.from_user_id AND caller <> m.to_user_id THEN
    RAISE EXCEPTION 'not_match_member';
  END IF;

  UPDATE matches SET date_count = p_count WHERE id = p_match_id;
  RETURN jsonb_build_object('match_id', p_match_id, 'date_count', p_count);
END;
$smdc$;
GRANT EXECUTE ON FUNCTION set_match_date_count(uuid, int) TO authenticated;

-- ============================================
-- 動作確認:
--   -- カラムが追加されたか
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name='matches' AND column_name='date_count';
--
--   -- 関数が更新されたか
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('check_message_limit','set_match_date_count');
--
--   -- マッチを 1回目完了 にする例(クライアントから)
--   SELECT set_match_date_count('<match_id>', 1);
-- ============================================
