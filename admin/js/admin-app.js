// ===== 縁の間 管理画面 =====
// Supabase: ユーザーアプリと同じプロジェクトを参照
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'enishinoma-admin' } });

// ===== State =====
// 既存コードはフラットな let を直接参照している。
// 新規の状態は window.App.state.* 配下に追加していく（段階的に整理）。
//
// グローバル一覧:
//  currentAdmin : 管理者の auth user
//  allContacts / currentFilter / openContact : 問い合わせ
//  allMessages / messageFilter / openMessageThreadUser : メッセージ
//  allUsers / userStatusFilter / userSearchText / openUser : ユーザー
//  allReports / reportFilter / openReport / pendingReportResolveOnBan : 通報
//  allSotsugyouRequests / sotsugyouFilter / openSotsugyouPair : 卒業申請
//  allBookings / bookingFilter / openBooking + bookingViewMode / bkCal* : 予約
//  allCashbacks / cashbackFilter / openCashback : キャッシュバック
//  allAnnouncements : アナウンス
//  directMsgTargetUser : 個別メッセージ送信先
window.App = window.App || { state: {}, util: {} };

// 自分のロール: 'editor' | 'viewer' | null
// editor は全権限、viewer は閲覧のみ。書込・更新系の UI で readonlyMode() を見てガードする。
let currentAdminRole = null;
/** 現在のロールが viewer か（書込不可） @returns {boolean} */
function readonlyMode(){ return currentAdminRole === 'viewer'; }
// 書込系ボタンを押した時に viewer なら止める汎用ガード
/** 書込系操作のガード。viewer ならアラート + false 返す @returns {boolean} */
function guardEdit(){
  if(readonlyMode()){
    alert('閲覧専用アカウントのため、この操作は実行できません。');
    return false;
  }
  return true;
}

let currentAdmin = null;
let allContacts = [];
let currentFilter = 'open';
let openContact = null;

let allMessages = [];           // contacts のうち contact_type='メッセージ' / '運営返信' のみ
let messageFilter = 'open';
let openMessageThreadUser = null; // ユーザー単位スレッドのユーザー情報
// ユーザー間DM 監視（messages テーブル）
let allDms = [];                 // messages 全件（管理者は RLS で SELECT 可）
let allDmReviews = [];           // message_mod_reviews 全件
let allDmRateHits = [];          // message_rate_hits 全件
let dmProfileCache = {};         // user_id -> { nickname, member_id }
let dmMatchCache = {};           // match_id -> { from_user_id, to_user_id, status }
let dmFilter = 'flagged';
let openDmThreadMatch = null;
// ユーザー管理用
let allUsers = [];
let userStatusFilter = 'active';
let userSearchText = '';
let openUser = null;
// 通報管理用
let allReports = [];
let reportFilter = 'open';
let openReport = null;
// BAN完了時に連動して解決すべき通報情報（{reportId} or null）
let pendingReportResolveOnBan = null;
// 卒業申請管理用
let allSotsugyouRequests = [];
let sotsugyouFilter = 'paired';
let openSotsugyouPair = null;
// 予約管理用
let allBookings = [];
let bookingFilter = 'upcoming';
let openBooking = null;
// キャッシュバック管理用
let allCashbacks = [];
let cashbackFilter = 'eligible';
let openCashback = null;
// アナウンス管理用
let allAnnouncements = [];
// 個別メッセージ送信用
let directMsgTargetUser = null;
let bookingViewMode = 'list';      // 'list' or 'calendar'
let bkCalYear, bkCalMonth;          // カレンダー表示年月
let bkCalSelectedDate = null;       // 'YYYY-MM-DD'
const BOOKING_AVAILABLE_DOW = [3,4,5,6];  // 水〜土
const BOOKING_SLOTS = ['10:00-11:30','12:00-13:30','14:00-15:30','16:00-17:30','18:00-19:30'];
// 四柱推命表示用テーブル（ユーザーアプリと同じ）
const ADMIN_KAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ADMIN_SHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ADMIN_PL = ['年柱','月柱','日柱','時柱'];

// ===== ユーティリティ =====
// escapeHtml / formatDateTime / formatRelative / pad2 / formatDateKey / linkifyText / escapeText
// は admin/js/utils.js で共通定義（user/booking と統一）

// ===== 画面切替 =====
/** ログイン画面を表示 */
function showLogin(){
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}
/** ダッシュボードを表示 */
function showDashboard(){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}
/** 指定セクションに切替（loadXxx も呼ぶ） @param {string} section */
function showSection(section){
  // セクション切替
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });
  document.querySelectorAll('.section').forEach(s => {
    s.style.display = (s.id === section + '-section') ? 'block' : 'none';
  });
  // 各セクションの初期化
  if (section === 'users' && allUsers.length === 0) {
    loadUsers();
  }
  if (section === 'reports' && allReports.length === 0) {
    loadReports();
  }
  if (section === 'messages') {
    loadMessages();
  }
  if (section === 'dms') {
    loadUserDms();
  }
  if (section === 'sotsugyou' && allSotsugyouRequests.length === 0) {
    loadSotsugyouRequests();
  }
  if (section === 'bookings') {
    // 予約タブを開いたら毎回最新を取り、共有URLも反映
    initBookingShareUrl();
    loadBookings();
  }
  if (section === 'cashbacks') {
    loadCashbacks();
  }
  if (section === 'announcements') {
    loadAnnouncements();
  }
  if (section === 'dashboard') {
    loadDashboard();
  }
}

// ===== 認証 =====
/** ページロード時の admin セッション確認 + Realtime 起動 */
async function checkAdminSession(){
  try{
    const { data: { session } } = await supa.auth.getSession();
    if(!session){ showLogin(); return; }
    const { data: profile, error } = await supa.from('profiles').select('is_admin, nickname, admin_role').eq('id', session.user.id).single();
    if(error || !profile || !profile.is_admin){
      await supa.auth.signOut();
      showLogin();
      document.getElementById('login-error').textContent = 'このアカウントは管理者権限がありません。';
      return;
    }
    currentAdmin = session.user;
    currentAdminRole = profile.admin_role || 'editor'; // null は editor 扱い
    document.getElementById('admin-email').textContent = (session.user.email || '') + (readonlyMode() ? '（閲覧専用）' : '');
    showDashboard();
    loadDashboard();
    startAdminRealtime();
  }catch(e){
    console.log('session check error:', e);
    showLogin();
  }
}

/** 管理者ログイン処理（is_admin 必須） */
async function adminLogin(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if(!email || !password){
    errEl.textContent = 'メールアドレスとパスワードを入力してください';
    return;
  }
  try{
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if(error){
      errEl.textContent = 'メールアドレスまたはパスワードが違います';
      return;
    }
    const { data: profile, error: profErr } = await supa.from('profiles').select('is_admin, admin_role').eq('id', data.user.id).single();
    if(profErr || !profile || !profile.is_admin){
      errEl.textContent = 'このアカウントは管理者権限がありません。';
      await supa.auth.signOut();
      return;
    }
    currentAdmin = data.user;
    currentAdminRole = profile.admin_role || 'editor';
    document.getElementById('admin-email').textContent = (data.user.email || '') + (readonlyMode() ? '（閲覧専用）' : '');
    showDashboard();
    loadDashboard();
    startAdminRealtime();
  }catch(e){
    console.log('login error:', e);
    errEl.textContent = 'エラーが発生しました';
  }
}

/** ログアウト：Realtime 切断 + signOut */
async function adminLogout(){
  if(!confirm('ログアウトしますか？')) return;
  stopAdminRealtime();
  try{ await supa.auth.signOut(); }catch(e){ console.log('logout error:', e); }
  currentAdmin = null;
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  showLogin();
}

