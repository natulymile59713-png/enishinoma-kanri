// ===== アプリ初期化・タブ切替・ログイン =====
// goTab(i) — i は意味的インデックス（0:推し / 1:縁リスト / 2:メッセージ / 3:その他）
// NOマッチングなどでDOMの並び順が変わってもタブは data-tab 属性で正しく識別される
/** タブ切替（0:推し / 1:縁リスト / 2:メッセージ / 3:その他） @param {number} i */
function goTab(i){
  if(!document.getElementById('s0'))return;
  var TAB_MAP = {0:'oshi', 1:'enlist', 2:'msg'};
  var targetTab = TAB_MAP[i] ? document.querySelector('.ntab[data-tab="'+TAB_MAP[i]+'"]') : null;
  document.querySelectorAll('.ntab').forEach(function(t){t.classList.remove('on');});
  if(targetTab) targetTab.classList.add('on');
  document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.toggle('on',i===3);});
  document.querySelectorAll('.screen').forEach(function(s,idx){s.classList.toggle('on',idx===i);});
  document.querySelectorAll('.bni').forEach(function(b,idx){b.classList.toggle('on',idx===i);});
  // 推しタブを開いたらゴールドポッチを消す(他のタブは独自ロジックで自動更新)
  if(i === 0 && typeof setOshiBadge === 'function') setOshiBadge(false);
}
/** プロフィールモーダルの表示切替 */
function toggleModal(){document.getElementById('profile-modal').classList.toggle('show');}

