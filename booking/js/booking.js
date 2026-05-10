// ===== 縁の間 - 鑑定予約カレンダー =====
const SUPABASE_URL = 'https://ogshjcqkvuidlaenawth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nc2hqY3FrdnVpZGxhZW5hd3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzIyMDUsImV4cCI6MjA5Mjg0ODIwNX0.xCw4h4vBDf4mlilgHYUQbG0pPYfySMInrZPXwB-NsVI';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ===== 設定 =====
// 予約可能曜日：水(3)、木(4)、金(5)、土(6)
const AVAILABLE_DOW = [3, 4, 5, 6];
// 1日あたりの時間枠
const SLOTS = ['10:00-11:30', '12:00-13:30', '14:00-15:30', '16:00-17:30', '18:00-19:30'];

// ===== 状態 =====
let calYear, calMonth;
let selectedDate = null;       // 'YYYY-MM-DD'
let bookedSlotsMap = {};        // { 'YYYY-MM-DD': Set('10:00-11:30', ...) }
let pendingBooking = null;      // { date, slot }

// ===== ユーティリティ =====
function pad2(n){ return String(n).padStart(2,'0'); }
function formatDateKey(y, m, d){ return y + '-' + pad2(m) + '-' + pad2(d); }
function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function todayDateKey(){
  const d = new Date();
  return formatDateKey(d.getFullYear(), d.getMonth()+1, d.getDate());
}

// ===== カレンダー描画 =====
function calPrev(){
  calMonth--;
  if(calMonth < 1){ calMonth = 12; calYear--; }
  loadAndRender();
}
function calNext(){
  calMonth++;
  if(calMonth > 12){ calMonth = 1; calYear++; }
  loadAndRender();
}

async function loadAndRender(){
  document.getElementById('cal-title').textContent = calYear + '年' + calMonth + '月';
  selectedDate = null;
  document.getElementById('slot-section').style.display = 'none';
  await loadBookedSlots();
  renderCalendar();
}

async function loadBookedSlots(){
  bookedSlotsMap = {};
  try{
    const { data, error } = await supa.rpc('get_booked_slots', { p_year: calYear, p_month: calMonth });
    if(error){ console.log('booked slots error:', error); return; }
    if(data){
      data.forEach(r => {
        const k = r.scheduled_date;
        if(!bookedSlotsMap[k]) bookedSlotsMap[k] = new Set();
        bookedSlotsMap[k].add(r.scheduled_slot);
      });
    }
  }catch(e){
    console.log('booked slots exception:', e);
  }
}

function renderCalendar(){
  const grid = document.getElementById('cal-grid');
  let html = '';
  const headers = ['日','月','火','水','木','金','土'];
  headers.forEach((h, i) => {
    let cls = '';
    if(i === 0) cls = ' sun';
    if(i === 6) cls = ' sat';
    html += '<div class="cal-head'+cls+'">'+h+'</div>';
  });

  const firstDay = new Date(calYear, calMonth - 1, 1);
  const lastDay = new Date(calYear, calMonth, 0);
  const firstDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayKey = todayDateKey();

  // 月初までの空白
  for(let i = 0; i < firstDow; i++){
    html += '<div class="cal-cell empty"></div>';
  }

  for(let d = 1; d <= daysInMonth; d++){
    const cellDate = new Date(calYear, calMonth - 1, d);
    const dow = cellDate.getDay();
    const dateKey = formatDateKey(calYear, calMonth, d);
    const isAvailableDow = AVAILABLE_DOW.indexOf(dow) >= 0;
    const isPast = dateKey < todayKey;
    const isToday = dateKey === todayKey;
    const isDisabled = !isAvailableDow || isPast;
    const bookedSet = bookedSlotsMap[dateKey] || new Set();
    const isFull = isAvailableDow && bookedSet.size >= SLOTS.length;

    let cls = 'cal-cell';
    if(isDisabled){
      cls += ' disabled';
    }else if(isFull){
      cls += ' full';
    }else{
      cls += ' available';
    }
    if(dow === 0) cls += ' sun';
    if(dow === 6) cls += ' sat';
    if(isToday) cls += ' today';
    if(selectedDate === dateKey) cls += ' selected';

    let onclick = '';
    if(!isDisabled){
      onclick = ' onclick="selectDate(\''+dateKey+'\')"';
    }

    let statusHtml = '';
    if(isDisabled){
      statusHtml = '<div class="cell-status x">✕</div>';
    }else if(isFull){
      statusHtml = '<div class="cell-status full">満席</div>';
    }else{
      const free = SLOTS.length - bookedSet.size;
      statusHtml = '<div class="cell-status">○'+free+'</div>';
    }

    html += '<div class="'+cls+'"'+onclick+'><div class="day-num">'+d+'</div>'+statusHtml+'</div>';
  }

  // 最終週の空白埋め
  const totalCells = firstDow + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for(let i = 0; i < trailing; i++){
    html += '<div class="cal-cell empty"></div>';
  }
  grid.innerHTML = html;
}

