// ===== UI: オリエンテーション（スライド遷移） =====
function initDots(){var d=document.getElementById('dots');d.innerHTML='';for(var i=0;i<totalSlides;i++){var dot=document.createElement('div');dot.className='dot'+(i===0?' on':'');d.appendChild(dot);}}
function updateSlide(){document.getElementById('slides').style.transform='translateX(-'+currentSlide*100+'%)';document.querySelectorAll('.dot').forEach(function(d,i){d.className='dot'+(i===currentSlide?' on':'');});document.getElementById('orient-progress').textContent=(currentSlide+1)+' / '+totalSlides;document.getElementById('btn-prev').style.visibility=currentSlide===0?'hidden':'visible';var isLast=currentSlide===totalSlides-1;document.getElementById('btn-next').textContent=isLast?'登録へ進む →':'次へ →';document.getElementById('btn-skip').style.display=isLast?'none':'inline-block';}
function nextSlide(){if(currentSlide<totalSlides-1){currentSlide++;updateSlide();}else{startReg();}}
function prevSlide(){if(currentSlide>0){currentSlide--;updateSlide();}}
function skipOrient(){startReg();}
function startReg(){document.getElementById('orient-wrap').style.display='none';document.getElementById('reg-wrap').style.display='block';document.getElementById('reg-wrap').style.visibility='visible';}
