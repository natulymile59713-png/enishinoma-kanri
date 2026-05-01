// ===== UI: 新規登録フォーム =====
function generateMemberID(){var n='';for(var i=0;i<8;i++)n+=Math.floor(Math.random()*10);return'EN-'+n;}
function previewImg(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){savedImgSrc=ev.target.result;document.getElementById('preview-img').src=savedImgSrc;document.getElementById('preview-img').style.display='block';document.getElementById('img-ph').style.display='none';};reader.readAsDataURL(file);}
function toggleKodomo(){document.getElementById('kodomo-row').style.display=document.getElementById('r-kodomo').value==='yes'?'block':'none';}
function setSex(el){document.querySelectorAll('#r-sex-row .sxbtn').forEach(function(b){b.classList.remove('on');});el.classList.add('on');}
function calcMeishiki(){var yr=parseInt(document.getElementById('yr').value)||1996,mo=parseInt(document.getElementById('mo').value)||1,dy=parseInt(document.getElementById('dy').value)||1,hr=parseInt(document.getElementById('hr').value)||0,mn=parseInt(document.getElementById('mn').value)||0;var lon=parseFloat(document.getElementById('city').value)||135.0,cName=document.getElementById('city').options[document.getElementById('city').selectedIndex].text;var ld=(lon-135.0)*4,j=jd(yr,mo,dy,hr+mn/60),eq=eqT(j),tt=((hr*60+mn+ld+eq)%1440+1440)%1440,tH=Math.floor(tt/60),tM=Math.round(tt%60);var sk=getSekki(yr,mo),bef=(dy*1440+hr*60+mn)<(sk.d*1440+sk.h*60+sk.m);var nY=yr;if(mo===1){nY=yr-1;}else if(mo===2&&bef){nY=yr-1;}var nKi=((nY-4)%10+10)%10,nSi=((nY-4)%12+12)%12;var mY=yr,mM=mo;if(bef){mM--;if(mM<=0){mM=12;mY--;}}var gY=mY;if(mM===1)gY=mY-1;var gKi=((gY-4)%10+10)%10;var moKi=(GOKOTSU[gKi]+(mM-2+12)%12)%10,moSi=MO_SHI[mM];var dJ=Math.floor(jd(yr,mo,dy,12)),dSt=((dJ+49)%10+10)%10,dSi=((dJ+49)%12+12)%12;var sH=Math.floor(((tH+1)%24)/2),hKi=([0,2,4,6,8][dSt%5]+sH)%10;savedPillars=[{k:nKi,s:nSi},{k:moKi,s:moSi},{k:dSt,s:dSi},{k:hKi,s:sH}];var h='';savedPillars.forEach(function(p,i){h+='<div class="pc'+(i===2?' day':'')+'"><div class="pc-lbl">'+PL[i]+'</div><div class="pc-kan">'+KAN[p.k]+'</div><div class="pc-shi">'+SHI[p.s]+'</div></div>';});document.getElementById('pillars').innerHTML=h;var dbgEl=document.getElementById('dbg');dbgEl.style.display='block';dbgEl.className='dbg';dbgEl.innerHTML='<div class="dr"><span>出生地</span><span class="dv">'+cName+'</span></div><div class="dr"><span>真太陽時</span><span class="dv">'+String(tH).padStart(2,'0')+'時'+String(tM).padStart(2,'0')+'分</span></div><div class="dr"><span>判定</span><span class="dv">'+(bef?'節入り前':'節入り後')+'</span></div>';}
function completeRegDemo(){memberID=generateMemberID();var nick=document.getElementById('r-nick').value||'名無し';var sexEl=document.querySelector('#r-sex-row .sxbtn.on');var sex=sexEl?sexEl.textContent:'不明';var res=document.getElementById('r-res').value||'未設定';var marriage=document.getElementById('r-marriage').value;var kodomo=document.getElementById('r-kodomo').value==='yes'?document.getElementById('r-kodomo-cnt').value:'なし';var yr=parseInt(document.getElementById('yr').value)||1996,mo=parseInt(document.getElementById('mo').value)||1,dy=parseInt(document.getElementById('dy').value)||1;document.getElementById('topbar-initial').textContent=nick.charAt(0);document.getElementById('modal-ava-ph').textContent=nick.charAt(0);if(savedImgSrc){var ti=document.getElementById('topbar-ava');ti.src=savedImgSrc;ti.style.display='block';document.getElementById('topbar-initial').style.display='none';var mi=document.getElementById('modal-ava-img');mi.src=savedImgSrc;mi.style.display='block';document.getElementById('modal-ava-ph').style.display='none';}document.getElementById('modal-info').innerHTML='<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+nick+'</span></div><div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+sex+'</span></div><div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+res+'</span></div><div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+yr+'年'+mo+'月'+dy+'日</span></div><div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+marriage+'</span></div><div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+kodomo+'</span></div>';document.getElementById('modal-member-id').textContent=memberID;document.getElementById('contact-id').value=memberID;document.getElementById('contact-nick').value=nick;if(savedPillars.length===0){var lon=parseFloat(document.getElementById('city').value)||135.0;savedPillars=calcPillars(yr,mo,dy,parseInt(document.getElementById('hr').value)||0,parseInt(document.getElementById('mn').value)||0,lon);}if(savedPillars.length>0){var h='';savedPillars.forEach(function(p,i){h+='<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';});document.getElementById('modal-pillars').innerHTML=h;}MY_PILLARS=savedPillars;document.getElementById('reg-wrap').style.display='none';document.getElementById('orient-wrap').style.display='none';document.getElementById('login-wrap').style.display='none';showAppWrap();renderMatchList(MY_PILLARS);}
function initPrefs(){var rp=document.getElementById('r-res');PREF_NAMES.forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;rp.appendChild(o);});var s=document.getElementById('pref');for(var i=0;i<PREFS.length;i++){var o=document.createElement('option');o.value=i;o.textContent=PREFS[i].name;if(PREFS[i].name==='神奈川県')o.selected=true;s.appendChild(o);}updCity();}
function updCity(){var pi=parseInt(document.getElementById('pref').value),cs=document.getElementById('city');cs.innerHTML='';PREFS[pi].cities.forEach(function(c){var o=document.createElement('option');o.value=c.l;o.textContent=c.n;if(c.n==='平塚市')o.selected=true;cs.appendChild(o);});}

