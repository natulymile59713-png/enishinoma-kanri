var KAN=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var SHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var GOKOTSU=[2,4,6,8,0,2,4,6,8,0];
var MO_SHI={1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,11:11,12:0};
var PL=['年柱','月柱','日柱','時柱'];
var ageState={older:true,younger:true};
var savedPillars=[],savedImgSrc='',MY_PILLARS=[],REL_CACHE={};
var enList=[],PARTNERS_DATA=[],ALL_SORTED=[],ngList=[],memberID='';
var officialMessages=[{from:'official',text:'縁の間へようこそ！ご不明な点はいつでもお気軽にお問い合わせください。'}];
var PREF_NAMES=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
function generateMemberID(){var n='';for(var i=0;i<8;i++)n+=Math.floor(Math.random()*10);return'EN-'+n;}
var currentSlide=0,totalSlides=7;
function initDots(){var d=document.getElementById('dots');d.innerHTML='';for(var i=0;i<totalSlides;i++){var dot=document.createElement('div');dot.className='dot'+(i===0?' on':'');d.appendChild(dot);}}
function updateSlide(){document.getElementById('slides').style.transform='translateX(-'+currentSlide*100+'%)';document.querySelectorAll('.dot').forEach(function(d,i){d.className='dot'+(i===currentSlide?' on':'');});document.getElementById('orient-progress').textContent=(currentSlide+1)+' / '+totalSlides;document.getElementById('btn-prev').style.visibility=currentSlide===0?'hidden':'visible';var isLast=currentSlide===totalSlides-1;document.getElementById('btn-next').textContent=isLast?'登録へ進む →':'次へ →';document.getElementById('btn-skip').style.display=isLast?'none':'inline-block';}
function nextSlide(){if(currentSlide<totalSlides-1){currentSlide++;updateSlide();}else{startReg();}}
function prevSlide(){if(currentSlide>0){currentSlide--;updateSlide();}}
function skipOrient(){startReg();}
function startReg(){document.getElementById('orient-wrap').style.display='none';document.getElementById('reg-wrap').style.display='block';document.getElementById('reg-wrap').style.visibility='visible';}
initDots();updateSlide();
function unlockSotsugyou(){var card=document.getElementById('sotsugyou-card'),badge=document.getElementById('sotsugyou-badge'),btn=document.getElementById('sotsugyou-btn');card.classList.remove('locked');card.style.borderColor='#C9A96E';card.style.opacity='1';card.style.filter='none';card.querySelector('.other-plan-nm').style.color='#C9A96E';card.querySelector('.other-plan-price').style.color='';card.querySelector('.other-plan-items').style.color='';var ln=card.querySelector('.lock-notice');if(ln)ln.style.display='none';badge.className='plan-status-badge unlocked';badge.textContent='申込可';btn.textContent='卒業申請フォームを開く →';btn.classList.remove('locked');btn.classList.add('available');btn.disabled=false;btn.onclick=function(){btn.textContent='卒業申請済み ✓';btn.classList.remove('available');btn.classList.add('done');btn.disabled=true;addNotif('【運営】卒業申請を受け付けました','内容確認後、改めてご連絡いたします。');};addNotif('【運営】卒業申請が可能になりました','おめでとうございます！卒業鑑定プランの申し込みが解放されました。');addOfficialMessage('おめでとうございます！🎊 卒業鑑定プランのご申し込みが可能になりました。「その他」→「プラン」からご申請いただけます。');}
function toggleNotif(){var p=document.getElementById('notif-panel');if(!p)return;p.classList.toggle('show');if(p.classList.contains('show')){document.getElementById('notif-dot').style.display='none';document.querySelectorAll('.notif-item.unread').forEach(function(el){el.classList.remove('unread');});}}
function addNotif(title,body){var list=document.getElementById('notif-list');if(!list)return;var item=document.createElement('div');item.className='notif-item unread';item.innerHTML='<div class="notif-item-title">'+title+'</div><div class="notif-item-body">'+body+'</div><div class="notif-item-time">just now</div>';list.insertBefore(item,list.firstChild);document.getElementById('notif-dot').style.display='block';}
function addOfficialMessage(text){officialMessages.push({from:'official',text:text});document.getElementById('official-preview').textContent=text.substring(0,25)+'…';}
function openOfficialChat(){document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';document.getElementById('chat-name').textContent='縁の間 運営';document.getElementById('chat-ava').textContent='縁';document.getElementById('chat-ava').className='msg-list-ava official';document.getElementById('chat-official-badge').style.display='inline-block';var body=document.getElementById('chat-body');var html='<div style="font-size:10px;color:var(--color-text-tertiary);text-align:center;margin-bottom:.75rem;line-height:1.6">縁の間 運営との公式チャットです。<br>問い合わせへの返答もこちらから届きます。</div>';officialMessages.forEach(function(msg){if(msg.from==='official'){html+='<div class="msg-wrap"><div class="bubble">'+msg.text+'</div><div class="mtime">縁の間 運営</div></div>';}else{html+='<div class="msg-wrap me"><div class="bubble me">'+msg.text+'</div><div class="mtime">あなた</div></div>';}});html+='<div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" id="official-input" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button onclick="sendToOfficial()" style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div>';body.innerHTML=html;goTab(2);}
function sendToOfficial(){var input=document.getElementById('official-input');if(!input||!input.value.trim())return;var text=input.value.trim();officialMessages.push({from:'user',text:text});input.value='';setTimeout(function(){addOfficialMessage('メッセージありがとうございます。内容を確認次第、担当よりご連絡いたします。');addNotif('【運営】メッセージを受け取りました','確認次第、ご返答いたします。');},1000);openOfficialChat();}
function submitContact(){var type=document.getElementById('contact-type').value;if(!type){alert('問い合わせ内容を選択してください');return;}document.getElementById('contact-sent').style.display='block';setTimeout(function(){addOfficialMessage('お問い合わせ（'+type+'）を受け付けました。内容を確認次第、こちらのチャットにてご返答いたします。');addNotif('【運営】お問い合わせを受け付けました','メッセージページの運営チャットにてご返答いたします。');},1000);}
var SEKKI={1989:{1:{d:6,h:9,m:58},2:{d:4,h:21,m:28},3:{d:5,h:15,m:57},4:{d:5,h:10,m:32},5:{d:6,h:3,m:54},6:{d:6,h:11,m:3},7:{d:7,h:10,m:24},8:{d:8,h:3,m:48},9:{d:8,h:12,m:54},10:{d:9,h:4,m:18},11:{d:7,h:11,m:35},12:{d:7,h:22,m:28}},1990:{1:{d:6,h:15,m:27},2:{d:4,h:3,m:2},3:{d:6,h:21,m:19},4:{d:5,h:16,m:27},5:{d:6,h:9,m:45},6:{d:6,h:16,m:50},7:{d:7,h:16,m:6},8:{d:8,h:9,m:28},9:{d:8,h:18,m:25},10:{d:9,h:9,m:55},11:{d:7,h:17,m:7},12:{d:8,h:3,m:55}},1991:{1:{d:6,h:21,m:9},2:{d:4,h:8,m:46},3:{d:6,h:3,m:2},4:{d:5,h:21,m:59},5:{d:6,h:15,m:17},6:{d:6,h:22,m:20},7:{d:7,h:21,m:36},8:{d:8,h:14,m:56},9:{d:9,h:0,m:2},10:{d:9,h:15,m:19},11:{d:7,h:22,m:35},12:{d:8,h:9,m:36}},1992:{1:{d:6,h:2,m:48},2:{d:4,h:14,m:48},3:{d:5,h:9,m:2},4:{d:5,h:3,m:57},5:{d:5,h:21,m:12},6:{d:6,h:4,m:14},7:{d:7,h:3,m:28},8:{d:7,h:20,m:50},9:{d:8,h:5,m:49},10:{d:8,h:21,m:6},11:{d:7,h:4,m:21},12:{d:7,h:15,m:24}},1993:{1:{d:6,h:8,m:43},2:{d:4,h:20,m:57},3:{d:6,h:14,m:40},4:{d:5,h:8,m:48},5:{d:6,h:2,m:12},6:{d:6,h:9,m:15},7:{d:7,h:8,m:42},8:{d:8,h:2,m:11},9:{d:8,h:11,m:51},10:{d:9,h:3,m:14},11:{d:7,h:10,m:20},12:{d:7,h:21,m:55}},1994:{1:{d:6,h:14,m:30},2:{d:4,h:2,m:31},3:{d:5,h:20,m:31},4:{d:5,h:14,m:35},5:{d:6,h:7,m:49},6:{d:6,h:14,m:47},7:{d:7,h:14,m:5},8:{d:8,h:7,m:29},9:{d:8,h:17,m:19},10:{d:9,h:8,m:31},11:{d:7,h:15,m:40},12:{d:8,h:3,m:24}},1995:{1:{d:6,h:20,m:16},2:{d:4,h:8,m:13},3:{d:6,h:2,m:14},4:{d:5,h:20,m:21},5:{d:6,h:13,m:35},6:{d:6,h:20,m:34},7:{d:7,h:20,m:0},8:{d:8,h:13,m:14},9:{d:8,h:23,m:13},10:{d:9,h:14,m:27},11:{d:7,h:21,m:35},12:{d:8,h:9,m:18}},1996:{1:{d:6,h:5,m:3},2:{d:4,h:17,m:8},3:{d:5,h:11,m:3},4:{d:5,h:5,m:14},5:{d:5,h:22,m:49},6:{d:6,h:6,m:2},7:{d:7,h:5,m:28},8:{d:7,h:23,m:2},9:{d:8,h:7,m:43},10:{d:8,h:23,m:8},11:{d:7,h:7,m:12},12:{d:7,h:17,m:47}},1997:{1:{d:6,h:11,m:0},2:{d:4,h:22,m:45},3:{d:5,h:17,m:3},4:{d:5,h:11,m:2},5:{d:6,h:4,m:18},6:{d:6,h:11,m:21},7:{d:7,h:10,m:46},8:{d:8,h:4,m:9},9:{d:8,h:13,m:56},10:{d:9,h:5,m:15},11:{d:7,h:12,m:22},12:{d:7,h:23,m:8}},1998:{1:{d:6,h:16,m:55},2:{d:4,h:4,m:51},3:{d:5,h:22,m:54},4:{d:5,h:16,m:57},5:{d:6,h:10,m:6},6:{d:6,h:17,m:4},7:{d:7,h:16,m:20},8:{d:8,h:9,m:40},9:{d:8,h:19,m:31},10:{d:9,h:10,m:47},11:{d:7,h:17,m:59},12:{d:8,h:5,m:41}},1999:{1:{d:5,h:22,m:39},2:{d:4,h:10,m:57},3:{d:6,h:4,m:57},4:{d:5,h:22,m:46},5:{d:6,h:15,m:52},6:{d:6,h:22,m:55},7:{d:7,h:22,m:15},8:{d:8,h:15,m:37},9:{d:9,h:1,m:20},10:{d:9,h:16,m:25},11:{d:7,h:23,m:24},12:{d:8,h:11,m:15}},2000:{1:{d:6,h:4,m:14},2:{d:4,h:16,m:32},3:{d:5,h:10,m:35},4:{d:5,h:4,m:15},5:{d:5,h:21,m:23},6:{d:5,h:4,m:48},7:{d:6,h:23,m:1},8:{d:7,h:16,m:39},9:{d:7,h:2,m:10},10:{d:7,h:17,m:30},11:{d:6,h:0,m:14},12:{d:6,h:10,m:33}}};
var PREFS=[{name:'北海道',cities:[{n:'札幌市',l:141.35},{n:'函館市',l:140.73}]},{name:'青森県',cities:[{n:'青森市',l:140.74}]},{name:'岩手県',cities:[{n:'盛岡市',l:141.15}]},{name:'宮城県',cities:[{n:'仙台市',l:140.87}]},{name:'秋田県',cities:[{n:'秋田市',l:140.10}]},{name:'山形県',cities:[{n:'山形市',l:140.36}]},{name:'福島県',cities:[{n:'福島市',l:140.47}]},{name:'茨城県',cities:[{n:'水戸市',l:140.45}]},{name:'栃木県',cities:[{n:'宇都宮市',l:139.88}]},{name:'群馬県',cities:[{n:'前橋市',l:139.06}]},{name:'埼玉県',cities:[{n:'さいたま市',l:139.63}]},{name:'千葉県',cities:[{n:'千葉市',l:140.12}]},{name:'東京都',cities:[{n:'千代田区',l:139.75},{n:'新宿区',l:139.69},{n:'渋谷区',l:139.70}]},{name:'神奈川県',cities:[{n:'横浜市',l:139.64},{n:'川崎市',l:139.70},{n:'相模原市',l:139.37},{n:'藤沢市',l:139.48},{n:'横須賀市',l:139.67},{n:'平塚市',l:139.35},{n:'小田原市',l:139.16},{n:'厚木市',l:139.36},{n:'茅ヶ崎市',l:139.40},{n:'鎌倉市',l:139.55}]},{name:'新潟県',cities:[{n:'新潟市',l:139.02}]},{name:'富山県',cities:[{n:'富山市',l:137.21}]},{name:'石川県',cities:[{n:'金沢市',l:136.62}]},{name:'福井県',cities:[{n:'福井市',l:136.22}]},{name:'山梨県',cities:[{n:'甲府市',l:138.57}]},{name:'長野県',cities:[{n:'長野市',l:138.19}]},{name:'岐阜県',cities:[{n:'岐阜市',l:136.72}]},{name:'静岡県',cities:[{n:'静岡市',l:138.38}]},{name:'愛知県',cities:[{n:'名古屋市',l:136.91}]},{name:'三重県',cities:[{n:'津市',l:136.51}]},{name:'滋賀県',cities:[{n:'大津市',l:135.87}]},{name:'京都府',cities:[{n:'京都市',l:135.77}]},{name:'大阪府',cities:[{n:'大阪市',l:135.50},{n:'堺市',l:135.47},{n:'東大阪市',l:135.60}]},{name:'兵庫県',cities:[{n:'神戸市',l:135.19},{n:'姫路市',l:134.69},{n:'西宮市',l:135.34},{n:'尼崎市',l:135.41},{n:'明石市',l:134.99}]},{name:'奈良県',cities:[{n:'奈良市',l:135.83}]},{name:'和歌山県',cities:[{n:'和歌山市',l:135.17}]},{name:'鳥取県',cities:[{n:'鳥取市',l:134.24}]},{name:'島根県',cities:[{n:'松江市',l:133.05}]},{name:'岡山県',cities:[{n:'岡山市',l:133.93}]},{name:'広島県',cities:[{n:'広島市',l:132.46}]},{name:'山口県',cities:[{n:'山口市',l:131.47}]},{name:'徳島県',cities:[{n:'徳島市',l:134.56}]},{name:'香川県',cities:[{n:'高松市',l:134.05}]},{name:'愛媛県',cities:[{n:'松山市',l:132.77}]},{name:'高知県',cities:[{n:'高知市',l:133.55}]},{name:'福岡県',cities:[{n:'福岡市',l:130.40},{n:'北九州市',l:130.88}]},{name:'佐賀県',cities:[{n:'佐賀市',l:130.30}]},{name:'長崎県',cities:[{n:'長崎市',l:129.87}]},{name:'熊本県',cities:[{n:'熊本市',l:130.74}]},{name:'大分県',cities:[{n:'大分市',l:131.61}]},{name:'宮崎県',cities:[{n:'宮崎市',l:131.42}]},{name:'鹿児島県',cities:[{n:'鹿児島市',l:130.56}]},{name:'沖縄県',cities:[{n:'那覇市',l:127.68},{n:'石垣市',l:124.16}]}];
var KANGO=[[0,5],[2,7],[4,9],[6,1],[8,3]],HANGO=[[0,8],[0,4],[3,11],[3,7],[6,2],[6,10],[9,5],[9,1]],SHIGO=[[0,1],[11,2],[10,3],[9,4],[8,5],[7,6]],CHU=[[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]],KEI_PAIRS=[[10,1],[1,7],[7,10],[5,2],[2,8],[8,5],[0,3]],KEI_SELF=[4,6,9,11];
function isKan(k1,k2){for(var i=0;i<KANGO.length;i++){var p=KANGO[i];if((k1===p[0]&&k2===p[1])||(k1===p[1]&&k2===p[0]))return true;}return false;}
function isHango(s1,s2){for(var i=0;i<HANGO.length;i++){var p=HANGO[i];if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0]))return true;}return false;}
function getSekki(y,m){if(SEKKI[y]&&SEKKI[y][m])return SEKKI[y][m];return{d:6,h:6,m:0};}
function jd(y,m,d,h){if(m<=2){y--;m+=12;}var A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+h/24+B-1524.5;}
function eqT(j){var T=(j-2451545)/36525,eps=(23.4393-0.013*T)*Math.PI/180,L0=(280.46646+36000.76983*T)*Math.PI/180,e=0.016708634-0.000042037*T,M=(357.52911+35999.05029*T)*Math.PI/180,y2=Math.tan(eps/2)*Math.tan(eps/2);return(y2*Math.sin(2*L0)-2*e*Math.sin(M)+4*e*y2*Math.sin(M)*Math.cos(2*L0)-0.5*y2*y2*Math.sin(4*L0)-1.25*e*e*Math.sin(2*M))*4*180/Math.PI;}
function calcPillars(yr,mo,dy,hr,mn,lon){var ld=(lon-135.0)*4,j=jd(yr,mo,dy,hr+mn/60);var tt=((hr*60+mn+ld+eqT(j))%1440+1440)%1440,tH=Math.floor(tt/60);var sk=getSekki(yr,mo),bef=(dy*1440+hr*60+mn)<(sk.d*1440+sk.h*60+sk.m);var nY=yr;if(mo===1){nY=yr-1;}else if(mo===2&&bef){nY=yr-1;}var nKi=((nY-4)%10+10)%10,nSi=((nY-4)%12+12)%12;var mY=yr,mM=mo;if(bef){mM--;if(mM<=0){mM=12;mY--;}}var gY=mY;if(mM===1)gY=mY-1;var gKi=((gY-4)%10+10)%10;var moKi=(GOKOTSU[gKi]+(mM-2+12)%12)%10,moSi=MO_SHI[mM];var dJ=Math.floor(jd(yr,mo,dy,12)),dSt=((dJ+49)%10+10)%10,dSi=((dJ+49)%12+12)%12;var sH=Math.floor(((tH+1)%24)/2),hKi=([0,2,4,6,8][dSt%5]+sH)%10;return [{k:nKi,s:nSi},{k:moKi,s:moSi},{k:dSt,s:dSi},{k:hKi,s:sH}];}
function checkRelations(myP,thP){var res={kango:[],sango:[],shigo:[],chu:[],kei:[]};for(var i=0;i<4;i++){for(var j=0;j<4;j++){if(isKan(myP[i].k,thP[j].k))res.kango.push({label:KAN[myP[i].k]+'✕'+KAN[thP[j].k],mi:i,ti:j});}}for(var i=0;i<4;i++){for(var j=0;j<4;j++){var s1=myP[i].s,s2=thP[j].s;if(isHango(s1,s2))res.sango.push({label:SHI[s1]+'・'+SHI[s2]+'（半会）',mi:i,ti:j});}}for(var i=0;i<4;i++){for(var j=0;j<4;j++){var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<SHIGO.length;p++){var sp=SHIGO[p];if((s1===sp[0]&&s2===sp[1])||(s1===sp[1]&&s2===sp[0])){var isBoth=(s1===8&&s2===5)||(s1===5&&s2===8);res.shigo.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:isBoth?'both':'g'});if(isBoth)res.kei.push({label:SHI[s1]+'・'+SHI[s2]+'（支合も）',mi:i,ti:j,type:'both'});}}}}for(var i=0;i<4;i++){for(var j=0;j<4;j++){var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<CHU.length;p++){var cp=CHU[p];if((s1===cp[0]&&s2===cp[1])||(s1===cp[1]&&s2===cp[0]))res.chu.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:'r'});}}}for(var i=0;i<4;i++){for(var j=0;j<4;j++){var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<KEI_PAIRS.length;p++){var kp=KEI_PAIRS[p];if((s1===kp[0]&&s2===kp[1])||(s1===kp[1]&&s2===kp[0]))res.kei.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:'r'});}}}for(var i=0;i<4;i++){for(var j=0;j<4;j++){if(myP[i].s===thP[j].s&&KEI_SELF.indexOf(myP[i].s)>=0)res.kei.push({label:SHI[myP[i].s]+'（自刑）',mi:i,ti:j,type:'r'});}}return res;}
function calcScore(rel){return Math.min(99,Math.max(15,50+rel.kango.length*4+rel.sango.length*10+rel.shigo.length*7-rel.chu.length*7-rel.kei.length*10));}
function generateComment(rel){var kg=rel.kango.length,sg=rel.sango.length,sh=rel.shigo.length,ch=rel.chu.length,ke=rel.kei.length,good=kg+sg+sh,bad=ch+ke;if(kg>=3&&bad===0)return '一目会った瞬間から惹かれ合い、安定した関係を築きやすい、理想的な縁です。';if(kg>=2&&sh>=1&&bad===0)return '会った時から自然に引き合い、穏やかな関係が築けそうです。';if(kg>=1&&sg>=1&&bad===0)return 'どこか懐かしさを感じ、価値観も合う良い縁です。';if(good>=2&&bad===0)return 'バランスの取れた良縁です。自然な形で関係が深まっていきやすい組み合わせです。';if(bad>=3&&good<=1)return '縁自体はあるものの、衝突やトラブルが多くなりやすい組み合わせです。';return '個性ある縁の組み合わせです。お互いの違いを尊重することで良い関係が育まれそうです。';}
function updateEnBadge(){var p=enList.filter(function(e){return e.status==='pending';}).length;['en-badge','bni-badge'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display=p>0?'block':'none';});}
function renderEnList(){
  var el=document.getElementById('en-list'),empty=document.getElementById('en-empty');
  if(!el)return;
  if(enList.length===0){el.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  // ソート：新しいマッチを上に
  var statusOrder={approved:0,approved_by_me:1,chatting:2,date_set:3,dated:4,coupled:5,pending:6,sent:7,rejected_notify:8,matched:9};
  var sorted=enList.slice().sort(function(a,b){return (statusOrder[a.status]||99)-(statusOrder[b.status]||99);});
  var html='';
  sorted.forEach(function(item){
    var s=item.status;
    var badgeLabel={'matched':'やりとり中','approved':'承認されました！','approved_by_me':'承認しました','sent':'申請中','pending':'承認待ち','rejected_notify':'キャンセル','chatting':'やりとり中','date_set':'デート決定！','dated':'デート完了','coupled':'カップル成立！'}[s]||s;
    var badgeClass='pending';
    if(s==='matched'||s==='approved'||s==='approved_by_me'||s==='chatting')badgeClass='chatting';
    if(s==='date_set')badgeClass='date-set';
    if(s==='dated')badgeClass='dated';
    if(s==='coupled')badgeClass='coupled';
    if(s==='approved'||s==='approved_by_me')badgeClass='matched';
    var isCompact=(s==='matched'||s==='chatting'||s==='date_set'||s==='dated'||s==='coupled');
    html+='<div class="en-card '+(isCompact?'en-card-compact':'')+' '+((s==='matched'||s==='chatting'||s==='approved'||s==='approved_by_me'||s==='date_set'||s==='dated'||s==='coupled')?'matched':'')+'">';
    html+='<div class="en-top"><div class="ava">'+item.name.charAt(0)+'</div><div class="minfo"><div class="mname">'+item.name+'<span class="en-badge '+badgeClass+'">'+badgeLabel+'</span></div><div class="mmeta">'+item.meta+'</div></div></div>';
    if(s==='pending'){
      html+='<div class="en-actions"><button class="btn-ok" onclick="enOK(\''+item.matchId+'\')">お話しOK</button><button class="btn-ng" onclick="enNG(\''+item.matchId+'\')">ごめんなさい</button></div>';
    }else if(s==='approved_by_me'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'の申請を承認しました</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='approved'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;margin-bottom:.4rem">'+item.name+'が申請を承認しました！</div>';
      html+='<div class="en-actions"><button class="btn-ok" onclick="startChatting(\''+item.matchId+'\');openChat(\''+item.name+'\')">メッセージを送る</button><button class="btn-ng" onclick="startChatting(\''+item.matchId+'\')">後で送る</button></div>';
    }else if(s==='matched'||s==='chatting'){
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\')">メッセージ</button><button class="en-phase-btn primary" onclick="setDateDecided(\''+item.matchId+'\')">デート決定！</button><button class="en-phase-btn secondary" onclick="endWithThanks(\''+item.matchId+'\')">感謝して完了</button></div>';
    }else if(s==='date_set'){
      html+='<div class="en-phase-btns"><button class="en-phase-btn primary" onclick="openChat(\''+item.name+'\')">メッセージ</button><button class="en-phase-btn primary" onclick="setCoupled(\''+item.matchId+'\')">付き合いました！</button><button class="en-phase-btn secondary" onclick="openReview(\''+item.matchId+'\')">お相手をレビュー</button></div>';
    }else if(s==='dated'){
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.3rem 0">レビュー済み・完了</div>';
    }else if(s==='coupled'){
      html+='<div style="font-size:12px;color:#C9A96E;text-align:center;padding:.3rem 0">🎊 おめでとうございます！卒業鑑定プランが解放されました</div>';
    }else if(s==='rejected_notify'){
      html+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:.5rem 0">'+item.name+'が申請をキャンセルしました</div>';
      html+='<div style="text-align:center;margin-top:.25rem"><button style="font-size:10px;color:var(--color-text-tertiary);background:transparent;border:0.5px solid var(--color-border-tertiary);border-radius:6px;padding:4px 12px;cursor:pointer" onclick="dismissRejected(\''+item.matchId+'\')">閉じる</button></div>';
    }
    html+='</div>';
  });
  el.innerHTML=html;
}

// ===== フェーズ遷移関数 =====
async function startChatting(matchId){
  try{await supa.from('matches').update({status:'chatting'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='chatting';
  renderEnList();renderMsgList();
}
function dismissApproved(matchId){
  startChatting(matchId);
}
async function setDateDecided(matchId){
  try{await supa.from('matches').update({status:'date_set'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='date_set';
  renderEnList();
}
async function endWithThanks(matchId){
  try{await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);}catch(e){}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();updateEnBadge();loadRealUsers();
}
async function setCoupled(matchId){
  try{await supa.from('matches').update({status:'coupled'}).eq('id',matchId);}catch(e){}
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='coupled';
  renderEnList();
  // 卒業鑑定プラン解放
  unlockSotsugyou();
}
function openReview(matchId){
  document.getElementById('review-match-id').value=matchId;
  document.getElementById('review-overlay').classList.add('show');
  document.getElementById('review-error').textContent='';
  document.getElementById('review-comment').value='';
  document.querySelectorAll('.star').forEach(function(s){s.classList.remove('on');});
  currentReviewStar=0;
}
var currentReviewStar=0;
function setStar(n){
  currentReviewStar=n;
  document.querySelectorAll('.star').forEach(function(s,i){s.classList.toggle('on',i<n);});
}
async function submitReview(){
  var matchId=document.getElementById('review-match-id').value;
  var comment=document.getElementById('review-comment').value.trim();
  var errEl=document.getElementById('review-error');
  if(currentReviewStar===0){errEl.textContent='★評価を選択してください';return;}
  if(!comment){errEl.textContent='コメントを入力してください';return;}
  try{
    await supa.from('matches').update({status:'reviewed'}).eq('id',matchId);
    // レビューデータをmessagesテーブルに保存（運営向け）
    await supa.from('messages').insert({sender_id:currentUser.id,receiver_id:currentUser.id,content:'【レビュー】★'+currentReviewStar+' '+comment,is_official:true});
  }catch(e){console.log('レビュー送信エラー:',e);}
  document.getElementById('review-overlay').classList.remove('show');
  var item=enList.find(function(e){return e.matchId===matchId;});
  if(item)item.status='dated';
  renderEnList();
}
async function dismissRejected(matchId){
  try{
    await supa.from('matches').update({status:'dismissed'}).eq('id',matchId);
  }catch(e){console.log('dismissed更新エラー:',e);}
  enList=enList.filter(function(e){return e.matchId!==matchId;});
  renderEnList();
  updateEnBadge();
  loadRealUsers();
}
async function enOK(matchId){
  try{
    var{error}=await supa.from('matches').update({status:'matched'}).eq('id',matchId);
    if(error){alert('承認エラー：'+error.message);return;}
    loadEnList();
  }catch(e){console.log('enOKエラー:',e);}
}
async function enNG(matchId){
  try{
    var{error}=await supa.from('matches').update({status:'rejected'}).eq('id',matchId);
    if(error){alert('拒否エラー：'+error.message);return;}
    loadEnList();
    loadRealUsers();
  }catch(e){console.log('enNGエラー:',e);}
}
async function hanashi(idx){
  var partner=PARTNERS[idx];
  if(!partner||!partner.userId||partner.isDemo){
    // デモユーザーの場合はボタン変更のみ
    var btn=document.getElementById('hanashi-btn-'+idx);
    if(btn){btn.textContent='デモのため送信不可';btn.classList.add('sent');btn.disabled=true;}
    return;
  }
  var btn=document.getElementById('hanashi-btn-'+idx);
  if(btn){btn.textContent='送信中...';btn.disabled=true;}
  try{
    // 既に申請済みか確認
    var{data:existing}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('to_user_id',partner.userId);
    if(existing&&existing.length>0){if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');}return;}
    // matchesテーブルに保存
    var{error}=await supa.from('matches').insert({from_user_id:currentUser.id,to_user_id:partner.userId,status:'pending'});
    if(error){alert('申請エラー：'+error.message);if(btn){btn.textContent='話してみたい';btn.disabled=false;}return;}
    if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');}
    loadEnList();
  }catch(e){console.log('hanashiエラー:',e);if(btn){btn.textContent='話してみたい';btn.disabled=false;}}
}
function renderMsgList(){var matched=enList.filter(function(e){return e.status==='matched';});var container=document.getElementById('msg-list-items');if(matched.length===0){container.innerHTML='';return;}var html='';matched.forEach(function(item,i){var unread=(i===0);html+='<div class="msg-list-item" onclick="openChat(\''+item.name+'\')"><div class="msg-list-ava">'+item.name.charAt(0)+(unread?'<div class="msg-unread-dot"></div>':'')+'</div><div class="msg-list-info"><div class="msg-list-name">'+item.name+'</div><div class="msg-list-preview">ほんとですね。どちらにお住まいですか？</div></div><div class="msg-list-time">11:20</div></div>';});container.innerHTML=html;}
function openChat(name){document.getElementById('chat-name').textContent=name;document.getElementById('chat-ava').textContent=name.charAt(0);document.getElementById('chat-ava').className='msg-list-ava';document.getElementById('chat-official-badge').style.display='none';document.getElementById('msg-list-view').style.display='none';document.getElementById('msg-chat-view').style.display='block';var body=document.getElementById('chat-body');body.innerHTML='<div class="mcnt">残り 28 / 30 回</div><div class="msg-wrap"><div class="bubble">はじめまして！よろしくお願いします。</div><div class="mtime">'+name+'｜11:02</div></div><div class="msg-wrap me"><div class="bubble me">こちらこそ！よろしくお願いします！</div><div class="mtime">11:15</div></div><div class="msg-wrap"><div class="bubble">どちらにお住まいですか？</div><div class="mtime">'+name+'｜11:20</div></div><div style="display:flex;gap:8px;margin-top:.75rem"><input type="text" placeholder="メッセージを入力..." style="flex:1;font-size:13px"><button style="padding:0 14px;border:0.5px solid #C9A96E;border-radius:6px;font-size:12px;color:#C9A96E;background:transparent;cursor:pointer;white-space:nowrap">送信</button></div><div style="font-size:10px;color:var(--color-text-tertiary);margin-top:.6rem;line-height:1.7">※ メッセージは30回まで。他のSNSのIDやリンクを交換するのは規約違反となります。</div>';goTab(2);}
function showMsgList(){document.getElementById('msg-list-view').style.display='block';document.getElementById('msg-chat-view').style.display='none';}
function toggleSubMenu(e){if(e)e.stopPropagation();var el=document.getElementById('sub-menu');if(el)el.classList.toggle('show');}
function closeSubMenu(){var el=document.getElementById('sub-menu');if(el)el.classList.remove('show');}
function openSubPage(page){['plan','omoi','voice','contact'].forEach(function(p){document.getElementById('sub-'+p).style.display='none';});document.getElementById('sub-'+page).style.display='block';document.querySelectorAll('.screen').forEach(function(s,i){s.classList.toggle('on',i===3);});document.querySelectorAll('.ntab').forEach(function(t,i){t.classList.toggle('on',i===3);});document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.add('on');});document.querySelectorAll('.bni').forEach(function(b,i){b.classList.toggle('on',i===3);});}
function applyFilter(){var minScore=parseInt(document.getElementById('f-score').value)||0;if(minScore<50)minScore=50;var filtered=ALL_SORTED.filter(function(item){if(ngList.indexOf(item.i)>=0)return false;if(item.score<minScore)return false;return true;});renderFiltered(filtered);}
function renderFiltered(list){var container=document.getElementById('match-list');if(list.length===0){container.innerHTML='<div class="no-result">条件に合う方が見つかりませんでした。</div>';return;}var html='';var hasDemo=list.some(function(item){return item.isDemo;});if(hasDemo&&!demoGuideDismissed){html+='<div class="demo-guide" id="demo-guide">リアルユーザーの推しが現れたら、このデモユーザーのように、<br>このページに追加されていきます。<br><br>良縁率80%以上の方は【運命の相手候補】なので要チェック！<br><span class="demo-guide-close" onclick="dismissDemoGuide()">閉じる</span></div>';}list.forEach(function(item){html+=buildDetail(item.i,MY_PILLARS,item.p,item.score,item.tags,item.isDemo);});container.innerHTML=html;
    // 申請済みのボタンを更新
    if(currentUser){
      supa.from('matches').select('to_user_id').eq('from_user_id',currentUser.id).then(function(res){
        if(res.data){
          var sentIds=res.data.map(function(m){return m.to_user_id;});
          PARTNERS.forEach(function(p,i){
            if(p.userId&&sentIds.indexOf(p.userId)>=0){
              var btn=document.getElementById('hanashi-btn-'+i);
              if(btn){btn.textContent='申請済み ✓';btn.classList.add('sent');btn.disabled=true;}
            }
          });
        }
      });
    }}
function dismissDemoGuide(){demoGuideDismissed=true;var el=document.getElementById('demo-guide');if(el)el.remove();}
function buildDetail(idx,myP,partner,score,tagsHtml,isDemo){var rel=REL_CACHE[idx];var card='<div class="match-card" id="card'+idx+'" onclick="toggleDetail('+idx+')">'+'<div class="ava-blur">🙂</div>'+'<div class="minfo"><div class="mname">'+partner.name+(isDemo?'<span class="demo-badge">デモ</span>':'')+'</div><div class="mmeta">'+partner.meta+'</div><div class="tags">'+tagsHtml+'</div><div class="abar"><div class="afill" style="width:'+score+'%"></div></div><div class="albl">良縁率：'+score+'%</div></div><div class="ndot"></div></div>';var cmp='<div class="compare-wrap" id="cwrap'+idx+'"><div class="compare-grid"><div class="pcol"><div class="col-lbl">あなた</div>';for(var pi=0;pi<4;pi++){cmp+='<div class="pce mine" id="mypc_'+idx+'_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="mykan_'+idx+'_'+pi+'">'+KAN[myP[pi].k]+'</div><div class="pce-s" id="myshi_'+idx+'_'+pi+'">'+SHI[myP[pi].s]+'</div></div>';}cmp+='</div><div class="pcol"><div class="col-lbl">'+partner.name+'</div>';for(var pi=0;pi<4;pi++){cmp+='<div class="pce" id="thpc_'+idx+'_'+pi+'"><div class="pce-lbl">'+PL[pi]+'</div><div class="pce-k" id="thkan_'+idx+'_'+pi+'">'+KAN[partner.pillars[pi].k]+'</div><div class="pce-s" id="thshi_'+idx+'_'+pi+'">'+SHI[partner.pillars[pi].s]+'</div></div>';}cmp+='</div></div><svg class="svg-ov" id="svg'+idx+'"></svg></div>';function rSec(title,items,desc){var isBad=(title==='冲'||title==='刑'),cnt=items.length>0?items.length+'組':'なし',cntCls=items.length>0?(isBad?'r':''):'none';var h='<div class="rel-sec"><div class="rel-hd"><span class="rel-nm">'+title+'</span><span class="rel-cnt '+cntCls+'">'+cnt+'</span></div>';if(items.length>0){h+='<div class="rel-pairs">';items.forEach(function(item,ii){var cls=item.type==='both'?'both':(isBad?'r':'g');h+='<span class="rel-pair '+cls+'" data-ridx="'+idx+'" data-type="'+title+'" data-ii="'+ii+'">'+item.label+' '+PL[item.mi]+'↔'+PL[item.ti]+'</span>';});h+='</div>';}return h+'<div class="rel-desc">'+desc+'</div></div>';}return card+'<div class="detail-panel" id="detail'+idx+'"><div class="card" style="margin:0 0 .75rem"><div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:.6rem">四柱の比較（ペアをタップで干支を強調）</div>'+cmp+'<div class="comment-box">'+generateComment(rel)+'</div><div class="rel-div"></div>'+rSec('干合',rel.kango,'多ければ多いほど一目で惹かれる')+rSec('三合',rel.sango,'価値観や考え方が似ていて安定した関係')+rSec('支合',rel.shigo,'互いに助け合い調和を象徴する良き関係')+rSec('冲',rel.chu,'反発や衝突が起きやすい関係')+rSec('刑',rel.kei,'トラブルや泥沼化になりやすい関係')+'<button class="btn-hanashi" id="hanashi-btn-'+idx+'" onclick="hanashi('+idx+')">話してみたい</button></div></div>';}
var PARTNERS=[{name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},{name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},{name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},{name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},{name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}];
var DEMO_MALE=[{name:'ゆうきさん',meta:'28歳・東京都・初婚・子なし',pillars:calcPillars(1997,8,15,10,30,139.75),isDemo:true,sex:'男性'},{name:'れんさん',meta:'31歳・大阪府・初婚・子なし',pillars:calcPillars(1994,4,22,7,0,135.50),isDemo:true,sex:'男性'},{name:'はるとさん',meta:'33歳・神奈川県・初婚・子なし',pillars:calcPillars(1992,12,3,21,45,139.64),isDemo:true,sex:'男性'},{name:'そうたさん',meta:'29歳・京都府・初婚・子なし',pillars:calcPillars(1996,6,18,15,20,135.77),isDemo:true,sex:'男性'},{name:'かいとさん',meta:'35歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,2,8,5,10,135.19),isDemo:true,sex:'男性'}];
var demoGuideDismissed=false;
function renderMatchList(myP){var cache={};for(var i=0;i<PARTNERS.length;i++)cache[i]=checkRelations(myP,PARTNERS[i].pillars);REL_CACHE=cache;PARTNERS_DATA=[];ALL_SORTED=PARTNERS.map(function(p,i){var sc=calcScore(cache[i]),rel=cache[i],th='';if(rel.kango.length>0)th+='<span class="tag g">干合：'+rel.kango.length+'</span>';if(rel.sango.length>0)th+='<span class="tag g">三合：'+rel.sango.length+'</span>';if(rel.shigo.length>0)th+='<span class="tag g">支合：'+rel.shigo.length+'</span>';if(rel.chu.length>0)th+='<span class="tag r">冲：'+rel.chu.length+'</span>';if(rel.kei.length>0)th+='<span class="tag r">刑：'+rel.kei.length+'</span>';PARTNERS_DATA[i]={name:p.name,meta:p.meta,score:sc,tags:th,isDemo:p.isDemo||false};return{p:p,i:i,score:sc,tags:th,isDemo:p.isDemo||false};});ALL_SORTED.sort(function(a,b){return b.score-a.score;});applyFilter();}
function previewImg(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){savedImgSrc=ev.target.result;document.getElementById('preview-img').src=savedImgSrc;document.getElementById('preview-img').style.display='block';document.getElementById('img-ph').style.display='none';};reader.readAsDataURL(file);}
function toggleKodomo(){document.getElementById('kodomo-row').style.display=document.getElementById('r-kodomo').value==='yes'?'block':'none';}
function setSex(el){document.querySelectorAll('#r-sex-row .sxbtn').forEach(function(b){b.classList.remove('on');});el.classList.add('on');}
function calcMeishiki(){var yr=parseInt(document.getElementById('yr').value)||1996,mo=parseInt(document.getElementById('mo').value)||1,dy=parseInt(document.getElementById('dy').value)||1,hr=parseInt(document.getElementById('hr').value)||0,mn=parseInt(document.getElementById('mn').value)||0;var lon=parseFloat(document.getElementById('city').value)||135.0,cName=document.getElementById('city').options[document.getElementById('city').selectedIndex].text;var ld=(lon-135.0)*4,j=jd(yr,mo,dy,hr+mn/60),eq=eqT(j),tt=((hr*60+mn+ld+eq)%1440+1440)%1440,tH=Math.floor(tt/60),tM=Math.round(tt%60);var sk=getSekki(yr,mo),bef=(dy*1440+hr*60+mn)<(sk.d*1440+sk.h*60+sk.m);var nY=yr;if(mo===1){nY=yr-1;}else if(mo===2&&bef){nY=yr-1;}var nKi=((nY-4)%10+10)%10,nSi=((nY-4)%12+12)%12;var mY=yr,mM=mo;if(bef){mM--;if(mM<=0){mM=12;mY--;}}var gY=mY;if(mM===1)gY=mY-1;var gKi=((gY-4)%10+10)%10;var moKi=(GOKOTSU[gKi]+(mM-2+12)%12)%10,moSi=MO_SHI[mM];var dJ=Math.floor(jd(yr,mo,dy,12)),dSt=((dJ+49)%10+10)%10,dSi=((dJ+49)%12+12)%12;var sH=Math.floor(((tH+1)%24)/2),hKi=([0,2,4,6,8][dSt%5]+sH)%10;savedPillars=[{k:nKi,s:nSi},{k:moKi,s:moSi},{k:dSt,s:dSi},{k:hKi,s:sH}];var h='';savedPillars.forEach(function(p,i){h+='<div class="pc'+(i===2?' day':'')+'"><div class="pc-lbl">'+PL[i]+'</div><div class="pc-kan">'+KAN[p.k]+'</div><div class="pc-shi">'+SHI[p.s]+'</div></div>';});document.getElementById('pillars').innerHTML=h;var dbgEl=document.getElementById('dbg');dbgEl.style.display='block';dbgEl.className='dbg';dbgEl.innerHTML='<div class="dr"><span>出生地</span><span class="dv">'+cName+'</span></div><div class="dr"><span>真太陽時</span><span class="dv">'+String(tH).padStart(2,'0')+'時'+String(tM).padStart(2,'0')+'分</span></div><div class="dr"><span>判定</span><span class="dv">'+(bef?'節入り前':'節入り後')+'</span></div>';}
function completeRegDemo(){memberID=generateMemberID();var nick=document.getElementById('r-nick').value||'名無し';var sexEl=document.querySelector('#r-sex-row .sxbtn.on');var sex=sexEl?sexEl.textContent:'不明';var res=document.getElementById('r-res').value||'未設定';var marriage=document.getElementById('r-marriage').value;var kodomo=document.getElementById('r-kodomo').value==='yes'?document.getElementById('r-kodomo-cnt').value:'なし';var yr=parseInt(document.getElementById('yr').value)||1996,mo=parseInt(document.getElementById('mo').value)||1,dy=parseInt(document.getElementById('dy').value)||1;document.getElementById('topbar-initial').textContent=nick.charAt(0);document.getElementById('modal-ava-ph').textContent=nick.charAt(0);if(savedImgSrc){var ti=document.getElementById('topbar-ava');ti.src=savedImgSrc;ti.style.display='block';document.getElementById('topbar-initial').style.display='none';var mi=document.getElementById('modal-ava-img');mi.src=savedImgSrc;mi.style.display='block';document.getElementById('modal-ava-ph').style.display='none';}document.getElementById('modal-info').innerHTML='<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+nick+'</span></div><div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+sex+'</span></div><div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+res+'</span></div><div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+yr+'年'+mo+'月'+dy+'日</span></div><div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+marriage+'</span></div><div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+kodomo+'</span></div>';document.getElementById('modal-member-id').textContent=memberID;document.getElementById('contact-id').value=memberID;document.getElementById('contact-nick').value=nick;if(savedPillars.length===0){var lon=parseFloat(document.getElementById('city').value)||135.0;savedPillars=calcPillars(yr,mo,dy,parseInt(document.getElementById('hr').value)||0,parseInt(document.getElementById('mn').value)||0,lon);}if(savedPillars.length>0){var h='';savedPillars.forEach(function(p,i){h+='<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';});document.getElementById('modal-pillars').innerHTML=h;}MY_PILLARS=savedPillars;document.getElementById('reg-wrap').style.display='none';document.getElementById('orient-wrap').style.display='none';document.getElementById('login-wrap').style.display='none';showAppWrap();renderMatchList(MY_PILLARS);}
function goTab(i){if(!document.getElementById('s0'))return;document.querySelectorAll('.ntab').forEach(function(t,idx){t.classList.toggle('on',idx===i);});document.querySelectorAll('.other-tab-btn').forEach(function(b){b.classList.toggle('on',i===3);});document.querySelectorAll('.screen').forEach(function(s,idx){s.classList.toggle('on',idx===i);});document.querySelectorAll('.bni').forEach(function(b,idx){b.classList.toggle('on',idx===i);});}
function toggleModal(){document.getElementById('profile-modal').classList.toggle('show');}
function toggleFilter(){var b=document.getElementById('filter-body'),ic=document.getElementById('filter-icon');var o=b.classList.contains('open');b.classList.toggle('open',!o);ic.classList.toggle('open',!o);}
function toggleAge(type){ageState[type]=!ageState[type];document.getElementById('age-'+type).classList.toggle('on',ageState[type]);document.getElementById('row-upper').style.display=ageState.older?'flex':'none';document.getElementById('row-lower').style.display=ageState.younger?'flex':'none';updateAgeSummary();applyFilter();}
function updateAgeSummary(){if(!document.getElementById('age-upper'))return;var u=parseInt(document.getElementById('age-upper').value),l=parseInt(document.getElementById('age-lower').value),p=[];p.push(ageState.older?(u===0?'年上：指定しない':'最大'+u+'歳上まで'):'年上：なし');p.push(ageState.younger?(l===0?'年下：指定しない':'最大'+l+'歳下まで'):'年下：なし');document.getElementById('age-sum').textContent=p.join('・');}
function toggleDetail(idx){var d=document.getElementById('detail'+idx),c=document.getElementById('card'+idx);var isOpen=d.classList.contains('open');document.querySelectorAll('.detail-panel').forEach(function(p){p.classList.remove('open');});document.querySelectorAll('.match-card').forEach(function(c2){c2.classList.remove('open');});clearAllSvg();if(!isOpen){d.classList.add('open');c.classList.add('open');}}
function clearAllSvg(){document.querySelectorAll('.svg-ov').forEach(function(s){s.innerHTML='';}); }
function clearSvg(idx){var s=document.getElementById('svg'+idx);if(s)s.innerHTML='';}
function getCenter(el,svgEl){var sr=svgEl.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:(r.left+r.right)/2-sr.left,y:(r.top+r.bottom)/2-sr.top,w:r.width,h:r.height};}
function drawCircle(svg,cx,cy,rw,rh,color){var el=document.createElementNS('http://www.w3.org/2000/svg','ellipse');el.setAttribute('cx',cx);el.setAttribute('cy',cy);el.setAttribute('rx',rw/2+5);el.setAttribute('ry',rh/2+5);el.setAttribute('fill','none');el.setAttribute('stroke',color);el.setAttribute('stroke-width','2');el.setAttribute('stroke-dasharray','5 3');svg.appendChild(el);}
function drawLine(svg,x1,y1,x2,y2,color){var line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2);line.setAttribute('stroke',color);line.setAttribute('stroke-width','1.5');line.setAttribute('stroke-dasharray','5 3');line.setAttribute('opacity','0.85');svg.appendChild(line);}
function highlightPair(idx,type,ii){clearSvg(idx);var svg=document.getElementById('svg'+idx);if(!svg)return;var rel=REL_CACHE[idx];var color='#C9A96E';if(type==='冲'||type==='刑')color='#C05050';var items={干合:rel.kango,三合:rel.sango,支合:rel.shigo,冲:rel.chu,刑:rel.kei};var item=(items[type]||[])[ii];if(!item)return;if(item.type==='both')color='#9966CC';var et=(type==='干合')?'kan':'shi';var myEl=document.getElementById('my'+et+'_'+idx+'_'+item.mi),thEl=document.getElementById('th'+et+'_'+idx+'_'+item.ti);if(!myEl||!thEl)return;var c1=getCenter(myEl,svg),c2=getCenter(thEl,svg);drawCircle(svg,c1.x,c1.y,c1.w,c1.h,color);drawCircle(svg,c2.x,c2.y,c2.w,c2.h,color);drawLine(svg,c1.x,c1.y,c2.x,c2.y,color);}
document.addEventListener('click',function(e){if(!e.target.closest('#other-tab-btn')&&!e.target.closest('#bni-other')&&!e.target.closest('#sub-menu'))closeSubMenu();if(!e.target.closest('.notif-icon')&&!e.target.closest('#notif-panel')){var np=document.getElementById('notif-panel');if(np)np.classList.remove('show');}var pair=e.target.closest('.rel-pair');if(!pair){document.querySelectorAll('.rel-pair.active').forEach(function(p){p.classList.remove('active');});clearAllSvg();return;}var idx=pair.dataset.ridx,type=pair.dataset.type,ii=parseInt(pair.dataset.ii);if(pair.classList.contains('active')){pair.classList.remove('active');clearSvg(idx);}else{document.querySelectorAll('.rel-pair.active').forEach(function(p){p.classList.remove('active');});clearAllSvg();pair.classList.add('active');highlightPair(idx,type,ii);}});
function initPrefs(){var rp=document.getElementById('r-res');PREF_NAMES.forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;rp.appendChild(o);});var s=document.getElementById('pref');for(var i=0;i<PREFS.length;i++){var o=document.createElement('option');o.value=i;o.textContent=PREFS[i].name;if(PREFS[i].name==='神奈川県')o.selected=true;s.appendChild(o);}updCity();}
function updCity(){var pi=parseInt(document.getElementById('pref').value),cs=document.getElementById('city');cs.innerHTML='';PREFS[pi].cities.forEach(function(c){var o=document.createElement('option');o.value=c.l;o.textContent=c.n;if(c.n==='平塚市')o.selected=true;cs.appendChild(o);});}
initPrefs();updateAgeSummary();

// ===== Supabase 初期化 =====
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
var currentUser = null;
var mySex = "";


// ===== app-wrapを表示する関数 =====
function showAppWrap() {
  if (document.getElementById('app-wrap')) {
    document.getElementById('app-wrap').style.display = 'block';
    document.getElementById('app-wrap').style.visibility = 'visible';
    document.getElementById('s0').classList.add('on');
    startPolling();
    return;
  }
  var template = document.getElementById('app-template');
  var shell = document.getElementById('shell');
  var clone = template.content.cloneNode(true);
  shell.appendChild(clone);
  document.getElementById('app-wrap').style.display = 'block';
  document.getElementById('app-wrap').style.visibility = 'visible';
  document.getElementById('s0').classList.add('on');
  startPolling();
}

// ===== 10秒ごとにDBの最新状態を確認 =====
var pollingTimer = null;
function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(function() {
    if (currentUser) {
      loadEnList();
      // 推しの詳細が開いていない時だけ推しページを更新
      var openDetail = document.querySelector('.detail-panel.open');
      if (!openDetail) {
        loadRealUsers();
      }
    }
  }, 10000);
}

// ===== 起動時：ログイン状態チェック =====
async function checkSession() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      document.getElementById('login-wrap').style.display = 'flex';
      return;
    }
    currentUser = session.user;
    const { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
      memberID = profile.member_id;
      mySex = profile.sex || '';
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'none';
      document.getElementById('login-wrap').style.display = 'none';
      showAppWrap();
      document.getElementById('topbar-initial').textContent = profile.nickname.charAt(0);
      document.getElementById('modal-ava-ph').textContent = profile.nickname.charAt(0);
      document.getElementById('modal-member-id').textContent = profile.member_id;
      document.getElementById('contact-id').value = profile.member_id;
      document.getElementById('contact-nick').value = profile.nickname;

      var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+profile.nickname+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+(profile.sex||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+(profile.prefecture||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+profile.birth_year+'年'+profile.birth_month+'月'+profile.birth_day+'日</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+(profile.marriage||'')+'</span></div>';
      modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+(profile.children||'')+'</span></div>';
      document.getElementById('modal-info').innerHTML = modalInfo;

      MY_PILLARS = [
        {k: profile.pillar_year_k||0, s: profile.pillar_year_s||0},
        {k: profile.pillar_month_k||0, s: profile.pillar_month_s||0},
        {k: profile.pillar_day_k||0, s: profile.pillar_day_s||0},
        {k: profile.pillar_hour_k||0, s: profile.pillar_hour_s||0}
      ];

      var pillarHtml = '';
      MY_PILLARS.forEach(function(p, i) {
        pillarHtml += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
      });
      document.getElementById('modal-pillars').innerHTML = pillarHtml;

      document.getElementById('s0').classList.add('on');
      loadRealUsers();
      loadEnList();
    } else {
      document.getElementById('orient-wrap').style.display = 'none';
      document.getElementById('reg-wrap').style.display = 'block';
    }
  } catch(e) { console.log('セッション確認エラー', e); }
}
checkSession();

