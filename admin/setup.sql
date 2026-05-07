-- ============================================
-- 縁の間 管理画面 セットアップSQL
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. profiles に is_admin 列を追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. 問い合わせテーブル
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id text,
  nickname text,
  contact_type text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reply_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts(status);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON contacts(created_at DESC);

-- 3. 管理者判定関数（RLS再帰回避のため SECURITY DEFINER）
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;

-- 4. contacts のRLSポリシー
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select" ON contacts;
CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "contacts_update_admin" ON contacts;
CREATE POLICY "contacts_update_admin" ON contacts FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 5. 管理者は全プロフィールを閲覧可能（既存ポリシーに追加）
DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles" ON profiles FOR SELECT TO authenticated
USING (is_admin());

-- ============================================
-- セットアップ完了後、自分を管理者にする：
-- profiles テーブルで自分の行を編集 → is_admin = true
-- （または以下を実行：UPDATE profiles SET is_admin = true WHERE id = '<自分のauth uid>';）
-- ============================================
