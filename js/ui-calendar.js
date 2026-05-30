// ===== UI: 運勢カレンダー =====
// 自分の3柱（日支・月支・年支）と暦の月支・日支との組み合わせから月単位・日単位の運勢を読み解く
//   - プライベート面 = 自分の日支 vs 暦の支
//   - 家族面         = 自分の月支 vs 暦の支
//   - 社会面         = 自分の年支 vs 暦の支

// 状態
var calCurrentYear = null;
var calCurrentMonth = null;

// 関係マークと名称
var REL_MARKS = { sango: '◎', shigo: '〇', chu: '△', kei: '×' };
var REL_NAMES = { sango: '三合（半会）', shigo: '支合', chu: '冲', kei: '刑' };

// ドメイン定義
// MY_PILLARS[0]=年柱(年支), [1]=月柱(月支), [2]=日柱(日支), [3]=時柱（使用せず）
var DOMAIN_INFO = {
  priv: { label: 'プライベート面', sourceLabel: '自分の日支', userPillarIdx: 2 },
  fam:  { label: '家族面',         sourceLabel: '自分の月支', userPillarIdx: 1 },
  soc:  { label: '社会面',         sourceLabel: '自分の年支', userPillarIdx: 0 }
};
var DOMAIN_KEYS = ['priv','fam','soc']; // 表示順

// ===== ペアごとの解釈データ（変わらず） =====
var BRANCH_PAIR_DETAILS = {
  sango: {
    '0_4':  { name: '子辰', element: '水', hint: '水のエネルギーが活性化。知性・情報・人脈が広がる流れ' },
    '0_8':  { name: '子申', element: '水', hint: '水のエネルギーが活性化。柔軟性と機転が冴える流れ' },
    '3_7':  { name: '卯未', element: '木', hint: '木のエネルギーが活性化。穏やかな成長と人間関係の調和' },
    '3_11': { name: '卯亥', element: '木', hint: '木のエネルギーが活性化。直感や芸術性が伸びる流れ' },
    '2_6':  { name: '寅午', element: '火', hint: '火のエネルギーが活性化。情熱・行動力が高まる流れ' },
    '6_10': { name: '午戌', element: '火', hint: '火のエネルギーが活性化。注目を集めやすく成果が認められる流れ' },
    '5_9':  { name: '巳酉', element: '金', hint: '金のエネルギーが活性化。判断力・分析力が冴え、財運に吉' },
    '1_9':  { name: '丑酉', element: '金', hint: '金のエネルギーが活性化。現実的な成果が出やすい流れ' }
  },
  shigo: {
    '0_1':  { name: '子丑', hint: '土と水の和合。地に足のついた信頼関係・家庭運' },
    '2_11': { name: '寅亥', hint: '水と木の和合。挑戦への支えが得られ、メンター運' },
    '3_10': { name: '卯戌', hint: '火と木の和合。情熱と感性のバランス・芸術的協業' },
    '4_9':  { name: '辰酉', hint: '金と土の和合。実務での協力関係・パートナー運' },
    '5_8':  { name: '巳申', hint: '支合と刑が同居する両刃の関係。協力すれば大きな成果、こじれれば大トラブル' },
    '6_7':  { name: '午未', hint: '火の和合。明るく賑やかなご縁・人気運' }
  },
  chu: {
    '0_6':  { name: '子午', hint: '水と火のぶつかり合い。住環境・引っ越し・転勤など環境の変化' },
    '1_7':  { name: '丑未', hint: '土同士のぶつかり（刑も兼ねる）。家族・身内・不動産・健康面のトラブル注意' },
    '2_8':  { name: '寅申', hint: '木と金の激突（刑も兼ねる）。仕事の変動・人事異動・突発事象' },
    '3_9':  { name: '卯酉', hint: '木と金のぶつかり。人間関係の見直し・別離・再構築の動き' },
    '4_10': { name: '辰戌', hint: '土同士のぶつかり。秘密の露呈・過去の清算' },
    '5_11': { name: '巳亥', hint: '火と水のぶつかり。感情の起伏・急な決断・遠出運' }
  },
  kei: {
    '4_4':   { name: '辰辰自刑', hint: '自分自身との葛藤。プライドが裏目に出やすく、秘密の暴露注意' },
    '6_6':   { name: '午午自刑', hint: '感情の暴走。衝動的な行動・浪費・恋愛トラブル注意' },
    '9_9':   { name: '酉酉自刑', hint: '完璧主義の罠。細かいことにこだわりすぎて疲弊しやすい' },
    '11_11': { name: '亥亥自刑', hint: '思考の堂々巡り。決断できず時を逃す傾向' },
    '0_3':   { name: '子卯刑', hint: '無礼の刑。マナー違反・約束破りで信頼を失いやすい' },
    '1_10':  { name: '丑戌刑', hint: '持勢の刑。権力争い・家族間の不和・不動産問題' },
    '7_10':  { name: '未戌刑', hint: '持勢の刑。権力争い・家族間の不和' },
    '1_7':   { name: '丑未刑', hint: '持勢の刑（冲も兼ねる）。家族間の不和・不動産問題' },
    '2_5':   { name: '寅巳刑', hint: '無恩の刑。恩義を忘れる/忘れられる関係' },
    '2_8':   { name: '寅申刑', hint: '無恩の刑（冲も兼ねる）。仕事や人間関係での裏切り注意' },
    '5_8':   { name: '巳申刑', hint: '無恩の刑（支合も兼ねる）。一見良縁に見えて実は摩擦の多い両刃の関係' }
  }
};

