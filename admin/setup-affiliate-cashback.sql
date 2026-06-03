-- ============================================
-- 縁の間 卒業後も紹介可：キャッシュバック対象者の連絡用に email を profiles に保持
--   ・profiles.email を追加（退会者へのメール連絡用に管理画面で参照）
--   ・INSERT 時に auth.users.email から自動セットするトリガー（フロント変更不要・漏れ防止）
--   ・既存ユーザーは auth.users から一括バックフィル
--   ※ メアド認証ON/OFFに関係なく auth.users.email は常に存在する
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. email 列を追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. profiles INSERT 時に auth.users.email を自動コピーするトリガー
--    SECURITY DEFINER + search_path=public,auth で auth スキーマを参照可能にする
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $spe$
BEGIN
  IF NEW.email IS NULL THEN
    SELECT u.email INTO NEW.email FROM auth.users u WHERE u.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$spe$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON profiles;
CREATE TRIGGER trg_sync_profile_email
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();

-- 3. 既存ユーザーのバックフィル（email が未設定のものを auth.users から補完）
UPDATE profiles p
   SET email = u.email
  FROM auth.users u
 WHERE u.id = p.id
   AND (p.email IS NULL OR p.email = '');

-- ============================================
-- 確認:
--   SELECT member_id, nickname, email, plan, is_affiliate, withdrawal_type
--   FROM profiles ORDER BY created_at DESC LIMIT 20;
-- ============================================
