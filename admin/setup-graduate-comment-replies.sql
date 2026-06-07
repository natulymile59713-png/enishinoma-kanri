-- ============================================
-- 縁の間 卒業生の間「近況」 コメントへの返信（ネスト）
--
-- graduate_post_comments に parent_comment_id を追加。
-- ・NULL        … 投稿への通常コメント
-- ・コメントID  … そのコメントへの返信
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

ALTER TABLE graduate_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
  REFERENCES graduate_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS graduate_post_comments_parent_idx
  ON graduate_post_comments (parent_comment_id);

-- ============================================
-- 動作確認:
--   SELECT id, parent_comment_id, body FROM graduate_post_comments ORDER BY created_at;
-- ============================================
