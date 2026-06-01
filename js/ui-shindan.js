// ===== UI: 相性診断（その他タブ内、リアル知り合い等との相性チェック） =====

// 直近の診断データ（メモ保存用）
var lastShindanData = null;

// 相性診断モード: 'self'=自分との相性 / 'others'=自分以外の相性（NOマッチング限定）
var shindanMode = 'self';
// 相性結果メモの表示フィルタ
var memoFilterType = 'self';
// 相性結果メモの並べ替え / 性別絞り込み
var memoSortKey = 'new';        // 'score_high'|'score_low'|'new'|'old'
var memoGenderFilter = 'all';   // 'all'|'男性'|'女性'（自分との相性のみ）
// 「過去に入力した人から選ぶ」候補キャッシュ
var _shindanPeopleCache = [];

// 各人フォームのフィールドID設定（person1 / person2）
var SH_P1 = {name:'sh-name',sexrow:'sh-sexrow',yr:'sh-yr',mo:'sh-mo',dy:'sh-dy',hr:'sh-hr',mn:'sh-mn',pref:'sh-pref',city:'sh-city',optFields:'sh-opt-fields',optUnknown:'sh-opt-unknown',unknownBtn:'sh-unknown-btn'};
var SH_P2 = {name:'sh2-name',sexrow:'sh2-sexrow',yr:'sh2-yr',mo:'sh2-mo',dy:'sh2-dy',hr:'sh2-hr',mn:'sh2-mn',pref:'sh2-pref',city:'sh2-city',optFields:'sh2-opt-fields',optUnknown:'sh2-opt-unknown',unknownBtn:'sh2-unknown-btn'};

// localStorage key（ユーザー単位で分離）
/** 相性診断メモの localStorage キー（ユーザーごと） @returns {string} */
function shindanMemoKey(){
  return 'shindan_memos_'+(currentUser?currentUser.id:'guest');
}

// 名前末尾の「さん」を削除（表示時に "さん" を必ず一度だけ付けるため）
/** 名前の末尾「さん」を除去（保存時の正規化用） @param {string} name @returns {string} */
function stripSan(name){
  return (name||'').replace(/さん$/,'');
}

/** 簡易 HTML エスケープ（名前など入力値の表示用） */
function shEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ===== フォーム操作 =====

/** 相性診断画面の性別ボタン切替（クリックされた行内だけで排他） @param {HTMLElement} el */
function setShSex(el){
  var row = el.closest('.sexrow');
  if(row){ row.querySelectorAll('.sxbtn').forEach(function(b){b.classList.remove('on');}); }
  else { document.querySelectorAll('#sub-shindan .sxbtn').forEach(function(b){b.classList.remove('on');}); }
  el.classList.add('on');
}

// 都道府県・市区町村セレクト（person1/person2 共通の汎用版）
/** 指定の都道府県セレクトを初期化（神奈川デフォルト・「わからない」付き） */
function initShPrefsFor(prefId, cityId){
  var s=document.getElementById(prefId);
  if(!s)return;
  s.innerHTML='';
  var unknown=document.createElement('option');
  unknown.value='-1';
  unknown.textContent='わからない';
  s.appendChild(unknown);
  for(var i=0;i<PREFS.length;i++){
    var o=document.createElement('option');
    o.value=i;
    o.textContent=PREFS[i].name;
    if(PREFS[i].name==='神奈川県')o.selected=true;
    s.appendChild(o);
  }
  updShCityFor(prefId, cityId);
}
/** 指定の市区町村セレクトを都道府県に応じて更新 */
function updShCityFor(prefId, cityId){
  var pi=parseInt(document.getElementById(prefId).value);
  var cs=document.getElementById(cityId);
  if(!cs)return;
  cs.innerHTML='';
  if(isNaN(pi)||pi<0){
    var op=document.createElement('option');
    op.value='-1';
    op.textContent='わからない';
    cs.appendChild(op);
    cs.disabled=true;
    return;
  }
  cs.disabled=false;
  PREFS[pi].cities.forEach(function(c){
    var o=document.createElement('option');
    o.value=c.l;
    o.textContent=c.n;
    cs.appendChild(o);
  });
}
// 既存呼び出し互換のラッパー
function initShPrefs(){ initShPrefsFor('sh-pref','sh-city'); }
function initShPrefs2(){ initShPrefsFor('sh2-pref','sh2-city'); }
function updShCity(){ updShCityFor('sh-pref','sh-city'); }
function updShCity2(){ updShCityFor('sh2-pref','sh2-city'); }

