// ===== UI: その他（プラン・お問い合わせ・通知・サブメニュー・生まれの情報編集） =====

// ===== プラン一覧（3つの月額プラン）を描画 =====
const PLANS_INFO = {
  trial: {
    name: 'お試しプラン',
    price: 963,
    items: ['良縁率の高い方とのマッチング', 'メッセージのやり取り']
  },
  no_matching: {
    name: 'NOマッチングプラン',
    price: 1693,
    items: ['気になる人との相性診断', '相性診断結果のメモ', 'あなた専用の運勢カレンダー']
  },
  total: {
    name: 'トータルプラン',
    price: 2369,
    items: ['良縁率の高い方とのマッチング', 'メッセージのやり取り', '気になる人との相性診断', '相性診断結果のメモ', 'あなた専用の運勢カレンダー']
  }
};
/** プラン一覧画面を現在の myPlan に応じて描画 */
function renderPlansList(){
  var box = document.getElementById('plans-subs-container');
  if(!box) return;
  var order = ['trial', 'no_matching', 'total'];
  var html = '';
  order.forEach(function(key){
    var p = PLANS_INFO[key];
    var isActive = (myPlan === key);
    var cardClass = 'other-plan-card' + (isActive ? ' hl' : ' plan-clickable');
    var nameHtml = p.name + (isActive ? '<span class="plan-status-badge active">適用中</span>' : '');
    var itemsHtml = p.items.map(function(it){return '・'+it;}).join('<br>');
    var clickAttr = isActive ? '' : ' onclick="confirmPlanChange(\''+key+'\')"';
    var changeBtn = isActive ? '' : '<div style="text-align:center;margin-top:.6rem;font-size:11px;color:#C9A96E;font-weight:500">このプランに変更する →</div>';
    html += '<div class="'+cardClass+'"'+clickAttr+'>';
    html += '<div class="other-plan-nm">'+nameHtml+'</div>';
    html += '<div class="other-plan-price">¥ '+p.price.toLocaleString()+' <span class="other-plan-unit">/ 月</span></div>';
    html += '<div class="other-plan-items">'+itemsHtml+'</div>';
    html += changeBtn;
    html += '</div>';
  });
  box.innerHTML = html;
}

// プラン変更の確認＆実行
/** プラン変更確認 → DB 更新 → UI 反映 @param {string} newPlan */
async function confirmPlanChange(newPlan){
  if(!currentUser){alert('ログインが必要です');return;}
  if(!PLANS_INFO[newPlan]) return;
  if(myPlan === newPlan) return;
  var current = PLANS_INFO[myPlan];
  var next = PLANS_INFO[newPlan];
  var msg = '【プラン変更の確認】\n' +
    '現在：' + (current ? current.name + '（¥' + current.price.toLocaleString() + '/月）' : myPlan) + '\n' +
    '変更後：' + next.name + '（¥' + next.price.toLocaleString() + '/月）\n\n' +
    'このプランに変更しますか？\n（変更は即時反映されます）';
  if(!confirm(msg)) return;
  try{
    const{error}=await supa.from('profiles').update({plan: newPlan}).eq('id', currentUser.id);
    if(error){alert('変更に失敗しました：' + error.message); return;}
    var prevPlan = myPlan;
    myPlan = newPlan;
    if(typeof applyPlanUI === 'function') applyPlanUI(newPlan);
    renderPlansList();
    if(typeof addOfficialMessage === 'function'){
      addOfficialMessage('プランを「' + next.name + '」に変更しました。');
    }
    if(typeof addNotif === 'function'){
      addNotif('【プラン変更完了】', next.name + 'に変更されました。');
    }
    // プランページに留まる
    setTimeout(function(){ openSubPage('plan'); }, 50);
  }catch(e){
    console.log('プラン変更エラー:', e);
    alert('エラーが発生しました');
  }
}

// ===== プラン別 UI 制御 =====
// myPlan に応じてナビとサブメニューを書き換える
/** プランに応じて nav タブやサブメニューの表示を制限 @param {string} plan */
function applyPlanUI(plan){
  if(!plan) plan = 'total';
  // ナビの参照（data-tab 属性で取得することで挿入後でも正しく参照できる）
  var navEl = document.querySelector('.nav');
  if(!navEl) return;
  var tabOshi = navEl.querySelector('.ntab[data-tab="oshi"]');
  var tabEn = navEl.querySelector('.ntab[data-tab="enlist"]');
  var tabMsg = navEl.querySelector('.ntab[data-tab="msg"]');

  // 現在のタブ状態をチェック（プラン変更時に必要かどうか判定）
  var s0 = document.getElementById('s0');
  var s1 = document.getElementById('s1');
  var onOshi = s0 && s0.classList.contains('on');
  var onEnlist = s1 && s1.classList.contains('on');
  var aishouOnNow = !!document.querySelector('[data-nm-tab="aishou"].on');
  var calendarOnNow = !!document.querySelector('[data-nm-tab="calendar"].on');

  // プラン切替前にサブメニューの onclick を必ず元に戻す。
  // grayoutSubMenuItems が onclick を "alert(...)" に書き換えるため、
  // これを先に解除しておかないと setSubMenuAllowed の openSubPage 正規表現が
  // マッチせず、NOマッチング切替時に display:none が効かなくなる。
  ungrayoutAllSubMenuItems();

  // 「卒業生の間」(voice) アクセス制御用メッセージ
  // 認定済 + NOマッチング以外 → 「NOマッチングへ切替で利用可」
  // 未認定 → 「卒業鑑定を受けて認定後 + NOマッチング切替で利用可」
  var isCertified = (typeof myIsGraduated !== 'undefined') && myIsGraduated;
  var voiceLockMsg = isCertified
    ? '「卒業生の間」は NOマッチングプランへ切り替え後にご利用いただけます。'
    : '「卒業生の間」は、卒業鑑定をお受け頂きNOマッチングプランへ切り替えた方のみご利用いただけます。';

  // === NOマッチング：推し・縁リストを非表示、相性・運勢カレンダー タブを挿入 ===
  if(plan === 'no_matching'){
    if(tabOshi) tabOshi.style.display = 'none';
    if(tabEn) tabEn.style.display = 'none';
    insertNoMatchingTabs();
    // 卒業済みなら voice を含む / 未卒業(初めから NOマッチング)なら voice を除外して非表示
    var nmAllowed = ['plan','refer','omoi','contact','cancel'];
    if(typeof myIsGraduated !== 'undefined' && myIsGraduated){
      nmAllowed.push('voice');
    }
    setSubMenuAllowed(nmAllowed);
    // 推し or 縁リストにいる場合のみ相性タブへ移動
    if(onOshi || onEnlist){
      if(s0) s0.classList.remove('on');
      if(s1) s1.classList.remove('on');
      setTimeout(function(){ goAishouTab(); }, 50);
    }
  }
  // === お試しプラン：相性診断・結果メモ・運勢カレンダー + 卒業生の間 をグレーアウト ===
  else if(plan === 'trial'){
    if(tabOshi) tabOshi.style.display = '';
    if(tabEn) tabEn.style.display = '';
    if(aishouOnNow || calendarOnNow){
      removeNoMatchingTabs();
      setTimeout(function(){ goTab(0); }, 50);
    } else {
      removeNoMatchingTabs();
    }
    setSubMenuAllowed(null);
    grayoutSubMenuItems(['shindan','memo','calendar','voice'], { voice: voiceLockMsg });
  }
  // === トータル：マッチング機能全開放、卒業生の間のみグレーアウト ===
  else {
    if(tabOshi) tabOshi.style.display = '';
    if(tabEn) tabEn.style.display = '';
    if(aishouOnNow || calendarOnNow){
      removeNoMatchingTabs();
      setTimeout(function(){ goTab(0); }, 50);
    } else {
      removeNoMatchingTabs();
    }
    setSubMenuAllowed(null);
    ungrayoutAllSubMenuItems();
    grayoutSubMenuItems(['voice'], { voice: voiceLockMsg });
  }
}

/** NOマッチングプラン専用の相性診断・カレンダーサブタブを挿入 */
function insertNoMatchingTabs(){
  var nav = document.querySelector('.nav');
  if(!nav) return;
  if(nav.querySelector('[data-nm-tab="aishou"]')) return; // 既存
  var ai = document.createElement('div');
  ai.className = 'ntab';
  ai.setAttribute('data-nm-tab','aishou');
  ai.textContent = '相性';
  ai.onclick = goAishouTab;
  var cal = document.createElement('div');
  cal.className = 'ntab';
  cal.setAttribute('data-nm-tab','calendar');
  cal.textContent = '運勢カレンダー';
  cal.onclick = goCalendarTab;
  // メッセージタブの直前に挿入
  var ntabs = nav.querySelectorAll('.ntab');
  var msgTab = ntabs[2];
  if(msgTab) {
    nav.insertBefore(ai, msgTab);
    nav.insertBefore(cal, msgTab);
  } else {
    nav.appendChild(ai);
    nav.appendChild(cal);
  }
}
/** NOマッチング専用タブを除去 */
function removeNoMatchingTabs(){
  document.querySelectorAll('[data-nm-tab]').forEach(function(el){ el.remove(); });
  var subTabs = document.getElementById('aishou-sub-tabs');
  if(subTabs) subTabs.remove();
}

/** 相性診断ページに移動 */
function goAishouTab(){
  document.querySelectorAll('.ntab').forEach(function(t){t.classList.remove('on');});
  var ai = document.querySelector('[data-nm-tab="aishou"]');
  if(ai) ai.classList.add('on');
  document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.screen').forEach(function(s,i){s.classList.toggle('on',i===3);});
  ['plan','omoi','voice','contact','shindan','memo','calendar','refer','report','cancel'].forEach(function(p){
    var el = document.getElementById('sub-'+p);
    if(el) el.style.display='none';
  });
  showAishouSubTabs('shindan');
  if(typeof initShPrefs === 'function'){
    var sp=document.getElementById('sh-pref');
    if(sp&&sp.options.length===0)initShPrefs();
  }
}
/** 運勢カレンダーページに移動 */
function goCalendarTab(){
  document.querySelectorAll('.ntab').forEach(function(t){t.classList.remove('on');});
  var cal = document.querySelector('[data-nm-tab="calendar"]');
  if(cal) cal.classList.add('on');
  document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.screen').forEach(function(s,i){s.classList.toggle('on',i===3);});
  ['plan','omoi','voice','contact','shindan','memo','calendar','refer','report','cancel'].forEach(function(p){
    var el = document.getElementById('sub-'+p);
    if(el) el.style.display='none';
  });
  var subTabs = document.getElementById('aishou-sub-tabs');
  if(subTabs) subTabs.style.display = 'none';
  document.getElementById('sub-calendar').style.display='block';
  if(typeof openCalendar === 'function') openCalendar();
}

