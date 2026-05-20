// ===== UI: 縁リスト・メッセージ・運営チャット・レビュー =====

// ===== チャットの最下部へ自動スクロール（環境差を吸収するため複数方法） =====
/** チャット画面を最下部までスクロール（複数の親要素で動作するよう冗長に） */
function scrollChatToBottom(){
  function doScroll(){
    var chatBody=document.getElementById('chat-body');
    if(chatBody && chatBody.lastElementChild){
      try{ chatBody.lastElementChild.scrollIntoView({block:'end',inline:'nearest'}); }catch(e){}
    }
    var s2=document.getElementById('s2');
    if(s2) s2.scrollTop=s2.scrollHeight;
    var shell=document.querySelector('.shell');
    if(shell) shell.scrollTop=shell.scrollHeight;
    try{ window.scrollTo(0,document.body.scrollHeight); }catch(e){}
  }
  // 描画直後 + 少し遅延の二段で確実に最下部へ
  requestAnimationFrame(function(){
    doScroll();
    setTimeout(doScroll,80);
  });
}

// ===== チャット最下部から少しでも上にスクロールしたらページ最上部へジャンプ =====
// メッセージが多くなるとタブ選択まで遠くなるので、最下部での上方向スクロールを「上に戻る」操作として扱う
(function setupChatScrollUpToTop(){
  var lastTouchY = null;
  var cooldownUntil = 0;
  function inChatView(){
    var cv = document.getElementById('msg-chat-view');
    return cv && cv.style.display === 'block';
  }
  function isAtBottom(){
    var docH = document.documentElement.scrollHeight;
    var winY = window.scrollY || window.pageYOffset || 0;
    if(winY + window.innerHeight >= docH - 4) return true;
    var shell = document.querySelector('.shell');
    if(shell && shell.scrollHeight > shell.clientHeight + 4 &&
       shell.scrollTop + shell.clientHeight >= shell.scrollHeight - 4) return true;
    var s2 = document.getElementById('s2');
    if(s2 && s2.scrollHeight > s2.clientHeight + 4 &&
       s2.scrollTop + s2.clientHeight >= s2.scrollHeight - 4) return true;
    return false;
  }
  function jumpToTop(){
    var now = Date.now();
    if(now < cooldownUntil) return;
    cooldownUntil = now + 700;
    try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); }
    var shell = document.querySelector('.shell');
    if(shell){ try{ shell.scrollTo({top:0, behavior:'smooth'}); }catch(e){ shell.scrollTop = 0; } }
    var s2 = document.getElementById('s2');
    if(s2){ try{ s2.scrollTo({top:0, behavior:'smooth'}); }catch(e){ s2.scrollTop = 0; } }
  }
  document.addEventListener('wheel', function(e){
    if(!inChatView()) return;
    if(e.deltaY < 0 && isAtBottom()){
      e.preventDefault();
      jumpToTop();
    }
  }, {passive:false});
  document.addEventListener('touchstart', function(e){
    if(e.touches && e.touches.length === 1) lastTouchY = e.touches[0].clientY;
  }, {passive:true});
  document.addEventListener('touchmove', function(e){
    if(!inChatView() || lastTouchY === null) return;
    var dy = e.touches[0].clientY - lastTouchY;
    if(dy > 12 && isAtBottom()){
      jumpToTop();
      lastTouchY = null;
    }
  }, {passive:true});
})();

