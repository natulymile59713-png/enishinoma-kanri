// ===== アプリ全体の状態変数 =====
// 既存コードは下記のフラットなグローバル変数を直接参照している。
// 段階的に整理するため、新規の状態は window.App.state.* 配下に置くこと（下記参照）。
//
// グローバル変数一覧（責務付き）:
//  ▼ 認証・プロフィール
//    currentUser     : Supabase auth user (login 後)
//    mySex           : '男性' | '女性' | 'その他' など
//    myPlan          : 'trial' | 'no_matching' | 'total'
//    myCreatedAt     : ISO 文字列、profiles.created_at （これより前のアナウンスは非表示）
//    memberID        : 会員ID 'EN-XXXXXXXX'
//  ▼ マッチング・メッセージ
//    enList          : 縁リスト（pending/matched/.../coupled の自分のマッチ）
//    PARTNERS_DATA   : 推し画面に表示する候補配列（DBから）
//    ALL_SORTED      : 良縁率ソート済の全候補
//    officialMessages: 運営チャットの履歴（メモリ上、loadOfficialChatHistory で再構築）
//    myCashbacks     : 自分が紹介者として獲得したキャッシュバック
//  ▼ 命式・診断キャッシュ
//    savedPillars, savedImgSrc, MY_PILLARS, REL_CACHE
//  ▼ オリエンテーション・UI 状態
//    currentSlide, totalSlides, selectedPlan, currentReviewStar
//    demoGuideDismissed, ageState
//  ▼ ポーリング
//    pollingTimer    : setInterval ハンドル（10秒ごとに DB 同期）

// 新規追加するグローバルは下記の名前空間に集約していく。
// 既存コードは触らないが、新しい機能はここに状態を置くと整理が進む。
window.App = window.App || { state: {}, util: {} };

// ===== 型定義 =====

/**
 * 四柱推命の柱（干支ペア）
 * @typedef {Object} Pillar
 * @property {number} k - 干（KAN）のインデックス 0-9
 * @property {number} s - 支（SHI）のインデックス 0-11
 */

/**
 * 縁リストの 1 件
 * @typedef {Object} EnItem
 * @property {string} matchId - matches.id
 * @property {string} name - 'XXさん'
 * @property {string} meta - '32歳・兵庫県' のような表示文字列
 * @property {string|null} [memberId] - 'EN-XXXXXXXX'
 * @property {string|null} [avatarUrl]
 * @property {number|string} score - 良縁率 or '--'
 * @property {string} status - pending/sent/matched/chatting/date_set/dated/coupled/rejected_notify/approved/approved_by_me/reviewed
 * @property {boolean} [reviewed]
 * @property {string|null} [coupledAt]
 */

/**
 * 推しページに表示するパートナー
 * @typedef {Object} Partner
 * @property {string} name
 * @property {string} meta
 * @property {(Pillar|null)[]} pillars - 4 要素（時柱は null 許容）
 * @property {string} [userId] - DB 上のユーザー ID（リアルユーザーのみ）
 * @property {string} [memberId]
 * @property {string|null} [avatarUrl]
 * @property {boolean} isDemo
 * @property {string} [sex]
 */

/**
 * 運営チャットの 1 メッセージ
 * @typedef {Object} OfficialMsg
 * @property {'official'|'user'} from
 * @property {string} text
 */

/** 年齢フィルタ @type {{older:boolean, younger:boolean}} */
var ageState={older:true,younger:true};

/** 自分の命式（calcPillars の結果） @type {(Pillar|null)[]} */
var savedPillars=[];
/** 登録時に選んだ画像（Base64 / DataURL） @type {string} */
var savedImgSrc='';
/** 自分の命式（マッチング画面でも使う） @type {(Pillar|null)[]} */
var MY_PILLARS=[];
/** 推しページの相性キャッシュ。key:idx, value:checkRelations の結果 @type {Object<number, any>} */
var REL_CACHE={};

/** 縁リスト（自分が関わるすべての matches） @type {EnItem[]} */
var enList=[];
/** @type {Partner[]} */
var PARTNERS_DATA=[];
/** @type {Partner[]} */
var ALL_SORTED=[];
/** 会員ID 'EN-XXXXXXXX' @type {string} */
var memberID='';

/** 運営チャット履歴（メモリ上） @type {OfficialMsg[]} */
var officialMessages=[{from:'official',text:'縁の間へようこそ！ご不明な点はいつでもお気軽にお問い合わせください。'}];

/** 自分が卒業済みか（sotsugyou_requests に status='approved' の自分のレコードがあれば true）
 *  「卒業生の間」サブメニューの可視性判定に使う @type {boolean} */
var myIsGraduated = false;
/** 卒業認定 or 転入承認で卒業生の間に入れるか @type {boolean} */
var myIsVoiceMember = false;

// ===== ユーザー間メッセージ =====
/**
 * 現在開いているチャットの match_id（null なら閉じている）
 * @type {string|null}
 */
var currentChatMatchId = null;
/**
 * 現在開いているチャットの相手 user_id
 * @type {string|null}
 */
var currentChatPartnerId = null;
/**
 * 現在開いているチャットのメッセージ配列（DB から取得済み）
 * @type {Array<{id:string, sender_id:string, body:string, created_at:string}>}
 */
var currentChatMessages = [];
/**
 * メッセージ一覧用：match_id → {lastMsg, lastTime, unreadCount} のキャッシュ
 * @type {Object<string, {lastMsg:string, lastTime:string, unreadCount:number}>}
 */
var msgPreviewCache = {};

var currentSlide=0,totalSlides=7;
/** プラン選択画面で選ばれた値 @type {('trial'|'no_matching'|'total'|null)} */
var selectedPlan=null;
var currentReviewStar=0;
var demoGuideDismissed=false;

/** Supabase auth ユーザー @type {any} */
var currentUser = null;
/** 自分の性別 @type {string} */
var mySex = "";
/** 自分のプラン @type {('trial'|'no_matching'|'total')} */
var myPlan = 'total';
/** プロフィール作成日時（ISO 文字列） @type {string|null} */
var myCreatedAt = null;
/** ポーリング interval ハンドル @type {number|null} */
var pollingTimer = null;
// 自分宛のキャッシュバックレコード（自分=紹介者として、被紹介者の卒業承認時に生成される）
/** @type {Array<{status:string, amount?:number, [key:string]:any}>} */
var myCashbacks = [];

// ===== デモパートナー（pillars.js に依存） =====
/** @type {Partner[]} */
var PARTNERS=[{name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},{name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},{name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},{name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},{name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}];
/** @type {Partner[]} */
var DEMO_MALE=[{name:'ゆうきさん',meta:'28歳・東京都・初婚・子なし',pillars:calcPillars(1997,8,15,10,30,139.75),isDemo:true,sex:'男性'},{name:'れんさん',meta:'31歳・大阪府・初婚・子なし',pillars:calcPillars(1994,4,22,7,0,135.50),isDemo:true,sex:'男性'},{name:'はるとさん',meta:'33歳・神奈川県・初婚・子なし',pillars:calcPillars(1992,12,3,21,45,139.64),isDemo:true,sex:'男性'},{name:'そうたさん',meta:'29歳・京都府・初婚・子なし',pillars:calcPillars(1996,6,18,15,20,135.77),isDemo:true,sex:'男性'},{name:'かいとさん',meta:'35歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,2,8,5,10,135.19),isDemo:true,sex:'男性'}];
