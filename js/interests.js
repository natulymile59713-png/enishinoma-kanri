// ===== UI: 興味のあるカテゴリー（タグ）選択 =====
// 12 カテゴリ × 各 10〜19 項目（合計約 175 項目）
// 各カテゴリにユーザー任意で1ワード追加可（10文字以内）
// 最大30個まで選択、うち最大5個を「外せない」=highlighted で強調

/** カテゴリ定義 */
var INTEREST_CATEGORIES = [
  { key: 'sports', name: '🏃 アウトドア・スポーツ', tags: [
    'ハイキング/登山','ランニング','ウォーキング','サイクリング','ヨガ','ピラティス','ジム/筋トレ','ゴルフ','テニス','バドミントン','サーフィン','ダイビング','スキー/スノボ','釣り','キャンプ','ボルダリング'
  ]},
  { key: 'indoor', name: '📖 インドア・ホビー', tags: [
    '読書','映画鑑賞','ドラマ鑑賞','アニメ','漫画','オタク','ゲーム','eスポーツ','写真撮影','アート/絵画','DIY/ハンドメイド','プログラミング','ボードゲーム','楽器演奏','鉄道'
  ]},
  { key: 'food', name: '🍽 グルメ・お酒', tags: [
    'カフェ巡り','食べ歩き','自炊/料理','ワイン','日本酒','クラフトビール','焼酎','カクテル/バー','焼肉','お寿司','ラーメン','パン/ベーカリー','スイーツ','韓国料理','エスニック料理'
  ]},
  { key: 'travel', name: '✈️ 旅行・お出かけ', tags: [
    '国内旅行','海外旅行','温泉','秘湯','ドライブ','一人旅','街歩き','離島','グランピング','神社仏閣巡り','城跡巡り','鉄道旅'
  ]},
  { key: 'culture', name: '🎵 エンタメ・カルチャー', tags: [
    'ライブ/フェス','ミュージカル','演劇','K-POP','邦楽','洋楽','J-POP','ジャズ','クラシック','ヒップホップ','ロック','EDM','YouTube視聴','Netflix','Amazon Prime','ポッドキャスト'
  ]},
  { key: 'lifestyle', name: '🐾 ライフスタイル', tags: [
    '犬好き','猫好き','小動物好き','インテリア好き','ガーデニング','観葉植物','健康志向','オーガニック','ミニマリスト','サウナ','スパ/温泉','朝活','夜型','アロマ','スピリチュアル'
  ]},
  { key: 'study', name: '📚 学び・自己研鑽', tags: [
    '英語学習','中国語学習','韓国語学習','資格勉強','ビジネス書','投資/経済','株/FX','仮想通貨','歴史','心理学','哲学','占い','スピリチュアル(学び)','MBA志向','読書会'
  ]},
  { key: 'date', name: '💑 デートでしたいこと', tags: [
    '水族館','動物園','美術館','博物館','テーマパーク','花火大会','イルミネーション','ピクニック','紅葉狩り','桜見','夜景デート','クリスマス市場',
    'おうちデート','ドライブ','神社巡り','カフェ巡り(デート)','グルメ巡り','ショッピング','居酒屋で飲み'
  ]},
  { key: 'values', name: '🏠 価値観・性格', tags: [
    'アウトドア派','インドア派','のんびり派','アクティブ派','真面目','ユーモア重視','自然体','ロマンチスト','計画的','思いつき派','一途','寛容','慎重派','楽天家','努力家',
    '気分屋','相手優先','効率重視','損得勘定'
  ]},
  { key: 'marriage', name: '💍 結婚・家族観', tags: [
    '結婚を真剣に考えたい','子供を持ちたい','家庭を大事にしたい','共働き希望','専業/専業主夫希望','親と同居OK','ペットと暮らしたい','田舎暮らし志向','都会派','海外移住に興味'
  ]},
  { key: 'career', name: '💼 仕事・キャリア', tags: [
    'キャリア志向','ワークライフバランス重視','起業/独立志向','転職経験あり','リモートワーカー','フリーランス','公務員','医療系','IT系','クリエイティブ系','経営/管理職','専門職'
  ]},
  { key: 'mind', name: '🌍 価値観・関心', tags: [
    '旅行好き','知的好奇心旺盛','環境意識','社会貢献に興味','ボランティア活動','ジェンダー平等','多文化共生','動物愛護','サステナブル','アート/美意識','シンプル志向','ファミリー重視'
  ]},
];

var INTEREST_MAX_SELECT = 30;
var INTEREST_MAX_HIGHLIGHT = 5;
var INTEREST_CUSTOM_MAXLEN = 10;

/** 編集用 state（モーダル内で更新する作業領域） */
var _interestEditState = null;

