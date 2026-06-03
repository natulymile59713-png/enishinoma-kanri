-- ============================================
-- 縁の間 卒業認定 機能
-- 実行方法: Supabase SQL Editor に全文貼り付けて Run
-- ============================================
-- 卒業鑑定の予約後、運営が「認定」ボタンを押すとこの RPC が呼ばれる。
-- profiles.graduated_at にタイムスタンプを記録 + 運営通知メッセージを INSERT。
-- 認定済ユーザーのみ「卒業生の間」(NOマッチングプラン) を利用可能。

-- 1. graduated_at / graduated_by カラム追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduated_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS graduated_by uuid REFERENCES auth.users(id);

-- 2. RPC: 卒業認定（管理者専用、複数ユーザー一括対応）
DROP FUNCTION IF EXISTS certify_graduation(uuid[]);

CREATE OR REPLACE FUNCTION certify_graduation(p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cg$
DECLARE
  uid uuid;
  prof record;
  r record;
  cb_amount int;
  v_retro_count int;
  msg_body text := '🎓 卒業が認定されました！

NOマッチングプランに切り替えで「卒業生の間」へ参加できます🎉

「その他」→「プラン」→「NOマッチング」を選択してください。';
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  FOREACH uid IN ARRAY p_user_ids LOOP
    SELECT id, member_id, nickname, graduated_at, referrer_id, is_affiliate, banned_at, withdrawal_type
      INTO prof
      FROM profiles WHERE id = uid;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- 既に認定済ならスキップ（重複通知/重複CB防止）
    IF prof.graduated_at IS NOT NULL THEN CONTINUE; END IF;
    -- 認定タイムスタンプ
    UPDATE profiles
       SET graduated_at = now(),
           graduated_by = auth.uid()
     WHERE id = uid;
    -- 認定通知をユーザーの公式チャットへ
    INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status)
    VALUES (uid, prof.member_id, prof.nickname, '運営通知', msg_body, 'replied');

    -- ===== (a) この卒業者(prof)の紹介者へキャッシュバック =====
    --   紹介者が対象 = 強制退会でない かつ (アフィリエイター or 卒業認定済)
    --   金額: アフィリ 6930 / 通常 3690
    IF prof.referrer_id IS NOT NULL THEN
      SELECT id, member_id, nickname, is_affiliate, graduated_at, banned_at, withdrawal_type
        INTO r FROM profiles WHERE member_id = prof.referrer_id;
      IF FOUND
         AND NOT (r.banned_at IS NOT NULL AND r.withdrawal_type = 'banned')
         AND (r.is_affiliate OR r.graduated_at IS NOT NULL) THEN
        cb_amount := CASE WHEN r.is_affiliate THEN 6930 ELSE 3690 END;
        INSERT INTO cashbacks (referrer_id, referrer_member_id, referrer_nickname, referee_id, referee_member_id, referee_nickname, amount, status)
          VALUES (r.id, r.member_id, r.nickname, prof.id, prof.member_id, prof.nickname, cb_amount, 'eligible')
          ON CONFLICT (referrer_id, referee_id) DO NOTHING;
        -- 在籍中（退会していない）なら運営チャットへ通知。退会者は管理画面からメール連絡
        IF r.banned_at IS NULL THEN
          INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status)
          VALUES (r.id, r.member_id, r.nickname, '運営通知',
            '🎉 ご紹介いただいた '||COALESCE(prof.nickname,'お知り合い')||'さんが卒業されました！キャッシュバック対象です。プロフィール画面から振込先口座をご登録ください。', 'replied');
        END IF;
      END IF;
    END IF;

    -- ===== (b) prof が卒業認定され対象資格を得た → 過去に紹介し既に卒業済の人へ遡及CB =====
    SELECT count(*) INTO v_retro_count FROM profiles WHERE referrer_id = prof.member_id AND graduated_at IS NOT NULL;
    IF v_retro_count > 0 THEN
      cb_amount := CASE WHEN prof.is_affiliate THEN 6930 ELSE 3690 END;
      FOR r IN SELECT id, member_id, nickname FROM profiles WHERE referrer_id = prof.member_id AND graduated_at IS NOT NULL LOOP
        INSERT INTO cashbacks (referrer_id, referrer_member_id, referrer_nickname, referee_id, referee_member_id, referee_nickname, amount, status)
          VALUES (prof.id, prof.member_id, prof.nickname, r.id, r.member_id, r.nickname, cb_amount, 'eligible')
          ON CONFLICT (referrer_id, referee_id) DO NOTHING;
      END LOOP;
      -- 通常ユーザーが新たに資格を得たケースのみ案内（アフィリは元々対象なので除外）
      IF NOT prof.is_affiliate THEN
        INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status)
        VALUES (prof.id, prof.member_id, prof.nickname, '運営通知',
          '🎉 ご卒業おめでとうございます！これまでにご紹介し卒業された方が、キャッシュバック対象になりました。プロフィール画面から振込先口座をご登録ください。', 'replied');
      END IF;
    END IF;
  END LOOP;
END;
$cg$;

GRANT EXECUTE ON FUNCTION certify_graduation(uuid[]) TO authenticated;

-- ============================================
-- 動作確認:
--   認定済ユーザー一覧:
--   SELECT member_id, nickname, graduated_at FROM profiles WHERE graduated_at IS NOT NULL;
--
--   解除（再テスト用、特定ユーザー）:
--   UPDATE profiles SET graduated_at=NULL, graduated_by=NULL WHERE member_id IN ('EN-XXXXXXXX');
--   DELETE FROM contacts WHERE contact_type='運営通知' AND body LIKE '🎓 卒業が認定%';
-- ============================================
