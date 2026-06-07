-- ============================================
-- 縁の間 卒業生の間「近況」投稿（X風フィード）
--
-- 卒業生が文章・写真・動画を投稿できるタイムライン。
-- ・graduate_posts テーブル（本文 + メディア1点）
-- ・メディアは Storage バケット `posts`（public read）に保存
-- ・相互非表示(hidden_pairs)はクライアント側でフィルタ
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. 投稿テーブル
CREATE TABLE IF NOT EXISTS graduate_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id   text,
  nickname    text,
  avatar_url  text,
  body        text,
  media_url   text,
  media_type  text CHECK (media_type IS NULL OR media_type IN ('image','video')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graduate_posts_created_idx ON graduate_posts (created_at DESC);

ALTER TABLE graduate_posts ENABLE ROW LEVEL SECURITY;

-- 閲覧: ログインユーザーは全件閲覧可（非表示相手はクライアントで除外）
DROP POLICY IF EXISTS graduate_posts_select ON graduate_posts;
CREATE POLICY graduate_posts_select ON graduate_posts
  FOR SELECT TO authenticated USING (true);

-- 投稿: 自分のものだけ
DROP POLICY IF EXISTS graduate_posts_insert_own ON graduate_posts;
CREATE POLICY graduate_posts_insert_own ON graduate_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 削除: 自分のものだけ
DROP POLICY IF EXISTS graduate_posts_delete_own ON graduate_posts;
CREATE POLICY graduate_posts_delete_own ON graduate_posts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 管理者は全操作可
DROP POLICY IF EXISTS graduate_posts_admin ON graduate_posts;
CREATE POLICY graduate_posts_admin ON graduate_posts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 2. メディア用 Storage バケット `posts`（public read / 最大50MB / 画像・動画）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts', 'posts', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage ポリシー（<user_id>/<file> 形式で本人フォルダのみ書込/削除、閲覧は全員）
DROP POLICY IF EXISTS "posts_select_all" ON storage.objects;
CREATE POLICY "posts_select_all" ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "posts_insert_own" ON storage.objects;
CREATE POLICY "posts_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "posts_delete_own" ON storage.objects;
CREATE POLICY "posts_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 動作確認:
--   SELECT * FROM graduate_posts ORDER BY created_at DESC;
-- ============================================