// ===== プロフィールモーダル表示の共通処理 =====
// 新規登録(completeReg)・自動ログイン(checkSession)・手動ログイン(doLogin) から呼ばれる。
// profile はDBの行（または同じ形のオブジェクト）。MY_PILLARS グローバル変数も更新する。
/** profile データを読み込んでプロフィールモーダルを描画 @param {object} profile */
function populateProfileModal(profile) {
  // 通知トグル切替時に再描画できるよう、最後に表示したプロフィールを保持
  window._profileModalData = profile;
  // 上部アイコン・モーダルアバター
  // avatar_url があれば <img> を表示、なければイニシャル文字に
  var nickInit = (profile.nickname||'').charAt(0);
  document.getElementById('topbar-initial').textContent = nickInit;
  document.getElementById('modal-ava-ph').textContent = nickInit;
  var topAva = document.getElementById('topbar-ava');
  var topInit = document.getElementById('topbar-initial');
  var modAva = document.getElementById('modal-ava-img');
  var modInit = document.getElementById('modal-ava-ph');
  if (profile.avatar_url) {
    if (topAva) { topAva.src = profile.avatar_url; topAva.style.display = 'block'; }
    if (topInit) topInit.style.display = 'none';
    if (modAva) { modAva.src = profile.avatar_url; modAva.style.display = 'block'; }
    if (modInit) modInit.style.display = 'none';
  } else {
    if (topAva) { topAva.src = ''; topAva.style.display = 'none'; }
    if (topInit) topInit.style.display = '';
    if (modAva) { modAva.src = ''; modAva.style.display = 'none'; }
    if (modInit) modInit.style.display = '';
  }
  // 会員ID・お問い合わせ欄の事前入力
  document.getElementById('modal-member-id').textContent = profile.member_id || '';
  document.getElementById('contact-id').value = profile.member_id || '';
  document.getElementById('contact-nick').value = profile.nickname || '';

  // 詳細行（modal-info）
  var birthTime = (profile.birth_hour != null)
    ? profile.birth_hour + '時' + (profile.birth_min != null ? String(profile.birth_min).padStart(2,'0') : '00') + '分'
    : '未設定';
  var birthLoc = profile.birth_pref ? (profile.birth_pref + (profile.birth_city ? ' ' + profile.birth_city : '')) : '未設定';
  var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+(profile.nickname||'')+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+(profile.sex||'')+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+(profile.prefecture||'')+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+profile.birth_year+'年'+profile.birth_month+'月'+profile.birth_day+'日</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">生まれた時刻</span><span class="modal-val">'+birthTime+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">出生地</span><span class="modal-val">'+birthLoc+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+(profile.marriage||'')+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+(profile.children||'')+'</span></div>';
  // カップル相手欄（state.js の enList を参照、coupled マッチ相手がいれば表示）
  // enList ロード前は空。loadEnList 後に refreshProfileCoupleSection() で更新される
  modalInfo += '<div id="profile-couple-section"></div>';
  modalInfo += '<div style="text-align:center;margin-top:10px"><button type="button" onclick="openBirthEdit()" style="font-size:11px;padding:6px 14px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">＋ 生まれの時刻・場所を編集</button></div>';

  // プロフィール文セクション
  modalInfo += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)"><div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">プロフィール文</div>';
  if(profile.profile_text){
    var ptEsc = escapeHtml(profile.profile_text);
    modalInfo += '<div style="font-size:12px;color:var(--color-text-primary);line-height:1.7;background:var(--color-background-secondary);border-radius:6px;padding:8px 10px;white-space:pre-wrap;word-break:break-word">'+ptEsc+'</div>';
  } else {
    modalInfo += '<div style="font-size:11px;color:var(--color-text-tertiary);background:var(--color-background-secondary);border-radius:6px;padding:8px 10px">未設定</div>';
  }
  modalInfo += '<div style="text-align:center;margin-top:8px"><button type="button" onclick="openProfileTextEdit()" style="font-size:11px;padding:6px 14px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">'+(profile.profile_text ? '✎ プロフィール文を編集' : '＋ プロフィール文を追加')+'</button></div></div>';

  // 興味のあるカテゴリーセクション（編集ボタン付き）
  modalInfo += '<div id="profile-interest-section" style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)"></div>';

  // 口座情報セクション（キャッシュバック対象 or 既に登録済み の時のみ表示）
  var cashbackKey = 'cashback_eligible_' + (currentUser ? currentUser.id : 'guest');
  var isEligibleLocal = localStorage.getItem(cashbackKey) === '1';
  var hasEligibleCashback = (typeof myCashbacks !== 'undefined' && myCashbacks)
    ? myCashbacks.some(function(c){return c.status === 'eligible';}) : false;
  var hasBank = !!profile.bank_name;
  if (isEligibleLocal || hasEligibleCashback || hasBank) {
    modalInfo += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)"><div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">キャッシュバック振込先口座</div>';
    if (hasBank) {
      var typeText = profile.bank_account_type || '普通';
      var numMask = profile.bank_account_number ? profile.bank_account_number.replace(/.(?=.{4})/g,'*') : '';
      modalInfo += '<div style="font-size:11px;color:var(--color-text-primary);line-height:1.7;background:var(--color-background-secondary);border-radius:6px;padding:7px 9px">'+
        (profile.bank_name||'')+' '+(profile.bank_branch||'')+'<br>'+
        typeText+' '+numMask+'<br>'+
        (profile.bank_account_holder||'')+'</div>';
      modalInfo += '<div style="text-align:center;margin-top:8px"><button type="button" onclick="openBankEdit()" style="font-size:11px;padding:6px 14px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">口座情報を変更</button></div>';
    } else {
      modalInfo += '<div style="font-size:11px;color:#C05050;background:rgba(192,80,80,.06);border-radius:6px;padding:7px 9px;line-height:1.7">未登録です。下のボタンから登録してください。</div>';
      modalInfo += '<div style="text-align:center;margin-top:8px"><button type="button" onclick="openBankEdit()" class="btn-gold" style="display:inline-block;width:auto;padding:8px 18px;font-size:12px;margin-bottom:0">＋ 口座情報を追加</button></div>';
    }
    modalInfo += '</div>';
  }

  // ===== 通知設定セクション =====
  // 通知は既定でON。ONのとき新着があるとロゴからツタが伸びてお知らせする。
  // OFFにすると、ページにポッチが付いてもツタは伸びない。
  var notifOn = (typeof isNotifEnabled === 'function') ? isNotifEnabled() : true;
  modalInfo += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  modalInfo += '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">通知設定</div>';
  if (notifOn) {
    modalInfo += '<div style="font-size:11px;color:#3a9a3a;background:rgba(58,154,58,.06);border-radius:6px;padding:7px 9px;line-height:1.7">🔔 通知ON：新着があるとロゴからツタが伸びてお知らせします</div>';
    modalInfo += '<div style="text-align:center;margin-top:8px"><button type="button" onclick="toggleNotifSetting()" style="font-size:11px;padding:6px 14px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;color:var(--color-text-secondary);background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">🔔 通知をオフにする</button></div>';
  } else {
    modalInfo += '<div style="font-size:11px;color:var(--color-text-tertiary);background:var(--color-background-secondary);border-radius:6px;padding:7px 9px;line-height:1.7">🔕 通知OFF：ページにポッチが付いてもツタは伸びません</div>';
    modalInfo += '<div style="text-align:center;margin-top:8px"><button type="button" onclick="toggleNotifSetting()" class="btn-gold" style="display:inline-block;width:auto;padding:8px 18px;font-size:12px;margin-bottom:0">🔔 通知をオンにする</button></div>';
  }
  modalInfo += '</div>';

  document.getElementById('modal-info').innerHTML = modalInfo;

  // 興味のあるカテゴリー表示を反映（編集ボタン付き）
  if(typeof refreshProfileInterestSection === 'function'){
    refreshProfileInterestSection(profile.interest_tags || null);
  }

  // 四柱（MY_PILLARS グローバル変数を更新 + modal-pillars 表示）
  // 時柱は null 許容（出生時刻不明）
  var hasHour = (profile.pillar_hour_k != null && profile.pillar_hour_s != null);
  MY_PILLARS = [
    {k: profile.pillar_year_k||0, s: profile.pillar_year_s||0},
    {k: profile.pillar_month_k||0, s: profile.pillar_month_s||0},
    {k: profile.pillar_day_k||0, s: profile.pillar_day_s||0},
    hasHour ? {k: profile.pillar_hour_k, s: profile.pillar_hour_s} : null
  ];
  var pillarHtml = '';
  MY_PILLARS.forEach(function(p, i) {
    var kan = p ? KAN[p.k] : '—';
    var shi = p ? SHI[p.s] : '—';
    pillarHtml += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+kan+'</div><div class="pc-mini-s">'+shi+'</div></div>';
  });
  document.getElementById('modal-pillars').innerHTML = pillarHtml;
}

