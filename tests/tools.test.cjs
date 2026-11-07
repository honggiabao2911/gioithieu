const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../tools.js');
const T = global.PortfolioTools;
test('actual instant maps to Vietnam and Japan, across midnight', () => {
 const now = new Date('2026-11-07T18:30:00Z');
 assert.equal(T.timeData('Asia/Ho_Chi_Minh', now).date, '2026-11-08');
 assert.equal(T.timeData('Asia/Ho_Chi_Minh', now).time, '01:30:00');
 assert.equal(T.timeData('Asia/Tokyo', now).time, '03:30:00');
 assert.equal((T.offset(now,'Asia/Tokyo') - T.offset(now,'Asia/Ho_Chi_Minh')) / 60, 2);
 assert.equal(T.relativeDate('ngày mai', now), '2026-11-09');
 assert.equal(T.relativeDate('thứ Sáu tới', now), '2026-11-13');
});
test('timezone and event validation reject impossible and ambiguous dates', () => {
 assert.equal(T.zonedToUTC('2026-11-08','14:00','Asia/Ho_Chi_Minh'), '2026-11-08T07:00:00.000Z');
 assert.throws(() => T.zonedToUTC('2026-02-30','14:00','Asia/Ho_Chi_Minh'));
 assert.throws(() => T.zonedToUTC('2026-11-01','01:30','America/New_York'), /trùng/);
 assert.throws(() => T.zonedToUTC('2026-03-08','02:30','America/New_York'), /không tồn tại/);
 assert.throws(() => T.validZone('not/a-zone'));
 assert.throws(() => T.validateEvent({ title:'Test',date:'2026-11-08',time:'14:00',duration:0,notes:'',timezone:'UTC' }));
});
test('ICS has UTC instants, CRLF, safe escaping, UTF-8 line folding', () => {
 const event={id:'a',title:'Học Python; thử, tiếp\nkhông chèn dòng',date:'2026-11-08',time:'14:00',duration:60,timezone:'Asia/Ho_Chi_Minh',notes:'Thông tin '.repeat(20)};
 const ics=T.exportICS([event],new Date('2026-11-07T00:00:00Z'));
 assert.match(ics,/DTSTART:20261108T070000Z/); assert.match(ics,/DTEND:20261108T080000Z/);
 assert.ok(ics.includes('Python\\; thử\\, tiếp\\n'));
 assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
});
