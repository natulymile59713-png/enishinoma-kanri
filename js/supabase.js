// ===== Supabase 初期化 =====
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
