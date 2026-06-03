// ===== アフィリエイター登録・ダッシュボード =====
// 専用の隠しルート ?affiliate=1 から登録する。通常登録画面には一切案内を出さない。
// アフィリエイター = is_affiliate=true（恒久）。サービスは使えないが、通常登録もすれば兼用になれる。

/** アフィリエイト専用登録の入口か（?affiliate=1） @returns {boolean} */
function isAffiliateEntry(){
  try{
    return /[?&]affiliate=1\b/.test(window.location.search) ||
           window.location.hash.indexOf('#affiliate') === 0;
  }catch(e){ return false; }
}

/** アフィリエイター会員ID 'EN-AF######'（6桁ランダム）を生成 */
function generateAffiliateMemberID(){
  var n='';
  for(var i=0;i<6;i++) n+=Math.floor(Math.random()*10);
  return 'EN-AF'+n;
}

/** 画面をすべて隠してから指定ラッパーだけ表示 */
function _showOnlyWrap(id){
  ['login-wrap','plan-select-wrap','orient-wrap','reg-wrap','app-wrap','email-confirm-wrap','affiliate-reg-wrap','affiliate-dash-wrap'].forEach(function(w){
    var el=document.getElementById(w);
    if(el) el.style.display='none';
  });
  var t=document.getElementById(id);
  if(t) t.style.display = (id==='login-wrap'||id==='plan-select-wrap') ? 'flex' : 'block';
}

/** アフィリエイト登録画面を表示し、都道府県セレクトを初期化 */
function showAffiliateRegister(){
  _showOnlyWrap('affiliate-reg-wrap');
  if(typeof initAffPrefs === 'function') initAffPrefs();
}

/** アフィリエイター用ログアウト（ログアウト後はアフィリ登録/ログイン画面 ?affiliate=1 に戻す） */
async function affiliateLogout(){
  if(!confirm('ログアウトしますか？')) return;
  try{
    if(typeof stopRealtime==='function') stopRealtime();
    if(typeof pollingTimer!=='undefined' && pollingTimer){ clearInterval(pollingTimer); pollingTimer=null; }
    await supa.auth.signOut();
  }catch(e){ console.log('アフィリログアウトエラー:', e); }
  window.location.href = window.location.pathname + '?affiliate=1';
}

/** アフィリ登録画面からログイン画面へ */
function showLoginFromAffiliate(){
  var a=document.getElementById('affiliate-reg-wrap'); if(a) a.style.display='none';
  var l=document.getElementById('login-wrap'); if(l) l.style.display='flex';
}

/** アフィリエイト登録画面の性別ボタン切替 */
function setAffSex(el){
  var row = el.closest('.sexrow');
  if(row) row.querySelectorAll('.sxbtn').forEach(function(b){ b.classList.remove('on'); });
  el.classList.add('on');
}

/** アフィリ登録画面の都道府県/市区町村セレクト（任意項目） */
function initAffPrefs(){
  var s=document.getElementById('aff-pref');
  if(!s || s.options.length>0) { return; }
  var unknown=document.createElement('option'); unknown.value=''; unknown.textContent='選択しない'; s.appendChild(unknown);
  for(var i=0;i<PREFS.length;i++){
    var o=document.createElement('option'); o.value=i; o.textContent=PREFS[i].name; s.appendChild(o);
  }
  updAffCity();
}
function updAffCity(){
  var pi=parseInt(document.getElementById('aff-pref').value);
  var cs=document.getElementById('aff-city');
  if(!cs) return;
  cs.innerHTML='';
  if(isNaN(pi)){
    var op=document.createElement('option'); op.value=''; op.textContent='選択しない'; cs.appendChild(op); cs.disabled=true; return;
  }
  cs.disabled=false;
  var none=document.createElement('option'); none.value=''; none.textContent='選択しない'; cs.appendChild(none);
  PREFS[pi].cities.forEach(function(c){
    var o=document.createElement('option'); o.value=c.l; o.textContent=c.n; cs.appendChild(o);
  });
}

