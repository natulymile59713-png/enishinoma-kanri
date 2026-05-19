// @ts-check
// ===== 縁の間 - 共通ユーティリティ =====
// 3アプリ（user / admin / booking）で共有される副作用のないヘルパー集。
// 編集する場合は admin/js/utils.js と booking/js/utils.js も同じ内容に揃えること。
// （build.py が全アプリの dist にインライン化する）

/**
 * 任意の値を HTML エスケープした文字列にする。XSS 防止用。
 * @param {unknown} s
 * @returns {string}
 */
function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

/** @deprecated 互換のため残してある。新規コードでは escapeHtml を使うこと。 */
var escapeText = escapeHtml;

/**
 * 数値を 2 桁ゼロ埋め文字列にする。
 * @param {number|string} n
 * @returns {string}
 */
function pad2(n){
  return String(n).padStart(2, '0');
}

/**
 * 年月日（数値）から 'YYYY-MM-DD' 形式のキーを作る。
 * @param {number} y
 * @param {number} m  - 1始まり（カレンダー的な月）
 * @param {number} d
 * @returns {string}
 */
function formatDateKey(y, m, d){
  return y + '-' + pad2(m) + '-' + pad2(d);
}

/**
 * ISO 8601 文字列を 'YYYY/MM/DD HH:mm' に整形する。
 * @param {string|null|undefined} iso
 * @returns {string}
 */
function formatDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '/' + pad2(d.getMonth()+1) + '/' + pad2(d.getDate())
       + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/**
 * ISO 8601 文字列を「たった今」「3分前」「2日前」のような相対表現にする。
 * 1週間以上前は formatDateTime にフォールバック。
 * @param {string|null|undefined} iso
 * @returns {string}
 */
function formatRelative(iso){
  if(!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if(diff < 60) return 'たった今';
  if(diff < 3600) return Math.floor(diff/60) + '分前';
  if(diff < 86400) return Math.floor(diff/3600) + '時間前';
  if(diff < 86400*7) return Math.floor(diff/86400) + '日前';
  return formatDateTime(iso);
}

/**
 * 文字列を「HTML エスケープ → URL を <a> リンク化 → 改行を <br>」の順で処理する。
 * メッセージ本文の表示専用。戻り値は HTML として安全に innerHTML できる。
 * @param {string|null|undefined} text
 * @returns {string}
 */
function linkifyText(text){
  if(text == null) return '';
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, function(url){
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" '
         + 'style="color:inherit;text-decoration:underline;word-break:break-all">'
         + url + '</a>';
  });
  return escaped.replace(/\n/g, '<br>');
}

// =====================================================================
// bot 対策ヘルパー
// =====================================================================
// 三段構え:
//   1) Honeypot   - 隠しフィールド。bot が機械的に全項目埋めると検出
//   2) MinDelay   - フォーム表示〜送信が極端に短ければ bot 判定
//   3) RateLimit  - クライアント側で連投制限（localStorage 記録）
// + DB トリガー (admin/setup-rate-limits.sql) でサーバー側も二重防御。

/**
 * 指定コンテナに honeypot 隠しフィールドを挿入する（重複挿入は防止）。
 * 既に同名の input があれば何もしない。
 * @param {string|HTMLElement} containerOrId - 挿入先のフォーム要素 or その id
 * @param {string} [fieldName='hp_url'] - 隠しフィールド名（bot が好む紛らわしい名前）
 */
function applyHoneypot(containerOrId, fieldName){
  fieldName = fieldName || 'hp_url';
  const el = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
  if(!el) return;
  if(el.querySelector('input[name="'+fieldName+'"]')) return; // 既に挿入済
  const hp = document.createElement('input');
  hp.type = 'text';
  hp.name = fieldName;
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  // 見えない+操作不可。display:none だと bot に「フィールド無効」と認識される可能性があるので使わない
  hp.style.cssText = 'position:absolute !important;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
  el.appendChild(hp);
}

/**
 * Honeypot に値が入っていたら true（=bot 検出）。
 * @param {string|HTMLElement} containerOrId
 * @param {string} [fieldName='hp_url']
 * @returns {boolean}
 */
function isHoneypotTriggered(containerOrId, fieldName){
  fieldName = fieldName || 'hp_url';
  const el = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
  if(!el) return false;
  const hp = el.querySelector('input[name="'+fieldName+'"]');
  return !!(hp && hp.value && hp.value.trim() !== '');
}

/**
 * フォーム表示時刻を記録する。markFormShown で記録 → wasFormShownTooFast で検証。
 * @param {string} formKey - 任意のキー名（'register' など）
 */
function markFormShown(formKey){
  try{ sessionStorage.setItem('formShown:'+formKey, String(Date.now())); }catch(e){}
}

