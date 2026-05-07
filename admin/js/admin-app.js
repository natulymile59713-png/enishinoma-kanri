// ===== 縁の間 管理画面 =====
// Supabase: ユーザーアプリと同じプロジェクトを参照
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'enishinoma-admin' } });

// ===== State =====
let currentAdmin = null;
let allContacts = [];
let currentFilter = 'open';
let openContact = null;
// ユーザー管理用
let allUsers = [];
let userStatusFilter = 'active';
let userSearchText = '';
let openUser = null;
// 四柱推命表示用テーブル（ユーザーアプリと同じ）
const ADMIN_KAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ADMIN_SHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ADMIN_PL = ['年柱','月柱','日柱','時柱'];

// ===== ユーティリティ =====
function escapeHtml(s){
  if(s==null)return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatDateTime(iso){
  if(!iso)return '';
  const d = new Date(iso);
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  const h=String(d.getHours()).padStart(2,'0'), mn=String(d.getMinutes()).padStart(2,'0');
  return `${y}/${m}/${day} ${h}:${mn}`;
}
function formatRelative(iso){
  if(!iso)return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if(diff < 60) return 'たった今';
  if(diff < 3600) return Math.floor(diff/60) + '分前';
  if(diff < 86400) return Math.floor(diff/3600) + '時間前';
  if(diff < 86400*7) return Math.floor(diff/86400) + '日前';
  return formatDateTime(iso);
}

// ===== 画面切替 =====
function showLogin(){
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}
function showDashboard(){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}
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
}

// ===== 認証 =====
async function checkAdminSession(){
  try{
    const { data: { session } } = await supa.auth.getSession();
    if(!session){ showLogin(); return; }
    const { data: profile, error } = await supa.from('profiles').select('is_admin, nickname').eq('id', session.user.id).single();
    if(error || !profile || !profile.is_admin){
      await supa.auth.signOut();
      showLogin();
      document.getElementById('login-error').textContent = 'このアカウントは管理者権限がありません。';
      return;
    }
    currentAdmin = session.user;
    document.getElementById('admin-email').textContent = session.user.email || '';
    showDashboard();
    loadContacts();
  }catch(e){
    console.log('session check error:', e);
    showLogin();
  }
}

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
    const { data: profile, error: profErr } = await supa.from('profiles').select('is_admin').eq('id', data.user.id).single();
    if(profErr || !profile || !profile.is_admin){
      errEl.textContent = 'このアカウントは管理者権限がありません。';
      await supa.auth.signOut();
      return;
    }
    currentAdmin = data.user;
    document.getElementById('admin-email').textContent = data.user.email || '';
    showDashboard();
    loadContacts();
  }catch(e){
    console.log('login error:', e);
    errEl.textContent = 'エラーが発生しました';
  }
}

async function adminLogout(){
  if(!confirm('ログアウトしますか？')) return;
  try{ await supa.auth.signOut(); }catch(e){ console.log('logout error:', e); }
  currentAdmin = null;
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  showLogin();
}