// 相性ページ内の [相性診断 | 結果メモ] サブタブ
/** 相性診断サブタブを表示 @param {string} active */
function showAishouSubTabs(active){
  var s3 = document.getElementById('s3');
  if(!s3) return;
  var bar = document.getElementById('aishou-sub-tabs');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'aishou-sub-tabs';
    bar.className = 'nav';
    bar.innerHTML =
      '<div class="ntab on" data-ai-sub="shindan" onclick="setAishouSub(\'shindan\')">相性診断</div>'+
      '<div class="ntab" data-ai-sub="memo" onclick="setAishouSub(\'memo\')">相性結果メモ</div>';
    s3.insertBefore(bar, s3.firstChild);
  }
  bar.style.display = '';
  setAishouSub(active);
}
/** 相性診断サブタブを切替 @param {'shindan'|'memo'} which */
function setAishouSub(which){
  document.querySelectorAll('[data-ai-sub]').forEach(function(t){
    t.classList.toggle('on', t.dataset.aiSub === which);
  });
  ['shindan','memo'].forEach(function(p){
    var el = document.getElementById('sub-'+p);
    if(el) el.style.display = (p === which) ? 'block' : 'none';
  });
  if(which === 'memo' && typeof renderMemoList === 'function') renderMemoList();
}