// ===== 「分からない(未選択)」トグル（出生時刻＋都道府県を未選択にして3柱診断） =====

/** 未選択状態を設定 @param {'1'|'2'} which @param {boolean} on */
function setShUnknown(which, on){
  var cfg=(which==='2')?SH_P2:SH_P1;
  var btn=document.getElementById(cfg.unknownBtn);
  var fields=document.getElementById(cfg.optFields);
  var unk=document.getElementById(cfg.optUnknown);
  if(btn) btn.classList.toggle('on', !!on);
  if(fields) fields.style.display = on ? 'none' : '';
  if(unk) unk.style.display = on ? 'block' : 'none';
}
/** 未選択トグル @param {'1'|'2'} which */
function toggleShUnknown(which){
  var cfg=(which==='2')?SH_P2:SH_P1;
  var btn=document.getElementById(cfg.unknownBtn);
  var on=!(btn && btn.classList.contains('on'));
  setShUnknown(which, on);
}
/** その人が未選択（出生時刻・都道府県とも不明）か */
function isShUnknown(cfg){
  var btn=document.getElementById(cfg.unknownBtn);
  return !!(btn && btn.classList.contains('on'));
}

// ===== モード切替（自分との相性 / 自分以外の相性） =====

/** モード切替（NOマッチングのみ「自分以外」が選べる） @param {'self'|'others'} mode */
function setShindanMode(mode){
  shindanMode = (mode === 'others') ? 'others' : 'self';
  var bSelf=document.getElementById('shmode-self'), bOth=document.getElementById('shmode-others');
  if(bSelf) bSelf.classList.toggle('on', shindanMode==='self');
  if(bOth) bOth.classList.toggle('on', shindanMode==='others');
  var p2=document.getElementById('sh-person2-block');
  if(p2) p2.style.display = (shindanMode==='others') ? 'block' : 'none';
  var lbl=document.getElementById('sh-p1-label');
  if(lbl) lbl.textContent = (shindanMode==='others') ? '1人目' : 'お相手';
  var res=document.getElementById('sh-result');
  if(res){ res.style.display='none'; res.innerHTML=''; }
}

/** 相性ページを開いたとき呼ぶ：NOマッチングのみモードバー＆person2を有効化 */
function initShindanOthers(){
  var noMatch = (typeof myPlan !== 'undefined' && myPlan === 'no_matching');
  var bar=document.getElementById('shindan-mode-bar');
  if(bar) bar.style.display = noMatch ? 'flex' : 'none';
  var sp2=document.getElementById('sh2-pref');
  if(noMatch && sp2 && sp2.options.length===0) initShPrefs2();
  if(!noMatch) shindanMode='self';
  setShindanMode(shindanMode);
  populateShindanPickers();
}

// ===== 「過去に入力した人から選ぶ」 =====

/** メモ群から、入力済みの人物（重複排除）の一覧を返す */
function getShindanPeople(){
  var memos=getShindanMemos();
  var people=[]; var seen={};
  function add(p){
    if(!p || !p.year) return;
    var key=(p.name||'')+'|'+p.year+'|'+p.month+'|'+p.day+'|'+(p.hour==null?'':p.hour)+'|'+(p.min==null?'':p.min)+'|'+(p.longitude==null?'':p.longitude);
    if(seen[key]) return; seen[key]=true;
    people.push(p);
  }
  memos.forEach(function(m){
    if(m.type==='others'){ add(m.personA); add(m.personB); }
    else { add({name:m.name,gender:m.gender,year:m.year,month:m.month,day:m.day,hour:m.hour,min:m.min,prefIdx:m.prefIdx,longitude:m.longitude,pillars:m.partnerPillars}); }
  });
  return people;
}

/** 「過去に入力した人から選ぶ」セレクトを再構築 */
function populateShindanPickers(){
  _shindanPeopleCache=getShindanPeople();
  ['sh-p1-pick','sh-p2-pick'].forEach(function(selId){
    var sel=document.getElementById(selId);
    if(!sel)return;
    var html='<option value="">過去に入力した人から選ぶ…</option>';
    _shindanPeopleCache.forEach(function(p,i){
      var lbl=(stripSan(p.name||'')||'名称未設定')+'（'+p.year+'/'+p.month+'/'+p.day+'）';
      html+='<option value="'+i+'">'+shEsc(lbl)+'</option>';
    });
    sel.innerHTML=html;
    sel.value='';
  });
}

