// @ts-check
// ===== Sentry エラー監視（任意） =====
//
// 有効化方法:
//   1. https://sentry.io でプロジェクトを作成（Platform = JavaScript / Browser）
//   2. 発行された DSN を下の SENTRY_DSN にコピペ
//   3. リロードするとエラー・例外が自動で Sentry に送られる
//
// 無効化したい場合は SENTRY_DSN を '' のままにする。
// DSN が空のときは Sentry SDK 自体を読み込まないので、ネットワークコストはゼロ。

(function(){
  // 各アプリで別の DSN を使いたい場合はここを書き換える
  var SENTRY_DSN = '';

  if(!SENTRY_DSN) return;

  var s = document.createElement('script');
  s.src = 'https://browser.sentry-cdn.com/8.40.0/bundle.min.js';
  s.crossOrigin = 'anonymous';
  s.onload = function(){
    if(!window.Sentry) return;
    window.Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      release: 'enishinoma-booking@1.0.0',
      environment: location.hostname === 'localhost' ? 'development' : 'production',
      // ユーザー識別情報（ログイン後にセットする）
      // 例: app.js 側で window.Sentry.setUser({id: currentUser.id, email: currentUser.email})
    });
    console.log('[sentry] initialized');
  };
  s.onerror = function(){ console.log('[sentry] CDN load failed'); };
  document.head.appendChild(s);
})();
