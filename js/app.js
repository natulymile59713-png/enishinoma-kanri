// ===== アプリ初期化・タブ切替・ログイン =====
function goTab(i){if(!document.getElementById('s0'))return;document.querySelectorAll('.ntab').forEach(function(t,idx){t.classList.toggle('on',idx===i);});document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.toggle('on',i===3);});document.querySelectorAll('.screen').forEach(function(s,idx){s.classList.toggle('on',idx===i);});document.querySelectorAll('.bni').forEach(function(b,idx){b.classList.toggle('on',idx===i);});}
function toggleModal(){document.getElementById('profile-modal').classList.toggle('show');}

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

// ===== 10秒ごとにDBの最新状態を確認 =====
function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(function() {
    if (currentUser) {
      loadEnList();
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
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      document.getElementById('login-wrap').style.display = 'flex';
      return;
    }
    currentUser = session.user;
    const { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
      memberID = profile.member_id;
      mySex = profile.sex || '';
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'none';
      document.getElementById('login-wrap').style.display = 'none';
      showAppWrap();
      document.getElementById('topbar-initial').textContent = profile.nickname.charAt(0);
      document.getElementById('modal-ava-ph').textContent = profile.nickname.charAt(0);
      document.getElementById('modal-member-id').textContent = profile.member_id;
      document.getElementById('contact-id').value = profile.member_id;
      document.getElementById('contact-nick').value = profile.nickname;

      var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+profile.nickname+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+(profile.sex||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+(profile.prefecture||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+profile.birth_year+'年'+profile.birth_month+'月'+profile.birth_day+'日</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+(profile.marriage||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+(profile.children||'')+'</span></div>';
      document.getElementById('modal-info').innerHTML = modalInfo;

      MY_PILLARS = [
        {k: profile.pillar_year_k||0, s: profile.pillar_year_s||0},
        {k: profile.pillar_month_k||0, s: profile.pillar_month_s||0},
        {k: profile.pillar_day_k||0, s: profile.pillar_day_s||0},
        {k: profile.pillar_hour_k||0, s: profile.pillar_hour_s||0}
      ];

      var pillarHtml = '';
      MY_PILLARS.forEach(function(p, i) {
        pillarHtml += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
      });
      document.getElementById('modal-pillars').innerHTML = pillarHtml;

      document.getElementById('s0').classList.add('on');
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
  if (profile) {
    memberID = profile.member_id;
    mySex = profile.sex || '';
    document.getElementById('login-wrap').style.display = 'none';
    showAppWrap();
    document.getElementById('topbar-initial').textContent = profile.nickname.charAt(0);
    document.getElementById('modal-ava-ph').textContent = profile.nickname.charAt(0);
    document.getElementById('modal-member-id').textContent = profile.member_id;
    document.getElementById('contact-id').value = profile.member_id;
    document.getElementById('contact-nick').value = profile.nickname;

    var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+profile.nickname+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+(profile.sex||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+(profile.prefecture||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+profile.birth_year+'年'+profile.birth_month+'月'+profile.birth_day+'日</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+(profile.marriage||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+(profile.children||'')+'</span></div>';
    document.getElementById('modal-info').innerHTML = modalInfo;

    MY_PILLARS = [
      {k: profile.pillar_year_k||0, s: profile.pillar_year_s||0},
      {k: profile.pillar_month_k||0, s: profile.pillar_month_s||0},
      {k: profile.pillar_day_k||0, s: profile.pillar_day_s||0},
      {k: profile.pillar_hour_k||0, s: profile.pillar_hour_s||0}
    ];

    var pillarHtml = '';
    MY_PILLARS.forEach(function(p, i) {
      pillarHtml += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
    });
    document.getElementById('modal-pillars').innerHTML = pillarHtml;

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
