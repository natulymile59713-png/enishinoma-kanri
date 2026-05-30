-- ============================================
-- 縁の間 ユーザー間メッセージテーブル
-- 実行タイミング: matches テーブルが存在する状態で実行
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================

-- 前回途中で失敗した場合のクリーンアップ
DROP TABLE IF EXISTS messages CASCADE;
DROP FUNCTION IF EXISTS rate_limit_messages();
DROP FUNCTION IF EXISTS check_message_limit();

-- ===== messages テーブル =====
CREATE TABLE messages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id, created_at);

-- ===== RLS =====
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分がマッチの当事者であるメッセージのみ閲覧可
CREATE POLICY messages_select ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches m
     WHERE m.id = messages.match_id
       AND (m.from_user_id = auth.uid() OR m.to_user_id = auth.uid())
  )
);

-- INSERT: 自分がマッチの当事者で、かつ sender_id が自分
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM matches m
     WHERE m.id = messages.match_id
       AND (m.from_user_id = auth.uid() OR m.to_user_id = auth.uid())
       AND m.status IN ('matched','chatting','date_set','coupled')
  )
);

-- 管理者は全件閲覧可
CREATE POLICY messages_admin_select ON messages FOR SELECT USING (
  is_admin()
);

-- ===== レート制限トリガー: 1ユーザー / 5分 / 30件 =====
CREATE OR REPLACE FUNCTION rate_limit_messages()
RETURNS trigger
LANGUAGE plpgsql
AS $rl$
DECLARE
  cnt int;
  win_min int := 5;
  max_cnt int := 30;
BEGIN
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM messages
   WHERE sender_id = NEW.sender_id
     AND created_at > now() - (win_min || ' minutes')::interval;
  IF cnt >= max_cnt THEN
    RAISE EXCEPTION 'rate_limit_exceeded: messages (% records in last % min, limit %)', cnt, win_min, max_cnt
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$rl$;

DROP TRIGGER IF EXISTS trg_rate_limit_messages ON messages;
CREATE TRIGGER trg_rate_limit_messages
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_messages();

-- ===== メッセージ上限チェック: 1マッチにつき1人30通まで =====
CREATE OR REPLACE FUNCTION check_message_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $ml$
DECLARE
  cnt int;
  max_per_person int := 30;
BEGIN
  SELECT count(*) INTO cnt FROM messages
   WHERE match_id = NEW.match_id
     AND sender_id = NEW.sender_id;
  IF cnt >= max_per_person THEN
    RAISE EXCEPTION 'message_limit_exceeded: あなたのメッセージ上限（%通）に達しました', max_per_person
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$ml$;

DROP TRIGGER IF EXISTS trg_check_message_limit ON messages;
CREATE TRIGGER trg_check_message_limit
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_message_limit();

-- ===== Realtime 有効化 =====
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- 緊急時の解除方法:
--   ALTER TABLE messages DISABLE TRIGGER trg_rate_limit_messages;
--   ALTER TABLE messages DISABLE TRIGGER trg_check_message_limit;
--
-- 完全削除:
--   DROP TABLE IF EXISTS messages CASCADE;
--   DROP FUNCTION IF EXISTS rate_limit_messages(), check_message_limit();
-- ============================================