// ===== ドメイン×関係×期間 ごとの簡潔メッセージ =====
var DOMAIN_ADVICE = {
  priv: {
    sango: { month: 'プライベート面で自分にとって有益な縁・情報・気づきが訪れやすい流れの月。能動的に動くと運気が回ります', day: 'プライベート面で自分にとって有益な縁・情報・気づきが訪れやすい吉日。能動的に動くと運気が回ります' },
    shigo: { month: 'プライベート面で穏やかで調和的な時間を過ごしやすい月。自分のペースを大事に', day: 'プライベート面でリラックスして過ごせる、調和的で穏やかな日。自分のペースを大事に' },
    chu:   { month: 'プライベート面で気分の揺れや急な変更が起きやすい月。大きな決断は控えめに、無理のない行動を', day: 'プライベート面で気分の揺れや急な変更が起きやすい日。大きな決断や買い物は控えめに、無理のない行動を' },
    kei:   { month: 'プライベート面で衝動的な行動・トラブルに注意の月。感情に流されないことが鍵', day: 'プライベート面で衝動的な行動・トラブルに注意の日。慎重に過ごし、感情に流されないことが鍵' }
  },
  fam: {
    sango: { month: '家族・パートナーとの絆を深める出来事や良いタイミングが訪れやすい月', day: '家族・パートナーとの絆を深める出来事や良いタイミングが訪れやすい日' },
    shigo: { month: '家族・パートナーとの調和的な対話や穏やかな時間を持ちやすい月', day: '家族・パートナーとの調和的な対話や穏やかな時間を持ちやすい日' },
    chu:   { month: '家族・パートナーとの間で関係の見直しを迫られたり、すれ違いが起きやすい月', day: '家族・パートナーとの間で関係の見直しを迫られたり、すれ違いが起きやすい日' },
    kei:   { month: '家族・パートナーとの間で隠し事の発覚や喧嘩・イザコザが起きやすい月。丁寧に向き合う姿勢を', day: '家族・パートナーとの間で隠し事の発覚や喧嘩・イザコザが起きやすい日。感情的にならず丁寧に向き合う姿勢を' }
  },
  soc: {
    sango: { month: '社会・仕事・親まわりで後々良い方向へ動くキッカケや、自然な追い風が起きやすい月', day: '社会・仕事・親まわりで後々良い方向へ動くキッカケや、自然な追い風が起きやすい日' },
    shigo: { month: '職場や目上の人との縁・サポートが得られやすい穏やかな月', day: '職場や目上の人との縁・サポートが得られやすい穏やかな日' },
    chu:   { month: '転職・引越し・人事異動など、社会的な変化や転機のサインが出やすい月', day: '転職・引越し・人事異動など、社会的な変化や転機のサインが出やすい日' },
    kei:   { month: '職場や親との関係で摩擦・トラブル・不和が起きやすい月。慎重な言動を', day: '職場や親との関係で摩擦・トラブル・不和が起きやすい日。慎重な言動を心がけて' }
  }
};

