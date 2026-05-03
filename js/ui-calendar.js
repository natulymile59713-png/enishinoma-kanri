// ===== UI: 運勢カレンダー =====
// 自分の日支と毎日まわってくる年支・月支・日支との組み合わせから、その日の運勢を3レイヤーで読み解く

// 状態
var calCurrentYear = null;
var calCurrentMonth = null;

// 関係マークと名称
var REL_MARKS = { sango: '◎', shigo: '〇', chu: '△', kei: '×' };
var REL_NAMES = { sango: '三合（半会）', shigo: '支合', chu: '冲', kei: '刑' };

// ===== ペアごとの解釈データ =====
// キーは sorted "min_max" 形式（例: 子(0)・辰(4) → '0_4'）
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

// ===== 柱ごとのドメインと解釈テンプレート =====
var PILLAR_ADVICE = {
  year: {
    label: '年柱',
    domain: '社会・仕事・親まわり',
    sango: '後々良い方向へ動くキッカケや、自然な追い風が起きやすい日。仕事の前進・親との良い時間・社会的なつながりに恵まれます',
    shigo: '職場や目上の人との縁・サポートが得られやすい穏やかな日。長期的な信頼関係の土台が築ける時',
    chu: '転職・引っ越し・人事異動など、社会的な変化や転機のサインが出やすい日。流れに逆らわず受け入れる姿勢で',
    kei: '職場や親との関係で摩擦・トラブル・不和が起きやすい日。慎重な言動を心がけ、大きな決断は別日に'
  },
  month: {
    label: '月柱',
    domain: '家族・パートナーまわり',
    sango: '家族やパートナーとの絆を深める出来事・良いタイミングが訪れやすい日。穏やかなコミュニケーションが吉',
    shigo: '家族・パートナーとの調和的な対話や穏やかな時間を持ちやすい日。一緒に過ごすと運気が上がる',
    chu: '家族・パートナーとの間で関係の見直しを迫られたり、すれ違いが起きやすい日。冷静さを保って',
    kei: '隠し事の発覚・喧嘩・イザコザが起きやすい日。感情的にならず、丁寧に向き合う姿勢が大事'
  },
  day: {
    label: '日柱',
    domain: '個人・プライベートまわり',
    sango: '新しい縁や情報、自分にとって有益な出会い・気づきが訪れやすい吉日。能動的に動くと運気が回る',
    shigo: 'リラックスして過ごせる、調和的で穏やかな日。自分のペースを大事にすると吉',
    chu: '急な変更・気分の揺れに注意。大きな決断や買い物は控えめに、無理のない行動を',
    kei: '衝動的な行動・トラブルに注意。慎重に過ごし、感情に流されないことが今日の鍵'
  }
};

// ===== 関係性チェック（単一ペア用） =====
function checkBranchPair(s1, s2){
  var rels = [];
  // 三合（半会）
  if(isHango(s1, s2)) rels.push('sango');
  // 支合
  for(var i=0;i<SHIGO.length;i++){
    var p=SHIGO[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('shigo');break;}
  }
  // 冲
  for(var i=0;i<CHU.length;i++){
    var p=CHU[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('chu');break;}
  }
  // 刑（KEI_PAIRS）
  for(var i=0;i<KEI_PAIRS.length;i++){
    var p=KEI_PAIRS[i];
    if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0])){rels.push('kei');break;}
  }
  // 自刑
  if(s1===s2 && KEI_SELF.indexOf(s1)>=0){
    if(rels.indexOf('kei')<0) rels.push('kei');
  }
  return rels;
}

function pairKey(s1, s2){
  return Math.min(s1,s2)+'_'+Math.max(s1,s2);
}

// ===== その日のマーク計算 =====
function computeDayMarks(year, month, day){
  if(!MY_PILLARS||MY_PILLARS.length===0) return null;
  var pillars = calcPillars(year, month, day, 12, 0, 135.0);
  var userBranch = MY_PILLARS[2].s;
  var yearBranch = pillars[0].s;
  var monthBranch = pillars[1].s;
  var dayBranch = pillars[2].s;
  var yearRels = checkBranchPair(userBranch, yearBranch);
  var monthRels = checkBranchPair(userBranch, monthBranch);
  var dayRels = checkBranchPair(userBranch, dayBranch);
  return {
    userBranch: userBranch,
    yearBranch: yearBranch, monthBranch: monthBranch, dayBranch: dayBranch,
    yearRels: yearRels, monthRels: monthRels, dayRels: dayRels
  };
}

// ===== カレンダー描画 =====
function openCalendar(){
  if(calCurrentYear==null){
    var now = new Date();
    calCurrentYear = now.getFullYear();
    calCurrentMonth = now.getMonth()+1;
  }
  renderCalendar(calCurrentYear, calCurrentMonth);
}