/** ピッカー選択時：対応するフォームへ流し込む @param {'1'|'2'} which */
function onShindanPick(which){
  var selId=(which==='2')?'sh-p2-pick':'sh-p1-pick';
  var cfg=(which==='2')?SH_P2:SH_P1;
  var sel=document.getElementById(selId);
  if(!sel || sel.value==='') return;
  var p=_shindanPeopleCache[parseInt(sel.value)];
  if(p) fillShindanForm(cfg,p);
}

/** 人物オブジェクトでフォームを埋める @param {object} cfg @param {object} p */
function fillShindanForm(cfg, p){
  if(!p) return;
  var nm=document.getElementById(cfg.name); if(nm) nm.value=p.name||'';
  document.querySelectorAll('#'+cfg.sexrow+' .sxbtn').forEach(function(b){
    b.classList.toggle('on', b.textContent===p.gender);
  });
  document.getElementById(cfg.yr).value = p.year||'';
  document.getElementById(cfg.mo).value = p.month||'';
  document.getElementById(cfg.dy).value = p.day||'';
  document.getElementById(cfg.hr).value = (p.hour!=null?p.hour:'');
  document.getElementById(cfg.mn).value = (p.min!=null?p.min:'');
  if(typeof p.prefIdx==='number' && p.prefIdx>=0){
    document.getElementById(cfg.pref).value=p.prefIdx;
    updShCityFor(cfg.pref,cfg.city);
    if(p.longitude){
      var cs=document.getElementById(cfg.city);
      for(var i=0;i<cs.options.length;i++){
        if(parseFloat(cs.options[i].value)===p.longitude){ cs.selectedIndex=i; break; }
      }
    }
  }else{
    document.getElementById(cfg.pref).value='-1';
    updShCityFor(cfg.pref,cfg.city);
  }
  // 出生時刻・都道府県とも不明だった人物は「分からない(未選択)」を ON で復元
  var which=(cfg===SH_P2)?'2':'1';
  setShUnknown(which, (p.hour==null && p.longitude==null));
}

// ===== 診断実行 =====

/** 指定フォームから1人分の入力を読み取り、命式まで計算して返す
 *  @returns {{error?:string, person?:object}} */
function readShindanPersonForm(cfg){
  var sxBtn=document.querySelector('#'+cfg.sexrow+' .sxbtn.on');
  if(!sxBtn) return {error:'性別を選択してください'};
  var sex=sxBtn.textContent;
  var yr=parseInt(document.getElementById(cfg.yr).value);
  var mo=parseInt(document.getElementById(cfg.mo).value);
  var dy=parseInt(document.getElementById(cfg.dy).value);
  if(!yr||!mo||!dy) return {error:'生年月日（年・月・日）を入力してください'};
  if(yr<1900||yr>2030||mo<1||mo>12||dy<1||dy>31) return {error:'生年月日が正しくありません'};
  var hr=parseInt(document.getElementById(cfg.hr).value);
  var mn=parseInt(document.getElementById(cfg.mn).value);
  var hasTime=!isNaN(hr);
  if(isNaN(hr))hr=12;
  if(isNaN(mn))mn=0;
  var prefIdx=parseInt(document.getElementById(cfg.pref).value);
  var lon=parseFloat(document.getElementById(cfg.city).value);
  var hasLocation=!isNaN(lon)&&lon>0;
  if(!hasLocation)lon=135.0;
  // 「分からない(未選択)」が ON なら出生時刻・都道府県とも不明 → 時柱なしの3柱で診断
  if(isShUnknown(cfg)){ hasTime=false; hasLocation=false; prefIdx=-1; }
  var pillars=calcPillars(yr,mo,dy,hasTime?hr:null,hasTime?mn:null,hasLocation?lon:null);
  var name=(document.getElementById(cfg.name).value||'').trim();
  return {person:{
    name:name, gender:sex, year:yr, month:mo, day:dy,
    hour:hasTime?hr:null, min:hasTime?mn:null,
    prefIdx:isNaN(prefIdx)?-1:prefIdx, longitude:hasLocation?lon:null,
    pillars:pillars, missingTime:!hasTime, missingLocation:!hasLocation
  }};
}