// ===== 関係性チェック（単一ペア用、変わらず） =====
/** 自分の支と暦支の関係性を判定（三合/支合/冲/刑/自刑） @param {number} s1 @param {number} s2 @returns {string[]} 関係種別の配列 */
function checkBranchPair(s1, s2){
  var rels = [];
  if(isHango(s1, s2)) rels.push('sango');
  for(var i=0;i<SHIGO.length;i++){
    var p=SHIGO[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('shigo');break;}
  }
  for(var i=0;i<CHU.length;i++){
    var p=CHU[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('chu');break;}
  }
  for(var i=0;i<KEI_PAIRS.length;i++){
    var p=KEI_PAIRS[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('kei');break;}
  }
  if(s1===s2 && KEI_SELF.indexOf(s1)>=0){
    if(rels.indexOf('kei')<0) rels.push('kei');
  }
  return rels;
}

/** ペアキー（順序非依存）を生成 @param {number} s1 @param {number} s2 @returns {string} */
function pairKey(s1, s2){
  return Math.min(s1,s2)+'_'+Math.max(s1,s2);
}

// ===== マーク計算 =====
// 暦の支（calBranch）に対し、自分の3柱との関係を返す
/** 自分の四柱と暦の支との関係を全部洗い出す @param {number} calBranch @returns {object} */
function computeAgainstBranch(calBranch){
  if(!MY_PILLARS||MY_PILLARS.length===0) return null;
  return {
    calBranch: calBranch,
    privBranch: MY_PILLARS[2].s, // 日柱
    famBranch:  MY_PILLARS[1].s, // 月柱
    socBranch:  MY_PILLARS[0].s, // 年柱
    privRels: checkBranchPair(MY_PILLARS[2].s, calBranch),
    famRels:  checkBranchPair(MY_PILLARS[1].s, calBranch),
    socRels:  checkBranchPair(MY_PILLARS[0].s, calBranch)
  };
}

/** 指定日の運勢マーク（三合/支合/冲/刑）を計算 @returns {string[]} */
function computeDayMarks(year, month, day){
  var pillars = calcPillars(year, month, day, 12, 0, 135.0);
  return computeAgainstBranch(pillars[2].s);
}

/** 月全体の運勢マーク（月支ベース） @returns {string[]} */
function computeMonthMarks(year, month){
  // 月支は節入後で安定するので15日で計算
  var pillars = calcPillars(year, month, 15, 12, 0, 135.0);
  return computeAgainstBranch(pillars[1].s);
}

// ===== カレンダー描画 =====
/** 運勢カレンダー画面を開く（プラン制限あり） */
function openCalendar(){
  if(calCurrentYear==null){
    var now = new Date();
    calCurrentYear = now.getFullYear();
    calCurrentMonth = now.getMonth()+1;
  }
  // 3ヶ月先制限を超えてた場合(時間経過で limit が変わる)、上限まで戻す
  var maxA = getCalMaxAllowed();
  if(calCompareYM(calCurrentYear, calCurrentMonth, maxA.year, maxA.month) > 0){
    calCurrentYear = maxA.year; calCurrentMonth = maxA.month;
  }
  renderCalendar(calCurrentYear, calCurrentMonth);
  updateCalNavButtons();
}

