// ============================================
// 卒業生の間 - 破局申告 → 相互非表示
//
// 卒業生同士が破局した時、お互い「だけ」が見えなくなる（相互ブロック）。
// ・reportBreakup(partnerId): どちらか一方が呼べば相互非表示が成立
// ・loadHiddenUserIds(): 自分から見て非表示にすべき相手の id 集合を取得
//   → 卒業生の間の一覧/チャット描画時に、この集合に含まれる相手を除外する
//
// ※ 「卒業生の間」画面（アプリ内チャット空間）は別途作り込み予定。
//    本ファイルはその土台となる呼び出し口。UI ボタンは間の作り込み時に紐付ける。
// ============================================

/**
 * 破局を申告し、相手との相互非表示を成立させる。
 * @param {string} partnerId 元のお相手の user id
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function reportBreakup(partnerId){
  if(!currentUser){ return { ok:false, error:'not_logged_in' }; }
  if(!partnerId || partnerId === currentUser.id){ return { ok:false, error:'invalid_partner' }; }
  try{
    const { error } = await supa.rpc('report_breakup', { p_partner_id: partnerId });
    if(error){
      console.log('reportBreakup error:', error);
      return { ok:false, error: error.message || 'rpc_error' };
    }
    // 取得済みの非表示集合キャッシュを破棄（次回ロードで最新化）
    _hiddenUserIdsCache = null;
    return { ok:true };
  }catch(e){
    console.log('reportBreakup exception:', e);
    return { ok:false, error:'exception' };
  }
}

// 非表示集合の簡易キャッシュ（同一セッション内の再取得を抑制）
var _hiddenUserIdsCache = null;

/**
 * 自分から見て非表示にすべき相手の user id を Set で返す。
 * 卒業生の間の一覧/チャットで「相手がこの集合に含まれるなら描画しない」用途。
 * @param {boolean} [force] true でキャッシュを無視して再取得
 * @returns {Promise<Set<string>>}
 */
async function loadHiddenUserIds(force){
  if(!force && _hiddenUserIdsCache){ return _hiddenUserIdsCache; }
  const ids = new Set();
  if(!currentUser){ _hiddenUserIdsCache = ids; return ids; }
  try{
    const { data, error } = await supa
      .from('hidden_pairs')
      .select('user_lo, user_hi');
    if(error){ console.log('loadHiddenUserIds error:', error); return ids; }
    (data || []).forEach(function(row){
      // RLS により自分が当事者の行のみ返る。相手側の id を集める。
      if(row.user_lo === currentUser.id) ids.add(row.user_hi);
      else if(row.user_hi === currentUser.id) ids.add(row.user_lo);
    });
  }catch(e){
    console.log('loadHiddenUserIds exception:', e);
  }
  _hiddenUserIdsCache = ids;
  return ids;
}

/**
 * 指定の相手が自分から見て非表示かどうか（同期）。
 * 事前に loadHiddenUserIds() を呼んでキャッシュを温めておくこと。
 * @param {string} userId
 * @returns {boolean}
 */
function isHiddenFromMe(userId){
  return !!(_hiddenUserIdsCache && _hiddenUserIdsCache.has(userId));
}

// ============================================
// 卒業生の間 画面（近況 / メンバー / メッセージ / その他）
// ※ 各ページの中身は順次作り込み。ここでは大枠の画面遷移とプロフィールを実装。
// ============================================

/** 卒業生の間に入る */
function enterVoiceRoom(){
  var wrap = document.getElementById('voice-wrap');
  if(!wrap) return;
  // 古いCSSがキャッシュされていても確実にレイアウトされるよう、重要スタイルを
  // （最新が反映される）JS からインラインで強制適用する。
  wrap.style.cssText = 'position:fixed;top:0;bottom:0;left:0;right:0;margin:0 auto;width:100%;max-width:400px;background:var(--color-background-secondary,#f9f9f9);z-index:200;display:flex;flex-direction:column';
  var body = wrap.querySelector('.vr-body');
  if(body) body.style.cssText = 'flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch';
  var nav = wrap.querySelector('.vr-bnav');
  if(nav) nav.style.flexShrink = '0';
  vrGoTab('feed');
  vrSyncTopbarAvatar();
  vrLoadMyPostIds();
  vrLoadMyCommentIds();
  vrStartRealtime();
}

/** 卒業生の間から縁の間に戻る */
function exitVoiceRoom(){
  var wrap = document.getElementById('voice-wrap');
  if(!wrap) return;
  // パネル類を閉じる
  var np = document.getElementById('vr-notif-panel'); if(np) np.classList.remove('show');
  var pm = document.getElementById('vr-profile-modal'); if(pm) pm.classList.remove('show');
  wrap.style.display = 'none';
  vrStopRealtime();
}

/** 卒業生の間のタブ切替 @param {'feed'|'members'|'messages'|'other'} name */
function vrGoTab(name){
  var pages = { feed:'vr-page-feed', members:'vr-page-members', messages:'vr-page-messages', other:'vr-page-other' };
  Object.keys(pages).forEach(function(k){
    var el = document.getElementById(pages[k]);
    if(el) el.classList.toggle('on', k === name);
  });
  // 上部タブの active（.ntab.on のゴールド下線・色は既存CSSが担当）
  var btns = document.querySelectorAll('#voice-wrap .ntab');
  var order = ['feed','members','messages','other'];
  btns.forEach(function(b, i){ b.classList.toggle('on', order[i] === name); });
  // 近況タブを開いたらフィードを最新化＋近況の赤ポッチをクリア
  if(name === 'feed'){
    var fd = document.getElementById('vr-feed-dot');
    if(fd) fd.style.display = 'none';
    if(typeof vrRenderFeed === 'function') vrRenderFeed();
  }
  // メンバータブを開いたら一覧を読み込み
  if(name === 'members' && typeof vrLoadMembers === 'function'){ vrLoadMembers(); }
  // メッセージタブを開いたら会話一覧を表示
  if(name === 'messages' && typeof vrLoadConversations === 'function'){
    var cv = document.getElementById('vr-msg-chat-view');
    var lv = document.getElementById('vr-msg-list-view');
    if(cv) cv.style.display = 'none';
    if(lv) lv.style.display = 'block';
    vrLoadConversations();
  }
}

/** 通知パネルの表示切替 */
function vrToggleNotif(){
  var p = document.getElementById('vr-notif-panel');
  if(!p) return;
  p.classList.toggle('show');
  if(p.classList.contains('show')){
    var dot = document.getElementById('vr-notif-dot'); if(dot) dot.style.display = 'none';
  }
}

/** プロフィールモーダルの表示切替（開く時に内容を再描画） */
function vrToggleProfile(){
  var m = document.getElementById('vr-profile-modal');
  if(!m) return;
  var willShow = !m.classList.contains('show');
  if(willShow) renderVoiceProfile();
  m.classList.toggle('show');
}

/** 卒業生の間トップバーのアバター/イニシャルを同期 */
function vrSyncTopbarAvatar(){
  var p = window._profileModalData || {};
  var ava = document.getElementById('vr-topbar-ava');
  var init = document.getElementById('vr-topbar-initial');
  var nickInit = (p.nickname || '卒').charAt(0);
  if(p.avatar_url){
    if(ava){ ava.src = p.avatar_url; ava.style.display = 'block'; }
    if(init) init.style.display = 'none';
  }else{
    if(ava){ ava.src = ''; ava.style.display = 'none'; }
    if(init){ init.style.display = ''; init.textContent = nickInit; }
  }
}

// ----- プロフィールの表示/非表示トグル（生年月日・お相手） -----
function vrVisKey(kind){
  var uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : 'guest';
  return 'vr_show_' + kind + '_' + uid;
}
/** 表示設定を取得（既定: 表示する=true） */
function vrIsVisible(kind){
  try{ var v = localStorage.getItem(vrVisKey(kind)); return v === null ? true : v === '1'; }
  catch(e){ return true; }
}
/** 表示/非表示を切り替えて再描画 */
function vrToggleVisibility(kind){
  try{ localStorage.setItem(vrVisKey(kind), vrIsVisible(kind) ? '0' : '1'); }catch(e){}
  renderVoiceProfile();
}

