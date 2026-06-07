-- ============================================
-- 縁の間 卒業生の間「近況」 いいね & コメント
--
-- graduate_posts への いいね（1人1回）とコメント。
-- 相互非表示(hidden_pairs)はクライアント側でフィルタ。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. いいね
CREATE TABLE IF NOT EXISTS graduate_post_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES graduate_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS graduate_post_likes_post_idx ON graduate_post_likes (post_id);

ALTER TABLE graduate_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gpl_select ON graduate_post_likes;
CREATE POLICY gpl_select ON graduate_post_likes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gpl_insert_own ON graduate_post_likes;
CREATE POLICY gpl_insert_own ON graduate_post_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS gpl_delete_own ON graduate_post_likes;
CREATE POLICY gpl_delete_own ON graduate_post_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. コメント
CREATE TABLE IF NOT EXISTS graduate_post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES graduate_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id  text,
  nickname   text,
  avatar_url text,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graduate_post_comments_post_idx ON graduate_post_comments (post_id, created_at);

ALTER TABLE graduate_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gpc_select ON graduate_post_comments;
CREATE POLICY gpc_select ON graduate_post_comments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gpc_insert_own ON graduate_post_comments;
CREATE POLICY gpc_insert_own ON graduate_post_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS gpc_delete_own ON graduate_post_comments;
CREATE POLICY gpc_delete_own ON graduate_post_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS gpc_admin ON graduate_post_comments;
CREATE POLICY gpc_admin ON graduate_post_comments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================
-- 動作確認:
--   SELECT post_id, count(*) FROM graduate_post_likes GROUP BY post_id;
--   SELECT * FROM graduate_post_comments ORDER BY created_at DESC;
-- ============================================