// ===== 問い合わせ一覧 =====
async function loadContacts(){
  const list = document.getElementById('contacts-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('contacts').select('*').order('created_at', { ascending: false });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allContacts = data || [];
    updateCounts();
    renderContacts();
  }catch(e){
    console.log('contacts load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

function updateCounts(){
  const open = allContacts.filter(c => c.status === 'open').length;
  const replied = allContacts.filter(c => c.status === 'replied').length;
  document.getElementById('count-open').textContent = open;
  document.getElementById('count-replied').textContent = replied;
  document.getElementById('count-all').textContent = allContacts.length;
}

function filterContacts(filter){
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  renderContacts();
}

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
function openDetail(id){
  const c = allContacts.find(x => x.id === id);
  if(!c){ alert('問い合わせが見つかりません'); return; }
  openContact = c;

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

function closeDetail(){
  document.getElementById('contact-detail-modal').classList.remove('show');
  openContact = null;
}

async function sendReply(){
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

// ===== ユーザー一覧 =====
async function loadUsers(){
  const list = document.getElementById('users-list');
  list.innerHTML = '<div class="empty-state">読み込み中…</div>';
  try{
    const { data, error } = await supa.from('profiles').select('*').order('member_id', { ascending: true });
    if(error){
      list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みに失敗しました：'+escapeHtml(error.message)+'</div>';
      return;
    }
    allUsers = data || [];
    updateUserCounts();
    renderUsers();
  }catch(e){
    console.log('users load exception:', e);
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">読み込みエラー</div>';
  }
}

function updateUserCounts(){
  const active = allUsers.filter(u => !u.banned_at).length;
  const banned = allUsers.filter(u => !!u.banned_at).length;
  document.getElementById('ucount-active').textContent = active;
  document.getElementById('ucount-banned').textContent = banned;
  document.getElementById('ucount-all').textContent = allUsers.length;
}

function filterUsersByStatus(filter){
  userStatusFilter = filter;
  document.querySelectorAll('[data-userfilter]').forEach(t => {
    t.classList.toggle('active', t.dataset.userfilter === filter);
  });
  renderUsers();
}

function filterUsers(){
  userSearchText = document.getElementById('user-search').value.trim().toLowerCase();
  renderUsers();
}

function renderUsers(){
  const list = document.getElementById('users-list');
  let filtered = allUsers;
  // ステータス絞り込み
  if(userStatusFilter === 'active') filtered = filtered.filter(u => !u.banned_at);
  else if(userStatusFilter === 'banned') filtered = filtered.filter(u => !!u.banned_at);
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
  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-state">該当するユーザーはいません。</div>';
    return;
  }
  let html = '';
  filtered.forEach(u => {
    const banned = !!u.banned_at;
    const initial = (u.nickname || '?').charAt(0);
    const age = u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '';
    const meta = [age, u.sex, u.prefecture].filter(Boolean).join('・');
    const statusBadge = banned
      ? '<span class="user-status-badge banned">退会済</span>'
      : '<span class="user-status-badge active">利用中</span>';
    html += '<div class="user-row'+(banned?' banned':'')+'" onclick="openUserDetail(\''+u.id+'\')">';
    html += '<div class="user-avatar">'+escapeHtml(initial)+'</div>';
    html += '<div class="user-info">';
    html += '<div class="user-line1">';
    html += '<span class="user-name">'+escapeHtml(u.nickname || '名無し')+'さん</span>';
    html += '<span class="user-id">'+escapeHtml(u.member_id || '')+'</span>';
    html += '</div>';
    html += '<div class="user-line2">';
    if(meta) html += '<span>'+escapeHtml(meta)+'</span>';
    if(u.phone_number) html += '<span>📱 '+escapeHtml(u.phone_number)+'</span>';
    html += '</div>';
    html += '</div>';
    html += statusBadge;
    html += '</div>';
  });
  list.innerHTML = html;
}

// ===== ユーザー詳細 =====
function openUserDetail(id){
  const u = allUsers.find(x => x.id === id);
  if(!u){ alert('ユーザーが見つかりません'); return; }
  openUser = u;
  const banned = !!u.banned_at;
  const age = u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '—';
  const birthTime = (u.birth_hour != null) ? u.birth_hour + '時' + (u.birth_min != null ? String(u.birth_min).padStart(2,'0') : '00') + '分' : '未設定';
  const birthLoc = u.birth_pref ? (u.birth_pref + (u.birth_city ? ' ' + u.birth_city : '')) : '未設定';

  let html = '';
  // ステータス
  if(banned){
    html += '<div class="banned-info-box">';
    html += '<div class="banned-info-label">● 退会処分済み</div>';
    html += '<div>処分日時：'+formatDateTime(u.banned_at)+'</div>';
    html += '<div style="margin-top:6px">理由：'+escapeHtml(u.banned_reason || '（記載なし）')+'</div>';
    html += '</div>';
  }
  // 基本情報
  html += '<div class="detail-section-title">基本情報</div>';
  html += '<div class="detail-row"><div class="detail-label">ニックネーム</div><div class="detail-value">'+escapeHtml(u.nickname || '名無し')+'さん</div></div>';
  html += '<div class="detail-row"><div class="detail-label">会員ID</div><div class="detail-value mono">'+escapeHtml(u.member_id || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">性別</div><div class="detail-value">'+escapeHtml(u.sex || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">電話番号</div><div class="detail-value">'+escapeHtml(u.phone_number || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">居住地</div><div class="detail-value">'+escapeHtml(u.prefecture || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">結婚歴</div><div class="detail-value">'+escapeHtml(u.marriage || '—')+'</div></div>';
  html += '<div class="detail-row"><div class="detail-label">連れ子</div><div class="detail-value">'+escapeHtml(u.children || '—')+'</div></div>';
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
  if(banned){
    html += '<button class="btn-secondary" onclick="unbanUser()">退会処分を解除する</button>';
  }else{
    html += '<button class="btn-danger" onclick="openBanModal()">退会処分にする</button>';
  }

  document.getElementById('user-detail-body').innerHTML = html;
  document.getElementById('user-detail-modal').classList.add('show');
}

function closeUserDetail(){
  document.getElementById('user-detail-modal').classList.remove('show');
  openUser = null;
}

// ===== BAN / 解除 =====
function openBanModal(){
  if(!openUser) return;
  document.getElementById('ban-modal-title').textContent = '退会処分';
  document.getElementById('ban-target-name').textContent = (openUser.nickname || '名無し') + 'さん（' + (openUser.member_id || '—') + '）';
  document.getElementById('ban-reason').value = '';
  document.getElementById('ban-error').textContent = '';
  document.getElementById('ban-confirm-btn').textContent = '退会処分を実行する';
  document.getElementById('ban-confirm-btn').disabled = false;
  document.getElementById('ban-modal').classList.add('show');
}

function closeBanModal(){
  document.getElementById('ban-modal').classList.remove('show');
}

async function confirmBan(){
  if(!openUser) return;
  const reason = document.getElementById('ban-reason').value.trim();
  const errEl = document.getElementById('ban-error');
  errEl.textContent = '';
  if(!reason){ errEl.textContent = '退会理由は必須です'; return; }
  const btn = document.getElementById('ban-confirm-btn');
  btn.disabled = true;
  btn.textContent = '処理中...';
  try{
    const { error } = await supa.from('profiles').update({
      banned_at: new Date().toISOString(),
      banned_reason: reason,
      banned_by: currentAdmin.id
    }).eq('id', openUser.id);
    if(error){
      errEl.textContent = '保存に失敗しました：' + error.message;
      btn.disabled = false;
      btn.textContent = '退会処分を実行する';
      return;
    }
    closeBanModal();
    closeUserDetail();
    await loadUsers();
  }catch(e){
    console.log('ban error:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = '退会処分を実行する';
  }
}

async function unbanUser(){
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
