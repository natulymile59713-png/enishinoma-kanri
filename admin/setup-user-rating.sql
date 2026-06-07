-- ============================================
-- 縁の間 ユーザーの平均レビュー取得（相手プロフィール表示用）
--
-- reviews(user_id=評価者, match_id, 星=rating または stars, comment) を、
-- 「対象ユーザーが当事者のマッチで、対象本人以外が書いたレビュー」だけ集計する。
-- 星カラム名が rating / stars どちらでも動くように動的に判定する。
-- 他人のレビューも閲覧できるよう SECURITY DEFINER（RLSを跨ぐ）。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

DROP FUNCTION IF EXISTS get_user_rating(uuid);
CREATE OR REPLACE FUNCTION get_user_rating(p_user_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint, comments jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  star_col text;
BEGIN
  -- reviews の星カラム名を検出（rating 優先、無ければ stars）
  SELECT column_name INTO star_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'reviews'
     AND column_name IN ('rating','stars')
   ORDER BY CASE column_name WHEN 'rating' THEN 0 ELSE 1 END
   LIMIT 1;

  IF star_col IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, 0::bigint, '[]'::jsonb;
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format($q$
    WITH revs AS (
      SELECT r.%1$I AS rating, r.comment
        FROM reviews r
        JOIN matches m ON m.id = r.match_id
       WHERE r.user_id <> $1
         AND (m.from_user_id = $1 OR m.to_user_id = $1)
         AND r.%1$I IS NOT NULL
    )
    SELECT
      ROUND(AVG(rating)::numeric, 1),
      COUNT(*)::bigint,
      COALESCE(
        jsonb_agg(jsonb_build_object('rating', rating, 'comment', comment))
          FILTER (WHERE comment IS NOT NULL AND btrim(comment) <> ''),
        '[]'::jsonb
      )
    FROM revs
  $q$, star_col) USING p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_rating(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT * FROM get_user_rating('<対象のuser-id>');
--   -- avg_rating / review_count / comments が返ればOK
-- ============================================