// ===== Realtime: admin 側 =====
// 新着問い合わせ・通報・予約をリアルタイムで反映。
// 現在開いているセクションのみリロードする（ノイズを最小化）。
let adminRealtimeChannels = [];
/** admin 側 Realtime channel 起動：5テーブル subscribe */
function startAdminRealtime(){
  if(!currentAdmin) return;
  stopAdminRealtime();

  // contacts: 新規問い合わせ・メッセージ・運営返信が即時反映
  adminRealtimeChannels.push(
    supa.channel('admin-contacts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        function(){
          // 該当セクションが開いていればリロード、いなければカウントだけ更新
          if(document.getElementById('contacts-section').style.display !== 'none') loadContacts();
          else if(document.getElementById('messages-section').style.display !== 'none') loadMessages();
          else loadDashboardCounts();
        }
      )
      .subscribe(function(s){ if(s==='SUBSCRIBED') console.log('[realtime] admin contacts subscribed'); })
  );

  // ユーザー間DM: 新着メッセージで違反疑いをリアルタイム検知
  adminRealtimeChannels.push(
    supa.channel('admin-dms')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        function(){
          if(document.getElementById('dms-section').style.display !== 'none') loadUserDms();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );

  // レート制限ヒット: 連投検知の即時反映
  adminRealtimeChannels.push(
    supa.channel('admin-rate-hits')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_rate_hits' },
        function(){
          if(document.getElementById('dms-section').style.display !== 'none') loadUserDms();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );

  // reports: 新着通報
  adminRealtimeChannels.push(
    supa.channel('admin-reports')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        function(){
          if(document.getElementById('reports-section').style.display !== 'none') loadReports();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );

  // bookings: 新着予約・状態変更
  adminRealtimeChannels.push(
    supa.channel('admin-bookings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        function(){
          if(document.getElementById('bookings-section').style.display !== 'none') loadBookings();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );

  // 卒業申請: 双方承認のタイミング判定で重要
  adminRealtimeChannels.push(
    supa.channel('admin-sotsugyou')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sotsugyou_requests' },
        function(){
          if(document.getElementById('sotsugyou-section').style.display !== 'none') loadSotsugyouRequests();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );

  // cashbacks: 自動生成・振込済マークのタイミングで反映
  adminRealtimeChannels.push(
    supa.channel('admin-cashbacks')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cashbacks' },
        function(){
          if(document.getElementById('cashbacks-section').style.display !== 'none') loadCashbacks();
          else loadDashboardCounts();
        }
      )
      .subscribe()
  );
}

/** Realtime channels を解除 */
function stopAdminRealtime(){
  adminRealtimeChannels.forEach(function(ch){
    try{ supa.removeChannel(ch); }catch(e){ console.log('admin removeChannel error:', e); }
  });
  adminRealtimeChannels = [];
}

// セクション非表示時の軽量カウント更新（ダッシュボードのバッジだけ更新）
/** ダッシュボードのバッジ件数のみ更新（軽量） */
function loadDashboardCounts(){
  if(document.getElementById('dashboard-section').style.display !== 'none'){
    loadDashboard();
  }
}

// ===== 問い合わせ一覧 =====
/** 問い合わせ一覧を DB から取得 + メッセージ件数も同期更新 */
async function loadContacts(){
  const list = document.getElementById('contacts-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('contacts').select('*').order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    // 問い合わせタブはチャット系（'メッセージ' / '運営返信'）を除外
    allContacts = (data || []).filter(c => c.contact_type !== 'メッセージ' && c.contact_type !== '運営返信');
    updateCounts();
    renderContacts();
  }catch(e){
    console.log('contacts load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

/** 問い合わせタブのフィルタカウントを更新 */
function updateCounts(){
  const open = allContacts.filter(c => c.status === 'open').length;
  const replied = allContacts.filter(c => c.status === 'replied').length;
  document.getElementById('count-open').textContent = open;
  document.getElementById('count-replied').textContent = replied;
  document.getElementById('count-all').textContent = allContacts.length;
}

/** 問い合わせフィルタタブ切替 @param {'open'|'replied'|'all'} filter */
function filterContacts(filter){
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  renderContacts();
}

/** 問い合わせ一覧を描画 */
function renderContacts(){
  const list = document.getElementById('contacts-list');
  const filtered = currentFilter === 'all' ? allContacts : allContacts.filter(c => c.status === currentFilter);
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当する問い合わせはありません。</div>';
    return;
  }
  let html = '';
  filtered.forEach(c => {
    const statusClass = c.status === 'open' ? 'open' : 'replied';
    const rowClass = c.status === 'open' ? 'contact-row unread' : 'contact-row';
    html += '<div class="'+rowClass+'" onclick="openDetail(\''+c.id+'\')">';
    html +=   '<div class="contact-status-dot '+statusClass+'"></div>';
    html +=   '<div class="contact-info">';
    html +=     '<div class="contact-meta">';
    html +=       '<span class="contact-name">'+escapeHtml(c.nickname || '名無し')+'さん</span>';
    if(c.member_id) html += '<span class="contact-id">'+escapeHtml(c.member_id)+'</span>';
    html +=       '<span class="contact-type-badge">'+escapeHtml(c.contact_type)+'</span>';
    html +=     '</div>';
    html +=     '<div class="contact-body-preview">'+escapeHtml(c.body)+'</div>';
    html +=   '</div>';
    html +=   '<div class="contact-time">'+formatRelative(c.created_at)+'</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== 詳細・返信 =====
/** 問い合わせ詳細モーダルを開く @param {string} id */
async function openDetail(id){
  const c = allContacts.find(x => x.id === id);
  if(!c){ alert('問い合わせが見つかりません'); return; }
  openContact = c;

  // 退会申請なら、問い合わせ詳細ではなくユーザー詳細(退会承認ボタン付き)へ即遷移
  if(c.contact_type === '退会申請' && c.user_id){
    // ユーザー一覧がまだロードされてなければロード
    if(!allUsers || allUsers.length === 0){
      await loadUsers();
    }
    // ユーザータブへ切替 → 該当ユーザーの詳細を開く
    showSection('users');
    setTimeout(function(){ openUserDetail(c.user_id); }, 50);
    return;
  }

  // 卒業鑑定申込なら、予約URLに ?sex= を付ける用にユーザー性別を先読み（キャッシュ）
  if(c.contact_type === '卒業鑑定申込' && c.status === 'open' && c.user_id && c._userSex === undefined){
    try{
      const { data: prof } = await supa.from('profiles').select('sex').eq('id', c.user_id).single();
      c._userSex = prof ? prof.sex : null;
    }catch(e){ c._userSex = null; }
  }

  let html = '';
  html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(c.nickname || '名無し')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(c.member_id || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">種別</div><div class="detail-value">'+escapeHtml(c.contact_type)+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">受信日時</div><div class="detail-value">'+formatDateTime(c.created_at)+'</div></div>';
  const statusText = c.status === 'open'
    ? '<span class="detail-status-open">● 未対応</span>'
    : '<span class="detail-status-replied">● 対応済</span>';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value">'+statusText+'</div></div>';
  html += '<div class="detail-body-box">'+escapeHtml(c.body)+'</div>';

  // 卒業鑑定申込 専用: 入金確認 → 予約URL ワンクリック送信
  if(c.contact_type === '卒業鑑定申込' && c.status === 'open'){
    const bookingUrl = buildBookingUrlForUser(c._userSex);
    const previewMsg = 'ご入金確認致しました。\n下記URLより鑑定日程をお選びください。\n※トータルプランをご利用の方は、運勢カレンダーのプライベート面もしくは家族面が◎か〇の日をお選び頂くのがオススメです。お2人とも◎か〇だと尚良しです♩\n\n' + bookingUrl + '\n\n⚠️お2人で一緒に受けられる場合は、どちらかお1人が予約して頂ければ大丈夫です。予約が重複しないようお願い致します。\n\n予約完了後のキャンセル・変更は原則、致しかねます。予めご了承ください。';
    html += '<div style="margin:1rem 0;padding:14px;background:rgba(58,154,58,.08);border:1px solid rgba(58,154,58,.3);border-radius:10px">';
    html += '<div style="font-size:12px;color:#3a9a3a;font-weight:500;margin-bottom:8px">💴 入金を確認したら、ボタン1つで予約URLを自動送信できます</div>';
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px;line-height:1.7;background:var(--bg-primary);border:0.5px solid var(--border);border-radius:6px;padding:8px 10px;white-space:pre-wrap">' + escapeHtml(previewMsg) + '</div>';
    html += '<button class="btn-send" style="background:#3a9a3a" onclick="confirmPaymentSendBookingUrl()">📨 入金確認 → 予約URL を送信</button>';
    html += '</div>';
  }

  html += '<div class="reply-section">';
  if(c.reply_text){
    html += '<label>これまでの返答</label>';
    html += '<div class="reply-existing">'+escapeHtml(c.reply_text)+'<div class="reply-meta">送信日時: '+formatDateTime(c.replied_at)+'</div></div>';
    html += '<label>返答を上書き（送信すると現在の返答を置き換えます）</label>';
  }else{
    html += '<label>返答内容</label>';
  }
  html += '<textarea class="reply-text" id="reply-text" placeholder="返答内容を入力してください..."></textarea>';
  html += '<div class="send-error" id="reply-error"></div>';
  html += '<div class="send-success" id="reply-success">✓ 返答を送信しました</div>';
  html += '<button class="btn-send" id="reply-send-btn" onclick="sendReply()">'+(c.reply_text ? '返答を更新する' : '返答を送信する')+'</button>';
  html += '</div>';

  document.getElementById('contact-detail-body').innerHTML = html;
  document.getElementById('contact-detail-modal').classList.add('show');
}

/** 詳細モーダルを閉じる */
function closeDetail(){
  document.getElementById('contact-detail-modal').classList.remove('show');
  openContact = null;
}

/** 問い合わせに返信を保存 + Push 通知 */
async function sendReply(){
  if(!guardEdit()) return;
  if(!openContact){ return; }
  const text = document.getElementById('reply-text').value.trim();
  const errEl = document.getElementById('reply-error');
  const okEl = document.getElementById('reply-success');
  errEl.textContent = '';
  okEl.style.display = 'none';
  if(!text){ errEl.textContent = '返答内容を入力してください'; return; }
  const btn = document.getElementById('reply-send-btn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '送信中...';
  try{
    const { error } = await supa.from('contacts').update({
      reply_text: text,
      replied_at: new Date().toISOString(),
      status: 'replied'
    }).eq('id', openContact.id);
    if(error){
      errEl.textContent = '保存に失敗しました：' + error.message;
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }
    okEl.style.display = 'block';
    btn.textContent = originalLabel;
    btn.disabled = false;
    // ユーザーに Push 通知（fire-and-forget）
    if (openContact.user_id) {
      sendPushNotification(supa, {
        target_user_id: openContact.user_id,
        title: '📩 運営からの返信が届きました',
        body: text.substring(0, 80),
        url: './#msg',
        tag: 'admin-reply',
      });
    }
    setTimeout(() => {
      closeDetail();
      loadContacts();
    }, 900);
  }catch(e){
    console.log('reply error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/** 予約URLにユーザーの性別パラメータを付与（プレースホルダー切替用）
 *  @param {string|null} sex - '女性' / '男性' / null
 *  @returns {string} 予約URL（?sex=female/male 付き） */
function buildBookingUrlForUser(sex){
  const base = buildBookingShareUrl();
  if(sex === '女性') return base + '?sex=female';
  if(sex === '男性') return base + '?sex=male';
  return base;
}

/** 卒業鑑定申込専用: 入金確認 + 予約URL を運営チャットへ自動送信 */
async function confirmPaymentSendBookingUrl(){
  if(!guardEdit()) return;
  if(!openContact){ return; }
  if(openContact.contact_type !== '卒業鑑定申込'){
    alert('このボタンは「卒業鑑定申込」のみ使用できます');
    return;
  }
  if(!confirm('入金確認 → 予約URLを自動送信します。よろしいですか？\n\n実行すると元の申込は「対応済」になり、運営チャットへ予約URLメッセージが届きます。')) return;
  // openDetail で性別を先読み済み（c._userSex）。未取得なら再フェッチ
  if(openContact._userSex === undefined && openContact.user_id){
    try{
      const { data: prof } = await supa.from('profiles').select('sex').eq('id', openContact.user_id).single();
      openContact._userSex = prof ? prof.sex : null;
    }catch(e){ openContact._userSex = null; }
  }
  const bookingUrl = buildBookingUrlForUser(openContact._userSex);
  const msg = 'ご入金確認致しました。\n下記URLより鑑定日程をお選びください。\n※トータルプランをご利用の方は、運勢カレンダーのプライベート面もしくは家族面が◎か〇の日をお選び頂くのがオススメです。お2人とも◎か〇だと尚良しです♩\n\n' + bookingUrl + '\n\n⚠️お2人で一緒に受けられる場合は、どちらかお1人が予約して頂ければ大丈夫です。予約が重複しないようお願い致します。\n\n予約完了後のキャンセル・変更は原則、致しかねます。予めご了承ください。';
  try{
    const { error } = await supa.from('contacts').update({
      reply_text: msg,
      replied_at: new Date().toISOString(),
      status: 'replied'
    }).eq('id', openContact.id);
    if(error){
      alert('送信に失敗しました：' + error.message);
      return;
    }
    // ユーザーへ Push 通知
    if(openContact.user_id){
      sendPushNotification(supa, {
        target_user_id: openContact.user_id,
        title: '💴 ご入金確認 → 予約URLをお送りしました',
        body: '鑑定日程の予約フォームをご確認ください',
        url: './#msg',
        tag: 'graduation-booking-url',
      });
    }
    alert('✓ 予約URLを送信しました');
    closeDetail();
    loadContacts();
  }catch(e){
    console.log('confirmPaymentSendBookingUrl error:', e);
    alert('エラーが発生しました');
  }
}

// ===== メッセージ管理（運営チャット） =====
// contacts のうち contact_type='メッセージ'（ユーザー発）と '運営返信'（管理者発）を扱う
/** メッセージタブのデータを取得 */
async function loadMessages(){
  const list = document.getElementById('messages-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('contacts')
      .select('*')
      .in('contact_type', ['メッセージ','運営返信'])
      .order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allMessages = data || [];
    renderMessages();
  }catch(e){
    console.log('messages load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

// ユーザー単位でグループ化（最新発言順）
/** メッセージをユーザー単位でグループ化 @returns {Array} */
function groupMessagesByUser(){
  const map = {};
  allMessages.forEach(m => {
    if(!m.user_id) return;
    if(!map[m.user_id]){
      map[m.user_id] = {
        user_id: m.user_id,
        member_id: m.member_id || null,
        nickname: m.nickname || null,
        items: [],
        unreadCount: 0,
        latest: null
      };
    }
    map[m.user_id].items.push(m);
    // ユーザーが nickname を持つレコードを優先
    if(m.contact_type === 'メッセージ' && m.nickname) map[m.user_id].nickname = m.nickname;
    if(m.contact_type === 'メッセージ' && m.member_id) map[m.user_id].member_id = m.member_id;
    if(m.contact_type === 'メッセージ' && m.status === 'open') map[m.user_id].unreadCount++;
    if(!map[m.user_id].latest || new Date(m.created_at) > new Date(map[m.user_id].latest.created_at)){
      map[m.user_id].latest = m;
    }
  });
  // 各スレッドの items を時系列昇順に
  Object.values(map).forEach(g => {
    g.items.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  });
  // スレッド全体は最新発言の降順
  return Object.values(map).sort((a,b) => new Date(b.latest.created_at) - new Date(a.latest.created_at));
}

/** メッセージタブのカウントを更新 */
function updateMessageCounts(){
  const groups = groupMessagesByUser();
  const open = groups.filter(g => g.unreadCount > 0).length;
  const replied = groups.filter(g => g.unreadCount === 0).length;
  const elOpen = document.getElementById('mcount-open');
  const elReplied = document.getElementById('mcount-replied');
  const elAll = document.getElementById('mcount-all');
  if(elOpen) elOpen.textContent = open;
  if(elReplied) elReplied.textContent = replied;
  if(elAll) elAll.textContent = groups.length;
}

/** メッセージフィルタタブ切替 */
function filterMessages(filter){
  messageFilter = filter;
  document.querySelectorAll('#messages-section .filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.msgfilter === filter);
  });
  renderMessages();
}

// スレッド内のユーザー発言を全部スキャンして、違反疑いの hits 一覧を返す
/** スレッド内の違反疑いをスキャン @returns {Array} */
function scanThreadModeration(group){
  if(!group || !group.items) return [];
  const all = [];
  group.items.forEach(function(m){
    // ユーザー側発言（contact_type='メッセージ'）だけが検知対象
    if(m.contact_type !== 'メッセージ') return;
    const hits = detectProhibitedContent(m.body || '');
    hits.forEach(function(h){ all.push(Object.assign({}, h, { messageId: m.id, body: m.body })); });
  });
  return all;
}

/** メッセージ一覧を描画（違反疑いフラグ付き） */
function renderMessages(){
  updateMessageCounts();
  const list = document.getElementById('messages-list');
  let groups = groupMessagesByUser();
  if(messageFilter === 'open') groups = groups.filter(g => g.unreadCount > 0);
  else if(messageFilter === 'replied') groups = groups.filter(g => g.unreadCount === 0);
  if(groups.length === 0){
    list.innerHTML = '<div class="empty-state">該当するメッセージはありません。</div>';
    return;
  }
  let html = '';
  groups.forEach(g => {
    const hasUnread = g.unreadCount > 0;
    const modHits = scanThreadModeration(g);
    const hasMod = modHits.length > 0;
    const rowClass = 'contact-row' + (hasUnread ? ' unread' : '') + (hasMod ? ' flagged' : '');
    const statusClass = hasUnread ? 'open' : 'replied';
    const fromUser = g.latest.contact_type === 'メッセージ';
    const preview = (fromUser ? '' : '↩ ') + (g.latest.body || '');
    html += '<div class="'+rowClass+'" onclick="openMessageThread(\''+g.user_id+'\')">';
    html +=   '<div class="contact-status-dot '+statusClass+'"></div>';
    html +=   '<div class="contact-info">';
    html +=     '<div class="contact-meta">';
    html +=       '<span class="contact-name">'+escapeHtml(g.nickname || '名無し')+'さん</span>';
    if(g.member_id) html += '<span class="contact-id">'+escapeHtml(g.member_id)+'</span>';
    if(hasUnread) html += '<span class="contact-type-badge" style="background:rgba(192,80,80,.12);color:#C05050;border-color:rgba(192,80,80,.3)">未対応 '+g.unreadCount+'</span>';
    if(hasMod){
      // 違反タイプを重複削除して表示
      const labels = Array.from(new Set(modHits.map(function(h){ return h.label; }))).join('・');
      html += '<span class="mod-flag-badge" title="違反疑い: '+escapeHtml(labels)+'">🚨 違反疑い '+modHits.length+'</span>';
    }
    html +=     '</div>';
    html +=     '<div class="contact-body-preview">'+escapeHtml(preview)+'</div>';
    html +=   '</div>';
    html +=   '<div class="contact-time">'+formatRelative(g.latest.created_at)+'</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

/** 個別ユーザーとのメッセージスレッドを開く @param {string} userId */
function openMessageThread(userId){
  const groups = groupMessagesByUser();
  const g = groups.find(x => x.user_id === userId);
  if(!g){ alert('スレッドが見つかりません'); return; }
  openMessageThreadUser = g;

  document.getElementById('msg-thread-title').textContent = (g.nickname || '名無し') + 'さんとのメッセージ';

  let html = '';
  html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(g.nickname || '名無し')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(g.member_id || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">未対応</div><div class="detail-value">'+(g.unreadCount > 0 ? g.unreadCount + '件' : 'なし')+'</div></div>';

  // 違反疑いサマリー（スレッド全体）
  const threadHits = scanThreadModeration(g);
  if(threadHits.length > 0){
    const labels = Array.from(new Set(threadHits.map(function(h){ return h.label; })));
    html += '<div class="warning-box" style="border-left:3px solid #C05050;background:rgba(192,80,80,.06);margin:14px 0">';
    html += '<div style="color:#C05050;font-weight:500;margin-bottom:4px">🚨 違反疑いを検出（' + threadHits.length + '件）</div>';
    html += '<div style="font-size:11px">検出種別：' + escapeHtml(labels.join('、')) + '</div>';
    html += '</div>';
  }

  // メッセージ履歴（時系列）
  html += '<div class="msg-thread-box">';
  g.items.forEach(m => {
    const isUser = m.contact_type === 'メッセージ';
    const cls = isUser ? 'msg-thread-bubble user' : 'msg-thread-bubble admin';
    const label = isUser ? (g.nickname || '名無し') + 'さん' : '運営';
    // この発言だけの違反検知（ユーザー側のみ）
    const msgHits = isUser ? detectProhibitedContent(m.body || '') : [];
    const flagHtml = msgHits.length > 0
      ? ' <span style="color:#C05050;font-size:10px;font-weight:500">🚨 違反疑い</span>'
      : '';
    html += '<div class="'+cls+'">';
    html += '<div class="msg-thread-meta">'+label+' / '+formatDateTime(m.created_at)+flagHtml+'</div>';
    html += '<div class="msg-thread-text">'+escapeHtml(m.body || '')+'</div>';
    html += '</div>';
  });
  html += '</div>';

  // 返信入力
  html += '<div class="reply-section">';
  html += '<label>返信を送る（運営チャットへ届きます）</label>';
  html += '<textarea class="reply-text" id="msg-reply-text" placeholder="返信内容を入力してください..."></textarea>';
  html += '<div class="send-error" id="msg-reply-error"></div>';
  html += '<div class="send-success" id="msg-reply-success">✓ 返信を送信しました</div>';
  html += '<button class="btn-send" id="msg-reply-send-btn" onclick="sendMessageReply()">返信を送信する</button>';
  html += '</div>';

  document.getElementById('message-thread-body').innerHTML = html;
  document.getElementById('message-thread-modal').classList.add('show');
}

/** メッセージスレッドモーダルを閉じる */
function closeMessageThread(){
  document.getElementById('message-thread-modal').classList.remove('show');
  openMessageThreadUser = null;
}

/** メッセージスレッドに返信送信 + Push 通知 */
async function sendMessageReply(){
  if(!guardEdit()) return;
  if(!openMessageThreadUser) return;
  const text = document.getElementById('msg-reply-text').value.trim();
  const errEl = document.getElementById('msg-reply-error');
  const okEl = document.getElementById('msg-reply-success');
  errEl.textContent = '';
  okEl.style.display = 'none';
  if(!text){ errEl.textContent = '返信内容を入力してください'; return; }
  const btn = document.getElementById('msg-reply-send-btn');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '送信中...';
  try{
    const target = openMessageThreadUser;
    // 1) 運営返信を新規 INSERT（status='replied' で履歴扱い）
    const { error: insErr } = await supa.from('contacts').insert({
      user_id: target.user_id,
      member_id: target.member_id,
      nickname: target.nickname,
      contact_type: '運営返信',
      body: text,
      status: 'replied'
    });
    if(insErr){
      errEl.textContent = '送信に失敗しました：' + insErr.message;
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }
    // 2) 該当ユーザーの '未対応メッセージ' をすべて 'replied' に更新
    const { error: updErr } = await supa.from('contacts').update({
      status: 'replied',
      replied_at: new Date().toISOString()
    }).eq('user_id', target.user_id).eq('contact_type', 'メッセージ').eq('status', 'open');
    if(updErr){
      console.log('messages mark-replied error:', updErr);
    }
    okEl.style.display = 'block';
    btn.textContent = orig;
    btn.disabled = false;
    // Push 通知
    if (target.user_id) {
      sendPushNotification(supa, {
        target_user_id: target.user_id,
        title: '💬 運営からのメッセージ',
        body: text.substring(0, 80),
        url: './#msg',
        tag: 'admin-msg',
      });
    }
    setTimeout(() => {
      closeMessageThread();
      loadMessages();
    }, 900);
  }catch(e){
    console.log('message reply error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// ===== ユーザー間DM 監視（messages テーブル） =====
// messages を全件取得 → match 単位でグループ化 → 違反疑い検知して一覧表示。
// 違反検知は admin/js/utils.js の detectProhibitedContent を流用。
// 連投検知は message_rate_hits テーブル（クライアントから RPC 経由で記録）。

/** ユーザー間DM データを取得（messages + reviews + rate_hits + 関連 profiles/matches） */
async function loadUserDms(){
  const list = document.getElementById('dms-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const [msgsRes, reviewsRes, hitsRes] = await Promise.all([
      supa.from('messages').select('*').order('created_at', { ascending: true }).limit(2000),
      supa.from('message_mod_reviews').select('*'),
      supa.from('message_rate_hits').select('*').order('attempted_at', { ascending: false }).limit(500),
    ]);
    if(msgsRes.error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗：'+escapeHtml(msgsRes.error.message)+'</div>';
      return;
    }
    allDms = msgsRes.data || [];
    allDmReviews = (reviewsRes && reviewsRes.data) || [];
    allDmRateHits = (hitsRes && hitsRes.data) || [];

    // 関連 profiles / matches を一括取得（必要分のみ）
    const userIds = Array.from(new Set([
      ...allDms.map(m => m.sender_id),
      ...allDmRateHits.map(h => h.sender_id),
    ].filter(Boolean)));
    const matchIds = Array.from(new Set(allDms.map(m => m.match_id).filter(Boolean)));

    if(userIds.length > 0){
      const { data: profs } = await supa.from('profiles').select('id, nickname, member_id').in('id', userIds);
      dmProfileCache = {};
      (profs || []).forEach(p => { dmProfileCache[p.id] = p; });
    }
    if(matchIds.length > 0){
      const { data: matches } = await supa.from('matches').select('id, from_user_id, to_user_id, status').in('id', matchIds);
      dmMatchCache = {};
      (matches || []).forEach(m => { dmMatchCache[m.id] = m; });
    }
    renderUserDms();
  }catch(e){
    console.log('dms load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

/** messages を match_id 単位にグループ化。各スレッドに違反/レビュー情報を付与 */
function groupDmsByMatch(){
  const map = {};
  allDms.forEach(m => {
    if(!m.match_id) return;
    if(!map[m.match_id]){
      map[m.match_id] = {
        match_id: m.match_id,
        items: [],
        latest: null,
        flaggedCount: 0,
        unreviewedFlagged: 0,
      };
    }
    map[m.match_id].items.push(m);
    if(!map[m.match_id].latest || new Date(m.created_at) > new Date(map[m.match_id].latest.created_at)){
      map[m.match_id].latest = m;
    }
  });
  // 違反疑い件数 / 未対応件数を計算
  const reviewedSet = new Set(allDmReviews.map(r => r.message_id));
  Object.values(map).forEach(g => {
    g.items.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    g.items.forEach(m => {
      const hits = detectProhibitedContent(m.body || '');
      if(hits.length > 0){
        g.flaggedCount++;
        if(!reviewedSet.has(m.id)) g.unreviewedFlagged++;
      }
    });
  });
  return Object.values(map).sort((a,b) => new Date(b.latest.created_at) - new Date(a.latest.created_at));
}

/** DM タブの件数を更新 + nav バッジ更新 */
function updateDmCounts(){
  const groups = groupDmsByMatch();
  const flagged = groups.filter(g => g.unreviewedFlagged > 0).length;
  const rateUsers = new Set(allDmRateHits.map(h => h.sender_id)).size;
  const elFlag = document.getElementById('dmcount-flagged');
  const elRate = document.getElementById('dmcount-rate');
  const elAll = document.getElementById('dmcount-all');
  if(elFlag) elFlag.textContent = flagged;
  if(elRate) elRate.textContent = rateUsers;
  if(elAll) elAll.textContent = groups.length;
  updateNavBadge('dms', flagged);
}

/** DM フィルタ切替 */
function filterDms(filter){
  dmFilter = filter;
  document.querySelectorAll('#dms-section .filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.dmfilter === filter);
  });
  renderUserDms();
}

/** DM 一覧を描画 */
function renderUserDms(){
  updateDmCounts();
  const list = document.getElementById('dms-list');
  if(!list) return;

  if(dmFilter === 'rate'){
    // レート制限ヒットビュー: ユーザー単位で件数集計
    const byUser = {};
    allDmRateHits.forEach(h => {
      if(!byUser[h.sender_id]) byUser[h.sender_id] = { sender_id: h.sender_id, items: [], latest: null };
      byUser[h.sender_id].items.push(h);
      if(!byUser[h.sender_id].latest || new Date(h.attempted_at) > new Date(byUser[h.sender_id].latest.attempted_at)){
        byUser[h.sender_id].latest = h;
      }
    });
    const users = Object.values(byUser).sort((a,b) => new Date(b.latest.attempted_at) - new Date(a.latest.attempted_at));
    if(users.length === 0){
      list.innerHTML = '<div class="empty-state">レート制限ヒットはまだありません。</div>';
      return;
    }
    let html = '';
    users.forEach(u => {
      const prof = dmProfileCache[u.sender_id] || {};
      const name = prof.nickname || '名無し';
      const mid = prof.member_id || '—';
      const rateCount = u.items.filter(h => h.reason === 'rate_limit').length;
      const limitCount = u.items.filter(h => h.reason === 'message_limit').length;
      html += '<div class="contact-row flagged" onclick="openUserDetail(\''+u.sender_id+'\')">';
      html +=   '<div class="contact-main">';
      html +=     '<div class="contact-name-line">';
      html +=       '<span class="contact-name">'+escapeHtml(name)+'さん</span>';
      html +=       '<span class="contact-meta">'+escapeHtml(mid)+'</span>';
      html +=       '<span class="mod-flag-badge" style="background:rgba(212,148,10,.12);color:#d4940a;border-color:rgba(212,148,10,.3)">🚦 連投'+rateCount+' / 上限超'+limitCount+'</span>';
      html +=     '</div>';
      html +=     '<div class="contact-body-preview">最終発生: '+formatRelative(u.latest.attempted_at)+' / 合計 '+u.items.length+'件</div>';
      html +=   '</div>';
      html += '</div>';
    });
    list.innerHTML = html;
    return;
  }

  let groups = groupDmsByMatch();
  if(dmFilter === 'flagged') groups = groups.filter(g => g.unreviewedFlagged > 0);

  if(groups.length === 0){
    const msg = dmFilter === 'flagged' ? '未対応の違反疑いはありません。' : 'DM はまだありません。';
    list.innerHTML = '<div class="empty-state">'+msg+'</div>';
    return;
  }

  let html = '';
  groups.forEach(g => {
    const match = dmMatchCache[g.match_id] || {};
    const fromProf = dmProfileCache[match.from_user_id] || {};
    const toProf = dmProfileCache[match.to_user_id] || {};
    const fromName = fromProf.nickname || '名無し';
    const toName = toProf.nickname || '名無し';
    const preview = (g.latest.body || '').substring(0, 80);
    const rowClass = 'contact-row' + (g.unreviewedFlagged > 0 ? ' flagged' : '');
    html += '<div class="'+rowClass+'" onclick="openDmThread(\''+g.match_id+'\')">';
    html +=   '<div class="contact-main">';
    html +=     '<div class="contact-name-line">';
    html +=       '<span class="contact-name">'+escapeHtml(fromName)+' ↔ '+escapeHtml(toName)+'</span>';
    html +=       '<span class="contact-meta">'+g.items.length+'通</span>';
    if(g.unreviewedFlagged > 0){
      html +=     '<span class="mod-flag-badge">🚨 違反疑い '+g.unreviewedFlagged+'（未対応）</span>';
    }else if(g.flaggedCount > 0){
      html +=     '<span class="mod-flag-badge" style="background:rgba(150,150,150,.12);color:#888;border-color:rgba(150,150,150,.3)">✓ 確認済み '+g.flaggedCount+'</span>';
    }
    html +=     '</div>';
    html +=     '<div class="contact-body-preview">'+escapeHtml(preview)+'</div>';
    html +=   '</div>';
    html +=   '<div class="contact-time">'+formatRelative(g.latest.created_at)+'</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

/** DM スレッドモーダルを開く */
function openDmThread(matchId){
  const groups = groupDmsByMatch();
  const g = groups.find(x => x.match_id === matchId);
  if(!g){ alert('スレッドが見つかりません'); return; }
  openDmThreadMatch = g;
  const match = dmMatchCache[matchId] || {};
  const fromProf = dmProfileCache[match.from_user_id] || {};
  const toProf = dmProfileCache[match.to_user_id] || {};
  document.getElementById('dm-thread-title').textContent =
    (fromProf.nickname || '名無し') + 'さん ↔ ' + (toProf.nickname || '名無し') + 'さん';

  const reviewMap = {};
  allDmReviews.forEach(r => { reviewMap[r.message_id] = r; });

  let html = '';
  html += '<div class="detail-row"><div class="detail-label">match_id</div><div class="detail-value mono">'+escapeHtml(matchId)+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value">'+escapeHtml(match.status || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">違反疑い</div><div class="detail-value">'+(g.flaggedCount > 0 ? g.flaggedCount + '件（うち未対応 ' + g.unreviewedFlagged + '）' : 'なし')+'</div></div>';

  if(g.flaggedCount > 0){
    const allHits = [];
    g.items.forEach(m => {
      const hits = detectProhibitedContent(m.body || '');
      hits.forEach(h => allHits.push(h));
    });
    const labels = Array.from(new Set(allHits.map(h => h.label)));
    html += '<div class="warning-box" style="border-left:3px solid #C05050;background:rgba(192,80,80,.06);margin:14px 0">';
    html += '<div style="color:#C05050;font-weight:500;margin-bottom:4px">🚨 違反疑いを検出</div>';
    html += '<div style="font-size:11px">検出種別：' + escapeHtml(labels.join('、')) + '</div>';
    html += '</div>';
  }

  // メッセージ履歴
  html += '<div class="msg-thread-box">';
  g.items.forEach(m => {
    const senderProf = dmProfileCache[m.sender_id] || {};
    const senderName = senderProf.nickname || '名無し';
    const isFrom = match.from_user_id === m.sender_id;
    const cls = 'msg-thread-bubble ' + (isFrom ? 'user' : 'admin');
    const hits = detectProhibitedContent(m.body || '');
    const review = reviewMap[m.id];
    let flagHtml = '';
    if(hits.length > 0){
      const lbl = Array.from(new Set(hits.map(h => h.label))).join('・');
      flagHtml = ' <span style="color:#C05050;font-size:10px;font-weight:500" title="'+escapeHtml(lbl)+'">🚨 違反疑い</span>';
    }
    let reviewHtml = '';
    if(review){
      const dec = review.decision === 'ban' ? 'BAN対応' : review.decision === 'warn' ? '警告済' : 'OK判定';
      reviewHtml = ' <span style="color:#888;font-size:10px">✓ '+escapeHtml(dec)+'</span>';
    }
    html += '<div class="'+cls+'">';
    html += '<div class="msg-thread-meta">'+escapeHtml(senderName)+'さん / '+formatDateTime(m.created_at)+flagHtml+reviewHtml+'</div>';
    html += '<div class="msg-thread-text">'+escapeHtml(m.body || '')+'</div>';
    if(hits.length > 0 && !review){
      html += '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">';
      html += '<button class="btn-text" style="font-size:11px;padding:3px 8px" onclick="markDmReview(\''+m.id+'\',\'ok\')">OK判定</button>';
      html += '<button class="btn-text" style="font-size:11px;padding:3px 8px;color:#d4940a" onclick="markDmReview(\''+m.id+'\',\'warn\')">警告済</button>';
      html += '<button class="btn-text" style="font-size:11px;padding:3px 8px;color:#C05050" onclick="markDmReview(\''+m.id+'\',\'ban\')">BAN対応</button>';
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  document.getElementById('dm-thread-body').innerHTML = html;
  document.getElementById('dm-thread-modal').classList.add('show');
}

/** DM スレッドモーダルを閉じる */
function closeDmThread(){
  document.getElementById('dm-thread-modal').classList.remove('show');
  openDmThreadMatch = null;
}

/** 違反疑いメッセージにレビュー判定を記録 */
async function markDmReview(messageId, decision){
  if(!guardEdit()) return;
  if(!currentAdmin){ alert('セッションが切れています'); return; }
  try{
    const { error } = await supa.from('message_mod_reviews').upsert({
      message_id: messageId,
      reviewed_by: currentAdmin.id,
      decision: decision,
    }, { onConflict: 'message_id' });
    if(error){ alert('記録に失敗しました：' + error.message); return; }
    // 再読込で反映
    await loadUserDms();
    if(openDmThreadMatch) openDmThread(openDmThreadMatch.match_id);
  }catch(e){
    console.log('mark dm review error:', e);
    alert('エラーが発生しました');
  }
}

// ===== ユーザー一覧 =====
/** ユーザー一覧 + 通報件数を取得 */
async function loadUsers(){
  const list = document.getElementById('users-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    // ユーザー / 通報 / 退会申請(open) / 卒業鑑定申込 / レビュー / マッチ / 未振込CB の並列取得
    const [usersRes, reportsRes, cancelReqRes, gradAppRes, reviewsRes, matchesRes, cashbackRes] = await Promise.all([
      supa.from('profiles').select('*').order('member_id', { ascending: true }),
      supa.from('reports').select('target_user_id, status'),
      supa.from('contacts').select('user_id').eq('contact_type', '退会申請').eq('status', 'open'),
      supa.from('contacts').select('user_id').eq('contact_type', '卒業鑑定申込'),
      supa.from('reviews').select('target_user_id, stars'),
      supa.from('matches').select('from_user_id, to_user_id, status, date_count, coupled_at'),
      supa.from('cashbacks').select('referrer_id, amount, referee_nickname, status').eq('status', 'eligible'),
    ]);
    // 未振込キャッシュバック → 紹介者IDごとに集計
    const cashbackByReferrer = {};
    if(cashbackRes && cashbackRes.data){
      cashbackRes.data.forEach(function(cb){
        if(!cb.referrer_id) return;
        if(!cashbackByReferrer[cb.referrer_id]) cashbackByReferrer[cb.referrer_id] = { count:0, total:0, referees:[] };
        var e = cashbackByReferrer[cb.referrer_id];
        e.count += 1; e.total += (cb.amount||0); e.referees.push({ nickname: cb.referee_nickname, amount: cb.amount });
      });
    }
    if(usersRes.error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(usersRes.error.message)+'</div>';
      return;
    }
    // 通報件数（却下分は除外）
    const reportCounts = {};
    if(reportsRes && reportsRes.data){
      reportsRes.data.forEach(r => {
        if(r.status !== 'dismissed'){
          reportCounts[r.target_user_id] = (reportCounts[r.target_user_id] || 0) + 1;
        }
      });
    }
    // 退会申請(open) 集合
    const cancelRequestSet = new Set();
    if(cancelReqRes && cancelReqRes.data){
      cancelReqRes.data.forEach(c => { if(c.user_id) cancelRequestSet.add(c.user_id); });
    }
    // 卒業鑑定申込（type 不問の重複は許す）
    const gradAppSet = new Set();
    if(gradAppRes && gradAppRes.data){
      gradAppRes.data.forEach(c => { if(c.user_id) gradAppSet.add(c.user_id); });
    }
    // レビュー平均
    const reviewAggMap = {};
    if(reviewsRes && reviewsRes.data){
      reviewsRes.data.forEach(r => {
        if(!r.target_user_id || r.stars == null) return;
        var agg = reviewAggMap[r.target_user_id] || { sum: 0, n: 0 };
        agg.sum += Number(r.stars); agg.n += 1;
        reviewAggMap[r.target_user_id] = agg;
      });
    }
    // ユーザー id → マッチ一覧 マップ
    const matchesByUser = {};
    if(matchesRes && matchesRes.data){
      matchesRes.data.forEach(m => {
        if(m.from_user_id){
          if(!matchesByUser[m.from_user_id]) matchesByUser[m.from_user_id] = [];
          matchesByUser[m.from_user_id].push(m);
        }
        if(m.to_user_id){
          if(!matchesByUser[m.to_user_id]) matchesByUser[m.to_user_id] = [];
          matchesByUser[m.to_user_id].push(m);
        }
      });
    }
    // ユーザー id → ニックネーム マップ（カップル相手表示用）
    const profileById = {};
    (usersRes.data || []).forEach(p => { profileById[p.id] = p; });

    allUsers = (usersRes.data || []).map(u => {
      var userMatches = matchesByUser[u.id] || [];
      var coupledMatch = userMatches.find(m => m.status === 'coupled') || null;
      var couplePartnerId = null;
      var couplePartner = null;
      if(coupledMatch){
        couplePartnerId = (coupledMatch.from_user_id === u.id) ? coupledMatch.to_user_id : coupledMatch.from_user_id;
        couplePartner = profileById[couplePartnerId] || null;
      }
      // ステータス判定
      // ① フリー: なにもなし
      // ② マッチング中: date_set/dated あり、coupled なし
      // ③ カップル成立: coupled あり、卒業鑑定申込・退会申請なし、認定なし
      // ④ 卒業準備中: coupled あり、(卒業鑑定申込 or 退会申請 or 卒業認定済)
      var hasCoupled = !!coupledMatch;
      var hasDated = userMatches.some(m => m.status === 'date_set' || m.status === 'dated');
      var hasGradApp = gradAppSet.has(u.id);
      var hasCancelReq = cancelRequestSet.has(u.id);
      var isGraduated = !!u.graduated_at;
      var statusKey, statusLabel, statusColor;
      if(hasCoupled && (hasGradApp || hasCancelReq || isGraduated)){
        statusKey = 'prep'; statusLabel = '卒業準備中'; statusColor = 'pink';
      }else if(hasCoupled){
        statusKey = 'coupled'; statusLabel = 'カップル成立'; statusColor = 'pink';
      }else if(hasDated){
        statusKey = 'matching'; statusLabel = 'マッチング中'; statusColor = 'gold';
      }else{
        statusKey = 'free'; statusLabel = 'フリー'; statusColor = 'gold';
      }
      return Object.assign({}, u, {
        report_count: reportCounts[u.id] || 0,
        has_withdrawal_request: cancelRequestSet.has(u.id),
        avg_rating: reviewAggMap[u.id] ? (reviewAggMap[u.id].sum / reviewAggMap[u.id].n) : null,
        review_count: reviewAggMap[u.id] ? reviewAggMap[u.id].n : 0,
        status_key: statusKey,
        status_label: statusLabel,
        status_color: statusColor,
        couple_partner_id: couplePartnerId,
        couple_partner_nickname: couplePartner ? (couplePartner.nickname || null) : null,
        couple_partner_member_id: couplePartner ? (couplePartner.member_id || null) : null,
        couple_date_count: coupledMatch ? (coupledMatch.date_count || 0) : 0,
        couple_coupled_at: coupledMatch ? (coupledMatch.coupled_at || null) : null,
        eligible_cashback: cashbackByReferrer[u.id] || null,
        // date_set 中のデート進行を「マッチング中」のユーザーにも表示できるよう、最新の date_set マッチも保持
        active_date_count: (function(){
          var ds = userMatches.find(m => m.status === 'date_set');
          return ds ? (ds.date_count || 0) : 0;
        })(),
      });
    });
    updateUserCounts();
    renderUsers();
  }catch(e){
    console.log('users load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

/** ユーザーが「卒業生」枠か判定（退会承認済 or 卒業認定済） */
function isGraduatedUser(u){
  if(!u) return false;
  if(u.withdrawal_type === 'approved') return true;   // 退会承認
  if(u.graduated_at) return true;                     // 卒業鑑定済
  return false;
}
/** ユーザーが「退会済」(運営処分)枠か判定 */
function isBannedUser(u){
  if(!u || !u.banned_at) return false;
  return u.withdrawal_type === 'banned' || (!u.withdrawal_type && !isGraduatedUser(u));
}

/** ユーザータブのカウントを更新 */
function updateUserCounts(){
  const active = allUsers.filter(u => !u.banned_at && !isGraduatedUser(u)).length;
  const banned = allUsers.filter(u => isBannedUser(u)).length;
  const graduated = allUsers.filter(u => isGraduatedUser(u)).length;
  // カップル: status_key=='coupled'（卒業準備中は別タブへ分離）
  const couple = allUsers.filter(u => !u.banned_at && !isGraduatedUser(u) && u.status_key === 'coupled').length;
  // 卒業準備中: status_key=='prep'（卒業認定前の利用中ユーザー）
  const prep = allUsers.filter(u => !u.banned_at && !isGraduatedUser(u) && u.status_key === 'prep').length;
  document.getElementById('ucount-active').textContent = active;
  document.getElementById('ucount-banned').textContent = banned;
  var gEl = document.getElementById('ucount-graduated');
  if(gEl) gEl.textContent = graduated;
  var cEl = document.getElementById('ucount-couple');
  if(cEl) cEl.textContent = couple;
  var pEl = document.getElementById('ucount-prep');
  if(pEl) pEl.textContent = prep;
  document.getElementById('ucount-all').textContent = allUsers.length;
}

/** ユーザーステータスフィルタ切替 */
function filterUsersByStatus(filter){
  userStatusFilter = filter;
  document.querySelectorAll('[data-userfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.userfilter === filter);
  });
  // 「カップル（成立が新しい順）」ソートは 卒業準備中 / 卒業生 タブでのみ提供
  var sortSel = document.getElementById('user-sort');
  if(sortSel){
    var existing = sortSel.querySelector('option[value="couple"]');
    var showCouple = (filter === 'prep' || filter === 'graduated');
    if(showCouple && !existing){
      var opt = document.createElement('option');
      opt.value = 'couple';
      opt.textContent = 'カップル（成立が新しい順）';
      sortSel.appendChild(opt);
    }else if(!showCouple && existing){
      existing.remove();
      if(userSortKey === 'couple'){ userSortKey = 'member_id'; sortSel.value = 'member_id'; }
    }
  }
  renderUsers();
}

/** ユーザー検索（文字列） */
function filterUsers(){
  userSearchText = document.getElementById('user-search').value.trim().toLowerCase();
  renderUsers();
}

/** ユーザー一覧のソートキー（初期: 会員ID 登録順） */
var userSortKey = 'member_id';
/** 登録種別の絞り込み（all / normal / affiliate） */
var userAffiliateFilter = 'all';

/** ソート選択切替 */
function setUserSort(key){
  userSortKey = key || 'member_id';
  renderUsers();
}

/** 登録種別の絞り込み切替（ユーザー登録者 / アフィリエイト登録者） */
function setUserAffiliateFilter(v){
  userAffiliateFilter = v || 'all';
  renderUsers();
}

/** ユーザー一覧を指定キーで並べ替えた配列を返す */
function sortUsersBy(arr, key){
  var sorted = arr.slice();
  var jaCol;
  try{ jaCol = new Intl.Collator('ja', { sensitivity: 'base', numeric: true }); }catch(e){ jaCol = null; }
  switch(key){
    case 'aiueo':
      sorted.sort(function(a,b){
        var an = (a.nickname || ''), bn = (b.nickname || '');
        return jaCol ? jaCol.compare(an, bn) : an.localeCompare(bn);
      });
      break;
    case 'oldest':
      sorted.sort(function(a,b){
        return new Date(a.created_at || '9999-12-31').getTime() - new Date(b.created_at || '9999-12-31').getTime();
      });
      break;
    case 'newest':
      sorted.sort(function(a,b){
        return new Date(b.created_at || '1900-01-01').getTime() - new Date(a.created_at || '1900-01-01').getTime();
      });
      break;
    case 'rating_high':
      sorted.sort(function(a,b){
        var ar = (a.avg_rating == null) ? -1 : a.avg_rating;
        var br = (b.avg_rating == null) ? -1 : b.avg_rating;
        return br - ar;
      });
      break;
    case 'rating_low':
      sorted.sort(function(a,b){
        var ar = (a.avg_rating == null) ? 999 : a.avg_rating;
        var br = (b.avg_rating == null) ? 999 : b.avg_rating;
        return ar - br;
      });
      break;
    case 'age_high':
      // 年齢が高い = birth_year が小さい
      sorted.sort(function(a,b){
        var ay = a.birth_year || 9999, by = b.birth_year || 9999;
        return ay - by;
      });
      break;
    case 'age_low':
      sorted.sort(function(a,b){
        var ay = a.birth_year || 0, by = b.birth_year || 0;
        return by - ay;
      });
      break;
    case 'couple':
      // カップル成立が新しい順（降順）。未成立は末尾。
      sorted.sort(function(a,b){
        var av = a.couple_coupled_at || '', bv = b.couple_coupled_at || '';
        if(av === bv) return 0;
        return av > bv ? -1 : 1;
      });
      break;
    case 'member_id':
    default:
      sorted.sort(function(a,b){
        var am = a.member_id || '', bm = b.member_id || '';
        return am.localeCompare(bm);
      });
  }
  return sorted;
}

/** ユーザー一覧を描画（通報数ヒートマップ付き） */
function renderUsers(){
  const list = document.getElementById('users-list');
  let filtered = allUsers;
  // ステータス絞り込み
  if(userStatusFilter === 'active') filtered = filtered.filter(u => !u.banned_at && !isGraduatedUser(u));
  else if(userStatusFilter === 'banned') filtered = filtered.filter(u => isBannedUser(u));
  else if(userStatusFilter === 'graduated') filtered = filtered.filter(u => isGraduatedUser(u));
  else if(userStatusFilter === 'couple') filtered = filtered.filter(u => !u.banned_at && !isGraduatedUser(u) && u.status_key === 'coupled');
  else if(userStatusFilter === 'prep') filtered = filtered.filter(u => !u.banned_at && !isGraduatedUser(u) && u.status_key === 'prep');
  // 登録種別 / キャッシュバックの絞り込み
  if(userAffiliateFilter === 'affiliate') filtered = filtered.filter(u => !!u.is_affiliate);
  else if(userAffiliateFilter === 'normal') filtered = filtered.filter(u => !u.is_affiliate);
  else if(userAffiliateFilter === 'cashback') filtered = filtered.filter(u => !!u.eligible_cashback);
  // テキスト検索
  if(userSearchText){
    const q = userSearchText;
    filtered = filtered.filter(u => {
      const nick = (u.nickname || '').toLowerCase();
      const mid = (u.member_id || '').toLowerCase();
      const phone = (u.phone_number || '').toLowerCase();
      return nick.includes(q) || mid.includes(q) || phone.includes(q);
    });
  }
  // 並べ替え
  filtered = sortUsersBy(filtered, userSortKey);
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当するユーザーはいません。</div>';
    return;
  }
  // カップルタブ、または 卒業準備中/卒業生タブで「カップル」ソート選択時は
  // 「1カップル＝1カード（2人横並び）」で表示
  if(userStatusFilter === 'couple' ||
     ((userStatusFilter === 'prep' || userStatusFilter === 'graduated') && userSortKey === 'couple')){
    renderCoupleList(filtered, list);
    return;
  }
  let html = '';
  filtered.forEach(u => {
    const banned = !!u.banned_at;
    const initial = (u.nickname || '?').charAt(0);
    const age = u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '';
    const meta = [age, u.sex, u.prefecture].filter(Boolean).join('・');
    var statusBadge;
    if(isBannedUser(u)){
      statusBadge = '<span class="user-status-badge banned">退会済</span>';
    }else if(isGraduatedUser(u)){
      statusBadge = '';  // 卒業生は専用タブがあるためバッジ非表示
    }else{
      statusBadge = '<span class="user-status-badge active">利用中</span>';
    }
    // 通報件数ヒートマップ：1件=注意/2件=警戒/3件以上=危険
    const rc = u.report_count || 0;
    const reportBadge = rc > 0
      ? '<span class="report-count-badge ' + (rc >= 3 ? 'high' : rc >= 2 ? 'mid' : 'low') + '">⚠️ 通報' + rc + '件</span>'
      : '';
    // 平均評価（あれば 星付き表示）
    const ratingBadge = (u.avg_rating != null)
      ? '<span style="font-size:10px;color:#C9A96E;margin-left:6px">★ ' + u.avg_rating.toFixed(1) + ' (' + (u.review_count||0) + ')</span>'
      : '';
    // 退会申請保留中バッジ
    const withdrawReqBadge = u.has_withdrawal_request
      ? '<span style="font-size:10px;color:#d4940a;margin-left:6px;background:rgba(212,148,10,.12);padding:2px 6px;border-radius:4px">📨 退会申請中</span>'
      : '';
    // アフィリエイト登録者バッジ（兼用＝通常登録もしている場合は (兼用)）
    const affBadge = u.is_affiliate
      ? '<span style="font-size:10px;color:#7a5cc0;margin-left:6px;background:rgba(122,92,192,.14);padding:2px 6px;border-radius:4px">アフィリ'+(u.plan?'(兼用)':'')+'</span>'
      : '';
    // キャッシュバック対象バッジ（未振込）
    const cbBadge = u.eligible_cashback
      ? '<span style="font-size:10px;color:#c9871f;margin-left:6px;background:rgba(201,135,31,.14);padding:2px 6px;border-radius:4px">💰CB ¥'+u.eligible_cashback.total.toLocaleString()+'</span>'
      : '';
    html += '<div class="user-row'+(banned?' banned':'')+(rc>=3?' heavy-reported':'')+'" onclick="openUserDetail(\''+u.id+'\')">';
    if(u.avatar_url){
      html += '<div class="user-avatar"><img src="'+escapeHtml(u.avatar_url)+'" alt=""></div>';
    } else {
      html += '<div class="user-avatar">'+escapeHtml(initial)+'</div>';
    }
    html += '<div class="user-info">';
    html += '<div class="user-line1">';
    html += '<span class="user-name">'+escapeHtml(u.nickname || '名無し')+'さん</span>';
    html += '<span class="user-id">'+escapeHtml(u.member_id || '')+'</span>';
    html += affBadge;
    html += cbBadge;
    html += ratingBadge;
    html += withdrawReqBadge;
    html += reportBadge;
    html += '</div>';
    html += '<div class="user-line2">';
    if(meta) html += '<span>'+escapeHtml(meta)+'</span>';
    if(u.phone_number) html += '<span>📱 '+escapeHtml(u.phone_number)+'</span>';
    html += '</div>';
    html += '</div>';
    // フリー/マッチング中/カップル成立 のステータスバッジ（卒業準備中は専用タブがあるため非表示）
    if(!banned && u.status_label && u.status_label !== '卒業準備中'){
      var sColor = u.status_color === 'pink'
        ? 'background:rgba(255,182,193,.18);color:#d6608b;border:0.5px solid rgba(214,96,139,.4)'
        : 'background:rgba(201,169,110,.15);color:#C9A96E;border:0.5px solid rgba(201,169,110,.45)';
      html += '<span class="user-status-badge" style="'+sColor+'">'+escapeHtml(u.status_label)+'</span>';
    }
    html += statusBadge;
    html += '</div>';
  });
  list.innerHTML = html;
}

/** カップル一覧を「1カップル＝1カード（2人横並び）」で描画。
 *  表示は名前と会員IDのみ。タップで2人まとめての詳細を開く。 */
function renderCoupleList(users, list){
  var seen = {};
  var pairs = [];
  users.forEach(function(u){
    if(seen[u.id]) return;
    seen[u.id] = true;
    var partner = u.couple_partner_id ? users.find(function(x){ return x.id === u.couple_partner_id; }) : null;
    if(partner) seen[partner.id] = true;
    pairs.push({ a: u, b: partner });
  });
  // カップル成立が新しい順（降順）に並べ替え
  pairs.sort(function(p, q){
    var pv = p.a.couple_coupled_at || (p.b && p.b.couple_coupled_at) || '';
    var qv = q.a.couple_coupled_at || (q.b && q.b.couple_coupled_at) || '';
    if(pv === qv) return 0;
    return pv > qv ? -1 : 1;
  });
  var html = '';
  pairs.forEach(function(p){
    var a = p.a, b = p.b;
    var onclick = b
      ? 'onclick="openCoupleDetail(\'' + a.id + '\',\'' + b.id + '\')"'
      : 'onclick="openUserDetail(\'' + a.id + '\')"';
    html += '<div class="couple-row" ' + onclick + '>';
    html += coupleCellHtml(a.nickname, a.member_id);
    html += '<div class="couple-heart">💕</div>';
    if(b){
      html += coupleCellHtml(b.nickname, b.member_id);
    }else{
      // 相手が一覧に居ない（卒業/退会など）場合は保存済みフィールドで補完
      html += coupleCellHtml(a.couple_partner_nickname, a.couple_partner_member_id);
    }
    html += '</div>';
  });
  list.innerHTML = html;
}

/** カップルカードの片側セル（名前＋会員IDのみ） */
function coupleCellHtml(nickname, memberId){
  var h = '<div class="couple-cell">';
  h += '<div class="couple-cell-name">' + escapeHtml(nickname || '名無し') + 'さん</div>';
  h += '<div class="couple-cell-id">' + escapeHtml(memberId || '—') + '</div>';
  h += '</div>';
  return h;
}

/** 新規登録からの経過を「X日」または「Xヶ月Y日」で返す
 *  @param {string} createdAtIso
 *  @returns {string} */
function formatUsageDuration(createdAtIso){
  if(!createdAtIso) return '—';
  var start = new Date(createdAtIso);
  if(isNaN(start.getTime())) return '—';
  var now = new Date();
  // 切り上げで「初日 = 1日目」とする
  var dayMs = 24 * 60 * 60 * 1000;
  var diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / dayMs));
  if(diffDays < 30){
    return diffDays + '日';
  }
  // 月単位の差分（誕生日的に「同日付」を1ヶ月とみなす方式）
  var y = now.getFullYear() - start.getFullYear();
  var m = now.getMonth() - start.getMonth();
  var totalMonths = y * 12 + m;
  var anchor = new Date(start); anchor.setMonth(start.getMonth() + totalMonths);
  if(now < anchor){ totalMonths -= 1; anchor.setMonth(anchor.getMonth() - 1); }
  var remDays = Math.floor((now.getTime() - anchor.getTime()) / dayMs);
  if(totalMonths < 12){
    return totalMonths + 'ヶ月' + remDays + '日';
  }
  var years = Math.floor(totalMonths / 12);
  var monthsRem = totalMonths % 12;
  return years + '年' + monthsRem + 'ヶ月' + remDays + '日';
}

// ===== ユーザー詳細 =====
/** ユーザー詳細モーダルを開く @param {string} id */
/** アクション用に対象ユーザーを切り替える（カップル詳細の2人分ボタン用） */
function selUser(id){
  var su = allUsers.find(x => x.id === id);
  if(su) openUser = su;
}

/** ユーザー1人分の詳細HTMLを生成（アクションボタン含む）。
 *  カップル詳細でも再利用するため、各ボタンは selUser(id) で対象を切り替える。 */
/** アフィリエイト登録URL（本番ユーザーアプリの ?affiliate=1）をクリップボードへコピー */
var AFFILIATE_REG_URL = 'https://natulymile59713-png.github.io/enisinma-app1.1/?affiliate=1';
function copyAffiliateRegUrl(){
  var url = AFFILIATE_REG_URL;
  var btn = document.getElementById('aff-url-copy-btn');
  var original = btn ? btn.textContent : '';
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){
      if(btn){ btn.textContent = '✓ コピーしました'; setTimeout(function(){ if(btn) btn.textContent = original; }, 1500); }
    }).catch(function(){ window.prompt('アフィリエイト登録URLをコピーしてください：', url); });
  }else{
    window.prompt('アフィリエイト登録URLをコピーしてください：', url);
  }
}

/** キャッシュバック対象（未振込）セクションの詳細HTML。連絡方法も出し分け表示。 */
function cashbackDetailSection(u){
  var cb = u.eligible_cashback;
  if(!cb) return '';
  var isWithdrawnApproved = !!u.banned_at && u.withdrawal_type === 'approved';
  var html = '<div class="detail-section-title">キャッシュバック対象（未振込）</div>';
  html += '<div class="detail-row"><div class="detail-label">未振込CB</div><div class="detail-value"><strong style="color:var(--gold)">¥'+cb.total.toLocaleString()+'</strong>（'+cb.count+'件）</div></div>';
  var names = cb.referees.map(function(r){ return (r.nickname||'?')+'さん(¥'+(r.amount||0).toLocaleString()+')'; }).join('、');
  html += '<div class="detail-row"><div class="detail-label">内訳</div><div class="detail-value" style="font-size:11px;line-height:1.7">'+escapeHtml(names)+'</div></div>';
  if(isWithdrawnApproved){
    html += '<div class="detail-row"><div class="detail-label">連絡方法</div><div class="detail-value" style="color:#C05050;font-weight:600">⚠️ 退会済 → 登録メールへ手動連絡</div></div>';
    html += '<div class="detail-row"><div class="detail-label">登録メール</div><div class="detail-value mono" style="font-size:11px">'+escapeHtml(u.email||'（未取得：Supabase Authで確認）')+'</div></div>';
  }else{
    html += '<div class="detail-row"><div class="detail-label">連絡方法</div><div class="detail-value" style="color:#3a9a3a">✓ 在籍中 → 運営チャットで通知済み</div></div>';
  }
  return html;
}

/** アフィリエイターが紹介した人を allUsers から集計（利用中/退会済/卒業済に分類） */
function getAffiliateReferrals(memberId){
  var refs = (allUsers || []).filter(function(x){ return x.referrer_id === memberId; });
  var active=[], withdrawn=[], graduated=[];
  refs.forEach(function(x){
    if(isGraduatedUser(x)) graduated.push(x);
    else if(isBannedUser(x)) withdrawn.push(x);
    else active.push(x);
  });
  return { refs: refs, active: active, withdrawn: withdrawn, graduated: graduated };
}

/** 詳細内の「紹介人数」行（タップで一覧トグル） */
function affiliateReferralRow(memberId){
  var r = getAffiliateReferrals(memberId);
  return '<div class="detail-row"><div class="detail-label">紹介人数</div>'+
    '<div class="detail-value"><a href="javascript:void(0)" onclick="toggleAffiliateReferrals(\''+memberId+'\')" style="color:var(--gold);text-decoration:underline">'+
    r.refs.length+'人（利用中'+r.active.length+'／退会済'+r.withdrawn.length+'／卒業済'+r.graduated.length+'） ▾</a></div></div>'+
    '<div id="aff-refs-'+memberId+'" style="display:none"></div>';
}

/** 紹介人数タップ時：紹介した人の一覧（3区分＋月額30%見込み）をトグル表示 */
function toggleAffiliateReferrals(memberId){
  var box = document.getElementById('aff-refs-'+memberId);
  if(!box) return;
  if(box.style.display === 'block'){ box.style.display = 'none'; return; }
  var r = getAffiliateReferrals(memberId);
  function grp(title, arr, color){
    var h = '<div style="margin-top:8px"><div style="font-size:11px;color:'+color+';font-weight:600;margin-bottom:4px">'+title+'（'+arr.length+'人）</div>';
    if(arr.length === 0){ h += '<div style="font-size:11px;color:var(--text-tertiary)">なし</div>'; }
    else { arr.forEach(function(x){
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:0.5px solid var(--border)"><span>'+escapeHtml(x.nickname||'名無し')+'さん</span><span class="mono" style="font-size:11px;color:var(--text-tertiary)">'+escapeHtml(x.member_id||'')+'</span></div>';
    }); }
    return h + '</div>';
  }
  var PRICE = { trial:963, no_matching:1693, total:2369 };
  var monthly = 0;
  r.active.forEach(function(x){ if(x.plan && PRICE[x.plan]) monthly += Math.floor(PRICE[x.plan]*0.30); });
  var html = '<div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;margin:6px 0">';
  html += '<div style="font-size:11px;color:var(--gold);margin-bottom:2px">月額30%CB見込み（利用中の合計）: ¥'+monthly.toLocaleString()+' ／月</div>';
  html += '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">※ 卒業で1人あたり6,930円も別途対象</div>';
  html += grp('利用中', r.active, '#3a9a3a');
  html += grp('退会済', r.withdrawn, '#C05050');
  html += grp('卒業済', r.graduated, '#3a7acc');
  html += '</div>';
  box.innerHTML = html;
  box.style.display = 'block';
}

function buildUserDetailHtml(u){
  const banned = !!u.banned_at;
  const age = u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '—';
  const birthTime = (u.birth_hour != null) ? u.birth_hour + '時' + (u.birth_min != null ? String(u.birth_min).padStart(2,'0') : '00') + '分' : '未設定';
  const birthLoc = u.birth_pref ? (u.birth_pref + (u.birth_city ? ' ' + u.birth_city : '')) : '未設定';
  // 純アフィリエイター（plan無し・サービス未使用）は通常項目を省略し、紹介人数を表示
  var pureAff = !!(u.is_affiliate && !u.plan);

  let html = '';
  // アバター
  if(u.avatar_url){
    html += '<div style="text-align:center;margin-bottom:14px">';
    html += '<img src="'+escapeHtml(u.avatar_url)+'" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:1px solid var(--gold)">';
    html += '</div>';
  }
  // ステータス
  if(banned){
    var wType = u.withdrawal_type || 'banned';
    var typeLbl = wType === 'approved' ? '● 退会承認済み（運営連絡→解除で元アカウント再開可）' : '● 退会処分済み（再登録不可）';
    html += '<div class="banned-info-box">';
    html += '<div class="banned-info-label">'+typeLbl+'</div>';
    html += '<div>'+(wType === 'approved' ? '承認' : '処分')+'日時：'+formatDateTime(u.banned_at)+'</div>';
    html += '<div style="margin-top:6px">理由：'+escapeHtml(u.banned_reason || '（記載なし）')+'</div>';
    html += '</div>';
  }
  // 通報サマリー（このユーザーが通報されている件数）
  const rcDetail = u.report_count || 0;
  if(rcDetail > 0){
    const lvlLabel = rcDetail >= 3 ? '🚨 多数の通報があります' : rcDetail >= 2 ? '⚠️ 複数件の通報があります' : '⚠️ 通報があります';
    html += '<div class="report-summary-box ' + (rcDetail >= 3 ? 'high' : rcDetail >= 2 ? 'mid' : 'low') + '">';
    html += '<div class="report-summary-label">'+lvlLabel+'</div>';
    html += '<div>このユーザーは現在 <strong>' + rcDetail + '件</strong> の通報対象になっています（却下分は除く）。<a href="javascript:void(0)" onclick="showSection(\'reports\');closeUserDetail()" style="color:var(--gold);text-decoration:underline">通報タブで確認 →</a></div>';
    html += '</div>';
  }
  // 基本情報
  html += '<div class="detail-section-title">基本情報</div>';
  // ステータス (フリー/マッチング中/カップル成立/卒業準備中)
  if(!banned && u.status_label && !pureAff){
    var stColor = u.status_color === 'pink'
      ? 'background:rgba(255,182,193,.18);color:#d6608b;border:0.5px solid rgba(214,96,139,.4)'
      : 'background:rgba(201,169,110,.15);color:#C9A96E;border:0.5px solid rgba(201,169,110,.45)';
    html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value"><span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:500;'+stColor+'">'+escapeHtml(u.status_label)+'</span></div></div>';
  }
  // 利用日数（新規登録 created_at からの経過）
  if(u.created_at && !pureAff){
    html += '<div class="detail-row"><div class="detail-label">利用日数</div><div class="detail-value">'+formatUsageDuration(u.created_at)+'</div></div>';
  }
  html += '<div class="detail-row"><div class="detail-label">ニックネーム</div><div class="detail-value">'+escapeHtml(u.nickname || '名無し')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(u.member_id || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">性別</div><div class="detail-value">'+escapeHtml(u.sex || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">電話番号</div><div class="detail-value">'+escapeHtml(u.phone_number || '—')+'</div></div>';
  // アフィリエイト登録者は「紹介人数」（タップで紹介した人の一覧を 利用中/退会済/卒業済 で表示）
  if(u.is_affiliate){ html += affiliateReferralRow(u.member_id); }
  if(!pureAff){
    html += '<div class="detail-row"><div class="detail-label">居住地</div><div class="detail-value">'+escapeHtml(u.prefecture || '—')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">結婚歴</div><div class="detail-value">'+escapeHtml(u.marriage || '—')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">連れ子</div><div class="detail-value">'+escapeHtml(u.children || '—')+'</div></div>';
  }
  // カップル相手 (③カップル成立 / ④卒業準備中 のみ表示)
  if(!banned && (u.status_key === 'coupled' || u.status_key === 'prep') && (u.couple_partner_nickname || u.couple_partner_member_id)){
    var partnerLabel = (u.couple_partner_nickname || '名無し') + 'さん（' + (u.couple_partner_member_id || '—') + '）';
    html += '<div class="detail-row"><div class="detail-label">カップル相手</div><div class="detail-value">💕 ' + escapeHtml(partnerLabel) + '</div></div>';
    var dc = u.couple_date_count || 0;
    html += '<div class="detail-row"><div class="detail-label">デート回数</div><div class="detail-value">' + dc + ' / 3 回完了</div></div>';
  }
  // マッチング中 (date_set) は date_count を表示
  if(!banned && u.status_key === 'matching' && (u.active_date_count || 0) > 0){
    html += '<div class="detail-row"><div class="detail-label">デート進行</div><div class="detail-value">' + (u.active_date_count || 0) + ' / 3 回完了</div></div>';
  }
  // キャッシュバック対象（未振込CBがある紹介者）
  if(u.eligible_cashback) html += cashbackDetailSection(u);
  // 生まれの情報
  html += '<div class="detail-section-title">生まれの情報</div>';
  html += '<div class="detail-row"><div class="detail-label">生年月日</div><div class="detail-value">'+(u.birth_year || '—')+'年'+(u.birth_month || '')+'月'+(u.birth_day || '')+'日 ('+age+')</div></div>';
  html += '<div class="detail-row"><div class="detail-label">生まれた時刻</div><div class="detail-value">'+escapeHtml(birthTime)+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">出生地</div><div class="detail-value">'+escapeHtml(birthLoc)+'</div></div>';
  // 命式
  html += '<div class="detail-section-title">命式</div>';
  html += '<div class="user-pillars">';
  for(let i=0; i<4; i++){
    const k = i===0 ? u.pillar_year_k : i===1 ? u.pillar_month_k : i===2 ? u.pillar_day_k : u.pillar_hour_k;
    const s = i===0 ? u.pillar_year_s : i===1 ? u.pillar_month_s : i===2 ? u.pillar_day_s : u.pillar_hour_s;
    const kan = (k != null) ? ADMIN_KAN[k] : '—';
    const shi = (s != null) ? ADMIN_SHI[s] : '—';
    html += '<div class="up-cell'+(i===2?' day':'')+'"><div class="up-cell-lbl">'+ADMIN_PL[i]+'</div><div class="up-cell-k">'+kan+'</div><div class="up-cell-s">'+shi+'</div></div>';
  }
  html += '</div>';
  // 紹介情報
  if(u.referrer_id){
    html += '<div class="detail-section-title">紹介情報</div>';
    html += '<div class="detail-row"><div class="detail-label">紹介者ID</div><div class="detail-value mono">'+escapeHtml(u.referrer_id)+'</div></div>';
  }
  // 口座情報
  if(u.bank_name){
    html += '<div class="detail-section-title">振込先口座</div>';
    html += '<div class="detail-row"><div class="detail-label">銀行・支店</div><div class="detail-value">'+escapeHtml(u.bank_name)+' '+escapeHtml(u.bank_branch||'')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">口座種別</div><div class="detail-value">'+escapeHtml(u.bank_account_type||'')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">口座番号</div><div class="detail-value mono">'+escapeHtml(u.bank_account_number||'')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">名義人</div><div class="detail-value">'+escapeHtml(u.bank_account_holder||'')+'</div></div>';
  }
  // アクションボタン
  if(!banned){
    html += '<button class="btn-secondary" style="margin-top:14px" onclick="selUser(\''+u.id+'\');openDirectMsg()">💬 公式メッセージを送る</button>';
  }
  if(banned){
    var typeLabel = (u.withdrawal_type === 'approved') ? '退会承認' : '退会処分';
    html += '<button class="btn-secondary" onclick="selUser(\''+u.id+'\');unbanUser()">' + typeLabel + 'を解除する</button>';
  }else{
    // 2ボタン横並び: 左=退会を承認(青系), 右=退会処分(赤)
    // 退会承認は「ユーザー本人から退会申請が届いている」ときのみ押せる
    var canApprove = !!u.has_withdrawal_request;
    var approveAttr = canApprove
      ? 'onclick="selUser(\''+u.id+'\');openWithdrawModal(\'approved\')"'
      : 'disabled style="opacity:.45;cursor:not-allowed" title="ユーザー本人から退会申請が届いた時のみ承認できます"';
    html += '<div style="display:flex;gap:8px;margin-top:14px">';
    html += '<button class="btn-action approve" style="flex:1" ' + approveAttr + '>✅ 退会を承認する</button>';
    html += '<button class="btn-danger" style="flex:1;margin:0" onclick="selUser(\''+u.id+'\');openWithdrawModal(\'banned\')">🚫 退会処分にする</button>';
    html += '</div>';
    if(!canApprove){
      html += '<div style="font-size:10px;color:var(--text-secondary);margin-top:6px;text-align:center;line-height:1.6">※ ユーザー本人から退会申請が届くと「退会を承認」ボタンが押せるようになります</div>';
    }
  }

  return html;
}

/** ユーザー1人の詳細モーダルを開く */
function openUserDetail(id){
  const u = allUsers.find(x => x.id === id);
  if(!u){ alert('ユーザーが見つかりません'); return; }
  openUser = u;
  var t = document.getElementById('user-detail-title');
  if(t) t.textContent = 'ユーザー詳細';
  document.getElementById('user-detail-body').innerHTML = buildUserDetailHtml(u);
  document.getElementById('user-detail-modal').classList.add('show');
}

/** カップル2人分の詳細をまとめて1つのモーダルに表示 */
function openCoupleDetail(idA, idB){
  const a = allUsers.find(x => x.id === idA);
  const b = allUsers.find(x => x.id === idB);
  if(!a){ alert('ユーザーが見つかりません'); return; }
  openUser = a;
  var t = document.getElementById('user-detail-title');
  if(t) t.textContent = 'カップル詳細';
  var html = '';
  html += '<div class="couple-detail-person">';
  html += '<div class="couple-detail-head">①　' + escapeHtml(a.nickname || '名無し') + 'さん</div>';
  html += buildUserDetailHtml(a);
  html += '</div>';
  if(b){
    html += '<div class="couple-detail-divider"></div>';
    html += '<div class="couple-detail-person">';
    html += '<div class="couple-detail-head">②　' + escapeHtml(b.nickname || '名無し') + 'さん</div>';
    html += buildUserDetailHtml(b);
    html += '</div>';
  }
  document.getElementById('user-detail-body').innerHTML = html;
  document.getElementById('user-detail-modal').classList.add('show');
}

/** ユーザー詳細モーダルを閉じる */
function closeUserDetail(){
  document.getElementById('user-detail-modal').classList.remove('show');
  openUser = null;
}

// ===== BAN / 解除 =====
// 退会の種類: 'banned'(退会処分) / 'approved'(退会承認)
// 退会処分: 同電話・同メアドで再登録不可
// 退会承認: 再開は「退会承認を解除する」で対応（メアド/パスワードはそのまま残り、解除後に本人が再ログイン可）
let pendingWithdrawalType = 'banned';

/** 退会モーダルを開く @param {'banned'|'approved'} type */
function openWithdrawModal(type){
  if(!openUser) return;
  pendingWithdrawalType = type;
  var isApprove = (type === 'approved');
  var title = isApprove ? '退会を承認する' : '退会処分にする';
  var btnLabel = isApprove ? '退会承認を実行する' : '退会処分を実行する';
  document.getElementById('ban-modal-title').textContent = title;
  document.getElementById('ban-target-name').textContent = (openUser.nickname || '名無し') + 'さん（' + (openUser.member_id || '—') + '）';
  // デフォルト退会理由文面（ユーザーに送られる通知文として使用）
  var defaultBanReason = '利用規約違反の為、利用規約第〇条に基づき退会処分とさせて頂きます。\nこの画面を閉じると自動的にサブスクの解約とサービス内のデータが消去されます。メッセージ中の相手がいる場合は、その方があなたとのメッセージタブを開くと退会処分になった旨が報告されます。また、再度本サービスの登録・使用はできません。ご承知おきください。';
  var defaultApproveReason = 'この度は、縁の間をご利用頂きありがとうございました。\n只今、退会を承認させて頂きましたので、そのご連絡になります。\nなお、登録中のサブスクプランは24時間後に自動的に解約となり、同時にサービスサイトも閲覧・使用ができなくなりますのでご承知おき下さい。\n再度ご利用をご希望の場合は、運営までメールでご連絡ください。退会の解除手続きにて、元のアカウント（同じメールアドレス・パスワード）でご利用を再開いただけます。\nありがとうございました。';
  document.getElementById('ban-reason').value = isApprove ? defaultApproveReason : defaultBanReason;
  document.getElementById('ban-error').textContent = '';
  document.getElementById('ban-confirm-btn').textContent = btnLabel;
  document.getElementById('ban-confirm-btn').disabled = false;
  // ボタン色も切替（承認: 緑系 / 処分: 赤）
  var btnEl = document.getElementById('ban-confirm-btn');
  if(btnEl) btnEl.style.background = isApprove ? '#3a9a3a' : '#C05050';
  // 注意文を更新
  var noteEl = document.getElementById('ban-modal-note');
  if(noteEl){
    noteEl.textContent = isApprove
      ? '※ 退会承認: 本人から運営へメール連絡があれば、ユーザー詳細の「退会承認を解除する」で元アカウント（同メアド・同パスワード）を再開できます。'
      : '※ 退会処分: 同じ電話番号・メールアドレスでの再登録ができなくなります。';
  }
  document.getElementById('ban-modal').classList.add('show');
}

/** 旧API互換用ラッパー */
function openBanModal(){ openWithdrawModal('banned'); }

/** 退会処分モーダルを閉じる */
function closeBanModal(){
  document.getElementById('ban-modal').classList.remove('show');
}

/** 退会処分 or 退会承認を実行 + 関連通報を resolved に更新 */
async function confirmBan(){
  if(!guardEdit()) return;
  if(!openUser) return;
  const reason = document.getElementById('ban-reason').value.trim();
  const errEl = document.getElementById('ban-error');
  errEl.textContent = '';
  if(!reason){ errEl.textContent = '退会理由は必須です'; return; }
  const btn = document.getElementById('ban-confirm-btn');
  const origLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '処理中...';
  try{
    const rpcName = (pendingWithdrawalType === 'approved') ? 'approve_withdrawal' : 'ban_user_account';
    const { error } = await supa.rpc(rpcName, { p_user_id: openUser.id, p_reason: reason });
    if(error){
      errEl.textContent = '実行に失敗しました：' + (error.message || error.code || 'unknown');
      btn.disabled = false;
      btn.textContent = origLabel;
      return;
    }
    // 該当ユーザーへ Push 通知（アプリ未起動時の即時通知用）
    var isApproveRpc = (pendingWithdrawalType === 'approved');
    sendPushNotification(supa, {
      target_user_id: openUser.id,
      title: isApproveRpc ? '✅ 退会承認のお知らせ' : '🚫 退会処分のお知らせ',
      body: isApproveRpc
        ? '運営から退会承認のご連絡が届きました。アプリを開いてご確認ください。'
        : '運営から重要なお知らせが届きました。アプリを開いてご確認ください。',
      url: './',
      tag: isApproveRpc ? 'withdrawal-approve' : 'withdrawal-ban',
    });
    // 通報経由のBANなら、対応する通報を「対応済」に更新
    if (pendingReportResolveOnBan) {
      const rid = pendingReportResolveOnBan;
      pendingReportResolveOnBan = null;
      await supa.from('reports').update({
        status: 'resolved',
        resolution_action: 'ban',
        resolution_note: reason,
        resolved_at: new Date().toISOString(),
        resolved_by: currentAdmin.id
      }).eq('id', rid);
      // 通報者への結果通知
      await notifyReporter(rid, 'ご通報いただいた件について対応いたしました。\n対象ユーザーを退会処分とさせていただきました。\nご協力ありがとうございました。');
      closeReportDetail();
      await loadReports();
    }
    closeBanModal();
    closeUserDetail();
    await loadUsers();
  }catch(e){
    console.log('ban error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = origLabel || '実行する';
  }
}

/** 退会処分を解除 */
async function unbanUser(){
  if(!guardEdit()) return;
  if(!openUser) return;
  if(!confirm('このユーザーの退会処分を解除しますか？\n再びログイン可能になります。')) return;
  try{
    const { error } = await supa.from('profiles').update({
      banned_at: null,
      banned_reason: null,
      banned_by: null
    }).eq('id', openUser.id);
    if(error){ alert('解除に失敗しました：' + error.message); return; }
    closeUserDetail();
    await loadUsers();
  }catch(e){
    console.log('unban error:', e);
    alert('エラーが発生しました');
  }
}

// ===== 通報者への結果通知ヘルパー =====
// reports.id を渡すと、その通報者の運営チャットに結果通知を投稿する
/** 通報者の運営チャットに結果通知 @param {string} reportId @param {string} message */
async function notifyReporter(reportId, message){
  const r = allReports.find(x => x.id === reportId);
  if(!r) return;
  try{
    await supa.from('contacts').insert({
      user_id: r.reporter_id,
      member_id: r.reporter_member_id,
      nickname: r.reporter_nickname,
      contact_type: '通報結果通知',
      body: message,
      status: 'replied'
    });
  }catch(e){
    console.log('通報結果通知エラー:', e);
  }
}

// ===== 通報一覧 =====
/** 通報一覧を取得 */
async function loadReports(){
  const list = document.getElementById('reports-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('reports').select('*').order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allReports = data || [];
    updateReportCounts();
    renderReports();
  }catch(e){
    console.log('reports load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

/** 通報タブのカウントを更新 */
function updateReportCounts(){
  document.getElementById('rcount-open').textContent = allReports.filter(r => r.status === 'open').length;
  document.getElementById('rcount-resolved').textContent = allReports.filter(r => r.status === 'resolved').length;
  document.getElementById('rcount-dismissed').textContent = allReports.filter(r => r.status === 'dismissed').length;
  document.getElementById('rcount-all').textContent = allReports.length;
}

/** 通報フィルタタブ切替 */
function filterReports(filter){
  reportFilter = filter;
  document.querySelectorAll('[data-reportfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.reportfilter === filter);
  });
  renderReports();
}

/** 通報一覧を描画 */
function renderReports(){
  const list = document.getElementById('reports-list');
  const filtered = reportFilter === 'all' ? allReports : allReports.filter(r => r.status === reportFilter);
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当する通報はありません。</div>';
    return;
  }
  let html = '';
  filtered.forEach(r => {
    const statusLabel = r.status === 'open' ? '未対応' : r.status === 'resolved' ? '対応済' : '却下';
    const rowClass = r.status === 'open' ? 'report-row unread' : 'report-row';
    html += '<div class="'+rowClass+'" onclick="openReportDetail(\''+r.id+'\')">';
    html += '<div class="report-status-dot '+r.status+'"></div>';
    html += '<div class="contact-info">';
    html += '<div class="report-meta-line">';
    html += '<span class="report-reporter">'+escapeHtml(r.reporter_nickname || '?')+'さん</span>';
    html += '<span class="report-arrow">→</span>';
    html += '<span class="report-target">'+escapeHtml(r.target_nickname || '?')+'さん</span>';
    html += '<span class="contact-id">'+escapeHtml(r.target_member_id || '')+'</span>';
    html += '<span class="report-category-badge">'+escapeHtml(r.reason_category)+'</span>';
    html += '</div>';
    html += '<div class="contact-body-preview">'+escapeHtml(r.body)+'</div>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">';
    html += '<span class="report-status-text '+r.status+'">'+statusLabel+'</span>';
    html += '<span class="contact-time">'+formatRelative(r.created_at)+'</span>';
    html += '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== 通報詳細 =====
/** 通報詳細モーダルを開く @param {string} id */
async function openReportDetail(id){
  const r = allReports.find(x => x.id === id);
  if(!r){ alert('通報が見つかりません'); return; }
  openReport = r;

  let html = '';
  html += '<div class="detail-row"><div class="detail-label">受付日時</div><div class="detail-value">'+formatDateTime(r.created_at)+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">通報者</div><div class="detail-value">'+escapeHtml(r.reporter_nickname || '?')+'さん <span class="mono" style="color:var(--text-tertiary);font-size:11px">'+escapeHtml(r.reporter_member_id || '')+'</span></div></div>';
  html += '<div class="detail-row"><div class="detail-label">対象</div><div class="detail-value"><span style="color:var(--red);font-weight:500">'+escapeHtml(r.target_nickname || '?')+'さん</span> <span class="mono" style="color:var(--text-tertiary);font-size:11px">'+escapeHtml(r.target_member_id || '')+'</span></div></div>';
  html += '<div class="detail-row"><div class="detail-label">理由</div><div class="detail-value"><span class="report-category-badge">'+escapeHtml(r.reason_category)+'</span></div></div>';
  const statusText = r.status === 'open'
    ? '<span class="detail-status-open">● 未対応</span>'
    : r.status === 'resolved'
    ? '<span class="detail-status-replied">● 対応済</span>'
    : '<span style="color:var(--text-tertiary)">● 却下</span>';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value">'+statusText+'</div></div>';
  html += '<div class="detail-body-box">'+escapeHtml(r.body)+'</div>';

  // 対応済 or 却下なら結果情報を表示
  if(r.status === 'resolved' || r.status === 'dismissed'){
    const actionLabel = r.resolution_action === 'ban' ? '退会処分'
      : r.resolution_action === 'warning' ? '警告メッセージ送信'
      : r.status === 'dismissed' ? '却下（対応不要）'
      : '対応済';
    html += '<div class="resolved-info-box">';
    html += '<div class="resolved-info-label">● 対応結果</div>';
    html += '<div>処置：'+escapeHtml(actionLabel)+'</div>';
    if(r.resolution_note){
      html += '<div style="margin-top:6px">備考：'+escapeHtml(r.resolution_note)+'</div>';
    }
    if(r.resolved_at){
      html += '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">処置日時：'+formatDateTime(r.resolved_at)+'</div>';
    }
    html += '</div>';
  }

  // 対象ユーザーの過去の通報件数
  const targetReportCount = allReports.filter(x => x.target_user_id === r.target_user_id && x.id !== r.id).length;
  if(targetReportCount > 0){
    html += '<div style="font-size:12px;color:var(--text-secondary);margin:10px 0;padding:8px 12px;background:var(--bg-secondary);border-radius:8px">⚠️ この対象ユーザーは過去に <strong style="color:var(--red)">'+targetReportCount+'件</strong> の通報があります</div>';
  }

  // 未対応の場合のみアクションボタンを表示
  if(r.status === 'open'){
    html += '<div class="action-buttons">';
    html += '<button class="btn-action ban" onclick="banFromReport()">退会処分にする</button>';
    html += '<button class="btn-action warn" onclick="openWarningModalFromReport()">警告メッセージを送信</button>';
    html += '<button class="btn-action dismiss" onclick="dismissReport()">対応不要として却下</button>';
    html += '</div>';
  }

  document.getElementById('report-detail-body').innerHTML = html;
  document.getElementById('report-detail-modal').classList.add('show');
}

/** 通報詳細モーダルを閉じる */
function closeReportDetail(){
  document.getElementById('report-detail-modal').classList.remove('show');
  openReport = null;
}

// ===== 通報からの退会処分 =====
/** 通報画面から対象ユーザーを退会処分する */
function banFromReport(){
  if(!openReport) return;
  // 対象ユーザーをロード
  const target = allUsers.find(u => u.id === openReport.target_user_id);
  if(target){
    openUser = target;
  }else{
    // 万一 allUsers にいない場合は最低限の情報で代用
    openUser = {
      id: openReport.target_user_id,
      member_id: openReport.target_member_id,
      nickname: openReport.target_nickname
    };
  }
  // BAN完了時に通報も解決させるためのフラグ
  pendingReportResolveOnBan = openReport.id;
  // BANモーダルを開く（理由は通報の本文を初期値として入れる）
  openBanModal();
  document.getElementById('ban-reason').value = '通報内容（'+openReport.reason_category+'）：' + openReport.body;
}

// ===== 警告メッセージ送信 =====
/** 通報画面から警告メッセージモーダルを開く */
function openWarningModalFromReport(){
  if(!openReport) return;
  document.getElementById('warning-target-name').textContent = openReport.target_nickname + 'さん（' + openReport.target_member_id + '）';
  document.getElementById('warning-text').value = '';
  document.getElementById('warning-error').textContent = '';
  document.getElementById('warning-send-btn').textContent = '警告を送信する';
  document.getElementById('warning-send-btn').disabled = false;
  document.getElementById('warning-modal').classList.add('show');
}

/** 警告モーダルを閉じる */
function closeWarningModal(){
  document.getElementById('warning-modal').classList.remove('show');
}

/** 警告メッセージを送信 + 通報を resolved に */
async function confirmWarning(){
  if(!guardEdit()) return;
  if(!openReport) return;
  const text = document.getElementById('warning-text').value.trim();
  const errEl = document.getElementById('warning-error');
  errEl.textContent = '';
  if(!text){ errEl.textContent = '警告内容を入力してください'; return; }
  const btn = document.getElementById('warning-send-btn');
  btn.disabled = true;
  btn.textContent = '送信中...';
  try{
    // 対象ユーザーの contacts へ警告を書き込む（contact_type='警告'）
    const { error: insertErr } = await supa.from('contacts').insert({
      user_id: openReport.target_user_id,
      member_id: openReport.target_member_id,
      nickname: openReport.target_nickname,
      contact_type: '警告',
      body: text,
      status: 'replied'  // 警告は管理者の能動アクションのためすでに「対応済」とみなす
    });
    if(insertErr){
      errEl.textContent = '送信に失敗しました：' + insertErr.message;
      btn.disabled = false;
      btn.textContent = '警告を送信する';
      return;
    }
    // 通報を「対応済」に
    const { error: reportErr } = await supa.from('reports').update({
      status: 'resolved',
      resolution_action: 'warning',
      resolution_note: text,
      resolved_at: new Date().toISOString(),
      resolved_by: currentAdmin.id
    }).eq('id', openReport.id);
    if(reportErr){
      errEl.textContent = '通報の更新に失敗しました：' + reportErr.message;
      btn.disabled = false;
      btn.textContent = '警告を送信する';
      return;
    }
    // 通報者への結果通知
    await notifyReporter(openReport.id, 'ご通報いただいた件について対応いたしました。\n対象ユーザーへ警告メッセージを送付しました。\nご協力ありがとうございました。');
    closeWarningModal();
    closeReportDetail();
    await loadReports();
  }catch(e){
    console.log('warning error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = '警告を送信する';
  }
}

// ===== 通報の却下 =====
/** 通報を却下 + 通報者に通知 */
async function dismissReport(){
  if(!guardEdit()) return;
  if(!openReport) return;
  if(!confirm('この通報を「対応不要」として却下しますか？')) return;
  try{
    const { error } = await supa.from('reports').update({
      status: 'dismissed',
      resolution_action: 'no_action',
      resolved_at: new Date().toISOString(),
      resolved_by: currentAdmin.id
    }).eq('id', openReport.id);
    if(error){ alert('却下に失敗しました：' + error.message); return; }
    // 通報者への結果通知
    await notifyReporter(openReport.id, 'ご通報いただいた件を確認いたしました。\n内容を精査した結果、現時点では特段の対応は不要と判断いたしました。\nご質問やご不明な点があれば、運営までお問い合わせください。');
    closeReportDetail();
    await loadReports();
  }catch(e){
    console.log('dismiss error:', e);
    alert('エラーが発生しました');
  }
}

// ===== 卒業申請一覧 =====
async function loadSotsugyouRequests(){
  const list = document.getElementById('sotsugyou-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('sotsugyou_requests').select('*').order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allSotsugyouRequests = data || [];
    updateSotsugyouCounts();
    renderSotsugyouRequests();
  }catch(e){
    console.log('sotsugyou load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

// 双方申請が揃ったペアを集計するためのキー（user_id を昇順で連結）
function pairKey(uidA, uidB){
  return uidA < uidB ? uidA + '|' + uidB : uidB + '|' + uidA;
}

// 申請を「ペア」単位に再構築
function buildPairs(){
  const map = {}; // pairKey → {a, b}
  allSotsugyouRequests.forEach(r => {
    const k = pairKey(r.user_id, r.partner_user_id);
    if(!map[k]) map[k] = { key: k, a: null, b: null };
    // canonical: a が小さい方の user_id
    if(r.user_id < r.partner_user_id){
      map[k].a = r;
    }else{
      map[k].b = r;
    }
  });
  return Object.values(map);
}

function classifyPair(p){
  // 両方とも approved → approved
  // 両方とも rejected → rejected
  // 片方が pending かつ もう片方が pending → paired (承認待ち)
  // 片方が pending、もう片方が無い → pending (片方のみ)
  // 混在は status 優先順で判定
  const a = p.a, b = p.b;
  if(a && b){
    if(a.status === 'approved' && b.status === 'approved') return 'approved';
    if(a.status === 'rejected' || b.status === 'rejected') return 'rejected';
    if(a.status === 'pending' && b.status === 'pending') return 'paired';
    return 'pending';
  }
  return 'pending';
}

function updateSotsugyouCounts(){
  const pairs = buildPairs();
  const counts = { paired:0, pending:0, approved:0, rejected:0 };
  pairs.forEach(p => { counts[classifyPair(p)]++; });
  document.getElementById('sgcount-paired').textContent = counts.paired;
  document.getElementById('sgcount-pending').textContent = counts.pending;
  document.getElementById('sgcount-approved').textContent = counts.approved;
  document.getElementById('sgcount-rejected').textContent = counts.rejected;
}

function filterSotsugyou(filter){
  sotsugyouFilter = filter;
  document.querySelectorAll('[data-sgfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.sgfilter === filter);
  });
  renderSotsugyouRequests();
}

function renderSotsugyouRequests(){
  const list = document.getElementById('sotsugyou-list');
  const pairs = buildPairs().filter(p => classifyPair(p) === sotsugyouFilter);
  if(pairs.length === 0){
    list.innerHTML = '<div class="empty-state">該当する卒業申請はありません。</div>';
    return;
  }
  let html = '';
  pairs.forEach(p => {
    const cls = classifyPair(p);
    // 表示用の代表データ取得
    const a = p.a, b = p.b;
    const aName = a ? (a.nickname || '?') : '?';
    const bName = b ? (b.nickname || '?') : '?';
    const aMid = a ? (a.member_id || '?') : '?';
    const bMid = b ? (b.member_id || '?') : '?';
    // 片方のみの場合、相手の情報を partner フィールドから補完
    let aSubmitted, bSubmitted;
    if(a){ aSubmitted = true; }
    else if(b){ aSubmitted = false; }
    if(b){ bSubmitted = true; }
    else if(a){ bSubmitted = false; }
    const aMark = aSubmitted ? '✓' : '⏳';
    const bMark = bSubmitted ? '✓' : '⏳';
    const latestTime = (a ? new Date(a.created_at).getTime() : 0) > (b ? new Date(b.created_at).getTime() : 0)
      ? (a ? a.created_at : b.created_at) : (b ? b.created_at : a.created_at);
    const labelMap = { paired:'承認待ち', pending:'片方のみ', approved:'承認済', rejected:'却下' };
    const rowClass = cls === 'paired' ? 'sg-row paired' : 'sg-row';
    html += '<div class="'+rowClass+'" onclick="openSotsugyouDetail(\''+p.key+'\')">';
    html += '<div class="sg-status-dot '+cls+'"></div>';
    html += '<div class="contact-info">';
    html += '<div class="sg-couple"><strong>'+escapeHtml(aName)+'さん</strong> '+aMark+' & <strong>'+escapeHtml(bName)+'さん</strong> '+bMark+'</div>';
    html += '<div class="contact-meta"><span class="contact-id">'+escapeHtml(aMid)+'</span><span style="color:var(--text-tertiary)">↔</span><span class="contact-id">'+escapeHtml(bMid)+'</span></div>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">';
    html += '<span class="sg-status-text '+cls+'">'+labelMap[cls]+'</span>';
    html += '<span class="contact-time">'+formatRelative(latestTime)+'</span>';
    html += '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== 卒業申請詳細 =====
function openSotsugyouDetail(pairKeyVal){
  const p = buildPairs().find(x => x.key === pairKeyVal);
  if(!p){ alert('申請が見つかりません'); return; }
  openSotsugyouPair = p;
  const cls = classifyPair(p);
  const a = p.a, b = p.b;

  let html = '';
  // ステータス
  const statusLabel = { paired:'承認待ち', pending:'片方のみ申請', approved:'承認済', rejected:'却下' }[cls];
  const statusColor = cls === 'approved' ? 'var(--green)' : cls === 'rejected' ? 'var(--red)' : cls === 'paired' ? 'var(--gold)' : 'var(--text-tertiary)';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value" style="color:'+statusColor+';font-weight:500">● '+statusLabel+'</div></div>';

  // 申請者A
  html += '<div class="detail-section-title">申請者①</div>';
  if(a){
    html += '<div class="sg-applicant-card">';
    html += '<div class="lbl">' + (a.status === 'approved' ? '✓ 承認済' : a.status === 'rejected' ? '✗ 却下' : '✓ 申請済') + '：' + formatDateTime(a.created_at) + '</div>';
    html += '<div class="nm">'+escapeHtml(a.nickname || '?')+'さん</div>';
    html += '<div class="mid">'+escapeHtml(a.member_id || '')+'</div>';
    html += '</div>';
  }else{
    html += '<div class="sg-applicant-card" style="opacity:.5">';
    html += '<div class="lbl">⏳ 未申請</div>';
    html += '<div class="nm">'+escapeHtml(b ? b.partner_nickname || '?' : '?')+'さん</div>';
    html += '<div class="mid">'+escapeHtml(b ? b.partner_member_id || '' : '')+'</div>';
    html += '</div>';
  }

  // 申請者B
  html += '<div class="detail-section-title">申請者②</div>';
  if(b){
    html += '<div class="sg-applicant-card">';
    html += '<div class="lbl">' + (b.status === 'approved' ? '✓ 承認済' : b.status === 'rejected' ? '✗ 却下' : '✓ 申請済') + '：' + formatDateTime(b.created_at) + '</div>';
    html += '<div class="nm">'+escapeHtml(b.nickname || '?')+'さん</div>';
    html += '<div class="mid">'+escapeHtml(b.member_id || '')+'</div>';
    html += '</div>';
  }else{
    html += '<div class="sg-applicant-card" style="opacity:.5">';
    html += '<div class="lbl">⏳ 未申請</div>';
    html += '<div class="nm">'+escapeHtml(a ? a.partner_nickname || '?' : '?')+'さん</div>';
    html += '<div class="mid">'+escapeHtml(a ? a.partner_member_id || '' : '')+'</div>';
    html += '</div>';
  }

  // 却下情報
  if(cls === 'rejected'){
    const r = (a && a.status === 'rejected') ? a : b;
    if(r){
      html += '<div class="banned-info-box">';
      html += '<div class="banned-info-label">● 却下情報</div>';
      html += '<div>却下日時：'+formatDateTime(r.rejected_at)+'</div>';
      html += '<div style="margin-top:6px">理由：'+escapeHtml(r.rejection_reason || '（記載なし）')+'</div>';
      html += '</div>';
    }
  }

  // 承認情報
  if(cls === 'approved'){
    html += '<div class="resolved-info-box">';
    html += '<div class="resolved-info-label">● 承認済み</div>';
    if(a && a.approved_at) html += '<div>承認日時：'+formatDateTime(a.approved_at)+'</div>';
    html += '</div>';
  }

  // アクションボタン
  if(cls === 'paired'){
    html += '<div class="action-buttons">';
    html += '<button class="btn-action approve" onclick="approveSotsugyou()">承認する</button>';
    html += '<button class="btn-action ban" onclick="openRejectSotsugyou()">却下する</button>';
    html += '</div>';
  }else if(cls === 'pending'){
    html += '<div style="font-size:11px;color:var(--text-secondary);background:var(--bg-secondary);border-radius:8px;padding:10px 14px;margin-top:14px;line-height:1.7">⏳ もう一方の申請をお待ちください。両方の申請が揃ったら承認可能になります。</div>';
  }

  document.getElementById('sotsugyou-detail-body').innerHTML = html;
  document.getElementById('sotsugyou-detail-modal').classList.add('show');
}

function closeSotsugyouDetail(){
  document.getElementById('sotsugyou-detail-modal').classList.remove('show');
  openSotsugyouPair = null;
}

// ===== 承認処理：両方を approved に + 承認通知（CB は卒業認定時に発生）=====
async function approveSotsugyou(){
  if(!guardEdit()) return;
  if(!openSotsugyouPair) return;
  const p = openSotsugyouPair;
  if(!p.a || !p.b){ alert('双方の申請が揃っていません'); return; }
  if(!confirm('このカップルの卒業申請を承認しますか？\n両者ともに卒業鑑定プランの申し込みが解放されます。')) return;
  try{
    const now = new Date().toISOString();
    // 両方を承認
    const { error: aErr } = await supa.from('sotsugyou_requests').update({
      status: 'approved', approved_at: now, approved_by: currentAdmin.id
    }).eq('id', p.a.id);
    if(aErr){ alert('承認に失敗しました：' + aErr.message); return; }
    const { error: bErr } = await supa.from('sotsugyou_requests').update({
      status: 'approved', approved_at: now, approved_by: currentAdmin.id
    }).eq('id', p.b.id);
    if(bErr){ alert('相手方の承認に失敗しました：' + bErr.message); return; }

    // 両者の運営チャットに承認通知を送信
    await supa.from('contacts').insert([
      {
        user_id: p.a.user_id, member_id: p.a.member_id, nickname: p.a.nickname,
        contact_type: '運営通知', body: 'おめでとうございます！🎊\n卒業申請が承認されました。卒業鑑定プランのお申し込みが可能になりました。「その他」→「プラン」よりお進みください。',
        status: 'replied'
      },
      {
        user_id: p.b.user_id, member_id: p.b.member_id, nickname: p.b.nickname,
        contact_type: '運営通知', body: 'おめでとうございます！🎊\n卒業申請が承認されました。卒業鑑定プランのお申し込みが可能になりました。「その他」→「プラン」よりお進みください。',
        status: 'replied'
      }
    ]);

    // ※ キャッシュバックの発生は「卒業認定（certify_graduation）」時に移しました。
    //   卒業申請承認の段階ではまだ卒業鑑定前なので、ここでは CB を作りません。

    closeSotsugyouDetail();
    await loadSotsugyouRequests();
    alert('卒業申請を承認しました。両者へ通知を送信しました。');
  }catch(e){
    console.log('approve sotsugyou error:', e);
    alert('エラーが発生しました：' + (e.message || ''));
  }
}

// ===== 却下処理 =====
function openRejectSotsugyou(){
  if(!openSotsugyouPair) return;
  document.getElementById('sgr-reason').value = '';
  document.getElementById('sgr-error').textContent = '';
  document.getElementById('sgr-confirm-btn').disabled = false;
  document.getElementById('sgr-confirm-btn').textContent = '却下を実行する';
  document.getElementById('sotsugyou-reject-modal').classList.add('show');
}

function closeSotsugyouReject(){
  document.getElementById('sotsugyou-reject-modal').classList.remove('show');
}

async function confirmRejectSotsugyou(){
  if(!guardEdit()) return;
  if(!openSotsugyouPair) return;
  const p = openSotsugyouPair;
  if(!p.a || !p.b) return;
  const reason = document.getElementById('sgr-reason').value.trim();
  const errEl = document.getElementById('sgr-error');
  if(!reason){ errEl.textContent = '却下理由は必須です'; return; }
  const btn = document.getElementById('sgr-confirm-btn');
  btn.disabled = true; btn.textContent = '処理中...';
  try{
    const now = new Date().toISOString();
    await supa.from('sotsugyou_requests').update({
      status: 'rejected', rejected_at: now, rejection_reason: reason
    }).in('id', [p.a.id, p.b.id]);
    // 両者の運営チャットに却下通知
    await supa.from('contacts').insert([
      {
        user_id: p.a.user_id, member_id: p.a.member_id, nickname: p.a.nickname,
        contact_type: '運営通知', body: '卒業申請について\n申請を確認いたしましたが、以下の理由により承認を見送らせていただきました。\n\n理由：' + reason + '\n\nご不明な点がございましたら、お問い合わせよりご連絡ください。',
        status: 'replied'
      },
      {
        user_id: p.b.user_id, member_id: p.b.member_id, nickname: p.b.nickname,
        contact_type: '運営通知', body: '卒業申請について\n申請を確認いたしましたが、以下の理由により承認を見送らせていただきました。\n\n理由：' + reason + '\n\nご不明な点がございましたら、お問い合わせよりご連絡ください。',
        status: 'replied'
      }
    ]);
    closeSotsugyouReject();
    closeSotsugyouDetail();
    await loadSotsugyouRequests();
  }catch(e){
    console.log('reject sotsugyou error:', e);
    errEl.textContent = 'エラーが発生しました：' + (e.message || '');
    btn.disabled = false; btn.textContent = '却下を実行する';
  }
}

// ===== 予約管理 =====
function buildBookingShareUrl(){
  // 管理画面 /admin/index.html から /booking/index.html を逆算
  return window.location.origin + '/booking/index.html';
}
function initBookingShareUrl(){
  const url = buildBookingShareUrl();
  const inp = document.getElementById('booking-share-url');
  const link = document.getElementById('open-share-link');
  if(inp) inp.value = url;
  if(link) link.href = url;
}
function copyBookingShareUrl(){
  const url = buildBookingShareUrl();
  const btn = document.getElementById('copy-share-btn');
  const original = btn ? btn.textContent : '';
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(() => {
      if(btn){ btn.textContent = '✓ コピー済'; setTimeout(() => btn.textContent = original, 1500); }
    }).catch(() => {
      window.prompt('予約URLをコピーしてください：', url);
    });
  }else{
    window.prompt('予約URLをコピーしてください：', url);
  }
}

async function loadBookings(){
  const list = document.getElementById('bookings-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('bookings').select('*').order('scheduled_date', { ascending: true }).order('scheduled_slot', { ascending: true });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allBookings = data || [];
    updateBookingCounts();
    renderBookings();
    // カレンダービューの場合は再描画
    if(bookingViewMode === 'calendar'){
      renderBookingCalendar();
    }
  }catch(e){
    console.log('bookings load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

function isUpcoming(b){
  // scheduled_date が今日以降 かつ アクティブ（cancelled でない）
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  return b.scheduled_date >= todayKey && b.status !== 'cancelled';
}
function isPast(b){
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  return b.scheduled_date < todayKey && b.status !== 'cancelled';
}
function updateBookingCounts(){
  document.getElementById('bcount-upcoming').textContent = allBookings.filter(isUpcoming).length;
  document.getElementById('bcount-past').textContent = allBookings.filter(isPast).length;
  document.getElementById('bcount-cancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
  document.getElementById('bcount-all').textContent = allBookings.length;
}

function filterBookings(filter){
  bookingFilter = filter;
  document.querySelectorAll('[data-bookfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.bookfilter === filter);
  });
  renderBookings();
}

function renderBookings(){
  const list = document.getElementById('bookings-list');
  let filtered = allBookings;
  if(bookingFilter === 'upcoming') filtered = filtered.filter(isUpcoming);
  else if(bookingFilter === 'past') filtered = filtered.filter(isPast);
  else if(bookingFilter === 'cancelled') filtered = filtered.filter(b => b.status === 'cancelled');
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当する予約はありません。</div>';
    return;
  }
  // 直近順（upcoming は昇順、past は降順）
  if(bookingFilter === 'past'){
    filtered = filtered.slice().reverse();
  }
  let html = '';
  const dowNames = ['日','月','火','水','木','金','土'];
  filtered.forEach(b => {
    const parts = b.scheduled_date.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dow = dowNames[date.getDay()];
    const statusLabel = b.status === 'pending' ? '受付済' : b.status === 'confirmed' ? '確定' : 'キャンセル';
    const rowClass = b.status === 'cancelled' ? 'bk-row cancelled' : 'bk-row';
    html += '<div class="'+rowClass+'" onclick="openBookingDetail(\''+b.id+'\')">';
    html += '<div class="bk-status-dot '+b.status+'"></div>';
    html += '<div class="contact-info">';
    html += '<div class="bk-when">'+parts[1]+'/'+parts[2]+'<span class="dow">（'+dow+'）</span></div>';
    html += '<div class="bk-slot">'+escapeHtml(b.scheduled_slot)+'</div>';
    const isPair = b.attendance_type === 'pair';
    const namesDisplay = isPair
      ? escapeHtml(b.guest_name||'?') + 'さん & ' + escapeHtml(b.partner_name||'?') + 'さん'
      : escapeHtml(b.guest_name||'?') + 'さん';
    html += '<div class="bk-meta"><span>'+namesDisplay+'</span>';
    if(isPair) html += '<span class="bk-pair-badge">👥 2人</span>';
    if(b.member_id) html += '<span class="contact-id">'+escapeHtml(b.member_id)+'</span>';
    if(b.guest_phone) html += '<span>📱 '+escapeHtml(b.guest_phone)+'</span>';
    html += '</div>';
    html += '</div>';
    html += '<span class="bk-status-text '+b.status+'">'+statusLabel+'</span>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== 予約：ビュー切替 =====
function setBookingView(mode){
  bookingViewMode = mode;
  document.getElementById('bview-list').classList.toggle('on', mode === 'list');
  document.getElementById('bview-cal').classList.toggle('on', mode === 'calendar');
  document.getElementById('booking-list-view').style.display = (mode === 'list') ? 'block' : 'none';
  document.getElementById('booking-calendar-view').style.display = (mode === 'calendar') ? 'block' : 'none';
  if(mode === 'calendar'){
    if(bkCalYear == null){
      const today = new Date();
      bkCalYear = today.getFullYear();
      bkCalMonth = today.getMonth() + 1;
    }
    renderBookingCalendar();
  }
}

function bookingCalPrev(){
  bkCalMonth--;
  if(bkCalMonth < 1){ bkCalMonth = 12; bkCalYear--; }
  bkCalSelectedDate = null;
  renderBookingCalendar();
}
function bookingCalNext(){
  bkCalMonth++;
  if(bkCalMonth > 12){ bkCalMonth = 1; bkCalYear++; }
  bkCalSelectedDate = null;
  renderBookingCalendar();
}
function bookingCalToday(){
  const t = new Date();
  bkCalYear = t.getFullYear();
  bkCalMonth = t.getMonth() + 1;
  bkCalSelectedDate = null;
  renderBookingCalendar();
}

function renderBookingCalendar(){
  document.getElementById('bk-cal-title').textContent = bkCalYear + '年' + bkCalMonth + '月';
  // 月内の予約を集計：日付別、ステータス別
  const dailyMap = {}; // 'YYYY-MM-DD' → {pending:[], confirmed:[], cancelled:[]}
  const monthPrefix = bkCalYear + '-' + String(bkCalMonth).padStart(2,'0');
  allBookings.forEach(b => {
    if(!b.scheduled_date.startsWith(monthPrefix)) return;
    if(!dailyMap[b.scheduled_date]) dailyMap[b.scheduled_date] = { pending:[], confirmed:[], cancelled:[] };
    if(b.status === 'pending') dailyMap[b.scheduled_date].pending.push(b);
    else if(b.status === 'confirmed') dailyMap[b.scheduled_date].confirmed.push(b);
    else if(b.status === 'cancelled') dailyMap[b.scheduled_date].cancelled.push(b);
  });

  const grid = document.getElementById('bk-cal-grid');
  let html = '';
  const headers = ['日','月','火','水','木','金','土'];
  headers.forEach((h, i) => {
    let cls = '';
    if(i === 0) cls = ' sun';
    if(i === 6) cls = ' sat';
    html += '<div class="bk-cal-head'+cls+'">'+h+'</div>';
  });

  const firstDay = new Date(bkCalYear, bkCalMonth - 1, 1);
  const lastDay = new Date(bkCalYear, bkCalMonth, 0);
  const firstDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

  for(let i = 0; i < firstDow; i++){
    html += '<div class="bk-cal-cell empty"></div>';
  }
  for(let d = 1; d <= daysInMonth; d++){
    const cellDate = new Date(bkCalYear, bkCalMonth - 1, d);
    const dow = cellDate.getDay();
    const dateKey = bkCalYear + '-' + String(bkCalMonth).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isAvailableDow = BOOKING_AVAILABLE_DOW.indexOf(dow) >= 0;
    const isToday = dateKey === todayKey;
    const dayInfo = dailyMap[dateKey] || { pending:[], confirmed:[], cancelled:[] };
    const activeCount = dayInfo.pending.length + dayInfo.confirmed.length;
    const totalSlots = BOOKING_SLOTS.length;

    let cls = 'bk-cal-cell';
    if(!isAvailableDow) cls += ' disabled';
    if(dow === 0) cls += ' sun';
    if(dow === 6) cls += ' sat';
    if(isToday) cls += ' today';
    if(bkCalSelectedDate === dateKey) cls += ' selected';

    let onclick = '';
    if(isAvailableDow || activeCount > 0 || dayInfo.cancelled.length > 0){
      onclick = ' onclick="selectBookingDay(\''+dateKey+'\')"';
    }

    let countHtml = '';
    if(activeCount === 0 && isAvailableDow){
      countHtml = '<div class="bk-cell-count avail">○ 空き</div>';
    }else if(activeCount > 0 && activeCount < totalSlots){
      countHtml = '<div class="bk-cell-count some">'+activeCount+'件</div>';
    }else if(activeCount >= totalSlots){
      countHtml = '<div class="bk-cell-count full">満席</div>';
    }
    if(!isAvailableDow && activeCount === 0 && dayInfo.cancelled.length === 0){
      countHtml = '';
    }

    html += '<div class="'+cls+'"'+onclick+'><div class="bk-day-num">'+d+'</div>'+countHtml+'</div>';
  }
  // trailing cells
  const totalCells = firstDow + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for(let i = 0; i < trailing; i++){
    html += '<div class="bk-cal-cell empty"></div>';
  }
  grid.innerHTML = html;

  // 日詳細をクリア or 再描画
  if(bkCalSelectedDate){
    renderBookingDayDetail(bkCalSelectedDate);
  }else{
    document.getElementById('bk-day-detail').style.display = 'none';
  }
}

function selectBookingDay(dateKey){
  bkCalSelectedDate = dateKey;
  renderBookingCalendar();
  renderBookingDayDetail(dateKey);
}

function renderBookingDayDetail(dateKey){
  const detailBox = document.getElementById('bk-day-detail');
  const parts = dateKey.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const dowNames = ['日','月','火','水','木','金','土'];
  const dow = date.getDay();
  const isAvailableDow = BOOKING_AVAILABLE_DOW.indexOf(dow) >= 0;

  // 当日の予約をスロットごとに分類
  const slotMap = {}; // slot → booking
  const dayBookings = allBookings.filter(b => b.scheduled_date === dateKey);
  dayBookings.forEach(b => {
    // active を優先表示。同一スロットに cancelled 複数+active 1 みたいな場合は active を取る
    const existing = slotMap[b.scheduled_slot];
    if(!existing){
      slotMap[b.scheduled_slot] = b;
    }else if(existing.status === 'cancelled' && b.status !== 'cancelled'){
      slotMap[b.scheduled_slot] = b;
    }
  });
  const cancelledExtra = dayBookings.filter(b => b.status === 'cancelled' && slotMap[b.scheduled_slot] && slotMap[b.scheduled_slot].id !== b.id);

  let html = '<div class="bk-day-detail-title">'+parts[0]+'年'+parts[1]+'月'+parts[2]+'日（'+dowNames[dow]+'）の予約状況</div>';
  if(!isAvailableDow){
    html += '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:.6rem">※ この曜日は通常予約不可日です。</div>';
  }
  html += '<div class="bk-slot-list">';
  BOOKING_SLOTS.forEach(slot => {
    const b = slotMap[slot];
    if(!b){
      // 空き
      html += '<div class="bk-slot-row empty-slot">';
      html += '<div class="bk-slot-status-dot empty-dot"></div>';
      html += '<div class="bk-slot-time">'+slot+'</div>';
      html += '<div class="bk-slot-info empty">— 空き</div>';
      html += '</div>';
    }else{
      const isCancelled = b.status === 'cancelled';
      const isPair = b.attendance_type === 'pair';
      const cls = 'bk-slot-row has-booking' + (isCancelled ? ' cancelled-slot' : '');
      const statusLabel = b.status === 'pending' ? '受付済' : b.status === 'confirmed' ? '確定' : 'キャンセル';
      const namesDisplay = isPair
        ? escapeHtml(b.guest_name||'?') + 'さん & ' + escapeHtml(b.partner_name||'?') + 'さん'
        : escapeHtml(b.guest_name||'?') + 'さん';
      html += '<div class="'+cls+'" onclick="openBookingDetail(\''+b.id+'\')">';
      html += '<div class="bk-slot-status-dot '+b.status+'"></div>';
      html += '<div class="bk-slot-time">'+slot+'</div>';
      html += '<div class="bk-slot-info">'+namesDisplay+(isPair?' <span class="bk-pair-badge" style="margin-left:5px">👥</span>':'')+'<div class="bk-slot-meta">'+escapeHtml(b.member_id||'')+' ・ '+statusLabel+'</div></div>';
      html += '</div>';
    }
  });
  html += '</div>';
  if(cancelledExtra.length > 0){
    html += '<div style="font-size:10px;color:var(--text-tertiary);margin-top:.6rem">同日に他にもキャンセル済み予約が '+cancelledExtra.length+' 件あります（一覧タブで確認）</div>';
  }
  detailBox.innerHTML = html;
  detailBox.style.display = 'block';
}

// ===== 予約詳細 =====
function openBookingDetail(id){
  const b = allBookings.find(x => x.id === id);
  if(!b){ alert('予約が見つかりません'); return; }
  openBooking = b;
  const parts = b.scheduled_date.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const dowNames = ['日','月','火','水','木','金','土'];

  const isPair = b.attendance_type === 'pair';
  let html = '';
  html += '<div class="detail-row"><div class="detail-label">日時</div><div class="detail-value">'+parts[0]+'年'+parts[1]+'月'+parts[2]+'日（'+dowNames[date.getDay()]+'）'+escapeHtml(b.scheduled_slot)+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">受け方</div><div class="detail-value">'+(isPair ? '👥 2人で受ける' : '🧍 1人で受ける')+'</div></div>';
  // 鑑定方法（対面 / オンライン）
  var methodLabel = b.kantei_method === '対面' ? '🤝 対面' : (b.kantei_method === 'オンライン' ? '💻 オンライン' : '—');
  html += '<div class="detail-row"><div class="detail-label">鑑定方法</div><div class="detail-value">'+methodLabel+'</div></div>';
  html += '<div class="detail-section-title">'+(isPair ? '申込者①' : '申込者')+'</div>';
  html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(b.guest_name||'?')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(b.member_id||'—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">電話番号</div><div class="detail-value">'+escapeHtml(b.guest_phone||'—')+'</div></div>';
  if(isPair){
    html += '<div class="detail-section-title">申込者②（パートナー）</div>';
    html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(b.partner_name||'?')+'さん</div></div>';
    html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(b.partner_member_id||'—')+'</div></div>';
    html += '<div class="detail-row"><div class="detail-label">電話番号</div><div class="detail-value">'+escapeHtml(b.partner_phone||'—')+'</div></div>';
  }
  html += '<div class="detail-section-title">予約情報</div>';
  const statusLabel = b.status === 'pending' ? '🟡 受付済（未確定）' : b.status === 'confirmed' ? '🟢 確定' : '🔴 キャンセル';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value">'+statusLabel+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">受付日時</div><div class="detail-value">'+formatDateTime(b.created_at)+'</div></div>';
  if(b.cancelled_at){
    html += '<div class="detail-row"><div class="detail-label">キャンセル日時</div><div class="detail-value">'+formatDateTime(b.cancelled_at)+'</div></div>';
  }
  if(b.notes){
    html += '<div class="detail-section-title">備考</div>';
    html += '<div class="detail-body-box">'+escapeHtml(b.notes)+'</div>';
  }
  // アクションボタン
  if(b.status === 'pending'){
    html += '<div class="action-buttons">';
    html += '<button class="btn-action approve" onclick="confirmBooking()">確定にする</button>';
    html += '<button class="btn-action ban" onclick="cancelBookingByAdmin()">キャンセルする</button>';
    html += '</div>';
  }else if(b.status === 'confirmed'){
    html += '<div class="action-buttons">';
    html += '<button class="btn-action ban" onclick="cancelBookingByAdmin()">キャンセルする</button>';
    html += '</div>';
  }
  // 卒業認定セクション（status 問わず表示。鑑定終了後に押す想定）
  html += '<div class="detail-section-title">卒業認定</div>';
  html += '<div style="font-size:11px;color:var(--text-secondary);line-height:1.7;margin-bottom:.6rem">鑑定実施後、ボタンを押すとユーザー（パートナーがいる場合は両方）が卒業認定され、運営チャットへ通知が届きます。NOマッチングプラン切替で「卒業生の間」が利用可能になります。</div>';
  html += '<div style="background:rgba(58,154,58,.08);border:1px solid rgba(58,154,58,.3);border-radius:10px;padding:14px;margin-top:.5rem">';
  html += '<button class="btn-send" style="background:#3a9a3a" onclick="certifyBookingGraduation()">🎓 卒業を認定する'+(isPair?'（2人とも）':'')+'</button>';
  html += '</div>';
  document.getElementById('booking-detail-body').innerHTML = html;
  document.getElementById('booking-detail-modal').classList.add('show');
}

/** 予約詳細から、guest（とパートナー）を卒業認定する。
 *  member_id → user_id を解決し、certify_graduation RPC をまとめて呼ぶ。
 *  RPC 側で重複認定はスキップされる。 */
async function certifyBookingGraduation(){
  if(!guardEdit()) return;
  if(!openBooking){ return; }
  const b = openBooking;
  const isPair = b.attendance_type === 'pair';
  const label = isPair
    ? '「' + (b.guest_name||'?') + '」さん と パートナー「' + (b.partner_name||'?') + '」さん の2名を卒業認定します。よろしいですか？'
    : '「' + (b.guest_name||'?') + '」さん を卒業認定します。よろしいですか？';
  if(!confirm(label + '\n\n認定後、ユーザーに通知が届き「卒業生の間」が利用可能になります（NOマッチング切替時）。既に認定済の場合はスキップされます。')) return;
  try{
    const memberIds = [b.member_id];
    if(isPair && b.partner_member_id) memberIds.push(b.partner_member_id);
    // member_id → user_id 解決
    const { data: profs, error: profErr } = await supa.from('profiles')
      .select('id, member_id, nickname').in('member_id', memberIds);
    if(profErr){ alert('ユーザー情報取得に失敗: ' + profErr.message); return; }
    if(!profs || profs.length === 0){ alert('該当ユーザーが見つかりませんでした'); return; }
    const userIds = profs.map(p => p.id);
    const { error: rpcErr } = await supa.rpc('certify_graduation', { p_user_ids: userIds });
    if(rpcErr){ alert('認定に失敗しました: ' + rpcErr.message); return; }
    // Push 通知（fire-and-forget）
    profs.forEach(function(p){
      sendPushNotification(supa, {
        target_user_id: p.id,
        title: '🎓 卒業が認定されました',
        body: 'NOマッチングプランに切り替えで「卒業生の間」へ参加できます🎉',
        url: './#msg',
        tag: 'graduation-certified',
      });
    });
    alert('✓ 認定処理を実行しました（' + userIds.length + '名）');
    closeBookingDetail();
    loadBookings();
  }catch(e){
    console.log('certifyBookingGraduation error:', e);
    alert('エラーが発生しました');
  }
}

function closeBookingDetail(){
  document.getElementById('booking-detail-modal').classList.remove('show');
  openBooking = null;
}

async function confirmBooking(){
  if(!guardEdit()) return;
  if(!openBooking) return;
  if(!confirm('この予約を確定にしますか？\n確定後、ユーザー(およびペアの場合はパートナー)に運営チャット + Push 通知が送信されます。')) return;
  try{
    const { error } = await supa.from('bookings').update({ status: 'confirmed' }).eq('id', openBooking.id);
    if(error){ alert('更新に失敗しました：' + error.message); return; }

    // 確定通知を本人 (+ ペアならパートナー) へ送信
    try{
      await sendBookingConfirmedNotice(openBooking);
    }catch(nx){
      console.log('booking confirm notice exception:', nx);
      alert('予約は確定されましたが、通知送信に失敗した可能性があります。コンソールをご確認ください。');
    }

    closeBookingDetail();
    await loadBookings();
  }catch(e){
    console.log('confirm booking error:', e);
    alert('エラーが発生しました');
  }
}

/** 予約確定通知を本人およびパートナーの運営チャット + Push 通知に送信
 *  @param {Object} b - openBooking と同じ形（id, user_id, scheduled_date, scheduled_slot, attendance_type, kantei_method, partner_name, partner_member_id, partner_phone, nickname, member_id, name）
 */
async function sendBookingConfirmedNotice(b){
  // 1. 通知本文を構築（日時整形 + 鑑定方法に応じた前日案内）
  const noticeBody = buildBookingConfirmNoticeBody(b);

  // 2. 通知対象を集める
  //    予約は非ログインの公開フォームから作成されるため bookings.user_id は通常 NULL。
  //    本人の member_id (b.member_id) からユーザーを lookup する。
  //    ペアの場合は partner_member_id からも lookup。
  var targets = []; // [{user_id, member_id, nickname}, ...]
  var seenIds = new Set(); // 重複ガード

  async function tryAddTarget(memberId, fallbackName){
    if(!memberId) return;
    try{
      const{data:rows, error:lkErr}=await supa.rpc('lookup_user_by_member_id', { p_member_id: memberId });
      if(lkErr){ console.log('lookup error for ' + memberId + ':', lkErr); return; }
      if(!rows || rows.length === 0){ console.log('lookup: member not found:', memberId); return; }
      var u = rows[0];
      if(!u.id || seenIds.has(u.id)) return;
      seenIds.add(u.id);
      targets.push({
        user_id: u.id,
        member_id: memberId,
        nickname: u.nickname || fallbackName || null
      });
    }catch(ex){ console.log('lookup exception for ' + memberId + ':', ex); }
  }

  // 念のため、bookings.user_id が万が一入っているケースも拾う(将来仕様変更対応)
  if(b.user_id && !seenIds.has(b.user_id)){
    seenIds.add(b.user_id);
    targets.push({ user_id: b.user_id, member_id: b.member_id || null, nickname: b.guest_name || b.name || b.nickname || null });
  }
  // 本人 (member_id)
  await tryAddTarget(b.member_id, b.guest_name || b.name);
  // ペアの場合のパートナー
  if(b.attendance_type === 'pair'){
    await tryAddTarget(b.partner_member_id, b.partner_name);
  }

  if(targets.length === 0){
    console.log('booking confirm notice: 通知対象なし（member_id から user 解決できず）');
    return;
  }

  // 3. contacts INSERT (admin の RLS で user_id 任意を許可済み)
  const rows = targets.map(function(t){
    return {
      user_id: t.user_id,
      member_id: t.member_id,
      nickname: t.nickname,
      contact_type: '運営通知',
      body: noticeBody,
      status: 'replied'
    };
  });
  const { error: insErr } = await supa.from('contacts').insert(rows);
  if(insErr){
    console.log('booking notice insert error:', insErr);
    throw insErr;
  }

  // 4. Push 通知を各対象に送信（fire-and-forget でも可、ただし await で完了は確認）
  for(const t of targets){
    try{
      sendPushNotification(supa, {
        target_user_id: t.user_id,
        title: '卒業鑑定の予約が確定しました！',
        body: noticeBody.split('\n').slice(0, 5).join('\n'), // 先頭5行 をプレビューに
        url: './#chat-official',
        tag: 'booking-confirmed-' + b.id,
      });
    }catch(px){ console.log('push exception:', px); }
  }
}

/** 日時を「2026年6月15日(土) 14:00-15:30」風に整形 + 鑑定方法応じた前日案内付き本文を構築 */
function buildBookingConfirmNoticeBody(b){
  // 日付整形
  const WEEK = ['日','月','火','水','木','金','土'];
  var dateText = '日付未設定';
  if(b.scheduled_date){
    try{
      const d = new Date(b.scheduled_date + 'T00:00:00');
      dateText = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日(' + WEEK[d.getDay()] + ') ' + (b.scheduled_slot || '');
    }catch(_){ dateText = (b.scheduled_date || '') + ' ' + (b.scheduled_slot || ''); }
  }

  // 鑑定方法表記
  const method = b.kantei_method || '対面';
  var methodText;
  if(method === 'オンライン' || method === 'online'){
    methodText = 'オンライン(zoom)';
  }else{
    methodText = '対面';
  }

  // 受け方表記
  const attend = b.attendance_type === 'pair' ? 'お二人で' : 'お一人で';

  // 鑑定方法ごとの前日案内行（該当する片方のみ表示）
  var methodNote;
  if(methodText.indexOf('オンライン') >= 0){
    methodNote = ' ※zoomリンクを前日までにお送りさせて頂きます';
  }else{
    methodNote = ' ※鑑定場所は前日までにご連絡させて頂きます';
  }

  return '📅【ご予約確定】卒業鑑定\n\n'
    + 'この度はお申し込みありがとうございます。\n'
    + '下記内容でご予約が確定致しました。\n\n'
    + '■ 日時: ' + dateText + '\n'
    + '■ 鑑定方法: ' + methodText + '\n'
    + '■ 受け方: ' + attend + '\n\n'
    + methodNote + '\n\n'
    + 'ご不明点・日程変更のご希望がありましたら、\n'
    + 'こちらの運営チャットにてご連絡ください。\n\n'
    + '当日お会いできるのを楽しみにしております 🍀';
}

async function cancelBookingByAdmin(){
  if(!guardEdit()) return;
  if(!openBooking) return;
  if(!confirm('この予約をキャンセルしますか？')) return;
  try{
    const { error } = await supa.from('bookings').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by_admin: true
    }).eq('id', openBooking.id);
    if(error){ alert('キャンセルに失敗しました：' + error.message); return; }
    closeBookingDetail();
    await loadBookings();
  }catch(e){
    console.log('cancel booking error:', e);
    alert('エラーが発生しました');
  }
}

// ===== キャッシュバック管理 =====
async function loadCashbacks(){
  const list = document.getElementById('cashbacks-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    // キャッシュバック取得
    const cbRes = await supa.from('cashbacks').select('*').order('created_at', { ascending: false });
    if(cbRes.error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(cbRes.error.message)+'</div>';
      return;
    }
    const cashbacks = cbRes.data || [];
    // 関連する紹介者プロフィールを取得（口座情報・連絡先のため）
    const refIds = Array.from(new Set(cashbacks.map(c => c.referrer_id)));
    let profileMap = {};
    if(refIds.length > 0){
      const profRes = await supa.from('profiles').select('id,nickname,member_id,phone_number,bank_name,bank_branch,bank_account_type,bank_account_number,bank_account_holder').in('id', refIds);
      (profRes.data || []).forEach(p => { profileMap[p.id] = p; });
    }
    // それぞれに紹介者プロフィールを添付
    allCashbacks = cashbacks.map(c => Object.assign({}, c, { referrer_profile: profileMap[c.referrer_id] || null }));
    updateCashbackCounts();
    renderCashbacks();
  }catch(e){
    console.log('cashbacks load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

function updateCashbackCounts(){
  const eligible = allCashbacks.filter(c => c.status === 'eligible');
  const paid = allCashbacks.filter(c => c.status === 'paid');
  document.getElementById('cbcount-eligible').textContent = eligible.length;
  document.getElementById('cbcount-paid').textContent = paid.length;
  document.getElementById('cbcount-all').textContent = allCashbacks.length;
  // サマリー
  const eligibleTotal = eligible.reduce((s, c) => s + (c.amount || 0), 0);
  const paidTotal = paid.reduce((s, c) => s + (c.amount || 0), 0);
  const summary = document.getElementById('cb-summary');
  if(summary){
    summary.innerHTML =
      '<div class="cb-summary-card eligible">' +
        '<div class="cb-summary-label">振込待ち</div>' +
        '<div class="cb-summary-value">¥' + eligibleTotal.toLocaleString() + '</div>' +
        '<div class="cb-summary-sub">' + eligible.length + '件</div>' +
      '</div>' +
      '<div class="cb-summary-card paid">' +
        '<div class="cb-summary-label">振込済</div>' +
        '<div class="cb-summary-value">¥' + paidTotal.toLocaleString() + '</div>' +
        '<div class="cb-summary-sub">' + paid.length + '件</div>' +
      '</div>';
  }
}

function filterCashbacks(filter){
  cashbackFilter = filter;
  document.querySelectorAll('[data-cbfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.cbfilter === filter);
  });
  renderCashbacks();
}

function hasBank(profile){
  return profile && profile.bank_name && profile.bank_branch && profile.bank_account_number && profile.bank_account_holder;
}

function renderCashbacks(){
  const list = document.getElementById('cashbacks-list');
  let filtered = allCashbacks;
  if(cashbackFilter !== 'all') filtered = filtered.filter(c => c.status === cashbackFilter);
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当するキャッシュバックはありません。</div>';
    return;
  }
  let html = '';
  filtered.forEach(c => {
    const isPaid = c.status === 'paid';
    const rowClass = isPaid ? 'cb-row paid' : 'cb-row';
    const bankReg = hasBank(c.referrer_profile);
    const bankBadge = isPaid
      ? ''
      : (bankReg
        ? '<span class="cb-bank-status registered">✓ 口座登録済</span>'
        : '<span class="cb-bank-status unregistered">⚠ 口座未登録</span>');
    const statusLabel = isPaid ? '振込済' : '振込待ち';
    html += '<div class="'+rowClass+'" onclick="openCashbackDetail(\''+c.id+'\')">';
    html += '<div class="cb-status-dot '+c.status+'"></div>';
    html += '<div class="contact-info">';
    html += '<div class="cb-line1">';
    html += '<span class="cb-name">'+escapeHtml(c.referrer_nickname || '?')+'さん</span>';
    html += '<span class="cb-id">'+escapeHtml(c.referrer_member_id || '')+'</span>';
    if(bankBadge) html += bankBadge;
    html += '</div>';
    html += '<div class="cb-line2">被紹介者：'+escapeHtml(c.referee_nickname || '?')+'さん（'+escapeHtml(c.referee_member_id || '')+'）</div>';
    html += '<div class="cb-line2" style="font-size:10px;color:var(--text-tertiary);margin-top:2px">発生日：'+formatDateTime(c.created_at)+(isPaid ? ' / 振込日：'+formatDateTime(c.paid_at) : '')+'</div>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">';
    html += '<div class="cb-amount">¥'+(c.amount || 0).toLocaleString()+'<div class="cb-amount-label">'+statusLabel+'</div></div>';
    html += '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== キャッシュバック詳細 =====
function openCashbackDetail(id){
  const c = allCashbacks.find(x => x.id === id);
  if(!c){ alert('キャッシュバックが見つかりません'); return; }
  openCashback = c;
  const isPaid = c.status === 'paid';
  const profile = c.referrer_profile || null;
  const bankReg = hasBank(profile);

  let html = '';

  // ステータス
  const statusText = isPaid
    ? '<span class="detail-status-replied">● 振込済</span>'
    : '<span style="color:var(--gold);font-weight:500">● 振込待ち</span>';
  html += '<div class="detail-row"><div class="detail-label">ステータス</div><div class="detail-value">'+statusText+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">金額</div><div class="detail-value" style="font-family:\'Noto Serif JP\',serif;font-size:18px;font-weight:700;color:var(--gold)">¥'+(c.amount || 0).toLocaleString()+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">発生日時</div><div class="detail-value">'+formatDateTime(c.created_at)+'</div></div>';
  if(isPaid){
    html += '<div class="detail-row"><div class="detail-label">振込日時</div><div class="detail-value">'+formatDateTime(c.paid_at)+'</div></div>';
  }

  // 紹介者
  html += '<div class="detail-section-title">紹介者（受取人）</div>';
  html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(c.referrer_nickname || '?')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(c.referrer_member_id || '—')+'</div></div>';
  if(profile && profile.phone_number){
    html += '<div class="detail-row"><div class="detail-label">電話番号</div><div class="detail-value">'+escapeHtml(profile.phone_number)+'</div></div>';
  }

  // 被紹介者
  html += '<div class="detail-section-title">被紹介者（卒業者）</div>';
  html += '<div class="detail-row"><div class="detail-label">お名前</div><div class="detail-value">'+escapeHtml(c.referee_nickname || '?')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(c.referee_member_id || '—')+'</div></div>';

  // 振込先口座
  html += '<div class="detail-section-title">振込先口座</div>';
  if(isPaid && c.bank_snapshot){
    // 振込時のスナップショットを表示
    const bs = c.bank_snapshot;
    html += '<div class="bank-info-card">';
    html += '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:6px">※ 振込時点の口座情報スナップショット</div>';
    html += '<div class="bank-info-row"><span class="lbl">銀行</span><span class="val">'+escapeHtml(bs.bank_name || '')+' '+escapeHtml(bs.bank_branch || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">種別</span><span class="val">'+escapeHtml(bs.bank_account_type || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">口座番号</span><span class="val mono">'+escapeHtml(bs.bank_account_number || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">名義人</span><span class="val">'+escapeHtml(bs.bank_account_holder || '')+'</span></div>';
    html += '</div>';
  }else if(bankReg){
    html += '<div class="bank-info-card">';
    html += '<div class="bank-info-row"><span class="lbl">銀行</span><span class="val">'+escapeHtml(profile.bank_name)+' '+escapeHtml(profile.bank_branch || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">種別</span><span class="val">'+escapeHtml(profile.bank_account_type || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">口座番号</span><span class="val mono">'+escapeHtml(profile.bank_account_number || '')+'</span></div>';
    html += '<div class="bank-info-row"><span class="lbl">名義人</span><span class="val">'+escapeHtml(profile.bank_account_holder || '')+'</span></div>';
    html += '</div>';
  }else{
    html += '<div class="bank-not-registered">';
    html += '<div class="label">⚠️ 紹介者がまだ口座情報を登録していません</div>';
    html += '<div>紹介者のプロフィール画面に「+ 口座情報を追加」ボタンが表示されています。登録後、このページで振込操作が可能になります。</div>';
    html += '</div>';
  }

  // アクションボタン
  if(!isPaid){
    if(bankReg){
      html += '<div class="action-buttons"><button class="btn-action approve" onclick="openCashbackPay()">振込完了をマークする</button></div>';
    }else{
      html += '<div class="action-buttons"><button class="btn-action" disabled style="background:var(--bg-secondary);color:var(--text-tertiary);cursor:not-allowed">振込完了をマークする（口座登録待ち）</button></div>';
    }
  }

  document.getElementById('cashback-detail-body').innerHTML = html;
  document.getElementById('cashback-detail-modal').classList.add('show');
}

function closeCashbackDetail(){
  document.getElementById('cashback-detail-modal').classList.remove('show');
  openCashback = null;
}

// ===== 振込完了マーク =====
function openCashbackPay(){
  if(!openCashback) return;
  const c = openCashback;
  const profile = c.referrer_profile;
  document.getElementById('cb-pay-error').textContent = '';
  document.getElementById('cb-pay-confirm-btn').disabled = false;
  document.getElementById('cb-pay-confirm-btn').textContent = '振込完了として記録する';
  let summaryHtml = '';
  summaryHtml += '<div class="detail-row"><div class="detail-label">受取人</div><div class="detail-value">'+escapeHtml(c.referrer_nickname || '?')+'さん（'+escapeHtml(c.referrer_member_id || '')+'）</div></div>';
  summaryHtml += '<div class="detail-row"><div class="detail-label">金額</div><div class="detail-value" style="font-family:\'Noto Serif JP\',serif;font-size:16px;font-weight:700;color:var(--gold)">¥'+(c.amount || 0).toLocaleString()+'</div></div>';
  if(profile){
    summaryHtml += '<div class="detail-row"><div class="detail-label">振込先</div><div class="detail-value">'+escapeHtml(profile.bank_name || '')+' '+escapeHtml(profile.bank_branch || '')+' / '+escapeHtml(profile.bank_account_type || '')+' '+escapeHtml(profile.bank_account_number || '')+' / '+escapeHtml(profile.bank_account_holder || '')+'</div></div>';
  }
  document.getElementById('cashback-pay-summary').innerHTML = summaryHtml;
  document.getElementById('cashback-pay-modal').classList.add('show');
}

function closeCashbackPay(){
  document.getElementById('cashback-pay-modal').classList.remove('show');
}

async function confirmCashbackPaid(){
  if(!guardEdit()) return;
  if(!openCashback) return;
  const c = openCashback;
  const profile = c.referrer_profile;
  if(!hasBank(profile)){ document.getElementById('cb-pay-error').textContent = '口座情報が登録されていません'; return; }
  const btn = document.getElementById('cb-pay-confirm-btn');
  btn.disabled = true; btn.textContent = '処理中...';
  try{
    const snapshot = {
      bank_name: profile.bank_name,
      bank_branch: profile.bank_branch,
      bank_account_type: profile.bank_account_type,
      bank_account_number: profile.bank_account_number,
      bank_account_holder: profile.bank_account_holder
    };
    const { error } = await supa.from('cashbacks').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: currentAdmin.id,
      bank_snapshot: snapshot
    }).eq('id', c.id);
    if(error){
      document.getElementById('cb-pay-error').textContent = '更新に失敗しました：'+error.message;
      btn.disabled = false; btn.textContent = '振込完了として記録する';
      return;
    }
    // 紹介者へ運営チャットで完了通知
    await supa.from('contacts').insert({
      user_id: c.referrer_id,
      member_id: c.referrer_member_id,
      nickname: c.referrer_nickname,
      contact_type: '運営通知',
      body: '🎉 キャッシュバックの振込が完了いたしました！\n金額：¥'+(c.amount || 0).toLocaleString()+'\n振込先：'+(profile.bank_name||'')+' '+(profile.bank_branch||'')+'\n\nご紹介ありがとうございました。今後ともどうぞよろしくお願いいたします。',
      status: 'replied'
    });
    closeCashbackPay();
    closeCashbackDetail();
    await loadCashbacks();
  }catch(e){
    console.log('cashback paid error:', e);
    document.getElementById('cb-pay-error').textContent = 'エラーが発生しました';
    btn.disabled = false; btn.textContent = '振込完了として記録する';
  }
}

// ===== 公式アナウンス（全体送信） =====
async function loadAnnouncements(){
  const list = document.getElementById('announcements-list');
  if(!list) return;
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('announcements').select('*').order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allAnnouncements = data || [];
    renderAnnouncements();
  }catch(e){
    console.log('announcements load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

function renderAnnouncements(){
  const list = document.getElementById('announcements-list');
  if(!list) return;
  if(allAnnouncements.length === 0){
    list.innerHTML = '<div class="empty-state">まだアナウンスはありません。</div>';
    return;
  }
  let html = '';
  allAnnouncements.forEach(a => {
    html += '<div class="ann-row">';
    html += '<div class="ann-icon">📣</div>';
    html += '<div class="ann-content">';
    if(a.title) html += '<div class="ann-title-display">'+escapeHtml(a.title)+'</div>';
    html += '<div class="ann-body-display">'+escapeHtml(a.body || '')+'</div>';
    html += '<div class="ann-meta">'+formatDateTime(a.created_at)+'</div>';
    html += '</div>';
    html += '<button class="ann-delete-btn" onclick="deleteAnnouncement(\''+a.id+'\')">削除</button>';
    html += '</div>';
  });
  list.innerHTML = html;
}

/** 全体アナウンスを送信 + 全ユーザーに Push */
async function sendAnnouncement(){
  if(!guardEdit()) return;
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  const errEl = document.getElementById('ann-error');
  const okEl = document.getElementById('ann-success');
  errEl.textContent = '';
  okEl.style.display = 'none';
  if(!body){ errEl.textContent = '本文は必須です'; return; }
  if(!confirm('全ユーザーへアナウンスを送信します。よろしいですか？')) return;
  const btn = document.getElementById('ann-submit-btn');
  btn.disabled = true; btn.textContent = '送信中...';
  try{
    const { error } = await supa.from('announcements').insert({
      title: title || null,
      body: body,
      created_by: currentAdmin.id
    });
    if(error){
      errEl.textContent = '送信に失敗しました：' + error.message;
      btn.disabled = false; btn.textContent = '📣 全員に送信する';
      return;
    }
    okEl.style.display = 'block';
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-body').value = '';
    btn.disabled = false; btn.textContent = '📣 全員に送信する';
    // 全員に Push 通知（broadcast）
    sendPushNotification(supa, {
      broadcast: true,
      title: title ? '📢 ' + title : '📢 縁の間からのお知らせ',
      body: body.substring(0, 100),
      url: './#msg',
      tag: 'announcement',
    });
    await loadAnnouncements();
    setTimeout(() => { okEl.style.display = 'none'; }, 2500);
  }catch(e){
    console.log('send announcement error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false; btn.textContent = '📣 全員に送信する';
  }
}

/** アナウンスを削除 @param {string} id */
async function deleteAnnouncement(id){
  if(!guardEdit()) return;
  if(!confirm('このアナウンスを削除しますか？\nすでにユーザーが受け取ったアナウンスは、ユーザー側のチャットからも消えます。')) return;
  try{
    const { error } = await supa.from('announcements').delete().eq('id', id);
    if(error){ alert('削除に失敗しました：' + error.message); return; }
    await loadAnnouncements();
  }catch(e){
    console.log('delete announcement error:', e);
    alert('エラーが発生しました');
  }
}

// ===== 個別メッセージ送信（ユーザー詳細 → メッセージを送る） =====
function openDirectMsg(){
  if(!openUser) return;
  directMsgTargetUser = openUser;
  document.getElementById('dm-target-name').textContent = (openUser.nickname || '名無し') + 'さん（' + (openUser.member_id || '—') + '）';
  document.getElementById('dm-body').value = '';
  document.getElementById('dm-error').textContent = '';
  document.getElementById('dm-success').style.display = 'none';
  document.getElementById('dm-send-btn').disabled = false;
  document.getElementById('dm-send-btn').textContent = '送信する';
  // ユーザー詳細を一時的に閉じてメッセージモーダルを開く
  document.getElementById('user-detail-modal').classList.remove('show');
  document.getElementById('direct-msg-modal').classList.add('show');
}

function closeDirectMsg(){
  document.getElementById('direct-msg-modal').classList.remove('show');
  // ユーザー詳細を再表示
  if(directMsgTargetUser){
    document.getElementById('user-detail-modal').classList.add('show');
  }
  directMsgTargetUser = null;
}

/** 個別の公式メッセージを送信 */
async function confirmDirectMsg(){
  if(!guardEdit()) return;
  if(!directMsgTargetUser) return;
  const body = document.getElementById('dm-body').value.trim();
  const errEl = document.getElementById('dm-error');
  const okEl = document.getElementById('dm-success');
  errEl.textContent = '';
  okEl.style.display = 'none';
  if(!body){ errEl.textContent = '本文を入力してください'; return; }
  const btn = document.getElementById('dm-send-btn');
  btn.disabled = true; btn.textContent = '送信中...';
  try{
    const u = directMsgTargetUser;
    const { error } = await supa.from('contacts').insert({
      user_id: u.id,
      member_id: u.member_id,
      nickname: u.nickname,
      contact_type: '運営通知',
      body: body,
      status: 'replied'
    });
    if(error){
      errEl.textContent = '送信に失敗しました：' + error.message;
      btn.disabled = false; btn.textContent = '送信する';
      return;
    }
    okEl.style.display = 'block';
    btn.disabled = false; btn.textContent = '送信する';
    setTimeout(() => { closeDirectMsg(); }, 1200);
  }catch(e){
    console.log('direct msg send error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false; btn.textContent = '送信する';
  }
}

// ===== ダッシュボード =====
/** ダッシュボード全体を再集計 + グラフ描画 + nav バッジ更新 */
async function loadDashboard(){
  const body = document.getElementById('dashboard-body');
  if(!body) return;
  body.innerHTML = '<div class="dash-loading">集計中…</div>';
  try{
    const [profilesRes, matchesRes, sotsugyouRes, cashbacksRes, bookingsRes, contactsRes, reportsRes, announcementsRes, dmsRes, dmReviewsRes] = await Promise.all([
      supa.from('profiles').select('id,sex,banned_at,plan,created_at'),
      supa.from('matches').select('status,created_at'),
      supa.from('sotsugyou_requests').select('user_id,partner_user_id,status'),
      supa.from('cashbacks').select('status,amount'),
      supa.from('bookings').select('status,scheduled_date'),
      supa.from('contacts').select('status,contact_type'),
      supa.from('reports').select('status'),
      supa.from('announcements').select('id'),
      supa.from('messages').select('id,body').limit(2000),
      supa.from('message_mod_reviews').select('message_id'),
    ]);

    const profiles = profilesRes.data || [];
    const matches = matchesRes.data || [];
    const sotsugyou = sotsugyouRes.data || [];
    const cashbacks = cashbacksRes.data || [];
    const bookings = bookingsRes.data || [];
    const contacts = contactsRes.data || [];
    const reports = reportsRes.data || [];
    const announcements = announcementsRes.data || [];

    // ===== 集計 =====
    const totalUsers = profiles.length;
    const activeUsers = profiles.filter(p => !p.banned_at).length;
    const bannedUsers = profiles.filter(p => !!p.banned_at).length;
    const maleUsers = profiles.filter(p => p.sex === '男性' && !p.banned_at).length;
    const femaleUsers = profiles.filter(p => p.sex === '女性' && !p.banned_at).length;
    const otherUsers = profiles.filter(p => p.sex && p.sex !== '男性' && p.sex !== '女性' && !p.banned_at).length;

    // プラン別ユーザー数（利用中のみ集計、profile.plan の値: 'trial' / 'no_matching' / 'total'）
    const trialUsers = profiles.filter(p => !p.banned_at && p.plan === 'trial').length;
    const noMatchingUsers = profiles.filter(p => !p.banned_at && p.plan === 'no_matching').length;
    const totalPlanUsers = profiles.filter(p => !p.banned_at && p.plan === 'total').length;

    const totalMatches = matches.length;
    const activeConnections = matches.filter(m => ['matched','chatting','date_set','reviewed'].includes(m.status)).length;
    const coupledCount = matches.filter(m => m.status === 'coupled').length;

    // 卒業申請ペア集計（user_id < partner_user_id を canonical とし、両方 approved を1ペアとする）
    const sgPairs = {};
    sotsugyou.forEach(r => {
      const key = r.user_id < r.partner_user_id ? r.user_id+'|'+r.partner_user_id : r.partner_user_id+'|'+r.user_id;
      if(!sgPairs[key]) sgPairs[key] = { a:null, b:null };
      if(r.user_id < r.partner_user_id) sgPairs[key].a = r;
      else sgPairs[key].b = r;
    });
    let approvedPairs = 0, awaitingApproval = 0, oneSidedOnly = 0;
    Object.values(sgPairs).forEach(p => {
      if(p.a && p.b){
        if(p.a.status === 'approved' && p.b.status === 'approved') approvedPairs++;
        else if(p.a.status === 'pending' && p.b.status === 'pending') awaitingApproval++;
      }else{
        if((p.a && p.a.status === 'pending') || (p.b && p.b.status === 'pending')) oneSidedOnly++;
      }
    });

    const cbEligible = cashbacks.filter(c => c.status === 'eligible');
    const cbPaid = cashbacks.filter(c => c.status === 'paid');
    const cbEligibleAmount = cbEligible.reduce((s, c) => s + (c.amount || 0), 0);
    const cbPaidAmount = cbPaid.reduce((s, c) => s + (c.amount || 0), 0);

    const today = new Date();
    const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const upcomingBookings = bookings.filter(b => b.scheduled_date >= todayKey && b.status !== 'cancelled').length;
    const pastBookings = bookings.filter(b => b.scheduled_date < todayKey && b.status !== 'cancelled').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending' && b.scheduled_date >= todayKey).length;

    const openContacts = contacts.filter(c => c.status === 'open' && c.contact_type !== 'メッセージ' && c.contact_type !== '運営返信').length;
    const openMessages = contacts.filter(c => c.status === 'open' && c.contact_type === 'メッセージ').length;
    const openReports = reports.filter(r => r.status === 'open').length;
    const totalAnnouncements = announcements.length;

    // DM 違反疑い未対応カウント
    const reviewedIds = new Set(((dmReviewsRes && dmReviewsRes.data) || []).map(r => r.message_id));
    const dmFlaggedUnreviewed = ((dmsRes && dmsRes.data) || []).filter(m => {
      if(reviewedIds.has(m.id)) return false;
      return detectProhibitedContent(m.body || '').length > 0;
    }).length;

    // ===== 描画 =====
    let html = '';

    // ▼ 要対応サマリー（クリックでセクション遷移）
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ 要対応の項目</div>';
    html += '<div class="dash-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">';
    html += pendingItem('問い合わせ未対応', openContacts, 'contacts');
    html += pendingItem('メッセージ未対応', openMessages, 'messages');
    html += pendingItem('DM 違反疑い', dmFlaggedUnreviewed, 'dms');
    html += pendingItem('通報未対応', openReports, 'reports');
    html += pendingItem('卒業申請 承認待ち', awaitingApproval+'ペア', 'sotsugyou', awaitingApproval > 0);
    html += pendingItem('予約 受付中（未確定）', pendingBookings, 'bookings');
    html += pendingItem('キャッシュバック振込待ち', cbEligible.length, 'cashbacks');
    html += '</div>';
    html += '</div>';

    // ▼ プラン別件数（利用中ユーザーの plan 値で集計）
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ プラン別 件数</div>';
    html += '<div class="dash-grid">';
    html += dashCard('お試しプラン', trialUsers, '人 / 利用中', 'gray');
    html += dashCard('NOマッチングプラン', noMatchingUsers, '人 / 利用中', 'gray');
    html += dashCard('トータルプラン', totalPlanUsers, '人 / 利用中', 'gold');
    html += dashCard('卒業鑑定プラン', approvedPairs, 'カップル / 承認済', 'green');
    html += '</div>';
    html += '</div>';

    // ▼ ユーザー
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ ユーザー</div>';
    html += '<div class="dash-grid">';
    html += dashCard('登録ユーザー（合計）', totalUsers, '', '');
    html += dashCard('利用中', activeUsers, '', 'green');
    html += dashCard('退会処分中', bannedUsers, '', bannedUsers > 0 ? 'red' : 'gray');
    html += dashCard('男性 / 女性', maleUsers + ' / ' + femaleUsers, otherUsers > 0 ? 'その他: ' + otherUsers : '', '');
    html += '</div>';
    html += '</div>';

    // ▼ マッチング
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ マッチング・カップル</div>';
    html += '<div class="dash-grid">';
    html += dashCard('累計マッチング申請', totalMatches, '', '');
    html += dashCard('やり取り中・関係継続中', activeConnections, '', 'gold');
    html += dashCard('カップル成立中', coupledCount, '', 'green');
    html += dashCard('卒業承認済（カップル）', approvedPairs, '', 'green');
    html += '</div>';
    html += '</div>';

    // ▼ キャッシュバック
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ キャッシュバック</div>';
    html += '<div class="dash-grid">';
    html += dashCard('振込待ち', '¥' + cbEligibleAmount.toLocaleString(), cbEligible.length + '件', 'gold');
    html += dashCard('振込済', '¥' + cbPaidAmount.toLocaleString(), cbPaid.length + '件', 'green');
    html += '</div>';
    html += '</div>';

    // ▼ 予約
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ 鑑定予約</div>';
    html += '<div class="dash-grid">';
    html += dashCard('これからの予約', upcomingBookings, '件', 'gold');
    html += dashCard('過去の鑑定（実施済）', pastBookings, '件', '');
    html += '</div>';
    html += '</div>';

    // ▼ 運営アナウンス
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ 運営アナウンス</div>';
    html += '<div class="dash-grid">';
    html += dashCard('累計アナウンス送信数', totalAnnouncements, '件', '');
    html += '</div>';
    html += '</div>';

    // ▼ Web Push テスト
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ Web Push 通知</div>';
    html += '<div style="background:var(--bg-primary);border:0.5px solid var(--border);border-radius:10px;padding:1rem 1.1rem">';
    html += '  <div style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-bottom:.6rem">登録済みユーザー全員にテスト通知を送信します。Supabase の Edge Function (send-push) と VAPID キー設定が必要です。</div>';
    html += '  <button class="btn-text" onclick="sendTestPush()">📡 全ユーザーにテスト Push を送信</button>';
    html += '</div>';
    html += '</div>';

    // ▼ 統計グラフセクション
    html += '<div class="dash-section">';
    html += '<div class="dash-section-title">▼ 統計</div>';
    html += '<div class="chart-grid">';
    html += '  <div class="chart-card chart-card-wide">';
    html += '    <div class="chart-title">登録ユーザー推移（過去6ヶ月）</div>';
    html += '    <div class="chart-wrap"><canvas id="chart-signups"></canvas></div>';
    html += '  </div>';
    html += '  <div class="chart-card">';
    html += '    <div class="chart-title">プラン構成（利用中ユーザー）</div>';
    html += '    <div class="chart-wrap"><canvas id="chart-plans"></canvas></div>';
    html += '  </div>';
    html += '  <div class="chart-card chart-card-wide">';
    html += '    <div class="chart-title">マッチング転換ファネル</div>';
    html += '    <div class="chart-wrap"><canvas id="chart-funnel"></canvas></div>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';

    body.innerHTML = html;

    // nav の各バッジを未対応数で更新
    updateNavBadge('contacts', openContacts);
    updateNavBadge('messages', openMessages);
    updateNavBadge('dms', dmFlaggedUnreviewed);
    updateNavBadge('reports', openReports);
    updateNavBadge('sotsugyou', awaitingApproval);
    updateNavBadge('bookings', pendingBookings);
    updateNavBadge('cashbacks', cbEligible.length);

    // ▼ グラフ描画（Chart.js が CDN から読まれていれば実行）
    renderDashboardCharts({
      profiles: profiles,
      matches: matches,
      sotsugyou: sotsugyou,
      trialUsers: trialUsers,
      noMatchingUsers: noMatchingUsers,
      totalPlanUsers: totalPlanUsers,
      approvedPairs: approvedPairs,
      activeConnections: activeConnections,
      coupledCount: coupledCount,
      totalMatches: totalMatches,
    });
  }catch(e){
    console.log('dashboard load exception:', e);
    body.innerHTML = '<div class="dash-loading" style="color:var(--red)">集計中にエラーが発生しました</div>';
  }
}

// ===== Chart.js: 統計グラフ描画 =====
// Chart instance を保持して再描画時に destroy → 再生成（メモリリーク防止）
let dashCharts = { signups: null, plans: null, funnel: null };

/** Chart.js でダッシュボードグラフ 3 枚を描画 */
function renderDashboardCharts(data){
  if(typeof Chart === 'undefined'){ console.log('[charts] Chart.js not loaded'); return; }

  // 既存 chart があれば破棄
  Object.values(dashCharts).forEach(function(c){ if(c) try{ c.destroy(); }catch(e){} });
  dashCharts = { signups: null, plans: null, funnel: null };

  // 共通カラー（縁の間ブランド）
  const COLOR_GOLD = '#C9A96E';
  const COLOR_GREEN = '#3a9a3a';
  const COLOR_RED = '#C05050';
  const COLOR_GRAY = '#999';

  // テキスト色：ダークモード対応
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const labelColor = isDark ? '#aaa' : '#555';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';

  Chart.defaults.color = labelColor;
  Chart.defaults.font.family = "'Noto Sans JP', sans-serif";

  // ===== 1) 登録ユーザー推移（過去6ヶ月） =====
  const signupsCanvas = document.getElementById('chart-signups');
  if(signupsCanvas){
    const now = new Date();
    const labels = [];
    const counts = [];
    for(let i = 5; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      labels.push(d.getFullYear() + '/' + (d.getMonth()+1) + '月');
      // この月に登録されたユーザー数
      const c = data.profiles.filter(function(p){
        if(!p.created_at) return false;
        const cd = new Date(p.created_at);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      counts.push(c);
    }
    dashCharts.signups = new Chart(signupsCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '新規登録',
          data: counts,
          borderColor: COLOR_GOLD,
          backgroundColor: 'rgba(201,169,110,.15)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: COLOR_GOLD,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: labelColor } },
          y: { beginAtZero: true, ticks: { color: labelColor, precision: 0 }, grid: { color: gridColor } },
        },
      },
    });
  }

  // ===== 2) プラン構成（ドーナツ） =====
  const plansCanvas = document.getElementById('chart-plans');
  if(plansCanvas){
    dashCharts.plans = new Chart(plansCanvas, {
      type: 'doughnut',
      data: {
        labels: ['お試し', 'NOマッチング', 'トータル', '卒業鑑定'],
        datasets: [{
          data: [data.trialUsers, data.noMatchingUsers, data.totalPlanUsers, data.approvedPairs],
          backgroundColor: ['#bbb', '#d4940a', COLOR_GOLD, COLOR_GREEN],
          borderWidth: 2,
          borderColor: isDark ? '#1a1a1a' : '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: labelColor, padding: 12, font: { size: 11 } } },
        },
        cutout: '60%',
      },
    });
  }

  // ===== 3) マッチング転換ファネル =====
  const funnelCanvas = document.getElementById('chart-funnel');
  if(funnelCanvas){
    // matches を status 別に集計
    const matched = data.matches.filter(function(m){
      return ['matched','chatting','date_set','dated','coupled','reviewed'].indexOf(m.status) >= 0;
    }).length;
    const dateSet = data.matches.filter(function(m){
      return ['date_set','dated','coupled','reviewed'].indexOf(m.status) >= 0;
    }).length;
    const coupled = data.coupledCount;
    const graduated = data.approvedPairs;

    dashCharts.funnel = new Chart(funnelCanvas, {
      type: 'bar',
      data: {
        labels: ['累計申請', 'マッチ成立', 'デート決定', 'カップル', '卒業'],
        datasets: [{
          label: '件数',
          data: [data.totalMatches, matched, dateSet, coupled, graduated],
          backgroundColor: [
            'rgba(201,169,110,.35)',
            'rgba(201,169,110,.55)',
            'rgba(212,148,10,.7)',
            'rgba(192,80,80,.7)',
            'rgba(58,154,58,.85)',
          ],
          borderColor: [COLOR_GOLD, COLOR_GOLD, '#d4940a', COLOR_RED, COLOR_GREEN],
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: labelColor, precision: 0 }, grid: { color: gridColor } },
          y: { ticks: { color: labelColor }, grid: { display: false } },
        },
      },
    });
  }
}

// Web Push: テスト送信（管理画面ダッシュボードのボタンから）
/** 管理画面のテスト Push 送信ボタン用 */
async function sendTestPush(){
  if(!confirm('全ユーザー（通知購読済み）にテスト Push を送信します。よろしいですか？')) return;
  const res = await sendPushNotification(supa, {
    broadcast: true,
    title: '📡 縁の間 テスト通知',
    body: 'これはテスト送信です。届きましたか？',
    url: './',
    tag: 'test-push',
  });
  if(res.ok){
    alert('✓ 送信しました\n配信:' + (res.sent||0) + ' / 失敗:' + (res.failed||0) + ' / 失効:' + (res.expired||0));
  }else{
    alert('送信に失敗しました：' + (res.error || '不明なエラー'));
  }
}

// nav バッジの数値と表示を更新（0 なら非表示）
/** nav タブの未対応バッジ更新 */
function updateNavBadge(section, count){
  const el = document.getElementById('nav-badge-' + section);
  if(!el) return;
  el.textContent = count;
  el.classList.toggle('zero', !count);
}

function dashCard(label, value, sub, colorClass){
  const cls = 'dash-card' + (colorClass ? ' ' + colorClass : '');
  let html = '<div class="'+cls+'">';
  html += '<div class="dash-card-label">'+escapeHtml(label)+'</div>';
  html += '<div><span class="dash-card-value">'+escapeHtml(String(value))+'</span></div>';
  if(sub) html += '<div class="dash-card-sub">'+escapeHtml(sub)+'</div>';
  html += '</div>';
  return html;
}

function pendingItem(label, count, targetSection, hasItems){
  // count が文字列なら hasItems で判定、数値なら count > 0 で判定
  const isZero = (typeof count === 'number') ? count === 0 : !hasItems;
  const cls = 'dash-pending-card' + (isZero ? ' zero' : '');
  const onclick = isZero ? '' : ' onclick="showSection(\''+targetSection+'\')"';
  let html = '<div class="'+cls+'"'+onclick+'>';
  html += '<div class="dash-pending-label">'+escapeHtml(label)+'</div>';
  html += '<div class="dash-pending-count">'+(typeof count === 'number' ? count + '件' : count)+'</div>';
  html += '</div>';
  return html;
}

// ===== グローバルイベント =====
document.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none'){
    if(document.activeElement && document.activeElement.tagName === 'INPUT'){
      adminLogin();
    }
  }
});

// ===== 起動 =====
checkAdminSession();
