// ===== UI: その他（プラン・お問い合わせ・通知・サブメニュー・生まれの情報編集） =====

// ===== 生まれの情報編集モーダル =====
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
function closeBirthEdit(){
  document.getElementById('birth-edit-modal').classList.remove('show');
}
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

function unlockSotsugyou(){
  var card=document.getElementById('sotsugyou-card');
  if(!card)return; // template未展開
  // 既に解放済みなら何もしない（ポーリングで何度呼ばれても重複処理を回避）
  if(!card.classList.contains('locked'))return;

  var badge=document.getElementById('sotsugyou-badge');
  var btn=document.getElementById('sotsugyou-btn');

  // ===== DOM 解放表示 =====
  card.classList.remove('locked');
  card.style.borderColor='#C9A96E';
  card.style.opacity='1';
  card.style.filter='none';
  card.querySelector('.other-plan-nm').style.color='#C9A96E';
  card.querySelector('.other-plan-price').style.color='';
  card.querySelector('.other-plan-items').style.color='';
  var ln=card.querySelector('.lock-notice');
  if(ln)ln.style.display='none';
  badge.className='plan-status-badge unlocked';
  badge.textContent='申込可';
  btn.textContent='卒業申請フォームを開く →';
  btn.classList.remove('locked');
  btn.classList.add('available');
  btn.disabled=false;
  btn.onclick=function(){
    btn.textContent='卒業申請済み ✓';
    btn.classList.remove('available');
    btn.classList.add('done');
    btn.disabled=true;
    addNotif('【運営】卒業申請を受け付けました','内容確認後、改めてご連絡いたします。');
  };

  // ===== 通知（ユーザーごとに初回のみ。ページ更新で重複しないよう localStorage に記録）=====
  var notifKey='sotsugyou_notif_'+(currentUser?currentUser.id:'guest');
  if(!localStorage.getItem(notifKey)){
    localStorage.setItem(notifKey,'1');
    addNotif('【運営】卒業申請が可能になりました','おめでとうございます！卒業鑑定プランの申し込みが解放されました。');
    addOfficialMessage('おめでとうございます！🎊 卒業鑑定プランのご申し込みが可能になりました。「その他」→「プラン」からご申請いただけます。');
  }
}
function toggleNotif(){var p=document.getElementById('notif-panel');if(!p)return;p.classList.toggle('show');if(p.classList.contains('show')){document.getElementById('notif-dot').style.display='none';document.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});}}
function addNotif(title,body){var list=document.getElementById('notif-list');if(!list)return;var item=document.createElement('div');item.className='notif-item unread';item.innerHTML='<div class="notif-item-title">'+title+'</div><div class="notif-item-body">'+body+'</div><div class="notif-item-time">just now</div>';list.insertBefore(item,list.firstChild);document.getElementById('notif-dot').style.display='block';}
async function submitContact(){
  var type=document.getElementById('contact-type').value;
  var body=document.getElementById('contact-body').value.trim();
  var nick=document.getElementById('contact-nick').value.trim();
  var mid=document.getElementById('contact-id').value.trim();
  if(!type){alert('問い合わせ内容を選択してください');return;}
  if(!body){alert('詳細内容を入力してください');return;}
  if(!currentUser){alert('ログインが必要です');return;}
  try{
    const{error}=await supa.from('contacts').insert({
      user_id:currentUser.id,
      member_id:mid||memberID||null,
      nickname:nick||null,
      contact_type:type,
      body:body
    });
    if(error){alert('送信に失敗しました：'+error.message);return;}
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
function toggleSubMenu(e){if(e)e.stopPropagation();var el=document.getElementById('sub-menu');if(el)el.classList.toggle('show');}
function closeSubMenu(){var el=document.getElementById('sub-menu');if(el)el.classList.remove('show');}
function openSubPage(page){
  ['plan','omoi','voice','contact','shindan','memo','calendar','refer'].forEach(function(p){
    var el=document.getElementById('sub-'+p);
    if(el)el.style.display='none';
  });
  var target=document.getElementById('sub-'+page);
  if(target)target.style.display='block';
  document.querySelectorAll('.screen').forEach(function(s,i){s.classList.toggle('on',i===3);});
  document.querySelectorAll('.ntab').forEach(function(t,i){t.classList.toggle('on',i===3);});
  document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.add('on');});
  document.querySelectorAll('.bni').forEach(function(b,i){b.classList.toggle('on',i===3);});
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
}

// ===== 紹介ページ：QRコード生成と紹介リスト表示 =====
function buildReferUrl(){
  // 現在のURLを基準に #register?ref=EN-XXXX のリンクを生成
  var base=window.location.origin+window.location.pathname;
  return base+'#register?ref='+encodeURIComponent(memberID||'');
}
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
function promptCopy(url,btn,original){
  window.prompt('紹介リンクをコピーしてください：',url);
  if(btn){btn.textContent='✓ 表示しました';setTimeout(function(){btn.textContent=original;},1500);}
}

// ===== デモ用：自分が紹介した人が卒業した想定の通知発火 =====
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
function closeBankEdit(){
  document.getElementById('bank-edit-modal').classList.remove('show');
}
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