// その他サブメニューを許可リストに絞る（null なら全表示）
/** その他サブメニューで指定キーだけ有効化 @param {string[]} allowedList */
function setSubMenuAllowed(allowedList){
  document.querySelectorAll('.sub-menu .sub-item').forEach(function(item){
    var onclickStr = item.getAttribute('onclick') || '';
    var match = onclickStr.match(/openSubPage\(['"](\w+)['"]\)/);
    if(!match) return;
    var feature = match[1];
    if(allowedList === null) {
      item.style.display = '';
    } else {
      item.style.display = allowedList.indexOf(feature) >= 0 ? '' : 'none';
    }
  });
}

// 指定機能のサブメニュー項目をグレーアウト＋クリック制御
/** その他サブメニューで指定キーをグレーアウト
 * @param {string[]} forbiddenList
 * @param {Object<string,string>} [messages] - キー別アラート文言。指定なければ既定文言 */
function grayoutSubMenuItems(forbiddenList, messages){
  messages = messages || {};
  var defaultMsg = 'この機能はお試しプランではご利用いただけません。\n「プラン」から変更してご利用ください。';
  document.querySelectorAll('.sub-menu .sub-item').forEach(function(item){
    var onclickStr = item.getAttribute('onclick') || '';
    var match = onclickStr.match(/openSubPage\(['"](\w+)['"]\)/);
    if(!match) return;
    var feature = match[1];
    if(forbiddenList.indexOf(feature) >= 0){
      item.classList.add('plan-disabled');
      // オリジナルの onclick を保存（プラン解除時に戻すため）
      if(!item.hasAttribute('data-original-onclick')){
        item.setAttribute('data-original-onclick', onclickStr);
      }
      var rawMsg = messages[feature] || defaultMsg;
      // alert 文字列内に埋め込むため、シングルクォートと改行をエスケープ
      var escMsg = rawMsg.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      item.setAttribute('onclick',
        "alert('" + escMsg + "');closeSubMenu();"
      );
    } else {
      item.classList.remove('plan-disabled');
    }
  });
}
/** その他サブメニューのグレーアウトを全解除 */
function ungrayoutAllSubMenuItems(){
  document.querySelectorAll('.sub-menu .sub-item.plan-disabled').forEach(function(item){
    item.classList.remove('plan-disabled');
    var orig = item.getAttribute('data-original-onclick');
    if(orig) item.setAttribute('onclick', orig);
  });
}


// ===== プロフィール文編集モーダル =====
/** プロフィール文編集モーダルを開く */
async function openProfileTextEdit(){
  if(!currentUser)return;
  document.getElementById('pt-error').textContent='';
  document.getElementById('pt-success').style.display='none';
  // 現在の値を取得してフォームへ
  try{
    const{data:profile}=await supa.from('profiles').select('profile_text').eq('id',currentUser.id).single();
    var current = (profile && profile.profile_text) || '';
    var ta = document.getElementById('pt-textarea');
    ta.value = current;
    if(typeof updateProfileTextCount === 'function') updateProfileTextCount(ta, 'pt-counter');
  }catch(e){console.log('プロフィール文取得エラー:', e);}
  document.getElementById('profile-modal').classList.remove('show');
  document.getElementById('profile-text-edit-modal').classList.add('show');
}
/** プロフィール文編集モーダルを閉じる */
function closeProfileTextEdit(){
  document.getElementById('profile-text-edit-modal').classList.remove('show');
}

// ===== Web Push 通知のオン/オフ =====
/** Web Push の購読を取得し profiles.push_subscription に保存 */
async function enablePushNotifications(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  if(!window.VAPID_PUBLIC_KEY){ alert('通知機能は現在準備中です（VAPID未設定）'); return; }
  try{
    var sub = await subscribePush();
    if(!sub){
      alert('通知の許可が得られませんでした。ブラウザの設定で通知を許可してください。');
      return;
    }
    // PushSubscription を JSON 化（endpoint と keys を保持）
    var subJson = sub.toJSON();
    const { error } = await supa.from('profiles').update({
      push_subscription: subJson,
      push_subscribed_at: new Date().toISOString(),
    }).eq('id', currentUser.id);
    if(error){ alert('通知設定の保存に失敗しました：'+error.message); return; }
    // 再描画
    const { data: updated } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if(updated && typeof populateProfileModal === 'function') populateProfileModal(updated);
    alert('🔔 通知をオンにしました');
  }catch(e){
    console.log('enablePush error:', e);
    alert('通知設定中にエラーが発生しました');
  }
}

/** Push 購読を解除し DB からクリア */
async function disablePushNotifications(){
  if(!currentUser) return;
  if(!confirm('通知をオフにしますか？')) return;
  try{
    await unsubscribePush();
    const { error } = await supa.from('profiles').update({
      push_subscription: null,
      push_subscribed_at: null,
    }).eq('id', currentUser.id);
    if(error){ alert('通知設定の更新に失敗しました：'+error.message); return; }
    const { data: updated } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if(updated && typeof populateProfileModal === 'function') populateProfileModal(updated);
    alert('🔕 通知をオフにしました');
  }catch(e){
    console.log('disablePush error:', e);
    alert('通知設定中にエラーが発生しました');
  }
}

// ===== アバター画像の差し替え =====
// プロフィールモーダル内のアバターをクリック → ファイル選択 → Storage にアップロード → DB 更新
/** プロフィールモーダルからアバター画像を変更 @param {Event} e */
async function changeAvatar(e){
  var file = e && e.target && e.target.files ? e.target.files[0] : null;
  if(!file) return;
  if(!currentUser){ alert('ログインが必要です'); return; }
  // ファイルサイズチェック（5MB）
  if(file.size > 5 * 1024 * 1024){
    alert('画像サイズは 5MB 以内にしてください');
    e.target.value = '';
    return;
  }
  // アップロード中はモーダル内に状態表示
  var modAva = document.getElementById('modal-ava-img');
  var origDisplay = modAva ? modAva.style.opacity : '';
  if(modAva) modAva.style.opacity = '0.4';
  try{
    var res = await uploadAvatar(supa, currentUser.id, file);
    if(res.error || !res.url){
      alert('画像のアップロードに失敗しました：' + (res.error && res.error.message || '不明なエラー'));
      return;
    }
    // profiles を更新
    const { error } = await supa.from('profiles').update({ avatar_url: res.url }).eq('id', currentUser.id);
    if(error){
      alert('プロフィール更新エラー：' + error.message);
      return;
    }
    // モーダルを再描画（最新の profile を取り直す）
    const { data: updated } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if(updated && typeof populateProfileModal === 'function') populateProfileModal(updated);
  }catch(err){
    console.log('changeAvatar error:', err);
    alert('画像変更中にエラーが発生しました');
  }finally{
    if(modAva) modAva.style.opacity = origDisplay || '';
    e.target.value = '';  // 同じファイルを再選択しても onchange が発火するようにクリア
  }
}
/** プロフィール文を保存 */
async function saveProfileTextEdit(){
  if(!currentUser)return;
  var errEl=document.getElementById('pt-error'),okEl=document.getElementById('pt-success');
  errEl.textContent='';okEl.style.display='none';
  var btn=document.getElementById('pt-save-btn');
  var text=(document.getElementById('pt-textarea').value || '').trim();
  if(text.length > 500){
    errEl.textContent='500文字以内で入力してください（現在 '+text.length+' 文字）';
    return;
  }
  if(btn){btn.disabled=true;btn.textContent='保存中...';}
  try{
    const{error}=await supa.from('profiles').update({profile_text: text || null}).eq('id',currentUser.id);
    if(error){
      errEl.textContent='保存に失敗しました：'+error.message;
      if(btn){btn.disabled=false;btn.textContent='保存する';}
      return;
    }
    okEl.style.display='block';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
    // プロフィールモーダルを再描画
    const{data:updated}=await supa.from('profiles').select('*').eq('id',currentUser.id).single();
    if(updated && typeof populateProfileModal === 'function') populateProfileModal(updated);
    setTimeout(function(){
      closeProfileTextEdit();
      document.getElementById('profile-modal').classList.add('show');
    }, 900);
  }catch(e){
    console.log('プロフィール文保存エラー:', e);
    errEl.textContent='エラーが発生しました';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
  }
}

// ===== 生まれの情報編集モーダル =====
/** 生まれの編集モーダルのセレクトを初期化 */
function initBeSelects(){
  var pref=document.getElementById('be-pref');
  if(!pref||pref.options.length>0)return;
  var unk=document.createElement('option');
  unk.value='';unk.textContent='選択しない';
  pref.appendChild(unk);
  for(var i=0;i<PREFS.length;i++){
    var o=document.createElement('option');
    o.value=i;o.textContent=PREFS[i].name;
    pref.appendChild(o);
  }
  updBeCity();
}
/** 生まれ編集の都道府県→市区町村セレクト更新 */
function updBeCity(){
  var pref=document.getElementById('be-pref'),cs=document.getElementById('be-city');
  if(!pref||!cs)return;
  var pi=parseInt(pref.value);
  cs.innerHTML='';
  if(isNaN(pi)){
    var op=document.createElement('option');op.value='';op.textContent='—';
    cs.appendChild(op);cs.disabled=true;return;
  }
  cs.disabled=false;
  PREFS[pi].cities.forEach(function(c){
    var o=document.createElement('option');o.value=c.l;o.textContent=c.n;
    cs.appendChild(o);
  });
}
/** 生まれの編集モーダルを開く（現在値を読み込み） */
async function openBirthEdit(){
  if(!currentUser)return;
  initBeSelects();
  document.getElementById('be-error').textContent='';
  document.getElementById('be-success').style.display='none';
  // 現在値をフォームへ
  try{
    const{data:profile}=await supa.from('profiles').select('birth_hour,birth_min,birth_pref,birth_city').eq('id',currentUser.id).single();
    if(profile){
      document.getElementById('be-hr').value=(profile.birth_hour!=null)?profile.birth_hour:'';
      document.getElementById('be-mn').value=(profile.birth_min!=null)?profile.birth_min:'';
      var prefSel=document.getElementById('be-pref');
      prefSel.value='';
      if(profile.birth_pref){
        for(var i=0;i<PREFS.length;i++){
          if(PREFS[i].name===profile.birth_pref){prefSel.value=i;break;}
        }
      }
      updBeCity();
      if(profile.birth_city){
        var citySel=document.getElementById('be-city');
        for(var j=0;j<citySel.options.length;j++){
          if(citySel.options[j].textContent===profile.birth_city){citySel.selectedIndex=j;break;}
        }
      }
    }
  }catch(e){console.log('生まれの情報取得エラー:',e);}
  document.getElementById('profile-modal').classList.remove('show');
  document.getElementById('birth-edit-modal').classList.add('show');
}
/** 生まれ編集モーダルを閉じる */
function closeBirthEdit(){
  document.getElementById('birth-edit-modal').classList.remove('show');
}
/** 生まれの情報を保存 → 命式再計算 → DB 更新 */
async function saveBirthEdit(){
  if(!currentUser)return;
  var errEl=document.getElementById('be-error'),okEl=document.getElementById('be-success');
  errEl.textContent='';okEl.style.display='none';
  var btn=document.getElementById('be-save-btn');
  // 入力読み込み
  var hrRaw=document.getElementById('be-hr').value,mnRaw=document.getElementById('be-mn').value;
  var hr=hrRaw===''?null:parseInt(hrRaw);
  var mn=mnRaw===''?null:parseInt(mnRaw);
  if(hr!==null&&(isNaN(hr)||hr<0||hr>23)){errEl.textContent='生時は0〜23の範囲で入力してください';return;}
  if(mn!==null&&(isNaN(mn)||mn<0||mn>59)){errEl.textContent='生分は0〜59の範囲で入力してください';return;}
  if(hr!==null&&mn===null)mn=0;
  if(mn!==null&&hr===null)hr=0;
  var hasTime=(hr!==null);
  var prefSel=document.getElementById('be-pref'),citySel=document.getElementById('be-city');
  var prefVal=prefSel.value;
  var lonStr=citySel.value;
  var lon=lonStr===''?null:parseFloat(lonStr);
  var hasLon=(lon!==null&&!isNaN(lon)&&lon>0);
  var prefName=prefVal===''?null:PREFS[parseInt(prefVal)].name;
  var cityName=hasLon?citySel.options[citySel.selectedIndex].textContent:null;
  if(btn){btn.disabled=true;btn.textContent='保存中...';}
  try{
    // 命式再計算には生年月日が必要
    const{data:profile}=await supa.from('profiles').select('*').eq('id',currentUser.id).single();
    if(!profile){errEl.textContent='プロフィールの取得に失敗しました';if(btn){btn.disabled=false;btn.textContent='保存する';}return;}
    var newPillars=calcPillars(profile.birth_year,profile.birth_month,profile.birth_day,hr,mn,lon);
    var updateData={
      birth_hour:hasTime?hr:null,
      birth_min:hasTime?mn:null,
      birth_pref:prefName,
      birth_city:cityName,
      pillar_year_k:newPillars[0].k,pillar_year_s:newPillars[0].s,
      pillar_month_k:newPillars[1].k,pillar_month_s:newPillars[1].s,
      pillar_day_k:newPillars[2].k,pillar_day_s:newPillars[2].s,
      pillar_hour_k:newPillars[3]?newPillars[3].k:null,
      pillar_hour_s:newPillars[3]?newPillars[3].s:null
    };
    const{error}=await supa.from('profiles').update(updateData).eq('id',currentUser.id);
    if(error){errEl.textContent='保存に失敗しました：'+error.message;if(btn){btn.disabled=false;btn.textContent='保存する';}return;}
    // メモリ更新と画面の再描画
    var merged=Object.assign({},profile,updateData);
    populateProfileModal(merged);
    if(typeof loadRealUsers==='function')loadRealUsers();
    okEl.style.display='block';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
    setTimeout(function(){closeBirthEdit();document.getElementById('profile-modal').classList.add('show');},900);
  }catch(e){
    console.log('生まれの情報保存エラー:',e);
    errEl.textContent='エラーが発生しました';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
  }
}

// ===== 卒業申請：プランページの状態表示と申請モーダル =====
// この関数は openSubPage('plan') 時と、ポーリング/プロフィール再描画時に呼ばれる
/** プラン画面の卒業申請ステータスを再取得・反映 */
async function refreshSotsugyouState(){
  var card = document.getElementById('sotsugyou-card');
  var badge = document.getElementById('sotsugyou-badge');
  var area = document.getElementById('sotsugyou-status-area');
  if(!card || !badge || !area) return;
  if(!currentUser) return;

  // カップル成立中のマッチを検索
  var coupledPartner = null;
  try{
    var{data:cp1}=await supa.from('matches').select('id,from_user_id,to_user_id').eq('from_user_id',currentUser.id).eq('status','coupled').limit(1);
    var{data:cp2}=await supa.from('matches').select('id,from_user_id,to_user_id').eq('to_user_id',currentUser.id).eq('status','coupled').limit(1);
    var match = (cp1&&cp1[0])||(cp2&&cp2[0])||null;
    if(match){
      var partnerId = match.from_user_id===currentUser.id ? match.to_user_id : match.from_user_id;
      var{data:partner}=await supa.from('profiles').select('id,member_id,nickname').eq('id',partnerId).single();
      if(partner) coupledPartner = {match_id:match.id,...partner};
    }
  }catch(e){console.log('coupled match lookup error:',e);}

  // 自分の申請を取得
  var myReq = null;
  try{
    var{data:reqs}=await supa.from('sotsugyou_requests').select('*').eq('user_id',currentUser.id).limit(1);
    if(reqs&&reqs[0]) myReq = reqs[0];
  }catch(e){console.log('my sotsugyou request lookup error:',e);}

  // 相手の申請（自分が partner_user_id になっているもの）
  var partnerReq = null;
  if(myReq){
    try{
      var{data:pReqs}=await supa.from('sotsugyou_requests').select('*').eq('user_id',myReq.partner_user_id).eq('partner_user_id',currentUser.id).limit(1);
      if(pReqs&&pReqs[0]) partnerReq = pReqs[0];
    }catch(e){console.log('partner sotsugyou request lookup error:',e);}
  }

  // 卒業認定ステータスを最新化（運営側で認定された直後も反映できるよう毎回フェッチ）
  var prevGraduated = (typeof myIsGraduated !== 'undefined') ? myIsGraduated : false;
  if(typeof loadMyGraduationStatus === 'function'){
    try{ await loadMyGraduationStatus(); }catch(e){}
  }
  // 認定状態が変化していたら applyPlanUI を再実行（卒業生の間 サブメニューを更新）
  if(myIsGraduated !== prevGraduated && typeof applyPlanUI === 'function' && typeof myPlan !== 'undefined'){
    try{ applyPlanUI(myPlan); }catch(e){}
  }

  // ===== ステータス判定 =====
  // graduated は他のどの状態よりも優先
  var state = 'no_couple'; // no_couple / can_apply / waiting_partner / waiting_admin / approved / rejected / graduated
  if(myIsGraduated){
    state = 'graduated';
  }else if(myReq){
    if(myReq.status==='approved') state='approved';
    else if(myReq.status==='rejected') state='rejected';
    else if(partnerReq && partnerReq.status!=='rejected') state='waiting_admin';
    else state='waiting_partner';
  }else if(coupledPartner){
    state='can_apply';
  }

  // ===== カードの解放表示制御 =====
  var ln = card.querySelector('.lock-notice');
  // 既存の「特典付与」メッセージがあれば一旦削除（状態切替で再生成するため）
  var existingGrant = card.querySelector('.grad-grant-msg');
  if(existingGrant) existingGrant.remove();
  if(state==='approved' || state==='graduated'){
    card.classList.remove('locked');
    card.style.borderColor='#C9A96E';card.style.opacity='1';card.style.filter='none';
    var nm=card.querySelector('.other-plan-nm');if(nm)nm.style.color='#C9A96E';
    var pr=card.querySelector('.other-plan-price');if(pr)pr.style.color='';
    var it=card.querySelector('.other-plan-items');if(it)it.style.color='';
    if(ln)ln.style.display='none';
    badge.className='plan-status-badge unlocked';
    badge.style.cssText='';
    if(state==='graduated'){
      badge.textContent='申込済';
      // 特典リストの下に「4つの特典の権利が付与されました！」を追加（赤・めでたい雰囲気）
      if(it){
        var grant = document.createElement('div');
        grant.className = 'grad-grant-msg';
        grant.style.cssText = 'margin-top:.6rem;padding:8px 12px;border-radius:8px;background:rgba(192,80,80,.08);border:0.5px solid rgba(192,80,80,.35);color:#C05050;font-weight:600;font-size:12px;text-align:center;letter-spacing:.02em';
        grant.textContent = '🎊 4つの特典の権利が付与されました！';
        it.parentNode.insertBefore(grant, it.nextSibling);
      }
    }else{
      badge.textContent='申込可';
    }
  }else{
    card.classList.add('locked');
    card.style.borderColor='';card.style.opacity='';card.style.filter='';
    var nm2=card.querySelector('.other-plan-nm');if(nm2)nm2.style.color='';
    var pr2=card.querySelector('.other-plan-price');if(pr2)pr2.style.color='var(--color-text-tertiary)';
    var it2=card.querySelector('.other-plan-items');if(it2)it2.style.color='var(--color-text-tertiary)';
    if(ln)ln.style.display='';
    badge.className='plan-status-badge';
    badge.style.cssText='background:rgba(150,150,150,.15);color:var(--color-text-tertiary);border:0.5px solid var(--color-border-tertiary)';
    badge.textContent='🔒 未解放';
  }

  // ===== ステータスエリアのHTML構築 =====
  var html = '';
  if(state==='no_couple'){
    html += '<button class="btn-sotsugyou locked" disabled>🔒 卒業申請フォーム（カップル成立後に解放）</button>';
  }else if(state==='can_apply'){
    var partnerLabel = coupledPartner.nickname + 'さん（' + coupledPartner.member_id + '）';
    html += '<button class="btn-sotsugyou available" onclick="openSotsugyouRequest()" style="background:#C9A96E;color:#fff;border:none">📝 卒業申請を行う</button>';
    html += '<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-top:.4rem;line-height:1.7">対象のお相手：'+partnerLabel+'</div>';
  }else if(state==='waiting_partner'){
    html += '<div style="background:rgba(255,180,50,.08);border:0.5px solid rgba(255,180,50,.4);border-radius:8px;padding:10px 14px;margin-top:.25rem">';
    html += '<div style="font-size:12px;color:#d4940a;font-weight:500;margin-bottom:4px">📤 申請を送信しました</div>';
    html += '<div style="font-size:11px;color:var(--color-text-secondary);line-height:1.7">'+escapeText(myReq.partner_nickname||'お相手')+'さんの申請をお待ちしています。<br>お相手にも卒業申請のご送信をお願いしてください。</div>';
    html += '<div style="text-align:center;margin-top:.6rem"><button onclick="cancelSotsugyouRequest(\''+myReq.id+'\')" style="font-size:10px;padding:4px 12px;border:0.5px solid var(--color-border-tertiary);background:transparent;color:var(--color-text-tertiary);border-radius:6px;cursor:pointer">申請を取り消す</button></div>';
    html += '</div>';
  }else if(state==='waiting_admin'){
    html += '<div style="background:rgba(201,169,110,.08);border:0.5px solid rgba(201,169,110,.4);border-radius:8px;padding:10px 14px;margin-top:.25rem">';
    html += '<div style="font-size:12px;color:#C9A96E;font-weight:500;margin-bottom:4px">⏳ 双方の申請を確認しました</div>';
    html += '<div style="font-size:11px;color:var(--color-text-secondary);line-height:1.7">運営にて確認のうえ、承認後にプランが解放されます。<br>承認後、メッセージにてご連絡いたします。</div>';
    html += '</div>';
  }else if(state==='approved'){
    html += '<button class="btn-sotsugyou available" style="background:#C9A96E;color:#fff;border:none" onclick="openSotsugyouApply()">📝 卒業鑑定プランを申し込む</button>';
    html += '<div style="font-size:10px;color:#C9A96E;text-align:center;margin-top:.4rem">✓ 運営の承認が下りました</div>';
  }else if(state==='graduated'){
    // 卒業認定済 → 申込ボタンを「卒業認定済み」グレーアウト表示に置換
    html += '<button class="btn-sotsugyou" disabled style="opacity:.6;cursor:default;background:rgba(58,154,58,.12);color:#3a9a3a;border:0.5px solid rgba(58,154,58,.4)">🎓 卒業認定済み</button>';
    html += '<div style="font-size:10px;color:#3a9a3a;text-align:center;margin-top:.4rem;line-height:1.7">✓ 卒業鑑定をお受けいただきありがとうございました<br>NOマッチングプランへ切替で「卒業生の間」へご参加いただけます</div>';
  }else if(state==='rejected'){
    html += '<div style="background:rgba(192,80,80,.06);border:0.5px solid rgba(192,80,80,.3);border-radius:8px;padding:10px 14px;margin-top:.25rem">';
    html += '<div style="font-size:12px;color:#C05050;font-weight:500;margin-bottom:4px">⚠️ 申請が却下されました</div>';
    html += '<div style="font-size:11px;color:var(--color-text-secondary);line-height:1.7">理由：'+escapeText(myReq.rejection_reason||'（記載なし）')+'</div>';
    html += '<div style="text-align:center;margin-top:.6rem"><button onclick="reapplyTangSotsugyou(\''+myReq.id+'\')" style="font-size:11px;padding:6px 14px;border:0.5px solid #C9A96E;background:transparent;color:#C9A96E;border-radius:6px;cursor:pointer">再申請する</button></div>';
    html += '</div>';
  }
  area.innerHTML = html;

  // ステータス算出のため一時的に保持
  window._sotsugyouCtx = {coupledPartner:coupledPartner,myReq:myReq,partnerReq:partnerReq,state:state};
}

// escapeText は js/utils.js で escapeHtml のエイリアスとして提供される

/** 卒業申請モーダルを開く */
function openSotsugyouRequest(){
  var ctx = window._sotsugyouCtx;
  if(!ctx || !ctx.coupledPartner){alert('カップル成立済みの相手が見つかりません');return;}
  document.getElementById('sr-partner-display').textContent = (ctx.coupledPartner.nickname||'?') + 'さん（' + (ctx.coupledPartner.member_id||'?') + '）';
  document.getElementById('sr-error').textContent = '';
  document.getElementById('sr-submit-btn').disabled = false;
  document.getElementById('sr-submit-btn').textContent = '申請を送信する';
  document.getElementById('sotsugyou-request-modal').classList.add('show');
}

/** 卒業申請モーダルを閉じる */
function closeSotsugyouRequest(){
  document.getElementById('sotsugyou-request-modal').classList.remove('show');
}

/** 卒業申請を送信（パートナー情報入力 → DB INSERT） */
async function submitSotsugyouRequest(){
  var ctx = window._sotsugyouCtx;
  if(!ctx || !ctx.coupledPartner){return;}
  var errEl = document.getElementById('sr-error');
  var btn = document.getElementById('sr-submit-btn');
  errEl.textContent = '';
  btn.disabled = true;btn.textContent = '送信中...';
  try{
    // 自分のプロフィール
    var{data:me}=await supa.from('profiles').select('member_id,nickname').eq('id',currentUser.id).single();
    const{error}=await supa.from('sotsugyou_requests').insert({
      user_id:currentUser.id,
      member_id:me?me.member_id:memberID,
      nickname:me?me.nickname:null,
      partner_user_id:ctx.coupledPartner.id,
      partner_member_id:ctx.coupledPartner.member_id,
      partner_nickname:ctx.coupledPartner.nickname,
      match_id:ctx.coupledPartner.match_id
    });
    if(error){errEl.textContent='送信に失敗しました：'+error.message;btn.disabled=false;btn.textContent='申請を送信する';return;}
    closeSotsugyouRequest();
    addNotif('【運営】卒業申請を受け付けました','お相手の申請が揃い次第、運営にて確認・承認いたします。');
    addOfficialMessage('卒業申請を受け付けました。お相手の申請が揃い次第、運営にて確認・承認いたします。');
    refreshSotsugyouState();
  }catch(e){
    console.log('卒業申請送信エラー:',e);
    errEl.textContent='エラーが発生しました';
    btn.disabled=false;btn.textContent='申請を送信する';
  }
}

/** 自分の卒業申請を取り下げ @param {string} id */
async function cancelSotsugyouRequest(id){
  if(!confirm('卒業申請を取り消しますか？'))return;
  try{
    const{error}=await supa.from('sotsugyou_requests').delete().eq('id',id);
    if(error){alert('取り消しに失敗しました：'+error.message);return;}
    refreshSotsugyouState();
  }catch(e){console.log('cancel sotsugyou error:',e);alert('エラーが発生しました');}
}

// ===== 卒業鑑定プラン お申し込みモーダル =====
/** 卒業鑑定プラン申し込みモーダルを開く */
function openSotsugyouApply(){
  if(!currentUser){alert('ログインしてください');return;}
  // 既存値のリセット
  document.getElementById('sa-payer-name').value='';
  // 振込予定日のデフォルトを今日に
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth()+1).padStart(2,'0');
  var dd = String(today.getDate()).padStart(2,'0');
  document.getElementById('sa-paid-date').value = yyyy+'-'+mm+'-'+dd;
  document.getElementById('sa-method').selectedIndex = 0;
  updateSaMethodNote();
  document.getElementById('sa-questions').value='';
  document.getElementById('sa-error').textContent='';
  document.getElementById('sa-success').style.display='none';
  document.getElementById('sa-submit-btn').disabled = false;
  document.getElementById('sa-submit-btn').textContent = 'お申し込みを送信する';
  document.getElementById('sotsugyou-apply-modal').classList.add('show');
  // 初回のみ案内ポップアップ（ユーザーごと・端末ごとに1回）
  try{
    var noticeKey = 'sotsugyou_apply_notice_v1_' + (currentUser && currentUser.id ? currentUser.id : 'anon');
    if(!localStorage.getItem(noticeKey)){
      setTimeout(function(){
        alert('卒業鑑定は、基本的にお相手の方と一緒にお受け頂くことが前提のプランになります。ですが、別々に鑑定をご希望の場合も承りますので、その際は鑑定予約で「1人で受ける」をご選択ください。');
        try{ localStorage.setItem(noticeKey, '1'); }catch(e){}
      }, 100);
    }
  }catch(e){ /* localStorage 不可なら無視 */ }
}

/** 申し込みモーダルを閉じる */
function closeSotsugyouApply(){
  document.getElementById('sotsugyou-apply-modal').classList.remove('show');
}

// 鑑定方法セレクトの変更時：「対面」選択なら出張費の注意書きを表示
/** 鑑定方法（対面/オンライン）に応じた注意書きを更新 */
function updateSaMethodNote(){
  var sel = document.getElementById('sa-method');
  var note = document.getElementById('sa-method-note');
  if(!sel || !note) return;
  note.style.display = (sel.value === '対面') ? 'block' : 'none';
}

/** 卒業鑑定プラン申し込みを送信 */
async function submitSotsugyouApply(){
  if(!currentUser){alert('ログインが必要です');return;}
  var errEl=document.getElementById('sa-error');
  var okEl=document.getElementById('sa-success');
  errEl.textContent='';okEl.style.display='none';
  var btn=document.getElementById('sa-submit-btn');

  var payerName=document.getElementById('sa-payer-name').value.trim();
  var paidDate=document.getElementById('sa-paid-date').value.trim();
  var method=document.getElementById('sa-method').value;
  var questions=document.getElementById('sa-questions').value.trim();
  if(!payerName){errEl.textContent='振込名義人のお名前を入力してください';return;}
  if(!paidDate){errEl.textContent='振込予定日を入力してください';return;}
  btn.disabled=true;btn.textContent='送信中...';

  // 申し込み情報を contacts へ '卒業鑑定申込' タイプで保存
  // (運営が問い合わせ管理タブで確認 → 入金確認後に対応する想定)
  var bodyText='【卒業鑑定プランお申し込み】\n'+
    '振込名義人：'+payerName+'\n'+
    '振込予定日：'+paidDate+'\n'+
    '鑑定方法：'+method+'\n'+
    (questions?'特に聞きたいこと：\n'+questions:'特に聞きたいこと：（記載なし）');
  try{
    const{data:me}=await supa.from('profiles').select('member_id,nickname').eq('id',currentUser.id).single();
    const{error}=await supa.from('contacts').insert({
      user_id:currentUser.id,
      member_id:me?me.member_id:memberID,
      nickname:me?me.nickname:null,
      contact_type:'卒業鑑定申込',
      body:bodyText
    });
    if(error){errEl.textContent='送信に失敗しました：'+error.message;btn.disabled=false;btn.textContent='お申し込みを送信する';return;}
    okEl.style.display='block';
    addOfficialMessage('卒業鑑定プランのお申し込みを受け付けました。\n運営にて入金を確認次第、鑑定の日程についてご連絡いたします。');
    addNotif('【運営】卒業鑑定プランのお申し込みを受け付けました','入金確認後、改めてご連絡いたします。');
    btn.textContent='お申し込みを送信する';
    setTimeout(function(){closeSotsugyouApply();},1200);
  }catch(e){
    console.log('卒業鑑定申込エラー:',e);
    errEl.textContent='エラーが発生しました';
    btn.disabled=false;btn.textContent='お申し込みを送信する';
  }
}

/** 卒業鑑定申し込みの再申請 @param {string} id */
async function reapplyTangSotsugyou(id){
  // 却下された申請を削除して再申請可能な状態にする
  if(!confirm('却下された申請を取り消して、再度申請できるようにしますか？'))return;
  try{
    const{error}=await supa.from('sotsugyou_requests').delete().eq('id',id);
    if(error){alert('処理に失敗しました：'+error.message);return;}
    refreshSotsugyouState();
  }catch(e){console.log('reapply sotsugyou error:',e);alert('エラーが発生しました');}
}
/** ベル通知パネルの表示切替 + 既読化 */
function toggleNotif(){var p=document.getElementById('notif-panel');if(!p)return;p.classList.toggle('show');if(p.classList.contains('show')){document.getElementById('notif-dot').style.display='none';document.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});}}
/** アプリ内通知（ベル）に追加 @param {string} title @param {string} body */
function addNotif(title,body){
  var list=document.getElementById('notif-list');
  if(!list)return;
  var item=document.createElement('div');
  item.className='notif-item unread';
  item.innerHTML='<div class="notif-item-title">'+title+'</div><div class="notif-item-body">'+body+'</div><div class="notif-item-time">just now</div>';
  list.insertBefore(item,list.firstChild);
  document.getElementById('notif-dot').style.display='block';
  // ツタ演出は msg-badge 表示と完全連動に変更したため、ここでは呼ばない
  // (updateMsgTabBadge 内で「非表示→表示」遷移時にのみ発火)
}

/** ツタ演出のための定数群 */
var VINE_FX_COLORS = [
  { stroke: '#8FB342', glow: 'rgba(143,179,66,.4)', name: 'green' },   // 黄緑
  { stroke: '#E29659', glow: 'rgba(226,150,89,.4)', name: 'orange' }   // 橙
];
/** ロゴ上の出発点(overlay viewBox 座標, 400x100)
 *  - green: ロゴ左端の小さな渦 ≒ 外側端
 *  - orange: ロゴ右端の大きな渦 ≒ 外側端 */
var VINE_FX_LOGO_ENDS = {
  green:  { x: 236, y: 26 },
  orange: { x: 287, y: 22 }
};
/** ターゲット座標(overlay viewBox 座標) */
var VINE_FX_TARGETS = {
  oshi:   { x: 50,  y: 75 },
  enlist: { x: 150, y: 75 },
  msg:    { x: 250, y: 75 },
  bell:   { x: 325, y: 22 }
};

/** スクリーン座標を overlay SVG の viewBox 座標に変換 */
function _vineFxScreenToOverlay(screenX, screenY){
  var overlay = document.querySelector('.vine-fx-overlay');
  if(!overlay || !overlay.getScreenCTM) return null;
  var ctm = overlay.getScreenCTM();
  if(!ctm) return null;
  try{
    var pt = overlay.createSVGPoint();
    pt.x = screenX; pt.y = screenY;
    return pt.matrixTransform(ctm.inverse());
  }catch(_){ return null; }
}

/** ロゴ上の指定色のツタ先端(path 開始点)の overlay 座標を動的に取得
 *  (CSS sway transform も込みで getScreenCTM が正確に解決してくれる) */
function _vineFxGetLogoTipPos(colorName){
  var fallback = VINE_FX_LOGO_ENDS[colorName];
  var logoSvg = document.querySelector('.topbar-logo svg');
  if(!logoSvg) return fallback;
  // 色マッチング(stroke 属性で判定)
  var targetStroke = (colorName === 'green') ? '#8FB342' : '#E29659';
  var paths = logoSvg.querySelectorAll('path');
  var targetPath = null;
  for(var i = 0; i < paths.length; i++){
    var stroke = paths[i].getAttribute('stroke');
    if(stroke && stroke.toUpperCase() === targetStroke.toUpperCase()){
      targetPath = paths[i];
      break;
    }
  }
  if(!targetPath || !targetPath.getPointAtLength || !targetPath.getScreenCTM) return fallback;
  try{
    // パスの開始点(M)を取得
    var localPt = targetPath.getPointAtLength(0);
    // パスの screenCTM で screen 座標へ
    var ctm = targetPath.getScreenCTM();
    if(!ctm) return fallback;
    var svgPt = logoSvg.createSVGPoint();
    svgPt.x = localPt.x; svgPt.y = localPt.y;
    var screenPt = svgPt.matrixTransform(ctm);
    // overlay 座標に変換
    var overlayPt = _vineFxScreenToOverlay(screenPt.x, screenPt.y);
    return overlayPt ? { x: overlayPt.x, y: overlayPt.y } : fallback;
  }catch(_){ return fallback; }
}

/** 推しタブのゴールドポッチ表示切替(縁リスト/メッセージは既存バッジを使う)
 *  @param {boolean} show */
function setOshiBadge(show){
  var el = document.getElementById('oshi-badge');
  if(el) el.style.display = show ? 'block' : 'none';
  var bniEl = document.getElementById('bni-oshi-badge');
  if(bniEl) bniEl.style.display = show ? 'block' : 'none';
}

/** ターゲット要素の中心の overlay 座標を動的に取得 */
function _vineFxGetTargetPos(target){
  var fallback = VINE_FX_TARGETS[target];
  var sel = {
    oshi:   '.ntab[data-tab="oshi"]',
    enlist: '.ntab[data-tab="enlist"]',
    msg:    '.ntab[data-tab="msg"]',
    bell:   '.notif-icon'
  }[target];
  if(!sel) return fallback;
  var el = document.querySelector(sel);
  if(!el) return fallback;
  var rect = el.getBoundingClientRect();
  if(rect.width === 0 || rect.height === 0) return fallback;
  var screenX = rect.left + rect.width / 2;
  var screenY = rect.top + rect.height / 2;
  var overlayPt = _vineFxScreenToOverlay(screenX, screenY);
  return overlayPt ? { x: overlayPt.x, y: overlayPt.y } : fallback;
}

/** ターゲットごとの楕円サイズ倍率 */
var VINE_FX_LOOP_SIZE = {
  oshi:   3.0,  // 最も遠い → 大きい楕円
  enlist: 1.5,
  msg:    1.0   // 最も近い → 標準
};

/** 滑らかな曲線(ループなし)でツタ経路を構築 */
function _buildVineFxPathSmooth(s, e){
  var dx = e.x - s.x;
  var dy = e.y - s.y;
  var len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
  // 線分に垂直な単位ベクトル
  var perpX = -dy / len;
  var perpY = dx / len;
  // ランダムにカーブの「曲がり方向」を決める
  var sign = Math.random() < 0.5 ? 1 : -1;
  // カーブ深さ(線分長に比例)
  var depth1 = (15 + Math.random() * 10) * sign;
  var depth2 = (10 + Math.random() * 10) * sign;
  // C ベジェの2つの制御点
  var c1x = s.x + dx * 0.3 + perpX * depth1;
  var c1y = s.y + dy * 0.3 + perpY * depth1;
  var c2x = s.x + dx * 0.7 + perpX * depth2;
  var c2y = s.y + dy * 0.7 + perpY * depth2;
  return 'M' + s.x.toFixed(1) + ',' + s.y.toFixed(1)
       + ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1)
       + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1)
       + ' ' + e.x.toFixed(1) + ',' + e.y.toFixed(1);
}

/** ループ(伸びる方向に細長く回転した楕円)を途中に挟むツタ経路を構築
 *  入口/出口は pTop(進行方向の真横、楕円の「上」)に設定
 *  → 接線が進行方向と一致 → アプローチ・ループ・脱出が一筆書きに繋がる
 *  ループは進行方向の片側(perpendicular CCW)にぶら下がる
 *  @param {{x:number,y:number}} s 起点
 *  @param {{x:number,y:number}} e 終点
 *  @param {string} target サイズ倍率算出に使う */
function _buildVineFxPathLoopy(s, e, target){
  // ループ回数: 1 or 2(ランダム)
  var loops = 1 + Math.floor(Math.random() * 2);
  // ループ中心: 起点と終点の 45% 地点
  var midX = s.x + (e.x - s.x) * 0.45;
  var midY = s.y + (e.y - s.y) * 0.45;
  // ターゲットごとの倍率(遠いほど大きい)
  var mul = VINE_FX_LOOP_SIZE[target] || 1.0;
  // ベース楕円(長軸 rx > 短軸 ry の細長楕円)
  var baseRx = 9 * mul * (0.9 + Math.random() * 0.2);
  var baseRy = 4 * mul * (0.9 + Math.random() * 0.2);
  // 進行方向 angle、 cos/sin と垂直単位ベクトル
  var angle = Math.atan2(e.y - s.y, e.x - s.x);
  var cos = Math.cos(angle), sin = Math.sin(angle);
  // ループの「ぶら下がる方向」(perpendicular CCW or CW をランダムに)
  // 進行方向に細長く + 片側にループがぶら下がる ⇒ 一筆書きの軌道
  var perpSide = Math.random() < 0.5 ? 1 : -1;
  /** ローカル(回転前)座標 → ワールド座標へ変換
   *  perpSide=+1 でローカル -y 方向(上)が ぶら下がる側 */
  function world(lx, ly){
    var ly2 = ly * perpSide;
    return {
      x: midX + lx * cos - ly2 * sin,
      y: midY + lx * sin + ly2 * cos
    };
  }
  // 楕円の4端点
  var pRight  = world( baseRx,  0);          // 進行方向 +
  var pTop    = world( 0,      -baseRy);     // ぶら下がり方向(入口/出口)
  var pLeft   = world(-baseRx,  0);          // 進行方向 -
  var pBottom = world( 0,       baseRy);     // ぶら下がりの反対側
  // 制御点(楕円のコーナー = bounding box 4隅)
  var cTR = world( baseRx, -baseRy);
  var cTL = world(-baseRx, -baseRy);
  var cBL = world(-baseRx,  baseRy);
  var cBR = world( baseRx,  baseRy);

  // ===== 一筆書きの構造 =====
  // 起点 ──進行方向──→ pTop  ◯◯ループCW360° ◯◯  pTop ──進行方向──→ 終点
  //                            (進行接線:travel direction で連続)
  //
  // 入口/出口での接線 = 進行方向 ⇒ アプローチ・脱出と loop が滑らかに繋がる
  // ループは pTop からぶら下がる(片側のみ)⇒ メインの線と別レイヤーに見える

  var d = 'M' + s.x.toFixed(1) + ',' + s.y.toFixed(1);

  // 1) 起点 → pTop: C ベジェで、pTop での接線 = 進行方向(cos,sin)
  // control2 = pTop - k * (cos, sin) で接線を保証
  var startToTopDx = pTop.x - s.x, startToTopDy = pTop.y - s.y;
  var startToTopDist = Math.max(1, Math.sqrt(startToTopDx*startToTopDx + startToTopDy*startToTopDy));
  var k1 = Math.min(startToTopDist * 0.45, baseRx * 1.6);
  var ap1x = s.x + k1 * startToTopDx / startToTopDist;
  var ap1y = s.y + k1 * startToTopDy / startToTopDist;
  var k2 = Math.min(startToTopDist * 0.45, baseRx * 1.4);
  var ap2x = pTop.x - k2 * cos;
  var ap2y = pTop.y - k2 * sin;
  d += ' C' + ap1x.toFixed(1) + ',' + ap1y.toFixed(1)
       + ' ' + ap2x.toFixed(1) + ',' + ap2y.toFixed(1)
       + ' ' + pTop.x.toFixed(1) + ',' + pTop.y.toFixed(1);

  // 2) ループ N 回(pTop → pRight → pBottom → pLeft → pTop の順、Q ベジェで楕円近似)
  for(var i = 0; i < loops; i++){
    d += ' Q' + cTR.x.toFixed(1) + ',' + cTR.y.toFixed(1) + ' ' + pRight.x.toFixed(1) + ',' + pRight.y.toFixed(1);
    d += ' Q' + cBR.x.toFixed(1) + ',' + cBR.y.toFixed(1) + ' ' + pBottom.x.toFixed(1) + ',' + pBottom.y.toFixed(1);
    d += ' Q' + cBL.x.toFixed(1) + ',' + cBL.y.toFixed(1) + ' ' + pLeft.x.toFixed(1) + ',' + pLeft.y.toFixed(1);
    d += ' Q' + cTL.x.toFixed(1) + ',' + cTL.y.toFixed(1) + ' ' + pTop.x.toFixed(1) + ',' + pTop.y.toFixed(1);
  }

  // 3) pTop → 終点: C ベジェで、pTop での接線 = 進行方向(cos,sin)
  // control1 = pTop + k * (cos, sin) で接線を保証
  var topToEndDx = e.x - pTop.x, topToEndDy = e.y - pTop.y;
  var topToEndDist = Math.max(1, Math.sqrt(topToEndDx*topToEndDx + topToEndDy*topToEndDy));
  var k3 = Math.min(topToEndDist * 0.45, baseRx * 1.4);
  var ex1x = pTop.x + k3 * cos;
  var ex1y = pTop.y + k3 * sin;
  var k4 = Math.min(topToEndDist * 0.45, baseRx * 1.6);
  var ex2x = e.x - k4 * topToEndDx / topToEndDist;
  var ex2y = e.y - k4 * topToEndDy / topToEndDist;
  d += ' C' + ex1x.toFixed(1) + ',' + ex1y.toFixed(1)
       + ' ' + ex2x.toFixed(1) + ',' + ex2y.toFixed(1)
       + ' ' + e.x.toFixed(1) + ',' + e.y.toFixed(1);

  return d;
}

/** 経路ビルダー: 50% の確率で楕円ループ、50% で滑らか曲線 */
function buildVineFxPath(s, e, target){
  if(Math.random() < 0.5){
    return _buildVineFxPathLoopy(s, e, target);
  }
  return _buildVineFxPathSmooth(s, e);
}

/** ===== ツタ演出キュー(同時に複数発火しても1本ずつ順番にタッチする) ===== */
var VINE_FX_QUEUE = [];
var VINE_FX_RUNNING = false;

/** ツタ演出を発火(キュー経由・同時複数は順番に処理)
 *  @param {'oshi'|'enlist'|'msg'} target */
function growVineFx(target){
  // bell は廃止(近すぎてごちゃつくため)
  if(target === 'bell') return;
  // キューに重複追加しない(同じターゲットが連続要求された場合のスパム防止)
  if(VINE_FX_QUEUE.indexOf(target) >= 0) return;
  VINE_FX_QUEUE.push(target);
  if(!VINE_FX_RUNNING){
    _processVineFxQueue();
  }
}

/** キューを1本ずつ処理 */
function _processVineFxQueue(){
  if(VINE_FX_QUEUE.length === 0){
    VINE_FX_RUNNING = false;
    return;
  }
  VINE_FX_RUNNING = true;
  var target = VINE_FX_QUEUE.shift();
  _runVineFxAnimation(target);
  // 全体時間(成長 + ホールド + フェード + バッファ)後に次を処理
  var growMs = 1400, holdMs = 600, fadeMs = 500, buffer = 200;
  setTimeout(_processVineFxQueue, growMs + holdMs + fadeMs + buffer);
}

/** 実際のアニメーションを実行(キュー内部から呼ばれる) */
function _runVineFxAnimation(target){
  var path = document.getElementById('vine-fx-' + target);
  if(!path) return;
  // 色をランダム選択
  var c = VINE_FX_COLORS[Math.floor(Math.random() * VINE_FX_COLORS.length)];
  // 動的に起点と終点を取得
  var startPos = _vineFxGetLogoTipPos(c.name);
  var endPos = _vineFxGetTargetPos(target);
  var d = buildVineFxPath(startPos, endPos, target);
  path.setAttribute('d', d);
  path.style.stroke = c.stroke;
  path.style.filter = 'drop-shadow(0 0 1px ' + c.glow + ')';

  // パス全長を計測
  var len;
  try { len = path.getTotalLength(); }
  catch(_){ len = 400; }

  // 初期状態(完全に消えた線)
  path.style.transition = 'none';
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;
  path.style.opacity = '1';
  void path.getBoundingClientRect();

  // 成長アニメーション
  var growMs = 1400, holdMs = 600, fadeMs = 500;
  path.style.transition = 'stroke-dashoffset ' + growMs + 'ms cubic-bezier(.22,.61,.36,1)';
  path.style.strokeDashoffset = '0';

  // 一定時間後にフェードアウト
  setTimeout(function(){
    path.style.transition = 'opacity ' + fadeMs + 'ms ease';
    path.style.opacity = '0';
  }, growMs + holdMs);
}
// ===== 退会申請 =====
/** 既存の open な退会申請があれば、送信ボタンを「退会申請済み」に切替 + 「取り消す」ボタン表示 */
async function refreshCancelButtonState(){
  var btn = document.getElementById('cancel-submit-btn');
  var revokeBtn = document.getElementById('cancel-revoke-btn');
  if(!btn || !currentUser) return;
  try{
    var{data}=await supa.from('contacts')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('contact_type', '退会申請')
      .eq('status', 'open')
      .limit(1);
    if(data && data.length > 0){
      // 申請済みの状態: 送信ボタン無効化 + 取り消すボタン表示
      btn.disabled = true;
      btn.textContent = '退会申請済み';
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
      if(revokeBtn) revokeBtn.style.display = 'block';
    }else{
      // 未申請の状態: 送信ボタンのみ表示
      btn.disabled = false;
      btn.textContent = '退会申請を送信する';
      btn.style.opacity = '';
      btn.style.cursor = '';
      if(revokeBtn) revokeBtn.style.display = 'none';
    }
  }catch(e){ console.log('refreshCancelButtonState error:', e); }
}

/** 退会申請の取り消し（ユーザー側） */
async function cancelWithdrawalRequest(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  if(!confirm('退会申請を取り消します。よろしいですか？')) return;
  var revokeBtn = document.getElementById('cancel-revoke-btn');
  if(revokeBtn){ revokeBtn.disabled = true; revokeBtn.textContent = '取り消し中...'; }
  try{
    var{data, error}=await supa.rpc('cancel_withdrawal_request');
    if(error){
      alert('取り消しに失敗しました: ' + error.message);
      if(revokeBtn){ revokeBtn.disabled = false; revokeBtn.textContent = '退会申請を取り消す'; }
      return;
    }
    var cancelledCount = (data && data.cancelled_count) || 0;
    if(cancelledCount === 0){
      // 既に承認/取り消し済みのケース
      alert('現在 open な退会申請が見つかりませんでした。');
    }else{
      // 運営チャットに通知 + ベル通知
      if(typeof addOfficialMessage === 'function'){
        addOfficialMessage('退会申請を取り消しました。');
      }
      if(typeof addNotif === 'function'){
        addNotif('【運営】退会申請を取り消しました', '引き続き縁の間をご利用ください。');
      }
      alert('退会申請を取り消しました。');
    }
    // ボタン状態を更新
    if(revokeBtn){ revokeBtn.disabled = false; revokeBtn.textContent = '退会申請を取り消す'; }
    await refreshCancelButtonState();
  }catch(e){
    console.log('cancelWithdrawalRequest error:', e);
    alert('エラーが発生しました');
    if(revokeBtn){ revokeBtn.disabled = false; revokeBtn.textContent = '退会申請を取り消す'; }
  }
}

/** 退会申請の送信 */
async function submitCancelRequest(){
  var reason = document.getElementById('cancel-reason').value;
  var detail = (document.getElementById('cancel-detail').value || '').trim();
  var confirmed = document.getElementById('cancel-confirm').checked;
  var errEl = document.getElementById('cancel-error');
  var okEl = document.getElementById('cancel-success');
  errEl.textContent = '';
  okEl.style.display = 'none';
  if(!currentUser){ alert('ログインが必要です'); return; }
  if(!reason){ errEl.textContent = '退会理由を選択してください'; return; }
  if(!confirmed){ errEl.textContent = '確認事項に同意してください'; return; }
  if(!confirm('退会申請を送信します。よろしいですか？\n運営にて確認後、退会処理を実施いたします。')) return;
  var btn = document.getElementById('cancel-submit-btn');
  btn.disabled = true; btn.textContent = '送信中...';
  try{
    const{data:me}=await supa.from('profiles').select('member_id,nickname').eq('id',currentUser.id).single();
    var bodyText = '【退会申請】\n理由：' + reason + (detail ? '\n詳細・改善希望：\n' + detail : '');
    const{error}=await supa.from('contacts').insert({
      user_id: currentUser.id,
      member_id: me ? me.member_id : memberID,
      nickname: me ? me.nickname : null,
      contact_type: '退会申請',
      body: bodyText
    });
    if(error){
      errEl.textContent = '送信に失敗しました：' + error.message;
      btn.disabled = false; btn.textContent = '退会申請を送信する';
      return;
    }
    okEl.style.display = 'block';
    addOfficialMessage('退会申請を受け付けました。\n運営にて内容を確認後、退会処理を実施いたします。');
    addNotif('【運営】退会申請を受け付けました', '確認後、退会処理を実施いたします。');
    // フォームをクリア
    document.getElementById('cancel-reason').value = '';
    document.getElementById('cancel-detail').value = '';
    document.getElementById('cancel-confirm').checked = false;
    document.getElementById('cancel-detail-count').textContent = '0';
    // 送信ボタンを「退会申請済み」状態に + 取り消すボタンを表示
    btn.disabled = true;
    btn.textContent = '退会申請済み';
    btn.style.opacity = '0.55';
    btn.style.cursor = 'not-allowed';
    var revokeBtn = document.getElementById('cancel-revoke-btn');
    if(revokeBtn) revokeBtn.style.display = 'block';
  }catch(e){
    console.log('退会申請エラー:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false; btn.textContent = '退会申請を送信する';
  }
}

// ===== 会員通報 =====
// 通報フォームを開いて対象会員IDを自動入力（ユーザー間UIから呼び出される）
/** 指定会員IDの相手の通報フォームを開く @param {string} memberId */
function openReportFor(memberId){
  openSubPage('report');
  var input = document.getElementById('rp-target-id');
  if(input){
    input.value = memberId || '';
    setTimeout(function(){ try{ input.focus(); }catch(e){} }, 100);
  }
  var errEl = document.getElementById('rp-error');
  if(errEl) errEl.textContent = '';
  var okEl = document.getElementById('rp-success');
  if(okEl) okEl.style.display = 'none';
}

/** 通報を送信（bot対策 + reports INSERT） */
async function submitReport(){
  var targetMid=document.getElementById('rp-target-id').value.trim();
  var category=document.getElementById('rp-category').value;
  var body=document.getElementById('rp-body').value.trim();
  var errEl=document.getElementById('rp-error');
  var okEl=document.getElementById('rp-success');
  errEl.textContent='';okEl.style.display='none';
  if(!currentUser){alert('ログインが必要です');return;}
  if(!targetMid){errEl.textContent='通報対象の会員IDを入力してください';return;}
  if(!/^EN-\d{8}$/.test(targetMid)){errEl.textContent='会員IDの形式が正しくありません（例：EN-12345678）';return;}
  if(targetMid===memberID){errEl.textContent='ご自身を通報することはできません';return;}
  if(!category){errEl.textContent='通報理由を選択してください';return;}
  if(!body){errEl.textContent='詳細を入力してください';return;}
  // bot/連投対策: 通報は 60 秒に 1 回まで
  var botReason=checkBotDefense({rateKey:'report', rateMs:60*1000});
  if(botReason){ errEl.textContent=botReason; return; }
  var btn=document.getElementById('rp-submit-btn');
  btn.disabled=true;btn.textContent='送信中...';
  try{
    // 対象ユーザーを会員IDから検索
    const{data:targets,error:lookupErr}=await supa.rpc('lookup_user_by_member_id',{p_member_id:targetMid});
    if(lookupErr){errEl.textContent='ユーザー検索エラー：'+lookupErr.message;btn.disabled=false;btn.textContent='通報する';return;}
    if(!targets||targets.length===0){errEl.textContent='指定された会員IDのユーザーが見つかりません';btn.disabled=false;btn.textContent='通報する';return;}
    var target=targets[0];
    // 通報者プロフィール
    const{data:me}=await supa.from('profiles').select('member_id,nickname').eq('id',currentUser.id).single();
    // reports テーブルへINSERT
    const{error:insertErr}=await supa.from('reports').insert({
      reporter_id:currentUser.id,
      target_user_id:target.id,
      reporter_member_id:me?me.member_id:null,
      reporter_nickname:me?me.nickname:null,
      target_member_id:targetMid,
      target_nickname:target.nickname,
      reason_category:category,
      body:body
    });
    if(insertErr){errEl.textContent='送信に失敗しました：'+insertErr.message;btn.disabled=false;btn.textContent='通報する';return;}
    // 成功
    recordRateLimitHit('report');
    okEl.style.display='block';
    addOfficialMessage('通報を受け付けました（対象：'+targetMid+' / 理由：'+category+'）。運営が内容を確認次第、対応いたします。');
    addNotif('【運営】通報を受け付けました','内容を確認次第、対応いたします。');
    document.getElementById('rp-target-id').value='';
    document.getElementById('rp-category').value='';
    document.getElementById('rp-body').value='';
    btn.disabled=false;btn.textContent='通報する';
  }catch(e){
    console.log('通報送信エラー:',e);
    errEl.textContent='送信中にエラーが発生しました';
    btn.disabled=false;btn.textContent='通報する';
  }
}

/** お問い合わせフォームの送信（bot対策 + モデレーション + contacts INSERT） */
async function submitContact(){
  var type=document.getElementById('contact-type').value;
  var body=document.getElementById('contact-body').value.trim();
  var nick=document.getElementById('contact-nick').value.trim();
  var mid=document.getElementById('contact-id').value.trim();
  if(!type){alert('問い合わせ内容を選択してください');return;}
  if(!body){alert('詳細内容を入力してください');return;}
  if(!currentUser){alert('ログインが必要です');return;}
  // bot/連投対策: 問い合わせは 30 秒に 1 回まで
  var botReason=checkBotDefense({rateKey:'contact', rateMs:30*1000});
  if(botReason){ alert(botReason); return; }
  // 規約違反検知（問い合わせ本文に他SNSのID等が含まれてないか）
  // ※ 運営連絡には電話番号OKなので、より緩く適用：警告のみ、ブロックはしない
  var modCheck = checkModeration(body);
  if(!modCheck.ok){
    if(!confirm(formatModerationWarning(modCheck.hits) + '\n\nこのまま送信しますか？')) return;
  }
  try{
    const{error}=await supa.from('contacts').insert({
      user_id:currentUser.id,
      member_id:mid||memberID||null,
      nickname:nick||null,
      contact_type:type,
      body:body
    });
    if(error){alert('送信に失敗しました：'+error.message);return;}
    recordRateLimitHit('contact');
    document.getElementById('contact-sent').style.display='block';
    // 公式チャットに自分の質問を追加（運営からの返答は管理者が返信した時点で取り込まれる）
    officialMessages.push({from:'user',text:'【'+type+'】\n'+body});
    addOfficialMessage('お問い合わせ（'+type+'）を受け付けました。内容を確認次第、こちらのチャットにてご返答いたします。');
    addNotif('【運営】お問い合わせを受け付けました','メッセージページの運営チャットにてご返答いたします。');
    // フォームをクリア
    document.getElementById('contact-type').value='';
    document.getElementById('contact-body').value='';
  }catch(e){
    console.log('問い合わせ送信エラー:',e);
    alert('送信中にエラーが発生しました');
  }
}
/** その他サブメニューの開閉 @param {Event=} e */
function toggleSubMenu(e){if(e)e.stopPropagation();var el=document.getElementById('sub-menu');if(el)el.classList.toggle('show');}
/** その他サブメニューを閉じる */
function closeSubMenu(){var el=document.getElementById('sub-menu');if(el)el.classList.remove('show');}
/** 「その他」配下のサブページを開く @param {string} page */
function openSubPage(page){
  // プラン制限：お試しプランは相性診断・結果メモ・運勢カレンダーを使えない
  if(myPlan === 'trial' && ['shindan','memo','calendar'].indexOf(page) >= 0){
    alert('この機能はお試しプランではご利用いただけません。\n「プラン」から変更してご利用ください。');
    return;
  }
  // 相性タブのサブタブUIを隠す（その他経由の通常表示時）
  var aishouTabs = document.getElementById('aishou-sub-tabs');
  if(aishouTabs) aishouTabs.style.display = 'none';
  ['plan','omoi','voice','contact','shindan','memo','calendar','refer','report','cancel'].forEach(function(p){
    var el=document.getElementById('sub-'+p);
    if(el)el.style.display='none';
  });
  var target=document.getElementById('sub-'+page);
  if(target)target.style.display='block';
  document.querySelectorAll('.screen').forEach(function(s,i){s.classList.toggle('on',i===3);});
  // 退会ページ表示時: 申請済みなら送信ボタンを「退会申請済み」に
  if(page === 'cancel' && typeof refreshCancelButtonState === 'function') refreshCancelButtonState();
  // 「その他」は .other-tab-btn なので、.ntab はすべて非アクティブにする
  document.querySelectorAll('.ntab').forEach(function(t){t.classList.remove('on');});
  document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.add('on');});
  // 下部ナビ（.bni）は順序が固定なので index 3 でOK
  document.querySelectorAll('.bni').forEach(function(b,i){b.classList.toggle('on',i===3);});
  // プランページを開いた時：3プラン一覧を myPlan に応じて描画
  if(page==='plan' && typeof renderPlansList === 'function'){
    renderPlansList();
  }
  // 相性診断ページを初めて開いた時に都道府県セレクトを初期化
  if(page==='shindan'){
    var sp=document.getElementById('sh-pref');
    if(sp&&sp.options.length===0)initShPrefs();
  }
  // 相性結果メモページを開いた時はリストを再描画
  if(page==='memo'){
    if(typeof renderMemoList==='function')renderMemoList();
  }
  // 運勢カレンダーページを開いた時に初期化
  if(page==='calendar'){
    if(typeof openCalendar==='function')openCalendar();
  }
  // 紹介ページ：QRコードと紹介リスト
  if(page==='refer'){
    renderReferPage();
  }
  // プランページ：卒業申請の状態を更新
  if(page==='plan'){
    if(typeof refreshSotsugyouState==='function')refreshSotsugyouState();
  }
}