/** アフィリエイター登録を送信 */
async function registerAffiliate(){
  var errEl=document.getElementById('aff-error');
  if(errEl) errEl.textContent='';
  var btn=document.getElementById('aff-submit-btn');

  var email=(typeof toHalfWidth==='function'?toHalfWidth(_affVal('aff-email')):_affVal('aff-email')).trim();
  var password=_affVal('aff-password');
  var phoneRaw=(typeof toHalfWidth==='function'?toHalfWidth(_affVal('aff-phone')):_affVal('aff-phone')).trim();
  var phone=phoneRaw.replace(/[-\s]/g,'');
  var nick=_affVal('aff-nick').trim();
  var sexEl=document.querySelector('#aff-sex-row .sxbtn.on');
  var sex=sexEl?sexEl.textContent:'';
  var yr=parseInt(_affVal('aff-yr')), mo=parseInt(_affVal('aff-mo')), dy=parseInt(_affVal('aff-dy'));

  // 必須チェック
  if(!email||!password){ _affErr('メールアドレスとパスワードを入力してください'); return; }
  if(password.length<6){ _affErr('パスワードは6文字以上にしてください'); return; }
  if(!nick){ _affErr('ニックネームを入力してください'); return; }
  if(!sex){ _affErr('性別を選択してください'); return; }
  if(!phone){ _affErr('電話番号を入力してください'); return; }
  if(!/^0\d{9,10}$/.test(phone)){ _affErr('電話番号は0から始まる10〜11桁の数字で入力してください'); return; }
  if(!yr||!mo||!dy){ _affErr('誕生日（年・月・日）を入力してください'); return; }

  // 任意: 出生時刻・出生地
  var hrRaw=_affVal('aff-hr'), mnRaw=_affVal('aff-mn');
  var hr=hrRaw===''?null:parseInt(hrRaw);
  var mn=mnRaw===''?null:parseInt(mnRaw);
  if(hr!==null&&isNaN(hr)) hr=null;
  if(mn!==null&&isNaN(mn)) mn=null;
  if(hr!==null&&mn===null) mn=0;
  var hasTime=(hr!==null);
  var prefSel=document.getElementById('aff-pref'), citySel=document.getElementById('aff-city');
  var prefVal=prefSel?prefSel.value:'';
  var lonStr=citySel?citySel.value:'';
  var lon=lonStr===''?null:parseFloat(lonStr);
  var hasLon=(lon!==null&&!isNaN(lon)&&lon>0);
  var birthPref=prefVal===''?null:PREFS[parseInt(prefVal)].name;
  var birthCity=hasLon?citySel.options[citySel.selectedIndex].text:null;

  if(btn){ btn.disabled=true; btn.textContent='登録中...'; }

  // 退会処分電話番号チェック
  try{
    var{data:isBanned}=await supa.rpc('is_phone_banned',{p_phone:phone});
    if(isBanned===true){ _affErr('この電話番号は登録できません。'); _affReset(btn); return; }
  }catch(e){ console.log('phone ban check (aff) error:', e); }

  // auth signUp
  var redirectUrl=window.location.origin+window.location.pathname+'?affiliate=1';
  var signRes;
  try{
    signRes=await supa.auth.signUp({ email, password, options:{ emailRedirectTo: redirectUrl } });
  }catch(e){ _affErr('登録に失敗しました'); _affReset(btn); return; }
  if(signRes.error){ _affErr('登録エラー：'+signRes.error.message); _affReset(btn); return; }
  var data=signRes.data;
  currentUser=data.user;
  if(!currentUser){ _affErr('登録に失敗しました。もう一度お試しください。'); _affReset(btn); return; }

  var affMemberID=generateAffiliateMemberID();
  memberID=affMemberID;
  mySex=sex;
  var pillars=calcPillars(yr,mo,dy,hasTime?hr:null,hasTime?mn:null,hasLon?lon:null);

  var profileData={
    id: currentUser.id,
    member_id: affMemberID,
    nickname: nick,
    sex: sex,
    birth_year: yr, birth_month: mo, birth_day: dy,
    birth_hour: hasTime?hr:null, birth_min: hasTime?mn:null,
    birth_pref: birthPref, birth_city: birthCity,
    pillar_year_k: pillars[0].k, pillar_year_s: pillars[0].s,
    pillar_month_k: pillars[1].k, pillar_month_s: pillars[1].s,
    pillar_day_k: pillars[2].k, pillar_day_s: pillars[2].s,
    pillar_hour_k: pillars[3]?pillars[3].k:null, pillar_hour_s: pillars[3]?pillars[3].s:null,
    phone_number: phone,
    plan: null,                 // アフィリは plan なし（サービス不可）
    is_affiliate: true,
    affiliate_at: new Date().toISOString()
  };

  // メール認証ON時は session が無い → localStorage に保留して初回ログインで INSERT
  var isEmailConfirmRequired = !data.session && !!data.user;
  if(isEmailConfirmRequired){
    try{ localStorage.setItem('pending_profile_'+currentUser.id, JSON.stringify(profileData)); }catch(e){}
    // 確認メール案内（既存の email-confirm-wrap を流用できるなら表示、無ければ alert）
    alert('確認メールを送信しました。メール内のリンクから登録を完了してください。');
    _affReset(btn);
    return;
  }

  try{
    var{error:insErr}=await supa.from('profiles').insert(profileData);
    if(insErr){ _affErr('プロフィール保存に失敗しました：'+insErr.message); _affReset(btn); return; }
  }catch(e){ _affErr('保存中にエラーが発生しました'); _affReset(btn); return; }

  showAffiliateDashboard(profileData);
}

