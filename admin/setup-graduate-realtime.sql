-- ============================================
-- 縁の間 卒業生の間「近況」 Realtime 有効化
--
-- 投稿・いいね・コメントの変更を WebSocket で即時配信するため、
-- supabase_realtime publication に3テーブルを追加する（重複追加はスキップ）。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['graduate_posts','graduate_post_likes','graduate_post_comments'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 動作確認:
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname='supabase_realtime' AND tablename LIKE 'graduate_post%';
-- ============================================