/**
 * フォーム送信が早すぎるか（=bot 判定）。デフォルトは 1.5 秒未満を NG とする。
 * markFormShown を呼んでない場合は false（=人間扱い、誤検知を避ける）。
 * @param {string} formKey
 * @param {number} [minMs=1500]
 * @returns {boolean}
 */
function wasFormShownTooFast(formKey, minMs){
  minMs = (typeof minMs === 'number') ? minMs : 1500;
  try{
    const shown = parseInt(sessionStorage.getItem('formShown:'+formKey) || '0', 10);
    if(!shown) return false;
    return (Date.now() - shown) < minMs;
  }catch(e){ return false; }
}

/**
 * クライアント側レート制限。直前の送信から intervalMs 経っていなければ false を返す。
 * 通過時は呼び出し側で recordRateLimitHit() を呼ぶこと。
 * @param {string} key
 * @param {number} intervalMs - 連投を許す最短間隔（ミリ秒）
 * @returns {boolean} true=送信OK, false=待機が必要
 */
function checkRateLimit(key, intervalMs){
  try{
    const last = parseInt(localStorage.getItem('rl:'+key) || '0', 10);
    return (Date.now() - last) >= intervalMs;
  }catch(e){ return true; }
}

/** 送信成功時に呼ぶ：レート制限の最終送信時刻を更新。 */
function recordRateLimitHit(key){
  try{ localStorage.setItem('rl:'+key, String(Date.now())); }catch(e){}
}

/**
 * 一括バリデーション。bot 判定なら理由を返す（null なら通過）。
 * 呼び出し例: const reason = checkBotDefense({form:'register', minMs:2000});
 *             if(reason){ alert(reason); return; }
 * @param {{form:string, container?:string|HTMLElement, minMs?:number, rateKey?:string, rateMs?:number}} opts
 * @returns {string|null}  - null=通過、文字列=ユーザーに見せる理由
 */
function checkBotDefense(opts){
  if(!opts) return null;
  if(opts.container && isHoneypotTriggered(opts.container)){
    return '入力内容に不正があります。';
  }
  if(opts.form && wasFormShownTooFast(opts.form, opts.minMs)){
    return '操作が早すぎます。少し時間をおいてから送信してください。';
  }
  if(opts.rateKey && opts.rateMs && !checkRateLimit(opts.rateKey, opts.rateMs)){
    const sec = Math.ceil(opts.rateMs / 1000);
    return '連続送信を防ぐため、' + sec + ' 秒ほど時間をおいてください。';
  }
  return null;
}

// =====================================================================
// モデレーション（規約違反検知）
// =====================================================================
// 縁の間規約「他SNS の ID・連絡先交換は禁止」を機械的にサポート。
// 完全ブロックではなく「警告 + 強い注意喚起」スタイル。
// クライアント側のチェックは突破されるので、サーバー側でも将来 trigger
// で重複検知すると安全（次フェーズで対応する余地あり）。

/**
 * @typedef {{type:string, label:string, match:string, index:number}} ModerationHit
 */

// 検知ルール（label は人間向けの説明文）
const MODERATION_RULES = [
  {
    type: 'phone',
    label: '電話番号',
    // 0X-XXXX-XXXX / 0X XXXX XXXX / 0XXXXXXXXXX (全角数字も対応)
    pattern: /(?:0[\d０-９][- 　]?[\d０-９]{2,4}[- 　]?[\d０-９]{3,4})/g,
  },
  {
    type: 'email',
    label: 'メールアドレス',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: 'line_id',
    label: 'LINE ID',
    // 「LINE id : xxx」「ライン: xxx」「ラインID xxx」など
    pattern: /(?:line(?:\s*id)?|ライン(?:\s*id)?)\s*[:：=＝]?\s*[@＠]?[\w\-.][\w\-.]{2,}/gi,
  },
  {
    type: 'instagram',
    label: 'Instagram',
    pattern: /(?:instagram(?:\.com)?|インスタ(?:グラム)?)[^\s]{0,40}/gi,
  },
  {
    type: 'twitter',
    label: 'Twitter / X',
    pattern: /(?:twitter\.com|x\.com)\/[\w]+/gi,
  },
  {
    type: 'tiktok',
    label: 'TikTok',
    pattern: /tiktok\.com\/[\w@.\-]+/gi,
  },
  {
    type: 'facebook',
    label: 'Facebook',
    pattern: /facebook\.com\/[\w.\-]+/gi,
  },
  {
    type: 'kakao',
    label: 'KakaoTalk',
    pattern: /(?:kakao\s*talk|カカオ\s*トーク?)[^\s]{0,40}/gi,
  },
  {
    type: 'wechat',
    label: 'WeChat',
    pattern: /(?:we\s*chat|微信|ウィーチャット)[^\s]{0,40}/gi,
  },
  {
    type: 'telegram',
    label: 'Telegram',
    pattern: /(?:t\.me\/[\w]+|telegram\.org|テレグラム)/gi,
  },
];