function _affVal(id){ var el=document.getElementById(id); return el?(el.value||''):''; }
function _affErr(msg){ var e=document.getElementById('aff-error'); if(e) e.textContent=msg; }
function _affReset(btn){ if(btn){ btn.disabled=false; btn.textContent='アフィリエイターとして登録'; } }

/** アフィリ用 紹介リンク（自分の EN-AF 会員IDを ref に） */
function affiliateReferUrl(){
  var base=window.location.origin+window.location.pathname;
  return base+'#register?ref='+encodeURIComponent(memberID||'');
}

/** アフィリエイターのダッシュボードを表示 */
async function showAffiliateDashboard(profile){
  _showOnlyWrap('affiliate-dash-wrap');
  if(profile){ memberID=profile.member_id||memberID; window._affiliateProfile = profile; }
  var idEl=document.getElementById('aff-dash-memberid');
  if(idEl) idEl.textContent=memberID||'EN-AF—';

  // QRコード
  var qrBox=document.getElementById('aff-dash-qr');
  if(qrBox){
    qrBox.innerHTML='';
    if(typeof QRCode!=='undefined'&&memberID){
      try{ new QRCode(qrBox,{text:affiliateReferUrl(),width:170,height:170,correctLevel:QRCode.CorrectLevel.M}); }
      catch(e){ qrBox.textContent='QR生成に失敗しました'; }
    }
  }
  loadAffiliateReferList();
}

/** 紹介リンクをコピー */
function copyAffiliateLink(){
  var url=affiliateReferUrl();
  var btn=document.getElementById('aff-copy-btn');
  var original=btn?btn.textContent:'';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){
      if(btn){ btn.textContent='✓ コピーしました'; setTimeout(function(){ btn.textContent=original; },1500); }
    }).catch(function(){ window.prompt('紹介リンクをコピーしてください：',url); });
  }else{
    window.prompt('紹介リンクをコピーしてください：',url);
  }
}

