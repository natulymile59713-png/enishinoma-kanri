// ===== 四柱推命：ピラー計算と関係判定 =====
function isKan(k1,k2){for(var i=0;i<KANGO.length;i++){var p=KANGO[i];if((k1===p[0]&&k2===p[1])||(k1===p[1]&&k2===p[0]))return true;}return false;}
function isHango(s1,s2){for(var i=0;i<HANGO.length;i++){var p=HANGO[i];if((s1===p[0]&&s2===p[1])||(s1===p[1]&&s2===p[0]))return true;}return false;}
// === 節入時刻の天文計算（Meeus 太陽黄経式 / 精度 ~5-15分）===
// 太陽の見かけ黄経 [度] を返す（JD は UT で渡す）
function sunApparentLon(jdv){
  var T=(jdv-2451545)/36525;
  var L0=280.46646+36000.76983*T+0.0003032*T*T;
  var M=357.52911+35999.05029*T-0.0001537*T*T;
  var Mr=M*Math.PI/180;
  var C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
  var L=L0+C;
  var om=(125.04-1934.136*T)*Math.PI/180;
  var lam=L-0.00569-0.00478*Math.sin(om);
  return((lam%360)+360)%360;
}
// 月→節入の太陽黄経
var SEKKI_LON={1:285,2:315,3:345,4:15,5:45,6:75,7:105,8:135,9:165,10:195,11:225,12:255};
// 節入時刻のキャッシュ（同じ年月への再計算を避ける）
var _SEKKI_CACHE={};
function getSekki(y,m){
  var key=y+'_'+m;
  if(_SEKKI_CACHE[key])return _SEKKI_CACHE[key];
  var targetLon=SEKKI_LON[m];
  // 節入は各月の3-9日に発生。中央値6日±10日で二分探索
  var aj=jd(y,m,6,0);
  var lo=aj-10,hi=aj+10;
  for(var i=0;i<60;i++){
    var mid=(lo+hi)/2;
    var diff=((sunApparentLon(mid)-targetLon+540)%360)-180;
    if(Math.abs(diff)<1e-7)break;
    if(diff<0)lo=mid;else hi=mid;
  }
  var termJD=(lo+hi)/2;
  // UT JD → JST (UT+9) → date components
  var jstJD=termJD+9/24+0.5;
  var Z=Math.floor(jstJD),F=jstJD-Z,A;
  if(Z<2299161){A=Z;}
  else{var alpha=Math.floor((Z-1867216.25)/36524.25);A=Z+1+alpha-Math.floor(alpha/4);}
  var B=A+1524;
  var C2=Math.floor((B-122.1)/365.25);
  var D=Math.floor(365.25*C2);
  var E=Math.floor((B-D)/30.6001);
  var dayD=B-D-Math.floor(30.6001*E)+F;
  var dInt=Math.floor(dayD),fracDay=dayD-dInt;
  var hour=fracDay*24,hInt=Math.floor(hour);
  var mInt=Math.round((hour-hInt)*60);
  if(mInt>=60){mInt=0;hInt++;}
  if(hInt>=24){hInt=0;dInt++;}
  var result={d:dInt,h:hInt,m:mInt};
  _SEKKI_CACHE[key]=result;
  return result;
}
function jd(y,m,d,h){if(m<=2){y--;m+=12;}var A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+h/24+B-1524.5;}
function eqT(j){var T=(j-2451545)/36525,eps=(23.4393-0.013*T)*Math.PI/180,L0=(280.46646+36000.76983*T)*Math.PI/180,e=0.016708634-0.000042037*T,M=(357.52911+35999.05029*T)*Math.PI/180,y2=Math.tan(eps/2)*Math.tan(eps/2);return(y2*Math.sin(2*L0)-2*e*Math.sin(M)+4*e*y2*Math.sin(M)*Math.cos(2*L0)-0.5*y2*y2*Math.sin(4*L0)-1.25*e*e*Math.sin(2*M))*4*180/Math.PI;}
function calcPillars(yr,mo,dy,hr,mn,lon){
  // 時刻・経度の有無を判定（null/undefined/NaN を未入力扱い）
  var hasTime=(hr!=null&&!isNaN(hr));
  var hasLon=(lon!=null&&!isNaN(lon)&&lon>0);
  var hrCalc=hasTime?hr:0,mnCalc=hasTime?mn:0;
  var ld=hasLon?(lon-135.0)*4:0;
  var j=jd(yr,mo,dy,hrCalc+mnCalc/60);
  var tt=((hrCalc*60+mnCalc+ld+eqT(j))%1440+1440)%1440,tH=Math.floor(tt/60);
  var sk=getSekki(yr,mo),bef=(dy*1440+hrCalc*60+mnCalc)<(sk.d*1440+sk.h*60+sk.m);
  var nY=yr;if(mo===1){nY=yr-1;}else if(mo===2&&bef){nY=yr-1;}
  var nKi=((nY-4)%10+10)%10,nSi=((nY-4)%12+12)%12;
  var mY=yr,mM=mo;if(bef){mM--;if(mM<=0){mM=12;mY--;}}
  var gY=mY;if(mM===1)gY=mY-1;
  var gKi=((gY-4)%10+10)%10;
  var moKi=(GOKOTSU[gKi]+(mM-2+12)%12)%10,moSi=MO_SHI[mM];
  var dJ=Math.floor(jd(yr,mo,dy,12)),dSt=((dJ+49)%10+10)%10,dSi=((dJ+49)%12+12)%12;
  var hourPillar=null;
  if(hasTime){
    var sH=Math.floor(((tH+1)%24)/2),hKi=([0,2,4,6,8][dSt%5]+sH)%10;
    hourPillar={k:hKi,s:sH};
  }
  return [{k:nKi,s:nSi},{k:moKi,s:moSi},{k:dSt,s:dSi},hourPillar];
}
function checkRelations(myP,thP){var res={kango:[],sango:[],shigo:[],chu:[],kei:[]};for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;if(isKan(myP[i].k,thP[j].k))res.kango.push({label:KAN[myP[i].k]+'✕'+KAN[thP[j].k],mi:i,ti:j});}}for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;var s1=myP[i].s,s2=thP[j].s;if(isHango(s1,s2))res.sango.push({label:SHI[s1]+'・'+SHI[s2]+'（半会）',mi:i,ti:j});}}for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<SHIGO.length;p++){var sp=SHIGO[p];if((s1===sp[0]&&s2===sp[1])||(s1===sp[1]&&s2===sp[0])){var isBoth=(s1===8&&s2===5)||(s1===5&&s2===8);res.shigo.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:isBoth?'both':'g'});if(isBoth)res.kei.push({label:SHI[s1]+'・'+SHI[s2]+'（支合も）',mi:i,ti:j,type:'both'});}}}}for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<CHU.length;p++){var cp=CHU[p];if((s1===cp[0]&&s2===cp[1])||(s1===cp[1]&&s2===cp[0]))res.chu.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:'r'});}}}for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;var s1=myP[i].s,s2=thP[j].s;for(var p=0;p<KEI_PAIRS.length;p++){var kp=KEI_PAIRS[p];if((s1===kp[0]&&s2===kp[1])||(s1===kp[1]&&s2===kp[0]))res.kei.push({label:SHI[s1]+'・'+SHI[s2],mi:i,ti:j,type:'r'});}}}for(var i=0;i<4;i++){if(!myP[i])continue;for(var j=0;j<4;j++){if(!thP[j])continue;if(myP[i].s===thP[j].s&&KEI_SELF.indexOf(myP[i].s)>=0)res.kei.push({label:SHI[myP[i].s]+'（自刑）',mi:i,ti:j,type:'r'});}}return res;}
function calcScore(rel){return Math.min(99,Math.max(15,50+rel.kango.length*4+rel.sango.length*10+rel.shigo.length*7-rel.chu.length*7-rel.kei.length*10));}
function generateComment(rel){var kg=rel.kango.length,sg=rel.sango.length,sh=rel.shigo.length,ch=rel.chu.length,ke=rel.kei.length,good=kg+sg+sh,bad=ch+ke;if(kg>=3&&bad===0)return '一目会った瞬間から惹かれ合い、安定した関係を築きやすい、理想的な縁です。';if(kg>=2&&sh>=1&&bad===0)return '会った時から自然に引き合い、穏やかな関係が築けそうです。';if(kg>=1&&sg>=1&&bad===0)return 'どこか懐かしさを感じ、価値観も合う良い縁です。';if(good>=2&&bad===0)return 'バランスの取れた良縁です。自然な形で関係が深まっていきやすい組み合わせです。';if(bad>=3&&good<=1)return '縁自体はあるものの、衝突やトラブルが多くなりやすい組み合わせです。';return '個性ある縁の組み合わせです。お互いの違いを尊重することで良い関係が育まれそうです。';}