// ===== 登録完了：Supabase版（元のcompleteRegを上書き） =====
async function completeReg() {
  const emailEl = document.getElementById('r-email');
  const passEl = document.getElementById('r-password');
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passEl ? passEl.value : '';

  if (!email || !password) {
    alert('メールアドレスとパスワードを入力してください');
    return;
  }
  if (password.length < 6) {
    alert('パスワードは6文字以上にしてください');
    return;
  }

  // Supabaseに新規登録
  try {
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) {
      alert('登録エラー：' + error.message);
      console.log('登録エラー詳細:', error);
      return;
    }

  currentUser = data.user;
  if (!currentUser) {
    alert('登録に失敗しました。もう一度お試しください。');
    return;
  }

  memberID = generateMemberID();
  mySex = document.querySelector('#r-sex-row .sxbtn.on') ? document.querySelector('#r-sex-row .sxbtn.on').textContent : '';

  const nick = document.getElementById('r-nick').value || '名無し';
  const sexEl = document.querySelector('#r-sex-row .sxbtn.on');
  const sex = sexEl ? sexEl.textContent : '不明';
  const res = document.getElementById('r-res').value || '';
  const marriage = document.getElementById('r-marriage').value;
  const kodomo = document.getElementById('r-kodomo').value === 'yes' ? document.getElementById('r-kodomo-cnt').value : 'なし';
  const yr = parseInt(document.getElementById('yr').value) || 1996;
  const mo = parseInt(document.getElementById('mo').value) || 1;
  const dy = parseInt(document.getElementById('dy').value) || 1;
  const hr = parseInt(document.getElementById('hr').value) || 0;
  const mn_val = parseInt(document.getElementById('mn').value) || 0;
  const lon = parseFloat(document.getElementById('city').value) || 135.0;

  if (savedPillars.length === 0) {
    savedPillars = calcPillars(yr, mo, dy, hr, mn_val, lon);
  }

  // profilesテーブルに保存
  const { error: profileError } = await supa.from('profiles').insert({
    id: currentUser.id,
    member_id: memberID,
    nickname: nick,
    sex: sex,
    prefecture: res,
    birth_year: yr,
    birth_month: mo,
    birth_day: dy,
    birth_hour: hr,
    birth_min: mn_val,
    birth_pref: document.getElementById('pref').options[document.getElementById('pref').selectedIndex].text,
    birth_city: document.getElementById('city').options[document.getElementById('city').selectedIndex].text,
    marriage: marriage,
    children: kodomo,
    pillar_year_k: savedPillars[0].k,
    pillar_year_s: savedPillars[0].s,
    pillar_month_k: savedPillars[1].k,
    pillar_month_s: savedPillars[1].s,
    pillar_day_k: savedPillars[2].k,
    pillar_day_s: savedPillars[2].s,
    pillar_hour_k: savedPillars[3].k,
    pillar_hour_s: savedPillars[3].s
  });

  if (profileError) {
    alert('プロフィール保存エラー：' + profileError.message);
    return;
  }

  // 画面遷移：まずshowAppWrapでDOMを展開してから要素にアクセス
  MY_PILLARS = savedPillars;
  document.getElementById('reg-wrap').style.display = 'none';
  document.getElementById('orient-wrap').style.display = 'none';
  document.getElementById('login-wrap').style.display = 'none';
  showAppWrap();

  document.getElementById('topbar-initial').textContent = nick.charAt(0);
  document.getElementById('modal-ava-ph').textContent = nick.charAt(0);
  document.getElementById('modal-member-id').textContent = memberID;
  document.getElementById('contact-id').value = memberID;
  document.getElementById('contact-nick').value = nick;

  if (savedImgSrc) {
    var ti = document.getElementById('topbar-ava');
    ti.src = savedImgSrc; ti.style.display = 'block';
    document.getElementById('topbar-initial').style.display = 'none';
    var mi = document.getElementById('modal-ava-img');
    mi.src = savedImgSrc; mi.style.display = 'block';
    document.getElementById('modal-ava-ph').style.display = 'none';
  }

  var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+nick+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+sex+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+res+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+yr+'年'+mo+'月'+dy+'日</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+marriage+'</span></div>';
  modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+kodomo+'</span></div>';
  document.getElementById('modal-info').innerHTML = modalInfo;

  var h = '';
  savedPillars.forEach(function(p, i) {
    h += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
  });
  document.getElementById('modal-pillars').innerHTML = h;
  loadRealUsers();
  loadEnList();
  } catch(e) { alert('登録中にエラーが発生しました：' + e.message); console.log('登録例外:', e); }
}


