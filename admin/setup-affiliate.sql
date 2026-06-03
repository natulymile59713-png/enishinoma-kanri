-- ============================================
-- 縁の間 アフィリエイター登録 基盤スキーマ（段階1）
--   ・profiles に is_affiliate / affiliate_at を追加
--   ・アフィリエイター = アフィリエイト専用登録ページから登録した人（恒久フラグ）
--   ・会員IDは EN-AF＋6桁ランダム（クライアント採番）
--   ・紹介の紐付けは既存の profiles.referrer_id（紹介者の会員ID）をそのまま使用
--   ・卒業CBの金額(6930/3690)は管理画面の承認処理で is_affiliate を見て決定
--   ・月額30%CBは保存せず管理画面で集計表示（テーブル追加なし）
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

-- 1. アフィリエイター判定フラグ（恒久。通常→アフィリ昇格は無し）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_affiliate boolean NOT NULL DEFAULT false;
-- 2. アフィリエイト登録日時
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_at timestamptz;

-- 2b. 純アフィリエイターは plan を持たない（サービス不可）→ plan を NULL 許容に。
--     既存の通常ユーザーは plan を持つので影響なし。新規通常登録も必ず plan を入れる。
ALTER TABLE profiles ALTER COLUMN plan DROP NOT NULL;

-- 3. 管理画面の絞り込み（アフィリ/通常）・紹介集計用インデックス
CREATE INDEX IF NOT EXISTS profiles_is_affiliate_idx ON profiles(is_affiliate);
-- referrer_id（紹介者の会員ID）での集計を速くする（既存運用の補強）
CREATE INDEX IF NOT EXISTS profiles_referrer_id_idx ON profiles(referrer_id);

-- ============================================
-- メモ:
--  ・兼用ユーザー = is_affiliate=true かつ plan が入っている（サービス利用可）
--  ・純アフィリエイター = is_affiliate=true かつ plan が NULL（サービス不可）
--  ・純通常ユーザー = is_affiliate=false
--  ・アフィリエイターが紹介 → 卒業6930円 + 利用中の間 月額×30%（管理画面集計）
--  ・通常ユーザーが紹介 → 卒業3690円のみ（現行どおり）
--
-- 確認用:
--   SELECT id, member_id, nickname, is_affiliate, affiliate_at, plan
--   FROM profiles WHERE is_affiliate = true ORDER BY affiliate_at DESC;
-- ============================================
