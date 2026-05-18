-- ============================================
-- 縁の間 サーバー側レート制限（BEFORE INSERT トリガー）
-- 実行タイミング: 他の setup-*.sql の後、いつでも
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 目的:
--   クライアント側のレート制限は localStorage 経由なので簡単に回避できる。
--   重要テーブル (contacts / reports / matches / bookings) に
--   BEFORE INSERT トリガーを仕込んで「過去 N 分以内の同ユーザー件数」を確認し、
--   閾値を超えたらエラーで止める。
--
-- 設計:
--   - 共通関数 enforce_rate_limit(table, identity_col, window_min, max_count)
--     ... PL/pgSQL では動的なテーブル名を扱うので、各テーブル専用のトリガー関数を用意する方が安全
--   - 認証ユーザーは auth.uid() で識別。 bookings は member_id ベース（公開フォーム）
--   - 制限値はコメントで明示し、変更しやすいよう各関数の冒頭に定数化

-- ===== contacts: 1ユーザー / 5分間 / 10件 =====
CREATE OR REPLACE FUNCTION rate_limit_contacts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt int;
  win_min int := 5;     -- 観測ウィンドウ（分）
  max_cnt int := 10;    -- 上限件数
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM contacts
   WHERE user_id = NEW.user_id
     AND created_at > now() - (win_min || ' minutes')::interval;
  IF cnt >= max_cnt THEN
    RAISE EXCEPTION 'rate_limit_exceeded: contacts (% records in last % min, limit %)', cnt, win_min, max_cnt
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_contacts ON contacts;
CREATE TRIGGER trg_rate_limit_contacts
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_contacts();

-- ===== reports: 1ユーザー / 1日 / 20件 =====
CREATE OR REPLACE FUNCTION rate_limit_reports()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt int;
  win_min int := 60 * 24;
  max_cnt int := 20;
BEGIN
  IF NEW.reporter_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM reports
   WHERE reporter_id = NEW.reporter_id
     AND created_at > now() - (win_min || ' minutes')::interval;
  IF cnt >= max_cnt THEN
    RAISE EXCEPTION 'rate_limit_exceeded: reports (% records in last 24h, limit %)', cnt, max_cnt
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_reports ON reports;
CREATE TRIGGER trg_rate_limit_reports
  BEFORE INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_reports();

-- ===== matches: 1ユーザー / 1日 / 100件（マッチング申請） =====
CREATE OR REPLACE FUNCTION rate_limit_matches()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt int;
  win_min int := 60 * 24;
  max_cnt int := 100;
BEGIN
  IF NEW.from_user_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM matches
   WHERE from_user_id = NEW.from_user_id
     AND created_at > now() - (win_min || ' minutes')::interval;
  IF cnt >= max_cnt THEN
    RAISE EXCEPTION 'rate_limit_exceeded: matches (% records in last 24h, limit %)', cnt, max_cnt
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_matches ON matches;
CREATE TRIGGER trg_rate_limit_matches
  BEFORE INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_matches();

-- ===== bookings: 1 会員ID / 1日 / 5件（予約は公開なので member_id ベース） =====
CREATE OR REPLACE FUNCTION rate_limit_bookings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt int;
  win_min int := 60 * 24;
  max_cnt int := 5;
BEGIN
  IF NEW.member_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM bookings
   WHERE member_id = NEW.member_id
     AND status != 'cancelled'
     AND created_at > now() - (win_min || ' minutes')::interval;
  IF cnt >= max_cnt THEN
    RAISE EXCEPTION 'rate_limit_exceeded: bookings (% records in last 24h, limit %)', cnt, max_cnt
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_bookings ON bookings;
CREATE TRIGGER trg_rate_limit_bookings
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_bookings();

-- ============================================
-- 緊急時の解除方法（一時的に止めたい時）:
--   ALTER TABLE contacts DISABLE TRIGGER trg_rate_limit_contacts;
--   ...そして対応後に再度 ENABLE
--
-- 完全削除（このマイグレーションをロールバック）:
--   DROP TRIGGER IF EXISTS trg_rate_limit_contacts ON contacts;
--   DROP TRIGGER IF EXISTS trg_rate_limit_reports ON reports;
--   DROP TRIGGER IF EXISTS trg_rate_limit_matches ON matches;
--   DROP TRIGGER IF EXISTS trg_rate_limit_bookings ON bookings;
--   DROP FUNCTION IF EXISTS rate_limit_contacts(), rate_limit_reports(),
--                            rate_limit_matches(), rate_limit_bookings();
-- ============================================