// ===== app-wrapを表示する関数 =====
/** メインアプリ画面を表示（ポーリング + Realtime 起動） */
function showAppWrap() {
  if (document.getElementById('app-wrap')) {
    document.getElementById('app-wrap').style.display = 'block';
    document.getElementById('app-wrap').style.visibility = 'visible';
    document.getElementById('s0').classList.add('on');
    startPolling();
    startRealtime();
    return;
  }
  var template = document.getElementById('app-template');
  var shell = document.getElementById('shell');
  var clone = template.content.cloneNode(true);
  shell.appendChild(clone);
  document.getElementById('app-wrap').style.display = 'block';
  document.getElementById('app-wrap').style.visibility = 'visible';
  document.getElementById('s0').classList.add('on');
  startPolling();
  startRealtime();
}

// ===== キャッシュバック取得（自分が紹介者であるレコード） =====
/** 自分が紹介者として獲得したキャッシュバックを取得 */
async function loadMyCashbacks() {
  if (!currentUser) return;
  try {
    const { data, error } = await supa.from('cashbacks').select('*').eq('referrer_id', currentUser.id);
    if (error) { console.log('cashbacks load error:', error); return; }
    myCashbacks = data || [];
  } catch (e) {
    console.log('cashbacks load exception:', e);
  }
}

// ===== 自分の卒業認定ステータスを取得 =====
// profiles.graduated_at が NOT NULL なら認定済み。
// 「卒業生の間」サブメニューの可視性判定に使う。
// 注: sotsugyou_requests.status='approved' とは別。承認は申請の通過、認定は鑑定完了。
/** myIsGraduated を更新 */
async function loadMyGraduationStatus(){
  if(!currentUser){ myIsGraduated = false; return; }
  try{
    const { data, error } = await supa.from('profiles')
      .select('graduated_at').eq('id', currentUser.id).single();
    if(error){ console.log('graduation status load error:', error); return; }
    myIsGraduated = !!(data && data.graduated_at);
  }catch(e){ console.log('graduation status exception:', e); }
}

// ===== プロフィールモーダルのカップル相手セクション更新 =====
// enList を参照、status==='coupled' があれば「カップル相手」行を表示
/** プロフィールモーダルのカップル相手セクションを再描画 */
function refreshProfileCoupleSection(){
  var sec = document.getElementById('profile-couple-section');
  if(!sec) return;
  if(!Array.isArray(enList)){ sec.innerHTML = ''; return; }
  var couple = enList.find(function(e){ return e.status === 'coupled'; });
  if(!couple){ sec.innerHTML = ''; return; }
  var partnerLabel = (couple.name || '名無し') + (couple.memberId ? '（' + couple.memberId + '）' : '');
  sec.innerHTML = '<div class="modal-row"><span class="modal-lbl">カップル相手</span><span class="modal-val" style="color:#d6608b">💕 ' + (couple.name || '名無し').replace(/[<>&]/g, '') + '</span></div>';
}

// ===== 退会通知（処分 / 承認）モーダル =====
// 運営が退会処分 or 退会承認を実行すると contacts に '退会処分通知' / '退会承認通知' が INSERT される。
// Realtime sub と起動時チェックでこれを検知 → 全画面ポップアップ表示。
//   - 退会処分通知: 閉じる → 強制ログアウト → ログイン画面（以後ログイン不可）
//   - 退会承認通知: 閉じる → サービス継続使用可（24時間後ログイン不可）
var __withdrawalCurrentType = null;

/** 退会通知モーダルを開く @param {object} contactRow */
function showWithdrawalNoticeModal(contactRow){
  if(!contactRow) return;
  var isBan = (contactRow.contact_type === '退会処分通知');
  __withdrawalCurrentType = isBan ? 'banned' : 'approved';
  var title = isBan ? '🚫 運営からの重要なお知らせ' : '✅ 退会承認のお知らせ';
  var titleEl = document.getElementById('withdrawal-notice-title');
  var bodyEl = document.getElementById('withdrawal-notice-body');
  var overlay = document.getElementById('withdrawal-notice-overlay');
  if(titleEl) titleEl.textContent = title;
  if(bodyEl) bodyEl.textContent = contactRow.body || '';
  if(overlay) overlay.classList.add('show');
  // 表示済みフラグを localStorage に記録（次回起動時の再表示防止）
  try{
    if(currentUser){
      var key = 'withdrawal_notice_shown_' + currentUser.id + '_' + contactRow.id;
      localStorage.setItem(key, '1');
    }
  }catch(e){}
}

/** 退会通知モーダルを閉じる
 *  退会処分: 強制ログアウト → ログイン画面
 *  退会承認: そのままサービス継続使用可 */
async function closeWithdrawalNotice(){
  var overlay = document.getElementById('withdrawal-notice-overlay');
  if(overlay) overlay.classList.remove('show');
  if(__withdrawalCurrentType === 'banned'){
    try{ await supa.auth.signOut(); }catch(e){}
    try{ if(typeof stopRealtime === 'function') stopRealtime(); }catch(e){}
    currentUser = null;
    // 全画面を隠してログイン画面表示
    var ids = ['app-wrap','orient-wrap','reg-wrap'];
    ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
    var login = document.getElementById('login-wrap');
    if(login) login.style.display = 'flex';
  }
  __withdrawalCurrentType = null;
}

/** 退会状態に応じてログインを許可するか判定。
 *  - withdrawal_type='banned' → 常に拒否
 *  - withdrawal_type='approved' かつ banned_at から24時間経過 → 拒否
 *  - withdrawal_type='approved' かつ 24時間以内 → 許可（モーダルで通知表示）
 *  @returns {{allow:boolean, reason:string, isBan:boolean}} */
