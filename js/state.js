// ===== アプリ全体の状態変数 =====
// （他ファイルから自由に読み書きされる前提のグローバル変数）
var ageState={older:true,younger:true};
var savedPillars=[],savedImgSrc='',MY_PILLARS=[],REL_CACHE={};
var enList=[],PARTNERS_DATA=[],ALL_SORTED=[],memberID='';
var officialMessages=[{from:'official',text:'縁の間へようこそ！ご不明な点はいつでもお気軽にお問い合わせください。'}];
var currentSlide=0,totalSlides=7;
var selectedPlan=null; // 'trial' / 'no_matching' / 'total'（プラン選択画面で設定）
var currentReviewStar=0;
var demoGuideDismissed=false;
var currentUser = null;
var mySex = "";
var myPlan = 'total'; // 'trial' / 'no_matching' / 'total'
var myCreatedAt = null; // ISO文字列、登録日時。これより前のアナウンスは非表示
var pollingTimer = null;
// 自分宛のキャッシュバックレコード（自分=紹介者として、被紹介者の卒業承認時に生成される）
var myCashbacks = [];

// ===== デモパートナー（pillars.js に依存） =====
var PARTNERS=[{name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},{name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},{name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},{name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},{name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}];
var DEMO_MALE=[{name:'ゆうきさん',meta:'28歳・東京都・初婚・子なし',pillars:calcPillars(1997,8,15,10,30,139.75),isDemo:true,sex:'男性'},{name:'れんさん',meta:'31歳・大阪府・初婚・子なし',pillars:calcPillars(1994,4,22,7,0,135.50),isDemo:true,sex:'男性'},{name:'はるとさん',meta:'33歳・神奈川県・初婚・子なし',pillars:calcPillars(1992,12,3,21,45,139.64),isDemo:true,sex:'男性'},{name:'そうたさん',meta:'29歳・京都府・初婚・子なし',pillars:calcPillars(1996,6,18,15,20,135.77),isDemo:true,sex:'男性'},{name:'かいとさん',meta:'35歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,2,8,5,10,135.19),isDemo:true,sex:'男性'}];
