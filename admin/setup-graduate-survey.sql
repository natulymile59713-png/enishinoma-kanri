-- ============================================
-- 縁の間 卒業生の間「近況」 アンケート + ♡レビュー
--
-- ・アンケート: graduate_posts に post_type='survey' と survey(jsonb) を追加。
--     survey = { title, options:[..], target:{ sex, ageMin, ageMax, juniun:[..] } }
-- ・回答: graduate_survey_answers（1人1回）。回答すると回答者に♡が付与される。
-- ・♡: graduate_hearts。
--     - source='survey': アンケート回答で回答者が受け取る（1アンケート1回）
--     - source='dm'    : 個別メッセージで「♡を贈る」（相手1人につき1回）
--
-- 実行方法: Supabase SQL Editor で全文貼り付け → Run
-- ============================================

-- 1. 投稿テーブルにアンケート用カラム
ALTER TABLE graduate_posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'normal';
ALTER TABLE graduate_posts ADD COLUMN IF NOT EXISTS survey jsonb;

-- 2. アンケート回答
CREATE TABLE IF NOT EXISTS graduate_survey_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES graduate_posts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  choice_index int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS graduate_survey_answers_post_idx ON graduate_survey_answers (post_id);

ALTER TABLE graduate_survey_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsa_select ON graduate_survey_answers;
CREATE POLICY gsa_select ON graduate_survey_answers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS gsa_insert_own ON graduate_survey_answers;
CREATE POLICY gsa_insert_own ON graduate_survey_answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 3. ♡（受け取ったハート）
CREATE TABLE IF NOT EXISTS graduate_hearts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  giver_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  source      text NOT NULL CHECK (source IN ('survey','dm')),
  ref_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graduate_hearts_receiver_idx ON graduate_hearts (receiver_id);
-- 重複防止: アンケートは(受信者×アンケート)1回 / DMは(受信者×贈り主)1回
CREATE UNIQUE INDEX IF NOT EXISTS graduate_hearts_survey_uq ON graduate_hearts (receiver_id, ref_id) WHERE source = 'survey';
CREATE UNIQUE INDEX IF NOT EXISTS graduate_hearts_dm_uq ON graduate_hearts (receiver_id, giver_id) WHERE source = 'dm';

ALTER TABLE graduate_hearts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_select ON graduate_hearts;
CREATE POLICY gh_select ON graduate_hearts FOR SELECT TO authenticated USING (true);
-- DMの♡は自分が贈り主の時のみINSERT可。surveyの♡はトリガー(SECURITY DEFINER)が入れる
DROP POLICY IF EXISTS gh_insert_dm ON graduate_hearts;
CREATE POLICY gh_insert_dm ON graduate_hearts FOR INSERT TO authenticated
  WITH CHECK (source = 'dm' AND giver_id = auth.uid() AND receiver_id <> auth.uid());

-- 4. アンケート回答時に回答者へ♡を付与するトリガー
CREATE OR REPLACE FUNCTION award_survey_heart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
BEGIN
  SELECT user_id INTO v_creator FROM graduate_posts WHERE id = NEW.post_id;
  -- 自分のアンケートに自分で回答した場合は付与しない
  IF v_creator IS NOT NULL AND v_creator <> NEW.user_id THEN
    INSERT INTO graduate_hearts (receiver_id, giver_id, source, ref_id)
    VALUES (NEW.user_id, v_creator, 'survey', NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_award_survey_heart ON graduate_survey_answers;
CREATE TRIGGER trg_award_survey_heart
  AFTER INSERT ON graduate_survey_answers
  FOR EACH ROW EXECUTE FUNCTION award_survey_heart();

-- 5. Realtime 配信（投票数の即時反映用に answers を追加。重複はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='graduate_survey_answers') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.graduate_survey_answers';
  END IF;
END $$;

-- ============================================
-- 動作確認:
--   SELECT receiver_id, count(*) FROM graduate_hearts GROUP BY receiver_id;
--   SELECT * FROM graduate_posts WHERE post_type='survey';
-- ============================================