/** 入力された相手情報で相性診断を実行・結果を表示 */
function runShindan(){
  var errEl=document.getElementById('sh-error');
  errEl.textContent='';

  var r1=readShindanPersonForm(SH_P1);
  if(r1.error){ errEl.textContent = (shindanMode==='others'?'1人目: ':'')+r1.error; return; }
  var p1=r1.person;

  if(shindanMode==='others'){
    var r2=readShindanPersonForm(SH_P2);
    if(r2.error){ errEl.textContent='2人目: '+r2.error; return; }
    var p2=r2.person;
    var rel=checkRelations(p1.pillars,p2.pillars);
    var score=calcScore(rel);
    var comment=generateComment(rel);
    REL_CACHE['sh']=rel;
    lastShindanData={ type:'others', personA:p1, personB:p2, rel:rel, score:score, comment:comment };
    renderShindanResult({
      title:(stripSan(p1.name||'1人目')+'さんと'+stripSan(p2.name||'2人目')+'さんの良縁率'),
      leftLabel:(stripSan(p1.name||'1人目')+'さん'), leftPillars:p1.pillars,
      rightLabel:(stripSan(p2.name||'2人目')+'さん'), rightPillars:p2.pillars,
      score:score, rel:rel, comment:comment,
      missingTime:(p1.missingTime||p2.missingTime), missingLocation:(p1.missingLocation||p2.missingLocation)
    });
  }else{
    if(!MY_PILLARS||MY_PILLARS.length===0){ errEl.textContent='自分のプロフィール情報が読み込まれていません。再ログインしてお試しください。'; return; }
    var relS=checkRelations(MY_PILLARS,p1.pillars);
    var scoreS=calcScore(relS);
    var commentS=generateComment(relS);
    REL_CACHE['sh']=relS;
    // 既存メモ互換のフラット構造を維持（type:'self'）
    lastShindanData={
      type:'self', name:p1.name||'お相手', gender:p1.gender,
      year:p1.year, month:p1.month, day:p1.day,
      hour:p1.hour, min:p1.min, prefIdx:p1.prefIdx, longitude:p1.longitude,
      partnerPillars:p1.pillars, rel:relS, score:scoreS, comment:commentS
    };
    renderShindanResult({
      title:(stripSan(p1.name||'お相手')+'さんとの良縁率'),
      leftLabel:'あなた', leftPillars:MY_PILLARS,
      rightLabel:(stripSan(p1.name||'お相手')+'さん'), rightPillars:p1.pillars,
      score:scoreS, rel:relS, comment:commentS,
      missingTime:p1.missingTime, missingLocation:p1.missingLocation
    });
  }
}

// ===== 結果描画（左右2人を相対化、ペアタップで〇＋線対応） =====

/** 診断結果の HTML を描画
 * @param {object} o {title,leftLabel,leftPillars,rightLabel,rightPillars,score,rel,comment,missingTime,missingLocation}
 */
