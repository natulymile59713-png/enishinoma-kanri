// ===== UI: マッチング一覧・フィルタ・詳細表示・SVG描画 =====
function applyFilter(){var minScore=parseInt(document.getElementById('f-score').value)||0;if(minScore<50)minScore=50;var filtered=ALL_SORTED.filter(function(item){if(ngList.indexOf(item.i)>=0)return false;if(item.score<minScore)return false;return true;});renderFiltered(filtered);}
function renderFiltered(list){var container=document.getElementById('match-list');if(list.length===0){container.innerHTML='<div class="no-result">条件に合う方が見つかりませんでした。</div>';return;}var html='';var hasDemo=list.some(function(item){return item.isDemo;});if(hasDemo&&!demoGuideDismissed){html+='<div class="demo-guide" id="demo-guide">リアルユーザーの推しが現れたら、このデモユーザーのように、<br>このページに追加されていきます。<br><br>良縁率80%以上の方は【運命の相手候補】なので要チェック！<br><span class="demo-guide-close" onclick="dismissDemoGuide()">閉じる</span></div>';}list.forEach(function(item){html+=buildDetail(item.i,MY_PILLARS,item.p,item.score,item.tags,item.isDemo);});container.innerHTML=html;
    // 申請済みのボタンを更新
    if(currentUser){
      supa.from('matches').select('to_user_id').eq('from_user_id',currentUser.id).then(function(res){
        if(res.data){
          var sentIds=res.data.map(function(m){return m.to_user_id;});
          PARTNERS.forEach(function(p,i){
            if(p.userId&&sentIds.indexOf(p.userId)>=0){
              var btn=document.getElementById('hanashi-btn-'+i);
              if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');btn.disabled=true;}
            }
          });
        }
      });
    }}
