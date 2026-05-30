-- ============================================
-- 縁の間 matches テーブルに admin 全件 SELECT ポリシー追加
-- 既定: ユーザーは自分が関与するマッチしか見えない（RLS）
-- 追加: 管理者は全マッチ閲覧可（ユーザー一覧のステータス計算・DM監視 等で必要）
-- ============================================

DROP POLICY IF EXISTS "admins_read_all_matches" ON matches;
CREATE POLICY "admins_read_all_matches" ON matches FOR SELECT TO authenticated
USING (is_admin());

-- 動作確認:
--   SELECT count(*) FROM matches WHERE status='coupled';