/** state を初期化（既存値 or 空） @param {object|null} existing */
function initInterestEditState(existing){
  var src = existing && typeof existing === 'object' ? existing : {};
  _interestEditState = {
    selected: Array.isArray(src.selected) ? src.selected.slice() : [],
    highlighted: Array.isArray(src.highlighted) ? src.highlighted.slice() : [],
    custom: (src.custom && typeof src.custom === 'object') ? Object.assign({}, src.custom) : {}
  };
}

/** 現在の編集 state を返す（保存用） */
function getInterestEditState(){ return _interestEditState || { selected:[], highlighted:[], custom:{} }; }

/** タグ選択トグル */
function toggleInterestTag(tag){
  var s = _interestEditState;
  if(!s) return;
  var idx = s.selected.indexOf(tag);
  if(idx >= 0){
    s.selected.splice(idx, 1);
    var hIdx = s.highlighted.indexOf(tag);
    if(hIdx >= 0) s.highlighted.splice(hIdx, 1);
  }else{
    if(s.selected.length >= INTEREST_MAX_SELECT){
      alert('最大' + INTEREST_MAX_SELECT + '個までです');
      return;
    }
    s.selected.push(tag);
  }
  renderInterestSelector();
}

/** 強調(外せない) トグル */
function toggleInterestHighlight(tag, ev){
  if(ev){ ev.stopPropagation(); }
  var s = _interestEditState;
  if(!s) return;
  if(s.selected.indexOf(tag) < 0){
    alert('まず選択してください');
    return;
  }
  var idx = s.highlighted.indexOf(tag);
  if(idx >= 0){
    s.highlighted.splice(idx, 1);
  }else{
    if(s.highlighted.length >= INTEREST_MAX_HIGHLIGHT){
      alert('強調できるのは最大' + INTEREST_MAX_HIGHLIGHT + '個までです');
      return;
    }
    s.highlighted.push(tag);
  }
  renderInterestSelector();
}

/** カスタム入力を反映（カテゴリkey別、10文字制限） */
function applyInterestCustomInput(catName, input){
  var s = _interestEditState;
  if(!s) return;
  var val = (input.value || '').trim().substring(0, INTEREST_CUSTOM_MAXLEN);
  var prevCustom = s.custom[catName] || null;
  if(prevCustom && prevCustom !== val){
    // 旧カスタムワードを selected から外す
    var pi = s.selected.indexOf(prevCustom); if(pi >= 0) s.selected.splice(pi, 1);
    var hi = s.highlighted.indexOf(prevCustom); if(hi >= 0) s.highlighted.splice(hi, 1);
  }
  if(val){
    s.custom[catName] = val;
    if(s.selected.indexOf(val) < 0){
      if(s.selected.length >= INTEREST_MAX_SELECT){
        alert('最大' + INTEREST_MAX_SELECT + '個までです');
        delete s.custom[catName];
        input.value = '';
        renderInterestSelector();
        return;
      }
      s.selected.push(val);
    }
  }else{
    delete s.custom[catName];
  }
  renderInterestSelector();
}

/** セレクタを描画。.interest-selector-body 要素すべてに同じ内容を反映
 *  (登録フォーム + 編集モーダルの両方に同じ ID を使うと衝突するため class 指定) */
