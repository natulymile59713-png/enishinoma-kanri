// ===== UI: 新規登録フォーム =====
// 全角ASCII文字（！-～）を半角に正規化。日本語入力モードで入った ＠.－０-９ などを修正する。
function toHalfWidth(s){
  if(s == null) return '';
  return String(s).replace(/[！-～]/g, function(c){
    return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
  }).replace(/　/g, ' '); // 全角スペース→半角スペース
}
// input の値を半角化する（oninput ハンドラ用）。カーソル位置を保持。
function normalizeAsciiInput(el){
  if(!el) return;
  var before = el.value;
  var after = toHalfWidth(before);
  if(before === after) return;
  var pos = el.selectionStart;
  el.value = after;
  // 半角化で文字数が同じならカーソル位置を維持
  try{ el.setSelectionRange(pos, pos); }catch(e){}
}

function generateMemberID(){var n='';for(var i=0;i<8;i++)n+=Math.floor(Math.random()*10);return'EN-'+n;}
function previewImg(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){savedImgSrc=ev.target.result;document.getElementById('preview-img').src=savedImgSrc;document.getElementById('preview-img').style.display='block';document.getElementById('img-ph').style.display='none';};reader.readAsDataURL(file);}
function toggleKodomo(){document.getElementById('kodomo-row').style.display=document.getElementById('r-kodomo').value==='yes'?'block':'none';}
// プロフィール文入力時の文字数カウンター（500文字制限）
function updateProfileTextCount(el, counterId){
  if(!el) return;
  var counter = document.getElementById(counterId);
  if(!counter) return;
  var len = (el.value || '').length;
  counter.textContent = len;
  counter.style.color = len > 500 ? '#C05050' : '';
}
function setSex(el){document.querySelectorAll('#r-sex-row .sxbtn').forEach(function(b){b.classList.remove('on');});el.classList.add('on');}
function calcMeishiki(){
  var yr=parseInt(document.getElementById('yr').value)||1996,
      mo=parseInt(document.getElementById('mo').value)||1,
      dy=parseInt(document.getElementById('dy').value)||1;
  var hrRaw=document.getElementById('hr').value,mnRaw=document.getElementById('mn').value;
  var hr=hrRaw===''?null:parseInt(hrRaw);
  var mn=mnRaw===''?null:parseInt(mnRaw);
  if(hr!==null&&isNaN(hr))hr=null;
  if(mn!==null&&isNaN(mn))mn=null;
  // 時のみ・分のみ入力された場合は補完
  if(hr!==null&&mn===null)mn=0;
  if(mn!==null&&hr===null)hr=0;
  var hasTime=(hr!==null);
  var lonStr=document.getElementById('city').value;
  var lon=lonStr===''?null:parseFloat(lonStr);
  var hasLon=(lon!==null&&!isNaN(lon)&&lon>0);
  var cName='—';
  if(hasLon){
    var citySel=document.getElementById('city');
    cName=citySel.options[citySel.selectedIndex].text;
  }
  savedPillars=calcPillars(yr,mo,dy,hr,mn,lon);
  var h='';
  savedPillars.forEach(function(p,i){
    var kan=p?KAN[p.k]:'—',shi=p?SHI[p.s]:'—';
    h+='<div class="pc'+(i===2?' day':'')+'"><div class="pc-lbl">'+PL[i]+'</div><div class="pc-kan">'+kan+'</div><div class="pc-shi">'+shi+'</div></div>';
  });
  document.getElementById('pillars').innerHTML=h;
  // デバッグ表示（真太陽時は時刻・場所が両方ある時だけ意味を持つ）
  var dbgEl=document.getElementById('dbg');
  dbgEl.style.display='block';dbgEl.className='dbg';
  var dbgHtml='<div class="dr"><span>出生地</span><span class="dv">'+cName+'</span></div>';
  if(hasTime){
    var hrCalc=hr,mnCalc=mn,ld=hasLon?(lon-135.0)*4:0;
    var j=jd(yr,mo,dy,hrCalc+mnCalc/60),eq=eqT(j);
    var tt=((hrCalc*60+mnCalc+ld+eq)%1440+1440)%1440,tH=Math.floor(tt/60),tM=Math.round(tt%60);
    dbgHtml+='<div class="dr"><span>真太陽時'+(hasLon?'':'（経度補正なし）')+'</span><span class="dv">'+String(tH).padStart(2,'0')+'時'+String(tM).padStart(2,'0')+'分</span></div>';
    var sk=getSekki(yr,mo),bef=(dy*1440+hrCalc*60+mnCalc)<(sk.d*1440+sk.h*60+sk.m);
    dbgHtml+='<div class="dr"><span>判定</span><span class="dv">'+(bef?'節入り前':'節入り後')+'</span></div>';
  }else{
    dbgHtml+='<div class="dr"><span>時柱</span><span class="dv">出生時刻不明</span></div>';
  }
  dbgEl.innerHTML=dbgHtml;
}
function completeRegDemo(){memberID=generateMemberID();var nick=document.getElementById('r-nick').value||'名無し';var sexEl=document.querySelector('#r-sex-row .sxbtn.on');var sex=sexEl?sexEl.textContent:'不明';var res=document.getElementById('r-res').value||'未設定';var marriage=document.getElementById('r-marriage').value;var kodomo=document.getElementById('r-kodomo').value==='yes'?document.getElementById('r-kodomo-cnt').value:'なし';var yr=parseInt(document.getElementById('yr').value)||1996,mo=parseInt(document.getElementById('mo').value)||1,dy=parseInt(document.getElementById('dy').value)||1;document.getElementById('topbar-initial').textContent=nick.charAt(0);document.getElementById('modal-ava-ph').textContent=nick.charAt(0);if(savedImgSrc){var ti=document.getElementById('topbar-ava');ti.src=savedImgSrc;ti.style.display='block';document.getElementById('topbar-initial').style.display='none';var mi=document.getElementById('modal-ava-img');mi.src=savedImgSrc;mi.style.display='block';document.getElementById('modal-ava-ph').style.display='none';}document.getElementById('modal-info').innerHTML='<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+nick+'</span></div><div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+sex+'</span></div><div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+res+'</span></div><div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+yr+'年'+mo+'月'+dy+'日</span></div><div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+marriage+'</span></div><div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+kodomo+'</span></div>';document.getElementById('modal-member-id').textContent=memberID;document.getElementById('contact-id').value=memberID;document.getElementById('contact-nick').value=nick;if(savedPillars.length===0){var lon=parseFloat(document.getElementById('city').value)||135.0;savedPillars=calcPillars(yr,mo,dy,parseInt(document.getElementById('hr').value)||0,parseInt(document.getElementById('mn').value)||0,lon);}if(savedPillars.length>0){var h='';savedPillars.forEach(function(p,i){h+='<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';});document.getElementById('modal-pillars').innerHTML=h;}MY_PILLARS=savedPillars;document.getElementById('reg-wrap').style.display='none';document.getElementById('orient-wrap').style.display='none';document.getElementById('login-wrap').style.display='none';showAppWrap();renderMatchList(MY_PILLARS);}
function initPrefs(){
  var rp=document.getElementById('r-res');
  PREF_NAMES.forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;rp.appendChild(o);});
  var s=document.getElementById('pref');
  // 出生都道府県は「選択しない」がデフォルト（時刻と同じく任意）
  var unknown=document.createElement('option');
  unknown.value='';unknown.textContent='選択しない';unknown.selected=true;
  s.appendChild(unknown);
  for(var i=0;i<PREFS.length;i++){
    var o=document.createElement('option');o.value=i;o.textContent=PREFS[i].name;
    s.appendChild(o);
  }
  updCity();
}
function updCity(){
  var pref=document.getElementById('pref'),pi=parseInt(pref.value),cs=document.getElementById('city');
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

// ===== Supabase版：登録完了処理 =====
async function completeReg() {
  const emailEl = document.getElementById('r-email');
  const passEl = document.getElementById('r-password');
  const phoneEl = document.getElementById('r-phone');
  // メアド・電話番号は全角→半角に念のため正規化（日本語入力モード対策）
  const email = toHalfWidth(emailEl ? emailEl.value : '').trim();
  const password = passEl ? passEl.value : '';
  // 電話番号：全角→半角→ハイフン・空白除去
  const phoneRaw = toHalfWidth(phoneEl ? phoneEl.value : '').trim();
  const phone = phoneRaw.replace(/[-\s]/g, '');

  if (!email || !password) {
    alert('メールアドレスとパスワードを入力してください');
    return;
  }
  if (password.length < 6) {
    alert('パスワードは6文字以上にしてください');
    return;
  }
  if (!phone) {
    alert('電話番号を入力してください');
    return;
  }
  if (!/^0\d{9,10}$/.test(phone)) {
    alert('電話番号は0から始まる10〜11桁の数字で入力してください');
    return;
  }

  // 退会処分された電話番号かチェック（登録前）
  try {
    const { data: isBanned, error: banErr } = await supa.rpc('is_phone_banned', { p_phone: phone });
    if (banErr) { console.log('phone ban check error:', banErr); }
    if (isBanned === true) {
      alert('この電話番号は登録できません。');
      return;
    }
  } catch (e) {
    console.log('phone ban check exception:', e);
  }

  // Supabaseに新規登録
  try {
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) {
      alert('登録エラー：' + error.message);
      console.log('登録エラー詳細:', error);
      return;
    }

  currentUser = data.user;
  if (!currentUser) {
    alert('登録に失敗しました。もう一度お試しください。');
    return;
  }

  memberID = generateMemberID();
  mySex = document.querySelector('#r-sex-row .sxbtn.on') ? document.querySelector('#r-sex-row .sxbtn.on').textContent : '';

  const referrerRaw = document.getElementById('r-referrer') ? document.getElementById('r-referrer').value.trim() : '';
  const referrerId = referrerRaw === '' ? null : referrerRaw;
  const nick = document.getElementById('r-nick').value || '名無し';
  const sexEl = document.querySelector('#r-sex-row .sxbtn.on');
  const sex = sexEl ? sexEl.textContent : '不明';
  const res = document.getElementById('r-res').value || '';
  const marriage = document.getElementById('r-marriage').value;
  const kodomo = document.getElementById('r-kodomo').value === 'yes' ? document.getElementById('r-kodomo-cnt').value : 'なし';
  const yr = parseInt(document.getElementById('yr').value) || 1996;
  const mo = parseInt(document.getElementById('mo').value) || 1;
  const dy = parseInt(document.getElementById('dy').value) || 1;
  // 時刻・場所は任意：未入力なら null
  const hrRaw = document.getElementById('hr').value;
  const mnRaw = document.getElementById('mn').value;
  let hr = hrRaw === '' ? null : parseInt(hrRaw);
  let mn_val = mnRaw === '' ? null : parseInt(mnRaw);
  if (hr !== null && isNaN(hr)) hr = null;
  if (mn_val !== null && isNaN(mn_val)) mn_val = null;
  if (hr !== null && mn_val === null) mn_val = 0;
  if (mn_val !== null && hr === null) hr = 0;
  const hasTime = (hr !== null);
  const prefSel = document.getElementById('pref');
  const citySel = document.getElementById('city');
  const prefVal = prefSel.value;
  const lonStr = citySel.value;
  const lon = lonStr === '' ? null : parseFloat(lonStr);
  const hasLon = (lon !== null && !isNaN(lon) && lon > 0);
  const birthPref = prefVal === '' ? null : PREFS[parseInt(prefVal)].name;
  const birthCity = hasLon ? citySel.options[citySel.selectedIndex].text : null;

  // 命式が未計算なら計算（"命式を算出する"を押さずに登録した場合）
  if (!savedPillars || savedPillars.length === 0) {
    savedPillars = calcPillars(yr, mo, dy, hr, mn_val, lon);
  }

  // profilesテーブルに保存するデータ（モーダル表示にも再利用）
  const profileData = {
    id: currentUser.id,
    member_id: memberID,
    nickname: nick,
    sex: sex,
    prefecture: res,
    birth_year: yr,
    birth_month: mo,
    birth_day: dy,
    birth_hour: hasTime ? hr : null,
    birth_min: hasTime ? mn_val : null,
    birth_pref: birthPref,
    birth_city: birthCity,
    marriage: marriage,
    children: kodomo,
    pillar_year_k: savedPillars[0].k,
    pillar_year_s: savedPillars[0].s,
    pillar_month_k: savedPillars[1].k,
    pillar_month_s: savedPillars[1].s,
    pillar_day_k: savedPillars[2].k,
    pillar_day_s: savedPillars[2].s,
    pillar_hour_k: savedPillars[3] ? savedPillars[3].k : null,
    pillar_hour_s: savedPillars[3] ? savedPillars[3].s : null,
    referrer_id: referrerId,
    phone_number: phone,
    plan: selectedPlan || 'total',
    profile_text: ((document.getElementById('r-profile-text') || {}).value || '').trim().substring(0, 500) || null
  };
  const { error: profileError } = await supa.from('profiles').insert(profileData);

  if (profileError) {
    alert('プロフィール保存エラー：' + profileError.message);
    return;
  }

  // 画面遷移：まずshowAppWrapでDOMを展開してから要素にアクセス
  document.getElementById('reg-wrap').style.display = 'none';
  document.getElementById('orient-wrap').style.display = 'none';
  document.getElementById('login-wrap').style.display = 'none';
  showAppWrap();

  // 登録時のみ：アップロード画像があればアバターに反映（既存ユーザーのログイン時には無関係）
  if (savedImgSrc) {
    var ti = document.getElementById('topbar-ava');
    ti.src = savedImgSrc; ti.style.display = 'block';
    document.getElementById('topbar-initial').style.display = 'none';
    var mi = document.getElementById('modal-ava-img');
    mi.src = savedImgSrc; mi.style.display = 'block';
    document.getElementById('modal-ava-ph').style.display = 'none';
  }

  populateProfileModal(profileData);
  // プラン情報をグローバル変数にセット & UI に適用
  myPlan = profileData.plan || 'total';
  myCreatedAt = new Date().toISOString();
  if (typeof applyPlanUI === 'function') applyPlanUI(myPlan);
  loadRealUsers();
  loadEnList();
  } catch(e) { alert('登録中にエラーが発生しました：' + e.message); console.log('登録例外:', e); }
}