function evaluateWithdrawalAccess(profile){
  if(!profile || !profile.banned_at){ return { allow: true, reason: '', isBan: false }; }
  var wType = profile.withdrawal_type || 'banned';
  if(wType === 'banned'){
    return { allow: false, reason: 'このアカウントは退会処分されています。', isBan: true };
  }
  // approved → 24時間以内なら継続使用可
  var elapsedMs = Date.now() - new Date(profile.banned_at).getTime();
  var grace24h = 24 * 60 * 60 * 1000;
  if(elapsedMs > grace24h){
    return { allow: false, reason: '退会承認から24時間が経過したためご利用いただけません。', isBan: false };
  }
  return { allow: true, reason: '', isBan: false };
}

/** 起動時/ログイン後に、未表示の退会通知があれば表示 */
async function checkPendingWithdrawalNotice(){
  if(!currentUser) return;
  try{
    var{data}=await supa.from('contacts')
      .select('id, contact_type, body, created_at')
      .eq('user_id', currentUser.id)
      .in('contact_type', ['退会処分通知','退会承認通知'])
      .order('created_at', { ascending: false }).limit(1);
    if(!data || !data[0]) return;
    var notice = data[0];
    var key = 'withdrawal_notice_shown_' + currentUser.id + '_' + notice.id;
    if(localStorage.getItem(key)) return; // 表示済み
    showWithdrawalNoticeModal(notice);
  }catch(e){ console.log('checkPendingWithdrawalNotice error:', e); }
}

