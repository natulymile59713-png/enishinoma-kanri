-- ============================================
-- 縁の間 興味のあるカテゴリー（タグ）保存用
-- 構造例:
--   interest_tags = {
--     "selected": ["ヨガ","読書","猫好き"],          -- 最大10
--     "highlighted": ["ヨガ"],                       -- 最大3 (selected の部分集合)
--     "custom": { "アウトドア・スポーツ": "ウィンドサーフィン" }  -- カテゴリ別1ワード(10文字以内)
--   }
-- 実行: Supabase SQL Editor で全文 Run
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interest_tags jsonb;

-- 動作確認:
--   SELECT id, nickname, interest_tags FROM profiles WHERE interest_tags IS NOT NULL LIMIT 5;