// ===== Supabase版：登録完了処理 =====
async function completeReg() {
  const emailEl = document.getElementById('r-email');
  const passEl = document.getElementById('r-password');
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passEl ? passEl.value : '';

  if (!email || !password) {
    alert('メールアドレスとパスワードを入力してください');
    return;
  }
  if (password.length < 6) {
    alert('パスワードは6文字以上にしてください');
    return;
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

  const nick = document.getElementById('r-nick').value || '名無し';
  const sexEl = document.querySelector('#r-sex-row .sxbtn.on');
  const sex = sexEl ? sexEl.textContent : '不明';
  const res = document.getElementById('r-res').value || '';
  const marriage = document.getElementById('r-marriage').value;
  const kodomo = document.getElementById('r-kodomo').value === 'yes' ? document.getElementById('r-kodomo-cnt').value : 'なし';
  const yr = parseInt(document.getElementById('yr').value) || 1996;
  const mo = parseInt(document.getElementById('mo').value) || 1;
  const dy = parseInt(document.getElementById('dy').value) || 1;
  const hr = parseInt(document.getElementById('hr').value) || 0;
  const mn_val = parseInt(document.getElementById('mn').value) || 0;
  const lon = parseFloat(document.getElementById('city').value) || 135.0;

  if (savedPillars.length === 0) {
    savedPillars = calcPillars(yr, mo, dy, hr, mn_val, lon);
  }

  // profilesテーブルに保存
  const { error: profileError } = await supa.from('profiles').insert({
    id: currentUser.id,
    member_id: memberID,
    nickname: nick,
    sex: sex,
    prefecture: res,
    birth_year: yr,
    birth_month: mo,
    birth_day: dy,
    birth_hour: hr,
    birth_min: mn_val,
    birth_pref: document.getElementById('pref').options[document.getElementById('pref').selectedIndex].text,
    birth_city: document.getElementById('city').options[document.getElementById('city').selectedIndex].text,
    marriage: marriage,
    children: kodomo,
    pillar_year_k: savedPillars[0].k,
    pillar_year_s: savedPillars[0].s,
    pillar_month_k: savedPillars[1].k,
    pillar_month_s: savedPillars[1].s,
    pillar_day_k: savedPillars[2].k,
    pillar_day_s: savedPillars[2].s,
    pillar_hour_k: savedPillars[3].k,
    pillar_hour_s: savedPillars[3].s
  });

  if (profileError) {
    alert('プロフィール保存エラー：' + profileError.message);
    return;
  }

  // 画面遷移：まずshowAppWrapでDOMを展開してから要素にアクセス
  MY_PILLARS = savedPillars;
  document.getElementById('reg-wrap').style.display = 'none';
  document.getElementById('orient-wrap').style.display = 'none';
  document.getElementById('login-wrap').style.display = 'none';
  showAppWrap();

  document.getElementById('topbar-initial').textContent = nick.charAt(0);
  document.getElementById('modal-ava-ph').textContent = nick.charAt(0);
  document.getElementById('modal-member-id').textContent = memberID;
  document.getElementById('contact-id').value = memberID;
  document.getElementById('contact-nick').value = nick;

  if (savedImgSrc) {
    var ti = document.getElementById('topbar-ava');
    ti.src = savedImgSrc; ti.style.display = 'block';
    document.getElementById('topbar-initial').style.display = 'none';
    var mi = document.getElementById('modal-ava-img');
    mi.src = savedImgSrc; mi.style.display = 'block';
    document.getElementById('modal-ava-ph').style.display = 'none';
  }

  var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+nick+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+sex+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+res+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+yr+'年'+mo+'月'+dy+'日</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+marriage+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+kodomo+'</span></div>';
  document.getElementById('modal-info').innerHTML = modalInfo;

  var h = '';
  savedPillars.forEach(function(p, i) {
    h += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
  });
  document.getElementById('modal-pillars').innerHTML = h;
  loadRealUsers();
  loadEnList();
  } catch(e) { alert('登録中にエラーが発生しました：' + e.message); console.log('登録例外:', e); }
}