function renderCalendar(year, month){
  var titleEl = document.getElementById('cal-title');
  if(titleEl) titleEl.textContent = year + '年' + month + '月';

  var grid = document.getElementById('cal-grid');
  if(!grid) return;

  if(!MY_PILLARS||MY_PILLARS.length===0){
    grid.innerHTML = '<div style="grid-column:span 7;padding:2rem;text-align:center;color:var(--color-text-tertiary);font-size:12px">プロフィール情報が読み込まれていません。<br>再ログインしてお試しください。</div>';
    return;
  }

  var firstDay = new Date(year, month-1, 1).getDay();
  var daysInMonth = new Date(year, month, 0).getDate();

  var html = '';
  // 曜日ヘッダー
  ['日','月','火','水','木','金','土'].forEach(function(h, i){
    var cls = i===0?'sun':(i===6?'sat':'');
    html += '<div class="cal-head '+cls+'">'+h+'</div>';
  });

  // 月初までの空白セル
  for(var i=0;i<firstDay;i++){
    html += '<div class="cal-cell empty"></div>';
  }

  var today = new Date();
  var isCurMonth = (year===today.getFullYear() && month===today.getMonth()+1);

  // 日のセル
  for(var d=1; d<=daysInMonth; d++){
    var dow = new Date(year, month-1, d).getDay();
    var weekCls = dow===0?'sun':(dow===6?'sat':'');
    var todayCls = (isCurMonth && d===today.getDate())?'today':'';

    var marks = computeDayMarks(year, month, d);
    var marksHtml = '';
    if(marks){
      // 年支・月支・日支 の順でマーク表示（被りも全部出す）
      ['yearRels','monthRels','dayRels'].forEach(function(key){
        marks[key].forEach(function(rel){
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

function calPrev(){
  calCurrentMonth--;
  if(calCurrentMonth<1){calCurrentMonth=12;calCurrentYear--;}
  renderCalendar(calCurrentYear, calCurrentMonth);
}

function calNext(){
  calCurrentMonth++;
  if(calCurrentMonth>12){calCurrentMonth=1;calCurrentYear++;}
  renderCalendar(calCurrentYear, calCurrentMonth);
}

// ===== 詳細モーダル =====
function showCalDetail(year, month, day){
  var marks = computeDayMarks(year, month, day);
  if(!marks) return;
  var dayOfWeek = ['日','月','火','水','木','金','土'][new Date(year, month-1, day).getDay()];

  var titleEl = document.getElementById('cal-detail-title');
  if(titleEl) titleEl.textContent = year+'年'+month+'月'+day+'日（'+dayOfWeek+'）';

  var html = '';
  html += renderCalSection('year', marks.userBranch, marks.yearBranch, marks.yearRels);
  html += renderCalSection('month', marks.userBranch, marks.monthBranch, marks.monthRels);
  html += renderCalSection('day', marks.userBranch, marks.dayBranch, marks.dayRels);

  var body = document.getElementById('cal-detail-body');
  if(body) body.innerHTML = html;

  var modal = document.getElementById('cal-detail-modal');
  if(modal) modal.classList.add('show');
}

function renderCalSection(pillarKey, userBranch, todayBranch, rels){
  var advice = PILLAR_ADVICE[pillarKey];
  var html = '<div class="cal-section">';
  var branchLabelJa = {year:'年',month:'月',day:'日'}[pillarKey];
  html += '<div class="cal-section-hd">【'+advice.label+'】 '+advice.domain+'<br>自分の日支「'+SHI[userBranch]+'」 × 今日の'+branchLabelJa+'支「'+SHI[todayBranch]+'」</div>';

  if(rels.length===0){
    html += '<div class="cal-section-text cal-no-rel">特段の組み合わせなし。'+advice.domain+'は穏やかで、ルーティンを丁寧に過ごすのが吉。</div>';
  } else {
    var marksLine = rels.map(function(r){return '<span class="cal-mk '+r+'">'+REL_MARKS[r]+'</span>';}).join(' ');
    html += '<div class="cal-section-marks">'+marksLine+'</div>';
    rels.forEach(function(rel){
      var key = pairKey(userBranch, todayBranch);
      var pairData = (BRANCH_PAIR_DETAILS[rel]||{})[key];
      var pairName = pairData ? pairData.name : '';
      var pairHint = pairData ? pairData.hint : '';
      var isBad = (rel==='chu'||rel==='kei');
      html += '<div class="cal-section-text">';
      html += '<strong'+(isBad?' class="bad"':'')+'>'+REL_MARKS[rel]+' '+REL_NAMES[rel]+(pairName?'（'+pairName+'）':'')+'</strong>';
      if(pairHint) html += '<br>' + pairHint + '。';
      html += '<br>' + advice[rel] + '。';
      html += '</div>';
    });
  }

  html += '</div>';
  return html;
}

function closeCalDetail(){
  var modal = document.getElementById('cal-detail-modal');
  if(modal) modal.classList.remove('show');
}
