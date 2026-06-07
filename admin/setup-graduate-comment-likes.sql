-- ============================================
-- 縁の間 卒業生の間「近況」 コメントへの いいね
--
-- Instagram風：各コメントにも いいね を付けられる（1人1回）。
-- 自分のコメントが いいね されたら通知する判定にも使用。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

CREATE TABLE IF NOT EXISTS graduate_comment_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES graduate_post_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS graduate_comment_likes_comment_idx ON graduate_comment_likes (comment_id);

ALTER TABLE graduate_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gcl_select ON graduate_comment_likes;
CREATE POLICY gcl_select ON graduate_comment_likes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gcl_insert_own ON graduate_comment_likes;
CREATE POLICY gcl_insert_own ON graduate_comment_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS gcl_delete_own ON graduate_comment_likes;
CREATE POLICY gcl_delete_own ON graduate_comment_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Realtime 配信に追加（重複はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='graduate_comment_likes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.graduate_comment_likes';
  END IF;
END $$;

-- ============================================
-- 動作確認:
--   SELECT comment_id, count(*) FROM graduate_comment_likes GROUP BY comment_id;
-- ============================================