// ===== 公式チャットの履歴を DB から再構築 =====
// 過去の問い合わせと管理者からの返答を officialMessages に取り込む
/** 運営チャット履歴を DB から再構築 + 未読判定 + ベル通知 fire */
async function loadOfficialChatHistory() {
  if (!currentUser) return;
  try {
    // contacts と announcements を並列取得
    // アナウンスは登録日時(myCreatedAt)以降のものだけを表示
    let annQuery = supa.from('announcements')
      .select('title, body, created_at')
      .order('created_at', { ascending: true });
    if (myCreatedAt) annQuery = annQuery.gte('created_at', myCreatedAt);
    // contacts / announcements / 自分の最終既読時刻 を並列取得
    const [contactsRes, annRes, profileRes] = await Promise.all([
      supa.from('contacts')
        .select('contact_type, body, reply_text, created_at, replied_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true }),
      annQuery,
      supa.from('profiles')
        .select('last_official_chat_read_at')
        .eq('id', currentUser.id)
        .single(),
    ]);
    if (contactsRes.error) { console.log('chat history load error (contacts):', contactsRes.error); }
    if (annRes.error) { console.log('chat history load error (announcements):', annRes.error); }
    const contacts = contactsRes.data || [];
    const announcements = annRes.data || [];
    // 時系列マージ
    const items = [];
    contacts.forEach(c => items.push({ kind: 'contact', timestamp: c.created_at, data: c }));
    announcements.forEach(a => items.push({ kind: 'announcement', timestamp: a.created_at, data: a }));
    items.sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));

    // 新しい履歴をいったん別配列に組み立て（変化判定のため）
    // 各メッセージに timestamp(ISO文字列) を付ける → openOfficialChat 側で日時表示
    const newMessages = [{ from: 'official', text: '縁の間へようこそ！ご不明な点はいつでもお気軽にお問い合わせください。', timestamp: null }];
    items.forEach(item => {
      if (item.kind === 'announcement') {
        const a = item.data;
        const titlePart = a.title ? a.title + '\n' : '';
        newMessages.push({ from: 'official', text: '📣【運営からのお知らせ】\n' + titlePart + (a.body || ''), timestamp: a.created_at });
        return;
      }
      const c = item.data;
      const ts = c.created_at;
      if (c.contact_type === '警告') {
        newMessages.push({ from: 'official', text: '⚠️【運営から警告】\n' + (c.body || ''), timestamp: ts });
      } else if (c.contact_type === '通報結果通知') {
        newMessages.push({ from: 'official', text: '📋【通報結果のお知らせ】\n' + (c.body || ''), timestamp: ts });
      } else if (c.contact_type === '運営通知') {
        newMessages.push({ from: 'official', text: '📢【運営からのお知らせ】\n' + (c.body || ''), timestamp: ts });
      } else if (c.contact_type === '卒業鑑定申込') {
        newMessages.push({ from: 'user', text: c.body, timestamp: ts });
        newMessages.push({ from: 'official', text: '卒業鑑定プランのお申し込みを受け付けました。\n運営にて入金を確認次第、鑑定の日程についてご連絡いたします。', timestamp: ts });
      } else if (c.contact_type === '退会申請') {
        newMessages.push({ from: 'user', text: c.body, timestamp: ts });
        newMessages.push({ from: 'official', text: '退会申請を受け付けました。\n運営にて内容を確認後、退会処理を実施いたします。', timestamp: ts });
      } else if (c.contact_type === 'メッセージ') {
        newMessages.push({ from: 'user', text: c.body, timestamp: ts });
        newMessages.push({ from: 'official', text: 'メッセージを受け取りました。確認次第、ご返答いたします。', timestamp: ts });
      } else {
        newMessages.push({ from: 'user', text: '【' + c.contact_type + '】\n' + c.body, timestamp: ts });
        newMessages.push({ from: 'official', text: 'お問い合わせ（' + c.contact_type + '）を受け付けました。内容を確認次第、ご返答いたします。', timestamp: ts });
      }
      if (c.reply_text) {
        newMessages.push({ from: 'official', text: c.reply_text, timestamp: c.replied_at || ts });
      }
    });

    // 古い未読判定用 data 互換のため、合算 contacts ベースでスキャン
    const data = contacts;
    // 未読判定：管理者からの最新メッセージ時刻と localStorage の最終閲覧時刻を比較
    let latestAdminMsgTime = 0;
    if (data) {
      data.forEach(c => {
        let t = null;
        if (c.contact_type === '警告' || c.contact_type === '通報結果通知' || c.contact_type === '運営通知') {
          t = c.created_at; // 管理者が能動的に送ったメッセージ
        } else if (c.reply_text) {
          t = c.replied_at; // ユーザー問い合わせへの返信
        }
        if (t) {
          const ms = new Date(t).getTime();
          if (ms > latestAdminMsgTime) latestAdminMsgTime = ms;
        }
      });
    }
    // 全体アナウンスも未読判定に含める
    announcements.forEach(a => {
      const ms = new Date(a.created_at).getTime();
      if (ms > latestAdminMsgTime) latestAdminMsgTime = ms;
    });
    // 最終既読：localStorage と DB の新しい方を採用（デバイス間同期のため）
    const lastOpenKey = 'official_chat_last_opened_' + currentUser.id;
    const localLastOpened = parseInt(localStorage.getItem(lastOpenKey) || '0', 10);
    const dbLastOpenedRaw = profileRes && profileRes.data ? profileRes.data.last_official_chat_read_at : null;
    const dbLastOpened = dbLastOpenedRaw ? new Date(dbLastOpenedRaw).getTime() : 0;
    const lastOpened = Math.max(localLastOpened, dbLastOpened);
    // 運営チャットを今開いていれば「読んでる」とみなして lastOpened を更新
    // ※ メッセージタブ(s2)が現在アクティブであることも必須。s2 が非表示ならチャットも実質的に見えていない。
    var s2El = document.getElementById('s2');
    var chatViewEl = document.getElementById('msg-chat-view');
    var chatNameEl = document.getElementById('chat-name');
    const isOfficialOpen = s2El && s2El.classList.contains('on') &&
      chatViewEl && chatViewEl.style.display === 'block' &&
      chatNameEl && chatNameEl.textContent === '縁の間 運営';
    if (isOfficialOpen && latestAdminMsgTime > 0) {
      const nowMs = Date.now();
      localStorage.setItem(lastOpenKey, String(nowMs));
      // DB も同期（失敗しても致命的ではない）
      supa.from('profiles').update({last_official_chat_read_at: new Date(nowMs).toISOString()})
        .eq('id', currentUser.id)
        .then(function(res){ if(res && res.error) console.log('last_read sync error:', res.error); });
    }
    const hasUnread = !isOfficialOpen && latestAdminMsgTime > lastOpened;
    // ベル通知：新しい管理者メッセージがあれば fire（既に通知したものはスキップ）
    if (hasUnread && latestAdminMsgTime > 0) {
      const lastNotifyKey = 'official_last_bell_notify_' + currentUser.id;
      const lastNotify = parseInt(localStorage.getItem(lastNotifyKey) || '0', 10);
      if (latestAdminMsgTime > lastNotify) {
        localStorage.setItem(lastNotifyKey, String(latestAdminMsgTime));
        if (typeof addNotif === 'function') {
          addNotif('【運営】新しいメッセージが届きました', 'メッセージタブから内容をご確認ください');
        }
      }
    }
    // メッセージタブのバッジ（運営未読 or DM未読 のどちらかがあれば表示）
    window._officialChatHasUnread = hasUnread;
    updateMsgTabBadge();
    // 運営チャット行の赤ポッチ
    const officialItem = document.getElementById('official-msg-item');
    if (officialItem) {
      let dot = officialItem.querySelector('.msg-unread-dot');
      if (hasUnread && !dot) {
        const ava = officialItem.querySelector('.msg-list-ava');
        if (ava) {
          dot = document.createElement('div');
          dot.className = 'msg-unread-dot';
          ava.appendChild(dot);
        }
      } else if (!hasUnread && dot) {
        dot.remove();
      }
    }

    // 既存の officialMessages と比較して、本当に変化があった場合のみ更新・再描画
    // （ポーリング中の入力欄消失バグを回避）
    const oldLen = officialMessages.length;
    const oldLast = officialMessages[oldLen - 1];
    const newLast = newMessages[newMessages.length - 1];
    const changed = oldLen !== newMessages.length ||
      (oldLast && newLast && oldLast.text !== newLast.text);
    if (!changed) return;
    // 変化があったので置き換え
    officialMessages.length = 0;
    newMessages.forEach(m => officialMessages.push(m));
    const preview = document.getElementById('official-preview');
    if (preview && newLast) preview.textContent = newLast.text.substring(0, 25) + '…';
    // 運営チャットが開いている場合は再描画（入力中の文字とフォーカスを保持）
    // ※ メッセージタブが現在アクティブな場合のみ再描画（他タブからの強制遷移を防止）
    var s2View = document.getElementById('s2');
    var chatView = document.getElementById('msg-chat-view');
    var chatName = document.getElementById('chat-name');
    if (s2View && s2View.classList.contains('on') &&
        chatView && chatView.style.display === 'block' &&
        chatName && chatName.textContent === '縁の間 運営' &&
        typeof openOfficialChat === 'function') {
      const oldInput = document.getElementById('official-input');
      const savedValue = oldInput ? oldInput.value : '';
      const wasFocused = oldInput && document.activeElement === oldInput;
      openOfficialChat();
      const newInput = document.getElementById('official-input');
      if (newInput) {
        if (savedValue) newInput.value = savedValue;
        if (wasFocused) {
          newInput.focus();
          try { newInput.setSelectionRange(savedValue.length, savedValue.length); } catch(e) {}
        }
      }
    }
  } catch (e) {
    console.log('chat history load exception:', e);
  }
}