/**
 * テキストから規約違反になりそうなパターンを検出する。
 * @param {string} text
 * @returns {ModerationHit[]}  - 検出されたヒットの配列（空配列なら違反なし）
 */
function detectProhibitedContent(text){
  if(text == null) return [];
  /** @type {ModerationHit[]} */
  const hits = [];
  const seen = new Set();
  for(const rule of MODERATION_RULES){
    rule.pattern.lastIndex = 0;
    let m;
    while((m = rule.pattern.exec(String(text))) !== null){
      const key = rule.type + ':' + m.index + ':' + m[0];
      if(seen.has(key)) continue;
      seen.add(key);
      hits.push({ type: rule.type, label: rule.label, match: m[0], index: m.index });
      if(rule.pattern.lastIndex === m.index) rule.pattern.lastIndex++; // 安全弁
    }
  }
  return hits;
}

/**
 * 検出結果を「ユーザーに見せる警告文」に整形する。
 * @param {ModerationHit[]} hits
 * @returns {string}
 */
function formatModerationWarning(hits){
  if(!hits || hits.length === 0) return '';
  const labels = Array.from(new Set(hits.map(function(h){ return h.label; })));
  return '⚠️ 規約違反となる可能性がある内容が含まれています。\n'
       + '検出: ' + labels.join('、') + '\n\n'
       + '他SNSのIDや連絡先の交換は規約違反となります。\n'
       + '修正してから送信してください。';
}

/**
 * 違反があれば false（送信不可）、なければ true。
 * 呼び出し側で alert(formatModerationWarning(...)) と組み合わせて使う。
 * @param {string} text
 * @returns {{ok:boolean, hits:ModerationHit[]}}
 */
function checkModeration(text){
  const hits = detectProhibitedContent(text);
  return { ok: hits.length === 0, hits: hits };
}

// =====================================================================
// 画像（アバター）アップロード
// =====================================================================
// Supabase Storage の `avatars` バケットに <user_id>/avatar.<ext> として put。
// 1ユーザー1ファイル、上書き更新。public bucket なので公開 URL がそのまま使える。

/**
 * File を圧縮して Blob を返す（クライアント側で軽量化、Storage 帯域節約）。
 * 長辺を maxSide に縮小、品質 quality の JPEG で再エンコード。
 * @param {File|Blob} file
 * @param {{maxSide?:number, quality?:number, mime?:string}} [opts]
 * @returns {Promise<Blob>}
 */