// ===== 縁リストをDBから読み込む =====
async function loadEnList(){
  if(!currentUser)return;
  try{
    enList=[];
    // 自分が送った申請（pending状態 → 申請中）
    var{data:sentPending}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status','pending');
    if(sentPending){
      for(var i=0;i<sentPending.length;i++){
        var m=sentPending[i];
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:'sent'});
        }
      }
    }
    // 自分が送った申請の各ステータス取得
    var sentStatuses=['matched','chatting','date_set','coupled','reviewed'];
    for(var si=0;si<sentStatuses.length;si++){
      var ss=sentStatuses[si];
      var{data:sentS}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status',ss);
      if(sentS){
        for(var i=0;i<sentS.length;i++){
          var m=sentS[i];
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var displayStatus=ss==='matched'?'approved':ss==='reviewed'?'dated':ss;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:displayStatus});
          }
        }
      }
    }
    // 自分が送った申請がrejected → キャンセル通知
    var{data:sentRejected}=await supa.from('matches').select('*').eq('from_user_id',currentUser.id).eq('status','rejected');
    if(sentRejected){
      for(var i=0;i<sentRejected.length;i++){
        var m=sentRejected[i];
        var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.to_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:'rejected_notify'});
        }
      }
    }
    // 自分が受けた申請（pending → 承認待ち）
    var{data:received}=await supa.from('matches').select('*').eq('to_user_id',currentUser.id).eq('status','pending');
    if(received){
      for(var i=0;i<received.length;i++){
        var m=received[i];
        var{data:prof}=await supa.from('profiles').select('*').eq('id',m.from_user_id).single();
        if(prof){
          var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
          var theirPillars=[{k:prof.pillar_year_k||0,s:prof.pillar_year_s||0},{k:prof.pillar_month_k||0,s:prof.pillar_month_s||0},{k:prof.pillar_day_k||0,s:prof.pillar_day_s||0},{k:prof.pillar_hour_k||0,s:prof.pillar_hour_s||0}];
          var rel=checkRelations(MY_PILLARS,theirPillars);
          var sc=calcScore(rel);
          enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:sc,status:'pending'});
        }
      }
    }
    // 自分が受けた申請の各ステータス取得
    var recStatuses=['matched','chatting','date_set','coupled','reviewed'];
    for(var ri=0;ri<recStatuses.length;ri++){
      var rs=recStatuses[ri];
      var{data:recS}=await supa.from('matches').select('*').eq('to_user_id',currentUser.id).eq('status',rs);
      if(recS){
        for(var i=0;i<recS.length;i++){
          var m=recS[i];
          var{data:prof}=await supa.from('profiles').select('nickname,birth_year,prefecture').eq('id',m.from_user_id).single();
          if(prof){
            var age=prof.birth_year?(new Date().getFullYear()-prof.birth_year)+'歳':'';
            var displayStatus=rs==='matched'?'approved_by_me':rs==='reviewed'?'dated':rs;
            enList.push({matchId:m.id,name:prof.nickname+'さん',meta:age+(prof.prefecture?'・'+prof.prefecture:''),score:'--',status:displayStatus});
          }
        }
      }
    }
    renderEnList();
    updateEnBadge();
    renderMsgList();
  }catch(e){console.log('loadEnListエラー:',e);}
}