function dismissDemoGuide(){demoGuideDismissed=true;var el=document.getElementById('demo-guide');if(el)el.remove();}
function buildDetail(idx,myP,partner,score,tagsHtml,isDemo){var rel=REL_CACHE[idx];var card='<div class="match-card" id="card'+idx+'" onclick="toggleDetail('+idx+')">'+'<div class="ava-blur">🙂</div>'+'<div class="minfo"><div class="mname">'+partner.name+(isDemo?'<span class="demo-badge">デモ</span>':'')+'</div><div class="mmeta">'+partner.meta+'</div><div class="tags">'+tagsHtml+'</div><div class="abar"><div class="afill" style="width:'+score+'%"></div></div><div class="albl">良縁率：'+score+'%</div></div><div class="ndot"></div></div>';var cmp='<div class="compare-wrap" id="cwrap'+idx+'"><div class="compare-grid"><div class="pcol"><div class="col-lbl">あなた</div>';for(var pi=0;pi<4;pi++){cmp+='<div class="pce mine" id="mypc_'+idx+'_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="mykan_'+idx+'_'+pi+'">'+KAN[myP[pi].k]+'</div><div class="pce-s" id="myshi_'+idx+'_'+pi+'">'+SHI[myP[pi].s]+'</div></div>';}cmp+='</div><div class="pcol"><div class="col-lbl">'+partner.name+'</div>';for(var pi=0;pi<4;pi++){cmp+='<div class="pce" id="thpc_'+idx+'_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="thkan_'+idx+'_'+pi+'">'+KAN[partner.pillars[pi].k]+'</div><div class="pce-s" id="thshi_'+idx+'_'+pi+'">'+SHI[partner.pillars[pi].s]+'</div></div>';}cmp+='</div></div><svg class="svg-ov" id="svg'+idx+'"></svg></div>';function rSec(title,items,desc){var isBad=(title==='冲'||title==='刑'),cnt=items.length>0?items.length+'組':'なし',cntCls=items.length>0?(isBad?'r':''):'none';var h='<div class="rel-sec"><div class="rel-hd"><span class="rel-nm">'+title+'</span><span class="rel-cnt '+cntCls+'">'+cnt+'</span></div>';if(items.length>0){h+='<div class="rel-pairs">';items.forEach(function(item,ii){var cls=item.type==='both'?'both':(isBad?'r':'g');h+='<span class="rel-pair '+cls+'" data-ridx="'+idx+'" data-type="'+title+'" data-ii="'+ii+'">'+item.label+' '+PL[item.mi]+'↔'+PL[item.ti]+'</span>';});h+='</div>';}return h+'<div class="rel-desc">'+desc+'</div></div>';}return card+'<div class="detail-panel" id="detail'+idx+'"><div class="card" style="margin:0 0 .75rem"><div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:.6rem">四柱の比較（ペアをタップで干支を強調）</div>'+cmp+'<div class="comment-box">'+generateComment(rel)+'</div><div class="rel-div"></div>'+rSec('干合',rel.kango,'多ければ多いほど一目で惹かれる')+rSec('三合',rel.sango,'価値観や考え方が似ていて安定した関係')+rSec('支合',rel.shigo,'互いに助け合い調和を象徴する良き関係')+rSec('冲',rel.chu,'反発や衝突が起きやすい関係')+rSec('刑',rel.kei,'トラブルや泥沼化になりやすい関係')+'<button class="btn-hanashi" id="hanashi-btn-'+idx+'" onclick="hanashi('+idx+')">話してみたい</button></div></div>';}
function renderMatchList(myP){var cache={};for(var i=0;i<PARTNERS.length;i++)cache[i]=checkRelations(myP,PARTNERS[i].pillars);REL_CACHE=cache;PARTNERS_DATA=[];ALL_SORTED=PARTNERS.map(function(p,i){var sc=calcScore(cache[i]),rel=cache[i],th='';if(rel.kango.length>0)th+='<span class="tag g">干合：'+rel.kango.length+'</span>';if(rel.sango.length>0)th+='<span class="tag g">三合：'+rel.sango.length+'</span>';if(rel.shigo.length>0)th+='<span class="tag g">支合：'+rel.shigo.length+'</span>';if(rel.chu.length>0)th+='<span class="tag r">冲：'+rel.chu.length+'</span>';if(rel.kei.length>0)th+='<span class="tag r">刑：'+rel.kei.length+'</span>';PARTNERS_DATA[i]={name:p.name,meta:p.meta,score:sc,tags:th,isDemo:p.isDemo||false};return{p:p,i:i,score:sc,tags:th,isDemo:p.isDemo||false};});ALL_SORTED.sort(function(a,b){return b.score-a.score;});applyFilter();}
function toggleFilter(){var b=document.getElementById('filter-body'),ic=document.getElementById('filter-icon');var o=b.classList.contains('open');b.classList.toggle('open',!o);ic.classList.toggle('open',!o);}
function toggleAge(type){ageState[type]=!ageState[type];document.getElementById('age-'+type).classList.toggle('on',ageState[type]);document.getElementById('row-upper').style.display=ageState.older?'flex':'none';document.getElementById('row-lower').style.display=ageState.younger?'flex':'none';updateAgeSummary();applyFilter();}
function updateAgeSummary(){if(!document.getElementById('age-upper'))return;var u=parseInt(document.getElementById('age-upper').value),l=parseInt(document.getElementById('age-lower').value),p=[];p.push(ageState.older?(u===0?'年上：指定しない':'最大'+u+'歳上まで'):'年上：なし');p.push(ageState.younger?(l===0?'年下：指定しない':'最大'+l+'歳下まで'):'年下：なし');document.getElementById('age-sum').textContent=p.join('・');}
function toggleDetail(idx){var d=document.getElementById('detail'+idx),c=document.getElementById('card'+idx);var isOpen=d.classList.contains('open');document.querySelectorAll('.detail-panel').forEach(function(p){p.classList.remove('open');});document.querySelectorAll('.match-card').forEach(function(c2){c2.classList.remove('open');});clearAllSvg();if(!isOpen){d.classList.add('open');c.classList.add('open');}}
function clearAllSvg(){document.querySelectorAll('.svg-ov').forEach(function(s){s.innerHTML='';}); }
function clearSvg(idx){var s=document.getElementById('svg'+idx);if(s)s.innerHTML='';}
function getCenter(el,svgEl){var sr=svgEl.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:(r.left+r.right)/2-sr.left,y:(r.top+r.bottom)/2-sr.top,w:r.width,h:r.height};}
function drawCircle(svg,cx,cy,rw,rh,color){var el=document.createElementNS('http://www.w3.org/2000/svg','ellipse');el.setAttribute('cx',cx);el.setAttribute('cy',cy);el.setAttribute('rx',rw/2+5);el.setAttribute('ry',rh/2+5);el.setAttribute('fill','none');el.setAttribute('stroke',color);el.setAttribute('stroke-width','2');el.setAttribute('stroke-dasharray','5 3');svg.appendChild(el);}
function drawLine(svg,x1,y1,x2,y2,color){var line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2);line.setAttribute('stroke',color);line.setAttribute('stroke-width','1.5');line.setAttribute('stroke-dasharray','5 3');line.setAttribute('opacity','0.85');svg.appendChild(line);}
function highlightPair(idx,type,ii){clearSvg(idx);var svg=document.getElementById('svg'+idx);if(!svg)return;var rel=REL_CACHE[idx];var color='#C9A96E';if(type==='冲'||type==='刑')color='#C05050';var items={干合:rel.kango,三合:rel.sango,支合:rel.shigo,冲:rel.chu,刑:rel.kei};var item=(items[type]||[])[ii];if(!item)return;if(item.type==='both')color='#9966CC';var et=(type==='干合')?'kan':'shi';var myEl=document.getElementById('my'+et+'_'+idx+'_'+item.mi),thEl=document.getElementById('th'+et+'_'+idx+'_'+item.ti);if(!myEl||!thEl)return;var c1=getCenter(myEl,svg),c2=getCenter(thEl,svg);drawCircle(svg,c1.x,c1.y,c1.w,c1.h,color);drawCircle(svg,c2.x,c2.y,c2.w,c2.h,color);drawLine(svg,c1.x,c1.y,c2.x,c2.y,color);}

