-- ============================================
-- 縁の間 Supabase Realtime 有効化
-- 実行タイミング: 他の setup-*.sql の後、いつでも
-- 実行方法: Supabase ダッシュボード → SQL Editor で全文を貼り付けて実行
-- ============================================
--
-- 目的:
--   ポーリング (setInterval 10秒) から WebSocket ベースの Realtime に切り替える。
--   サーバー側からの push で:
--     - 運営チャットの返信が即時に届く
--     - マッチング申請・承認が即時に反映される
--     - 管理画面で新着問い合わせ・通報・予約がリアルタイム表示
--   ポーリング負荷削減（10秒に1回 → 60秒の安全弁のみ）にもなる。
--
-- 設計:
--   - Supabase の supabase_realtime publication にテーブルを ADD する
--   - RLS が効くので、ユーザーは自分が見える行の変更だけ受信できる
--   - DELETE イベントを受け取りたい場合は REPLICA IDENTITY FULL も必要だが、
--     縁の間では INSERT / UPDATE 中心なので不要

-- 既に publication が存在する前提（Supabase デフォルトで作られる）
-- もしなければ: CREATE PUBLICATION supabase_realtime;

-- 各テーブルを publication に追加（既に入っていればエラーにならないように IF NOT EXISTS 相当を実現）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE contacts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcements'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE announcements';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE matches';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cashbacks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE cashbacks';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE reports';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE bookings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sotsugyou_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE sotsugyou_requests';
  END IF;
END $$;

-- 確認用クエリ:
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--   → contacts / announcements / matches / cashbacks / reports / bookings / sotsugyou_requests が並べば OK

-- ============================================
-- 取り消したい場合:
--   ALTER PUBLICATION supabase_realtime DROP TABLE contacts;
--   ... 各テーブル同様
-- ============================================
