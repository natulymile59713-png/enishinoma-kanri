-- ============================================
-- 縁の間 破局申告 → 相互非表示（卒業生の間）
--
-- 卒業生同士が卒業後に破局した時、お互い「だけ」が見えなくなる（相互ブロック）。
-- ・どちらか一方の申告で成立（report_breakup）
-- ・卒業生の資格・特典は両者そのまま維持（退会はさせない）
-- ・他の卒業生からは普通に見える
--
-- 「卒業生の間」（アプリ内チャット空間）の一覧/チャットを描画する時に、
-- 自分から見た非表示ユーザーを除外するための土台。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. 相互非表示ペア（順不同で1行に正規化: user_lo < user_hi）
CREATE TABLE IF NOT EXISTS hidden_pairs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_lo     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_hi     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL DEFAULT '破局',
  reported_by uuid REFERENCES profiles(id),
  match_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hidden_pairs_order CHECK (user_lo < user_hi),
  UNIQUE (user_lo, user_hi)
);

ALTER TABLE hidden_pairs ENABLE ROW LEVEL SECURITY;

-- 当事者は自分が含まれる行のみ閲覧可（クライアントで「非表示集合」を作るため）
DROP POLICY IF EXISTS hidden_pairs_select_self ON hidden_pairs;
CREATE POLICY hidden_pairs_select_self ON hidden_pairs
  FOR SELECT TO authenticated
  USING (user_lo = auth.uid() OR user_hi = auth.uid());

-- 管理者は全件閲覧可
DROP POLICY IF EXISTS hidden_pairs_select_admin ON hidden_pairs;
CREATE POLICY hidden_pairs_select_admin ON hidden_pairs
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT / DELETE は RPC(SECURITY DEFINER) 経由のみ → 一般の書き込みポリシーは作らない

-- 2. 破局申告 RPC（どちらか一方が呼べば相互非表示が成立）
DROP FUNCTION IF EXISTS report_breakup(uuid);
CREATE OR REPLACE FUNCTION report_breakup(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_lo    uuid;
  v_hi    uuid;
  v_match uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_partner_id IS NULL OR p_partner_id = v_me THEN RAISE EXCEPTION 'invalid_partner'; END IF;

  -- 順不同に正規化
  IF v_me < p_partner_id THEN
    v_lo := v_me; v_hi := p_partner_id;
  ELSE
    v_lo := p_partner_id; v_hi := v_me;
  END IF;

  -- 元のカップルマッチ(あれば)を参考として記録
  SELECT id INTO v_match
    FROM matches
   WHERE status = 'coupled'
     AND ( (from_user_id = v_lo AND to_user_id = v_hi)
        OR (from_user_id = v_hi AND to_user_id = v_lo) )
   LIMIT 1;

  INSERT INTO hidden_pairs (user_lo, user_hi, reason, reported_by, match_id)
  VALUES (v_lo, v_hi, '破局', v_me, v_match)
  ON CONFLICT (user_lo, user_hi) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION report_breakup(uuid) TO authenticated;

-- 3. 2人が相互非表示かを返すヘルパー（将来の卒業生の間のサーバ側クエリ用）
DROP FUNCTION IF EXISTS are_hidden(uuid, uuid);
CREATE OR REPLACE FUNCTION are_hidden(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hidden_pairs
    WHERE user_lo = LEAST(p_a, p_b)
      AND user_hi = GREATEST(p_a, p_b)
  );
$$;
GRANT EXECUTE ON FUNCTION are_hidden(uuid, uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   -- A が B を破局申告（A でログインした状態で）
--   SELECT report_breakup('<B-user-id>');
--   -- 成立確認
--   SELECT * FROM hidden_pairs;
--   SELECT are_hidden('<A-user-id>', '<B-user-id>');  -- true
-- ============================================