// ===== ポーリング（Realtime の安全弁。60秒に1回） =====
// Realtime が WebSocket 切断などで失敗した時のフォールバック
/** 60秒ポーリング開始（Realtime の安全弁） */
function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(function() {
    if (currentUser) {
      loadEnList();
      loadOfficialChatHistory();
      loadMyCashbacks();
      // プランページが開かれていれば卒業申請の最新状態を反映
      var planVisible = document.getElementById('sub-plan');
      if (planVisible && planVisible.style.display !== 'none' && typeof refreshSotsugyouState === 'function') {
        refreshSotsugyouState();
      }
      // 推しの詳細が開いていない時だけ推しページを更新
      var openDetail = document.querySelector('.detail-panel.open');
      if (!openDetail) {
        loadRealUsers();
      }
    }
  }, 10000);  // 10秒ごと
}

// ===== Realtime: Supabase WebSocket で push 通知を受ける =====
// 既存のポーリングは安全弁として残しつつ、Realtime で即時更新する。
// テーブル別に subscribe。RLS が効くので自分が見える行の変更だけ届く。
let realtimeChannels = [];
/** Supabase Realtime に subscribe（contacts/announcements/matches/cashbacks/sotsugyou） */
function startRealtime() {
  if (!currentUser) return;
  // 既存の channel があれば一旦解除
  stopRealtime();

  const uid = currentUser.id;

  // 1) 運営チャット用: contacts は自分宛 + announcements は全員宛
  const chatChannel = supa
    .channel('rt-chat-' + uid)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contacts', filter: 'user_id=eq.' + uid },
      function(payload){
        loadOfficialChatHistory();
        // 退会処分通知 / 退会承認通知 が新着なら即時ポップアップ
        var row = payload.new || {};
        if(payload.eventType === 'INSERT'
           && (row.contact_type === '退会処分通知' || row.contact_type === '退会承認通知')){
          if(typeof showWithdrawalNoticeModal === 'function') showWithdrawalNoticeModal(row);
        }
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'announcements' },
      function(){ loadOfficialChatHistory(); }
    )
    .subscribe(function(status){
      if(status === 'SUBSCRIBED') console.log('[realtime] chat subscribed');
    });
  realtimeChannels.push(chatChannel);

  // 2) マッチング: 自分が from でも to でも反映したい → 全行 INSERT/UPDATE を受けて
  //    ハンドラ側で自分関連かどうか判定 → 関連あれば loadEnList()
  //    + 自分のマッチ相手が他とカップル成立した場合も検知（partnerIsCoupledWithOther 更新用）
  const matchChannel = supa
    .channel('rt-match-' + uid)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      function(payload){
        const row = payload.new || payload.old || {};
        // 自分関連の変更
        var selfInvolved = (row.from_user_id === uid || row.to_user_id === uid);
        // 自分のマッチ相手が関与する変更（その相手が他とカップル成立したかも）
        var partnerIds = (Array.isArray(window.enList) ? window.enList : [])
          .map(function(e){ return e.partnerUserId; })
          .filter(Boolean);
        var partnerInvolved = partnerIds.indexOf(row.from_user_id) >= 0 || partnerIds.indexOf(row.to_user_id) >= 0;
        if(selfInvolved || partnerInvolved){
          loadEnList();
          // 推しの詳細が開いていなければ推しページも更新
          var openDetail = document.querySelector('.detail-panel.open');
          if(!openDetail && typeof loadRealUsers === 'function') loadRealUsers();
        }
      }
    )
    .subscribe();
  realtimeChannels.push(matchChannel);

  // 3) キャッシュバック: 自分が referrer_id のレコードのみ
  const cbChannel = supa
    .channel('rt-cb-' + uid)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'cashbacks', filter: 'referrer_id=eq.' + uid },
      function(){
        if(typeof loadMyCashbacks === 'function') loadMyCashbacks();
        // ベル通知も
        if(typeof loadOfficialChatHistory === 'function') loadOfficialChatHistory();
      }
    )
    .subscribe();
  realtimeChannels.push(cbChannel);

  // 4) ユーザー間メッセージ: INSERT/UPDATE 両方拾う
  //    - INSERT: 新着メッセージ → チャット再描画 + プレビュー更新
  //    - UPDATE: read_at 更新 (相手が既読化) → 自分が今そのチャット開いてれば「既読」を即反映
  const dmChannel = supa
    .channel('rt-dm-' + uid)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      function(payload){
        var row = payload.new || payload.old || {};
        var isOpenChat = currentChatMatchId && row.match_id === currentChatMatchId;
        // UPDATE: 既読化された等 → 開いてるチャットを再描画して既読マーク反映
        if(payload.eventType === 'UPDATE'){
          if(isOpenChat){
            var chatNameElU = document.getElementById('chat-name');
            var dispNameU = chatNameElU ? chatNameElU.textContent : '';
            loadAndRenderChat(dispNameU, currentChatMatchId);
          }
          return;
        }
        // INSERT: 新着メッセージ
        if(row.sender_id === uid) return;
        // 今開いているチャットなら既読にして再描画
        if(isOpenChat){
          markDmAsRead(row.match_id);
          var chatNameEl = document.getElementById('chat-name');
          var dispName = chatNameEl ? chatNameEl.textContent : '';
          loadAndRenderChat(dispName, currentChatMatchId).then(function(){ scrollChatToBottom(); });
        }
        // プレビューキャッシュ更新
        var prev = msgPreviewCache[row.match_id];
        var oldUnread = prev ? prev.unreadCount : 0;
        msgPreviewCache[row.match_id] = {
          lastMsg: row.body,
          lastTime: row.created_at,
          unreadCount: isOpenChat ? 0 : oldUnread + 1
        };
        updateDmBadge();
        renderMsgList();
      }
    )
    .subscribe();
  realtimeChannels.push(dmChannel);

  // 5) 卒業申請: 自分か相手の申請状況が変わった時に反映
  const sgChannel = supa
    .channel('rt-sg-' + uid)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'sotsugyou_requests' },
      function(payload){
        const row = payload.new || payload.old || {};
        if(row.user_id === uid || row.partner_user_id === uid){
          var planVisible = document.getElementById('sub-plan');
          if(planVisible && planVisible.style.display !== 'none' && typeof refreshSotsugyouState === 'function'){
            refreshSotsugyouState();
          }
        }
      }
    )
    .subscribe();
  realtimeChannels.push(sgChannel);
}

