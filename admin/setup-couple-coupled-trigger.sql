-- ============================================
-- 縁の間 カップル成立時の通知を「サーバー側で確実に」発火させるトリガー
--   matches.status が 'coupled' になった瞬間に、AFTER トリガーで
--     1) send_couple_notice       … 両者への「成立おめでとう＋卒業案内」
--     2) notify_couple_closures   … やり取りのあった他相手への「成立報告＋24h後消去」
--   を呼ぶ。クライアント（ブラウザのキャッシュ状態）に依存せず必ず送られる。
--
-- 設計:
--   - 通知はベストエフォート。失敗してもカップル成立自体はロールバックさせない
--     （各呼び出しを BEGIN ... EXCEPTION WHEN OTHERS で握りつぶす）
--   - 各 RPC 側に二重送信防止があるため、クライアントが同じ RPC を呼んでも重複しない
--   - INSERT 先は contacts のみ → matches トリガーの再帰は起きない
--
-- 前提（実行済みであること）:
--   setup-couple-notice.sql            (send_couple_notice)
--   setup-couple-closure-notify.sql    (notify_couple_closures)
--   setup-couple-mutual-request.sql    (request_couple / *_coupled_at)
--   setup-couple-exclusive.sql         (prevent_double_couple = BEFORE トリガー)
-- 実行: Supabase SQL Editor で全文 Run（冪等）
-- ============================================

CREATE OR REPLACE FUNCTION on_match_coupled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $omc$
BEGIN
  -- coupled へ遷移した瞬間のみ（INSERT で coupled、または UPDATE で非coupled→coupled）
  IF NEW.status = 'coupled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'coupled') THEN

    -- 1) 両者への成立おめでとう＋卒業案内（ベストエフォート）
    BEGIN
      PERFORM send_couple_notice(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'on_match_coupled: send_couple_notice failed for match %: %', NEW.id, SQLERRM;
    END;

    -- 2) やり取りのあった他相手への「成立報告＋24時間後消去」（ベストエフォート）
    BEGIN
      PERFORM notify_couple_closures(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'on_match_coupled: notify_couple_closures failed for match %: %', NEW.id, SQLERRM;
    END;

  END IF;
  RETURN NEW;
END;
$omc$;

-- prevent_double_couple は BEFORE。通知は確定後に撃ちたいので AFTER で。
DROP TRIGGER IF EXISTS trg_on_match_coupled ON matches;
CREATE TRIGGER trg_on_match_coupled
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION on_match_coupled();

-- ============================================
-- 動作確認:
--   -- 既存の coupled マッチで手動発火させたい場合（auth.uid() が要るためアプリ経由が基本）:
--   -- 通常はアプリで「付き合いました！」が双方揃えば自動で送られる。
--
--   -- 送信済み通知の確認:
--   SELECT user_id, left(body,40), created_at FROM contacts
--   WHERE contact_type='運営通知' ORDER BY created_at DESC LIMIT 10;
--
-- 緊急時の無効化:
--   ALTER TABLE matches DISABLE TRIGGER trg_on_match_coupled;
-- 完全削除:
--   DROP TRIGGER IF EXISTS trg_on_match_coupled ON matches;
--   DROP FUNCTION IF EXISTS on_match_coupled();
-- ============================================
