// ===== UI: オリエンテーション（プラン別スライド遷移） =====

// ===== プラン別オリエンスライド =====
// 各スライドは .slide div の inner HTML
const SLIDE_DATA = {
  // -------- お試しプラン (¥369/月) --------
  trial: [
    // 1. プラン紹介
    '<div class="slide-badge">① プラン</div><div class="slide-title">お試しプラン</div>'
    +'<div class="slide-sub">月369円から始められる、<br>マッチングに特化した軽量プランです。</div>'
    +'<div class="plan-box gold"><div class="plan-box-name">お試しプラン</div>'
    +'<div class="plan-box-price">¥ 369 <span class="plan-box-unit">/ 月</span></div>'
    +'<div class="plan-box-items">✦ 命式の自動計算・登録<br>✦ 良縁率の高い方とのマッチング<br>✦ 仮マッチ後のプロフィール閲覧<br>✦ メッセージ最大30回</div></div>'
    +'<div class="slide-note">※ 相性診断・運勢カレンダーをご利用になりたい場合は、後日「NOマッチングプラン」または「トータルプラン」へ変更ください。</div>',
    // 2. 登録について
    '<div class="slide-badge">② 登録について</div><div class="slide-title">まずは登録から</div>'
    +'<div class="slide-sub">登録情報は後から変更できません。<br>正確に入力してください。</div>'
    +'<div class="feature-row"><div class="feature-icon">📷</div><div class="feature-text"><div class="feature-title">プロフィール写真</div><div class="feature-desc">マッチング前のプロフィール写真はぼかし表示。マッチング後にクリアな状態で表示されます。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">👤</div><div class="feature-text"><div class="feature-title">プロフィール情報</div><div class="feature-desc">ニックネーム・性別・居住地・結婚歴・連れ子の有無を入力します。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">🗓️</div><div class="feature-text"><div class="feature-title">生まれの情報</div><div class="feature-desc">生年月日・生時・出生地で命式が算出されます。時刻不明な場合は空欄でもOK。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">☯️</div><div class="feature-text"><div class="feature-title">命式プレビュー</div><div class="feature-desc">「命式を算出する」で年・月・日・時柱が表示されます。</div></div></div>',
    // 3. 推しページ
    '<div class="slide-badge">③ 推しページ</div><div class="slide-title">良縁率の高い方が<br>自動で表示されます</div>'
    +'<div class="slide-sub">四柱推命の相性判定をもとに良縁率を算出し、<br>高い順に表示します。</div>'
    +'<div class="feature-row"><div class="feature-icon">🔍</div><div class="feature-text"><div class="feature-title">絞り込み条件</div><div class="feature-desc">性別・年齢・居住地・良縁率の最低ラインなどで絞り込めます。</div></div></div>'
    +'<div class="mock-card" style="margin-bottom:.5rem"><div class="mock-row"><div class="mock-ava" style="filter:blur(3px);font-size:16px">🙂</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500;color:var(--color-text-primary)">つきみさん <span style="font-size:9px;color:var(--color-text-tertiary)">32歳・兵庫県</span></div><div class="mock-tags"><span class="mock-tag">干合：1</span><span class="mock-tag">三合：2</span></div><div class="mock-bar"><div class="mock-fill" style="width:88%"></div></div><div class="mock-label">良縁率：88%</div></div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">💬</div><div class="feature-text"><div class="feature-title">「話してみたい」ボタン</div><div class="feature-desc">気になる方に押すと、相手の縁リストに申請が届きます。</div></div></div>',
    // 4. 縁リスト
    '<div class="slide-badge">④ 縁リスト</div><div class="slide-title">申請・マッチングを<br>管理するページ</div>'
    +'<div class="slide-sub">「話してみたい」が届いた方への返答と、<br>マッチング後の連絡ができます。</div>'
    +'<div class="mock-card" style="margin-bottom:5px"><div class="mock-row" style="margin-bottom:5px"><div class="mock-ava gold">月</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500">つきみさん<span class="mock-badge pending">申請待ち</span></div><div style="font-size:9px;color:var(--color-text-tertiary)">32歳・良縁率88%</div></div></div><div style="display:flex;gap:5px"><span class="mock-btn gold" style="flex:1;text-align:center;padding:4px 0">お話しOK</span><span class="mock-btn gray" style="flex:1;text-align:center;padding:4px 0">ごめんなさい</span></div></div>'
    +'<div class="mock-card" style="margin-bottom:.5rem;border-color:#C9A96E;border-left:3px solid #C9A96E"><div class="mock-row"><div class="mock-ava gold">花</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500">はなこさん<span class="mock-badge gold-b">マッチング成立</span></div></div></div><div style="margin-top:4px"><span class="mock-btn outline">メッセージ →</span></div></div>',
    // 5. メッセージ
    '<div class="slide-badge">⑤ メッセージ</div><div class="slide-title">マッチングした方と<br>メッセージができます</div>'
    +'<div class="slide-sub">マッチング成立後にチャットが始まります。</div>'
    +'<div class="mock-card" style="margin-bottom:.75rem;padding:.5rem .75rem">'
      +'<div style="display:flex;gap:5px;align-items:center;margin-bottom:.5rem"><span style="font-size:16px;color:var(--color-text-secondary)">‹</span><span style="font-size:11px;font-weight:500">つきみさん</span></div>'
      +'<div style="text-align:left;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:var(--color-background-secondary);padding:4px 8px;border-radius:7px;color:var(--color-text-secondary);max-width:75%">はじめまして！よろしくお願いします</span></div>'
      +'<div style="text-align:right;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:#C9A96E;padding:4px 8px;border-radius:7px;color:#fff;max-width:75%">こちらこそ！よろしくお願いします</span></div>'
      +'<div style="text-align:left;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:var(--color-background-secondary);padding:4px 8px;border-radius:7px;color:var(--color-text-secondary);max-width:75%">どちらにお住まいですか？</span></div>'
      +'<div style="text-align:right"><span style="display:inline-block;font-size:9px;background:#C9A96E;padding:4px 8px;border-radius:7px;color:#fff;max-width:75%">兵庫県です！◯◯さんは？</span></div>'
    +'</div>'
    +'<div class="slide-note">※ 他のSNSのIDやリンクの交換は規約違反。<br>発覚時点で退会処分・再入会不可となります。</div>',
    // 6. その他＋完了
    '<div class="slide-badge">⑥ その他ページ</div><div class="slide-title">「その他」タブから<br>各種ページへ</div>'
    +'<div class="slide-sub">利用可能な機能と、プラン変更でご利用になれる機能のご案内です。</div>'
    +'<div class="feature-row"><div class="feature-icon">💳</div><div class="feature-text"><div class="feature-title">プラン</div><div class="feature-desc">現在のプランの確認・変更ができます。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">🔮</div><div class="feature-text"><div class="feature-title">相性診断・運勢カレンダー <span style="font-size:10px;color:#C05050">プラン対象外</span></div><div class="feature-desc">グレーアウト表示されます。プランを変更するとご利用になれます。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:.75rem"><div class="feature-icon">📩</div><div class="feature-text"><div class="feature-title">紹介・運営の想い・問い合わせなど</div><div class="feature-desc">サービスに関するご案内・お問い合わせができます。</div></div></div>'
    +'<div style="background:rgba(201,169,110,.1);border:0.5px solid #C9A96E;border-radius:8px;padding:.6rem .75rem;font-size:11px;color:#C9A96E;text-align:center">以上で説明は終わりです。<br>登録に進みましょう！</div>'
  ],

  // -------- NOマッチングプラン (¥693/月) --------
  no_matching: [
    // 1. プラン紹介
    '<div class="slide-badge">① プラン</div><div class="slide-title">NOマッチングプラン</div>'
    +'<div class="slide-sub">マッチングは使わず、<br>相性診断と運勢カレンダーに特化したプランです。</div>'
    +'<div class="plan-box gold"><div class="plan-box-name">NOマッチングプラン</div>'
    +'<div class="plan-box-price">¥ 693 <span class="plan-box-unit">/ 月</span></div>'
    +'<div class="plan-box-items">✦ 気になる人との相性診断<br>✦ 相性診断結果のメモ<br>✦ あなた専用の運勢カレンダー</div></div>'
    +'<div class="slide-note">※ マッチング機能はご利用いただけません。<br>マッチングもご希望の場合は「トータルプラン」をご検討ください。</div>',
    // 2. 登録について
    '<div class="slide-badge">② 登録について</div><div class="slide-title">まずは登録から</div>'
    +'<div class="slide-sub">登録情報は後から変更できません。<br>正確に入力してください。</div>'
    +'<div class="feature-row"><div class="feature-icon">👤</div><div class="feature-text"><div class="feature-title">プロフィール情報</div><div class="feature-desc">ニックネーム・性別を入力します。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">🗓️</div><div class="feature-text"><div class="feature-title">生まれの情報</div><div class="feature-desc">生年月日・生時・出生地で命式が算出されます。時刻不明な場合は空欄でもOK。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">☯️</div><div class="feature-text"><div class="feature-title">命式プレビュー</div><div class="feature-desc">「命式を算出する」で年・月・日・時柱が表示されます。</div></div></div>',
    // 3. 相性ページ
    '<div class="slide-badge">③ 相性ページ</div><div class="slide-title">気になる人との<br>相性を学問的に診断</div>'
    +'<div class="slide-sub">名前と生年月日の入力だけで、<br>四柱推命に基づいた相性結果が出ます。</div>'
    +'<div class="feature-row"><div class="feature-icon">🔮</div><div class="feature-text"><div class="feature-title">相性診断</div><div class="feature-desc">気になる人の生年月日を入れるだけで、良縁率と詳細な関係性を表示します。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">📋</div><div class="feature-text"><div class="feature-title">相性結果メモ</div><div class="feature-desc">診断結果を保存して、後から見返したり比較したりできます。</div></div></div>',
    // 4. 運勢カレンダー
    '<div class="slide-badge">④ 運勢カレンダー</div><div class="slide-title">あなた専用の<br>運勢カレンダー</div>'
    +'<div class="slide-sub">あなたの命式と暦の十二支との組み合わせから、<br>月単位・日単位の運勢を確認できます。</div>'
    +'<div class="feature-row"><div class="feature-icon">📅</div><div class="feature-text"><div class="feature-title">日々の運勢</div><div class="feature-desc">日柱・月柱・年柱と暦の関係から、その日の運勢を読み解きます。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">⭐</div><div class="feature-text"><div class="feature-title">三合・支合・冲・刑</div><div class="feature-desc">吉日・要注意日が一目でわかるアイコン表示。</div></div></div>',
    // 5. メッセージ
    '<div class="slide-badge">⑤ メッセージ</div><div class="slide-title">運営との連絡用<br>メッセージページ</div>'
    +'<div class="slide-sub">マッチング機能はありませんが、<br>運営とのお問い合わせ・連絡が可能です。</div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">📩</div><div class="feature-text"><div class="feature-title">運営チャット</div><div class="feature-desc">プランに関するご質問・お知らせは「縁の間 運営」とのチャットでやり取りします。</div></div></div>',
    // 6. その他
    '<div class="slide-badge">⑥ その他ページ</div><div class="slide-title">プラン変更や<br>サービスのご案内</div>'
    +'<div class="slide-sub">「その他」タブから各種情報をご確認いただけます。</div>'
    +'<div class="feature-row"><div class="feature-icon">💳</div><div class="feature-text"><div class="feature-title">プラン</div><div class="feature-desc">現在のプランの確認・変更ができます。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">💛</div><div class="feature-text"><div class="feature-title">紹介プログラム・運営の想い</div><div class="feature-desc">紹介プログラムや運営の想いをご紹介します。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:.75rem"><div class="feature-icon">📩</div><div class="feature-text"><div class="feature-title">問い合わせ</div><div class="feature-desc">プラン・運勢表・個人鑑定に関するお問い合わせができます。</div></div></div>'
    +'<div style="background:rgba(201,169,110,.1);border:0.5px solid #C9A96E;border-radius:8px;padding:.6rem .75rem;font-size:11px;color:#C9A96E;text-align:center">以上で説明は終わりです。<br>登録に進みましょう！</div>'
  ],

  // -------- トータルプラン (¥936/月) --------
  total: [
    // 1. プラン紹介
    '<div class="slide-badge">① プラン</div><div class="slide-title">トータルプラン</div>'
    +'<div class="slide-sub">マッチング・相性診断・運勢カレンダー、<br>すべての機能をフル活用できる総合プランです。</div>'
    +'<div class="plan-box gold"><div class="plan-box-name">トータルプラン</div>'
    +'<div class="plan-box-price">¥ 936 <span class="plan-box-unit">/ 月</span></div>'
    +'<div class="plan-box-items">✦ 良縁率の高い方とのマッチング<br>✦ メッセージのやり取り<br>✦ 気になる人との相性診断<br>✦ 相性診断結果のメモ<br>✦ あなた専用の運勢カレンダー</div></div>'
    +'<div class="slide-note">※ 他のSNSのIDやリンクの交換は規約違反。<br>発覚時点で退会処分・再入会不可となります。</div>',
    // 2. 登録について
    '<div class="slide-badge">② 登録について</div><div class="slide-title">まずは登録から</div>'
    +'<div class="slide-sub">登録情報は後から変更できません。<br>正確に入力してください。</div>'
    +'<div class="feature-row"><div class="feature-icon">📷</div><div class="feature-text"><div class="feature-title">プロフィール写真</div><div class="feature-desc">マッチング前のプロフィール写真はぼかし表示。マッチング後にクリアな状態で表示されます。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">👤</div><div class="feature-text"><div class="feature-title">プロフィール情報</div><div class="feature-desc">ニックネーム・性別・居住地・結婚歴・連れ子の有無を入力します。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">🗓️</div><div class="feature-text"><div class="feature-title">生まれの情報</div><div class="feature-desc">生年月日・生時・出生地で命式が算出されます。時刻不明な場合は空欄でもOK。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">☯️</div><div class="feature-text"><div class="feature-title">命式プレビュー</div><div class="feature-desc">「命式を算出する」で年・月・日・時柱が表示されます。</div></div></div>',
    // 3. 推しページ
    '<div class="slide-badge">③ 推しページ</div><div class="slide-title">良縁率の高い方が<br>自動で表示されます</div>'
    +'<div class="slide-sub">四柱推命の相性判定をもとに良縁率を算出し、<br>高い順に表示します。</div>'
    +'<div class="feature-row"><div class="feature-icon">🔍</div><div class="feature-text"><div class="feature-title">絞り込み条件</div><div class="feature-desc">性別・年齢・居住地・良縁率の最低ラインなどで絞り込めます。</div></div></div>'
    +'<div class="mock-card" style="margin-bottom:.5rem"><div class="mock-row"><div class="mock-ava" style="filter:blur(3px);font-size:16px">🙂</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500;color:var(--color-text-primary)">つきみさん <span style="font-size:9px;color:var(--color-text-tertiary)">32歳・兵庫県</span></div><div class="mock-tags"><span class="mock-tag">干合：1</span><span class="mock-tag">三合：2</span></div><div class="mock-bar"><div class="mock-fill" style="width:88%"></div></div><div class="mock-label">良縁率：88%</div></div></div></div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">💬</div><div class="feature-text"><div class="feature-title">「話してみたい」ボタン</div><div class="feature-desc">気になる方に押すと、相手の縁リストに申請が届きます。</div></div></div>',
    // 4. 縁リスト
    '<div class="slide-badge">④ 縁リスト</div><div class="slide-title">申請・マッチングを<br>管理するページ</div>'
    +'<div class="slide-sub">「話してみたい」が届いた方への返答と、<br>マッチング後の連絡ができます。</div>'
    +'<div class="mock-card" style="margin-bottom:5px"><div class="mock-row" style="margin-bottom:5px"><div class="mock-ava gold">月</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500">つきみさん<span class="mock-badge pending">申請待ち</span></div><div style="font-size:9px;color:var(--color-text-tertiary)">32歳・良縁率88%</div></div></div><div style="display:flex;gap:5px"><span class="mock-btn gold" style="flex:1;text-align:center;padding:4px 0">お話しOK</span><span class="mock-btn gray" style="flex:1;text-align:center;padding:4px 0">ごめんなさい</span></div></div>'
    +'<div class="mock-card" style="margin-bottom:.5rem;border-color:#C9A96E;border-left:3px solid #C9A96E"><div class="mock-row"><div class="mock-ava gold">花</div><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500">はなこさん<span class="mock-badge gold-b">マッチング成立</span></div></div></div><div style="margin-top:4px"><span class="mock-btn outline">メッセージ →</span></div></div>',
    // 5. メッセージ
    '<div class="slide-badge">⑤ メッセージ</div><div class="slide-title">マッチングした方と<br>メッセージができます</div>'
    +'<div class="slide-sub">マッチング成立後にチャットが始まります。</div>'
    +'<div class="mock-card" style="margin-bottom:.5rem;padding:.5rem .75rem">'
      +'<div style="display:flex;gap:5px;align-items:center;margin-bottom:.5rem"><span style="font-size:16px;color:var(--color-text-secondary)">‹</span><span style="font-size:11px;font-weight:500">つきみさん</span></div>'
      +'<div style="text-align:left;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:var(--color-background-secondary);padding:4px 8px;border-radius:7px;color:var(--color-text-secondary);max-width:75%">はじめまして！よろしくお願いします</span></div>'
      +'<div style="text-align:right;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:#C9A96E;padding:4px 8px;border-radius:7px;color:#fff;max-width:75%">こちらこそ！よろしくお願いします</span></div>'
      +'<div style="text-align:left;margin-bottom:4px"><span style="display:inline-block;font-size:9px;background:var(--color-background-secondary);padding:4px 8px;border-radius:7px;color:var(--color-text-secondary);max-width:75%">どちらにお住まいですか？</span></div>'
      +'<div style="text-align:right"><span style="display:inline-block;font-size:9px;background:#C9A96E;padding:4px 8px;border-radius:7px;color:#fff;max-width:75%">兵庫県です！◯◯さんは？</span></div>'
    +'</div>'
    +'<div class="feature-row" style="margin-bottom:0"><div class="feature-icon">📋</div><div class="feature-text"><div class="feature-title">運営チャットも統合</div><div class="feature-desc">マッチング相手とのやり取りに加え、運営からのお知らせもこのページに届きます。</div></div></div>',
    // 6. その他
    '<div class="slide-badge">⑥ その他ページ</div><div class="slide-title">充実の追加機能</div>'
    +'<div class="slide-sub">「その他」タブから多彩な機能をご利用いただけます。</div>'
    +'<div class="feature-row"><div class="feature-icon">🔮</div><div class="feature-text"><div class="feature-title">相性診断・結果メモ</div><div class="feature-desc">気になる人や知り合いとの相性を診断し、結果を保存・比較できます。</div></div></div>'
    +'<div class="feature-row"><div class="feature-icon">📅</div><div class="feature-text"><div class="feature-title">運勢カレンダー</div><div class="feature-desc">あなた専用の月単位・日単位の運勢が確認できます。</div></div></div>'
    +'<div class="feature-row" style="margin-bottom:.75rem"><div class="feature-icon">💛</div><div class="feature-text"><div class="feature-title">紹介・問い合わせなど</div><div class="feature-desc">紹介プログラム・運営の想い・お問い合わせなどの各種情報。</div></div></div>'
    +'<div style="background:rgba(201,169,110,.1);border:0.5px solid #C9A96E;border-radius:8px;padding:.6rem .75rem;font-size:11px;color:#C9A96E;text-align:center">以上で説明は終わりです。<br>登録に進みましょう！</div>'
  ]
};