/** カレンダー本体を描画 @param {number} year @param {number} month (1-12) */
function renderCalendar(year, month){
  var titleEl = document.getElementById('cal-title');
  if(titleEl) titleEl.textContent = year + '年' + month + '月';

  var grid = document.getElementById('cal-grid');
  var summary = document.getElementById('cal-month-summary');
  if(!grid) return;

  if(!MY_PILLARS||MY_PILLARS.length===0){
    grid.innerHTML = '<div style="grid-column:span 7;padding:2rem;text-align:center;color:var(--color-text-tertiary);font-size:12px">プロフィール情報が読み込まれていません。<br>再ログインしてお試しください。</div>';
    if(summary) summary.innerHTML = '';
    return;
  }

  // 月次サマリー描画
  if(summary){
    var monthMarks = computeMonthMarks(year, month);
    summary.innerHTML = renderMonthSummary(year, month, monthMarks);
  }

  // 日カレンダー描画
  var firstDay = new Date(year, month-1, 1).getDay();
  var daysInMonth = new Date(year, month, 0).getDate();

  var html = '';
  ['日','月','火','水','木','金','土'].forEach(function(h, i){
    var cls = i===0?'sun':(i===6?'sat':'');
    html += '<div class="cal-head '+cls+'">'+h+'</div>';
  });
  for(var i=0;i<firstDay;i++){
    html += '<div class="cal-cell empty"></div>';
  }

  var today = new Date();
  var isCurMonth = (year===today.getFullYear() && month===today.getMonth()+1);

  for(var d=1; d<=daysInMonth; d++){
    var dow = new Date(year, month-1, d).getDay();
    var weekCls = dow===0?'sun':(dow===6?'sat':'');
    var todayCls = (isCurMonth && d===today.getDate())?'today':'';

    var marks = computeDayMarks(year, month, d);
    var marksHtml = '';
    if(marks){
      // priv → fam → soc の順でマーク表示（被りも全部出す）
      DOMAIN_KEYS.forEach(function(key){
        marks[key+'Rels'].forEach(function(rel){
          marksHtml += '<span class="cal-mk '+rel+'">'+REL_MARKS[rel]+'</span>';
        });
      });
    }

    html += '<div class="cal-cell '+weekCls+' '+todayCls+'" onclick="showCalDetail('+year+','+month+','+d+')">';
    html += '<div class="cal-day">'+d+'</div>';
    html += '<div class="cal-marks">'+marksHtml+'</div>';
    html += '</div>';
  }

  grid.innerHTML = html;
}

/** 閲覧可能な最大月（今日の月から3ヶ月先まで） @returns {{year:number,month:number}} */
function getCalMaxAllowed(){
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth() + 1 + 3; // 今月 +3ヶ月
  while(m > 12){ m -= 12; y += 1; }
  return { year: y, month: m };
}

/** year/month の前後関係を整数で比較。同じなら0、先なら正、過去なら負 */
function calCompareYM(y1, m1, y2, m2){
  return (y1 * 12 + m1) - (y2 * 12 + m2);
}

/** ナビボタンの活性/非活性 + 上限お知らせの表示切替 */
function updateCalNavButtons(){
  var nextBtn = document.getElementById('cal-next-btn');
  var notice = document.getElementById('cal-next-notice');
  if(!nextBtn) return;
  var maxAllowed = getCalMaxAllowed();
  var atMax = calCompareYM(calCurrentYear, calCurrentMonth, maxAllowed.year, maxAllowed.month) >= 0;
  // disabled は使わない（onclick が発火しないため）→ 見た目で表現
  nextBtn.style.opacity = atMax ? '0.35' : '';
  nextBtn.style.cursor = atMax ? 'not-allowed' : '';
  if(notice) notice.style.display = atMax ? 'block' : 'none';
}

/** 前月に移動 */
function calPrev(){
  calCurrentMonth--;
  if(calCurrentMonth<1){calCurrentMonth=12;calCurrentYear--;}
  renderCalendar(calCurrentYear, calCurrentMonth);
  updateCalNavButtons();
}

/** 翌月に移動（今月+3ヶ月までで制限） */
function calNext(){
  var maxAllowed = getCalMaxAllowed();
  if(calCompareYM(calCurrentYear, calCurrentMonth, maxAllowed.year, maxAllowed.month) >= 0){
    // すでに上限。何もしない
    return;
  }
  calCurrentMonth++;
  if(calCurrentMonth>12){calCurrentMonth=1;calCurrentYear++;}
  renderCalendar(calCurrentYear, calCurrentMonth);
  updateCalNavButtons();
}

