-- ============================================
-- 縁の間 - 全体アナウンス 拡張SQL
-- (setup.sql / setup-users.sql / setup-reports.sql / setup-sotsugyou.sql / setup-bookings.sql 実行済み前提)
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. announcements テーブル
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON announcements(created_at DESC);

-- 2. RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが読める
DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements FOR SELECT TO authenticated
USING (true);

-- 管理者のみ投稿
DROP POLICY IF EXISTS "announcements_insert_admin" ON announcements;
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT TO authenticated
WITH CHECK (is_admin());

-- 管理者のみ更新
DROP POLICY IF EXISTS "announcements_update_admin" ON announcements;
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 管理者のみ削除
DROP POLICY IF EXISTS "announcements_delete_admin" ON announcements;
CREATE POLICY "announcements_delete_admin" ON announcements FOR DELETE TO authenticated
USING (is_admin());
