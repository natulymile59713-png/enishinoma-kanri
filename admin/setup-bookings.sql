-- ============================================
-- 縁の間 - 鑑定予約 拡張SQL
-- (setup.sql / setup-users.sql / setup-reports.sql / setup-sotsugyou.sql 実行済み前提)
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. bookings テーブル
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id text,
  guest_name text NOT NULL,
  guest_phone text,
  scheduled_date date NOT NULL,
  scheduled_slot text NOT NULL,  -- '10:00-11:30' など
  notes text,
  status text NOT NULL DEFAULT 'pending',  -- pending / confirmed / cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_by_admin boolean DEFAULT false
);

-- アクティブな予約は同一日時に1件のみ（ダブルブッキング防止）
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_unique
ON bookings(scheduled_date, scheduled_slot)
WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id);

-- 2. 公開用：指定月の予約済み枠を取得するRPC（個人情報は返さない）
CREATE OR REPLACE FUNCTION get_booked_slots(p_year int, p_month int)
RETURNS TABLE (scheduled_date date, scheduled_slot text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT scheduled_date, scheduled_slot
  FROM bookings
  WHERE EXTRACT(YEAR FROM scheduled_date) = p_year
    AND EXTRACT(MONTH FROM scheduled_date) = p_month
    AND status IN ('pending', 'confirmed');
$$;
GRANT EXECUTE ON FUNCTION get_booked_slots(int, int) TO anon, authenticated;

-- 3. RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 予約は誰でも追加可（公開ページから）
DROP POLICY IF EXISTS "bookings_insert" ON bookings;
CREATE POLICY "bookings_insert" ON bookings FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 自分の予約 or 管理者だけが詳細を閲覧可
DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings FOR SELECT TO authenticated
USING (is_admin() OR user_id = auth.uid());

-- 管理者のみ更新可（ステータス変更、キャンセルなど）
DROP POLICY IF EXISTS "bookings_update_admin" ON bookings;
CREATE POLICY "bookings_update_admin" ON bookings FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 4. 追加カラム（1人/2人受け対応）
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_type text NOT NULL DEFAULT 'solo';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_name text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_member_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_phone text;

-- 5. 鑑定方法（対面 / オンライン）
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kantei_method text;
