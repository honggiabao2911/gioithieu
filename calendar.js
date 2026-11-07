(() => {
  'use strict';
  const T = window.PortfolioTools, list = document.getElementById('calendar-list'), form = document.getElementById('calendar-form'), status = document.getElementById('calendar-status');
  const view = document.getElementById('calendar-view'), chat = document.getElementById('chat-view'), preview = document.getElementById('calendar-preview');
  let events = [], editId = null;
  try {
    const data = JSON.parse(localStorage.getItem('hb-calendar') || '[]');
    if (Array.isArray(data)) events = data.slice(0, 200).flatMap(e => { try { return [{ ...T.validateEvent(e), id: String(e.id).slice(0, 100) }]; } catch { return []; } });
  } catch { status.textContent = 'Chưa đọc được lịch trên thiết bị.'; }
  function tab(calendar) {
    document.getElementById('weather-view').hidden = true;
    document.getElementById('show-weather').setAttribute('aria-pressed','false');
    view.hidden = !calendar; chat.hidden = calendar;
    document.getElementById('show-chat').setAttribute('aria-pressed', String(!calendar));
    document.getElementById('show-calendar').setAttribute('aria-pressed', String(calendar));
  }
  function persist(next) {
    if (next.length > 200) throw new Error('Lịch đầy (tối đa 200 sự kiện). Hãy xuất hoặc xóa bớt.');
    localStorage.setItem('hb-calendar', JSON.stringify(next)); events = next; render();
  }
  function button(text, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', fn); return b; }
  function eventText(e) { return `${e.title} · ${e.date} ${e.time} · ${e.duration} phút · ${e.timezone}`; }
  function render() {
    list.replaceChildren();
    const q = T.normalize(document.getElementById('calendar-search').value);
    const found = events.filter(e => T.normalize(`${e.title} ${e.date} ${e.notes}`).includes(q)).sort((a, b) => a.start.localeCompare(b.start));
    if (!found.length) { const p = document.createElement('p'); p.textContent = 'Chưa có sự kiện phù hợp trên thiết bị này.'; list.append(p); }
    found.forEach(e => {
      const item = document.createElement('article'); item.className = 'calendar-event';
      const title = document.createElement('strong'); title.textContent = e.title;
      const detail = document.createElement('p'); detail.textContent = `${e.date} · ${e.time} · ${e.duration} phút · ${e.timezone}`;
      const note = document.createElement('p'); note.textContent = e.notes;
      item.append(title, detail, note, button('Sửa', () => {
        editId = e.id; form.hidden = false;
        for (const name of ['title', 'date', 'time', 'duration', 'timezone', 'notes']) form.elements[name].value = e[name];
        form.elements.title.focus();
      }), button('Xóa', () => {
        try { persist(events.filter(item => item.id !== e.id)); status.textContent = 'Đã xóa sự kiện khỏi lịch thiết bị.'; }
        catch { status.textContent = 'Không xóa được vì bộ nhớ thiết bị không khả dụng.'; }
      })); list.append(item);
    });
  }
  function propose(rawEvents) {
    const valid = rawEvents.map(T.validateEvent);
    if (!valid.length || valid.length > 12) throw new Error('Mỗi đề xuất cần từ 1 đến 12 sự kiện.');
    tab(true); preview.replaceChildren(); preview.hidden = false;
    const title = document.createElement('strong'); title.textContent = 'Bản xem trước · Chưa lưu'; preview.append(title);
    valid.forEach(e => { const p = document.createElement('p'); p.textContent = eventText(e); preview.append(p); });
    preview.append(button('Xác nhận lưu vào thiết bị', () => {
      try {
        persist([...events, ...valid.map(e => ({ ...e, id: crypto.randomUUID() }))]);
        preview.hidden = true; status.textContent = `Đã lưu ${valid.length} sự kiện trên thiết bị. Chưa đồng bộ dịch vụ bên ngoài.`;
      } catch (error) { status.textContent = 'Chưa lưu: ' + error.message; }
    }), button('Bỏ đề xuất', () => { preview.hidden = true; status.textContent = 'Đã bỏ đề xuất, chưa lưu gì.'; }));
  }
  document.getElementById('show-chat').addEventListener('click', () => tab(false));
  document.getElementById('show-calendar').addEventListener('click', () => { tab(true); render(); });
  document.getElementById('calendar-search').addEventListener('input', render);
  document.getElementById('calendar-new').addEventListener('click', () => {
    editId = null; form.reset(); form.hidden = false;
    const zone = document.getElementById('chat-timezone').value;
    form.elements.date.value = T.localDate(new Date(), zone); form.elements.time.value = '14:00'; form.elements.timezone.value = zone; form.elements.title.focus();
  });
  document.getElementById('calendar-cancel').addEventListener('click', () => { form.hidden = true; editId = null; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    try {
      const value = T.validateEvent(Object.fromEntries(new FormData(form)));
      const id = editId || crypto.randomUUID();
      persist([...events.filter(item => item.id !== id), { ...value, id }]);
      form.hidden = true; editId = null; status.textContent = 'Đã lưu sự kiện trên thiết bị. Chưa đồng bộ bên ngoài.';
    } catch (error) { status.textContent = 'Chưa lưu: ' + error.message; }
  });
  document.getElementById('calendar-export').addEventListener('click', () => {
    if (!events.length) { status.textContent = 'Chưa có sự kiện để xuất.'; return; }
    const url = URL.createObjectURL(new Blob([T.exportICS(events)], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'gia-bao-lich.ics'; link.click();
    queueMicrotask(() => URL.revokeObjectURL(url));
    status.textContent = 'Đã tạo file .ics. Bạn có thể tự nhập file vào ứng dụng lịch; chưa đồng bộ tự động.';
  });
  window.PortfolioCalendar = Object.freeze({ tab, propose, query({ date, query = '', timezone = document.getElementById('chat-timezone').value }) {
    if (date && !T.dateValid(date)) throw new Error('Ngày tra lịch không hợp lệ.');
    return events.filter(e => (!date || T.localDate(new Date(e.start), T.validZone(timezone)) === date) && T.normalize(e.title + e.notes).includes(T.normalize(query))).map(eventText);
  } });
  render();
})();
