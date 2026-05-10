-- ============================================
-- 縁の間 - 3プラン制 拡張SQL
-- ============================================

-- profiles に plan 列を追加（既存ユーザーは 'total' = 現状機能維持）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'total';

-- profiles に created_at 列を追加（登録日時の記録 = 過去アナウンスのフィルタに使う）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- profiles に profile_text 列を追加（自己紹介文、最大500文字。アプリ側でバリデーション）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_text text;
