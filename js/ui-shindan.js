// ===== UI: 相性診断（その他タブ内、リアル知り合い等との相性チェック） =====

// 直近の診断データ（メモ保存用）
var lastShindanData = null;

// localStorage key（ユーザー単位で分離）
function shindanMemoKey(){
  return 'shindan_memos_'+(currentUser?currentUser.id:'guest');
}

// 名前末尾の「さん」を削除（表示時に "さん" を必ず一度だけ付けるため）
function stripSan(name){
  return (name||'').replace(/さん$/,'');
}

// ===== フォーム操作 =====

// 性別ボタンのトグル
function setShSex(el){
  document.querySelectorAll('#sub-shindan .sxbtn').forEach(function(b){b.classList.remove('on');});
  el.classList.add('on');
}

// 都道府県セレクト初期化（デフォルトは神奈川県、わからないも選択可）
function initShPrefs(){
  var s=document.getElementById('sh-pref');
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
  updShCity();
}

// 都道府県に応じて市区町村セレクトを更新
function updShCity(){
  var pi=parseInt(document.getElementById('sh-pref').value);
  var cs=document.getElementById('sh-city');
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

// ===== 診断実行 =====

function runShindan(){
  var errEl=document.getElementById('sh-error');
  errEl.textContent='';

  // 必須チェック
  var sxBtn=document.querySelector('#sub-shindan .sxbtn.on');
  if(!sxBtn){errEl.textContent='性別を選択してください';return;}
  var sex=sxBtn.textContent;
  var yr=parseInt(document.getElementById('sh-yr').value);
  var mo=parseInt(document.getElementById('sh-mo').value);
  var dy=parseInt(document.getElementById('sh-dy').value);
  if(!yr||!mo||!dy){errEl.textContent='生年月日（年・月・日）を入力してください';return;}
  if(yr<1900||yr>2030||mo<1||mo>12||dy<1||dy>31){errEl.textContent='生年月日が正しくありません';return;}
  if(!MY_PILLARS||MY_PILLARS.length===0){errEl.textContent='自分のプロフィール情報が読み込まれていません。再ログインしてお試しください。';return;}

  // 任意項目（不明ならデフォルト値で計算）
  var hrRaw=document.getElementById('sh-hr').value;
  var mnRaw=document.getElementById('sh-mn').value;
  var hr=parseInt(hrRaw);
  var mn=parseInt(mnRaw);
  var hasTime=!isNaN(hr);
  if(isNaN(hr))hr=12;
  if(isNaN(mn))mn=0;

  var prefIdx=parseInt(document.getElementById('sh-pref').value);
  var lonStr=document.getElementById('sh-city').value;
  var lon=parseFloat(lonStr);
  var hasLocation=!isNaN(lon)&&lon>0;
  if(!hasLocation)lon=135.0;

  // 計算（自分の時柱がnullなら相手側のhasTimeに関わらずスキップ済み）
  var partnerPillars=calcPillars(yr,mo,dy,hasTime?hr:null,hasTime?mn:null,hasLocation?lon:null);
  var rel=checkRelations(MY_PILLARS,partnerPillars);
  // checkRelations内でnull柱はスキップしているため追加フィルタは不要
  var score=calcScore(rel);
  var comment=generateComment(rel);
  var name=document.getElementById('sh-name').value.trim()||'お相手';

  // ペアタップで〇＋線を描けるよう REL_CACHE['sh'] に格納
  REL_CACHE['sh']=rel;

  // 直近のデータを保存（メモ保存用）
  lastShindanData={
    name:name,gender:sex,
    year:yr,month:mo,day:dy,
    hour:hasTime?hr:null,min:hasTime?mn:null,
    prefIdx:isNaN(prefIdx)?-1:prefIdx,
    longitude:hasLocation?lon:null,
    partnerPillars:partnerPillars,
    rel:rel,score:score,comment:comment
  };

  renderShindanResult(name,partnerPillars,score,rel,comment,!hasTime,!hasLocation);
}

// ===== 結果描画（マッチング画面と統一感、ペアタップで〇＋線対応） =====

function renderShindanResult(name,partnerP,score,rel,comment,missingTime,missingLocation){
  var el=document.getElementById('sh-result');
  if(!el)return;

  var displayName=stripSan(name)+'さん';
  var html='';

  // === 良縁率カード ===
  html+='<div class="card" style="margin:0 0 .75rem">';
  html+='<div style="font-size:13px;font-weight:500;margin-bottom:.5rem;text-align:center;color:var(--color-text-secondary)">'+displayName+'との良縁率</div>';
  html+='<div style="font-family:\'Noto Serif JP\',serif;font-size:36px;font-weight:700;color:#C9A96E;text-align:center;line-height:1.1;margin-bottom:.5rem">'+score+'%</div>';
  html+='<div class="abar" style="margin-bottom:.75rem"><div class="afill" style="width:'+score+'%"></div></div>';
  if(missingTime||missingLocation){
    var notes=[];
    if(missingTime)notes.push('出生時刻');
    if(missingLocation)notes.push('出生地');
    html+='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;line-height:1.6;margin-bottom:.5rem">※ '+notes.join('・')+'未入力のため一般的な値で計算しました（参考値）</div>';
  }
  html+='<div class="comment-box" style="font-size:12px;line-height:1.7;margin-bottom:.75rem">'+comment+'</div>';
  // メモ保存ボタン
  html+='<button id="memo-save-btn" onclick="saveShindanMemo()" style="display:block;width:100%;padding:9px 0;font-size:12px;color:#C9A96E;background:transparent;border:0.5px solid #C9A96E;border-radius:8px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif;letter-spacing:.05em">📝 この結果をメモに保存</button>';
  html+='</div>';

  // === 命式比較（compare-wrap + svg, 時柱は時刻不明なら空欄）===
  html+='<div class="card" style="margin:0 0 .75rem">';
  html+='<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:.6rem;text-align:center">命式の比較（ペアをタップで干支を強調）</div>';
  html+='<div class="compare-wrap"><div class="compare-grid">';
  // あなた側（時柱は時刻不明なら空欄）
  html+='<div class="pcol"><div class="col-lbl">あなた</div>';
  for(var pi=0;pi<4;pi++){
    var mp=MY_PILLARS[pi];
    var myKanText=mp?KAN[mp.k]:'—';
    var myShiText=mp?SHI[mp.s]:'—';
    html+='<div class="pce mine" id="mypc_sh_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="mykan_sh_'+pi+'">'+myKanText+'</div><div class="pce-s" id="myshi_sh_'+pi+'">'+myShiText+'</div></div>';
  }
  html+='</div>';
  // お相手側（時刻不明なら時柱は空欄）
  html+='<div class="pcol"><div class="col-lbl">'+displayName+'</div>';
  for(var pi=0;pi<4;pi++){
    var tp=partnerP[pi];
    var kanText=tp?KAN[tp.k]:'—';
    var shiText=tp?SHI[tp.s]:'—';
    html+='<div class="pce" id="thpc_sh_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="thkan_sh_'+pi+'">'+kanText+'</div><div class="pce-s" id="thshi_sh_'+pi+'">'+shiText+'</div></div>';
  }
  html+='</div></div>';
  html+='<svg class="svg-ov" id="svgsh"></svg>';
  html+='</div></div>';

  // === 関係性詳細（タップで〇＋線、推しページと同じ仕様）===
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

function getShindanMemos(){
  try{return JSON.parse(localStorage.getItem(shindanMemoKey())||'[]');}catch(e){return[];}
}

function setShindanMemos(arr){
  localStorage.setItem(shindanMemoKey(),JSON.stringify(arr));
}

function saveShindanMemo(){
  if(!lastShindanData)return;
  var memos=getShindanMemos();
  var entry=Object.assign({},lastShindanData,{
    id:Date.now(),
    savedAt:new Date().toISOString()
  });
  memos.push(entry);
  setShindanMemos(memos);
  // ボタンを「保存しました」表示に
  var btn=document.getElementById('memo-save-btn');
  if(btn){
    btn.textContent='✓ メモに保存しました';
    btn.disabled=true;
    btn.style.opacity='0.6';
    btn.style.cursor='default';
  }
}

function renderMemoList(){
  var container=document.getElementById('memo-list');
  if(!container)return;
  var list=getShindanMemos();
  if(list.length===0){
    container.innerHTML='<div style="text-align:center;padding:2rem 1rem;color:var(--color-text-tertiary);font-size:12px;line-height:1.8">✦<br>まだメモがありません。<br>相性診断ページで「メモに保存」を押すと、ここに表示されます。</div>';
    return;
  }
  // 新しい順
  list.sort(function(a,b){return new Date(b.savedAt)-new Date(a.savedAt);});
  var html='';
  list.forEach(function(memo){
    var displayName=stripSan(memo.name||'お相手')+'さん';
    var dateStr=memo.year+'年'+memo.month+'月'+memo.day+'日';
    html+='<div class="card" style="margin:0 0 .6rem;padding:.75rem 1rem">';
    html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
    html+='<div style="min-width:0;flex:1">';
    html+='<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px;word-break:break-all">'+displayName+'</div>';
    html+='<div style="font-size:11px;color:var(--color-text-tertiary);line-height:1.5">'+dateStr+'  /  '+(memo.gender||'')+'</div>';
    html+='</div>';
    html+='<div style="font-family:\'Noto Serif JP\',serif;font-size:22px;font-weight:700;color:#C9A96E;line-height:1;text-align:right;flex-shrink:0">'+memo.score+'<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400">%</span></div>';
    html+='</div>';
    html+='<div style="display:flex;gap:8px;margin-top:.6rem">';
    html+='<button onclick="reShindan('+memo.id+')" style="flex:1;font-size:11px;padding:7px 12px;border:0.5px solid #C9A96E;color:#C9A96E;background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">詳細を見る</button>';
    html+='<button onclick="deleteMemo('+memo.id+')" style="font-size:11px;padding:7px 14px;border:0.5px solid var(--color-border-tertiary);color:var(--color-text-tertiary);background:transparent;border-radius:6px;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif">削除</button>';
    html+='</div>';
    html+='</div>';
  });
  container.innerHTML=html;
}

function reShindan(id){
  var memos=getShindanMemos();
  var memo=memos.find(function(m){return m.id===id;});
  if(!memo)return;
  openSubPage('shindan');
  // フォーム再現
  document.getElementById('sh-name').value=memo.name||'';
  document.querySelectorAll('#sub-shindan .sxbtn').forEach(function(b){
    b.classList.toggle('on',b.textContent===memo.gender);
  });
  document.getElementById('sh-yr').value=memo.year;
  document.getElementById('sh-mo').value=memo.month;
  document.getElementById('sh-dy').value=memo.day;
  document.getElementById('sh-hr').value=(memo.hour!=null?memo.hour:'');
  document.getElementById('sh-mn').value=(memo.min!=null?memo.min:'');
  if(typeof memo.prefIdx==='number'&&memo.prefIdx>=0){
    document.getElementById('sh-pref').value=memo.prefIdx;
    updShCity();
    if(memo.longitude){
      // longitude に一致する city option を選択
      var cs=document.getElementById('sh-city');
      for(var i=0;i<cs.options.length;i++){
        if(parseFloat(cs.options[i].value)===memo.longitude){cs.selectedIndex=i;break;}
      }
    }
  }else{
    document.getElementById('sh-pref').value='-1';
    updShCity();
  }
  // 結果も即再描画（再計算なし、保存データを利用）
  REL_CACHE['sh']=memo.rel;
  lastShindanData=memo;
  renderShindanResult(memo.name,memo.partnerPillars,memo.score,memo.rel,memo.comment,memo.hour==null,memo.longitude==null);
}

function deleteMemo(id){
  if(!confirm('このメモを削除しますか？'))return;
  var memos=getShindanMemos();
  memos=memos.filter(function(m){return m.id!==id;});
  setShindanMemos(memos);
  renderMemoList();
}