/** Realtime channels を全部解除 */
function stopRealtime(){
  realtimeChannels.forEach(function(ch){
    try{ supa.removeChannel(ch); }catch(e){ console.log('removeChannel error:', e); }
  });
  realtimeChannels = [];
}

// ===== 起動時：ログイン状態チェック =====
// ===== メール認証 ON 経由の初回ログイン処理 =====
// signUp 時に localStorage へ保存しておいた profile データを DB へ INSERT する。
// 成功すれば profile レコードを返し、失敗 or データがなければ null。
/** メール認証経由の初回ログイン時、localStorage に保留した profile を INSERT @param {string} userId */
async function flushPendingProfile(userId){
  const key = 'pending_profile_' + userId;
  let raw;
  try { raw = localStorage.getItem(key); } catch(e){ raw = null; }
  if (!raw) return null;
  try {
    const profileData = JSON.parse(raw);
    profileData.id = userId; // 念のため上書き

    // 保留されたアバター画像があれば Storage にアップロード
    try {
      const pendingAvatar = localStorage.getItem('pending_avatar_' + userId);
      if (pendingAvatar && pendingAvatar.indexOf('data:') === 0) {
        // dataURL → Blob 変換
        const res = await fetch(pendingAvatar);
        const blob = await res.blob();
        const { url, error: upErr } = await uploadAvatar(supa, userId, blob);
        if (upErr) { console.log('pending avatar upload error:', upErr); }
        else if (url) { profileData.avatar_url = url; }
        localStorage.removeItem('pending_avatar_' + userId);
      }
    } catch (avErr) { console.log('pending avatar process error:', avErr); }

    const { error } = await supa.from('profiles').insert(profileData);
    if (error) {
      console.log('pending profile INSERT error:', error);
      // 一意制約違反（既に存在）なら localStorage だけ消して既存 profile を取得
      if (String(error.code) === '23505' || /duplicate/i.test(error.message || '')) {
        try { localStorage.removeItem(key); localStorage.removeItem('pending_profile_email_' + userId); } catch(e){}
        const { data: existing } = await supa.from('profiles').select('*').eq('id', userId).single();
        return existing || null;
      }
      return null;
    }
    // INSERT 成功 → localStorage クリア
    try { localStorage.removeItem(key); localStorage.removeItem('pending_profile_email_' + userId); } catch(e){}
    // 新規行を読み直して返す（DB のデフォルト値などを反映するため）
    const { data: inserted } = await supa.from('profiles').select('*').eq('id', userId).single();
    return inserted || null;
  } catch (e) {
    console.log('pending profile flush exception:', e);
    return null;
  }
}

