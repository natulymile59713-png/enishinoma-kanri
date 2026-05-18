// ===== Supabase 初期化 =====
// 注: 外部依存 `supabase` (CDN) のグローバル UMD が未型付けなので
// @ts-check は外している。supa は any 扱いで利用される。

/** Supabase プロジェクト URL @type {string} */
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
/** Supabase anon (public) key — RLS で保護される前提 @type {string} */
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';

/** Supabase JS クライアント。型は @supabase/supabase-js の SupabaseClient @type {any} */
// eslint-disable-next-line no-undef
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
