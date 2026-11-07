(() => {
  'use strict';
  const launcher = document.getElementById('chat-launcher');
  const panel = document.getElementById('chat-panel');
  const messages = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const status = document.getElementById('chat-status');
  const badge = document.getElementById('chat-mode');
  const suggestions = [...document.querySelectorAll('[data-question]')];
  let history = [], pending = false, lastSent = -Infinity, controller = null, generation = 0;
  let endpoint = '';
  try {
    const url = new URL(window.PORTFOLIO_CHAT_CONFIG?.endpoint || '');
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) endpoint = url.href;
  } catch { /* An empty URL selects the honest local introduction mode. */ }
  const modeText = endpoint ? 'AI · Chưa kết nối' : 'Giới thiệu tự động · Dữ liệu portfolio';
  badge.textContent = modeText;
  function save() { try { sessionStorage.setItem('hb-chat', JSON.stringify(history.slice(-24))); } catch { /* Optional. */ } }
  function setBot(state) { launcher.dataset.state = state; }
  function guide(id) {
    if (!['projects', 'about', 'contact', 'school'].includes(id)) return;
    close();
    if (window.PortfolioMotion) window.PortfolioMotion.guide(id);
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
  function renderMessage(message) {
    const item = document.createElement('div'); item.className = `chat-message ${message.role}`;
    const label = document.createElement('small'); label.textContent = message.role === 'user' ? 'BẠN' : 'BẢO BOT';
    const text = document.createElement('p'); text.textContent = message.content;
    item.append(label, text);
    if (message.action && ['projects', 'about', 'contact', 'school'].includes(message.action)) {
      const link = document.createElement('button');
      link.className = 'chat-action'; link.textContent = { projects: 'Đến các dự án ↗', about: 'Đọc giới thiệu ↗', contact: 'Đến mục liên hệ ↗', school: 'Xem iSPACE ↗' }[message.action];
      link.addEventListener('click', () => guide(message.action)); item.append(link);
    }
    messages.append(item);
    while (messages.children.length > 24) messages.firstElementChild.remove();
    messages.scrollTop = messages.scrollHeight;
  }
  function append(message) { history.push(message); history = history.slice(-24); renderMessage(message); save(); }
  function greet() {
    append({ role: 'assistant', content: 'Chào bạn! Mình là Bảo Bot. Mình có thể giới thiệu về Gia Bảo, các dự án và cách liên hệ. Bạn muốn khám phá điều gì?' });
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem('hb-chat') || '[]');
    if (Array.isArray(saved)) history = saved.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.length <= 2000).slice(-24);
  } catch { /* Unavailable or corrupt storage does not block chat. */ }
  history.forEach(renderMessage);
  if (!history.length) greet();
  function open() {
    panel.hidden = false; launcher.setAttribute('aria-expanded', 'true');
    setBot('listening'); input.focus({ preventScroll: true }); messages.scrollTop = messages.scrollHeight;
  }
  function close() {
    panel.hidden = true; launcher.setAttribute('aria-expanded', 'false'); setBot('waiting');
    launcher.focus({ preventScroll: true });
  }
  function localReply(question) {
    const q = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/du an|project|noel|trung thu|20.10|chuc mung/.test(q)) return { content: 'Bảo có bốn dự án web cá nhân: Quà tặng 20.10, Noel, Chúc mừng và Thiệp Trung Thu. Bạn có thể mở từng dự án trong mục Dự án.', action: 'projects' };
    if (/lien he|facebook|zalo|tiktok|ket noi/.test(q)) return { content: 'Bạn có thể kết nối với Gia Bảo qua Facebook, Zalo Chat hoặc TikTok. Các liên kết gốc được giữ trong mục Liên hệ.', action: 'contact' };
    if (/hoc|ispace|truong|an ninh|sinh vien/.test(q)) return { content: 'Gia Bảo là tân sinh viên ngành An ninh mạng tại iSPACE, đồng thời là cộng tác viên tuyển sinh cho trường. Bảo đang học các kiến thức nhập môn về An ninh mạng.', action: 'school' };
    if (/ky nang|python|capcut|video|cong nghe|phan cung/.test(q)) return { content: 'Bảo biết sử dụng máy tính, đang tìm hiểu phần cứng và Python; thích quay chụp, dựng video TikTok bằng CapCut, tư vấn tuyển sinh và làm việc nhóm. Portfolio không nêu chứng chỉ hay mức thành thạo.', action: 'about' };
    if (/chuot|con tro|dan|bot|ai/.test(q)) return { content: 'Đàn con trỏ là mô phỏng chạy cục bộ: bay theo chuột, rồi tự tìm việc sau khoảng 2–3 giây bạn nghỉ tay. Chat hiện dùng dữ liệu giới thiệu có sẵn; chưa kết nối mô hình AI.' };
    if (/chao|hello|hi\b|cam on/.test(q)) return { content: 'Chào bạn, rất vui được gặp bạn! Mình có thể giúp bạn xem dự án, tìm hiểu Bảo đang học gì hoặc mở mục liên hệ.' };
    return { content: 'Mình đang ở chế độ Giới thiệu tự động, chỉ trả lời từ thông tin có sẵn trong portfolio. Mình chưa có dữ liệu để trả lời câu hỏi này. Bạn có thể hỏi về việc học, kỹ năng, bốn dự án hoặc cách liên hệ Gia Bảo.' };
  }
  function busy(on) {
    pending = on; send.disabled = on; suggestions.forEach(b => { b.disabled = on; });
    setBot(on ? 'thinking' : panel.hidden ? 'waiting' : 'replying');
    panel.setAttribute('aria-busy', String(on));
  }
  async function ask(question) {
    if (pending) return;
    question = question.trim();
    if (!question || question.length > 600) { status.textContent = 'Hãy nhập từ 1 đến 600 ký tự.'; return; }
    if (performance.now() - lastSent < 1300) { status.textContent = 'Chờ một nhịp rồi gửi tiếp nhé.'; return; }
    const token = ++generation;
    lastSent = performance.now();
    const previous = history.slice(-10).map(({ role, content }) => ({ role, content }));
    append({ role: 'user', content: question }); input.value = '';
    busy(true); status.textContent = endpoint ? 'Đang kết nối trợ lý AI…' : 'Đang tìm thông tin trong portfolio…';
    let timer;
    try {
      let answer;
      if (endpoint) {
        controller = new AbortController();
        timer = setTimeout(() => controller?.abort(), 18000);
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question, history: previous }), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error(response.status === 429 ? 'rate-limit' : 'connection');
        const data = await response.json();
        if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 2000) throw new Error('invalid-reply');
        answer = { content: data.reply, action: ['projects', 'about', 'contact', 'school'].includes(data.action) ? data.action : undefined };
        badge.textContent = 'AI · Đã kết nối endpoint';
      } else answer = localReply(question);
      if (generation !== token) return;
      append({ role: 'assistant', ...answer });
      status.textContent = endpoint ? 'Câu trả lời do AI tạo. Thông tin chính thức nằm trong portfolio.' : 'Trả lời từ dữ liệu có sẵn · Không gọi mô hình AI.';
    } catch (error) {
      if (generation !== token) return;
      badge.textContent = 'Giới thiệu tự động · AI chưa kết nối';
      append({ role: 'assistant', ...localReply(question) });
      status.textContent = error.message === 'rate-limit' ? 'AI đang giới hạn lượt gửi. Đã dùng phần giới thiệu có sẵn.' : 'Không kết nối được AI. Đã chuyển sang giới thiệu có sẵn; bạn có thể gửi lại sau.';
    } finally {
      clearTimeout(timer);
      if (generation === token) { controller = null; busy(false); }
    }
  }
  launcher.hidden = false; setBot('waiting');
  launcher.addEventListener('click', () => panel.hidden ? open() : close());
  document.getElementById('chat-close').addEventListener('click', close);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  document.getElementById('chat-form').addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  suggestions.forEach(button => button.addEventListener('click', () => ask(button.dataset.question)));
  document.getElementById('chat-clear').addEventListener('click', () => {
    generation++; controller?.abort(); controller = null; busy(false); lastSent = -Infinity;
    history = []; messages.replaceChildren(); greet(); badge.textContent = modeText;
    status.textContent = 'Đã xóa hội thoại trong phiên này.'; input.focus({ preventScroll: true });
  });
})();