function compressImage(file, opts){
  const maxSide = (opts && opts.maxSide) || 1200;
  const quality = (opts && opts.quality) || 0.85;
  const mime = (opts && opts.mime) || 'image/jpeg';
  return new Promise(function(resolve, reject){
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function(){
      const w = img.naturalWidth, h = img.naturalHeight;
      let dw = w, dh = h;
      if(Math.max(w, h) > maxSide){
        if(w >= h){ dw = maxSide; dh = Math.round(h * maxSide / w); }
        else { dh = maxSide; dw = Math.round(w * maxSide / h); }
      }
      const canvas = document.createElement('canvas');
      canvas.width = dw; canvas.height = dh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, dw, dh);
      canvas.toBlob(function(blob){
        URL.revokeObjectURL(url);
        if(blob) resolve(blob); else reject(new Error('canvas.toBlob failed'));
      }, mime, quality);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

// =====================================================================
// PWA / Web Push ヘルパー
// =====================================================================
// VAPID 公開鍵は config に置く想定（未設定なら push 機能は無効）。
// Edge Function 側で web-push ライブラリを使って配信する。

/**
 * VAPID 公開鍵（Base64URL）。Supabase Edge Function 作成時に
 * 同じキーペアの公開鍵を window.VAPID_PUBLIC_KEY にセットして使う。
 * 未設定なら push subscribe しない（無効化）。
 * @returns {string|null}
 */
function getVapidPublicKey(){
  return (typeof window !== 'undefined' && window.VAPID_PUBLIC_KEY) ? window.VAPID_PUBLIC_KEY : null;
}

/**
 * Base64URL → Uint8Array（PushManager.subscribe の applicationServerKey 用）
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Notification の許可をリクエスト。
 * @returns {Promise<NotificationPermission>}  - 'granted' / 'denied' / 'default'
 */
async function requestNotificationPermission(){
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

/**
 * Push の購読を試みる。VAPID 公開鍵が必要。
 * 成功すれば PushSubscription オブジェクトを返す。
 * @returns {Promise<PushSubscription|null>}
 */
async function subscribePush(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const vapid = getVapidPublicKey();
  if (!vapid) { console.log('[push] VAPID key not set'); return null; }
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }
    return sub;
  } catch (e) {
    console.log('[push] subscribe error:', e);
    return null;
  }
}

/**
 * Push 通知を Edge Function (send-push) 経由で送信する。
 * 失敗しても呼び出し元のメイン処理を止めないよう、例外を握りつぶす設計。
 *
 * @param {object} supabaseClient - supa
 * @param {{
 *   target_user_id?: string,
 *   target_user_ids?: string[],
 *   broadcast?: boolean,
 *   title: string,
 *   body: string,
 *   url?: string,
 *   tag?: string,
 * }} payload
 * @returns {Promise<{ok:boolean, sent?:number, failed?:number, error?:string}>}
 */
async function sendPushNotification(supabaseClient, payload){
  if (!payload || !payload.title || !payload.body) {
    return { ok: false, error: 'title and body required' };
  }
  // VAPID 公開鍵が未設定なら Push 自体が無効 → スキップ
  if (typeof window !== 'undefined' && !window.VAPID_PUBLIC_KEY) {
    return { ok: false, error: 'push disabled' };
  }
  try {
    const { data, error } = await supabaseClient.functions.invoke('send-push', { body: payload });
    if (error) {
      console.log('[push] send error:', error);
      return { ok: false, error: String(error.message || error) };
    }
    return Object.assign({ ok: true }, data || {});
  } catch (e) {
    console.log('[push] send exception:', e);
    return { ok: false, error: String(e) };
  }
}

/**
 * Push 購読を解除（profiles 側のカラムは別途クリアする）。
 * @returns {Promise<boolean>}
 */
async function unsubscribePush(){
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    return await sub.unsubscribe();
  } catch (e) {
    console.log('[push] unsubscribe error:', e);
    return false;
  }
}

// =====================================================================
// 画像拡大表示（フルスクリーンオーバーレイ）
// =====================================================================
// マッチング後の相手プロフィール画像をタップで拡大表示するためのヘルパー。
// HTML 側に <div id="img-zoom-overlay"> を1つ用意し、画像URLを差し替えて使い回す。
// 背景タップ / ESC キー / ✕ ボタンで閉じる。

/**
 * フルスクリーン画像オーバーレイを表示する。
 * オーバーレイ要素が無ければ自動生成するので、HTML 側に必須要素は無くても動く。
 * @param {string} url - 表示する画像の URL
 */
function showAvatarZoom(url){
  if(!url) return;
  let overlay = document.getElementById('img-zoom-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'img-zoom-overlay';
    overlay.className = 'img-zoom-overlay';
    overlay.innerHTML = ''
      + '<button type="button" class="img-zoom-close" aria-label="閉じる" onclick="hideAvatarZoom()">✕</button>'
      + '<img class="img-zoom-img" alt="">';
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) hideAvatarZoom();
    });
    document.body.appendChild(overlay);
  }
  const img = overlay.querySelector('.img-zoom-img');
  if(img) img.setAttribute('src', url);
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  // ESC キーで閉じる（重複登録を避けるため一度外してから付ける）
  document.removeEventListener('keydown', _imgZoomKeyHandler);
  document.addEventListener('keydown', _imgZoomKeyHandler);
}

/** 拡大表示を閉じる。 */
function hideAvatarZoom(){
  const overlay = document.getElementById('img-zoom-overlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', _imgZoomKeyHandler);
}

/** @param {KeyboardEvent} e */
function _imgZoomKeyHandler(e){
  if(e.key === 'Escape') hideAvatarZoom();
}

/**
 * Supabase Storage に画像をアップロードして公開 URL を返す。
 * @param {object} supabaseClient - supa（Supabase JS クライアント）
 * @param {string} userId
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<{url:string|null, error:any}>}
 */
async function uploadAvatar(supabaseClient, userId, fileOrBlob){
  if(!supabaseClient || !userId || !fileOrBlob){
    return { url: null, error: new Error('invalid args') };
  }
  try{
    // 圧縮（5MB 制限内に収める）
    const blob = await compressImage(fileOrBlob, { maxSide: 1200, quality: 0.85 });
    const path = userId + '/avatar.jpg';
    const { error: upErr } = await supabaseClient.storage
      .from('avatars')
      .upload(path, blob, {
        upsert: true,                  // 同じパスに上書き保存
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
    if(upErr) return { url: null, error: upErr };
    // 公開 URL を取得（キャッシュバスティング用に ?t=<timestamp> を付与）
    const { data: pub } = supabaseClient.storage.from('avatars').getPublicUrl(path);
    const url = pub && pub.publicUrl ? pub.publicUrl + '?t=' + Date.now() : null;
    return { url: url, error: null };
  }catch(e){
    return { url: null, error: e };
  }
}
