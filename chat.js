(() => {
 'use strict';
 const T = window.PortfolioTools;
 const $ = id => document.getElementById(id);
 const launcher = $('chat-launcher'), panel = $('chat-panel'), messages = $('chat-messages'), input = $('chat-input'), status = $('chat-status'), badge = $('chat-mode');
 const suggestions = [...document.querySelectorAll('[data-question]')];
 let history = [], pending = false, lastSent = -Infinity, controller = null, generation = 0, lastQuestion = '', location = null;
 let endpoint = '';
 try { const u = new URL(window.PORTFOLIO_CHAT_CONFIG?.endpoint || ''); if (u.protocol === 'https:' || u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname)) endpoint = u.href; } catch { /* Not configured. */ }
 const offlineBadge = 'Chưa kết nối AI · Giờ và lịch trên thiết bị';
 badge.textContent = offlineBadge;
 const timezone = () => $('chat-timezone').value;
 const weatherIntent = text => /thoi tiet|mua|nhiet do|weather/.test(T.normalize(text));
 function safeURL(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } }
 function save() {
   if (!$('remember-chat').checked) return;
   try { localStorage.setItem('hb-chat-v2', JSON.stringify(history.slice(-24).map(({ role, content }) => ({ role, content })))); }
   catch { status.textContent = 'Không lưu được hội thoại. Tin nhắn chỉ còn trong phiên đang mở.'; }
 }
 function textInline(parent, text) {
   const regex = /\[([^\]\n]{1,200})\]\(([^\s)]+)\)|`([^`\n]+)`/g; let from = 0, match;
   while ((match = regex.exec(text))) {
     parent.append(document.createTextNode(text.slice(from, match.index)));
     if (match[3]) { const code = document.createElement('code'); code.textContent = match[3]; parent.append(code); }
     else {
       const url = safeURL(match[2]);
       if (url) { const a = document.createElement('a'); a.textContent = match[1]; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a); }
       else parent.append(document.createTextNode(match[1]));
     }
     from = regex.lastIndex;
   }
   parent.append(document.createTextNode(text.slice(from)));
 }
 function markdown(parent, content) {
   let code = null, list = null;
   for (const line of content.split('\n')) {
     if (/^\s*```/.test(line)) { if (code) code = null; else { const pre = document.createElement('pre'); code = document.createElement('code'); pre.append(code); parent.append(pre); } list = null; continue; }
     if (code) { code.textContent += line + '\n'; continue; }
     const bullet = /^\s*(?:[-*]|\d+\.)\s+(.+)/.exec(line);
     if (bullet) { if (!list) { list = document.createElement('ul'); parent.append(list); } const li = document.createElement('li'); textInline(li, bullet[1]); list.append(li); }
     else { list = null; if (!line.trim()) continue; const p = document.createElement('p'); textInline(p, line.replace(/^#{1,4}\s*/, '')); parent.append(p); }
   }
 }
 function actionButton(item, text, fn) { const b = document.createElement('button'); b.className = 'chat-action'; b.textContent = text; b.addEventListener('click', fn); item.append(b); }
 function guide(id) { if (!['projects','about','contact','school'].includes(id)) return; close(); window.PortfolioMotion?.guide(id); }
 function render(message) {
   const item = document.createElement('div'); item.className = `chat-message ${message.role}`;
   const label = document.createElement('small'); label.textContent = message.role === 'user' ? 'BẠN' : message.origin === 'local' ? 'CÔNG CỤ CỤC BỘ · KHÔNG PHẢI AI' : 'BẢO BOT'; item.append(label);
   markdown(item, message.content);
   const action = message.action;
   if (['projects','about','school','contact'].includes(action)) actionButton(item, 'Mở mục liên quan ↗', () => guide(action));
   if (action === 'calendar') actionButton(item, 'Mở lịch trên thiết bị', () => window.PortfolioCalendar.tab(true));
   if (Array.isArray(message.sources)) {
     const sources = document.createElement('div'); sources.className = 'chat-sources';
     message.sources.slice(0, 12).forEach(source => {
       if (!source || typeof source.url !== 'string') return;
       const url = safeURL(source.url); if (!url) return;
       const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = source.title || new URL(url).hostname;
       sources.append(a, document.createElement('br'));
       if (source.accessedAt && Number.isFinite(Date.parse(source.accessedAt))) { const date = document.createElement('small'); date.textContent = 'Tra cứu: ' + new Date(source.accessedAt).toLocaleString('vi-VN', { timeZone: timezone() }) + ' · ' + timezone(); sources.append(date, document.createElement('br')); }
     }); item.append(sources);
   }
   for (const evidence of (message.evidence || []).slice(0, 6)) {
     if (!evidence || typeof evidence !== 'object') continue;
     if (evidence.kind === 'section') actionButton(item, 'Mở mục liên quan ↗', () => guide(evidence.section));
     if (evidence.kind === 'calendar_proposal') {
       const note = document.createElement('div'); note.className = 'chat-event-preview'; note.textContent = 'Đề xuất lịch · Chưa lưu · Cần bạn xác nhận'; item.append(note);
       actionButton(item, 'Xem bản dự thảo lịch', () => { try { window.PortfolioCalendar.propose(evidence.events); } catch (error) { status.textContent = 'Đề xuất chưa hợp lệ: ' + error.message; } });
     }
     if (evidence.kind === 'calendar_query') {
       const block = document.createElement('div'); block.className = 'chat-event-preview';
       try { const found = window.PortfolioCalendar.query({ date: evidence.date, query: evidence.query, timezone: timezone() }); block.textContent = 'Kết quả thực từ lịch thiết bị: ' + (found.length ? found.join('\n') : 'Chưa có sự kiện phù hợp.'); }
       catch { block.textContent = 'Chưa thể tra lịch với ngày hoặc điều kiện này.'; }
       item.append(block);
     }
     if (evidence.kind === 'weather' && typeof evidence.place === 'string' && evidence.current && Number.isFinite(evidence.current.temperatureC)) {
       const detail = document.createElement('div'); detail.className = 'chat-event-preview';
       detail.textContent = `${evidence.place}\nHiện tại: ${evidence.current.condition} · ${evidence.current.temperatureC}°C · Lượng mưa ${evidence.current.precipitationMM} mm\nCập nhật: ${evidence.current.updatedAt} · Hiển thị theo ${evidence.timezone}\n${evidence.note || ''}`;
       item.append(detail);
     }
   }
   messages.append(item); while (messages.children.length > 24) messages.firstElementChild.remove(); messages.scrollTop = messages.scrollHeight;
 }
 function append(message) { history.push(message); history = history.slice(-24); render(message); save(); }
 function greet() { append({ role: 'assistant', origin: 'local', content: 'Chào bạn! Mình có thể mở portfolio, xem giờ thực và quản lý lịch trên thiết bị. Hỏi đáp AI rộng, tra cứu web và thời tiết cần endpoint AI. Trạng thái kết nối luôn hiện ở phía trên.' }); }
 try {
   $('remember-chat').checked = localStorage.getItem('hb-chat-consent') === 'on';
   if ($('remember-chat').checked) {
     const stored = JSON.parse(localStorage.getItem('hb-chat-v2') || '[]');
     if (Array.isArray(stored)) history = stored.filter(m => ['user','assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.length <= 12000).slice(-24);
   }
 } catch { /* Optional persistence. */ }
 history.forEach(render); if (!history.length) greet();
 function open() { panel.hidden = false; launcher.setAttribute('aria-expanded', 'true'); launcher.dataset.state = 'listening'; input.focus({ preventScroll: true }); messages.scrollTop = messages.scrollHeight; }
 function close() { panel.hidden = true; launcher.setAttribute('aria-expanded', 'false'); launcher.dataset.state = 'waiting'; launcher.focus({ preventScroll: true }); }
 function localReply(question) {
   const q = T.normalize(question), now = new Date(), zone = timezone();
   if (/may gio|gio roi|gio hien tai|ngay mai la thu|hom nay la thu|chenh.*gio|gio.*chenh|thu (sau|bay|hai|ba|tu|nam) toi/.test(q)) {
     if (/chenh/.test(q) && /nhat|tokyo/.test(q)) {
       const delta = (T.offset(now, 'Asia/Tokyo') - T.offset(now, 'Asia/Ho_Chi_Minh')) / 60;
       return { content: `Theo dữ liệu múi giờ thực hiện tại, Nhật Bản (Asia/Tokyo) nhanh hơn Việt Nam ${delta} giờ.\nViệt Nam: ${T.timeData('Asia/Ho_Chi_Minh', now).time}\nNhật Bản: ${T.timeData('Asia/Tokyo', now).time}\nThời điểm tính: ${now.toISOString()}.` };
     }
     const data = T.timeData(zone, now), date = T.relativeDate(question, now, zone);
     const day = date ? `${date} là ${new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'))}.\n` : '';
     return { content: `${day}Hiện tại: ${data.time} · ${data.weekday}, ${data.date}\nMúi giờ: ${zone}. Tính từ đồng hồ thiết bị tại ${data.now}, không dùng kiến thức ghi nhớ của AI.` };
   }
   if (/ngay mai.*co gi|hom nay.*co gi|xem lich|tra lich/.test(q)) {
     const date = T.relativeDate(question, now, zone) || T.localDate(now, zone);
     const found = window.PortfolioCalendar.query({ date, timezone: zone });
     return { content: `Lịch trên thiết bị ngày ${date} (${zone}):\n${found.length ? found.join('\n') : 'Chưa có sự kiện nào.'}\nChưa kết nối Google/Microsoft Calendar; không có nhắc nền khi đóng trang.`, action: 'calendar' };
   }
   if (!endpoint && /lich|buoi|su kien/.test(q)) return { content: 'Chưa kết nối AI để hiểu và soạn lịch từ yêu cầu tự nhiên. Bạn vẫn có thể dùng Lịch của tôi để thêm, sửa, xóa, tìm và xuất .ics. Khi thêm, hãy chọn đủ tên, ngày, giờ, thời lượng và múi giờ. Lịch chỉ lưu trên thiết bị sau khi bạn bấm Lưu.', action: 'calendar' };
   if (!endpoint && weatherIntent(question)) return { content: location || /\bo\s+\S+|thu duc|ha noi|sai gon|ho chi minh/.test(q) ? 'Chưa kết nối backend AI/thời tiết nên mình chưa lấy được dữ liệu thật. Hãy cấu hình endpoint trước; mình không thể xác nhận hiện có mưa hoặc tự bịa dự báo.' : 'Bạn muốn xem thời tiết ở địa điểm nào? Nhập tên thành phố/tỉnh hoặc chọn “Dùng vị trí của tôi”. Việc lấy dữ liệu thật cần backend đã kết nối.' };
   if (!endpoint && /du an|project|noel|20.10|trung thu/.test(q)) return { content: 'Thông tin portfolio có sẵn: bốn dự án của Bảo là Quà tặng 20.10, Noel, Chúc mừng và Thiệp Trung Thu.', action: 'projects' };
   if (!endpoint && /bao.*hoc|ispace|an ninh/.test(q)) return { content: 'Thông tin portfolio có sẵn: Gia Bảo là tân sinh viên An ninh mạng tại iSPACE và cộng tác viên tuyển sinh cho trường.', action: 'school' };
   if (!endpoint && /lien he|facebook|zalo/.test(q)) return { content: 'Bạn có thể kết nối qua Facebook, Zalo Chat hoặc TikTok trong mục Liên hệ.', action: 'contact' };
   return null;
 }
 function busy(on) { pending = on; $('chat-send').disabled = on; suggestions.forEach(b => { b.disabled = on; }); $('chat-stop').hidden = !on; launcher.dataset.state = on ? 'thinking' : panel.hidden ? 'waiting' : 'replying'; panel.setAttribute('aria-busy', String(on)); }
 const stages = { thinking: 'AI đang suy nghĩ…', search: 'Công cụ tìm kiếm web đã chạy · Đang tổng hợp nguồn…', weather: 'Đang lấy dữ liệu thời tiết thật…', calendar: 'Đang chuẩn bị lịch hoặc điều kiện tra lịch…', tools: 'Đang đọc dữ liệu công cụ…' };
 async function readResponse(response) {
   if (!response.headers.get('Content-Type')?.includes('application/x-ndjson')) return response.json();
   const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', answer, size = 0;
   function process(line) {
     if (!line.trim()) return;
     const event = JSON.parse(line);
     if (event.type === 'progress' && stages[event.stage]) status.textContent = stages[event.stage];
     if (event.type === 'result') answer = event.data;
     if (event.type === 'error') throw new Error(event.error || 'connection');
   }
   while (true) {
     const chunk = await reader.read(); if (chunk.done) break;
     size += chunk.value.byteLength; if (size > 300000) throw new Error('invalid_reply');
     buffer += decoder.decode(chunk.value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(process);
   }
   buffer += decoder.decode(); process(buffer); if (!answer) throw new Error('incomplete_reply'); return answer;
 }
 async function ask(question, retry = false) {
   if (pending) return;
   question = question.trim(); if (!question || question.length > 1500) { status.textContent = 'Tin nhắn cần từ 1 đến 1500 ký tự.'; return; }
   if (!retry && performance.now() - lastSent < 1300) { status.textContent = 'Chờ một nhịp rồi gửi tiếp nhé.'; return; }
   const token = ++generation; lastSent = performance.now(); lastQuestion = question; $('chat-retry').hidden = true;
   let previous = history.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 5000) }));
   if (retry && previous.at(-1)?.role === 'user' && previous.at(-1)?.content === question) previous.pop();
   while (previous.reduce((n, m) => n + m.content.length, 0) > 5500) previous.shift();
   if (!retry) append({ role: 'user', content: question }); input.value = '';
   busy(true); status.textContent = endpoint ? 'Đang yêu cầu backend xử lý…' : 'Đang xử lý bằng công cụ cục bộ…';
   let timer;
   try {
     const local = localReply(question);
     if (local) { append({ role: 'assistant', origin: 'local', ...local }); status.textContent = 'Kết quả cục bộ trên thiết bị · Không gọi mô hình AI.'; return; }
     if (!endpoint) { append({ role: 'assistant', origin: 'local', content: 'Chưa kết nối AI. Mình chưa thể trả lời rộng hoặc tra cứu thông tin mới. Bạn vẫn dùng được giờ thực, lịch trên thiết bị và thông tin portfolio. Cần cấu hình endpoint riêng để bật AI, web và thời tiết.' }); status.textContent = 'Chưa gửi yêu cầu tới mô hình AI.'; return; }
     const currentController = new AbortController(); controller = currentController; timer = setTimeout(() => currentController.abort('timeout'), 35000);
     const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify({ message: question, history: previous, timezone: timezone(), sentAt: new Date().toISOString(), ...(location && weatherIntent(question) ? { location } : {}) }), signal: currentController.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
     if (!response.ok) throw new Error(response.status === 429 ? 'rate_limit' : response.status === 503 ? 'backend_not_configured' : 'connection');
     const data = await readResponse(response);
     if (generation !== token) return;
     if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 12000) throw new Error('invalid_reply');
     badge.textContent = 'AI đã kết nối · Công cụ có nguồn kiểm chứng';
     append({ role: 'assistant', content: data.reply, sources: data.sources, evidence: Array.isArray(data.evidence) ? data.evidence : [], action: ['projects','about','school','contact'].includes(data.action) ? data.action : undefined });
     status.textContent = data.tools?.length ? 'Công cụ đã chạy: ' + data.tools.join(', ') : 'AI trả lời · Không có lượt tra cứu mới trong phản hồi này.';
   } catch (error) {
     if (generation !== token) return;
     badge.textContent = offlineBadge;
     status.textContent = error.message === 'rate_limit' ? 'Backend giới hạn lượt gửi. Hãy đợi rồi thử lại; chưa có câu trả lời mới.' : error.message === 'backend_not_configured' ? 'Backend chưa có cấu hình AI hợp lệ. Không có kết quả AI.' : controller?.signal.aborted ? 'Đã dừng hoặc hết thời gian chờ. Chưa nhận câu trả lời hoàn chỉnh.' : 'Mất kết nối hoặc phản hồi không hợp lệ. Không có kết quả mới; hãy thử lại.';
     $('chat-retry').hidden = false;
   } finally { clearTimeout(timer); if (generation === token) { controller = null; busy(false); } }
 }
 launcher.hidden = false; launcher.dataset.state = 'waiting'; input.maxLength = 1500;
 launcher.addEventListener('click', () => panel.hidden ? open() : close()); $('chat-close').addEventListener('click', close);
 panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
 $('chat-form').addEventListener('submit', e => { e.preventDefault(); ask(input.value); }); suggestions.forEach(b => b.addEventListener('click', () => ask(b.dataset.question)));
 $('chat-stop').addEventListener('click', () => controller?.abort()); $('chat-retry').addEventListener('click', () => ask(lastQuestion, true));
 $('chat-clear').addEventListener('click', () => { generation++; controller?.abort(); controller = null; busy(false); lastSent = -Infinity; history = []; messages.replaceChildren(); try { localStorage.removeItem('hb-chat-v2'); sessionStorage.removeItem('hb-chat'); } catch { /* Optional. */ } greet(); badge.textContent = offlineBadge; status.textContent = 'Đã xóa hội thoại.'; $('chat-retry').hidden = true; input.focus({ preventScroll: true }); });
 $('remember-chat').addEventListener('change', () => { try { localStorage.setItem('hb-chat-consent', $('remember-chat').checked ? 'on' : 'off'); if (!$('remember-chat').checked) localStorage.removeItem('hb-chat-v2'); else save(); status.textContent = $('remember-chat').checked ? 'Bạn đã chọn lưu hội thoại trên thiết bị.' : 'Không lưu hội thoại lâu dài; bản lưu cũ đã được xóa.'; } catch { status.textContent = 'Bộ nhớ không khả dụng. Hội thoại chỉ ở phiên đang mở.'; } });
 $('chat-location').addEventListener('click', () => {
   if (location) { location = null; $('chat-location').textContent = 'Dùng vị trí của tôi'; status.textContent = 'Đã bỏ vị trí đã chọn.'; return; }
   if (!navigator.geolocation) { status.textContent = 'Trình duyệt không hỗ trợ vị trí. Hãy nhập địa danh vào tin nhắn.'; return; }
   status.textContent = 'Đang xin quyền vị trí theo lựa chọn của bạn…';
   navigator.geolocation.getCurrentPosition(position => { location = { consented: true, latitude: Number(position.coords.latitude.toFixed(3)), longitude: Number(position.coords.longitude.toFixed(3)) }; $('chat-location').textContent = 'Bỏ vị trí đã chọn'; status.textContent = 'Đã chọn vị trí. Chỉ gửi tọa độ cho backend khi bạn hỏi thời tiết.'; }, () => { status.textContent = 'Chưa lấy được vị trí. Bạn có thể nhập tên thành phố hoặc tỉnh.'; }, { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false });
 });
})();