function renderInterestSelector(){
  var containers = document.querySelectorAll('.interest-selector-body');
  if(!containers || containers.length === 0) return;
  var s = _interestEditState;
  if(!s) return;
  var html = '';
  // カウンター
  html += '<div style="font-size:11px;color:var(--color-text-secondary);text-align:center;margin-bottom:10px;line-height:1.7">';
  html += '選択中: <strong style="color:#C9A96E">' + s.selected.length + ' / ' + INTEREST_MAX_SELECT + '</strong>　／　外せない⭐: <strong style="color:#C05050">' + s.highlighted.length + ' / ' + INTEREST_MAX_HIGHLIGHT + '</strong>';
  html += '</div>';

  INTEREST_CATEGORIES.forEach(function(cat){
    html += '<div style="margin-bottom:14px;border:0.5px solid var(--color-border-tertiary);border-radius:8px;padding:10px 12px">';
    html += '<div style="font-size:12px;color:#C9A96E;font-weight:500;margin-bottom:8px">' + cat.name + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    cat.tags.forEach(function(tag){
      var on = s.selected.indexOf(tag) >= 0;
      var hi = s.highlighted.indexOf(tag) >= 0;
      var chipStyle = on
        ? 'background:#C9A96E;color:#fff;border:1px solid #C9A96E'
        : 'background:transparent;color:var(--color-text-secondary);border:0.5px solid var(--color-border-tertiary)';
      var safe = tag.replace(/'/g, "\\'");
      html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:5px 10px;border-radius:14px;cursor:pointer;'+chipStyle+'" onclick="toggleInterestTag(\''+safe+'\')">';
      html += escapeHtml(tag);
      if(on){
        html += '<span style="font-size:10px;'+(hi?'color:#fff':'color:rgba(255,255,255,.5)')+';cursor:pointer" onclick="event.stopPropagation();toggleInterestHighlight(\''+safe+'\',event)" title="外せない⭐">'+(hi?'⭐':'☆')+'</span>';
      }
      html += '</span>';
    });
    html += '</div>';
    // カスタム入力（flex で input が縮まないバグ対策で min-width:0 + box-sizing:border-box）
    var customVal = s.custom[cat.name] || '';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">';
    html += '<label style="font-size:10px;color:var(--color-text-tertiary);white-space:nowrap;flex-shrink:0">+その他(10文字以内):</label>';
    html += '<input type="text" maxlength="'+INTEREST_CUSTOM_MAXLEN+'" value="'+escapeHtml(customVal)+'" placeholder="自由記述" style="flex:1;min-width:0;max-width:100%;box-sizing:border-box;font-size:11px;padding:5px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;background:var(--color-background-secondary);color:var(--color-text-primary)" onblur="applyInterestCustomInput(\''+cat.name.replace(/'/g,"\\'")+'\',this)">';
    html += '</div>';
    html += '</div>';
  });
  for(var i=0;i<containers.length;i++){ containers[i].innerHTML = html; }
}

/** プロフィールモーダル等で読み取り専用で表示する HTML */
function renderInterestChipsReadonly(tagsObj){
  var s = tagsObj || { selected:[], highlighted:[], custom:{} };
  if(!s.selected || s.selected.length === 0){
    return '<div style="font-size:11px;color:var(--color-text-tertiary);background:var(--color-background-secondary);border-radius:6px;padding:8px 10px;text-align:center">未設定</div>';
  }
  var customSet = {};
  Object.keys(s.custom || {}).forEach(function(k){ customSet[s.custom[k]] = true; });
  var html = '<div style="display:flex;flex-wrap:wrap;gap:5px">';
  s.selected.forEach(function(tag){
    var hi = (s.highlighted || []).indexOf(tag) >= 0;
    var custom = !!customSet[tag];
    var bg = hi ? '#C05050' : (custom ? '#9966CC' : '#C9A96E');
    html += '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:4px 9px;border-radius:12px;background:'+bg+';color:#fff">';
    if(hi) html += '⭐';
    html += escapeHtml(tag);
    html += '</span>';
  });
  html += '</div>';
  return html;
}

// ===== 興味タグ編集モーダル =====
/** 編集モーダルを開く（自分のプロフィール用） */
async function openInterestEdit(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  // 現在値を取得
  try{
    var{data:prof}=await supa.from('profiles').select('interest_tags').eq('id',currentUser.id).single();
    initInterestEditState(prof && prof.interest_tags ? prof.interest_tags : null);
  }catch(e){
    initInterestEditState(null);
  }
  renderInterestSelector();
  document.getElementById('interest-edit-modal').classList.add('show');
}

/** モーダルを閉じる */
function closeInterestEdit(){
  document.getElementById('interest-edit-modal').classList.remove('show');
}

/** 編集内容を保存（自分のプロフィール用） */
async function saveInterestEdit(){
  if(!currentUser){ alert('ログインが必要です'); return; }
  var btn = document.getElementById('interest-save-btn');
  if(btn){ btn.disabled = true; btn.textContent = '保存中...'; }
  try{
    var payload = getInterestEditState();
    var{error}=await supa.from('profiles').update({ interest_tags: payload }).eq('id', currentUser.id);
    if(error){
      alert('保存に失敗しました: ' + error.message);
      if(btn){ btn.disabled = false; btn.textContent = '保存する'; }
      return;
    }
    closeInterestEdit();
    // プロフィールモーダル内の表示を更新
    if(typeof refreshProfileInterestSection === 'function') refreshProfileInterestSection(payload);
  }catch(e){
    console.log('saveInterestEdit error:', e);
    alert('エラーが発生しました');
  }
  if(btn){ btn.disabled = false; btn.textContent = '保存する'; }
}

/** プロフィールモーダルの興味タグ表示を更新 */
function refreshProfileInterestSection(tagsObj){
  var sec = document.getElementById('profile-interest-section');
  if(!sec) return;
  var html = '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between"><span>興味のあるカテゴリー</span><button onclick="openInterestEdit()" style="font-size:10px;padding:3px 10px;border:0.5px solid #C9A96E;border-radius:6px;color:#C9A96E;background:transparent;cursor:pointer;font-family:inherit">＋ 編集</button></div>';
  html += renderInterestChipsReadonly(tagsObj);
  sec.innerHTML = html;
}

// ===== 新規登録時の使用補助 =====
/** 新規登録フォーム内のセレクタを初期化（任意・スキップ可） */
function initInterestRegSection(){
  initInterestEditState(null);
  renderInterestSelector();
}

/** 新規登録フォームで「スキップ」ボタン押下時の処理 */
function skipInterestReg(){
  initInterestEditState(null);
  var sec = document.getElementById('interest-reg-section');
  if(sec) sec.style.display = 'none';
  var skipNote = document.getElementById('interest-reg-skipped');
  if(skipNote) skipNote.style.display = 'block';
}
