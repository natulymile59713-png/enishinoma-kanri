// ===== アプリ初期化・タブ切替・ログイン =====
function goTab(i){if(!document.getElementById('s0'))return;document.querySelectorAll('.ntab').forEach(function(t,idx){t.classList.toggle('on',idx===i);});document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.toggle('on',i===3);});document.querySelectorAll('.screen').forEach(function(s,idx){s.classList.toggle('on',idx===i);});document.querySelectorAll('.bni').forEach(function(b,idx){b.classList.toggle('on',idx===i);});}
function toggleModal(){document.getElementById('profile-modal').classList.toggle('show');}

// ===== プロフィールモーダル表示の共通処理 =====
// 新規登録(completeReg)・自動ログイン(checkSession)・手動ログイン(doLogin) から呼ばれる。
// profile はDBの行（または同じ形のオブジェクト）。MY_PILLARS グローバル変数も更新する。
function populateProfileModal(profile) {
  // 上部アイコン・モーダルアバター（イニシャル）
  document.getElementById('topbar-initial').textContent = (profile.nickname||'').charAt(0);
  document.getElementById('modal-ava-ph').textContent = (profile.nickname||'').charAt(0);
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
  modalInfo += '<div style="text-align:center;margin-top:10px"><button type="button" onclick="openBirthEdit()" style="font-size:11px;padding:6px 14px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">＋ 生まれの時刻・場所を編集</button></div>';

  // 口座情報セクション（キャッシュバック対象 or 既に登録済み の時のみ表示）
  var cashbackKey = 'cashback_eligible_' + (currentUser ? currentUser.id : 'guest');
  var isEligible = localStorage.getItem(cashbackKey) === '1';
  var hasBank = !!profile.bank_name;
  if (isEligible || hasBank) {
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

  document.getElementById('modal-info').innerHTML = modalInfo;

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
function showAppWrap() {
  if (document.getElementById('app-wrap')) {
    document.getElementById('app-wrap').style.display = 'block';
    document.getElementById('app-wrap').style.visibility = 'visible';
    document.getElementById('s0').classList.add('on');
    startPolling();
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
}

// ===== 公式チャットの履歴を DB から再構築 =====
// 過去の問い合わせと管理者からの返答を officialMessages に取り込む
async function loadOfficialChatHistory() {
  if (!currentUser) return;
  try {
    const { data, error } = await supa.from('contacts')
      .select('contact_type, body, reply_text, created_at, replied_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true });
    if (error) { console.log('chat history load error:', error); return; }
    // 新しい履歴をいったん別配列に組み立て（変化判定のため）
    const newMessages = [{ from: 'official', text: '縁の間へようこそ！ご不明な点はいつでもお気軽にお問い合わせください。' }];
    if (data) {
      data.forEach(c => {
        if (c.contact_type === 'メッセージ') {
          // 運営チャット入力からの送信：素のテキストとして表示
          newMessages.push({ from: 'user', text: c.body });
          newMessages.push({ from: 'official', text: 'メッセージを受け取りました。確認次第、ご返答いたします。' });
        } else {
          // 問い合わせフォームからの送信：種別を併記
          newMessages.push({ from: 'user', text: '【' + c.contact_type + '】\n' + c.body });
          newMessages.push({ from: 'official', text: 'お問い合わせ（' + c.contact_type + '）を受け付けました。内容を確認次第、ご返答いたします。' });
        }
        if (c.reply_text) {
          newMessages.push({ from: 'official', text: c.reply_text });
        }
      });
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
    var chatView = document.getElementById('msg-chat-view');
    var chatName = document.getElementById('chat-name');
    if (chatView && chatView.style.display === 'block' &&
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

// ===== 10秒ごとにDBの最新状態を確認 =====
function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(function() {
    if (currentUser) {
      loadEnList();
      loadOfficialChatHistory();
      // 推しの詳細が開いていない時だけ推しページを更新
      var openDetail = document.querySelector('.detail-panel.open');
      if (!openDetail) {
        loadRealUsers();
      }
    }
  }, 10000);
}

// ===== 起動時：ログイン状態チェック =====
async function checkSession() {
  // URLハッシュ #register でログイン状態を無視して登録画面へ直行
  // 例: http://localhost:8766/index.html#register?ref=EN-12345678（紹介QR経由）
  if (window.location.hash.indexOf('#register') === 0) {
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('orient-wrap').style.display = 'none';
    document.getElementById('reg-wrap').style.display = 'block';
    document.getElementById('reg-wrap').style.visibility = 'visible';
    // 紹介者ID を URLから自動入力
    var refMatch = window.location.hash.match(/[?&]ref=([^&]+)/);
    if (refMatch) {
      var refInput = document.getElementById('r-referrer');
      if (refInput) refInput.value = decodeURIComponent(refMatch[1]);
    }
    return;
  }
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      document.getElementById('login-wrap').style.display = 'flex';
      return;
    }
    currentUser = session.user;
    const { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile && profile.banned_at) {
      // BAN済みアカウントはログアウトさせる
      alert('このアカウントは利用停止されています。\n理由：' + (profile.banned_reason || '（理由の記載なし）'));
      try { await supa.auth.signOut(); } catch (e) {}
      window.location.href = window.location.pathname;
      return;
    }
    if (profile) {
      memberID = profile.member_id;
      mySex = profile.sex || '';
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'none';
      document.getElementById('login-wrap').style.display = 'none';
      showAppWrap();
      populateProfileModal(profile);
      document.getElementById('s0').classList.add('on');
      loadOfficialChatHistory();
      loadRealUsers();
      loadEnList();
    } else {
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'block';
    }
  } catch(e) { console.log('セッション確認エラー', e); }
}

// ===== ログイン処理 =====
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

  // プロフィール確認
  const { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
  if (profile && profile.banned_at) {
    // BAN済みアカウント
    errEl.textContent = 'このアカウントは利用停止されています';
    alert('このアカウントは利用停止されています。\n理由：' + (profile.banned_reason || '（理由の記載なし）'));
    try { await supa.auth.signOut(); } catch (e) {}
    document.getElementById('login-wrap').style.display = 'flex';
    return;
  }
  if (profile) {
    memberID = profile.member_id;
    mySex = profile.sex || '';
    document.getElementById('login-wrap').style.display = 'none';
    showAppWrap();
    populateProfileModal(profile);
    loadOfficialChatHistory();
    loadRealUsers();
    loadEnList();
  } else {
    // プロフィール未登録ならオリエンテーションへ
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('orient-wrap').style.display = 'flex';
  }
  } catch(e) { console.log('ログイン例外:', e); errEl.textContent = 'エラーが発生しました'; }
}

// ===== 新規登録ボタン =====
function goToRegister() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('orient-wrap').style.display = 'flex';
}

// ===== ログアウト =====
async function logout() {
  if (!confirm('ログアウトしますか？')) return;
  try {
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