/** 紹介した人の一覧＋簡易キャッシュバック状況を表示 */
async function loadAffiliateReferList(){
  var listEl=document.getElementById('aff-dash-list');
  var sumEl=document.getElementById('aff-dash-summary');
  if(!currentUser||!memberID) return;
  try{
    var{data:refs,error}=await supa.from('profiles')
      .select('nickname,member_id,plan,banned_at,withdrawal_type,graduated_at')
      .eq('referrer_id',memberID);
    if(error){ if(listEl) listEl.textContent='読み込みに失敗しました'; return; }
    refs=refs||[];
    // ステータス分類 + 月額30%見込み合計（利用中のみ）
    var PRICE={ trial:963, no_matching:1693, total:2369 };
    var active=0, withdrawn=0, graduated=0, monthlyEst=0;
    refs.forEach(function(u){
      var isGrad = (u.withdrawal_type==='approved') || !!u.graduated_at;
      var isBanned = !!u.banned_at && !isGrad;
      if(isGrad){ graduated++; }
      else if(isBanned){ withdrawn++; }
      else { active++; if(u.plan && PRICE[u.plan]) monthlyEst += Math.floor(PRICE[u.plan]*0.30); }
    });
    if(sumEl){
      sumEl.innerHTML =
        '<div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:.6rem">'+
        '<div><div style="font-size:18px;font-weight:700;color:#C9A96E">'+refs.length+'</div><div style="font-size:10px;color:var(--color-text-tertiary)">紹介人数</div></div>'+
        '<div><div style="font-size:18px;font-weight:700;color:#3a9a3a">'+active+'</div><div style="font-size:10px;color:var(--color-text-tertiary)">利用中</div></div>'+
        '<div><div style="font-size:18px;font-weight:700;color:#C9A96E">¥'+monthlyEst.toLocaleString()+'</div><div style="font-size:10px;color:var(--color-text-tertiary)">今月の30%見込み</div></div>'+
        '</div>'+
        '<div style="font-size:10px;color:var(--color-text-tertiary);line-height:1.6;text-align:center">卒業で1人 6,930円＋利用中は月額の30%（運営より振込）</div>';
    }
    if(listEl){
      if(refs.length===0){ listEl.innerHTML='<div style="color:var(--color-text-tertiary);font-size:11px;text-align:center;padding:1rem">まだ紹介された方はいません。</div>'; return; }
      var html='';
      refs.forEach(function(u){
        var isGrad=(u.withdrawal_type==='approved')||!!u.graduated_at;
        var isBanned=!!u.banned_at&&!isGrad;
        var st = isGrad?'卒業済':(isBanned?'退会済':'利用中');
        var stColor = isGrad?'#C9A96E':(isBanned?'#C05050':'#3a9a3a');
        html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:0.5px solid var(--color-border-tertiary)">'+
          '<span>'+escapeHtml(u.nickname||'')+'さん</span>'+
          '<span style="font-size:10px;color:'+stColor+'">'+st+'</span></div>';
      });
      listEl.innerHTML=html;
    }
  }catch(e){ console.log('aff refer list error:',e); }
}

/** アフィリエイターが「通常登録してサービスも使う」 → プラン選択へ（兼用化フロー開始） */
function startNormalRegFromAffiliate(){
  // is_affiliate / member_id は維持し、plan を後付けして兼用ユーザーになる。
  window._affiliateUpgrade = true;
  _showOnlyWrap('plan-select-wrap');
}

