// ===== UI: 縁リスト・メッセージ・運営チャット・レビュー =====
function updateEnBadge(){var p=enList.filter(function(e){return e.status==='pending';}).length;['en-badge','bni-badge'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display=p>0?'block':'none';});}
function renderEnList(){
  var el=document.getElementById('en-list'),empty=document.getElementById('en-empty');
  if(!el)return;
  if(enList.length===0){el.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  // ソート：新しいマッチを上に
  var statusOrder={approved:0,approved_by_me:1,chatting:2,date_set:3,dated:4,coupled:5,pending:6,sent:7,rejected_notify:8,matched:9};
  var sorted=enList.slice().sort(function(a,b){return (statusOrder[a.status]||99)-(statusOrder[b.status]||99);});
  var html='';
  sorted.forEach(function(item){
    var s=item.status;
    var badgeLabel={'matched':'やりとり中','approved':'承認されました！','approved_by_me':'承認しました','sent':'申請中','pending':'承認待ち','rejected_notify':'キャンセル','chatting':'やりとり中','date_set':'デート決定！','dated':'デート完了','coupled':'カップル成立！'}[s]||s;
    var badgeClass='pending';
    if(s==='matched'||s==='approved'||s==='approved_by_me'||s==='chatting')badgeClass='chatting';
    if(s==='date_set')badgeClass='date-set';
    if(s==='dated')badgeClass='dated';
    if(s==='coupled')badgeClass='coupled';
    if(s==='approved'||s==='approved_by_me')badgeClass='matched';
    var isCompact=(s==='matched'||s==='chatting'||s==='date_set'||s==='dated'||s==='coupled');
    html+='<div class="en-card '+(isCompact?'en-card-compact':'')+' '+((s==='matched'||s==='chatting'||s==='approved'||s==='approved_by_me'||s==='date_set'||s==='dated'||s==='coupled')?'matched':'')+'">';
    html+='<div class="en-top"><div class="ava">'+item.name.charAt(0)+'</div><div class="minfo"><div class="mname">'+item.name+'<span class="en-badge '+badgeClass+'">'+badgeLabel+'</span></div><div class="mmeta">'+item.meta+'</div></div></div>';
    if(s==='pending'){
      html+='<div class="en-actions"><button class="btn-ok" onclick="enOK(\''+item.matchId+'\')">お話しOK</button><button class="btn-ng" onclick="enNG(\''+item.matchId+'\')">ごめんなさい</button></div>';
    }else if(s==='approved_by_me'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'の申請を承認しました</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='approved'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'が申請を承認しました！</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='matched'||s==='chatting'){
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\')">メッセージ</button><button class="en-phase-btn primary" onclick="setDateDecided(\''+item.matchId+'\')">デート決定！</button><button class="en-phase-btn secondary" onclick="endWithThanks(\''+item.matchId+'\')">感謝して完了</button></div>';
    }else if(s==='date_set'){
      // レビュー未送信なら「お相手をレビュー」、送信済みなら「レビュー済み ✓」
      var reviewBtnDS = item.reviewed
        ? '<button class="en-phase-btn secondary" disabled style="opacity:.55;cursor:default">レビュー済み ✓</button>'
        : '<button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">お相手をレビュー</button>';
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\')">メッセージ</button><button class="en-phase-btn primary" onclick="setCoupled(\''+item.matchId+'\')">付き合いました！</button>'+reviewBtnDS+'</div>';
    }else if(s==='dated'){
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.3rem 0">レビュー済み・完了</div>';
    }else if(s==='coupled'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;padding:.3rem 0">🎊 おめでとうございます！卒業鑑定プランが解放されました</div>';
      // カップル成立後もレビュー可能（既にレビュー済みなら「レビュー済み ✓」を表示）
      if(item.reviewed){
        html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.3rem 0">レビュー済み ✓</div>';
      }else{
        html+='<div class="en-phase-btns"><button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">お相手をレビュー</button></div>';
      }
    }else if(s==='rejected_notify'){
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.5rem 0">'+item.name+'が申請をキャンセルしました</div>';
      html+='<div style="text-align:center;margin-top:.25rem"><button style="font-size:10px;color:var(--color-text-tertiary);background:transparent;border:0.5px solid var(--color-border-tertiary);border-radius:6px;padding:4px 12px;cursor:pointer" onclick="dismissRejected(\''+item.matchId+'\')">閉じる</button></div>';
    }
    html+='</div>';
  });
  el.innerHTML=html;
}

// ===== フェーズ遷移関数 =====
async function startChatting(matchId){
  try{await supa.from('matches').update({status:'chatting'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='chatting';
  renderEnList();renderMsgList();
}
function dismissApproved(matchId){
  startChatting(matchId);
}
async function setDateDecided(matchId){
  try{await supa.from('matches').update({status:'date_set'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='date_set';
  renderEnList();
}
async function endWithThanks(matchId){
  try{await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);}catch(e){}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();updateEnBadge();loadRealUsers();
}
async function setCoupled(matchId){
  try{await supa.from('matches').update({status:'coupled'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='coupled';
  renderEnList();
  // 卒業鑑定プラン解放
  unlockSotsugyou();
}
function openReview(matchId){
  document.getElementById('review-match-id').value=matchId;
  document.getElementById('review-overlay').classList.add('show');
  document.getElementById('review-error').textContent='';
  document.getElementById('review-comment').value='';
  document.querySelectorAll('.star').forEach(function(s){s.classList.remove('on');});
  currentReviewStar=0;
}
function setStar(n){
  currentReviewStar=n;
  document.querySelectorAll('.star').forEach(function(s,i){s.classList.toggle('on',i<n);});
}
async function submitReview(){
  var matchId=document.getElementById('review-match-id').value;
  var comment=document.getElementById('review-comment').value.trim();
  var errEl=document.getElementById('review-error');
  var successEl=document.getElementById('review-success');
  var btn=document.getElementById('review-submit-btn');
  errEl.textContent='';
  if(currentReviewStar===0){errEl.textContent='★評価を選択してください';return;}
  if(!comment){errEl.textContent='コメントを入力してください';return;}
  // 即時フィードバック：ボタン無効化＋テキスト変更
  if(btn){btn.disabled=true;btn.textContent='送信中...';btn.style.opacity='0.6';btn.style.cursor='wait';}
  try{
    // matches.status は更新しない（両者の表示が連動してしまうため）
    // レビューはユーザーごとに独立して reviews テーブルに保存
    var{error}=await supa.from('reviews').insert({user_id:currentUser.id,match_id:matchId,rating:currentReviewStar,comment:comment});
    if(error)throw error;
    // 成功表示
    if(btn)btn.style.display='none';
    if(successEl)successEl.style.display='block';
    // 1.8秒後にモーダルを閉じて画面更新
    setTimeout(function(){
      document.getElementById('review-overlay').classList.remove('show');
      // ボタン状態をリセット（次回開いたとき用）
      if(btn){btn.disabled=false;btn.textContent='レビューを送信';btn.style.opacity='';btn.style.cursor='';btn.style.display='block';}
      if(successEl)successEl.style.display='none';
      // 自分のレビュー済みフラグだけ立てる（matches.status は触らない＝相手の表示には影響しない）
      var item=enList.find(function(e){return e.matchId===matchId;});
      if(item)item.reviewed=true;
      renderEnList();
    },1800);
  }catch(e){
    console.log('レビュー送信エラー:',e);
    errEl.textContent='送信に失敗しました：'+(e.message||'通信エラー');
    // ボタン復活（再送信できるように）
    if(btn){btn.disabled=false;btn.textContent='レビューを送信';btn.style.opacity='';btn.style.cursor='';}
  }
}
async function dismissRejected(matchId){
  try{
    await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);
  }catch(e){console.log('dismissed更新エラー:',e);}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();
  updateEnBadge();
  loadRealUsers();
}
async function enOK(matchId){
  try{
    var{error}=await supa.from('matches').update({status:'matched'}).eq('id',matchId);
    if(error){alert('承認エラー：'+error.message);return;}
    loadEnList();
  }catch(e){console.log('enOKエラー:',e);}
}
async function enNG(matchId){
  try{
    var{error}=await supa.from('matches').update({status:'rejected'}).eq('id',matchId);
    if(error){alert('拒否エラー：'+error.message);return;}
    loadEnList();
    loadRealUsers();
  }catch(e){console.log('enNGエラー:',e);}
}

// ===== メッセージ一覧・チャット =====
function renderMsgList(){var matched=enList.filter(function(e){return e.status==='matched';});var container=document.getElementById('msg-list-items');if(matched.length===0){container.innerHTML='';return;}var html='';matched.forEach(function(item,i){var unread=(i===0);html+='<div class="msg-list-item" onclick="openChat(\''+item.name+'\')"><div class="msg-list-ava">'+item.name.charAt(0)+(unread?'<div class="msg-unread-dot"></div>':'')+'</div><div class="msg-list-info"><div class="msg-list-name">'+item.name+'</div><div class="msg-list-preview">ほんとですね。どちらにお住まいですか？</div></div><div class="msg-list-time">11:20</div></div>';});container.innerHTML=html;}
function openChat(name){document.getElementById('chat-name').textContent=name;document.getElementById('chat-ava').textContent=name.charAt(0);document.getElementById('chat-ava').className='msg-list-ava';document.getElementById('chat-official-badge').style.display='none';document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';var body=document.getElementById('chat-body');body.innerHTML='<div class="mcnt">残り 28 / 30 回</div><div class="msg-wrap"><div class="bubble">はじめまして！よろしくお願いします。</div><div class="mtime">'+name+'｜11:02</div></div><div class="msg-wrap me"><div class="bubble me">こちらこそ！よろしくお願いします！</div><div class="mtime">11:15</div></div><div class="msg-wrap"><div class="bubble">どちらにお住まいですか？</div><div class="mtime">'+name+'｜11:20</div></div><div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div><div style="font-size:10px;color:var(--color-text-tertiary);margin-top:.6rem;line-height:1.7">※ メッセージは30回まで。他のSNSのIDやリンクを交換するのは規約違反となります。</div>';goTab(2);}
function showMsgList(){document.getElementById('msg-list-view').style.display='block';document.getElementById('msg-chat-view').style.display='none';}

// ===== 公式（運営）チャット =====
function addOfficialMessage(text){officialMessages.push({from:'official',text:text});document.getElementById('official-preview').textContent=text.substring(0,25)+'…';}
function openOfficialChat(){document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';document.getElementById('chat-name').textContent='縁の間 運営';document.getElementById('chat-ava').textContent='縁';document.getElementById('chat-ava').className='msg-list-ava official';document.getElementById('chat-official-badge').style.display='inline-block';var body=document.getElementById('chat-body');var html='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-bottom:.75rem;line-height:1.6">縁の間 運営との公式チャットです。<br>問い合わせへの返答もこちらから届きます。</div>';officialMessages.forEach(function(msg){if(msg.from==='official'){html+='<div class="msg-wrap"><div class="bubble">'+msg.text+'</div><div class="mtime">縁の間 運営</div></div>';}else{html+='<div class="msg-wrap me"><div class="bubble me">'+msg.text+'</div><div class="mtime">あなた</div></div>';}});html+='<div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" id="official-input" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button onclick="sendToOfficial()" style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div>';body.innerHTML=html;goTab(2);}
function sendToOfficial(){var input=document.getElementById('official-input');if(!input||!input.value.trim())return;var text=input.value.trim();officialMessages.push({from:'user',text:text});input.value='';setTimeout(function(){addOfficialMessage('メッセージありがとうございます。内容を確認次第、担当よりご連絡いたします。');addNotif('【運営】メッセージを受け取りました','確認次第、ご返答いたします。');},1000);openOfficialChat();}

// ===== 縁リストをDBから読み込む =====
async function loadEnList(){
  if(!currentUser)return;
  try{
    enList=[];
    // 自分がレビュー済みの match_id 一覧を一度だけ取得（個別判定で使う）
    var{data:myReviews}=await supa.from('reviews').select('match_id').eq('user_id',currentUser.id);
    var reviewedIds=(myReviews||[]).map(function(r){return r.match_id;});
    // 自分が送った申請（pending状態 → 申請中）
    var{data:sentPending}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status','pending');
    if(sentPending){
      for(var i=0;i<sentPending.length;i++){
        var m=sentPending[i];
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:'sent'});
        }
      }
    }
    // 自分が送った申請の各ステータス取得
    var sentStatuses=['matched','chatting','date_set','coupled','reviewed'];
    for(var si=0;si<sentStatuses.length;si++){
      var ss=sentStatuses[si];
      var{data:sentS}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status',ss);
      if(sentS){
        for(var i=0;i<sentS.length;i++){
          var m=sentS[i];
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var alreadyReviewed=reviewedIds.indexOf(m.id)>=0;
            // ステータスは matches.status に従う（'reviewed' は旧データ互換でのみ 'dated' へ）
            var displayStatus=ss==='matched'?'approved':ss==='reviewed'?'dated':ss;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:displayStatus,reviewed:alreadyReviewed});
          }
        }
      }
    }
    // 自分が送った申請がrejected → キャンセル通知
    var{data:sentRejected}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status','rejected');
    if(sentRejected){
      for(var i=0;i<sentRejected.length;i++){
        var m=sentRejected[i];
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:'rejected_notify'});
        }
      }
    }
    // 自分が受けた申請（pending → 承認待ち）
    var{data:received}=await supa.from('matches').select('*').eq('to_user_id',currentUser.id).eq('status','pending');
    if(received){
      for(var i=0;i<received.length;i++){
        var m=received[i];
        var{data:prof}=await supa.from('profiles').select('*').eq('id',m.from_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          var theirPillars=[{k:prof.pillar_year_k||0,s:prof.pillar_year_s||0},{k:prof.pillar_month_k||0,s:prof.pillar_month_s||0},{k:prof.pillar_day_k||0,s:prof.pillar_day_s||0},{k:prof.pillar_hour_k||0,s:prof.pillar_hour_s||0}];
          var rel=checkRelations(MY_PILLARS,theirPillars);
          var sc=calcScore(rel);
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:sc,status:'pending'});
        }
      }
    }
    // 自分が受けた申請の各ステータス取得
    var recStatuses=['matched','chatting','date_set','coupled','reviewed'];
    for(var ri=0;ri<recStatuses.length;ri++){
      var rs=recStatuses[ri];
      var{data:recS}=await supa.from('matches').select('*').eq('to_user_id',currentUser.id).eq('status',rs);
      if(recS){
        for(var i=0;i<recS.length;i++){
          var m=recS[i];
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.from_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var alreadyReviewed=reviewedIds.indexOf(m.id)>=0;
            // ステータスは matches.status に従う（'reviewed' は旧データ互換でのみ 'dated' へ）
            var displayStatus=rs==='matched'?'approved_by_me':rs==='reviewed'?'dated':rs;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:displayStatus,reviewed:alreadyReviewed});
          }
        }
      }
    }
    renderEnList();
    updateEnBadge();
    renderMsgList();
  }catch(e){console.log('loadEnListエラー:',e);}
}