/** 卒業生の間のプロフィール内容を描画 */
function renderVoiceProfile(){
  var body = document.getElementById('vr-profile-body');
  if(!body) return;
  vrSyncTopbarAvatar();
  var p = window._profileModalData || {};
  var nick = p.nickname || '名無し';
  var nickInit = nick.charAt(0);

  var showBirth = vrIsVisible('birth');
  var showPartner = vrIsVisible('partner');

  // お相手（enList の coupled 相手から取得）
  var partnerName = '';
  if(typeof enList !== 'undefined' && Array.isArray(enList)){
    var couple = enList.find(function(e){ return e.status === 'coupled'; });
    if(couple) partnerName = (couple.name || '名無し') + (couple.memberId ? '（' + couple.memberId + '）' : '');
  }

  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s == null ? '' : s); };

  var html = '';
  // アバター
  html += '<div class="modal-ava">';
  if(p.avatar_url){ html += '<img src="' + esc(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else { html += '<span class="modal-ava-ph">' + esc(nickInit) + '</span>'; }
  html += '</div>';

  // ♡（画像とニックネームの間）
  html += '<div class="vr-heart-row" id="vr-heart-self"></div>';

  // 基本情報（ニックネーム・性別は常時表示）
  html += '<div style="margin-top:10px">';
  html += '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">' + esc(nick) + '</span></div>';
  html += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">' + esc(p.sex || '—') + '</span></div>';

  // 生年月日（表示/非表示トグル）
  var birthStr = (p.birth_year ? (p.birth_year + '年' + (p.birth_month||'') + '月' + (p.birth_day||'') + '日') : '—');
  html += '<div class="vr-vis-row" style="padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary)">'
        + '<span class="modal-lbl">生年月日</span>'
        + '<button class="vr-vis-toggle' + (showBirth ? '' : ' off') + '" onclick="vrToggleVisibility(\'birth\')">' + (showBirth ? '公開中' : '非公開') + '</button>'
        + '</div>';
  if(showBirth){
    html += '<div class="modal-row"><span class="modal-lbl">　</span><span class="modal-val">' + esc(birthStr) + '</span></div>';
  }

  // お相手（表示/非表示トグル）
  html += '<div class="vr-vis-row" style="padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary)">'
        + '<span class="modal-lbl">お相手</span>'
        + '<button class="vr-vis-toggle' + (showPartner ? '' : ' off') + '" onclick="vrToggleVisibility(\'partner\')">' + (showPartner ? '公開中' : '非公開') + '</button>'
        + '</div>';
  if(showPartner){
    html += '<div class="modal-row"><span class="modal-lbl">　</span><span class="modal-val" style="color:#d6608b">' + (partnerName ? '💕 ' + esc(partnerName) : '—') + '</span></div>';
  }
  html += '</div>';

  // 興味のあるカテゴリー（縁の間と共通レンダラー）
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="vr-sec-title">興味のあるカテゴリー</div>';
  if(typeof renderInterestChipsReadonly === 'function'){
    html += renderInterestChipsReadonly(p.interest_tags || null);
  }
  html += '</div>';

  // 命式 ＋ 十二運
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="vr-sec-title">命式</div>';
  html += renderVoicePillarsHtml();
  html += '</div>';

  // 会員ID
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="modal-row"><span class="modal-lbl">会員ID</span><span class="modal-val mono">' + esc(p.member_id || '—') + '</span></div>';
  html += '</div>';

  body.innerHTML = html;
  if(currentUser) vrFillHearts('vr-heart-self', currentUser.id);
}

/** 受け取った♡の数を取得して表示 */
async function vrFillHearts(elId, userId){
  var el = document.getElementById(elId);
  if(!el || !userId) return;
  try{
    var res = await supa.from('graduate_hearts').select('id', { count: 'exact', head: true }).eq('receiver_id', userId);
    var n = (res && res.count) || 0;
    el.innerHTML = '<span class="vr-heart-ico">♥</span><span class="vr-heart-count">' + n + '</span>';
  }catch(e){ el.innerHTML = ''; }
}

/** 命式（4柱）＋ その下に十二運を描画して HTML を返す
 *  @param {Array} [pillarsArg] 指定があればその命式を使う（他メンバー用）。省略時は自分(MY_PILLARS） */
function renderVoicePillarsHtml(pillarsArg){
  var pillars = Array.isArray(pillarsArg) ? pillarsArg
    : ((typeof MY_PILLARS !== 'undefined' && Array.isArray(MY_PILLARS)) ? MY_PILLARS : [null,null,null,null]);
  var labels = (typeof PL !== 'undefined') ? PL : ['年柱','月柱','日柱','時柱'];
  var kanArr = (typeof KAN !== 'undefined') ? KAN : [];
  var shiArr = (typeof SHI !== 'undefined') ? SHI : [];

  // 表示順は左から 時柱→日柱→月柱→年柱（元index: 3,2,1,0）
  var order = [3, 2, 1, 0];

  // 命式
  var html = '<div style="display:flex;gap:6px">';
  order.forEach(function(oi){
    var pl = pillars[oi];
    var kan = pl ? kanArr[pl.k] : '—';
    var shi = pl ? shiArr[pl.s] : '—';
    html += '<div class="pc-mini' + (oi === 2 ? ' day' : '') + '" style="flex:1"><div class="pc-mini-lbl">' + labels[oi] + '</div><div class="pc-mini-k">' + kan + '</div><div class="pc-mini-s">' + shi + '</div></div>';
  });
  html += '</div>';

  // 十二運（日干を基準に各柱の地支から算出）
  var dayStem = (pillars[2] && pillars[2].k != null) ? pillars[2].k : null;
  html += '<div class="vr-sec-title" style="margin-top:12px">十二運</div>';
  html += '<div class="vr-juniun">';
  order.forEach(function(oi){
    var pl = pillars[oi];
    var val = '—';
    if(dayStem != null && pl && pl.s != null && typeof juniun === 'function'){
      val = juniun(dayStem, pl.s) || '—';
    }
    html += '<div class="vr-juniun-cell' + (oi === 2 ? ' day' : '') + '"><div class="vr-juniun-lbl">' + labels[oi] + '</div><div class="vr-juniun-val">' + val + '</div></div>';
  });
  html += '</div>';
  return html;
}

// ============================================
// 近況フィード（X風：文章・写真・動画の投稿）
// ============================================

// コンポーザーで選択中のメディアファイル
var _vrPendingFile = null;

/** コンポーザーのアバターを現在のプロフィールに同期 */
function vrSyncComposerAvatar(){
  var p = window._profileModalData || {};
  var img = document.getElementById('vr-composer-ava-img');
  var init = document.getElementById('vr-composer-ava-init');
  if(p.avatar_url){
    if(img){ img.src = p.avatar_url; img.style.display = 'block'; }
    if(init) init.style.display = 'none';
  }else{
    if(img){ img.src = ''; img.style.display = 'none'; }
    if(init){ init.style.display = ''; init.textContent = (p.nickname || '卒').charAt(0); }
  }
}

/** メディア選択時：プレビュー表示 */
function vrOnMediaSelect(input){
  var file = input && input.files && input.files[0];
  var prev = document.getElementById('vr-post-media-preview');
  if(!file){ _vrPendingFile = null; if(prev){ prev.style.display='none'; prev.innerHTML=''; } return; }
  // サイズ上限（動画50MB / 画像は圧縮するので緩め）
  var isVideo = file.type.indexOf('video') === 0;
  if(isVideo && file.size > 50 * 1024 * 1024){
    alert('動画は50MBまでです。');
    input.value = ''; _vrPendingFile = null;
    if(prev){ prev.style.display='none'; prev.innerHTML=''; }
    return;
  }
  _vrPendingFile = file;
  var url = URL.createObjectURL(file);
  if(prev){
    prev.innerHTML = (isVideo
        ? '<video src="'+url+'" controls playsinline></video>'
        : '<img src="'+url+'" alt="">')
      + '<button class="vr-media-remove" onclick="vrClearMedia()">✕</button>';
    prev.style.display = 'block';
  }
}

/** 選択中メディアを取り消す */
function vrClearMedia(){
  _vrPendingFile = null;
  var input = document.getElementById('vr-post-media');
  if(input) input.value = '';
  var prev = document.getElementById('vr-post-media-preview');
  if(prev){ prev.style.display='none'; prev.innerHTML=''; }
}

/** メディアを Storage `posts` バケットへアップロード */
async function vrUploadMedia(file){
  if(!file || !currentUser) return { url:null, type:null, error:new Error('no file') };
  try{
    var isVideo = file.type.indexOf('video') === 0;
    var blob = file, contentType = file.type, ext;
    if(isVideo){
      ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    }else{
      // 画像は圧縮（共通関数）
      blob = (typeof compressImage === 'function')
        ? await compressImage(file, { maxSide: 1600, quality: 0.85 })
        : file;
      contentType = 'image/jpeg'; ext = 'jpg';
    }
    var path = currentUser.id + '/' + Date.now() + '.' + ext;
    var up = await supa.storage.from('posts').upload(path, blob, { contentType: contentType, cacheControl: '3600', upsert: false });
    if(up.error) return { url:null, type:null, error: up.error };
    var pub = supa.storage.from('posts').getPublicUrl(path);
    return { url: (pub && pub.data ? pub.data.publicUrl : null), type: isVideo ? 'video' : 'image', error: null };
  }catch(e){
    return { url:null, type:null, error: e };
  }
}

/** 投稿を送信 */
async function vrSubmitPost(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var ta = document.getElementById('vr-post-text');
  var body = ta ? ta.value.trim() : '';
  if(!body && !_vrPendingFile){ alert('内容を入力するか、写真・動画を選んでください'); return; }
  var btn = document.getElementById('vr-post-btn');
  if(btn){ btn.disabled = true; btn.textContent = '投稿中...'; }
  try{
    var mediaUrl = null, mediaType = null;
    if(_vrPendingFile){
      var up = await vrUploadMedia(_vrPendingFile);
      if(up.error){ alert('メディアのアップロードに失敗しました：' + (up.error.message || '')); return; }
      mediaUrl = up.url; mediaType = up.type;
    }
    var p = window._profileModalData || {};
    var ins = await supa.from('graduate_posts').insert({
      user_id: currentUser.id,
      member_id: p.member_id || null,
      nickname: p.nickname || null,
      avatar_url: p.avatar_url || null,
      body: body || null,
      media_url: mediaUrl,
      media_type: mediaType
    });
    if(ins.error){ alert('投稿に失敗しました：' + (ins.error.message || '')); return; }
    // クリア
    if(ta) ta.value = '';
    vrClearMedia();
    vrLoadMyPostIds();
    vrRenderFeed();
  }catch(e){
    console.log('vrSubmitPost exception:', e);
    alert('エラーが発生しました');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = '投稿する'; }
  }
}