// ===== 他のリアルユーザーを読み込んで推しページに表示 =====
async function loadRealUsers() {
  if (!currentUser) return;
  try {
    const { data: users, error } = await supa.from('profiles').select('*').neq('id', currentUser.id);
    if (error) { console.log('ユーザー取得エラー:', error); }
    var validUsers = (users && !error) ? users : [];
    // matchesに記録がある相手を推しページから除外（status問わず）
    try{
      var{data:allMatches}=await supa.from('matches').select('from_user_id,to_user_id').or('from_user_id.eq.'+currentUser.id+',to_user_id.eq.'+currentUser.id);
      var blockedIds=[];
      if(allMatches){
        allMatches.forEach(function(r){
          if(r.from_user_id===currentUser.id)blockedIds.push(r.to_user_id);
          if(r.to_user_id===currentUser.id)blockedIds.push(r.from_user_id);
        });
      }
      if(blockedIds.length>0){
        validUsers=validUsers.filter(function(u){return blockedIds.indexOf(u.id)<0;});
      }
    }catch(e){console.log('除外エラー:',e);}
    // 異性のみフィルター
    if (mySex) {
      var targetSex = '';
      if (mySex === '男性') targetSex = '女性';
      else if (mySex === '女性') targetSex = '男性';
      if (targetSex) {
        validUsers = validUsers.filter(function(u){ return u.sex === targetSex; });
      }
    }

    const realPartners = validUsers.map(u => ({
      name: u.nickname + 'さん',
      meta: (u.birth_year ? (new Date().getFullYear() - u.birth_year) + '歳' : '') + (u.prefecture ? '・' + u.prefecture : ''),
      pillars: [
        {k: u.pillar_year_k||0, s: u.pillar_year_s||0},
        {k: u.pillar_month_k||0, s: u.pillar_month_s||0},
        {k: u.pillar_day_k||0, s: u.pillar_day_s||0},
        {k: u.pillar_hour_k||0, s: u.pillar_hour_s||0}
      ],
      userId: u.id,
      isDemo: false
    }));

    PARTNERS.splice(0, PARTNERS.length);
    if (realPartners.length > 0) {
      // リアルユーザーが1人でもいればデモは表示しない
      realPartners.forEach(function(p){ PARTNERS.push(p); });
    } else {
      // リアルユーザーがいない場合のみデモを表示（異性のデモを選択）
      var demoFemale = [
        {name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},
        {name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},
        {name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},
        {name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},
        {name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}
      ];
      var demoData = (mySex === '女性') ? DEMO_MALE : demoFemale;
      demoData.forEach(function(p){ PARTNERS.push(p); });
    }
    renderMatchList(MY_PILLARS);
  } catch(e) {
    console.log('ユーザー読み込みエラー', e);
    // エラー時もデモデータを表示
    PARTNERS.splice(0, PARTNERS.length);
    var demoFemale2 = [
      {name:'つきみさん',meta:'32歳・兵庫県・初婚・子なし',pillars:calcPillars(1992,3,15,8,20,135.19),isDemo:true,sex:'女性'},
      {name:'はなこさん',meta:'29歳・大阪府・初婚・子なし',pillars:calcPillars(1995,7,22,14,30,135.50),isDemo:true,sex:'女性'},
      {name:'そらさん',meta:'35歳・京都府・初婚・子なし',pillars:calcPillars(1989,11,3,6,45,135.77),isDemo:true,sex:'女性'},
      {name:'あきさん',meta:'34歳・兵庫県・初婚・子なし',pillars:calcPillars(1990,9,5,18,15,134.69),isDemo:true,sex:'女性'},
      {name:'ひかりさん',meta:'28歳・大阪府・初婚・子なし',pillars:calcPillars(1997,5,12,12,0,135.50),isDemo:true,sex:'女性'}
    ];
    var demoErr = (mySex === '女性') ? DEMO_MALE : demoFemale2;
    demoErr.forEach(function(p){ PARTNERS.push(p); });
    renderMatchList(MY_PILLARS);
  }
}

