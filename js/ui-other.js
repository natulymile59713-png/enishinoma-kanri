// ===== UI: その他（プラン・お問い合わせ・通知・サブメニュー） =====
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
function submitContact(){var type=document.getElementById('contact-type').value;if(!type){alert('問い合わせ内容を選択してください');return;}document.getElementById('contact-sent').style.display='block';setTimeout(function(){addOfficialMessage('お問い合わせ（'+type+'）を受け付けました。内容を確認次第、こちらのチャットにてご返答いたします。');addNotif('【運営】お問い合わせを受け付けました','メッセージページの運営チャットにてご返答いたします。');},1000);}
function toggleSubMenu(e){if(e)e.stopPropagation();var el=document.getElementById('sub-menu');if(el)el.classList.toggle('show');}
function closeSubMenu(){var el=document.getElementById('sub-menu');if(el)el.classList.remove('show');}
function openSubPage(page){
  ['plan','omoi','voice','contact','shindan','memo'].forEach(function(p){
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
}
