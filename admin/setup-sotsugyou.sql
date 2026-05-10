-- ============================================
-- 縁の間 管理画面 - 卒業申請・キャッシュバック 拡張SQL
-- (setup.sql / setup-users.sql / setup-reports.sql 実行済み前提)
-- Supabase ダッシュボード → SQL Editor で実行
-- ============================================

-- 1. 卒業申請テーブル（1ユーザー1申請＝1レコード、双方申請でペアが揃う）
CREATE TABLE IF NOT EXISTS sotsugyou_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id text,
  nickname text,
  partner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_member_id text NOT NULL,
  partner_nickname text,
  match_id uuid,
  status text NOT NULL DEFAULT 'pending',  -- pending / approved / rejected
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_user_id)
);

CREATE INDEX IF NOT EXISTS sotsugyou_user_idx ON sotsugyou_requests(user_id);
CREATE INDEX IF NOT EXISTS sotsugyou_partner_idx ON sotsugyou_requests(partner_user_id);
CREATE INDEX IF NOT EXISTS sotsugyou_status_idx ON sotsugyou_requests(status);

-- 2. キャッシュバックテーブル
CREATE TABLE IF NOT EXISTS cashbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_member_id text,
  referrer_nickname text,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_member_id text,
  referee_nickname text,
  amount integer NOT NULL DEFAULT 3690,
  status text NOT NULL DEFAULT 'eligible',  -- eligible / paid
  bank_snapshot jsonb,                       -- 振込時点の口座情報スナップショット
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referee_id)
);

CREATE INDEX IF NOT EXISTS cashbacks_referrer_idx ON cashbacks(referrer_id);
CREATE INDEX IF NOT EXISTS cashbacks_status_idx ON cashbacks(status);

-- 3. RLS：sotsugyou_requests
ALTER TABLE sotsugyou_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sotsugyou_select" ON sotsugyou_requests;
CREATE POLICY "sotsugyou_select" ON sotsugyou_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR partner_user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "sotsugyou_insert" ON sotsugyou_requests;
CREATE POLICY "sotsugyou_insert" ON sotsugyou_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sotsugyou_delete" ON sotsugyou_requests;
CREATE POLICY "sotsugyou_delete" ON sotsugyou_requests FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status IN ('pending', 'rejected'));

DROP POLICY IF EXISTS "sotsugyou_update_admin" ON sotsugyou_requests;
CREATE POLICY "sotsugyou_update_admin" ON sotsugyou_requests FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 4. RLS：cashbacks
ALTER TABLE cashbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashbacks_select" ON cashbacks;
CREATE POLICY "cashbacks_select" ON cashbacks FOR SELECT TO authenticated
USING (referrer_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "cashbacks_insert_admin" ON cashbacks;
CREATE POLICY "cashbacks_insert_admin" ON cashbacks FOR INSERT TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "cashbacks_update_admin" ON cashbacks;
CREATE POLICY "cashbacks_update_admin" ON cashbacks FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
