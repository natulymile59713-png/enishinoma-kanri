-- ============================================
-- 縁の間 カップル成立の排他性を保証するトリガー
-- 1人のユーザーが同時に複数のマッチで coupled になることを防ぐ。
--
-- 背景: クライアント側のボタン無効化だけでは、別タブ/別端末/タイミング差で
--      すり抜けて double-couple が発生する可能性がある。DB 側で確実に弾く。
--
-- 実行方法: Supabase SQL Editor に全文貼り付けて Run
-- ============================================

-- 前回失敗時のクリーンアップ
DROP TRIGGER IF EXISTS trg_prevent_double_couple ON matches;
DROP FUNCTION IF EXISTS prevent_double_couple();

-- SECURITY DEFINER 必須: 呼び出し元(8768等)が他人のマッチを RLS で見えなくても、
-- トリガー内の SELECT は全件参照できる必要がある（テーブル所有者権限で実行）
CREATE OR REPLACE FUNCTION prevent_double_couple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $pdc$
BEGIN
  -- INSERT または UPDATE で status が 'coupled' になる遷移時のみチェック
  IF NEW.status = 'coupled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'coupled') THEN
    -- どちらかのユーザーが既に別のマッチで coupled なら例外
    IF EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id <> NEW.id
        AND m.status = 'coupled'
        AND (
          m.from_user_id = NEW.from_user_id OR
          m.to_user_id   = NEW.from_user_id OR
          m.from_user_id = NEW.to_user_id   OR
          m.to_user_id   = NEW.to_user_id
        )
    ) THEN
      RAISE EXCEPTION 'already_coupled_with_another: お相手は既に別の方とカップル成立されています'
        USING ERRCODE = '54000';
    END IF;
  END IF;
  RETURN NEW;
END;
$pdc$;

CREATE TRIGGER trg_prevent_double_couple
  BEFORE INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_couple();

-- ============================================
-- クライアント側からの参照用 RPC
-- 自分のマッチ相手が他のユーザーと coupled になってるかを RLS 回避で取得する。
-- ユーザーアプリの縁リスト・推しページのロック判定で使用。
-- ============================================
DROP FUNCTION IF EXISTS get_coupled_user_ids(uuid[]);

CREATE OR REPLACE FUNCTION get_coupled_user_ids(user_ids uuid[])
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u FROM (
    SELECT from_user_id AS u FROM matches WHERE status='coupled' AND from_user_id = ANY(user_ids)
    UNION ALL
    SELECT to_user_id   AS u FROM matches WHERE status='coupled' AND to_user_id   = ANY(user_ids)
  ) t;
$$;

GRANT EXECUTE ON FUNCTION get_coupled_user_ids(uuid[]) TO authenticated;

-- ============================================
-- 動作確認:
--   既存の coupled マッチを確認:
--   SELECT id, from_user_id, to_user_id, status FROM matches WHERE status='coupled';
--
-- 緊急時の無効化:
--   ALTER TABLE matches DISABLE TRIGGER trg_prevent_double_couple;
--
-- 完全削除:
--   DROP TRIGGER IF EXISTS trg_prevent_double_couple ON matches;
--   DROP FUNCTION IF EXISTS prevent_double_couple();
-- ============================================