// ===== テキスト整形：linkifyText は js/utils.js で共通定義 =====
/** 縁リストタブの未対応バッジ（赤いドット）を更新 */
function updateEnBadge(){var p=enList.filter(function(e){return e.status==='pending';}).length;['en-badge','bni-badge'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display=p>0?'block':'none';});}
/** 縁リスト全体を描画。ステータス別に表示・アクションボタンを切替 */
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
    // openChat(name, memberId, avatarUrl, matchId) 用の引数列
    var midArg = item.memberId ? ",'"+item.memberId+"'" : ",null";
    var avaArg = item.avatarUrl ? ",'"+item.avatarUrl.replace(/'/g,"\\'")+"'" : ",null";
    var matchArg = ",'"+item.matchId+"'";
    midArg = midArg + avaArg + matchArg;
    var badgeLabel={'matched':'やりとり中','approved':'承認されました！','approved_by_me':'承認しました','sent':'申請中','pending':'承認待ち','rejected_notify':'キャンセル','chatting':'やりとり中','date_set':'デート決定！','dated':'デート完了','coupled':'カップル成立！'}[s]||s;
    var badgeClass='pending';
    if(s==='matched'||s==='approved'||s==='approved_by_me'||s==='chatting')badgeClass='chatting';
    if(s==='date_set')badgeClass='date-set';
    if(s==='dated')badgeClass='dated';
    if(s==='coupled')badgeClass='coupled';
    if(s==='approved'||s==='approved_by_me')badgeClass='matched';
    var isCompact=(s==='matched'||s==='chatting'||s==='date_set'||s==='dated'||s==='coupled');
    html+='<div class="en-card '+(isCompact?'en-card-compact':'')+' '+((s==='matched'||s==='chatting'||s==='approved'||s==='approved_by_me'||s==='date_set'||s==='dated'||s==='coupled')?'matched':'')+'">';
    // マッチ後（matched 以降）はクリア表示、申請中(sent/pending) はぼかし
    // クリア表示かつ画像ありの場合のみタップで拡大表示（マッチ前のぼかしは拡大しない）
    var enAvaBlurred = (s === 'sent' || s === 'pending');
    var enAvaHtml;
    if(item.avatarUrl){
      var blurStyle = enAvaBlurred ? 'filter:blur(1px);' : '';
      var zoomable = !enAvaBlurred;
      var zoomCls = zoomable ? ' ava-zoomable' : '';
      var zoomHandler = zoomable
        ? ' onclick="event.stopPropagation();showAvatarZoom(\''+item.avatarUrl.replace(/'/g,"\\'")+'\')"'
        : '';
      enAvaHtml = '<div class="ava'+zoomCls+'" style="background-image:url(\''+item.avatarUrl+'\');background-size:cover;background-position:center;font-size:0;'+blurStyle+'"'+zoomHandler+'></div>';
    } else {
      enAvaHtml = '<div class="ava">'+item.name.charAt(0)+'</div>';
    }
    html+='<div class="en-top">'+enAvaHtml+'<div class="minfo"><div class="mname">'+item.name+'<span class="en-badge '+badgeClass+'">'+badgeLabel+'</span></div><div class="mmeta">'+item.meta+'</div></div></div>';
    if(s==='pending'){
      html+='<div class="en-actions"><button class="btn-ok" onclick="enOK(\''+item.matchId+'\')">お話しOK</button><button class="btn-ng" onclick="enNG(\''+item.matchId+'\')">ごめんなさい</button></div>';
    }else if(s==='approved_by_me'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'の申請を承認しました</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\''+midArg+')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='approved'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'が申請を承認しました！</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\''+midArg+')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='matched'||s==='chatting'){
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\''+midArg+')">メッセージ</button><button class="en-phase-btn primary" onclick="setDateDecided(\''+item.matchId+'\')">デート決定！</button><button class="en-phase-btn secondary" onclick="endWithThanks(\''+item.matchId+'\')">感謝して完了</button></div>';
    }else if(s==='date_set'){
      // レビュー未送信なら「お相手をレビュー」、送信済みなら「レビュー済み ✓」
      var reviewBtnDS = item.reviewed
        ? '<button class="en-phase-btn secondary" disabled style="opacity:.55;cursor:default">レビュー済み ✓</button>'
        : '<button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">お相手をレビュー</button>';
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\''+midArg+')">メッセージ</button><button class="en-phase-btn primary" onclick="setCoupled(\''+item.matchId+'\')">付き合いました！</button>'+reviewBtnDS+'</div>';
    }else if(s==='dated'){
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.3rem 0">レビュー済み・完了</div>';
    }else if(s==='coupled'){
      // 🎊 メッセージは coupled_at から1週間以内のみ表示（経過後は自然に消える）
      var showCelebrationCP=true;
      if(item.coupledAt){
        var coupledMs=new Date(item.coupledAt).getTime();
        var weekMs=7*24*60*60*1000;
        if(Date.now()-coupledMs>weekMs)showCelebrationCP=false;
      }
      if(showCelebrationCP){
        html+='<div style="font-size:12px;color:#C9A96E;text-align:center;padding:.3rem 0;line-height:1.7">🎊おめでとうございます！卒業鑑定プランが解放されました<br><span style="font-size:11px;color:var(--color-text-secondary)">「その他」→「プラン」→「卒業申請を行う」<br>で卒業鑑定を申し込みできます。</span></div>';
      }
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
/** 「メッセージを送る」or「後で送る」押下時：status を chatting に更新 @param {string} matchId */
async function startChatting(matchId){
  try{await supa.from('matches').update({status:'chatting'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='chatting';
  renderEnList();renderMsgList();
}
/** approved 状態の通知を非表示にする @param {string} matchId */
function dismissApproved(matchId){
  startChatting(matchId);
}
/** 「デート決定！」ボタン：status を date_set に @param {string} matchId */
async function setDateDecided(matchId){
  try{await supa.from('matches').update({status:'date_set'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='date_set';
  renderEnList();
}
/** 「感謝して完了」ボタン：マッチを終了 @param {string} matchId */
async function endWithThanks(matchId){
  try{await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);}catch(e){}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();updateEnBadge();loadRealUsers();
}
/** 「付き合いました！」：status を coupled に + 相手に Push 通知 + 卒業プラン解放 @param {string} matchId */
async function setCoupled(matchId){
  var nowIso=new Date().toISOString();
  try{
    // 相手 user_id 取得 → push
    var{data:m}=await supa.from('matches').select('from_user_id,to_user_id').eq('id',matchId).single();
    await supa.from('matches').update({status:'coupled',coupled_at:nowIso}).eq('id',matchId);
    if(m){
      var partnerId = (m.from_user_id === currentUser.id) ? m.to_user_id : m.from_user_id;
      if(partnerId){
        sendPushNotification(supa, {
          target_user_id: partnerId,
          title: '🎊 カップル成立！',
          body: 'お相手があなたとのカップル成立を宣言しました',
          url: './#en',
          tag: 'coupled',
        });
      }
    }
  }catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item){item.status='coupled';item.coupledAt=nowIso;}
  renderEnList();
  // 卒業鑑定プラン解放（自分側）
  refreshSotsugyouState();
}
/** レビュー入力モーダルを開く @param {string} matchId */
function openReview(matchId){
  document.getElementById('review-match-id').value=matchId;
  document.getElementById('review-overlay').classList.add('show');
  document.getElementById('review-error').textContent='';
  document.getElementById('review-comment').value='';
  document.querySelectorAll('.star').forEach(function(s){s.classList.remove('on');});
  currentReviewStar=0;
}
/** レビューの星評価をセット @param {number} n */
function setStar(n){
  currentReviewStar=n;
  document.querySelectorAll('.star').forEach(function(s,i){s.classList.toggle('on',i<n);});
}
/** レビュー送信処理 */
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
/** rejected_notify の通知を本人側で確認・削除 @param {string} matchId */
async function dismissRejected(matchId){
  try{
    await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);
  }catch(e){console.log('dismissed更新エラー:',e);}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();
  updateEnBadge();
  loadRealUsers();
}
/** 「お話しOK」：マッチ承認 + 申請者に Push 通知 @param {string} matchId */
async function enOK(matchId){
  try{
    // 申請者 (from_user_id) を取得して push 通知
    var{data:match}=await supa.from('matches').select('from_user_id').eq('id',matchId).single();
    var{error}=await supa.from('matches').update({status:'matched'}).eq('id',matchId);
    if(error){alert('承認エラー：'+error.message);return;}
    if(match && match.from_user_id){
      sendPushNotification(supa, {
        target_user_id: match.from_user_id,
        title: '🎉 マッチが成立しました！',
        body: 'お相手があなたの申請を承認しました。メッセージを送ってみましょう',
        url: './#en',
        tag: 'match-accepted',
      });
    }
    loadEnList();
  }catch(e){console.log('enOKエラー:',e);}
}
/** 「ごめんなさい」：マッチ拒否 @param {string} matchId */
async function enNG(matchId){
  try{
    var{error}=await supa.from('matches').update({status:'rejected'}).eq('id',matchId);
    if(error){alert('拒否エラー：'+error.message);return;}
    loadEnList();
    loadRealUsers();
  }catch(e){console.log('enNGエラー:',e);}
}

// ===== メッセージ一覧・チャット =====

/** マッチ相手ごとの最新メッセージ・時刻・未読数をまとめて取得（メッセージ一覧用） */
async function loadMsgPreviews(){
  if(!currentUser) return;
  var chatStatuses = ['matched','chatting','date_set','dated','coupled'];
  var matched = enList.filter(function(e){ return chatStatuses.indexOf(e.status) >= 0; });
  if(matched.length === 0){ msgPreviewCache = {}; updateDmBadge(); return; }
  var matchIds = matched.map(function(e){ return e.matchId; });
  try{
    var{data,error}=await supa.from('messages')
      .select('match_id,sender_id,body,created_at')
      .in('match_id', matchIds)
      .order('created_at',{ascending:false});
    if(error){ console.log('loadMsgPreviews error:', error); return; }
    // まず未読数を集計（全件走査）
    var unreadMap = {};
    (data||[]).forEach(function(row){
      if(row.sender_id !== currentUser.id){
        var lastRead = getDmLastRead(row.match_id);
        if(new Date(row.created_at).getTime() > lastRead){
          unreadMap[row.match_id] = (unreadMap[row.match_id]||0) + 1;
        }
      }
    });
    // 最新メッセージをプレビュー用に取得（降順なので最初の1件が最新）
    var cache = {};
    (data||[]).forEach(function(row){
      if(!cache[row.match_id]){
        cache[row.match_id] = {
          lastMsg: row.body,
          lastTime: row.created_at,
          unreadCount: unreadMap[row.match_id] || 0
        };
      }
    });
    msgPreviewCache = cache;
    updateDmBadge();
  }catch(e){ console.log('loadMsgPreviews exception:', e); }
}

/** 特定マッチの最終既読時刻を取得（localStorage） */
function getDmLastRead(matchId){
  try{
    return parseInt(localStorage.getItem('dm_last_read_'+matchId)||'0', 10);
  }catch(e){ return 0; }
}

/** 特定マッチを既読にする（localStorage に現在時刻を保存） */
function markDmAsRead(matchId){
  if(!matchId) return;
  try{ localStorage.setItem('dm_last_read_'+matchId, String(Date.now())); }catch(e){}
  if(msgPreviewCache[matchId]) msgPreviewCache[matchId].unreadCount = 0;
  updateDmBadge();
}

/** DM 未読があるか判定 */
function hasDmUnread(){
  for(var mid in msgPreviewCache){
    if(msgPreviewCache[mid].unreadCount > 0) return true;
  }
  return false;
}

/** メッセージタブの赤ポッチを更新（DM未読 or 運営チャット未読） */
function updateDmBadge(){ updateMsgTabBadge(); }

/** メッセージタブバッジ統合：DM未読 or 運営チャット未読 があれば表示 */
function updateMsgTabBadge(){
  var dmUnread = hasDmUnread();
  var officialUnread = !!(window._officialChatHasUnread);
  var msgBadge = document.getElementById('msg-badge');
  if(msgBadge) msgBadge.style.display = (dmUnread || officialUnread) ? 'block' : 'none';
}

/** メッセージ一覧（chat 可能なステータスの相手）を描画 */
function renderMsgList(){
  var chatStatuses = ['matched','chatting','date_set','dated','coupled'];
  var matched = enList.filter(function(e){ return chatStatuses.indexOf(e.status) >= 0; });
  var container=document.getElementById('msg-list-items');
  if(!container) return;
  if(matched.length===0){container.innerHTML='';return;}
  var html='';
  matched.forEach(function(item){
    var midArg=item.memberId?",'"+item.memberId+"'":",null";
    var avaArg = item.avatarUrl ? ",'"+item.avatarUrl.replace(/'/g,"\\'")+"'" : ",null";
    var preview = msgPreviewCache[item.matchId];
    var previewText = preview ? escapeHtml(preview.lastMsg).substring(0,30) : 'メッセージを送ってみましょう';
    var timeText = preview ? formatChatTime(preview.lastTime) : '';
    var hasUnread = preview && preview.unreadCount > 0;
    var dotHtml = hasUnread ? '<div class="msg-unread-dot"></div>' : '';
    var ava;
    if(item.avatarUrl){
      var zoomHandler = ' onclick="event.stopPropagation();showAvatarZoom(\''+item.avatarUrl.replace(/'/g,"\\'")+'\')"';
      ava = '<div class="msg-list-ava ava-zoomable" style="background-image:url(\''+item.avatarUrl+'\');background-size:cover;background-position:center;font-size:0"'+zoomHandler+'>'+dotHtml+'</div>';
    } else {
      ava = '<div class="msg-list-ava">'+item.name.charAt(0)+dotHtml+'</div>';
    }
    html+='<div class="msg-list-item" onclick="openChat(\''+item.name+'\''+midArg+avaArg+',\''+item.matchId+'\')">'+ava+'<div class="msg-list-info"><div class="msg-list-name">'+item.name+'</div><div class="msg-list-preview">'+previewText+'</div></div><div class="msg-list-time">'+timeText+'</div></div>';
  });
  container.innerHTML=html;
}

/** 時刻を短い表示にする（今日なら HH:mm、それ以外は M/D） */
function formatChatTime(iso){
  if(!iso) return '';
  var d = new Date(iso);
  var now = new Date();
  if(d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate()){
    return pad2(d.getHours())+':'+pad2(d.getMinutes());
  }
  return (d.getMonth()+1)+'/'+d.getDate();
}

/**
 * 個別チャット画面を開く
 * @param {string} name @param {string|null} memberId @param {string|null} avatarUrl @param {string} matchId
 */
async function openChat(name, memberId, avatarUrl, matchId){
  document.getElementById('chat-name').textContent=name;
  var chatAva=document.getElementById('chat-ava');
  chatAva.className='msg-list-ava';
  chatAva.onclick = null;
  if(avatarUrl){
    chatAva.textContent='';
    chatAva.style.backgroundImage='url("'+avatarUrl+'")';
    chatAva.style.backgroundSize='cover';
    chatAva.style.backgroundPosition='center';
    chatAva.style.fontSize='0';
    chatAva.classList.add('ava-zoomable');
    chatAva.onclick = function(e){ e.stopPropagation(); showAvatarZoom(avatarUrl); };
  } else {
    chatAva.textContent=name.charAt(0);
    chatAva.style.backgroundImage='';
    chatAva.style.fontSize='';
    chatAva.classList.remove('ava-zoomable');
  }
  document.getElementById('chat-official-badge').style.display='none';
  var header=document.querySelector('.msg-chat-header');
  if(header){
    var oldBtn=header.querySelector('.chat-report-btn');
    if(oldBtn)oldBtn.remove();
    if(memberId){
      var btn=document.createElement('button');
      btn.className='chat-report-btn';
      btn.textContent='⚠️ 通報';
      btn.title='この方を通報する';
      btn.style.cssText='margin-left:auto;font-size:10px;padding:5px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;color:#C05050;background:transparent;cursor:pointer;font-family:\'Noto Sans JP\',sans-serif;flex-shrink:0';
      btn.onclick=function(){openReportFor(memberId);};
      header.appendChild(btn);
    }
  }
  document.getElementById('msg-list-view').style.display='none';
  document.getElementById('msg-chat-view').style.display='block';

  // match_id からメッセージを取得して表示
  currentChatMatchId = matchId || null;
  // このチャットを既読にする
  markDmAsRead(matchId);
  renderMsgList();
  // 相手の user_id を特定
  var enItem = enList.find(function(e){ return e.matchId === matchId; });
  currentChatPartnerId = null;
  if(matchId && currentUser){
    try{
      var{data:m}=await supa.from('matches').select('from_user_id,to_user_id').eq('id',matchId).single();
      if(m) currentChatPartnerId = (m.from_user_id === currentUser.id) ? m.to_user_id : m.from_user_id;
    }catch(e){}
  }

  await loadAndRenderChat(name, matchId);
  goTab(2);
  scrollChatToBottom();
}

/** チャットのメッセージをDBから取得して描画 @param {string} name @param {string} matchId */
async function loadAndRenderChat(name, matchId){
  var body=document.getElementById('chat-body');
  if(!body) return;
  var MAX_PER_PERSON = 30;
  var messages = [];
  var mySentCount = 0;

  if(matchId && currentUser){
    try{
      var{data,error}=await supa.from('messages')
        .select('id,sender_id,body,created_at')
        .eq('match_id', matchId)
        .order('created_at',{ascending:true});
      if(!error && data){
        messages = data;
        mySentCount = data.filter(function(m){ return m.sender_id === currentUser.id; }).length;
      }
    }catch(e){ console.log('loadChat error:', e); }
  }
  currentChatMessages = messages;

  var remaining = MAX_PER_PERSON - mySentCount;
  var html = '<div class="mcnt">残り ' + remaining + ' / ' + MAX_PER_PERSON + ' 回</div>';

  if(messages.length === 0){
    html += '<div style="text-align:center;padding:2rem 0;color:var(--color-text-tertiary);font-size:12px;line-height:1.8">まだメッセージはありません。<br>最初のメッセージを送ってみましょう！</div>';
  } else {
    messages.forEach(function(msg){
      var isMe = msg.sender_id === currentUser.id;
      var t = new Date(msg.created_at);
      var timeStr = pad2(t.getHours())+':'+pad2(t.getMinutes());
      var senderLabel = isMe ? '' : name+'｜';
      html += '<div class="msg-wrap'+(isMe?' me':'')+'"><div class="bubble'+(isMe?' me':'')+'">'+linkifyText(msg.body)+'</div><div class="mtime">'+senderLabel+timeStr+'</div></div>';
    });
  }

  // 送信上限に達していなければ入力欄を表示
  if(remaining > 0){
    html += '<div style="display:flex;gap:8px;margin-top:.75rem">'
      + '<input type="text" id="chat-msg-input" placeholder="メッセージを入力..." style="flex:1;font-size:13px" onkeydown="if(event.key===\'Enter\'){event.preventDefault();sendUserMessage();}">'
      + '<button onclick="sendUserMessage()" style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button>'
      + '</div>';
  } else {
    html += '<div style="text-align:center;padding:.75rem 0;font-size:12px;color:#C05050">メッセージの送信上限（'+MAX_PER_PERSON+'通）に達しました</div>';
  }
  html += '<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:.6rem;line-height:1.7">※ メッセージは'+MAX_PER_PERSON+'回まで。他のSNSのIDやリンクを交換するのは規約違反となります。</div>';

  body.innerHTML = html;
}

/** ユーザー間メッセージを送信 */
async function sendUserMessage(){
  var input = document.getElementById('chat-msg-input');
  if(!input || !input.value.trim()) return;
  var text = input.value.trim();
  if(!currentUser){ alert('ログインが必要です'); return; }
  if(!currentChatMatchId){ alert('チャット相手が不明です'); return; }

  // bot/連投対策
  var botReason = checkBotDefense({rateKey:'user-msg', rateMs:2000});
  if(botReason){ alert(botReason); return; }

  // 規約違反検知
  var modCheck = checkModeration(text);
  if(!modCheck.ok){ alert(formatModerationWarning(modCheck.hits)); return; }

  // 楽観的UI更新
  input.value = '';
  var body = document.getElementById('chat-body');
  var t = new Date();
  var timeStr = pad2(t.getHours())+':'+pad2(t.getMinutes());
  var msgHtml = '<div class="msg-wrap me"><div class="bubble me">'+linkifyText(text)+'</div><div class="mtime">'+timeStr+'</div></div>';
  var inputArea = body.querySelector('div[style*="display:flex"]');
  if(inputArea) inputArea.insertAdjacentHTML('beforebegin', msgHtml);
  scrollChatToBottom();

  try{
    var{error}=await supa.from('messages').insert({
      match_id: currentChatMatchId,
      sender_id: currentUser.id,
      body: text
    });
    if(error){
      console.log('メッセージ送信エラー:', error);
      alert('送信に失敗しました：'+(error.message||'通信エラー'));
      return;
    }
    recordRateLimitHit('user-msg');
    // 送信成功後、プレビューキャッシュを更新してリスト側も反映
    msgPreviewCache[currentChatMatchId] = {
      lastMsg: text,
      lastTime: new Date().toISOString(),
      unreadCount: 0
    };
    // Push 通知を相手に送信
    if(currentChatPartnerId){
      var chatName = document.getElementById('chat-name');
      var senderName = '相手';
      if(currentUser){
        try{
          var{data:myProf}=await supa.from('profiles').select('nickname').eq('id',currentUser.id).single();
          if(myProf && myProf.nickname) senderName = myProf.nickname + 'さん';
        }catch(e){}
      }
      sendPushNotification(supa, {
        target_user_id: currentChatPartnerId,
        title: '💬 '+senderName+'からメッセージ',
        body: text.substring(0,50),
        url: './#msg',
        tag: 'dm-'+currentChatMatchId,
      });
    }
    // 残り回数と表示を更新
    var chatNameEl = document.getElementById('chat-name');
    var dispName = chatNameEl ? chatNameEl.textContent : '';
    await loadAndRenderChat(dispName, currentChatMatchId);
    scrollChatToBottom();
  }catch(e){
    console.log('メッセージ送信例外:', e);
    alert('送信中にエラーが発生しました');
  }
}

/** チャット詳細からメッセージ一覧に戻る */
function showMsgList(){
  currentChatMatchId = null;
  currentChatPartnerId = null;
  currentChatMessages = [];
  document.getElementById('msg-list-view').style.display='block';
  document.getElementById('msg-chat-view').style.display='none';
  // 一覧のプレビューを更新
  loadMsgPreviews().then(function(){ renderMsgList(); });
}

// ===== 公式（運営）チャット =====
/** 運営チャットにメッセージ追加（ローカル状態のみ） @param {string} text */
function addOfficialMessage(text){officialMessages.push({from:'official',text:text});document.getElementById('official-preview').textContent=text.substring(0,25)+'…';}
/** 運営チャット画面を開く（既読化・入力欄保持） */
function openOfficialChat(){
  // 入力中の値とフォーカス状態を保存（再描画でカーソルが飛ぶのを防ぐ）
  var oldInput = document.getElementById('official-input');
  var savedValue = oldInput ? oldInput.value : '';
  var wasFocused = oldInput && document.activeElement === oldInput;
  var savedSelStart = oldInput ? oldInput.selectionStart : null;
  var savedSelEnd = oldInput ? oldInput.selectionEnd : null;
  // 他チャットから移ってきた時に通報ボタンが残らないよう除去
  var hdr=document.querySelector('.msg-chat-header');
  if(hdr){var ob=hdr.querySelector('.chat-report-btn');if(ob)ob.remove();}
  // 既読化：最終閲覧時刻を更新し、メッセージバッジ・赤ポッチを消す
  // localStorage は即時、DB は async でデバイス間同期に使う
  if(currentUser){
    var nowIso = new Date().toISOString();
    localStorage.setItem('official_chat_last_opened_'+currentUser.id, String(Date.now()));
    // DB へ非同期で保存（失敗しても致命的ではない＝localStorage で動くため）
    supa.from('profiles').update({last_official_chat_read_at: nowIso}).eq('id', currentUser.id)
      .then(function(res){ if(res && res.error) console.log('last_read save error:', res.error); });
  }
  window._officialChatHasUnread = false;
  updateMsgTabBadge();
  var officialItem=document.getElementById('official-msg-item');
  if(officialItem){var dot=officialItem.querySelector('.msg-unread-dot');if(dot)dot.remove();}
  document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';document.getElementById('chat-name').textContent='縁の間 運営';document.getElementById('chat-ava').textContent='縁';document.getElementById('chat-ava').className='msg-list-ava official';document.getElementById('chat-official-badge').style.display='inline-block';var body=document.getElementById('chat-body');var html='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-bottom:.75rem;line-height:1.6">縁の間 運営との公式チャットです。<br>問い合わせへの返答もこちらから届きます。</div>';officialMessages.forEach(function(msg){if(msg.from==='official'){html+='<div class="msg-wrap"><div class="bubble">'+linkifyText(msg.text)+'</div><div class="mtime">縁の間 運営</div></div>';}else{html+='<div class="msg-wrap me"><div class="bubble me">'+linkifyText(msg.text)+'</div><div class="mtime">あなた</div></div>';}});html+='<div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" id="official-input" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button onclick="sendToOfficial()" style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div>';body.innerHTML=html;goTab(2);
  // 入力値・カーソル位置・フォーカスを復元
  var newInput = document.getElementById('official-input');
  if(newInput){
    if(savedValue) newInput.value = savedValue;
    if(wasFocused){
      newInput.focus();
      try{
        var pos = savedValue.length;
        newInput.setSelectionRange(
          savedSelStart != null ? savedSelStart : pos,
          savedSelEnd != null ? savedSelEnd : pos
        );
      }catch(e){}
    }
  }
  // 最新メッセージ（一番下）へ自動スクロール
  scrollChatToBottom();
}
/** 運営チャットに送信：bot対策 + モデレーション + contacts INSERT + 自動応答 */
async function sendToOfficial(){
  var input=document.getElementById('official-input');
  if(!input||!input.value.trim())return;
  var text=input.value.trim();
  if(!currentUser){alert('ログインが必要です');return;}
  // bot/連投対策: 3秒に1回まで
  var botReason=checkBotDefense({rateKey:'official-msg', rateMs:3000});
  if(botReason){ alert(botReason); return; }
  // 規約違反検知（電話番号 / メアド / 他SNS の ID 等）
  var modCheck = checkModeration(text);
  if(!modCheck.ok){ alert(formatModerationWarning(modCheck.hits)); return; }
  // 楽観的にローカルへ即追加（即時に画面反映）
  officialMessages.push({from:'user',text:text});
  input.value='';
  openOfficialChat();
  // DBに保存して管理者に届ける
  try{
    var nickEl=document.getElementById('contact-nick');
    var nick=nickEl?nickEl.value.trim():'';
    const{error}=await supa.from('contacts').insert({
      user_id:currentUser.id,
      member_id:memberID||null,
      nickname:nick||null,
      contact_type:'メッセージ',
      body:text,
      status:'open'
    });
    if(!error){ recordRateLimitHit('official-msg'); }
    if(error){
      console.log('メッセージ送信エラー:',error);
      addOfficialMessage('⚠️ 送信に失敗しました：'+error.message);
      openOfficialChat();
      return;
    }
    addOfficialMessage('メッセージを受け取りました。確認次第、ご返答いたします。');
    addNotif('【運営】メッセージを受け取りました','確認次第、ご返答いたします。');
    openOfficialChat();
  }catch(e){
    console.log('メッセージ送信例外:',e);
    addOfficialMessage('⚠️ 送信中にエラーが発生しました');
    openOfficialChat();
  }
}

// ===== 縁リストをDBから読み込む =====
/** 縁リストを DB から再構築：matches テーブルから自分関連の全レコードを取得 */
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
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture,member_id,avatar_url').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:'sent'});
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
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture,member_id,avatar_url').eq('id',m.to_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var alreadyReviewed=reviewedIds.indexOf(m.id)>=0;
            // ステータスは matches.status に従う（'reviewed' は旧データ互換でのみ 'dated' へ）
            var displayStatus=ss==='matched'?'approved':ss==='reviewed'?'dated':ss;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:displayStatus,reviewed:alreadyReviewed,coupledAt:m.coupled_at});
          }
        }
      }
    }
    // 自分が送った申請がrejected → キャンセル通知
    var{data:sentRejected}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status','rejected');
    if(sentRejected){
      for(var i=0;i<sentRejected.length;i++){
        var m=sentRejected[i];
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture,member_id,avatar_url').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:'rejected_notify'});
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
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:sc,status:'pending'});
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
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture,member_id,avatar_url').eq('id',m.from_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var alreadyReviewed=reviewedIds.indexOf(m.id)>=0;
            // ステータスは matches.status に従う（'reviewed' は旧データ互換でのみ 'dated' へ）
            var displayStatus=rs==='matched'?'approved_by_me':rs==='reviewed'?'dated':rs;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:displayStatus,reviewed:alreadyReviewed,coupledAt:m.coupled_at});
          }
        }
      }
    }
    renderEnList();
    updateEnBadge();
    await loadMsgPreviews();
    renderMsgList();
    // 自分のマッチがcoupled状態なら卒業プランを解放（相手側が「付き合いました!」を押した時もここで検知）
    if(enList.some(function(e){return e.status==='coupled';})){
      refreshSotsugyouState();
    }
  }catch(e){console.log('loadEnListエラー:',e);}
}
