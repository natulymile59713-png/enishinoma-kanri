-- ============================================
-- 縁の間 卒業生の間 メンバー間ダイレクトメッセージ
--
-- 卒業生同士の1対1メッセージ。やり取りした相手は「メッセージ」ページに表示。
-- 相互非表示(hidden_pairs)はクライアント側でフィルタ。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

CREATE TABLE IF NOT EXISTS graduate_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);
CREATE INDEX IF NOT EXISTS graduate_messages_pair_idx ON graduate_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS graduate_messages_recipient_idx ON graduate_messages (recipient_id, created_at);

ALTER TABLE graduate_messages ENABLE ROW LEVEL SECURITY;

-- 閲覧: 自分が送信者 or 受信者のメッセージのみ
DROP POLICY IF EXISTS gm_select ON graduate_messages;
CREATE POLICY gm_select ON graduate_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- 送信: 自分が送信者
DROP POLICY IF EXISTS gm_insert_own ON graduate_messages;
CREATE POLICY gm_insert_own ON graduate_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- 既読化: 受信者が read_at を更新
DROP POLICY IF EXISTS gm_update_recipient ON graduate_messages;
CREATE POLICY gm_update_recipient ON graduate_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Realtime 配信に追加（重複はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='graduate_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.graduate_messages';
  END IF;
END $$;

-- ============================================
-- 動作確認:
--   SELECT * FROM graduate_messages ORDER BY created_at DESC;
-- ============================================