/** 通常登録フォームをアフィリ情報でプレフィル（兼用化フロー用）。startReg() から呼ばれる。 */
function prefillRegFormForAffiliateUpgrade(){
  var p = window._affiliateProfile || {};
  // 認証済みなのでメアド/パスワード/紹介者ID欄は隠す
  ['r-email','r-password','r-referrer'].forEach(function(id){
    var el=document.getElementById(id); if(el && el.closest('.fl')) el.closest('.fl').style.display='none';
  });
  var nick=document.getElementById('r-nick'); if(nick) nick.value=p.nickname||'';
  var ph=document.getElementById('r-phone'); if(ph) ph.value=p.phone_number||'';
  document.querySelectorAll('#r-sex-row .sxbtn').forEach(function(b){ b.classList.toggle('on', b.textContent===p.sex); });
  _affSet('yr', p.birth_year); _affSet('mo', p.birth_month); _affSet('dy', p.birth_day);
  _affSet('hr', p.birth_hour!=null?p.birth_hour:''); _affSet('mn', p.birth_min!=null?p.birth_min:'');
  // 出生地: birth_pref 名 → PREFS index 逆引き → city
  try{
    if(p.birth_pref){
      var idx=-1; for(var i=0;i<PREFS.length;i++){ if(PREFS[i].name===p.birth_pref){ idx=i; break; } }
      var prefSel=document.getElementById('pref');
      if(idx>=0 && prefSel){
        prefSel.value=idx;
        if(typeof updCity==='function') updCity();
        if(p.birth_city){
          var cs=document.getElementById('city');
          if(cs){ for(var j=0;j<cs.options.length;j++){ if(cs.options[j].text===p.birth_city){ cs.selectedIndex=j; break; } } }
        }
      }
    }
  }catch(e){ console.log('aff prefill birthplace error:', e); }
  var btn=document.querySelector('#reg-wrap .btn-gold');
  if(btn) btn.textContent='通常登録を完了してサービスを使う →';
}
function _affSet(id,v){ var el=document.getElementById(id); if(el) el.value=(v!=null?v:''); }

/** 兼用化の確定：既存アフィリのプロフィールを UPDATE（is_affiliate / member_id は維持し plan を付与）。
 *  通常の completeReg() から _affiliateUpgrade=true のとき委譲される。 */