function selectDate(dateKey){
  selectedDate = dateKey;
  renderCalendar();
  renderSlotList(dateKey);
  // スロットエリアをスクロール
  const sec = document.getElementById('slot-section');
  sec.style.display = 'block';
  setTimeout(() => sec.scrollIntoView({behavior:'smooth', block:'start'}), 100);
}

function renderSlotList(dateKey){
  const parts = dateKey.split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]);
  const date = new Date(y, m - 1, d);
  const dowNames = ['日','月','火','水','木','金','土'];
  document.getElementById('slot-date-title').textContent = y + '年' + m + '月' + d + '日（' + dowNames[date.getDay()] + '） の予約枠';

  const bookedSet = bookedSlotsMap[dateKey] || new Set();
  let html = '';
  SLOTS.forEach(slot => {
    const isTaken = bookedSet.has(slot);
    if(isTaken){
      html += '<div class="slot-row taken"><span class="slot-time">'+slot+'</span><span class="slot-status-badge taken">✕ 予約済</span></div>';
    }else{
      html += '<div class="slot-row available" onclick="openBooking(\''+dateKey+'\', \''+slot+'\')"><span class="slot-time">'+slot+'</span><span class="slot-status-badge available">○ 予約可</span></div>';
    }
  });
  document.getElementById('slot-list').innerHTML = html;
}

// ===== 予約フォーム =====
let attendanceType = 'solo';

function setAttendance(type){
  attendanceType = type;
  document.getElementById('att-solo').classList.toggle('on', type === 'solo');
  document.getElementById('att-pair').classList.toggle('on', type === 'pair');
  document.getElementById('partner-fields').style.display = (type === 'pair') ? 'block' : 'none';
  const notice = document.getElementById('pair-notice');
  if(notice) notice.style.display = (type === 'pair') ? 'block' : 'none';
}

function openBooking(dateKey, slot){
  pendingBooking = { date: dateKey, slot: slot };
  const parts = dateKey.split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]);
  const date = new Date(y, m - 1, d);
  const dowNames = ['日','月','火','水','木','金','土'];
  document.getElementById('booking-summary').innerHTML =
    '<strong>'+y+'年'+m+'月'+d+'日（'+dowNames[date.getDay()]+'）</strong><br>' + slot;
  // 自分側
  document.getElementById('bk-name').value = '';
  document.getElementById('bk-member-id').value = '';
  document.getElementById('bk-phone').value = '';
  // パートナー側
  document.getElementById('bk-partner-name').value = '';
  document.getElementById('bk-partner-member-id').value = '';
  document.getElementById('bk-partner-phone').value = '';
  document.getElementById('bk-notes').value = '';
  // 受け方を初期化（1人）
  setAttendance('solo');
  document.getElementById('bk-error').textContent = '';
  document.getElementById('bk-success').style.display = 'none';
  document.getElementById('bk-submit-btn').disabled = false;
  document.getElementById('bk-submit-btn').textContent = 'この内容で予約する';
  document.getElementById('booking-modal').classList.add('show');
}

function closeBooking(){
  document.getElementById('booking-modal').classList.remove('show');
}