// ===== 紹介ページ：QRコード生成と紹介リスト表示 =====
/** 紹介リンク URL を構築（自分の会員IDを ref パラメータに） @returns {string} */
function buildReferUrl(){
  // 現在のURLを基準に #register?ref=EN-XXXX のリンクを生成
  var base=window.location.origin+window.location.pathname;
  return base+'#register?ref='+encodeURIComponent(memberID||'');
}
/** 紹介ページの描画（QRコード + リンク + 紹介済みリスト） */
function renderReferPage(){
  var idEl=document.getElementById('refer-member-id');
  if(idEl)idEl.textContent=memberID||'EN-—';
  // QRコード生成（重複防止のためクリア）
  var qrBox=document.getElementById('refer-qr');
  if(qrBox){
    qrBox.innerHTML='';
    if(typeof QRCode!=='undefined'&&memberID){
      try{
        new QRCode(qrBox,{text:buildReferUrl(),width:180,height:180,correctLevel:QRCode.CorrectLevel.M});
      }catch(e){console.log('QR生成エラー:',e);qrBox.textContent='QR生成に失敗しました';}
    }else{
      qrBox.style.color='#999';qrBox.style.fontSize='11px';qrBox.textContent='読み込み中…';
    }
  }
  // 紹介した人の一覧
  loadReferList();
}
/** 自分が紹介した人のリストを取得 */
async function loadReferList(){
  var listEl=document.getElementById('refer-list');
  if(!listEl||!currentUser||!memberID)return;
  try{
    const{data,error}=await supa.from('profiles').select('nickname,member_id').eq('referrer_id',memberID);
    if(error){listEl.textContent='読み込みに失敗しました';return;}
    if(!data||data.length===0){
      listEl.innerHTML='<div style="color:var(--color-text-tertiary);font-size:11px">まだ紹介された方はいません。</div>';
      return;
    }
    var html='';
    data.forEach(function(u){
      html+='<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-primary);padding:4px 0;border-bottom:0.5px solid var(--color-border-tertiary)"><span>'+(u.nickname||'')+'さん</span><span style="font-family:\'Noto Serif JP\',serif;font-size:11px;color:var(--color-text-tertiary);letter-spacing:.05em">'+(u.member_id||'')+'</span></div>';
    });
    listEl.innerHTML=html;
  }catch(e){console.log('紹介リスト取得エラー:',e);listEl.textContent='読み込みに失敗しました';}
}
/** 紹介URLをクリップボードにコピー */
function copyReferLink(){
  var url=buildReferUrl();
  var btn=document.getElementById('refer-copy-btn');
  var original=btn?btn.textContent:'';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){
      if(btn){btn.textContent='✓ コピーしました';setTimeout(function(){btn.textContent=original;},1500);}
    }).catch(function(){promptCopy(url,btn,original);});
  }else{
    promptCopy(url,btn,original);
  }
}
/** コピー成功時のフィードバック表示 */
function promptCopy(url,btn,original){
  window.prompt('紹介リンクをコピーしてください：',url);
  if(btn){btn.textContent='✓ 表示しました';setTimeout(function(){btn.textContent=original;},1500);}
}