// ===== ログイン処理 =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'メールアドレスとパスワードを入力してください';
    return;
  }

  try {
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = 'メールアドレスまたはパスワードが違います';
      console.log('ログインエラー:', error.message);
      return;
    }

  currentUser = data.user;
  document.getElementById('login-wrap').style.display = 'none';

  // プロフィール確認
  const { data: profile } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
  if (profile) {
    memberID = profile.member_id;
    mySex = profile.sex || '';
    document.getElementById('login-wrap').style.display = 'none';
    showAppWrap();
    document.getElementById('topbar-initial').textContent = profile.nickname.charAt(0);
    document.getElementById('modal-ava-ph').textContent = profile.nickname.charAt(0);
    document.getElementById('modal-member-id').textContent = profile.member_id;
    document.getElementById('contact-id').value = profile.member_id;
    document.getElementById('contact-nick').value = profile.nickname;

    var modalInfo = '<div class="modal-row"><span class="modal-lbl">ニックネーム</span><span class="modal-val">'+profile.nickname+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">性別</span><span class="modal-val">'+(profile.sex||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">居住地</span><span class="modal-val">'+(profile.prefecture||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">生年月日</span><span class="modal-val">'+profile.birth_year+'年'+profile.birth_month+'月'+profile.birth_day+'日</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">結婚歴</span><span class="modal-val">'+(profile.marriage||'')+'</span></div>';
    modalInfo += '<div class="modal-row"><span class="modal-lbl">連れ子</span><span class="modal-val">'+(profile.children||'')+'</span></div>';
    document.getElementById('modal-info').innerHTML = modalInfo;

    MY_PILLARS = [
      {k: profile.pillar_year_k||0, s: profile.pillar_year_s||0},
      {k: profile.pillar_month_k||0, s: profile.pillar_month_s||0},
      {k: profile.pillar_day_k||0, s: profile.pillar_day_s||0},
      {k: profile.pillar_hour_k||0, s: profile.pillar_hour_s||0}
    ];

    var pillarHtml = '';
    MY_PILLARS.forEach(function(p, i) {
      pillarHtml += '<div class="pc-mini'+(i===2?' day':'')+'"><div class="pc-mini-lbl">'+PL[i]+'</div><div class="pc-mini-k">'+KAN[p.k]+'</div><div class="pc-mini-s">'+SHI[p.s]+'</div></div>';
    });
    document.getElementById('modal-pillars').innerHTML = pillarHtml;

    loadRealUsers();
    loadEnList();
  } else {
    // プロフィール未登録ならオリエンテーションへ
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('orient-wrap').style.display = 'flex';
  }
  } catch(e) { console.log('ログイン例外:', e); errEl.textContent = 'エラーが発生しました'; }
}

// ===== 新規登録ボタン =====
function goToRegister() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('orient-wrap').style.display = 'flex';
}

// Enterキーでログイン
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login-wrap').style.display !== 'none') {
    doLogin();
  }
});

