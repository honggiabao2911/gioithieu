/* Shared deterministic date/calendar validation. No network, DOM or model calls. */
(() => {
  'use strict';
  const DEFAULT_ZONE = 'Asia/Ho_Chi_Minh';
  const formatters = new Map();
  function validZone(zone) {
    if (typeof zone !== 'string' || zone.length > 80) throw new Error('Múi giờ không hợp lệ.');
    try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); } catch { throw new Error('Múi giờ không hợp lệ.'); }
    return zone;
  }
  function parts(instant = new Date(), zone = DEFAULT_ZONE) {
    validZone(zone);
    if (!formatters.has(zone)) {
      if (formatters.size > 32) formatters.clear();
      formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
    }
    return Object.fromEntries(formatters.get(zone).formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function localDate(instant = new Date(), zone = DEFAULT_ZONE) { const p = parts(instant, zone); return `${p.year}-${p.month}-${p.day}`; }
  function dateValid(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
    const d = new Date(date + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === date && +date.slice(0, 4) >= 1970 && +date.slice(0, 4) <= 2100;
  }
  function addDays(date, days) { if (!dateValid(date)) throw new Error('Ngày không hợp lệ.'); const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  function offset(instant, zone) {
    const p = parts(instant, zone);
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(+instant / 1000) * 1000) / 60000;
  }
  function zonedToUTC(date, time, zone) {
    validZone(zone);
    if (!dateValid(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Ngày hoặc giờ không hợp lệ.');
    const wall = Date.parse(`${date}T${time}:00Z`);
    const offsets = new Set([-36, -12, 0, 12, 36].map(h => offset(new Date(wall + h * 3600000), zone)));
    const candidates = [...offsets].map(o => new Date(wall - o * 60000)).filter(d => {
      const p = parts(d, zone); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` === `${date} ${time}`;
    });
    if (candidates.length !== 1) throw new Error(candidates.length ? 'Giờ này trùng khi đổi giờ mùa hè. Hãy chọn giờ khác hoặc dùng UTC.' : 'Giờ này không tồn tại trong múi giờ đã chọn.');
    return candidates[0].toISOString();
  }
  function relativeDate(text, now = new Date(), zone = DEFAULT_ZONE) {
    const q = normalize(text), today = localDate(now, zone);
    if (/ngay mai/.test(q)) return addDays(today, 1);
    if (/hom nay/.test(q)) return today;
    const weekday = /thu\s*(hai|ba|tu|nam|sau|bay|2|3|4|5|6|7)|chu nhat/.exec(q);
    if (weekday) {
      const day = weekday[0].startsWith('chu') ? 0 : ({ hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 }[weekday[1]] ?? +weekday[1] - 1);
      const current = new Date(today + 'T12:00:00Z').getUTCDay();
      return addDays(today, (day - current + 7) % 7 || 7);
    }
    const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(q);
    return iso && dateValid(iso[1]) ? iso[1] : null;
  }
  function normalize(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function timeData(zone = DEFAULT_ZONE, instant = new Date()) {
    const p = parts(instant, zone);
    return { now: instant.toISOString(), timezone: zone, date: localDate(instant, zone), time: `${p.hour}:${p.minute}:${p.second}`, weekday: new Intl.DateTimeFormat('vi-VN', { timeZone: zone, weekday: 'long' }).format(instant), tomorrow: addDays(localDate(instant, zone), 1), offsetMinutes: offset(instant, zone) };
  }
  function validateEvent(input) {
    if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120 || typeof input.notes !== 'string' || input.notes.length > 1000) throw new Error('Tên tối đa 120 ký tự; ghi chú tối đa 1000 ký tự.');
    const duration = Number(input.duration);
    if (!Number.isInteger(duration) || duration < 5 || duration > 1440) throw new Error('Thời lượng phải từ 5 đến 1440 phút.');
    const timezone = validZone(input.timezone || DEFAULT_ZONE);
    const start = zonedToUTC(input.date, input.time, timezone);
    return { title: input.title.trim(), date: input.date, time: input.time, duration, timezone, notes: input.notes.trim(), start, end: new Date(Date.parse(start) + duration * 60000).toISOString() };
  }
  function escapeICS(text) { return String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function foldICS(line) {
    const result = []; let current = '', length = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (length + size > 73) { result.push(current); current = ' '; length = 1; }
      current += char; length += size;
    }
    result.push(current); return result.join('\r\n');
  }
  function exportICS(events, now = new Date()) {
    const stamp = d => d.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HGB//Local Planner//VI', 'CALSCALE:GREGORIAN'];
    events.forEach(raw => {
      const e = validateEvent(raw);
      lines.push('BEGIN:VEVENT', `UID:${escapeICS(raw.id || crypto.randomUUID())}@hgb.local`, `DTSTAMP:${stamp(now.toISOString())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${escapeICS(e.title)}`, `DESCRIPTION:${escapeICS(e.notes + '\nMúi giờ gốc: ' + e.timezone)}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR'); return lines.map(foldICS).join('\r\n') + '\r\n';
  }
  globalThis.PortfolioTools = Object.freeze({ DEFAULT_ZONE, validZone, parts, localDate, dateValid, addDays, offset, zonedToUTC, relativeDate, normalize, timeData, validateEvent, exportICS });
})();