function renderShindanResult(o){
  var el=document.getElementById('sh-result');
  if(!el)return;
  var html='';

  // === 良縁率カード ===
  html+='<div class="card" style="margin:0 0 .75rem">';
  html+='<div style="font-size:13px;font-weight:500;margin-bottom:.5rem;text-align:center;color:var(--color-text-secondary)">'+shEsc(o.title)+'</div>';
  html+='<div style="font-family:\'Noto Serif JP\',serif;font-size:36px;font-weight:700;color:#C9A96E;text-align:center;line-height:1.1;margin-bottom:.5rem">'+o.score+'%</div>';
  html+='<div class="abar" style="margin-bottom:.75rem"><div class="afill" style="width:'+o.score+'%"></div></div>';
  if(o.missingTime||o.missingLocation){
    var notes=[];
    if(o.missingTime)notes.push('出生時刻');
    if(o.missingLocation)notes.push('出生地');
    html+='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;line-height:1.6;margin-bottom:.5rem">※ '+notes.join('・')+'未入力のため一般的な値で計算しました（参考値）</div>';
  }
  html+='<div class="comment-box" style="font-size:12px;line-height:1.7;margin-bottom:.75rem">'+o.comment+'</div>';
  html+='<button id="memo-save-btn" onclick="saveShindanMemo()" style="display:block;width:100%;padding:9px 0;font-size:12px;color:#C9A96E;background:transparent;border:0.5px solid #C9A96E;border-radius:8px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif;letter-spacing:.05em">📝 この結果をメモに保存</button>';
  html+='</div>';

  // === 命式比較（左=leftPillars / 右=rightPillars、IDは sh で固定しタップ線を流用）===
  html+='<div class="card" style="margin:0 0 .75rem">';
  html+='<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:.6rem;text-align:center">命式の比較（ペアをタップで干支を強調）</div>';
  html+='<div class="compare-wrap"><div class="compare-grid">';
  // 左側（mypc_sh_*）
  html+='<div class="pcol"><div class="col-lbl">'+shEsc(o.leftLabel)+'</div>';
  for(var pi=0;pi<4;pi++){
    var lp=o.leftPillars?o.leftPillars[pi]:null;
    var lk=lp?KAN[lp.k]:'—';
    var ls=lp?SHI[lp.s]:'—';
    html+='<div class="pce mine" id="mypc_sh_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="mykan_sh_'+pi+'">'+lk+'</div><div class="pce-s" id="myshi_sh_'+pi+'">'+ls+'</div></div>';
  }
  html+='</div>';
  // 右側（thpc_sh_*）
  html+='<div class="pcol"><div class="col-lbl">'+shEsc(o.rightLabel)+'</div>';
  for(var pj=0;pj<4;pj++){
    var rp=o.rightPillars?o.rightPillars[pj]:null;
    var rk=rp?KAN[rp.k]:'—';
    var rsx=rp?SHI[rp.s]:'—';
    html+='<div class="pce" id="thpc_sh_'+pj+'"><div class="pce-lbl">'+PL[pj]+'</div><div class="pce-k" id="thkan_sh_'+pj+'">'+rk+'</div><div class="pce-s" id="thshi_sh_'+pj+'">'+rsx+'</div></div>';
  }
  html+='</div></div>';
  html+='<svg class="svg-ov" id="svgsh"></svg>';
  html+='</div></div>';

  // === 関係性詳細（タップで〇＋線）===
  var rel=o.rel;
  function rs(title,items,desc){
    var isBad=(title==='冲'||title==='刑');
    var cnt=items.length>0?items.length+'組':'なし';
    var cntCls=items.length>0?(isBad?'r':''):'none';
    var h='<div class="rel-sec"><div class="rel-hd"><span class="rel-nm">'+title+'</span><span class="rel-cnt '+cntCls+'">'+cnt+'</span></div>';
    if(items.length>0){
      h+='<div class="rel-pairs">';
      items.forEach(function(item,ii){
        var cls=item.type==='both'?'both':(isBad?'r':'g');
        h+='<span class="rel-pair '+cls+'" data-ridx="sh" data-type="'+title+'" data-ii="'+ii+'">'+item.label+' '+PL[item.mi]+'↔'+PL[item.ti]+'</span>';
      });
      h+='</div>';
    }
    return h+'<div class="rel-desc">'+desc+'</div></div>';
  }
  html+='<div class="card" style="margin:0">';
  html+=rs('干合',rel.kango,'多ければ多いほど一目で惹かれる');
  html+=rs('三合',rel.sango,'価値観や考え方が似ていて安定した関係');
  html+=rs('支合',rel.shigo,'互いに助け合い調和を象徴する良き関係');
  html+=rs('冲',rel.chu,'反発や衝突が起きやすい関係');
  html+=rs('刑',rel.kei,'トラブルや泥沼化になりやすい関係');
  html+='</div>';

  el.innerHTML=html;
  el.style.display='block';
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ===== メモ機能（localStorage に保存） =====

/** 保存済みの診断メモを localStorage から取得 @returns {Array} */
function getShindanMemos(){
  try{return JSON.parse(localStorage.getItem(shindanMemoKey())||'[]');}catch(e){return[];}
}

/** 診断メモを localStorage に保存 @param {Array} arr */
function setShindanMemos(arr){
  localStorage.setItem(shindanMemoKey(),JSON.stringify(arr));
}

/** 現在表示中の診断結果をメモとして保存 */
function saveShindanMemo(){
  if(!lastShindanData)return;
  var memos=getShindanMemos();
  var entry=Object.assign({},lastShindanData,{
    id:Date.now(),
    savedAt:new Date().toISOString(),
    type:(lastShindanData.type||'self')
  });
  memos.push(entry);
  setShindanMemos(memos);
  populateShindanPickers(); // 新しい人物をピッカーに反映
  var btn=document.getElementById('memo-save-btn');
  if(btn){
    btn.textContent='✓ メモに保存しました';
    btn.disabled=true;
    btn.style.opacity='0.6';
    btn.style.cursor='default';
  }
}

/** メモのタイプ切替（自分との相性 / 自分以外の相性） @param {'self'|'others'} t */
function setMemoType(t){
  memoFilterType=(t==='others')?'others':'self';
  document.querySelectorAll('[data-memo-type]').forEach(function(b){
    b.classList.toggle('on', b.dataset.memoType===memoFilterType);
  });
  renderMemoList();
}

/** メモ並べ替えキー切替 @param {string} v */
function setMemoSort(v){ memoSortKey=v||'new'; renderMemoList(); }
/** メモ性別絞り込み切替（自分との相性のみ） @param {string} v */
function setMemoGender(v){ memoGenderFilter=v||'all'; renderMemoList(); }

/** メモ配列を指定キーで並べ替えた新配列を返す */
function sortMemos(arr, key){
  var s=arr.slice();
  switch(key){
    case 'score_high': s.sort(function(a,b){return (b.score||0)-(a.score||0);}); break;
    case 'score_low':  s.sort(function(a,b){return (a.score||0)-(b.score||0);}); break;
    case 'old':        s.sort(function(a,b){return new Date(a.savedAt)-new Date(b.savedAt);}); break;
    case 'new':
    default:           s.sort(function(a,b){return new Date(b.savedAt)-new Date(a.savedAt);});
  }
  return s;
}

/** 保存済みメモの一覧を描画（タイプでフィルタ） */
function renderMemoList(){
  var container=document.getElementById('memo-list');
  if(!container)return;
  // タイプ切替バーは NOマッチングのみ表示
  var noMatch=(typeof myPlan!=='undefined' && myPlan==='no_matching');
  var bar=document.getElementById('memo-type-bar');
  if(bar) bar.style.display = noMatch ? 'flex' : 'none';
  var filterT = noMatch ? memoFilterType : 'self';

  // タイプで絞り込み
  var typeList=getShindanMemos().filter(function(m){
    var t=(m.type==='others')?'others':'self';
    return t===filterT;
  });
  // 並べ替え／性別絞り込みコントロールの表示制御
  var ctrls=document.getElementById('memo-controls');
  if(ctrls) ctrls.style.display = (typeList.length>0) ? 'flex' : 'none';
  var genderSel=document.getElementById('memo-gender');
  if(genderSel) genderSel.style.display = (filterT==='self') ? '' : 'none';

  // 性別絞り込み（自分との相性のみ）
  var list=typeList;
  if(filterT==='self' && memoGenderFilter!=='all'){
    list=list.filter(function(m){ return (m.gender||'')===memoGenderFilter; });
  }
  // 並べ替え
  list=sortMemos(list, memoSortKey);

  if(list.length===0){
    var emptyMsg;
    if(typeList.length>0){
      emptyMsg='✦<br>該当する性別のメモはありません。';
    }else if(filterT==='others'){
      emptyMsg='✦<br>「自分以外の相性」のメモはまだありません。<br>相性診断で「自分以外の相性」を診断して保存するとここに表示されます。';
    }else{
      emptyMsg='✦<br>まだメモがありません。<br>相性診断ページで「メモに保存」を押すと、ここに表示されます。';
    }
    container.innerHTML='<div style="text-align:center;padding:2rem 1rem;color:var(--color-text-tertiary);font-size:12px;line-height:1.8">'+emptyMsg+'</div>';
    return;
  }
  var html='';
  list.forEach(function(memo){
    if(memo.type==='others'){
      var a=memo.personA||{}, b=memo.personB||{};
      var nm=shEsc(stripSan(a.name||'1人目')+' & '+stripSan(b.name||'2人目'));
      var sub=(a.year+'年'+a.month+'月'+a.day+'日')+' ／ '+(b.year+'年'+b.month+'月'+b.day+'日');
      html+='<div class="card" style="margin:0 0 .6rem;padding:.75rem 1rem">';
      html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      html+='<div style="min-width:0;flex:1">';
      html+='<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px;word-break:break-all">'+nm+'</div>';
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);line-height:1.5">'+shEsc(sub)+'</div>';
      html+='</div>';
      html+='<div style="font-family:\'Noto Serif JP\',serif;font-size:22px;font-weight:700;color:#C9A96E;line-height:1;text-align:right;flex-shrink:0">'+memo.score+'<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400">%</span></div>';
      html+='</div>';
      html+='<div style="display:flex;gap:8px;margin-top:.6rem">';
      html+='<button onclick="reShindan('+memo.id+')" style="flex:1;font-size:11px;padding:7px 12px;border:0.5px solid #C9A96E;color:#C9A96E;background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">詳細を見る</button>';
      html+='<button onclick="deleteMemo('+memo.id+')" style="font-size:11px;padding:7px 14px;border:0.5px solid var(--color-border-tertiary);color:var(--color-text-tertiary);background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">削除</button>';
      html+='</div>';
      html+='</div>';
    }else{
      var displayName=shEsc(stripSan(memo.name||'お相手'));
      var dateStr=memo.year+'年'+memo.month+'月'+memo.day+'日';
      html+='<div class="card" style="margin:0 0 .6rem;padding:.75rem 1rem">';
      html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      html+='<div style="min-width:0;flex:1">';
      html+='<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px;word-break:break-all">'+displayName+'</div>';
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);line-height:1.5">'+dateStr+'  /  '+shEsc(memo.gender||'')+'</div>';
      html+='</div>';
      html+='<div style="font-family:\'Noto Serif JP\',serif;font-size:22px;font-weight:700;color:#C9A96E;line-height:1;text-align:right;flex-shrink:0">'+memo.score+'<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400">%</span></div>';
      html+='</div>';
      html+='<div style="display:flex;gap:8px;margin-top:.6rem">';
      html+='<button onclick="reShindan('+memo.id+')" style="flex:1;font-size:11px;padding:7px 12px;border:0.5px solid #C9A96E;color:#C9A96E;background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">詳細を見る</button>';
      html+='<button onclick="deleteMemo('+memo.id+')" style="font-size:11px;padding:7px 14px;border:0.5px solid var(--color-border-tertiary);color:var(--color-text-tertiary);background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">削除</button>';
      html+='</div>';
      html+='</div>';
    }
  });
  container.innerHTML=html;
}

