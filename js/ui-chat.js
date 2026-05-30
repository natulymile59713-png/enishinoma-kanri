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
/** 縁リストタブのゴールドポッチ表示更新
 *  - pending(受信した申請) または approved(自分の申請が承認された) があれば表示 */
function updateEnBadge(){
  var hasNotice = enList.some(function(e){return e.status==='pending' || e.status==='approved';});
  ['en-badge','bni-badge'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display = hasNotice ? 'block' : 'none';
  });
}
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
  // カップル成立中フィルタ: 未送信の他相手 / 相手が別カップル成立中 → 非表示
  var coupledNow = isCoupledNow();
  sorted = sorted.filter(function(item){
    if(item.status === 'coupled') return true; // 自分のカップル相手は常に表示
    // 自分がカップル中 → 過去メッセージ無しの他相手は隠す
    if(coupledNow && !hasPriorMessages(item.matchId)) return false;
    // 相手が他とカップル中 → 過去メッセージ無しは隠す（相手側目線の closure）
    if(item.partnerIsCoupledWithOther && !hasPriorMessages(item.matchId)) return false;
    return true;
  });
  sorted.forEach(function(item){
    var s=item.status;
    // openChat(name, memberId, avatarUrl, matchId) 用の引数列
    var midArg = item.memberId ? ",'"+item.memberId+"'" : ",null";
    var avaArg = item.avatarUrl ? ",'"+item.avatarUrl.replace(/'/g,"\\'")+"'" : ",null";
    var matchArg = ",'"+item.matchId+"'";
    midArg = midArg + avaArg + matchArg;
    // カップルロック判定（自分がカップル中で、この相手はカップル相手ではない）
    var locked = isLockedByMyCouple(item);
    var badgeLabel={'matched':'やりとり中','approved':'承認されました！','approved_by_me':'承認しました','sent':'申請中','pending':'承認待ち','rejected_notify':'キャンセル','chatting':'やりとり中','date_set':'デート決定！','dated':'デート完了','coupled':'カップル成立！'}[s]||s;
    var badgeClass='pending';
    if(s==='matched'||s==='approved'||s==='approved_by_me'||s==='chatting')badgeClass='chatting';
    if(s==='date_set')badgeClass='date-set';
    if(s==='dated')badgeClass='dated';
    if(s==='coupled')badgeClass='coupled';
    if(s==='approved'||s==='approved_by_me')badgeClass='matched';
    // 「付き合いました！」双方申請式の特殊バッジ（date_set のとき）
    // 文字が長いので名前の右ではなく下に独立して表示するため、別フラグで管理
    var badgeBelowName = '';
    // 優先: 相手がレビュー送信済み = キャンセル通知 / マッチ終了
    if(s==='date_set' && item.partnerReviewed){
      var hadRequest = item.myCoupleReq || item.partnerCoupleReq;
      badgeBelowName = item.name + (hadRequest ? 'が申請をキャンセル' : 'がマッチを終了');
      badgeLabel = '';
    }else if(s==='date_set' && item.myCoupleReq && !item.partnerCoupleReq){
      badgeBelowName = item.name + 'の「付き合いました！」待ち';
      badgeLabel = '';
    }else if(s==='date_set' && item.partnerCoupleReq && !item.myCoupleReq){
      badgeBelowName = '「付き合いました！」申請✨';
      badgeLabel = '';
    }
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
    // pending 状態のみ、プロフィール情報の右側に「詳細を見る」ボタンを配置
    var detailBtnHtml = '';
    if(s === 'pending' && item.partnerUserId){
      detailBtnHtml = '<button onclick="event.stopPropagation();openPartnerProfile(\''+item.partnerUserId+'\',\''+s+'\')" style="font-size:10px;padding:5px 10px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:inherit">🔍 詳細</button>';
    }
    // 名前横バッジ（badgeLabel が空なら表示しない=下に独立表示するケース）
    var inlineBadgeHtml = badgeLabel ? '<span class="en-badge '+badgeClass+'">'+badgeLabel+'</span>' : '';
    // 名前下に出すバッジ（長い文言用）
    var belowBadgeHtml = badgeBelowName
      ? '<div style="margin-top:4px"><span class="en-badge '+badgeClass+'" style="margin-left:0;display:inline-block">'+badgeBelowName+'</span></div>'
      : '';
    html+='<div class="en-top">'+enAvaHtml+'<div class="minfo"><div class="mname">'+item.name+inlineBadgeHtml+'</div>'+belowBadgeHtml+'<div class="mmeta">'+item.meta+'</div></div>'+detailBtnHtml+'</div>';
    // ロック中のボタン生成ヘルパー（見た目だけ無効化、クリックでアラート）
    // disabled 属性を付けると onclick が発火しないため、style と onclick のみで実現
    // 自分カップル中 → 自分視点アラート / 相手カップル中 → 相手視点アラート
    var alertCall = getCoupleLockAlertCall(item);
    var lockedAttr = ' style="opacity:.45;cursor:not-allowed;background:var(--color-background-secondary);color:var(--color-text-tertiary)" onclick="event.preventDefault();event.stopPropagation();' + alertCall + ';return false;"';
    if(s==='pending'){
      if(locked){
        html+='<div class="en-actions"><button class="btn-ok"'+lockedAttr+'>お話しOK</button><button class="btn-ng"'+lockedAttr+'>ごめんなさい</button></div>';
      }else{
        html+='<div class="en-actions"><button class="btn-ok" onclick="enOK(\''+item.matchId+'\')">お話しOK</button><button class="btn-ng" onclick="enNG(\''+item.matchId+'\')">ごめんなさい</button></div>';
      }
    }else if(s==='sent'){
      // 自分が送った申請 (pending)。キャンセル可能
      html+='<div style="text-align:center;margin-top:.5rem"><button onclick="cancelHanashiFromEnList(\''+item.matchId+'\')" style="font-size:11px;padding:6px 16px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;color:var(--color-text-secondary);background:transparent;cursor:pointer;font-family:inherit">お話し申請をキャンセル</button></div>';
    }else if(s==='approved_by_me'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'の申請を承認しました</div>';
      if(locked){
        html+='<div class="en-actions"><button class="btn-ok"'+lockedAttr+'>メッセージを送る</button><button class="btn-ng"'+lockedAttr+'>後で送る</button></div>';
      }else{
        html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\''+midArg+')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
      }
    }else if(s==='approved'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'が申請を承認しました！</div>';
      if(locked){
        html+='<div class="en-actions"><button class="btn-ok"'+lockedAttr+'>メッセージを送る</button><button class="btn-ng"'+lockedAttr+'>後で送る</button></div>';
      }else{
        html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\''+midArg+')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
      }
    }else if(s==='matched'||s==='chatting'){
      // メッセージと感謝して完了は許可、デート決定！はロック対象
      var msgBtn = '<button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\''+midArg+')">メッセージ</button>';
      var dateBtn = locked
        ? '<button class="en-phase-btn primary"'+lockedAttr+'>デート決定！</button>'
        : '<button class="en-phase-btn primary" onclick="setDateDecided(\''+item.matchId+'\')">デート決定！</button>';
      var thanksBtn = '<button class="en-phase-btn secondary" onclick="endWithThanks(\''+item.matchId+'\')">感謝して完了</button>';
      html+='<div class="en-phase-btns">'+msgBtn+dateBtn+thanksBtn+'</div>';
    }else if(s==='date_set'){
      // 「感謝して終了」ボタン: 押すとレビュー入力モーダルを開く（レビュー送信後にマッチが終了する設計）
      // 既にレビュー済みの場合は「✓」を付けて押下時に確認できるようにする
      var reviewBtnDS = item.reviewed
        ? '<button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">感謝して終了 ✓</button>'
        : '<button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">感謝して終了</button>';
      var msgBtnD = '<button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\''+midArg+')">メッセージ</button>';
      // 「付き合いました！」ボタンを date_count で出し分け:
      //   (Z) date_count=0 → グレーアウト「付き合いました！(1回目デート完了後)」
      //   (0) 相手レビュー済み = キャンセル → 無効化「付き合いました！」
      //   (A) 双方未申請  → 通常ボタン
      //   (B) 自分申請済み → 無効化「✓ 申請済み」
      //   (C) 相手申請済み → 強調表示の通常ボタン（押せば即カップル成立）
      var dc = item.dateCount || 0;
      var coupledBtn;
      if(item.partnerReviewed){
        coupledBtn = '<button class="en-phase-btn primary" disabled style="opacity:.4;cursor:not-allowed">付き合いました！</button>';
      }else if(dc === 0){
        coupledBtn = '<button class="en-phase-btn primary" disabled style="opacity:.45;cursor:not-allowed">付き合いました！(1回目デート完了後)</button>';
      }else if(locked){
        coupledBtn = '<button class="en-phase-btn primary"'+lockedAttr+'>付き合いました！</button>';
      }else if(item.myCoupleReq){
        coupledBtn = '<button class="en-phase-btn primary" disabled style="opacity:.55;cursor:default">✓ 付き合いました！(申請済)</button>';
      }else if(item.partnerCoupleReq){
        coupledBtn = '<button class="en-phase-btn primary" style="box-shadow:0 0 0 2px #C9A96E;font-weight:600" onclick="setCoupled(\''+item.matchId+'\')">付き合いました！</button>';
      }else{
        coupledBtn = '<button class="en-phase-btn primary" onclick="setCoupled(\''+item.matchId+'\')">付き合いました！</button>';
      }
      html+='<div class="en-phase-btns">'+msgBtnD+coupledBtn+reviewBtnDS+'</div>';

      // デート回数管理ボタン群（3回未満なら表示、3回完了なら非表示で「付き合うか終了か」の二択強制）
      if(dc < 3){
        var dateBtns = '<div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;color:var(--color-text-secondary);margin-right:4px">デート:</span>';
        for(var rd = 1; rd <= 3; rd++){
          var label = rd + '回目完了';
          if(rd <= dc){
            // 完了済み → ✓ つき、タップで「取消」確認(押し間違い対応)
            dateBtns += '<button onclick="markDateUndo(\''+item.matchId+'\','+rd+')" style="font-size:10px;padding:5px 10px;border:0.5px solid #C9A96E;background:#C9A96E;color:#fff;border-radius:6px;cursor:pointer;font-family:inherit">✓ '+label+'</button>';
          }else if(rd === dc + 1){
            // 次に押せる → アクティブ
            dateBtns += '<button onclick="markDateComplete(\''+item.matchId+'\','+rd+')" style="font-size:10px;padding:5px 10px;border:0.5px solid #C9A96E;background:transparent;color:#C9A96E;border-radius:6px;cursor:pointer;font-family:inherit">'+label+'</button>';
          }else{
            // まだ押せない → グレーアウト
            dateBtns += '<button disabled style="font-size:10px;padding:5px 10px;border:0.5px solid var(--color-border-tertiary);background:transparent;color:var(--color-text-tertiary);border-radius:6px;cursor:not-allowed;font-family:inherit">'+label+'</button>';
          }
        }
        dateBtns += '</div>';
        html += dateBtns;
      }else{
        // 3回完了 → 二択強制中の案内
        html += '<div style="margin-top:8px;font-size:11px;color:#C9A96E;text-align:center;line-height:1.6">✨ 3回のデートを終えました。「付き合いました！」か「感謝して終了」を選んでください。</div>';
      }
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
/** 縁リストの「お話し申請をキャンセル」ボタン押下時の処理（sent 状態のカード）
 *  推しページの cancelHanashi(idx) と同等だが、idx が無くても matchId で動かせる版
 *  @param {string} matchId */
async function cancelHanashiFromEnList(matchId){
  if(!confirm('お話し申請をキャンセルします。よろしいですか？')) return;
  try{
    var{data:res, error}=await supa.rpc('cancel_hanashi_request', { p_match_id: matchId });
    if(error){
      alert('キャンセルに失敗しました: ' + error.message);
      return;
    }
    var partnerId = res && res.partner_id;
    if(partnerId){
      var myNickname = '';
      try{
        var{data:me}=await supa.from('profiles').select('nickname').eq('id',currentUser.id).single();
        myNickname = (me && me.nickname) ? me.nickname : '';
      }catch(_){}
      sendPushNotification(supa, {
        target_user_id: partnerId,
        title: '🕊 ' + (myNickname || 'お相手') + 'さんがお話し申請をキャンセルしました',
        body: '運営チャットで詳細を確認できます',
        url: './#chat-official',
        tag: 'match-cancel',
      });
    }
    // enList から該当カードを除去 + 再描画
    enList = enList.filter(function(e){return e.matchId !== matchId;});
    renderEnList();
    updateEnBadge();
    // 推しページのボタンも再評価（再開可能に）
    if(typeof loadRealUsers === 'function') loadRealUsers();
  }catch(e){
    console.log('cancelHanashiFromEnList error:', e);
    alert('エラーが発生しました');
  }
}

/** 「N回目完了」ボタン押下時: date_count を N に更新 @param {string} matchId @param {number} round */
async function markDateComplete(matchId, round){
  if(round < 1 || round > 3){ alert('不正な回数指定です'); return; }
  if(!confirm(round+'回目のデートが完了しましたか？')) return;
  try{
    var{data, error}=await supa.rpc('set_match_date_count', { p_match_id: matchId, p_count: round });
    if(error){ alert('更新に失敗しました: ' + error.message); return; }
    // 即時 UI 反映（realtime でも来るが、レスポンス感を出す）
    var item = enList.find(function(e){ return e.matchId === matchId; });
    if(item){ item.dateCount = round; }
    renderEnList();
  }catch(e){
    console.log('markDateComplete error:', e);
    alert('エラーが発生しました');
  }
}

/** 「✓ N回目完了」を再タップ: 1段階戻す確認(誤タップ救済)
 *  N=現在 dateCount のときだけ「N-1 に戻す」、それ以外は何もしない @param {string} matchId @param {number} round */
async function markDateUndo(matchId, round){
  var item = enList.find(function(e){ return e.matchId === matchId; });
  if(!item) return;
  // 最も新しい完了マーク(=今のdateCount)のみ取消可能
  if(round !== item.dateCount){ return; }
  if(!confirm(round+'回目完了を取消しますか？(押し間違い時)')) return;
  try{
    var newCount = round - 1;
    var{data, error}=await supa.rpc('set_match_date_count', { p_match_id: matchId, p_count: newCount });
    if(error){ alert('取消に失敗しました: ' + error.message); return; }
    item.dateCount = newCount;
    renderEnList();
  }catch(e){
    console.log('markDateUndo error:', e);
    alert('エラーが発生しました');
  }
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
/** 「付き合いました！」：双方申請式
 *  - 自分が先に押す → 相手の運営チャットに通知 INSERT(RPC側) + 相手に Push
 *  - 相手が既に申請済み → status='coupled' に昇格 + 卒業プラン解放 + 卒業案内 + 双方通知
 *  @param {string} matchId */
async function setCoupled(matchId){
  try{
    // 双方申請式 RPC: 自分側のタイムスタンプセット & 必要なら coupled 昇格
    var rpcResp = await supa.rpc('request_couple', { p_match_id: matchId });
    if(rpcResp && rpcResp.error){
      var errMsg = String(rpcResp.error.message || '');
      if(/already_coupled_with_another/.test(errMsg) || rpcResp.error.code === '54000'){
        alert('お相手は既に別の方とカップル成立されているため、カップル成立できませんでした。');
        await loadEnList();
        return;
      }
      alert('カップル成立申請に失敗しました: ' + errMsg);
      return;
    }
    var res = rpcResp && rpcResp.data;
    var becomesCoupled = !!(res && res.is_coupled);

    // 相手 user_id 取得（push 用）
    var{data:m}=await supa.from('matches').select('from_user_id,to_user_id').eq('id',matchId).single();
    var partnerId = m ? ((m.from_user_id === currentUser.id) ? m.to_user_id : m.from_user_id) : null;

    if(becomesCoupled){
      // === 双方申請揃い：カップル成立 ===
      var nowIso = new Date().toISOString();
      if(partnerId){
        sendPushNotification(supa, {
          target_user_id: partnerId,
          title: '🎊 カップル成立！',
          body: 'お相手も「付き合いました！」を押し、カップルが成立しました',
          url: './#en',
          tag: 'coupled',
        });
      }
      // 運営からの卒業案内通知を両者の運営チャットへ送る（重複は RPC 側で防止）
      supa.rpc('send_couple_notice', { p_match_id: matchId })
        .then(function(r){
          if(r && r.error){ console.log('send_couple_notice error:', r.error); }
          else {
            if(typeof loadOfficialChatHistory === 'function') loadOfficialChatHistory();
            if(typeof addNotif === 'function') addNotif('🎊 ご卒業の案内が届きました', '運営からの今後の流れについてご確認ください');
          }
        })
        .catch(function(e){ console.log('send_couple_notice exception:', e); });

      var item=enList.find(function(e){return e.matchId===matchId;});
      if(item){item.status='coupled';item.coupledAt=nowIso;item.myCoupleReq=true;item.partnerCoupleReq=true;}
      renderEnList();
      renderMsgList();
      loadRealUsers();      // 推しページのカードをグレーアウト再描画
      refreshSotsugyouState(); // 卒業鑑定プラン解放（自分側）
    }else{
      // === 自分が先に申請：相手に Push（運営通知 INSERT は RPC 側で完了済み） ===
      if(partnerId){
        sendPushNotification(supa, {
          target_user_id: partnerId,
          title: '💕 「付き合いました！」申請が届きました',
          body: 'お相手があなたと「付き合いました！」のボタンを押しました',
          url: './#chat-official',
          tag: 'couple-request',
        });
      }
      var item2=enList.find(function(e){return e.matchId===matchId;});
      if(item2){ item2.myCoupleReq = true; }
      renderEnList();
    }
  }catch(e){
    console.log('setCoupled error:', e);
    alert('エラーが発生しました');
  }
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

    // === date_set 状態でのレビュー = キャンセル/終了通知 ===
    var reviewedItem = enList.find(function(e){return e.matchId===matchId;});
    var isDateSetCancellation = reviewedItem && reviewedItem.status === 'date_set';
    if(isDateSetCancellation){
      // 相手の運営チャットに通知 INSERT（RPC 側）
      try{
        var{data:notifyRes, error:notifyErr}=await supa.rpc('notify_match_terminated', { p_match_id: matchId });
        if(notifyErr){ console.log('notify_match_terminated error:', notifyErr); }
        else if(notifyRes && notifyRes.partner_id){
          // 相手に Push 通知
          var pushTitle = notifyRes.was_request_pending
            ? '💔 「付き合いました！」申請がキャンセルされました'
            : '👋 マッチが終了しました';
          var pushBody = notifyRes.was_request_pending
            ? 'お相手がキャンセルされました。レビューをして新しい相手を探しましょう'
            : 'お相手がマッチを終了しました。レビューをして新しい相手を探しましょう';
          sendPushNotification(supa, {
            target_user_id: notifyRes.partner_id,
            title: pushTitle, body: pushBody,
            url: './#chat-official', tag: 'couple-cancel',
          });
        }
      }catch(nx){ console.log('notify_match_terminated exception:', nx); }
    }

    // 成功表示
    if(btn)btn.style.display='none';
    if(successEl)successEl.style.display='block';
    // 1.8秒後にモーダルを閉じて画面更新
    setTimeout(function(){
      document.getElementById('review-overlay').classList.remove('show');
      // ボタン状態をリセット（次回開いたとき用）
      if(btn){btn.disabled=false;btn.textContent='レビューを送信';btn.style.opacity='';btn.style.cursor='';btn.style.display='block';}
      if(successEl)successEl.style.display='none';
      // date_set でレビュー送信 = 自分がマッチを離脱 → enList から削除
      // coupled でレビューしたら従来どおりフラグだけ立てる
      if(isDateSetCancellation){
        enList = enList.filter(function(e){return e.matchId!==matchId;});
      }else{
        var item=enList.find(function(e){return e.matchId===matchId;});
        if(item)item.reviewed=true;
      }
      renderEnList();
      renderMsgList(); // メッセージ一覧も両者レビュー判定で再描画
      updateEnBadge();
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

// ===== マッチング申請者の詳細プロフィール表示 =====
// 縁リスト の pending/approved 等の相手をタップ → プロフィールモーダル表示。
// マッチ前(pending/sent) は avatar をぼかす、マッチ後はクリア表示。
/** 相手の詳細プロフィールを取得して表示 @param {string} partnerUserId @param {string} [status] */
async function openPartnerProfile(partnerUserId, status){
  if(!partnerUserId){ alert('プロフィール取得に失敗しました'); return; }
  try{
    var{data:prof, error}=await supa.from('profiles')
      .select('id, nickname, sex, birth_year, birth_month, birth_day, prefecture, marriage, children, profile_text, avatar_url, member_id, interest_tags')
      .eq('id', partnerUserId).single();
    if(error || !prof){ alert('プロフィールの取得に失敗しました'); return; }
    renderPartnerProfile(prof, status || 'pending');
    document.getElementById('partner-profile-modal').classList.add('show');
  }catch(e){
    console.log('openPartnerProfile error:', e);
    alert('エラーが発生しました');
  }
}

/** モーダルに HTML を流し込む @param {object} prof @param {string} status */
function renderPartnerProfile(prof, status){
  // マッチ後(approved/matched/...) は avatar クリア、それ以外(pending/sent) はぼかし
  var clearAvatar = ['approved','approved_by_me','matched','chatting','date_set','dated','coupled'].indexOf(status) >= 0;
  var blurStyle = clearAvatar ? '' : 'filter:blur(2px);';
  var age = prof.birth_year ? (new Date().getFullYear() - prof.birth_year) + '歳' : '';
  var html = '';
  // アバター
  if(prof.avatar_url){
    html += '<div style="text-align:center;margin-bottom:14px"><div style="display:inline-block;width:100px;height:100px;border-radius:50%;background-image:url(\''+prof.avatar_url.replace(/'/g,"\\'")+'\');background-size:cover;background-position:center;border:1px solid #C9A96E;'+blurStyle+'"></div></div>';
  }else{
    html += '<div style="text-align:center;margin-bottom:14px"><div style="display:inline-flex;width:100px;height:100px;border-radius:50%;background:var(--color-background-secondary);align-items:center;justify-content:center;font-family:\'Noto Serif JP\',serif;font-size:32px;color:#C9A96E;border:1px solid #C9A96E">'+escapeHtml((prof.nickname||'?').charAt(0))+'</div></div>';
  }
  if(!clearAvatar){
    html += '<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-bottom:10px">※ マッチング前のため写真はぼかし表示です</div>';
  }
  // 基本情報
  html += '<div class="modal-info">';
  html += '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+escapeHtml(prof.nickname||'名無し')+'さん</span></div>';
  if(prof.sex) html += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+escapeHtml(prof.sex)+'</span></div>';
  if(age) html += '<div class="modal-row"><span class="modal-lbl">年齢</span><span class="modal-val">'+age+'</span></div>';
  if(prof.prefecture) html += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+escapeHtml(prof.prefecture)+'</span></div>';
  if(prof.marriage) html += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+escapeHtml(prof.marriage)+'</span></div>';
  if(prof.children) html += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+escapeHtml(prof.children)+'</span></div>';
  html += '</div>';
  // プロフィール文
  if(prof.profile_text){
    html += '<div style="margin-top:14px;padding:10px 12px;background:var(--color-background-secondary);border-radius:8px"><div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">プロフィール文</div><div style="font-size:12px;color:var(--color-text-primary);line-height:1.8;white-space:pre-wrap">'+escapeHtml(prof.profile_text)+'</div></div>';
  }else{
    html += '<div style="margin-top:14px;padding:10px 12px;background:var(--color-background-secondary);border-radius:8px;font-size:11px;color:var(--color-text-tertiary);text-align:center">プロフィール文の記載はありません</div>';
  }
  // 興味のあるカテゴリー
  if(typeof renderInterestChipsReadonly === 'function'){
    html += '<div style="margin-top:14px"><div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">興味のあるカテゴリー</div>' + renderInterestChipsReadonly(prof.interest_tags || null) + '</div>';
  }
  // 通報リンク
  if(prof.member_id){
    html += '<div style="text-align:center;margin-top:14px"><button onclick="closePartnerProfile();openReportFor(\''+prof.member_id+'\')" style="font-size:11px;padding:6px 14px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;color:#C05050;background:transparent;cursor:pointer;font-family:inherit">⚠️ この方を通報する</button></div>';
  }
  document.getElementById('partner-profile-body').innerHTML = html;
}

/** モーダルを閉じる */
function closePartnerProfile(){
  document.getElementById('partner-profile-modal').classList.remove('show');
}

// ===== カップル成立中ガード（他相手へのアクションを制限）=====
// 仕様:
//   - カップル成立後、他相手とは「過去にメッセージ1通以上」のみ表示/送信可能
//   - 未送信の他相手は縁リストから消える + アラート文言を表示
//   - 「デート決定！」「付き合いました！」「お話しOK」「ごめんなさい」など進展系ボタンは全て無効化
//   - 「メッセージ」「感謝して完了」「お相手をレビュー」のみ許可

/** 自分の現在のカップル相手のニックネームを返す（成立してなければ null） */
function getCoupledPartnerName(){
  if(!Array.isArray(enList)) return null;
  var couple = enList.find(function(e){ return e.status === 'coupled'; });
  return couple ? (couple.name || null) : null;
}

/** 指定マッチで過去メッセージ1通以上ある？ msgPreviewCache を見る */
function hasPriorMessages(matchId){
  return !!(msgPreviewCache && msgPreviewCache[matchId]);
}

/** カップル成立中ガードの対象マッチか
 *  自分が coupled (対象マッチがカップル相手ではない場合) → true
 *  または 相手が他とカップル成立済み → true */
function isLockedByMyCouple(item){
  if(!item) return false;
  if(item.status === 'coupled') return false; // 自分のカップル相手は対象外
  if(isCoupledNow()) return true;             // 自分がカップル中
  if(item.partnerIsCoupledWithOther) return true; // 相手が他とカップル中
  return false;
}

/** item に応じたロックボタンの onclick alert 文言を返す */
function getCoupleLockAlertCall(item){
  if(isCoupledNow()){
    // 自分がカップル中 → 自分のカップル相手名でアラート
    return 'showCoupledLockAlertSelf()';
  }
  if(item && item.partnerIsCoupledWithOther){
    // 相手が他とカップル中 → 相手の名前を渡してアラート
    var safeName = String(item.name || '').replace(/'/g, "\\'");
    return "showCoupledLockAlertOther('" + safeName + "')";
  }
  return 'void(0)';
}

/** 相手側が別の人と coupled になってる縁を縁リストにマーク。
 *  loadEnList の最後で呼ぶ。partnerIsCoupledWithOther フラグを各 enList 要素に付与。
 *  ⚠️ RLS 回避: 自分のマッチ相手が他のユーザーと coupled になってるかは RLS で見えないため、
 *  SECURITY DEFINER の RPC `get_coupled_user_ids` を呼んで判定する。 */
async function markPartnerCoupledStatus(){
  if(!Array.isArray(enList) || enList.length === 0) return;
  // 自分のカップル相手以外の partner_id を収集
  var partnerIds = [];
  enList.forEach(function(e){
    if(e.status !== 'coupled' && e.partnerUserId) partnerIds.push(e.partnerUserId);
  });
  if(partnerIds.length === 0) return;
  try{
    // SECURITY DEFINER RPC で coupled なユーザーIDだけ返してもらう
    var{data, error}=await supa.rpc('get_coupled_user_ids', { user_ids: partnerIds });
    if(error){ console.log('get_coupled_user_ids error:', error); return; }
    var coupledSet = new Set();
    (data||[]).forEach(function(row){
      if(row && row.user_id) coupledSet.add(row.user_id);
    });
    enList.forEach(function(e){
      if(e.status !== 'coupled' && e.partnerUserId && coupledSet.has(e.partnerUserId)){
        e.partnerIsCoupledWithOther = true;
      }
    });
  }catch(e){ console.log('markPartnerCoupledStatus exception:', e); }
}

/** カップル成立中のガードアラートを出す（自分側） */
function showCoupledLockAlertSelf(){
  var name = getCoupledPartnerName() || 'お相手';
  alert(name + 'とカップル成立中のため、他の方とのメッセージはできません');
}

/** 相手が他とカップル成立して縁が切れたことを伝えるアラート（相手目線） */
function showCoupledLockAlertOther(partnerName){
  alert((partnerName || 'お相手') + 'は別の方とカップル成立されたため、メッセージのやり取りができなくなりました');
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

/** メッセージタブバッジ統合：DM未読 or 運営チャット未読 があれば表示
 *  バッジが「非表示→表示」に切り替わった瞬間にツタを発火(完全連動) */
function updateMsgTabBadge(){
  var dmUnread = hasDmUnread();
  var officialUnread = !!(window._officialChatHasUnread);
  var shouldShow = !!(dmUnread || officialUnread);
  var msgBadge = document.getElementById('msg-badge');
  var wasShown = !!(msgBadge && msgBadge.style.display === 'block');
  if(msgBadge) msgBadge.style.display = shouldShow ? 'block' : 'none';
  // バッジが「非表示→表示」に切り替わった瞬間にツタ発火
  if(shouldShow && !wasShown && typeof growVineFx === 'function'){
    growVineFx('msg');
  }
}

/** メッセージ一覧（chat 可能なステータスの相手）を描画 */
function renderMsgList(){
  var chatStatuses = ['matched','chatting','date_set','dated','coupled'];
  var coupledNow = isCoupledNow();
  var matched = enList.filter(function(e){
    if(chatStatuses.indexOf(e.status) < 0) return false;
    if(e.status === 'coupled') return true;
    // date_set: 両者がレビュー送信済みならスレッドを非表示
    // 自分がレビュー済みのケースは enList から既に除外されているので、partnerReviewed のみ判定
    if(e.status === 'date_set' && e.reviewed && e.partnerReviewed) return false;
    // 自分または相手がカップル中 + 過去メッセージ無し → リストから除外
    if((coupledNow || e.partnerIsCoupledWithOther) && !hasPriorMessages(e.matchId)) return false;
    return true;
  });
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
  var MAX_PER_PERSON = 100;
  var messages = [];
  var mySentCount = 0;

  if(matchId && currentUser){
    try{
      var{data,error}=await supa.from('messages')
        .select('id,sender_id,body,created_at,read_at')
        .eq('match_id', matchId)
        .order('created_at',{ascending:true});
      if(!error && data){
        messages = data;
        mySentCount = data.filter(function(m){ return m.sender_id === currentUser.id; }).length;
      }
      // 相手が送ってきた未読メッセージを既読化（best-effort、失敗しても無視）
      // ⚠️ supa.rpc は .then() を付けないと実際にリクエスト発火しない（lazy 評価）
      supa.rpc('mark_messages_read', { p_match_id: matchId })
        .then(function(r){ if(r && r.error) console.log('mark_messages_read error:', r.error); })
        .catch(function(e){ console.log('mark_messages_read exception:', e); });
    }catch(e){ console.log('loadChat error:', e); }
  }
  currentChatMessages = messages;

  var remaining = MAX_PER_PERSON - mySentCount;
  var html = '<div class="mcnt">残り ' + remaining + ' / ' + MAX_PER_PERSON + ' 回</div>';

  if(messages.length === 0){
    html += '<div style="text-align:center;padding:2rem 0;color:var(--color-text-tertiary);font-size:12px;line-height:1.8">まだメッセージはありません。<br>最初のメッセージを送ってみましょう！</div>';
  } else {
    // 自分が送った最後の既読メッセージだけに「既読」を出す（LINE風: 連続した既読は1つにまとめる）
    var lastReadMyMsgId = null;
    for(var ri = messages.length - 1; ri >= 0; ri--){
      var rm = messages[ri];
      if(rm.sender_id === currentUser.id && rm.read_at){ lastReadMyMsgId = rm.id; break; }
    }
    messages.forEach(function(msg){
      var isMe = msg.sender_id === currentUser.id;
      var t = new Date(msg.created_at);
      var timeStr = pad2(t.getHours())+':'+pad2(t.getMinutes());
      var senderLabel = isMe ? '' : name+'｜';
      var readMark = (isMe && msg.id === lastReadMyMsgId) ? '<span class="read-mark"> ・既読</span>' : '';
      html += '<div class="msg-wrap'+(isMe?' me':'')+'"><div class="bubble'+(isMe?' me':'')+'">'+linkifyText(msg.body)+'</div><div class="mtime">'+senderLabel+timeStr+readMark+'</div></div>';
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

  // カップル成立中の他相手 + 過去メッセージ無し → 送信ブロック
  var currentItem = Array.isArray(enList) ? enList.find(function(e){ return e.matchId === currentChatMatchId; }) : null;
  if(currentItem && isCoupledNow() && currentItem.status !== 'coupled' && !hasPriorMessages(currentChatMatchId)){
    showCoupledLockAlertSelf();
    return;
  }
  // 相手側が別カップル成立 + 過去メッセージ無し → 送信ブロック（相手目線の closure 文言）
  if(currentItem && currentItem.partnerIsCoupledWithOther && !hasPriorMessages(currentChatMatchId)){
    showCoupledLockAlertOther(currentItem.name);
    return;
  }

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
      // レート制限ヒット時は管理画面 DM 監視に記録（best-effort、失敗しても無視）
      var msg = String(error.message || '');
      if(/rate_limit_exceeded|message_limit_exceeded/.test(msg) || error.code === '54000'){
        var reason = /message_limit_exceeded/.test(msg) ? 'message_limit' : 'rate_limit';
        // ⚠️ .then() 必須（supa.rpc は lazy 評価で .then 無しだと実行されない）
        supa.rpc('record_message_rate_hit', { p_reason: reason, p_detail: msg.substring(0, 200) })
          .then(function(){}).catch(function(){});
      }
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
function addOfficialMessage(text){officialMessages.push({from:'official',text:text,timestamp:new Date().toISOString()});document.getElementById('official-preview').textContent=text.substring(0,25)+'…';}
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
  document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';document.getElementById('chat-name').textContent='縁の間 運営';document.getElementById('chat-ava').textContent='縁';document.getElementById('chat-ava').className='msg-list-ava official';document.getElementById('chat-official-badge').style.display='inline-block';var body=document.getElementById('chat-body');var html='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-bottom:.75rem;line-height:1.6">縁の間 運営との公式チャットです。<br>問い合わせへの返答もこちらから届きます。</div>';officialMessages.forEach(function(msg){var ts=msg.timestamp?(' / '+formatDateTime(msg.timestamp)):'';if(msg.from==='official'){html+='<div class="msg-wrap"><div class="bubble">'+linkifyText(msg.text)+'</div><div class="mtime">縁の間 運営'+ts+'</div></div>';}else{html+='<div class="msg-wrap me"><div class="bubble me">'+linkifyText(msg.text)+'</div><div class="mtime">あなた'+ts+'</div></div>';}});html+='<div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" id="official-input" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button onclick="sendToOfficial()" style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div>';body.innerHTML=html;goTab(2);
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
  officialMessages.push({from:'user',text:text,timestamp:new Date().toISOString()});
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
/** 縁リストを DB から再構築：matches テーブルから自分関連の全レコードを取得
 *  ⚠️ レース対策: enList を冒頭で空にせず、ローカル tmp に溜めて最後にアトミック差し替え。
 *  これで loadEnList が並列に走っても、isCoupledNow() が「途中の空配列」を見ない。 */
async function loadEnList(){
  if(!currentUser)return;
  try{
    var tmp=[]; // 完成後に enList = tmp で差し替え
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
          tmp.push({matchId:m.id,partnerUserId:m.to_user_id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:'sent'});
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
            tmp.push({matchId:m.id,partnerUserId:m.to_user_id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:displayStatus,reviewed:alreadyReviewed,coupledAt:m.coupled_at,myCoupleReq:!!m.from_user_coupled_at,partnerCoupleReq:!!m.to_user_coupled_at,dateCount:(m.date_count||0)});
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
          tmp.push({matchId:m.id,partnerUserId:m.to_user_id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:'rejected_notify'});
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
          tmp.push({matchId:m.id,partnerUserId:m.from_user_id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:sc,status:'pending'});
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
            tmp.push({matchId:m.id,partnerUserId:m.from_user_id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),memberId:prof.member_id,avatarUrl:prof.avatar_url||null,score:'--',status:displayStatus,reviewed:alreadyReviewed,coupledAt:m.coupled_at,myCoupleReq:!!m.to_user_coupled_at,partnerCoupleReq:!!m.from_user_coupled_at,dateCount:(m.date_count||0)});
          }
        }
      }
    }
    // 相手のレビュー済みマッチを判定（date_set でキャンセル通知バッジ切替用）
    try{
      var allMatchIds = tmp.map(function(t){return t.matchId;});
      if(allMatchIds.length > 0){
        var{data:prRows, error:prErr}=await supa.rpc('get_partner_reviewed_match_ids', { p_match_ids: allMatchIds });
        if(!prErr){
          var prSet = new Set((prRows||[]).map(function(r){return r.match_id;}));
          tmp.forEach(function(it){ it.partnerReviewed = prSet.has(it.matchId); });
        }
      }
    }catch(prEx){ console.log('get_partner_reviewed_match_ids exception:', prEx); }

    // 自分が date_set で既にレビュー送信済みなら enList から除外（=自分が「感謝して終了」した側）
    tmp = tmp.filter(function(it){
      if(it.status === 'date_set' && it.reviewed) return false;
      return true;
    });

    // 新規 検知用: 入れ替え前の pending(受信)と approved(承認された自分の申請) の matchId 集合を保持
    var prevPendingIds = new Set();
    var prevApprovedIds = new Set();
    if(Array.isArray(enList)){
      enList.forEach(function(e){
        if(e.status === 'pending')  prevPendingIds.add(e.matchId);
        if(e.status === 'approved') prevApprovedIds.add(e.matchId);
      });
    }

    // ★ アトミック差し替え（ここまで enList は古いデータのまま、isCoupledNow が空配列を見ることはない）
    enList = tmp;

    // 縁リストに新しい「動き」があったらツタ演出 + ゴールドポッチ
    // - 新規 pending(自分宛にお話し申請が来た)
    // - 新規 approved(自分の申請が「お話しOK」された)
    try{
      var newPending  = tmp.some(function(it){ return it.status === 'pending'  && !prevPendingIds.has(it.matchId); });
      var newApproved = tmp.some(function(it){ return it.status === 'approved' && !prevApprovedIds.has(it.matchId); });
      // 初回ロードは発火しない(全部「新規」扱いになるのを防ぐ)
      if((newPending || newApproved) && window._enListBootstrapped === true){
        if(typeof growVineFx === 'function') growVineFx('enlist');
      }
      window._enListBootstrapped = true;
    }catch(_){}

    // 相手側がこちらと無関係のマッチで coupled になっているか検知
    await markPartnerCoupledStatus();
    renderEnList();
    updateEnBadge();
    await loadMsgPreviews();
    // 過去メッセージ有無のフィルタが効くよう再描画
    renderEnList();
    renderMsgList();
    // 推しページが既に描画済み(PARTNERS あり) → ロック状態を反映するため再描画
    // 起動時のレース対策: loadRealUsers が先に走って enList がまだ空のまま buildDetail されるケース
    // ⚠️ ただし詳細パネルが開いている時は再描画しない（ユーザー操作中の閉じ防止）
    if(typeof PARTNERS !== 'undefined' && PARTNERS.length > 0 && typeof applyFilter === 'function'){
      var openDetail = document.querySelector('.detail-panel.open');
      if(!openDetail){ applyFilter(); }
    }
    // 自分のマッチがcoupled状態なら卒業プランを解放（相手側が「付き合いました!」を押した時もここで検知）
    if(enList.some(function(e){return e.status==='coupled';})){
      refreshSotsugyouState();
    }
    // プロフィールモーダルのカップル相手セクションを更新
    if(typeof refreshProfileCoupleSection === 'function') refreshProfileCoupleSection();
  }catch(e){console.log('loadEnListエラー:',e);}
}