async function upgradeAffiliateToNormal(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var nick=(document.getElementById('r-nick').value||'').trim();
  var sexEl=document.querySelector('#r-sex-row .sxbtn.on');
  var sex=sexEl?sexEl.textContent:'';
  var phoneRaw=(typeof toHalfWidth==='function'?toHalfWidth(document.getElementById('r-phone').value||''):(document.getElementById('r-phone').value||'')).trim();
  var phone=phoneRaw.replace(/[-\s]/g,'');
  if(!nick){ alert('ニックネームを入力してください'); return; }
  if(!sex){ alert('性別を選択してください'); return; }
  if(!phone || !/^0\d{9,10}$/.test(phone)){ alert('電話番号を正しく入力してください'); return; }

  var yr=parseInt(document.getElementById('yr').value)||1996;
  var mo=parseInt(document.getElementById('mo').value)||1;
  var dy=parseInt(document.getElementById('dy').value)||1;
  var hrRaw=document.getElementById('hr').value, mnRaw=document.getElementById('mn').value;
  var hr=hrRaw===''?null:parseInt(hrRaw); var mn=mnRaw===''?null:parseInt(mnRaw);
  if(hr!==null&&isNaN(hr))hr=null; if(mn!==null&&isNaN(mn))mn=null;
  if(hr!==null&&mn===null)mn=0;
  var hasTime=(hr!==null);
  var prefSel=document.getElementById('pref'), citySel=document.getElementById('city');
  var prefVal=prefSel?prefSel.value:''; var lonStr=citySel?citySel.value:'';
  var lon=lonStr===''?null:parseFloat(lonStr);
  var hasLon=(lon!==null&&!isNaN(lon)&&lon>0);
  var birthPref=prefVal===''?null:PREFS[parseInt(prefVal)].name;
  var birthCity=hasLon?citySel.options[citySel.selectedIndex].text:null;
  var pillars=calcPillars(yr,mo,dy,hasTime?hr:null,hasTime?mn:null,hasLon?lon:null);

  // 任意項目（プランにより非表示の場合あり）
  var res=(document.getElementById('r-res')&&document.getElementById('r-res').value)||'';
  var marriage=(document.getElementById('r-marriage')&&document.getElementById('r-marriage').value)||'';
  var kodomo=(document.getElementById('r-kodomo')&&document.getElementById('r-kodomo').value==='yes')?((document.getElementById('r-kodomo-cnt')||{}).value||'1'):'なし';
  var profileText=((document.getElementById('r-profile-text')||{}).value||'').trim().substring(0,500)||null;
  var interestTags=(function(){ try{ if(typeof getInterestEditState!=='function')return null; var s=getInterestEditState(); if(!s||!s.selected||s.selected.length===0)return null; return s; }catch(e){return null;} })();

  var updateData={
    nickname:nick, sex:sex, phone_number:phone, prefecture:res,
    birth_year:yr, birth_month:mo, birth_day:dy,
    birth_hour:hasTime?hr:null, birth_min:hasTime?mn:null,
    birth_pref:birthPref, birth_city:birthCity,
    pillar_year_k:pillars[0].k, pillar_year_s:pillars[0].s,
    pillar_month_k:pillars[1].k, pillar_month_s:pillars[1].s,
    pillar_day_k:pillars[2].k, pillar_day_s:pillars[2].s,
    pillar_hour_k:pillars[3]?pillars[3].k:null, pillar_hour_s:pillars[3]?pillars[3].s:null,
    marriage:marriage, children:kodomo,
    profile_text:profileText, interest_tags:interestTags,
    plan: selectedPlan || 'total'
    // is_affiliate / member_id / affiliate_at は維持（UPDATE に含めない）
  };

  var btn=document.querySelector('#reg-wrap .btn-gold');
  if(btn){ btn.disabled=true; btn.textContent='登録中...'; }
  try{
    var{error}=await supa.from('profiles').update(updateData).eq('id', currentUser.id);
    if(error){ alert('保存エラー：'+error.message); if(btn){btn.disabled=false;btn.textContent='通常登録を完了してサービスを使う →';} return; }
  }catch(e){ alert('保存中にエラー：'+e.message); if(btn){btn.disabled=false;} return; }

  // アバター（任意）
  var imgInput=document.getElementById('img-input');
  var imgFile=imgInput&&imgInput.files&&imgInput.files[0]?imgInput.files[0]:null;
  if(imgFile && typeof uploadAvatar==='function'){
    try{ var up=await uploadAvatar(supa,currentUser.id,imgFile); if(up&&up.url){ await supa.from('profiles').update({avatar_url:up.url}).eq('id',currentUser.id); } }catch(e){ console.log('aff upgrade avatar error:',e); }
  }

  // 状態反映 → アプリ突入（兼用ユーザーとしてサービス利用可）
  window._affiliateUpgrade=false;
  memberID=(window._affiliateProfile&&window._affiliateProfile.member_id)||memberID;
  mySex=sex; MY_PILLARS=pillars; myPlan=updateData.plan;
  myCreatedAt=(window._affiliateProfile&&window._affiliateProfile.created_at)||new Date().toISOString();
  // 次回用にメアド/パスワード欄の表示を戻す
  ['r-email','r-password','r-referrer'].forEach(function(id){ var el=document.getElementById(id); if(el&&el.closest('.fl')) el.closest('.fl').style.display=''; });

  ['login-wrap','plan-select-wrap','orient-wrap','reg-wrap','email-confirm-wrap','affiliate-reg-wrap','affiliate-dash-wrap'].forEach(function(w){
    var el=document.getElementById(w); if(el) el.style.display='none';
  });
  if(typeof showAppWrap==='function') showAppWrap();
  try{ var{data:fresh}=await supa.from('profiles').select('*').eq('id',currentUser.id).single(); if(fresh && typeof populateProfileModal==='function') populateProfileModal(fresh); }catch(e){}
  if(typeof applyPlanUI==='function') applyPlanUI(myPlan);
  if(typeof loadMyCashbacks==='function') loadMyCashbacks();
  if(typeof loadOfficialChatHistory==='function') loadOfficialChatHistory();
  if(typeof loadRealUsers==='function') loadRealUsers();
  if(typeof loadEnList==='function') loadEnList();
}