/** 過去メモから診断を再表示 @param {number} id */
function reShindan(id){
  var memos=getShindanMemos();
  var memo=memos.find(function(m){return m.id===id;});
  if(!memo)return;
  openSubPage('shindan');
  // NOマッチングの相性タブでは相性診断サブタブへ同期切替
  if(typeof setAishouSub==='function' && document.getElementById('aishou-sub-tabs')) setAishouSub('shindan');
  initShindanOthers();

  if(memo.type==='others'){
    setShindanMode('others');
    fillShindanForm(SH_P1, memo.personA);
    fillShindanForm(SH_P2, memo.personB);
    REL_CACHE['sh']=memo.rel;
    lastShindanData=memo;
    var a=memo.personA||{}, b=memo.personB||{};
    renderShindanResult({
      title:(stripSan(a.name||'1人目')+'さんと'+stripSan(b.name||'2人目')+'さんの良縁率'),
      leftLabel:(stripSan(a.name||'1人目')+'さん'), leftPillars:a.pillars,
      rightLabel:(stripSan(b.name||'2人目')+'さん'), rightPillars:b.pillars,
      score:memo.score, rel:memo.rel, comment:memo.comment,
      missingTime:(a.missingTime||b.missingTime), missingLocation:(a.missingLocation||b.missingLocation)
    });
  }else{
    setShindanMode('self');
    fillShindanForm(SH_P1, {name:memo.name,gender:memo.gender,year:memo.year,month:memo.month,day:memo.day,hour:memo.hour,min:memo.min,prefIdx:memo.prefIdx,longitude:memo.longitude});
    REL_CACHE['sh']=memo.rel;
    lastShindanData=memo;
    renderShindanResult({
      title:(stripSan(memo.name||'お相手')+'さんとの良縁率'),
      leftLabel:'あなた', leftPillars:MY_PILLARS,
      rightLabel:(stripSan(memo.name||'お相手')+'さん'), rightPillars:memo.partnerPillars,
      score:memo.score, rel:memo.rel, comment:memo.comment,
      missingTime:memo.hour==null, missingLocation:memo.longitude==null
    });
  }
}

/** 診断メモを削除 @param {number} id */
function deleteMemo(id){
  if(!confirm('このメモを削除しますか？'))return;
  var memos=getShindanMemos();
  memos=memos.filter(function(m){return m.id!==id;});
  setShindanMemos(memos);
  populateShindanPickers();
  renderMemoList();
}