// ===== デモ用：自分が紹介した人が卒業した想定の通知発火 =====
/** デモ用：キャッシュバック対象状態にする（開発用） */
function demoTriggerCashback(){
  if(!currentUser){alert('ログインしてください');return;}
  var key='cashback_eligible_'+currentUser.id;
  if(localStorage.getItem(key)==='1'){
    alert('既にキャッシュバック対象になっています。プロフィール画面から口座情報を登録してください。');
    return;
  }
  localStorage.setItem(key,'1');
  addNotif('【運営】キャッシュバック対象になりました','あなたが紹介した方が卒業されました🎊 3,690円のキャッシュバックを承ります。プロフィール画面から振込先口座をご登録ください。');
  addOfficialMessage('あなたが紹介した方が無事卒業されました！🎊 3,690円のキャッシュバックをご用意しております。プロフィール画面の「口座情報を追加」より振込先をご登録ください。');
  // プロフィールモーダルを再描画して「口座情報を追加」ボタンを反映
  supa.from('profiles').select('*').eq('id',currentUser.id).single().then(function(res){
    if(res.data)populateProfileModal(res.data);
  });
}

// ===== 銀行口座情報の編集モーダル =====
/** 銀行口座編集モーダルを開く */
function openBankEdit(){
  if(!currentUser)return;
  document.getElementById('bk-error').textContent='';
  document.getElementById('bk-success').style.display='none';
  // 現在値を埋める
  supa.from('profiles').select('bank_name,bank_branch,bank_account_type,bank_account_number,bank_account_holder').eq('id',currentUser.id).single().then(function(res){
    if(res.data){
      document.getElementById('bk-name').value=res.data.bank_name||'';
      document.getElementById('bk-branch').value=res.data.bank_branch||'';
      document.getElementById('bk-type').value=res.data.bank_account_type||'普通';
      document.getElementById('bk-number').value=res.data.bank_account_number||'';
      document.getElementById('bk-holder').value=res.data.bank_account_holder||'';
    }
  });
  document.getElementById('profile-modal').classList.remove('show');
  document.getElementById('bank-edit-modal').classList.add('show');
}
/** 銀行口座編集モーダルを閉じる */
function closeBankEdit(){
  document.getElementById('bank-edit-modal').classList.remove('show');
}
/** 銀行口座情報を保存 */
async function saveBankEdit(){
  if(!currentUser)return;
  var errEl=document.getElementById('bk-error'),okEl=document.getElementById('bk-success');
  errEl.textContent='';okEl.style.display='none';
  var btn=document.getElementById('bk-save-btn');
  var name=document.getElementById('bk-name').value.trim();
  var branch=document.getElementById('bk-branch').value.trim();
  var type=document.getElementById('bk-type').value;
  var number=document.getElementById('bk-number').value.trim();
  var holder=document.getElementById('bk-holder').value.trim();
  if(!name||!branch||!number||!holder){errEl.textContent='銀行名・支店名・口座番号・名義人は必須です';return;}
  if(!/^\d{4,8}$/.test(number)){errEl.textContent='口座番号は4〜8桁の数字で入力してください';return;}
  if(btn){btn.disabled=true;btn.textContent='保存中...';}
  try{
    const{error}=await supa.from('profiles').update({
      bank_name:name,bank_branch:branch,bank_account_type:type,
      bank_account_number:number,bank_account_holder:holder
    }).eq('id',currentUser.id);
    if(error){errEl.textContent='保存に失敗しました：'+error.message;if(btn){btn.disabled=false;btn.textContent='保存する';}return;}
    okEl.style.display='block';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
    // プロフィールモーダルを再描画
    const{data:profile}=await supa.from('profiles').select('*').eq('id',currentUser.id).single();
    if(profile)populateProfileModal(profile);
    setTimeout(function(){closeBankEdit();document.getElementById('profile-modal').classList.add('show');},900);
  }catch(e){
    console.log('口座情報保存エラー:',e);
    errEl.textContent='エラーが発生しました';
    if(btn){btn.disabled=false;btn.textContent='保存する';}
  }
}
