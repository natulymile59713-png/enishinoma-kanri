-- ============================================
-- 縁の間 メッセージ モデレーション補助
-- 実行タイミング: setup-messages.sql 実行後
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================

-- 前回途中で失敗した場合のクリーンアップ
DROP TABLE IF EXISTS message_mod_reviews CASCADE;
DROP TABLE IF EXISTS message_rate_hits CASCADE;
DROP FUNCTION IF EXISTS record_message_rate_hit(text, text);

-- ===== レート制限ヒット記録テーブル =====
-- DB トリガーで弾かれた送信を、クライアントから RPC 経由で記録する。
-- トリガー内の INSERT はトランザクション巻き戻しで残らないため、別経路で残す。
CREATE TABLE message_rate_hits (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('rate_limit','message_limit')),
  detail       text,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_rate_hits_sender ON message_rate_hits(sender_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_rate_hits_time   ON message_rate_hits(attempted_at DESC);

ALTER TABLE message_rate_hits ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧可
CREATE POLICY rate_hits_admin_select ON message_rate_hits FOR SELECT USING (
  is_admin()
);

-- ===== モデレーション確認記録テーブル =====
-- 違反疑いメッセージに対して、管理者が「確認した・対応した」を記録する。
CREATE TABLE message_mod_reviews (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id),
  decision    text NOT NULL CHECK (decision IN ('ok','warn','ban')),
  note        text,
  reviewed_at timestamptz DEFAULT now(),
  UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_mod_reviews_message ON message_mod_reviews(message_id);

ALTER TABLE message_mod_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY mod_reviews_admin_select ON message_mod_reviews FOR SELECT USING (
  is_admin()
);

CREATE POLICY mod_reviews_admin_insert ON message_mod_reviews FOR INSERT WITH CHECK (
  is_admin() AND reviewed_by = auth.uid()
);

CREATE POLICY mod_reviews_admin_update ON message_mod_reviews FOR UPDATE USING (
  is_admin()
);

CREATE POLICY mod_reviews_admin_delete ON message_mod_reviews FOR DELETE USING (
  is_admin()
);

-- ===== クライアントから呼ぶ RPC: レート制限ヒットを記録 =====
-- SECURITY DEFINER で auth.uid() を sender_id として強制（クライアントが偽装不可）。
-- ユーザーアプリは「送信エラー = レート制限」と判定したらこれを呼ぶ。
CREATE OR REPLACE FUNCTION record_message_rate_hit(p_reason text, p_detail text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $rmrh$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_reason NOT IN ('rate_limit','message_limit') THEN
    RAISE EXCEPTION 'invalid_reason: %', p_reason;
  END IF;
  INSERT INTO message_rate_hits(sender_id, reason, detail)
    VALUES (auth.uid(), p_reason, COALESCE(p_detail, ''));
END;
$rmrh$;

GRANT EXECUTE ON FUNCTION record_message_rate_hit(text, text) TO authenticated;

-- ===== Realtime 有効化（管理画面 DM 監視タブで即時反映） =====
-- supabase_realtime publication に既に追加済の場合は no-op になる
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_rate_hits;
  EXCEPTION WHEN duplicate_object THEN
    -- 既に追加済み
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_mod_reviews;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================
-- 動作確認用 SELECT:
--   SELECT * FROM message_rate_hits ORDER BY attempted_at DESC LIMIT 20;
--   SELECT * FROM message_mod_reviews ORDER BY reviewed_at DESC LIMIT 20;
--
-- テスト挿入（管理者で実行）:
--   SELECT record_message_rate_hit('rate_limit', 'test');
--
-- 完全削除:
--   DROP TABLE IF EXISTS message_mod_reviews CASCADE;
--   DROP TABLE IF EXISTS message_rate_hits CASCADE;
--   DROP FUNCTION IF EXISTS record_message_rate_hit(text, text);
-- ============================================