// ===== マッチ申請（hanashi） =====
async function hanashi(idx){
  var partner=PARTNERS[idx];
  if(!partner||!partner.userId||partner.isDemo){
    // デモユーザーの場合はボタン変更のみ
    var btn=document.getElementById('hanashi-btn-'+idx);
    if(btn){btn.textContent='デモのため送信不可';btn.classList.add('sent');btn.disabled=true;}
    return;
  }
  var btn=document.getElementById('hanashi-btn-'+idx);
  if(btn){btn.textContent='送信中...';btn.disabled=true;}
  try{
    // 既に申請済みか確認
    var{data:existing}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('to_user_id',partner.userId);
    if(existing&&existing.length>0){if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');}return;}
    // matchesテーブルに保存
    var{error}=await supa.from('matches').insert({from_user_id:currentUser.id,to_user_id:partner.userId,status:'pending'});
    if(error){alert('申請エラー：'+error.message);if(btn){btn.textContent='話してみたい';btn.disabled=false;}return;}
    if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');}
    loadEnList();
  }catch(e){console.log('hanashiエラー:',e);if(btn){btn.textContent='話してみたい';btn.disabled=false;}}
}

// ===== リアルユーザー読み込み =====
async function loadRealUsers() {
  if (!currentUser) return;
  try {
    const { data: users, error } = await supa.from('profiles').select('*').neq('id', currentUser.id);
    if (error) { console.log('ユーザー取得エラー:', error); }
    var validUsers = (users && !error) ? users : [];
    // matchesに記録がある相手を推しページから除外（status問わず）
    try{
      var{data:allMatches}=await supa.from('matches').select('from_user_id,to_user_id').or('from_user_id.eq.'+currentUser.id+',to_user_id.eq.'+currentUser.id);
      var blockedIds=[];
      if(allMatches){
        allMatches.forEach(function(r){
          if(r.from_user_id===currentUser.id)blockedIds.push(r.to_user_id);
          if(r.to_user_id===currentUser.id)blockedIds.push(r.from_user_id);
        });
      }
      if(blockedIds.length>0){
        validUsers=validUsers.filter(function(u){return blockedIds.indexOf(u.id)<0;});
      }
    }catch(e){console.log('除外エラー:',e);}
    // 異性のみフィルター
    if (mySex) {
      var targetSex = '';
      if (mySex === '男性') targetSex = '女性';
      else if (mySex === '女性') targetSex = '男性';
      if (targetSex) {
        validUsers = validUsers.filter(function(u){ return u.sex === targetSex; });
      }
    }

    const realPartners = validUsers.map(u => ({
      name: u.nickname + 'さん',
      meta: (u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '') + (u.prefecture ? '・' + u.prefecture : ''),
      pillars: [
        {k: u.pillar_year_k||0, s: u.pillar_year_s||0},
        {k: u.pillar_month_k||0, s: u.pillar_month_s||0},
        {k: u.pillar_day_k||0, s: u.pillar_day_s||0},
        {k: u.pillar_hour_k||0, s: u.pillar_hour_s||0}
      ],
      userId: u.id,
      isDemo: false
    }));

    PARTNERS.splice(0, PARTNERS.length);
    if (realPartners.length > 0) {
      // リアルユーザーが1人でもいればデモは表示しない
      realPartners.forEach(function(p){ PARTNERS.push(p); });
    } else {
      // リアルユーザーがいない場合のみデモを表示（異性のデモを選択）
      var demoFemale = [
        {name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},
        {name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},
        {name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},
        {name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},
        {name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}
      ];
      var demoData = (mySex === '女性') ? DEMO_MALE : demoFemale;
      demoData.forEach(function(p){ PARTNERS.push(p); });
    }
    renderMatchList(MY_PILLARS);
  } catch(e) {
    console.log('ユーザー読み込みエラー', e);
    // エラー時もデモデータを表示
    PARTNERS.splice(0, PARTNERS.length);
    var demoFemale2 = [
      {name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},
      {name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},
      {name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},
      {name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},
      {name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}
    ];
    var demoErr = (mySex === '女性') ? DEMO_MALE : demoFemale2;
    demoErr.forEach(function(p){ PARTNERS.push(p); });
    renderMatchList(MY_PILLARS);
  }
}
