-- ============================================
-- 縁の間 管理画面 - 通報管理 拡張SQL
-- (setup.sql / setup-users.sql 実行済み前提)
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. reports テーブル
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_member_id text,
  reporter_nickname text,
  target_member_id text,
  target_nickname text,
  reason_category text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',  -- open / resolved / dismissed
  resolution_action text,                 -- ban / warning / no_action
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_created_idx ON reports(created_at DESC);

-- 2. RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select" ON reports;
CREATE POLICY "reports_select" ON reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "reports_insert" ON reports;
CREATE POLICY "reports_insert" ON reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin" ON reports FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3. 会員IDから user_id・nickname を引くRPC（通報フォーム送信時）
CREATE OR REPLACE FUNCTION lookup_user_by_member_id(p_member_id text)
RETURNS TABLE (id uuid, nickname text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, nickname FROM profiles WHERE member_id = p_member_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION lookup_user_by_member_id(text) TO authenticated;

-- 4. contacts の INSERT ポリシーを更新（管理者は他ユーザー宛にも書き込み可能 = 警告メッセージ用）
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR is_admin());
