-- ============================================
-- 縁の間 カップル成立時の運営通知 自動送信 RPC
-- 実行方法: Supabase SQL Editor で全文貼り付けて Run
-- ============================================
-- setCoupled 押下後に setCoupled クライアントから呼ばれる。
-- SECURITY DEFINER で両者の contacts に '運営通知' を一括 INSERT。
-- 重複防止: 既に同じカップル成立通知が両者の contacts にあれば何もしない。

DROP FUNCTION IF EXISTS send_couple_notice(uuid);

CREATE OR REPLACE FUNCTION send_couple_notice(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $scn$
DECLARE
  m_row matches%ROWTYPE;
  pa profiles%ROWTYPE;
  pb profiles%ROWTYPE;
  notice_body text;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO m_row FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- 呼び出し元がこのマッチの当事者であることを確認
  IF caller <> m_row.from_user_id AND caller <> m_row.to_user_id THEN
    RAISE EXCEPTION 'not_match_member';
  END IF;

  -- 重複防止: 既にこのマッチに対する通知が出ていればスキップ
  -- 本文の先頭フレーズで判定（厳密にはマッチID等を保存するのが堅いが、シンプル優先）
  IF EXISTS (
    SELECT 1 FROM contacts
    WHERE contact_type = '運営通知'
      AND body LIKE 'この度はカップル成立、おめでとうございます%'
      AND user_id IN (m_row.from_user_id, m_row.to_user_id)
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO pa FROM profiles WHERE id = m_row.from_user_id;
  SELECT * INTO pb FROM profiles WHERE id = m_row.to_user_id;

  notice_body := 'この度はカップル成立、おめでとうございます🎉 末永くお幸せに🍀

つきましては、卒業の準備に入らせて頂きます。まず、大きな選択肢としては2つになります。

①「その他ページ」から「退会」を選びご卒業
②「その他ページ」→「プラン」から「卒業鑑定プラン申し込み」の後、卒業鑑定を受けて卒業

①はその通りサブスクを解約して退会されるシンプルな流れになります。
ただし、この後②で説明する特典がつかなくなるのと、サービス(卒業生向けのNOマッチングプラン)が使えなくなります。

②は①が「退会」という解釈とすると「卒業」という解釈になります。卒業鑑定をお受け頂きご卒業されると、

・卒業後も運営への連絡が可能
・今後の全ての鑑定が30%OFF
   (別途鑑定メニューあり)
・卒業生の間への参加権
・紹介手数料プログラムへの参加権

以上4つの特典が付与されます。

卒業後はマッチング機能を除き、「相性診断」「相性結果メモ」「運勢カレンダー」の機能が使える【NOマッチングプラン】へ切り替え頂く形になります。

「卒業生の間」はこちらのプラン内のサービスになりますので、ご参加希望の方はNOマッチングプランをご検討ください🍀

卒業生の間では、卒業生同士でパートナーとの近況報告や他の卒業生との交流やトーク、相談などが匿名でできる場になります。

NOマッチングプランを使用しないことももちろん可能です。
その場合は、特典は4つのうち、卒業生の間への参加権以外の3つが付与される形になります。

そして、ご紹介された方いてその方が卒業鑑定を受けて卒業された際は、キャッシュバック対象となりますので、ご登録時のメールアドレスへご連絡をさせて頂きます。

その他、確認したいことや分からないことなどご質問がありましたら、こちらの運営チャットもしくは、その他ページ内の「問い合わせ」からご連絡ください。';

  INSERT INTO contacts (user_id, member_id, nickname, contact_type, body, status) VALUES
    (pa.id, pa.member_id, pa.nickname, '運営通知', notice_body, 'replied'),
    (pb.id, pb.member_id, pb.nickname, '運営通知', notice_body, 'replied');
END;
$scn$;

GRANT EXECUTE ON FUNCTION send_couple_notice(uuid) TO authenticated;

-- ============================================
-- 動作確認:
--   SELECT send_couple_notice('<match_id>');  -- カップル成立済みのマッチで実行
--
-- 通知が両者に入ったか確認:
--   SELECT user_id, contact_type, left(body, 40) FROM contacts WHERE contact_type='運営通知' ORDER BY created_at DESC LIMIT 5;
-- ============================================
