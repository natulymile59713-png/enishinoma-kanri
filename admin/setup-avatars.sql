-- ============================================
-- 縁の間 プロフィール画像アップロード
-- 実行タイミング: 他の setup-*.sql の後、いつでも
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 目的:
--   ユーザーのプロフィール写真を Supabase Storage の `avatars` バケットに保存し、
--   profiles.avatar_url で参照する。マッチ前はぼかし、マッチ後はクリア表示。
--
-- 設計:
--   - バケット: `avatars`（public read）
--   - パス: `<user_id>/avatar.<ext>` （1ユーザー 1ファイル、上書き更新）
--   - 容量上限: 5MB (Storage バケット設定で制御)
--   - ファイル名は user_id 配下で固定なので、URL もキャッシュバスティング用に
--     ?t=<timestamp> をクライアント側で付ける

-- 1) profiles に avatar_url 列を追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Storage バケットを作成（既にあれば何もしない）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                    -- public read（顔写真は公開前提）
  5242880,                                 -- 5MB 上限
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Storage ポリシー
--    - 全員 SELECT 可能（public bucket だが念のためポリシーも明示）
--    - 認証ユーザーは「自分の user_id 配下」のみ INSERT/UPDATE/DELETE 可能
--    - 管理者は全画像を操作可能

-- 既存ポリシーを置き換える形で再作成
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) 管理者は任意のアバターを削除可能（規約違反画像の対応用）
DROP POLICY IF EXISTS "avatars_admin_all" ON storage.objects;
CREATE POLICY "avatars_admin_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND is_admin())
WITH CHECK (bucket_id = 'avatars' AND is_admin());

-- ============================================
-- 確認:
--   SELECT name, public, file_size_limit FROM storage.buckets WHERE id = 'avatars';
--   → 1行返ってくれば OK
--
-- 取り消し:
--   DELETE FROM storage.buckets WHERE id = 'avatars';
--   ALTER TABLE profiles DROP COLUMN IF EXISTS avatar_url;
-- ============================================