// ===== 月次サマリー描画 =====
/** 月全体のサマリー表示 */
function renderMonthSummary(year, month, marks){
  if(!marks) return '';
  var html = '<div style="font-family:\'Noto Serif JP\',serif;font-size:15px;font-weight:500;margin-bottom:.4rem;color:var(--color-text-primary);text-align:center;letter-spacing:.05em">今月（'+year+'年'+month+'月 = '+SHI[marks.calBranch]+'月）の運勢傾向</div>';
  html += '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:.6rem;text-align:center">3面の傾向（自分の3柱と今月の月支との関係）</div>';
  DOMAIN_KEYS.forEach(function(domain){
    var info = DOMAIN_INFO[domain];
    var userBranch = marks[domain+'Branch'];
    var rels = marks[domain+'Rels'];
    html += renderDomainSection(domain, userBranch, marks.calBranch, rels, 'month');
  });
  return html;
}

// ===== ドメイン別セクション描画（月次・日次共通） =====
/** ドメイン別（私事/家庭/社会）の運勢セクションを描画 */
function renderDomainSection(domain, userBranch, calBranch, rels, periodType){
  var info = DOMAIN_INFO[domain];
  var calBranchLabel = (periodType==='month' ? '今月の月支' : '今日の日支');
  var html = '<div class="cal-section">';
  html += '<div class="cal-section-hd">【'+info.label+'】 '+info.sourceLabel+'「'+SHI[userBranch]+'」 × '+calBranchLabel+'「'+SHI[calBranch]+'」</div>';

  if(rels.length===0){
    var periodWord = periodType==='month' ? '月' : '日';
    html += '<div class="cal-section-text cal-no-rel">特段の組み合わせなし。'+info.label+'は穏やかな'+periodWord+'。ルーティンを丁寧に過ごすのが吉。</div>';
  } else {
    var marksLine = rels.map(function(r){return '<span class="cal-mk '+r+'">'+REL_MARKS[r]+'</span>';}).join(' ');
    html += '<div class="cal-section-marks">'+marksLine+'</div>';
    rels.forEach(function(rel){
      var key = pairKey(userBranch, calBranch);
      var pairData = (BRANCH_PAIR_DETAILS[rel]||{})[key];
      var pairName = pairData ? pairData.name : '';
      var pairHint = pairData ? pairData.hint : '';
      var advice = (DOMAIN_ADVICE[domain]||{})[rel];
      var adviceText = advice ? advice[periodType] : '';
      var isBad = (rel==='chu'||rel==='kei');
      html += '<div class="cal-section-text">';
      html += '<strong'+(isBad?' class="bad"':'')+'>'+REL_MARKS[rel]+' '+REL_NAMES[rel]+(pairName?'（'+pairName+'）':'')+'</strong>';
      if(pairHint) html += '<br>' + pairHint + '。';
      if(adviceText) html += '<br>' + adviceText + '。';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}

// ===== 日詳細モーダル =====
/** 日付タップで詳細パネルを表示 @param {number} year @param {number} month @param {number} day */
function showCalDetail(year, month, day){
  var marks = computeDayMarks(year, month, day);
  if(!marks) return;
  var dayOfWeek = ['日','月','火','水','木','金','土'][new Date(year, month-1, day).getDay()];

  var titleEl = document.getElementById('cal-detail-title');
  if(titleEl) titleEl.textContent = year+'年'+month+'月'+day+'日（'+dayOfWeek+'）';

  var html = '';
  html += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:.5rem;line-height:1.6">この日の日支「'+SHI[marks.calBranch]+'」と自分の3柱との関係から3面の傾向を表示。</div>';
  DOMAIN_KEYS.forEach(function(domain){
    var info = DOMAIN_INFO[domain];
    var userBranch = marks[domain+'Branch'];
    var rels = marks[domain+'Rels'];
    html += renderDomainSection(domain, userBranch, marks.calBranch, rels, 'day');
  });

  var body = document.getElementById('cal-detail-body');
  if(body) body.innerHTML = html;

  var modal = document.getElementById('cal-detail-modal');
  if(modal) modal.classList.add('show');
}

/** カレンダー詳細パネルを閉じる */
function closeCalDetail(){
  var modal = document.getElementById('cal-detail-modal');
  if(modal) modal.classList.remove('show');
}
