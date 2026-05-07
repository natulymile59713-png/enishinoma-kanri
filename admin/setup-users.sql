-- ============================================
-- 縁の間 管理画面 - ユーザー管理拡張SQL
-- (setup.sql 実行済み前提)
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. profiles に管理用列を追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_by uuid REFERENCES auth.users(id);

-- 2. インデックス
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS profiles_banned_idx ON profiles(banned_at) WHERE banned_at IS NOT NULL;

-- 3. 電話番号BANチェック関数（匿名ユーザーも実行可能 = 登録前チェックに使用）
CREATE OR REPLACE FUNCTION is_phone_banned(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE phone_number = p_phone
    AND banned_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION is_phone_banned(text) TO anon, authenticated;

-- 4. 管理者は profiles を更新可能（BAN/解除に使用）
DROP POLICY IF EXISTS "admins_update_profiles" ON profiles;
CREATE POLICY "admins_update_profiles" ON profiles FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ============================================
-- 完了後の確認SQL（任意）：
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name IN ('phone_number', 'banned_at', 'banned_reason', 'banned_by');
-- ============================================
