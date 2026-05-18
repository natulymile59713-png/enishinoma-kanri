-- ============================================
-- 縁の間 管理者ロール分離
-- 実行タイミング: setup.sql の後（既存の is_admin 体系の上に乗せる）
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 設計概要:
--   profiles.is_admin (boolean)         - 既存。管理画面ログイン可否の判定に使う
--   profiles.admin_role (text NULL)     - 新規。'editor' | 'viewer' | NULL
--                                         NULL は admin_role 未設定（=既存運用と同じく editor 扱い）
--   is_admin()                          - 既存。閲覧用 RLS で使う（変更なし）
--   can_edit_admin()                    - 新規。書込・更新系 RLS で使う
--
-- マイグレーション戦略:
--   1. admin_role カラムを追加（NULL 許容、既存ユーザーには影響なし）
--   2. 既存の is_admin = true ユーザーは自動で 'editor' とみなされる（NULL も editor 扱い）
--   3. can_edit_admin() = is_admin() AND (admin_role IS NULL OR admin_role = 'editor')
--   4. RLS は段階的に切り替え（このファイルでは関数定義のみ。RLS 切替は別途）

-- 1) admin_role 列を追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role text;

-- 2) 入る値を制約（NULL も許容）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_admin_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_admin_role_check
      CHECK (admin_role IS NULL OR admin_role IN ('editor', 'viewer'));
  END IF;
END $$;

-- 3) 書込・更新系 RLS で使う関数
CREATE OR REPLACE FUNCTION can_edit_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND (admin_role IS NULL OR admin_role = 'editor')
     FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 4) admin_role を取得する関数（クライアント側で UI ガードに使う）
CREATE OR REPLACE FUNCTION my_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) = false
      THEN NULL
    ELSE COALESCE((SELECT admin_role FROM profiles WHERE id = auth.uid()), 'editor')
  END;
$$;

-- ============================================
-- RLS 切替（任意・段階的に適用してください）
-- ============================================
-- 下記コメントを外して実行すると、書込系の RLS が viewer をブロックします。
-- 安全のため、まずは UI ガード（admin-app.js 側）だけで運用し、
-- 動作確認できたら DB ポリシーも順次切り替えるのが推奨。
--
-- DROP POLICY IF EXISTS "contacts_update_admin" ON contacts;
-- CREATE POLICY "contacts_update_admin" ON contacts FOR UPDATE TO authenticated
-- USING (can_edit_admin()) WITH CHECK (can_edit_admin());
--
-- DROP POLICY IF EXISTS "reports_update_admin" ON reports;
-- CREATE POLICY "reports_update_admin" ON reports FOR UPDATE TO authenticated
-- USING (can_edit_admin()) WITH CHECK (can_edit_admin());
--
-- DROP POLICY IF EXISTS "bookings_admin_all" ON bookings;
-- CREATE POLICY "bookings_admin_all" ON bookings FOR ALL TO authenticated
-- USING (can_edit_admin()) WITH CHECK (can_edit_admin());
--
-- ...（announcements, sotsugyou_requests, cashbacks, profiles 更新も同様に）

-- ============================================
-- viewer ユーザーを作る例:
--   UPDATE profiles SET is_admin = true, admin_role = 'viewer' WHERE id = '<auth_uid>';
-- editor に戻す例:
--   UPDATE profiles SET admin_role = 'editor' WHERE id = '<auth_uid>';
-- ============================================