/** ページ表示時のセッションチェック → 適切な画面に遷移 */
async function checkSession() {
  // URLハッシュ #register でログイン状態を無視してプラン選択画面へ
  // 例: http://localhost:8766/index.html#register?ref=EN-12345678（紹介QR経由）
  if (window.location.hash.indexOf('#register') === 0) {
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('orient-wrap').style.display = 'none';
    document.getElementById('reg-wrap').style.display = 'none';
    document.getElementById('plan-select-wrap').style.display = 'flex';
    // 紹介者ID を URLから自動入力（reg-wrap のフィールドに事前セット）
    var refMatch = window.location.hash.match(/[?&]ref=([^&]+)/);
    if (refMatch) {
      var refInput = document.getElementById('r-referrer');
      if (refInput) refInput.value = decodeURIComponent(refMatch[1]);
    }
    // フォーム項目もデフォルト（全表示）に戻しておく
    if(typeof applyPlanToRegistrationForm === 'function') applyPlanToRegistrationForm(null);
    return;
  }
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      document.getElementById('login-wrap').style.display = 'flex';
      return;
    }
    currentUser = session.user;
    let { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();

    // メール認証 ON 経由：profile がまだ DB に無いが localStorage に保留があれば INSERT
    if (!profile) {
      profile = await flushPendingProfile(currentUser.id);
    }

    // 退会状態判定（退会処分は常に拒否、退会承認は 24時間以内のみ許可）
    var access = (profile) ? evaluateWithdrawalAccess(profile) : { allow: true };
    if(!access.allow){
      alert(access.reason + '\n理由：' + (profile.banned_reason || '（記載なし）'));
      try { await supa.auth.signOut(); } catch (e) {}
      window.location.href = window.location.pathname;
      return;
    }
    if (profile) {
      memberID = profile.member_id;
      mySex = profile.sex || '';
      myPlan = profile.plan || 'total';
      myCreatedAt = profile.created_at || null;
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'none';
      document.getElementById('login-wrap').style.display = 'none';
      var ecw = document.getElementById('email-confirm-wrap');
      if(ecw) ecw.style.display = 'none';
      showAppWrap();
      await loadMyCashbacks();
      populateProfileModal(profile);
      await loadMyGraduationStatus();
      if (typeof applyPlanUI === 'function') applyPlanUI(myPlan);
      loadOfficialChatHistory();
      loadRealUsers();
      loadEnList();
      // 未表示の退会通知があればポップアップ表示
      checkPendingWithdrawalNotice();
    } else {
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'block';
      markFormShown('register');
      applyHoneypot('reg-wrap');
    }
  } catch(e) { console.log('セッション確認エラー', e); }
}

// ===== ログイン処理 =====
/** メアド+パスワードでログイン処理 */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'メールアドレスとパスワードを入力してください';
    return;
  }

  try {
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = 'メールアドレスまたはパスワードが違います';
      console.log('ログインエラー:', error.message);
      return;
    }

  currentUser = data.user;
  document.getElementById('login-wrap').style.display = 'none';

  // プロフィール確認（メール認証経由で初回ログインなら localStorage の保留 profile を INSERT）
  let { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
  if (!profile) {
    profile = await flushPendingProfile(currentUser.id);
  }
  // 退会状態判定（退会処分は常に拒否、退会承認は 24時間以内のみ許可）
  var accessL = (profile) ? evaluateWithdrawalAccess(profile) : { allow: true };
  if(!accessL.allow){
    errEl.textContent = accessL.reason;
    alert(accessL.reason + '\n理由：' + (profile.banned_reason || '（記載なし）'));
    try { await supa.auth.signOut(); } catch (e) {}
    document.getElementById('login-wrap').style.display = 'flex';
    return;
  }
  if (profile) {
    memberID = profile.member_id;
    mySex = profile.sex || '';
    myPlan = profile.plan || 'total';
    myCreatedAt = profile.created_at || null;
    document.getElementById('login-wrap').style.display = 'none';
    showAppWrap();
    await loadMyCashbacks();
    populateProfileModal(profile);
    await loadMyGraduationStatus();
    if (typeof applyPlanUI === 'function') applyPlanUI(myPlan);
    loadOfficialChatHistory();
    loadRealUsers();
    loadEnList();
    // 未表示の退会通知があればポップアップ表示
    checkPendingWithdrawalNotice();
  } else {
    // プロフィール未登録ならオリエンテーションへ
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('orient-wrap').style.display = 'flex';
  }
  } catch(e) { console.log('ログイン例外:', e); errEl.textContent = 'エラーが発生しました'; }
}

// ===== 新規登録ボタン → プラン選択画面へ =====
/** ログイン画面から新規登録（プラン選択画面）に遷移 */
function goToRegister() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('plan-select-wrap').style.display = 'flex';
}

// ===== ログアウト =====
/** ログアウト処理：Realtime 切断 + signOut + リロード */
async function logout() {
  if (!confirm('ログアウトしますか？')) return;
  try {
    if (typeof stopRealtime === 'function') stopRealtime();
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
    await supa.auth.signOut();
  } catch (e) {
    console.log('ログアウトエラー:', e);
  }
  // セッション破棄後はリロードしてログイン画面から始める
  window.location.href = window.location.pathname;
}

// ===== グローバルイベントリスナー =====
document.addEventListener('click',function(e){if(!e.target.closest('#other-tab-btn')&&!e.target.closest('#bni-other')&&!e.target.closest('#sub-menu'))closeSubMenu();if(!e.target.closest('.notif-icon')&&!e.target.closest('#notif-panel')){var np=document.getElementById('notif-panel');if(np)np.classList.remove('show');}var pair=e.target.closest('.rel-pair');if(!pair){document.querySelectorAll('.rel-pair.active').forEach(function(p){p.classList.remove('active');});clearAllSvg();return;}var idx=pair.dataset.ridx,type=pair.dataset.type,ii=parseInt(pair.dataset.ii);if(pair.classList.contains('active')){pair.classList.remove('active');clearSvg(idx);}else{document.querySelectorAll('.rel-pair.active').forEach(function(p){p.classList.remove('active');});clearAllSvg();pair.classList.add('active');highlightPair(idx,type,ii);}});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login-wrap').style.display !== 'none') {
    doLogin();
  }
});

// ===== 起動 =====
initPrefs();updateAgeSummary();
checkSession();
