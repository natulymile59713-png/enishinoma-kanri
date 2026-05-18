// @ts-check
// ===== reCAPTCHA v3（任意・雛形） =====
//
// 有効化方法:
//   1. https://www.google.com/recaptcha/admin にアクセスして
//      「+」で新しいサイトを登録（v3 を選択）
//   2. 発行された「Site Key」を下の RECAPTCHA_SITE_KEY にコピペ
//      ※ Secret Key はサーバー側（Supabase Edge Function）でトークン検証に使う
//   3. Edge Function でトークン検証 → 結果に応じて INSERT を許可する仕組みを追加
//   4. リロードすると Site Key が設定された状態で SDK 読み込みが始まる
//
// 無効化したい場合は RECAPTCHA_SITE_KEY を '' のままにする。
// 空のときは SDK 自体を読み込まないのでネットワークコストはゼロ。
//
// グローバルに以下を公開:
//   window.getRecaptchaToken(action)  -> Promise<string|null>
//     action 例: 'register', 'booking', 'contact'
//     Site Key 未設定 or SDK 読み込み失敗時は null を返す。

(function(){
  /** @type {string} */
  var RECAPTCHA_SITE_KEY = '';

  // SDK 未設定 → スタブを公開して呼び出し側を壊さないようにする
  if(!RECAPTCHA_SITE_KEY){
    window.getRecaptchaToken = function(){ return Promise.resolve(null); };
    return;
  }

  var s = document.createElement('script');
  s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY);
  s.async = true;
  s.defer = true;
  s.onload = function(){ console.log('[recaptcha] SDK loaded'); };
  s.onerror = function(){ console.log('[recaptcha] CDN load failed'); };
  document.head.appendChild(s);

  /**
   * 任意のフォーム送信前に呼び出してトークンを取得し、
   * Edge Function に渡して検証する想定。
   * @param {string} action - 計測ラベル（reCAPTCHA Admin のグラフで使える）
   * @returns {Promise<string|null>}
   */
  window.getRecaptchaToken = function(action){
    return new Promise(function(resolve){
      try{
        if(!window.grecaptcha || !window.grecaptcha.ready){
          resolve(null); return;
        }
        window.grecaptcha.ready(function(){
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action || 'submit' })
            .then(function(token){ resolve(token || null); })
            .catch(function(err){
              console.log('[recaptcha] execute error:', err);
              resolve(null);
            });
        });
      }catch(e){
        console.log('[recaptcha] token error:', e);
        resolve(null);
      }
    });
  };
})();