// ===== プラン選択 → オリエン =====
function selectPlan(plan){
  selectedPlan = plan;
  document.getElementById('plan-select-wrap').style.display='none';
  buildOrientForPlan(plan);
  document.getElementById('orient-wrap').style.display='flex';
}

function backToLoginFromPlan(){
  document.getElementById('plan-select-wrap').style.display='none';
  document.getElementById('login-wrap').style.display='flex';
}

function buildOrientForPlan(plan){
  var slides = SLIDE_DATA[plan] || SLIDE_DATA.total;
  totalSlides = slides.length;
  var html = '';
  slides.forEach(function(s){ html += '<div class="slide">' + s + '</div>'; });
  document.getElementById('slides').innerHTML = html;
  currentSlide = 0;
  initDots();
  updateSlide();
}

// ===== スライド遷移 =====
function initDots(){var d=document.getElementById('dots');d.innerHTML='';for(var i=0;i<totalSlides;i++){var dot=document.createElement('div');dot.className='dot'+(i===0?' on':'');d.appendChild(dot);}}
function updateSlide(){
  document.getElementById('slides').style.transform='translateX(-'+currentSlide*100+'%)';
  document.querySelectorAll('.dot').forEach(function(d,i){d.className='dot'+(i===currentSlide?' on':'');});
  document.getElementById('orient-progress').textContent=(currentSlide+1)+' / '+totalSlides;
  // 最初のスライドではプラン選択へ戻れるようボタンを常に表示
  var btnPrev=document.getElementById('btn-prev');
  btnPrev.style.visibility='visible';
  btnPrev.textContent=currentSlide===0?'← プラン選択へ':'← 戻る';
  var isLast=currentSlide===totalSlides-1;
  document.getElementById('btn-next').textContent=isLast?'登録へ進む →':'次へ →';
  document.getElementById('btn-skip').style.display=isLast?'none':'inline-block';
}
function nextSlide(){if(currentSlide<totalSlides-1){currentSlide++;updateSlide();}else{startReg();}}
function prevSlide(){
  if(currentSlide>0){
    currentSlide--;
    updateSlide();
  }else{
    // 最初のスライドからはプラン選択画面に戻る
    document.getElementById('orient-wrap').style.display='none';
    document.getElementById('plan-select-wrap').style.display='flex';
  }
}
function skipOrient(){startReg();}
function startReg(){
  document.getElementById('orient-wrap').style.display='none';
  applyPlanToRegistrationForm(selectedPlan);
  document.getElementById('reg-wrap').style.display='block';
  document.getElementById('reg-wrap').style.visibility='visible';
}

// プランに応じて登録フォームの不要項目を非表示にする
function applyPlanToRegistrationForm(plan){
  var photo = document.getElementById('reg-photo-section');
  var residence = document.getElementById('reg-residence');
  var marriageKodomo = document.getElementById('reg-marriage-kodomo');
  var kodomoRow = document.getElementById('kodomo-row');
  var hide = (plan === 'no_matching');
  if(photo) photo.style.display = hide ? 'none' : '';
  if(residence) residence.style.display = hide ? 'none' : '';
  if(marriageKodomo) marriageKodomo.style.display = hide ? 'none' : '';
  if(hide && kodomoRow) kodomoRow.style.display = 'none';
}