async function submitBooking(){
  if(!pendingBooking) return;
  const errEl = document.getElementById('bk-error');
  const okEl = document.getElementById('bk-success');
  errEl.textContent = '';
  okEl.style.display = 'none';

  const name = document.getElementById('bk-name').value.trim();
  const memberId = document.getElementById('bk-member-id').value.trim();
  const phoneRaw = document.getElementById('bk-phone').value.trim();
  const phone = phoneRaw.replace(/[-\s]/g, '');
  const notes = document.getElementById('bk-notes').value.trim();

  // 自分側バリデーション
  if(!name){ errEl.textContent = 'お名前を入力してください'; return; }
  if(!memberId){ errEl.textContent = '会員IDを入力してください'; return; }
  if(!/^EN-\d{8}$/.test(memberId)){ errEl.textContent = '会員IDの形式が正しくありません（例：EN-12345678）'; return; }
  if(!phone){ errEl.textContent = '電話番号を入力してください'; return; }
  if(!/^0\d{9,10}$/.test(phone)){ errEl.textContent = '電話番号は0から始まる10〜11桁の数字で入力してください'; return; }

  // パートナー側バリデーション（2人で受ける場合）
  let partnerName = null, partnerMemberId = null, partnerPhone = null;
  if(attendanceType === 'pair'){
    partnerName = document.getElementById('bk-partner-name').value.trim();
    partnerMemberId = document.getElementById('bk-partner-member-id').value.trim();
    const partnerPhoneRaw = document.getElementById('bk-partner-phone').value.trim();
    partnerPhone = partnerPhoneRaw.replace(/[-\s]/g, '');
    if(!partnerName){ errEl.textContent = 'パートナーのお名前を入力してください'; return; }
    if(!partnerMemberId){ errEl.textContent = 'パートナーの会員IDを入力してください'; return; }
    if(!/^EN-\d{8}$/.test(partnerMemberId)){ errEl.textContent = 'パートナーの会員IDの形式が正しくありません（例：EN-12345678）'; return; }
    if(partnerMemberId === memberId){ errEl.textContent = 'お二人の会員IDが同じです'; return; }
    if(!partnerPhone){ errEl.textContent = 'パートナーの電話番号を入力してください'; return; }
    if(!/^0\d{9,10}$/.test(partnerPhone)){ errEl.textContent = 'パートナーの電話番号は0から始まる10〜11桁の数字で入力してください'; return; }
  }

  const btn = document.getElementById('bk-submit-btn');
  btn.disabled = true;
  btn.textContent = '送信中...';

  try{
    const { error } = await supa.from('bookings').insert({
      member_id: memberId,
      guest_name: name,
      guest_phone: phone,
      scheduled_date: pendingBooking.date,
      scheduled_slot: pendingBooking.slot,
      notes: notes || null,
      status: 'pending',
      attendance_type: attendanceType,
      partner_name: partnerName,
      partner_member_id: partnerMemberId,
      partner_phone: partnerPhone
    });
    if(error){
      // 重複エラー（同じ枠を別の人が先に取った）
      if(String(error.message).indexOf('duplicate') >= 0 || String(error.code) === '23505'){
        errEl.textContent = '申し訳ございません。同じ時間帯が他の方に取られた直後でした。お手数ですが別の枠をお選びください。';
      }else{
        errEl.textContent = '予約に失敗しました：' + error.message;
      }
      btn.disabled = false;
      btn.textContent = 'この内容で予約する';
      // 最新状態を再取得
      await loadBookedSlots();
      renderCalendar();
      if(selectedDate) renderSlotList(selectedDate);
      return;
    }
    okEl.style.display = 'block';
    btn.textContent = '予約完了';
    setTimeout(async () => {
      closeBooking();
      await loadBookedSlots();
      renderCalendar();
      if(selectedDate) renderSlotList(selectedDate);
    }, 1500);
  }catch(e){
    console.log('booking submit exception:', e);
    errEl.textContent = 'エラーが発生しました';
    btn.disabled = false;
    btn.textContent = 'この内容で予約する';
  }
}

// ===== 起動 =====
(function init(){
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth() + 1;
  loadAndRender();
})();