/** 近況フィードを読み込み・描画（相互非表示の相手は除外） */
async function vrRenderFeed(){
  vrSyncComposerAvatar();
  var list = document.getElementById('vr-feed-list');
  if(!list) return;
  var hidden = await loadHiddenUserIds();
  try{
    var res = await supa.from('graduate_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if(res.error){ list.innerHTML = '<div class="vr-empty">読み込みに失敗しました。</div>'; return; }
    // アンケートは全員に表示（対象外でも結果%バーを見られる。回答は対象者のみ）
    var posts = (res.data || []).filter(function(p){ return !hidden.has(p.user_id); });
    if(!posts.length){
      list.innerHTML = '<div class="vr-empty">✦<br>まだ投稿がありません。<br>最初の近況をシェアしてみましょう。</div>';
      return;
    }
    var meta = await vrLoadPostMeta(posts.map(function(p){ return p.id; }));
    list.innerHTML = posts.map(function(p){ return vrPostHtml(p, meta); }).join('');
    // 開いていたコメント欄を復元
    _vrOpenComments.forEach(function(pid){
      var box = document.getElementById('vr-comments-' + pid);
      if(box){ box.style.display = 'block'; vrRenderComments(pid); }
      else { _vrOpenComments.delete(pid); }
    });
  }catch(e){
    console.log('vrRenderFeed exception:', e);
    list.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** 投稿1件の HTML @param post @param meta {likeCount,liked,cmtCount} */
function vrPostHtml(post, meta){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var nick = post.nickname || '名無し';
  var init = nick.charAt(0);
  var when = (typeof formatRelative === 'function') ? formatRelative(post.created_at) : '';
  var avaHtml = post.avatar_url
    ? '<img src="' + esc(post.avatar_url) + '" alt="">'
    : '<span>' + esc(init) + '</span>';
  var bodyHtml = '';
  if(post.body){
    bodyHtml = '<div class="vr-post-body">' + ((typeof linkifyText === 'function') ? linkifyText(post.body) : esc(post.body)) + '</div>';
  }
  var mediaHtml = '';
  if(post.media_url){
    if(post.media_type === 'video'){
      mediaHtml = '<div class="vr-post-media"><video src="' + esc(post.media_url) + '" controls playsinline preload="metadata"></video></div>';
    }else{
      mediaHtml = '<div class="vr-post-media"><img src="' + esc(post.media_url) + '" alt="" loading="lazy"></div>';
    }
  }
  var delBtn = (currentUser && post.user_id === currentUser.id)
    ? '<button class="vr-post-del" onclick="vrDeletePost(\'' + post.id + '\')">削除</button>'
    : '';
  var lc = (meta && meta.likeCount[post.id]) || 0;
  var liked = !!(meta && meta.liked[post.id]);
  var cc = (meta && meta.cmtCount[post.id]) || 0;
  var actions = '<div class="vr-post-actions">'
    + '<button class="vr-act like' + (liked ? ' on' : '') + '" data-post="' + post.id + '" onclick="vrToggleLike(\'' + post.id + '\')"><span class="vr-act-ico">' + (liked ? '♥' : '♡') + '</span><span class="vr-like-count">' + lc + '</span></button>'
    + '<button class="vr-act" onclick="vrToggleComments(\'' + post.id + '\')"><span class="vr-act-ico">💬</span><span class="vr-cmt-count" data-post="' + post.id + '">' + cc + '</span></button>'
    + '</div>'
    + '<div class="vr-comments" id="vr-comments-' + post.id + '" style="display:none"></div>';
  // アンケート投稿は本文/メディアの代わりにアンケートUIを表示
  var contentHtml = (post.post_type === 'survey' && post.survey)
    ? vrSurveyBlockHtml(post, meta)
    : (bodyHtml + mediaHtml);
  return '<div class="vr-post">'
       + '<div class="vr-post-ava">' + avaHtml + '</div>'
       + '<div class="vr-post-main">'
       + '<div class="vr-post-head"><span class="vr-post-name">' + esc(nick) + '</span><span class="vr-post-meta">' + esc(when) + '</span>' + delBtn + '</div>'
       + contentHtml + actions
       + '</div></div>';
}

/** 自分の投稿を削除 */
async function vrDeletePost(id){
  if(!id) return;
  if(!confirm('この投稿を削除しますか？')) return;
  try{
    var res = await supa.from('graduate_posts').delete().eq('id', id);
    if(res.error){ alert('削除に失敗しました：' + (res.error.message || '')); return; }
    vrRenderFeed();
  }catch(e){
    console.log('vrDeletePost exception:', e);
    alert('エラーが発生しました');
  }
}

// ----- いいね & コメント -----

/** 表示中投稿のいいね数・自分のいいね有無・コメント数を集計 */
async function vrLoadPostMeta(postIds){
  var meta = { likeCount:{}, liked:{}, cmtCount:{}, surveyCounts:{}, surveyTotal:{}, surveyMine:{} };
  if(!postIds || !postIds.length) return meta;
  try{
    var lk = await supa.from('graduate_post_likes').select('post_id, user_id').in('post_id', postIds);
    (lk.data || []).forEach(function(r){
      meta.likeCount[r.post_id] = (meta.likeCount[r.post_id] || 0) + 1;
      if(currentUser && r.user_id === currentUser.id) meta.liked[r.post_id] = true;
    });
    var cm = await supa.from('graduate_post_comments').select('post_id').in('post_id', postIds);
    (cm.data || []).forEach(function(r){ meta.cmtCount[r.post_id] = (meta.cmtCount[r.post_id] || 0) + 1; });
    // アンケート回答の集計
    var sa = await supa.from('graduate_survey_answers').select('post_id, user_id, choice_index').in('post_id', postIds);
    (sa.data || []).forEach(function(r){
      if(!meta.surveyCounts[r.post_id]) meta.surveyCounts[r.post_id] = {};
      meta.surveyCounts[r.post_id][r.choice_index] = (meta.surveyCounts[r.post_id][r.choice_index] || 0) + 1;
      meta.surveyTotal[r.post_id] = (meta.surveyTotal[r.post_id] || 0) + 1;
      if(currentUser && r.user_id === currentUser.id) meta.surveyMine[r.post_id] = r.choice_index;
    });
  }catch(e){ console.log('vrLoadPostMeta error:', e); }
  return meta;
}

/** いいねのトグル（楽観的にボタン表示を更新） */
async function vrToggleLike(postId){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var btn = document.querySelector('#voice-wrap .vr-act.like[data-post="' + postId + '"]');
  var liked = !!(btn && btn.classList.contains('on'));
  try{
    if(liked){
      var d = await supa.from('graduate_post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
      if(d.error) throw d.error;
    }else{
      var i = await supa.from('graduate_post_likes').insert({ post_id: postId, user_id: currentUser.id });
      if(i.error && i.error.code !== '23505') throw i.error; // 23505=重複は無視
    }
    if(btn){
      var ico = btn.querySelector('.vr-act-ico');
      var cnt = btn.querySelector('.vr-like-count');
      var n = parseInt((cnt && cnt.textContent) || '0', 10) || 0;
      if(liked){ btn.classList.remove('on'); if(ico) ico.textContent = '♡'; n = Math.max(0, n - 1); }
      else { btn.classList.add('on'); if(ico) ico.textContent = '♥'; n = n + 1; }
      if(cnt) cnt.textContent = n;
    }
  }catch(e){ console.log('vrToggleLike error:', e); }
}

/** コメント欄の開閉 */
async function vrToggleComments(postId){
  var box = document.getElementById('vr-comments-' + postId);
  if(!box) return;
  if(box.style.display !== 'none'){ box.style.display = 'none'; _vrOpenComments.delete(postId); return; }
  box.style.display = 'block';
  _vrOpenComments.add(postId);
  box.innerHTML = '<div class="vr-empty" style="padding:.8rem">読み込み中…</div>';
  await vrRenderComments(postId);
}

/** コメント一覧＋入力欄を描画（Instagram風：トップ＋最初の返信を表示、残りは折りたたみ） */
async function vrRenderComments(postId){
  var box = document.getElementById('vr-comments-' + postId);
  if(!box) return;
  var hidden = await loadHiddenUserIds();
  var html = '';
  try{
    var res = await supa.from('graduate_post_comments')
      .select('*').eq('post_id', postId).order('created_at', { ascending: true });
    if(res.error){ box.innerHTML = '<div class="vr-empty" style="padding:.8rem">読み込みに失敗しました。</div>'; return; }
    var cmts = (res.data || []).filter(function(c){ return !hidden.has(c.user_id); });
    var cmeta = await vrLoadCommentMeta(cmts.map(function(c){ return c.id; }));
    var grp = vrGroupComments(cmts);
    grp.roots.forEach(function(root){
      html += vrCommentHtml(root, postId, cmeta);
      var reps = grp.repliesByRoot[root.id] || [];
      if(reps.length){
        html += '<div class="vr-cmt-children">';
        html += vrCommentHtml(reps[0], postId, cmeta); // 最初の返信のみ表示
        if(reps.length > 1){
          html += '<button class="vr-more-replies" onclick="vrShowReplies(\'' + root.id + '\')">― 返信をもっと見る（' + (reps.length - 1) + '件）</button>';
          html += '<div id="vr-more-' + root.id + '" style="display:none">'
                + reps.slice(1).map(function(r){ return vrCommentHtml(r, postId, cmeta); }).join('')
                + '</div>';
        }
        html += '</div>';
      }
    });
  }catch(e){ console.log('vrRenderComments error:', e); }
  // 投稿への通常コメント入力欄
  html += '<div class="vr-cmt-composer">'
        + '<input id="vr-cmt-input-' + postId + '" class="vr-cmt-input" maxlength="300" placeholder="コメントを書く...">'
        + '<button class="vr-cmt-send" onclick="vrAddComment(\'' + postId + '\')">送信</button>'
        + '</div>';
  box.innerHTML = html;
}

/** コメントを「トップコメント」と「配下の返信(全子孫を1階層へ集約)」に分類 */
function vrGroupComments(comments){
  var byId = {};
  comments.forEach(function(c){ byId[c.id] = c; });
  function rootOf(c){
    var cur = c, guard = 0;
    while(cur.parent_comment_id && byId[cur.parent_comment_id] && guard < 100){ cur = byId[cur.parent_comment_id]; guard++; }
    return cur;
  }
  var roots = [], repliesByRoot = {};
  comments.forEach(function(c){ if(!c.parent_comment_id) roots.push(c); });
  comments.forEach(function(c){
    if(c.parent_comment_id){
      var r = rootOf(c);
      if(r && r.id !== c.id){ (repliesByRoot[r.id] = repliesByRoot[r.id] || []).push(c); }
    }
  });
  function byTime(a, b){ return new Date(a.created_at) - new Date(b.created_at); }
  roots.sort(byTime);
  Object.keys(repliesByRoot).forEach(function(k){ repliesByRoot[k].sort(byTime); });
  return { roots: roots, repliesByRoot: repliesByRoot };
}

/** 隠れている返信（3件目以降）を表示 */
function vrShowReplies(rootId){
  var box = document.getElementById('vr-more-' + rootId);
  if(box) box.style.display = 'block';
  var btn = box ? box.previousElementSibling : null;
  if(btn && btn.classList && btn.classList.contains('vr-more-replies')) btn.style.display = 'none';
}

/** コメントのいいね集計（count + 自分のいいね有無） */
async function vrLoadCommentMeta(commentIds){
  var meta = { likeCount:{}, liked:{} };
  if(!commentIds || !commentIds.length) return meta;
  try{
    var lk = await supa.from('graduate_comment_likes').select('comment_id, user_id').in('comment_id', commentIds);
    (lk.data || []).forEach(function(r){
      meta.likeCount[r.comment_id] = (meta.likeCount[r.comment_id] || 0) + 1;
      if(currentUser && r.user_id === currentUser.id) meta.liked[r.comment_id] = true;
    });
  }catch(e){ console.log('vrLoadCommentMeta error:', e); }
  return meta;
}

/** コメント1件の HTML（いいね♡・返信つき） */
function vrCommentHtml(c, postId, cmeta){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var nick = c.nickname || '名無し';
  var when = (typeof formatRelative === 'function') ? formatRelative(c.created_at) : '';
  var ava = c.avatar_url ? '<img src="' + esc(c.avatar_url) + '" alt="">' : '<span>' + esc(nick.charAt(0)) + '</span>';
  var del = (currentUser && c.user_id === currentUser.id)
    ? '<button class="vr-cmt-del" onclick="vrDeleteComment(\'' + c.id + '\',\'' + c.post_id + '\')">削除</button>' : '';
  var bodyHtml = (typeof linkifyText === 'function') ? linkifyText(c.body) : esc(c.body);
  var lc = (cmeta && cmeta.likeCount[c.id]) || 0;
  var liked = !!(cmeta && cmeta.liked[c.id]);
  var foot = '<div class="vr-cmt-foot">'
    + '<button class="vr-cmt-like' + (liked ? ' on' : '') + '" data-cmt="' + c.id + '" onclick="vrToggleCommentLike(\'' + c.id + '\')"><span class="vr-cmt-like-ico">' + (liked ? '♥' : '♡') + '</span><span class="vr-cmt-like-count">' + (lc ? lc : '') + '</span></button>'
    + '<button class="vr-cmt-reply-btn" onclick="vrToggleReply(\'' + c.id + '\')">返信</button>'
    + '</div>'
    + '<div class="vr-cmt-reply" id="vr-reply-' + c.id + '" style="display:none">'
    + '<input id="vr-reply-input-' + c.id + '" class="vr-cmt-input" maxlength="300" placeholder="返信を書く...">'
    + '<button class="vr-cmt-send" onclick="vrAddComment(\'' + postId + '\',\'' + c.id + '\')">返信</button>'
    + '</div>';
  return '<div class="vr-cmt">'
       + '<div class="vr-cmt-ava">' + ava + '</div>'
       + '<div class="vr-cmt-main">'
       + '<div class="vr-cmt-head"><span class="vr-cmt-name">' + esc(nick) + '</span><span class="vr-cmt-meta">' + esc(when) + '</span>' + del + '</div>'
       + '<div class="vr-cmt-body">' + bodyHtml + '</div>'
       + foot
       + '</div></div>';
}

/** コメントいいねのトグル */
async function vrToggleCommentLike(commentId){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var btn = document.querySelector('#voice-wrap .vr-cmt-like[data-cmt="' + commentId + '"]');
  var liked = !!(btn && btn.classList.contains('on'));
  try{
    if(liked){
      var d = await supa.from('graduate_comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
      if(d.error) throw d.error;
    }else{
      var i = await supa.from('graduate_comment_likes').insert({ comment_id: commentId, user_id: currentUser.id });
      if(i.error && i.error.code !== '23505') throw i.error;
    }
    if(btn){
      var ico = btn.querySelector('.vr-cmt-like-ico');
      var cnt = btn.querySelector('.vr-cmt-like-count');
      var n = parseInt((cnt && cnt.textContent) || '0', 10) || 0;
      if(liked){ btn.classList.remove('on'); if(ico) ico.textContent = '♡'; n = Math.max(0, n - 1); }
      else { btn.classList.add('on'); if(ico) ico.textContent = '♥'; n = n + 1; }
      if(cnt) cnt.textContent = n ? String(n) : '';
    }
  }catch(e){ console.log('vrToggleCommentLike error:', e); }
}

/** 返信入力欄の開閉 */
function vrToggleReply(commentId){
  var box = document.getElementById('vr-reply-' + commentId);
  if(!box) return;
  var show = (box.style.display === 'none');
  box.style.display = show ? 'flex' : 'none';
  if(show){ var inp = document.getElementById('vr-reply-input-' + commentId); if(inp) inp.focus(); }
}

/** コメント投稿（parentCommentId 指定で「コメントへの返信」） */
async function vrAddComment(postId, parentCommentId){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var inputId = parentCommentId ? ('vr-reply-input-' + parentCommentId) : ('vr-cmt-input-' + postId);
  var input = document.getElementById(inputId);
  var body = input ? input.value.trim() : '';
  if(!body){ return; }
  try{
    var p = window._profileModalData || {};
    var res = await supa.from('graduate_post_comments').insert({
      post_id: postId, user_id: currentUser.id,
      member_id: p.member_id || null, nickname: p.nickname || null, avatar_url: p.avatar_url || null,
      body: body, parent_comment_id: parentCommentId || null
    });
    if(res.error){ alert('コメントに失敗しました：' + (res.error.message || '')); return; }
    if(input) input.value = '';
    vrLoadMyCommentIds();
    await vrRenderComments(postId);
    vrBumpCommentCount(postId, 1);
  }catch(e){ console.log('vrAddComment error:', e); }
}

/** 自分のコメントを削除 */
async function vrDeleteComment(id, postId){
  if(!id) return;
  if(!confirm('このコメントを削除しますか？')) return;
  try{
    var res = await supa.from('graduate_post_comments').delete().eq('id', id);
    if(res.error){ alert('削除に失敗しました：' + (res.error.message || '')); return; }
    await vrRenderComments(postId);
    vrBumpCommentCount(postId, -1);
  }catch(e){ console.log('vrDeleteComment error:', e); }
}

/** 投稿のコメント数バッジを増減 */
function vrBumpCommentCount(postId, delta){
  var el = document.querySelector('#voice-wrap .vr-cmt-count[data-post="' + postId + '"]');
  if(!el) return;
  var n = parseInt(el.textContent || '0', 10) || 0;
  el.textContent = Math.max(0, n + delta);
}

// ============================================
// Realtime（即時反映）/ 通知 / ツタ演出
// ============================================

var _vrOpenComments = new Set();  // 開いているコメント欄の post_id
var _vrMyPostIds = new Set();     // 自分の投稿 id（通知対象判定用）
var _vrMyCommentIds = new Set();  // 自分のコメント id（通知対象判定用）
var _vrChannel = null;            // Realtime チャンネル
var _vrRefreshTimer = null;       // フィード再描画デバウンス

/** 自分の投稿IDを取得（通知対象判定用） */
async function vrLoadMyPostIds(){
  if(!currentUser) return;
  try{
    var res = await supa.from('graduate_posts').select('id').eq('user_id', currentUser.id);
    _vrMyPostIds = new Set((res.data || []).map(function(r){ return r.id; }));
  }catch(e){ console.log('vrLoadMyPostIds error:', e); }
}

/** 自分のコメントIDを取得（通知対象判定用） */
async function vrLoadMyCommentIds(){
  if(!currentUser) return;
  try{
    var res = await supa.from('graduate_post_comments').select('id').eq('user_id', currentUser.id);
    _vrMyCommentIds = new Set((res.data || []).map(function(r){ return r.id; }));
  }catch(e){ console.log('vrLoadMyCommentIds error:', e); }
}

/** 近況ページを表示中か */
function vrIsOnFeed(){
  var fp = document.getElementById('vr-page-feed');
  return !!(fp && fp.classList.contains('on'));
}

/** フィード再描画をデバウンス（近況タブ表示中のみ） */
function vrScheduleFeedRefresh(){
  if(_vrRefreshTimer) clearTimeout(_vrRefreshTimer);
  _vrRefreshTimer = setTimeout(function(){
    _vrRefreshTimer = null;
    var feedPage = document.getElementById('vr-page-feed');
    if(feedPage && feedPage.classList.contains('on')) vrRenderFeed();
  }, 450);
}

/** 投稿・いいね・コメントの Realtime 購読を開始 */
function vrStartRealtime(){
  if(!currentUser || typeof supa === 'undefined' || !supa || _vrChannel) return;
  try{
    _vrChannel = supa.channel('vr-feed-' + currentUser.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_posts' }, function(){ vrScheduleFeedRefresh(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_post_likes' }, function(p){ vrOnSocialEvent('post_like', p); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_post_comments' }, function(p){ vrOnSocialEvent('comment', p); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_comment_likes' }, function(p){ vrOnSocialEvent('comment_like', p); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_messages' }, function(p){ vrOnDmEvent(p); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_room_messages' }, function(p){ vrOnRoomEvent(p); })
      .on('postgres_changes', { event:'*', schema:'public', table:'graduate_survey_answers' }, function(){ vrScheduleFeedRefresh(); })
      .subscribe();
  }catch(e){ console.log('vrStartRealtime error:', e); }
}

/** Realtime 購読を停止 */
function vrStopRealtime(){
  if(_vrChannel){
    try{ supa.removeChannel(_vrChannel); }catch(e){}
    _vrChannel = null;
  }
}

/** 投稿/コメントへの いいね・コメントイベント処理
 *  通知対象（自分宛て）:
 *   - 自分の投稿が いいね / コメントされた
 *   - 自分のコメントが いいね / 返信された
 *  通知時: ツタは常に伸ばす。赤ポッチ（🔔・近況）は他ページ表示中のみ。 */
function vrOnSocialEvent(kind, payload){
  if(payload && payload.eventType === 'INSERT' && payload.new){
    var n = payload.new;
    var actor = n.user_id;
    var msg = null;
    if(actor && currentUser && actor !== currentUser.id){
      if(kind === 'post_like' && _vrMyPostIds.has(n.post_id)){
        msg = ['🍀 あなたの投稿に「いいね」', '近況の投稿にいいねがつきました'];
      }else if(kind === 'comment_like' && _vrMyCommentIds.has(n.comment_id)){
        msg = ['🍀 あなたのコメントに「いいね」', 'コメントにいいねがつきました'];
      }else if(kind === 'comment'){
        if(n.parent_comment_id && _vrMyCommentIds.has(n.parent_comment_id)){
          msg = ['💬 あなたのコメントに返信', 'コメントに返信がつきました'];
        }else if(!n.parent_comment_id && _vrMyPostIds.has(n.post_id)){
          msg = ['💬 あなたの投稿にコメント', '近況の投稿にコメントがつきました'];
        }
      }
    }
    if(msg){
      vrAddNotif(msg[0], msg[1]); // ベルに項目追加＋（他ページなら）赤ポッチ
      vrGrowVine();               // ツタは常に伸びる（近況ページ表示中でも）
    }
  }
  vrScheduleFeedRefresh();
}

/** 卒業生の間の通知ベルに項目を追加。赤ポッチは他ページ表示中のみ点灯 */
function vrAddNotif(title, body){
  var list = document.getElementById('vr-notif-list');
  if(list){
    var ph = list.querySelector('.vr-empty');
    if(ph) ph.remove();
    var ts = (typeof formatDateTime === 'function') ? formatDateTime(new Date().toISOString()) : '';
    var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
    var item = document.createElement('div');
    item.className = 'notif-item unread';
    item.innerHTML = '<div class="notif-item-title">' + esc(title) + '</div><div class="notif-item-body">' + esc(body) + '</div><div class="notif-item-time">' + ts + '</div>';
    list.insertBefore(item, list.firstChild);
  }
  // 赤ポッチ（🔔・近況タブ）は「他ページ表示中」のみ点灯
  if(!vrIsOnFeed()){
    var bell = document.getElementById('vr-notif-dot');
    if(bell) bell.style.display = 'block';
    var fd = document.getElementById('vr-feed-dot');
    if(fd) fd.style.display = 'inline-block';
  }
}

var _vrVineSideToggle = false; // ツタを伸ばすロゴ端を左右交互に

/** 近況タブへツタを伸ばす演出（卒業生の間専用・独立実装。ロゴの両端から交互に伸びる） */
function vrGrowVine(){
  if(typeof isNotifEnabled === 'function' && !isNotifEnabled()) return;
  var path = document.getElementById('vr-vine-fx-feed');
  if(!path) return;
  _vrVineSideToggle = !_vrVineSideToggle;
  var side = _vrVineSideToggle ? 'left' : 'right';
  var start = _vrVineLogoEnd(side);
  var end = _vrVineFeedTabPos();
  if(!start || !end) return;
  var d = (typeof _buildVineFxPathSmooth === 'function')
    ? _buildVineFxPathSmooth(start, end)
    : ('M' + start.x + ',' + start.y + ' L' + end.x + ',' + end.y);
  // 左端=緑 / 右端=橙（縁の間と揃える）
  var c = (side === 'left')
    ? { stroke:'#8FB342', glow:'rgba(143,179,66,.4)' }
    : { stroke:'#E29659', glow:'rgba(226,150,89,.4)' };
  path.setAttribute('d', d);
  path.style.stroke = c.stroke;
  path.style.filter = 'drop-shadow(0 0 1px ' + c.glow + ')';
  var len; try{ len = path.getTotalLength(); }catch(_){ len = 400; }
  path.style.transition = 'none';
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;
  path.style.opacity = '1';
  void path.getBoundingClientRect();
  var growMs = 1400, holdMs = 600, fadeMs = 500;
  path.style.transition = 'stroke-dashoffset ' + growMs + 'ms cubic-bezier(.22,.61,.36,1)';
  path.style.strokeDashoffset = '0';
  setTimeout(function(){
    path.style.transition = 'opacity ' + fadeMs + 'ms ease';
    path.style.opacity = '0';
  }, growMs + holdMs);
}

/** スクリーン座標 → 卒業生overlay(viewBox 0..400 / 0..100)座標
 *  getScreenCTM は Safari の position:fixed 配下で不正になることがあるため、
 *  オーバーレイの実矩形と viewBox(preserveAspectRatio="xMidYMin meet")から手動換算する。 */
function _vrVineScreenToOverlay(x, y){
  var o = document.getElementById('vr-vine-overlay');
  if(!o) return null;
  var r = o.getBoundingClientRect();
  if(!r.width || !r.height) return null;
  var vbW = 400, vbH = 100;
  var scale = Math.min(r.width / vbW, r.height / vbH);
  if(!scale) return null;
  var offX = r.left + (r.width - vbW * scale) / 2; // xMid（水平中央寄せ）
  var offY = r.top;                                // YMin（上寄せ）
  return { x: (x - offX) / scale, y: (y - offY) / scale };
}
/** 卒業生ロゴの左端/右端の overlay 座標（ロゴ要素の矩形から算出＝CSS揺れ込みで安定） */
function _vrVineLogoEnd(side){
  var logo = document.querySelector('#voice-wrap .vr-topbar-logo');
  if(logo){
    var r = logo.getBoundingClientRect();
    if(r.width && r.height){
      var x = (side === 'right') ? (r.right - 3) : (r.left + 3);
      var y = r.top + r.height * 0.5;
      var ov = _vrVineScreenToOverlay(x, y);
      if(ov) return { x: ov.x, y: ov.y };
    }
  }
  // フォールバック（overlay viewBox 0..400 内の概ねロゴ位置）
  return (side === 'right') ? { x: 232, y: 30 } : { x: 168, y: 30 };
}
/** 近況タブ中心の overlay 座標 */
function _vrVineFeedTabPos(){
  var el = document.querySelector('#voice-wrap .ntab');
  if(el){
    var r = el.getBoundingClientRect();
    if(r.width && r.height){
      var ov = _vrVineScreenToOverlay(r.left + r.width / 2, r.top + r.height / 2);
      if(ov) return { x: ov.x, y: ov.y };
    }
  }
  return { x: 60, y: 78 };
}

// ============================================
// メンバーページ（卒業生一覧 + 並び替え + 絞り込み）
// ============================================

var _vrMembers = null; // 取得済みメンバー配列のキャッシュ

/** 絞り込みパネルの開閉 */
function vrToggleMemFilter(){
  var p = document.getElementById('vr-mem-filter');
  if(p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
}

/** 卒業生（graduated_at あり）を全員取得してメンバー配列を作る */
async function vrLoadMembers(){
  var list = document.getElementById('vr-mem-list');
  if(list && !_vrMembers) list.innerHTML = '<div class="vr-empty">読み込み中…</div>';
  try{
    var hidden = await loadHiddenUserIds();
    // 卒業認定者(graduated_at) ＋ 転入承認者(voice_transfer_at) を表示
    var res = await supa.from('profiles')
      .select('id, nickname, sex, avatar_url, birth_year, birth_month, birth_day, pillar_year_s, pillar_month_s, pillar_day_k, pillar_day_s, graduated_at, voice_transfer_at, marital_status')
      .or('graduated_at.not.is.null,voice_transfer_at.not.is.null');
    if(res.error){ if(list) list.innerHTML = '<div class="vr-empty">読み込みに失敗しました。</div>'; return; }
    var nowY = new Date().getFullYear();
    _vrMembers = (res.data || [])
      .filter(function(u){ return !hidden.has(u.id); })
      .map(function(u){
        var kanArr = (typeof KAN !== 'undefined') ? KAN : [];
        var dayK = (u.pillar_day_k != null) ? u.pillar_day_k : null;
        function jun(branch){ return (dayK != null && branch != null && typeof juniun === 'function') ? (juniun(dayK, branch) || '') : ''; }
        var isGrad = !!u.graduated_at;
        // 婚姻状態：申告があればそれ、無ければ卒業生は既婚扱い
        var marital = u.marital_status || (isGrad ? '既婚' : '');
        return {
          id: u.id,
          nick: u.nickname || '名無し',
          sex: u.sex || '',
          avatar_url: u.avatar_url || '',
          age: u.birth_year ? (nowY - u.birth_year) : null,
          kan: (dayK != null && kanArr[dayK]) ? kanArr[dayK] : '',  // 本質（日干）
          junDay:   jun(u.pillar_day_s),    // 十二運（日柱）
          junMonth: jun(u.pillar_month_s),  // 十二運（月柱）
          junYear:  jun(u.pillar_year_s),   // 十二運（年柱）
          memberType: isGrad ? '卒' : '転', // 卒業生 / 転入生
          marital: marital                  // 未婚/既婚/離婚
        };
      });
    vrRenderMembers();
  }catch(e){
    console.log('vrLoadMembers error:', e);
    if(list) list.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** 並び替え＋絞り込みを適用してメンバー一覧を描画（キャッシュから） */
function vrRenderMembers(){
  var list = document.getElementById('vr-mem-list');
  if(!list) return;
  if(!_vrMembers){ return; }
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };

  // 絞り込み条件
  var fSex = (document.getElementById('vr-f-sex') || {}).value || '';
  var fKan = (document.getElementById('vr-f-kan') || {}).value || '';
  var fJunDay = (document.getElementById('vr-f-jun-day') || {}).value || '';
  var fJunMonth = (document.getElementById('vr-f-jun-month') || {}).value || '';
  var fJunYear = (document.getElementById('vr-f-jun-year') || {}).value || '';
  var ageMinEl = document.getElementById('vr-f-age-min');
  var ageMaxEl = document.getElementById('vr-f-age-max');
  var ageMin = ageMinEl && ageMinEl.value !== '' ? parseInt(ageMinEl.value, 10) : null;
  var ageMax = ageMaxEl && ageMaxEl.value !== '' ? parseInt(ageMaxEl.value, 10) : null;

  var rows = _vrMembers.filter(function(m){
    if(fSex && m.sex !== fSex) return false;
    if(fKan && m.kan !== fKan) return false;
    if(fJunDay && m.junDay !== fJunDay) return false;
    if(fJunMonth && m.junMonth !== fJunMonth) return false;
    if(fJunYear && m.junYear !== fJunYear) return false;
    if(ageMin != null && (m.age == null || m.age < ageMin)) return false;
    if(ageMax != null && (m.age == null || m.age > ageMax)) return false;
    return true;
  });

  // 並び替え
  var sort = (document.getElementById('vr-mem-sort') || {}).value || 'aiueo';
  rows.sort(function(a, b){
    if(sort === 'age_asc'){ return (a.age == null ? 999 : a.age) - (b.age == null ? 999 : b.age); }
    if(sort === 'age_desc'){ return (b.age == null ? -1 : b.age) - (a.age == null ? -1 : a.age); }
    return String(a.nick).localeCompare(String(b.nick), 'ja'); // 五十音順
  });

  if(!rows.length){
    list.innerHTML = '<div class="vr-empty">該当する卒業生がいません。</div>';
    return;
  }
  var html = '<div class="vr-mem-count">' + rows.length + '名</div>';
  html += rows.map(vrMemberCardHtml).join('');
  list.innerHTML = html;
}

/** メンバー1人のカード HTML */
function vrMemberCardHtml(m){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var ava = m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" alt="">' : '<span>' + esc(m.nick.charAt(0)) + '</span>';
  var sub = [];
  if(m.sex) sub.push(esc(m.sex));
  if(m.age != null) sub.push(m.age + '歳');
  // 本質（日干） / 十二運（日柱・月柱・年柱）
  var juns = [m.junDay, m.junMonth, m.junYear].filter(Boolean).map(esc).join('・');
  var essence = '';
  if(m.kan) essence += '<span class="vr-mem-tag">' + esc(m.kan) + '</span>';
  if(juns) essence += '<span class="vr-mem-tag"> / ' + juns + '</span>';
  if(essence) sub.push(essence);
  // ニックネーム右のバッジ（卒/転 ＋ 未婚/既婚/離婚）
  var badges = '';
  if(m.memberType){
    badges += '<span class="vr-mem-badge ' + (m.memberType === '卒' ? 'grad' : 'trans') + '">' + m.memberType + '</span>';
  }
  if(m.marital){
    var mc = (m.marital === '離婚') ? 'rikon' : (m.marital === '既婚' ? 'kikon' : 'mikon');
    badges += '<span class="vr-mem-badge ' + mc + '">' + esc(m.marital) + '</span>';
  }
  return '<div class="vr-mem" onclick="vrOpenMemberProfile(\'' + m.id + '\')">'
       + '<div class="vr-mem-ava">' + ava + '</div>'
       + '<div class="vr-mem-info">'
       + '<div class="vr-mem-name">' + esc(m.nick) + badges + '</div>'
       + '<div class="vr-mem-sub">' + sub.join('') + '</div>'
       + '</div></div>';
}

// ============================================
// メンバープロフィール閲覧（他の卒業生）
// ============================================

var _vrViewMember = null; // 表示中メンバーの {id, nick, avatar}

/** メンバーのプロフィールを開く */
async function vrOpenMemberProfile(memberId){
  if(!memberId) return;
  var body = document.getElementById('vr-member-body');
  var modal = document.getElementById('vr-member-modal');
  if(!body || !modal) return;
  body.innerHTML = '<div class="vr-empty">読み込み中…</div>';
  modal.classList.add('show');
  try{
    var res = await supa.from('profiles')
      .select('id, nickname, sex, avatar_url, birth_year, birth_month, birth_day, member_id, interest_tags, pillar_year_k, pillar_year_s, pillar_month_k, pillar_month_s, pillar_day_k, pillar_day_s, pillar_hour_k, pillar_hour_s')
      .eq('id', memberId).single();
    if(res.error || !res.data){ body.innerHTML = '<div class="vr-empty">プロフィールを取得できませんでした。</div>'; return; }
    var p = res.data;
    _vrViewMember = { id: p.id, nick: p.nickname || '名無し', avatar: p.avatar_url || '' };
    body.innerHTML = vrMemberProfileHtml(p);
    vrFillHearts('vr-heart-member', p.id);
  }catch(e){
    console.log('vrOpenMemberProfile error:', e);
    body.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** メンバープロフィールを閉じる */
function vrCloseMemberProfile(){
  var modal = document.getElementById('vr-member-modal');
  if(modal) modal.classList.remove('show');
  _vrViewMember = null;
}

/** メンバープロフィールの中身 HTML */
function vrMemberProfileHtml(p){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var nick = p.nickname || '名無し';
  var nickInit = nick.charAt(0);
  var nowY = new Date().getFullYear();
  var age = p.birth_year ? (nowY - p.birth_year) + '歳' : '—';
  var hasHour = (p.pillar_hour_k != null && p.pillar_hour_s != null);
  var pillars = [
    { k: p.pillar_year_k || 0, s: p.pillar_year_s || 0 },
    { k: p.pillar_month_k || 0, s: p.pillar_month_s || 0 },
    { k: p.pillar_day_k || 0, s: p.pillar_day_s || 0 },
    hasHour ? { k: p.pillar_hour_k, s: p.pillar_hour_s } : null
  ];

  var html = '';
  // アバター
  html += '<div class="modal-ava">';
  if(p.avatar_url){ html += '<img src="' + esc(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else { html += '<span class="modal-ava-ph">' + esc(nickInit) + '</span>'; }
  html += '</div>';

  // ♡（画像とニックネームの間）
  html += '<div class="vr-heart-row" id="vr-heart-member"></div>';

  // 基本情報
  html += '<div style="margin-top:10px">';
  html += '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">' + esc(nick) + '</span></div>';
  html += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">' + esc(p.sex || '—') + '</span></div>';
  html += '<div class="modal-row"><span class="modal-lbl">年齢</span><span class="modal-val">' + age + '</span></div>';
  html += '</div>';

  // 興味のあるカテゴリー
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="vr-sec-title">興味のあるカテゴリー</div>';
  if(typeof renderInterestChipsReadonly === 'function'){ html += renderInterestChipsReadonly(p.interest_tags || null); }
  html += '</div>';

  // 命式＋十二運
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="vr-sec-title">命式</div>';
  html += renderVoicePillarsHtml(pillars);
  html += '</div>';

  // 会員ID
  html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">';
  html += '<div class="modal-row"><span class="modal-lbl">会員ID</span><span class="modal-val mono">' + esc(p.member_id || '—') + '</span></div>';
  html += '</div>';

  // メッセージを送る
  if(currentUser && p.id !== currentUser.id){
    html += '<button class="vr-mem-msg-btn" onclick="vrStartChatFromProfile()">メッセージを送る</button>';
  }
  return html;
}

/** プロフィールから「メッセージを送る」 */
function vrStartChatFromProfile(){
  if(!_vrViewMember) return;
  var m = _vrViewMember;
  vrCloseMemberProfile();
  vrGoTab('messages');
  vrOpenChat(m.id, m.nick, m.avatar);
}

// ============================================
// メッセージ（DM）
// ============================================

var _vrChatWith = null; // 現在チャット中の相手 {id, nick, avatar}

/** 会話一覧（やり取りした相手）を表示 */
async function vrLoadConversations(){
  var list = document.getElementById('vr-conv-list');
  if(!list) return;
  if(!currentUser){ list.innerHTML = '<div class="vr-empty">ログインが必要です。</div>'; return; }
  list.innerHTML = '<div class="vr-empty">読み込み中…</div>';
  try{
    var hidden = await loadHiddenUserIds();
    var res = await supa.from('graduate_messages')
      .select('*')
      .or('sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + currentUser.id)
      .order('created_at', { ascending: false });
    if(res.error){ list.innerHTML = '<div class="vr-empty">読み込みに失敗しました。</div>'; return; }
    // 相手ごとに最新メッセージ・未読数を集約
    var convs = {}; var order = [];
    (res.data || []).forEach(function(m){
      var other = (m.sender_id === currentUser.id) ? m.recipient_id : m.sender_id;
      if(hidden.has(other)) return;
      if(!convs[other]){
        convs[other] = { other: other, last: m, unread: 0 };
        order.push(other);
      }
      // 受信かつ未読
      if(m.recipient_id === currentUser.id && !m.read_at) convs[other].unread += 1;
    });
    if(!order.length){
      list.innerHTML = '<div class="vr-empty">✦<br>まだメッセージのやり取りがありません。<br>メンバーのプロフィールから送ってみましょう。</div>';
      return;
    }
    // 相手のプロフィール（名前・アバター）を取得
    var profs = {};
    var pr = await supa.from('profiles').select('id, nickname, avatar_url').in('id', order);
    (pr.data || []).forEach(function(p){ profs[p.id] = p; });
    list.innerHTML = order.map(function(oid){
      var cv = convs[oid]; var pf = profs[oid] || {};
      return vrConvCardHtml(cv, pf);
    }).join('');
  }catch(e){
    console.log('vrLoadConversations error:', e);
    list.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** 会話カード HTML */
function vrConvCardHtml(cv, pf){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var nick = pf.nickname || '名無し';
  var ava = pf.avatar_url ? '<img src="' + esc(pf.avatar_url) + '" alt="">' : '<span>' + esc(nick.charAt(0)) + '</span>';
  var when = (typeof formatRelative === 'function') ? formatRelative(cv.last.created_at) : '';
  var preview = (cv.last.sender_id === currentUser.id ? 'あなた: ' : '') + (cv.last.body || '');
  var avaUrl = pf.avatar_url || '';
  return '<div class="vr-conv" onclick="vrOpenChat(\'' + cv.other + '\',\'' + esc(nick).replace(/'/g, '') + '\',\'' + avaUrl + '\')">'
       + '<div class="vr-conv-ava">' + ava + '</div>'
       + '<div class="vr-conv-info"><div class="vr-conv-name">' + esc(nick) + '</div><div class="vr-conv-preview">' + esc(preview) + '</div></div>'
       + '<div class="vr-conv-meta"><div class="vr-conv-time">' + esc(when) + '</div>' + (cv.unread ? '<div class="vr-conv-unread"></div>' : '') + '</div>'
       + '</div>';
}

/** チャットを開く */
async function vrOpenChat(otherId, nick, avatarUrl){
  if(!otherId || !currentUser) return;
  _vrChatWith = { id: otherId, nick: nick || '名無し', avatar: avatarUrl || '' };
  // ビュー切替
  var lv = document.getElementById('vr-msg-list-view');
  var cv = document.getElementById('vr-msg-chat-view');
  if(lv) lv.style.display = 'none';
  if(cv) cv.style.display = 'block';
  // ヘッダー
  var nameEl = document.getElementById('vr-chat-name'); if(nameEl) nameEl.textContent = _vrChatWith.nick;
  var avaWrap = document.getElementById('vr-chat-ava');
  if(avaWrap){
    if(_vrChatWith.avatar){ avaWrap.innerHTML = '<img src="' + _vrChatWith.avatar + '" alt="">'; }
    else { avaWrap.innerHTML = '<span>' + (_vrChatWith.nick.charAt(0)) + '</span>'; }
  }
  await vrRenderChat();
  vrMarkChatRead();
  vrSyncGiveHeartBtn(otherId);
}

/** 「♡を贈る」ボタンの状態を同期（既に贈っていれば贈り済み表示） */
async function vrSyncGiveHeartBtn(partnerId){
  var btn = document.getElementById('vr-give-heart');
  if(!btn || !currentUser || !partnerId) return;
  btn.textContent = '♡を贈る'; btn.disabled = false; btn.classList.remove('given');
  try{
    var res = await supa.from('graduate_hearts').select('id', { count: 'exact', head: true })
      .eq('receiver_id', partnerId).eq('giver_id', currentUser.id).eq('source', 'dm');
    if(res && res.count){ btn.textContent = '♥ 贈り済み'; btn.disabled = true; btn.classList.add('given'); }
  }catch(e){}
}

/** DMの相手に♡を贈る（相手1人につき1回） */
async function vrGiveHeart(){
  if(!_vrChatWith || !currentUser) return;
  var btn = document.getElementById('vr-give-heart');
  try{
    var res = await supa.from('graduate_hearts').insert({ receiver_id: _vrChatWith.id, giver_id: currentUser.id, source: 'dm' });
    if(res.error){
      if(res.error.code === '23505'){ if(btn){ btn.textContent = '♥ 贈り済み'; btn.disabled = true; btn.classList.add('given'); } }
      else { alert('♡を贈れませんでした：' + (res.error.message || '')); }
      return;
    }
    if(btn){ btn.textContent = '♥ 贈りました'; btn.disabled = true; btn.classList.add('given'); }
  }catch(e){ console.log('vrGiveHeart error:', e); }
}

/** チャットを閉じて一覧へ戻る */
function vrCloseChat(){
  _vrChatWith = null;
  var lv = document.getElementById('vr-msg-list-view');
  var cv = document.getElementById('vr-msg-chat-view');
  if(cv) cv.style.display = 'none';
  if(lv) lv.style.display = 'block';
  vrLoadConversations();
}

/** チャット本文を描画 */
async function vrRenderChat(){
  var bodyEl = document.getElementById('vr-chat-body');
  if(!bodyEl || !_vrChatWith || !currentUser) return;
  try{
    var other = _vrChatWith.id;
    var res = await supa.from('graduate_messages')
      .select('*')
      .or('and(sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + other + '),and(sender_id.eq.' + other + ',recipient_id.eq.' + currentUser.id + ')')
      .order('created_at', { ascending: true });
    if(res.error){ bodyEl.innerHTML = '<div class="vr-empty">読み込みに失敗しました。</div>'; return; }
    var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
    bodyEl.innerHTML = (res.data || []).map(function(m){
      var mine = (m.sender_id === currentUser.id);
      var when = (typeof formatRelative === 'function') ? formatRelative(m.created_at) : '';
      var bodyHtml = (typeof linkifyText === 'function') ? linkifyText(m.body) : esc(m.body);
      return '<div class="vr-bubble ' + (mine ? 'me' : 'them') + '">' + bodyHtml + '<div class="vr-bubble-time">' + esc(when) + '</div></div>';
    }).join('');
    // 最下部へスクロール
    bodyEl.scrollIntoView(false);
    var sc = document.querySelector('#voice-wrap .vr-body');
    if(sc) sc.scrollTop = sc.scrollHeight;
  }catch(e){
    console.log('vrRenderChat error:', e);
    bodyEl.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** メッセージ送信 */
async function vrSendChatMessage(){
  if(!_vrChatWith || !currentUser) return;
  var input = document.getElementById('vr-chat-input');
  var body = input ? input.value.trim() : '';
  if(!body) return;
  try{
    var res = await supa.from('graduate_messages').insert({
      sender_id: currentUser.id, recipient_id: _vrChatWith.id, body: body
    });
    if(res.error){ alert('送信に失敗しました：' + (res.error.message || '')); return; }
    if(input) input.value = '';
    await vrRenderChat();
  }catch(e){ console.log('vrSendChatMessage error:', e); }
}

/** 開いているチャットの未読を既読化 */
async function vrMarkChatRead(){
  if(!_vrChatWith || !currentUser) return;
  try{
    await supa.from('graduate_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', currentUser.id)
      .eq('sender_id', _vrChatWith.id)
      .is('read_at', null);
  }catch(e){ console.log('vrMarkChatRead error:', e); }
}

/** DM の Realtime イベント処理 */
function vrOnDmEvent(payload){
  if(!(payload && payload.eventType === 'INSERT' && payload.new && currentUser)) return;
  var m = payload.new;
  // 自分が関与するメッセージのみ
  if(m.sender_id !== currentUser.id && m.recipient_id !== currentUser.id) return;
  var other = (m.sender_id === currentUser.id) ? m.recipient_id : m.sender_id;
  // チャットを開いている相手なら即追記＋既読化
  if(_vrChatWith && _vrChatWith.id === other){
    vrRenderChat();
    if(m.recipient_id === currentUser.id) vrMarkChatRead();
  }
  // メッセージ一覧表示中なら更新
  var msgPage = document.getElementById('vr-page-messages');
  var listView = document.getElementById('vr-msg-list-view');
  if(msgPage && msgPage.classList.contains('on') && listView && listView.style.display !== 'none'){
    vrLoadConversations();
  }
}

// ============================================
// その他：種族別の間（人間味 / 効率族 / 気分屋）
// ============================================

/** 間の定義（juns は表示順。種族判定は VR_TRIBE_BY_JUN で行うため順序は表示専用） */
var VR_ROOMS = {
  humanity: {
    name: '人間味の間', juns: ['冠帯','墓','養','衰'],
    feature: '人間味や人柄を重視',
    points: [
      '話し方は「1から順を追って最後に結論」(結論より過程が大事)',
      'ゆえに「何で？」「どうして？」が口癖',
      '絵文字多め(絵文字がないと気持ちが伝わらないと思う)'
    ]
  },
  efficiency: {
    name: '効率族の間', juns: ['長生','病','胎','帝旺'],
    feature: '効率、メリットデメリット、損得を重視',
    points: [
      '話し方は「結論が最初でその後に理由と過程を最小限」(過程より結論が大事)',
      'ゆえに「で？」が口癖(結論を聞きたい)',
      '絵文字は少なめ(文字、文脈で気持ちも伝わると思う)'
    ]
  },
  mood: {
    name: '気分屋の間', juns: ['沐浴','死','絶','建禄'],
    feature: 'その時の気分、気持ち、直感を重視',
    points: [
      '話し方は「思いついた順で飛び飛び」(今思い出したこと、頭に浮かんだことが大事)',
      '「やば！」「超〇〇〜！」が口癖(リアクションが大きめ)',
      '絵文字は気分次第(気分がいい時・好きな相手→多め / 気分が落ちてる時・苦手な相手→なし)'
    ]
  }
};
/** 十二運 → 種族(room) の対応 */
var VR_TRIBE_BY_JUN = {
  '冠帯':'humanity','衰':'humanity','墓':'humanity','養':'humanity',
  '長生':'efficiency','帝旺':'efficiency','病':'efficiency','胎':'efficiency',
  '沐浴':'mood','建禄':'mood','死':'mood','絶':'mood'
};

var _vrCurrentRoom = null; // 表示中の間（room key）

/** 自分の種族（日柱の十二運から判定） @returns {string|null} */
function vrMyTribe(){
  if(typeof MY_PILLARS === 'undefined' || !Array.isArray(MY_PILLARS)) return null;
  var day = MY_PILLARS[2];
  if(!day || day.k == null || day.s == null || typeof juniun !== 'function') return null;
  var jun = juniun(day.k, day.s);
  return VR_TRIBE_BY_JUN[jun] || null;
}

/** その他サブメニュー（ドロップダウン）の開閉 */
function vrToggleOtherMenu(e){
  if(e && e.stopPropagation) e.stopPropagation();
  var m = document.getElementById('vr-sub-menu');
  if(m) m.classList.toggle('show');
}
function vrCloseOtherMenu(){
  var m = document.getElementById('vr-sub-menu');
  if(m) m.classList.remove('show');
}

/** 間を開く（閲覧は誰でも可） */
async function vrOpenRoom(room){
  if(!VR_ROOMS[room]) return;
  vrCloseOtherMenu();
  _vrCurrentRoom = room;
  vrGoTab('other'); // 間ページを表示＋「その他」タブをアクティブに
  var nameEl = document.getElementById('vr-room-name');
  if(nameEl) nameEl.textContent = VR_ROOMS[room].name;
  var descEl = document.getElementById('vr-room-desc');
  if(descEl){
    var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
    var r = VR_ROOMS[room];
    var mine = (vrMyTribe() === room);
    var pts = (r.points || []).map(function(p){ return '・' + esc(p); }).join('<br>');
    descEl.innerHTML = '十二運が <strong>' + r.juns.join('・') + '</strong> の方の間です。'
      + '<div class="vr-room-feature"><strong>特徴 : ' + esc(r.feature || '') + '</strong></div>'
      + (pts ? '<div class="vr-room-points">' + pts + '</div>' : '')
      + '<span class="vr-room-note">どなたでも閲覧できます。発言できるのは' + (mine ? '<strong>あなたも含むこの間の方</strong>です。' : 'この間に属する方のみです。') + '</span>';
  }
  await vrLoadRoom(room);
}

/** 間を閉じて近況へ戻る */
function vrCloseRoom(){
  _vrCurrentRoom = null;
  vrGoTab('feed');
}

/** 間のメッセージを読み込み・描画 */
async function vrLoadRoom(room){
  var bodyEl = document.getElementById('vr-room-body');
  if(!bodyEl) return;
  try{
    var hidden = await loadHiddenUserIds();
    var res = await supa.from('graduate_room_messages')
      .select('*').eq('room', room).order('created_at', { ascending: true }).limit(300);
    if(res.error){ bodyEl.innerHTML = '<div class="vr-empty">読み込みに失敗しました。</div>'; return; }
    var msgs = (res.data || []).filter(function(m){ return !hidden.has(m.user_id); });
    if(!msgs.length){
      bodyEl.innerHTML = '<div class="vr-empty">✦<br>まだ発言がありません。</div>';
    }else{
      bodyEl.innerHTML = msgs.map(vrRoomMsgHtml).join('');
    }
    var sc = document.querySelector('#voice-wrap .vr-body');
    if(sc) sc.scrollTop = sc.scrollHeight;
  }catch(e){
    console.log('vrLoadRoom error:', e);
    bodyEl.innerHTML = '<div class="vr-empty">読み込みエラー</div>';
  }
}

/** 間のメッセージ1件 HTML */
function vrRoomMsgHtml(m){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var mine = (currentUser && m.user_id === currentUser.id);
  var nick = m.nickname || '名無し';
  var when = (typeof formatRelative === 'function') ? formatRelative(m.created_at) : '';
  var ava = m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" alt="">' : '<span>' + esc(nick.charAt(0)) + '</span>';
  var bodyHtml = (typeof linkifyText === 'function') ? linkifyText(m.body) : esc(m.body);
  return '<div class="vr-rmsg' + (mine ? ' me' : '') + '">'
       + '<div class="vr-rmsg-ava">' + ava + '</div>'
       + '<div class="vr-rmsg-main">'
       + (mine ? '' : '<div class="vr-rmsg-name">' + esc(nick) + '</div>')
       + '<div class="vr-rmsg-bubble">' + bodyHtml + '</div>'
       + '<div class="vr-rmsg-time">' + esc(when) + '</div>'
       + '</div></div>';
}

/** 間で発言（自分の種族の間のみ） */
async function vrSendRoomMessage(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  if(!_vrCurrentRoom) return;
  // 種族チェック（クライアント側）。違えばポップアップ
  if(vrMyTribe() !== _vrCurrentRoom){
    alert('種族が違うため、この間での発言はできません');
    return;
  }
  var input = document.getElementById('vr-room-input');
  var body = input ? input.value.trim() : '';
  if(!body) return;
  try{
    var p = window._profileModalData || {};
    var res = await supa.from('graduate_room_messages').insert({
      room: _vrCurrentRoom, user_id: currentUser.id,
      member_id: p.member_id || null, nickname: p.nickname || null, avatar_url: p.avatar_url || null,
      body: body
    });
    if(res.error){
      // RLS で弾かれた場合（種族違い等）も同じ案内
      alert('種族が違うため、この間での発言はできません');
      return;
    }
    if(input) input.value = '';
    await vrLoadRoom(_vrCurrentRoom);
  }catch(e){ console.log('vrSendRoomMessage error:', e); }
}

/** 間メッセージの Realtime 反映 */
function vrOnRoomEvent(payload){
  if(!(payload && payload.eventType === 'INSERT' && payload.new)) return;
  // 表示中の間と一致すれば再描画
  if(_vrCurrentRoom && payload.new.room === _vrCurrentRoom){
    vrLoadRoom(_vrCurrentRoom);
  }
}

// その他サブメニュー（ドロップダウン）を外側クリックで閉じる
document.addEventListener('click', function(e){
  if(!e.target.closest('#vr-other-tab')){ vrCloseOtherMenu(); }
});

// ============================================
// 近況：アンケート機能
// ============================================

var _vrSurveyOptCount = 2; // 表示中の選択肢数（2-4）

/** 自分の属性（対象判定用）：性別・年齢・日柱十二運 */
function vrMyAttrs(){
  var p = window._profileModalData || {};
  var age = p.birth_year ? (new Date().getFullYear() - p.birth_year) : null;
  var dj = '';
  if(typeof MY_PILLARS !== 'undefined' && Array.isArray(MY_PILLARS) && MY_PILLARS[2] && typeof juniun === 'function'){
    dj = juniun(MY_PILLARS[2].k, MY_PILLARS[2].s) || '';
  }
  return { sex: p.sex || '', age: age, juniun: dj };
}

/** 対象条件に自分が合致するか */
function vrSurveyMatches(target){
  if(!target) return true;
  var me = vrMyAttrs();
  if(target.sex && me.sex !== target.sex) return false;
  if(target.ageMin != null && (me.age == null || me.age < target.ageMin)) return false;
  if(target.ageMax != null && (me.age == null || me.age > target.ageMax)) return false;
  if(target.juniun && target.juniun.length && target.juniun.indexOf(me.juniun) < 0) return false;
  return true;
}

/** 対象のラベル文字列 */
function vrSurveyTargetLabel(t){
  if(!t) return '全員';
  var parts = [];
  if(t.sex) parts.push(t.sex);
  if(t.ageMin != null || t.ageMax != null) parts.push((t.ageMin != null ? t.ageMin : '') + '〜' + (t.ageMax != null ? t.ageMax : '') + '歳');
  if(t.juniun && t.juniun.length) parts.push(t.juniun.join('/'));
  return parts.length ? parts.join('・') : '全員';
}

/** アンケート作成モーダルを開く */
function vrOpenSurvey(){
  var ti = document.getElementById('vr-survey-title'); if(ti) ti.value = '';
  for(var i = 0; i < 4; i++){
    var o = document.getElementById('vr-survey-opt-' + i);
    if(o){ o.value = ''; o.style.display = (i < 2) ? 'block' : 'none'; }
  }
  _vrSurveyOptCount = 2;
  var add = document.getElementById('vr-survey-addopt'); if(add) add.style.display = 'none';
  var panel = document.getElementById('vr-survey-target-panel'); if(panel) panel.style.display = 'none';
  var sexAll = document.querySelector('#vr-survey-modal input[name="vr-stg-sex"][value=""]'); if(sexAll) sexAll.checked = true;
  var amin = document.getElementById('vr-stg-agemin'); if(amin) amin.value = '';
  var amax = document.getElementById('vr-stg-agemax'); if(amax) amax.value = '';
  vrBuildSurveyTypes();
  vrSurveyTargetChanged();
  var m = document.getElementById('vr-survey-modal'); if(m) m.classList.add('show');
}
function vrCloseSurvey(){ var m = document.getElementById('vr-survey-modal'); if(m) m.classList.remove('show'); }
function vrToggleSurveyTarget(){ var p = document.getElementById('vr-survey-target-panel'); if(p) p.style.display = (p.style.display === 'none') ? 'block' : 'none'; }

/** タイプ×十二運のチェックボックスを生成 */
function vrBuildSurveyTypes(){
  var cont = document.getElementById('vr-stp-types');
  if(!cont) return;
  var names = { humanity:'人間味タイプ', efficiency:'効率族タイプ', mood:'気分屋タイプ' };
  var html = '';
  ['humanity','efficiency','mood'].forEach(function(t){
    var juns = (VR_ROOMS[t] && VR_ROOMS[t].juns) ? VR_ROOMS[t].juns : [];
    html += '<div class="vr-stp-type">';
    html += '<label class="vr-stp-type-hd"><input type="checkbox" class="vr-stp-type-all" data-type="' + t + '" onchange="vrSurveyToggleType(this)"> ' + names[t] + '</label>';
    html += '<div class="vr-stp-juniun">';
    juns.forEach(function(j){
      html += '<label><input type="checkbox" class="vr-stp-jun" value="' + j + '" onchange="vrSurveyTargetChanged()">' + j + '</label>';
    });
    html += '</div></div>';
  });
  cont.innerHTML = html;
}
/** タイプ見出しチェックでそのタイプの十二運を一括ON/OFF */
function vrSurveyToggleType(cb){
  var t = cb.getAttribute('data-type');
  var juns = (VR_ROOMS[t] && VR_ROOMS[t].juns) ? VR_ROOMS[t].juns : [];
  document.querySelectorAll('#vr-stp-types .vr-stp-jun').forEach(function(j){
    if(juns.indexOf(j.value) >= 0) j.checked = cb.checked;
  });
  vrSurveyTargetChanged();
}

/** 現在の対象条件オブジェクトを取得 */
function vrGetSurveyTarget(){
  var sexEl = document.querySelector('#vr-survey-modal input[name="vr-stg-sex"]:checked');
  var sex = sexEl ? sexEl.value : '';
  var aMin = (document.getElementById('vr-stg-agemin') || {}).value || '';
  var aMax = (document.getElementById('vr-stg-agemax') || {}).value || '';
  var juniun = [];
  document.querySelectorAll('#vr-stp-types .vr-stp-jun:checked').forEach(function(j){ juniun.push(j.value); });
  return {
    sex: sex || null,
    ageMin: aMin !== '' ? parseInt(aMin, 10) : null,
    ageMax: aMax !== '' ? parseInt(aMax, 10) : null,
    juniun: juniun
  };
}
/** 対象ボタンのラベルを更新 */
function vrSurveyTargetChanged(){
  var btn = document.getElementById('vr-survey-target-btn');
  if(btn) btn.textContent = '🎯 対象：' + vrSurveyTargetLabel(vrGetSurveyTarget());
}

/** 選択肢入力時：＋ボタンの表示制御 */
function _vrSurveyOptVal(i){ var o = document.getElementById('vr-survey-opt-' + i); return o ? o.value.trim() : ''; }
function vrSurveyOptInput(){
  var add = document.getElementById('vr-survey-addopt');
  if(!add) return;
  var allFilled = true;
  for(var i = 0; i < _vrSurveyOptCount; i++){ if(!_vrSurveyOptVal(i)){ allFilled = false; break; } }
  add.style.display = (allFilled && _vrSurveyOptCount < 4) ? 'block' : 'none';
}
/** 選択肢を1つ増やす */
function vrSurveyAddOption(){
  if(_vrSurveyOptCount >= 4) return;
  var o = document.getElementById('vr-survey-opt-' + _vrSurveyOptCount);
  if(o) o.style.display = 'block';
  _vrSurveyOptCount++;
  var add = document.getElementById('vr-survey-addopt'); if(add) add.style.display = 'none';
}

/** アンケートを投稿 */
async function vrSubmitSurvey(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var title = (document.getElementById('vr-survey-title') || {}).value;
  title = title ? title.trim() : '';
  if(!title){ alert('題名を入力してください'); return; }
  var options = [];
  for(var i = 0; i < _vrSurveyOptCount; i++){ var v = _vrSurveyOptVal(i); if(v) options.push(v); }
  if(options.length < 2){ alert('選択肢を2つ以上入力してください'); return; }
  var target = vrGetSurveyTarget();
  var btn = document.getElementById('vr-survey-submit');
  if(btn){ btn.disabled = true; btn.textContent = '投稿中...'; }
  try{
    var p = window._profileModalData || {};
    var ins = await supa.from('graduate_posts').insert({
      user_id: currentUser.id, member_id: p.member_id || null, nickname: p.nickname || null, avatar_url: p.avatar_url || null,
      body: title, post_type: 'survey', survey: { title: title, options: options, target: target }
    });
    if(ins.error){ alert('投稿に失敗しました：' + (ins.error.message || '')); return; }
    vrCloseSurvey();
    vrGoTab('feed');
    vrRenderFeed();
  }catch(e){ console.log('vrSubmitSurvey error:', e); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = '投稿する'; } }
}

/** アンケート投稿のHTML（フィード内） */
function vrSurveyBlockHtml(post, meta){
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s==null?'':s); };
  var s = post.survey || {};
  var opts = s.options || [];
  var counts = (meta && meta.surveyCounts[post.id]) || {};
  var total = (meta && meta.surveyTotal[post.id]) || 0;
  var mine = (meta && (post.id in meta.surveyMine)) ? meta.surveyMine[post.id] : null;
  var answered = (mine !== null && mine !== undefined);
  var isCreator = (currentUser && post.user_id === currentUser.id);
  var eligible = vrSurveyMatches(s.target);              // プロフィールから対象か自動判定
  // 結果(%バー)を出すのは：回答済 / 作成者 / 対象外（対象外は最初から結果のみ）
  var showResults = answered || isCreator || !eligible;
  var h = '<div class="vr-survey-target-tag">📊 対象：' + esc(vrSurveyTargetLabel(s.target)) + '</div>';
  h += '<div class="vr-survey-q">' + esc(s.title || '') + '</div>';
  opts.forEach(function(opt, idx){
    var c = counts[idx] || 0;
    var pct = total ? Math.round(c / total * 100) : 0;
    if(showResults){
      h += '<div class="vr-survey-choice' + (mine === idx ? ' mine' : '') + (!eligible && !answered && !isCreator ? ' locked' : '') + '">'
         + '<div class="vr-survey-bar" style="width:' + pct + '%"></div>'
         + '<div class="vr-survey-ctext"><span>' + esc(opt) + (mine === idx ? ' ✓' : '') + '</span><span>' + pct + '%（' + c + '）</span></div>'
         + '</div>';
    }else{
      h += '<button type="button" class="vr-survey-choice" onclick="vrAnswerSurvey(\'' + post.id + '\',' + idx + ')"><div class="vr-survey-ctext"><span>' + esc(opt) + '</span></div></button>';
    }
  });
  var metaText;
  if(!eligible && !answered && !isCreator) metaText = '🚫 対象外のため回答できません（結果のみ表示）';
  else if(showResults) metaText = total + '人が回答';
  else metaText = '回答すると♡がもらえます';
  h += '<div class="vr-survey-meta">' + metaText + '</div>';
  return h;
}

/** アンケートに回答（回答で♡が付与される＝トリガー） */
async function vrAnswerSurvey(postId, idx){
  if(!currentUser){ alert('ログインが必要です'); return; }
  try{
    var res = await supa.from('graduate_survey_answers').insert({ post_id: postId, user_id: currentUser.id, choice_index: idx });
    if(res.error && res.error.code !== '23505'){ alert('回答に失敗しました：' + (res.error.message || '')); return; }
    vrRenderFeed();
  }catch(e){ console.log('vrAnswerSurvey error:', e); }
}
