-- ============================================
-- 縁の間 卒業生の間「その他」 種族別グループチャット（3つの間）
--
-- 日柱の十二運で「種族」が決まる：
--   人間味の間(humanity)  : 冠帯・衰・墓・養
--   効率族の間(efficiency): 長生・帝旺・病・胎
--   気分屋の間(mood)      : 沐浴・建禄・死・絶
--
-- 閲覧は誰でも可。発言(INSERT)は自分の種族の間のみ（RLS + クライアント両方で制限）。
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. ユーザーの種族を日柱十二運から判定する関数
--    十二運 stage index: 0長生 1沐浴 2冠帯 3建禄 4帝旺 5衰 6病 7死 8墓 9絶 10胎 11養
CREATE OR REPLACE FUNCTION graduate_tribe(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  k int; b int; b0 int; dir int; s int;
  chousei int[] := ARRAY[11,6,2,9,2,9,5,0,8,3]; -- 各日干(0-9)の「長生」の地支
BEGIN
  SELECT pillar_day_k, pillar_day_s INTO k, b FROM profiles WHERE id = p_uid;
  IF k IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  b0 := chousei[k + 1];               -- 配列は1始まり
  dir := CASE WHEN k % 2 = 0 THEN 1 ELSE -1 END; -- 陽干=順行 / 陰干=逆行
  s := ((b - b0) * dir % 12 + 12) % 12;
  IF s IN (2,5,8,11) THEN RETURN 'humanity';   -- 冠帯・衰・墓・養
  ELSIF s IN (0,4,6,10) THEN RETURN 'efficiency'; -- 長生・帝旺・病・胎
  ELSE RETURN 'mood'; END IF;                  -- 沐浴・建禄・死・絶
END;
$$;
GRANT EXECUTE ON FUNCTION graduate_tribe(uuid) TO authenticated;

-- 2. 間のメッセージ
CREATE TABLE IF NOT EXISTS graduate_room_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room       text NOT NULL CHECK (room IN ('humanity','efficiency','mood')),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id  text,
  nickname   text,
  avatar_url text,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graduate_room_messages_room_idx ON graduate_room_messages (room, created_at);

ALTER TABLE graduate_room_messages ENABLE ROW LEVEL SECURITY;

-- 閲覧: ログインユーザーは全部屋を閲覧可
DROP POLICY IF EXISTS grm_select ON graduate_room_messages;
CREATE POLICY grm_select ON graduate_room_messages
  FOR SELECT TO authenticated USING (true);

-- 発言: 自分の種族の間のみ
DROP POLICY IF EXISTS grm_insert_own_tribe ON graduate_room_messages;
CREATE POLICY grm_insert_own_tribe ON graduate_room_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND room = graduate_tribe(auth.uid()));

-- 削除: 自分の発言
DROP POLICY IF EXISTS grm_delete_own ON graduate_room_messages;
CREATE POLICY grm_delete_own ON graduate_room_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Realtime 配信に追加（重複はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='graduate_room_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.graduate_room_messages';
  END IF;
END $$;

-- ============================================
-- 動作確認:
--   SELECT graduate_tribe('<user-id>');
--   SELECT room, count(*) FROM graduate_room_messages GROUP BY room;
-- ============================================
