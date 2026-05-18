// ============================================================
// 縁の間 Web Push 配信 Edge Function
// ============================================================
//
// デプロイ:
//   supabase functions deploy send-push --no-verify-jwt
//
// 環境変数（Supabase Dashboard → Edge Functions → send-push → Secrets）:
//   VAPID_PUBLIC_KEY    - クライアントと同じ公開鍵
//   VAPID_PRIVATE_KEY   - 秘密鍵（クライアントには出さない）
//   VAPID_SUBJECT       - 連絡先 mailto:xxx@xxx.com or https://...
//   SUPABASE_URL        - 自動セット
//   SUPABASE_SERVICE_ROLE_KEY - 自動セット（RLS バイパス用）
//
// 呼び出し例（クライアント）:
//   await supa.functions.invoke('send-push', { body: {
//     target_user_ids: ['uuid1', 'uuid2'],  // または target_user_id: 'uuid'
//     title: 'マッチ成立！',
//     body: 'たけしさんとマッチしました',
//     url: '/index.html#en'
//   }});
// ============================================================

// @ts-nocheck Deno 環境のため
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@enishinoma.example';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys are not configured' }, 500);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

  const { target_user_id, target_user_ids, title, body: msg, url, tag, broadcast } = body || {};
  if (!title || !msg) return json({ error: 'title and body are required' }, 400);

  // 配信先 user_id 配列を決定
  let userIds: string[] = [];
  if (broadcast === true) {
    userIds = []; // 全員（push_subscription 付き）に配信
  } else if (Array.isArray(target_user_ids)) {
    userIds = target_user_ids.filter(Boolean);
  } else if (typeof target_user_id === 'string') {
    userIds = [target_user_id];
  } else {
    return json({ error: 'target_user_id / target_user_ids / broadcast のいずれかを指定してください' }, 400);
  }

  // Service role で profiles から subscription を取得（RLS をバイパス）
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supa.from('profiles')
    .select('id, push_subscription')
    .not('push_subscription', 'is', null)
    .is('banned_at', null);
  if (!broadcast && userIds.length > 0) {
    query = query.in('id', userIds);
  }

  const { data: rows, error } = await query;
  if (error) return json({ error: 'profile fetch failed: ' + error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: true, sent: 0, skipped: 'no subscribers' });

  const payload = JSON.stringify({ title, body: msg, url: url || '/', tag: tag || 'enishinoma' });

  // 並列配信 + 失効 subscription は自動削除（GONE / NOT_FOUND）
  let sent = 0, failed = 0, expired = 0;
  await Promise.all(rows.map(async (r) => {
    const sub = r.push_subscription;
    if (!sub || !sub.endpoint) return;
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (e: any) {
      const status = e?.statusCode || 0;
      if (status === 410 || status === 404) {
        // Subscription 失効 → DB からクリア
        expired++;
        await supa.from('profiles').update({
          push_subscription: null,
          push_subscribed_at: null,
        }).eq('id', r.id);
      } else {
        failed++;
        console.log('[send-push] failed for', r.id, status, e?.body || e?.message);
      }
    }
  }));

  return json({ ok: true, sent, failed, expired, total: rows.length });
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
