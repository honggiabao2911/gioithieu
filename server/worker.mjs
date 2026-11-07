const ALLOWED_ACTIONS = new Set(['none', 'projects', 'about', 'contact', 'school']);
const FACTS = `Bạn là Bảo Bot, trợ lý của portfolio Hồng Gia Bảo. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn.
Chỉ dùng dữ liệu này cho câu hỏi về Bảo: tân sinh viên ngành An ninh mạng tại iSPACE; cộng tác viên tuyển sinh cho trường; biết sử dụng máy tính, đang tìm hiểu phần cứng và Python, đang học an ninh mạng nhập môn; thích quay/chụp, chỉnh sửa video TikTok/Trend bằng CapCut, sáng tạo, giao tiếp, làm việc nhóm.
Bốn dự án: Quà tặng 20.10, Noel, Chúc mừng, Thiệp Trung Thu. Liên hệ qua Facebook, Zalo Chat, TikTok, các liên kết đã có trên trang.
Không bịa chứng chỉ, thành tích, trình độ, kinh nghiệm hay thông tin cá nhân. Không biết thì nói chưa có thông tin trong portfolio. Không nhận mình là Gia Bảo. Không yêu cầu thông tin nhạy cảm.
Đàn con trỏ là mô phỏng vật lý chạy cục bộ, không phải AI thật và không điều khiển thiết bị. Chat này có mô hình AI riêng. Không tự thực thi mã hay mở URL.
Chỉ trả về JSON gồm reply (văn bản thuần <= 1800 ký tự) và action (none/projects/about/contact/school). Chỉ gợi ý action nếu phù hợp câu hỏi; frontend sẽ đưa nút cho khách tự bấm, không tự điều hướng.`;
function headers(origin) {
  return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
}
export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://honggiabao2911.github.io';
    const origin = request.headers.get('Origin');
    const response = (status, data) => new Response(JSON.stringify(data), { status, headers: headers(allowed) });
    if (origin !== allowed) return response(403, { error: 'origin_not_allowed' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(allowed) });
    if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' });
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return response(415, { error: 'json_required' });
    if (!env.OPENAI_API_KEY || !env.CHAT_RATE_LIMITER) return response(503, { error: 'backend_not_configured' });
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    let success;
    try { ({ success } = await env.CHAT_RATE_LIMITER.limit({ key: `portfolio:${ip}` })); }
    catch { return response(503, { error: 'rate_limiter_unavailable' }); }
    if (!success) return response(429, { error: 'too_many_requests' });
    let data;
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 16000) return response(413, { error: 'request_too_large' });
      const reader = request.body?.getReader();
      if (!reader) return response(400, { error: 'invalid_json' });
      const chunks = []; let size = 0;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16000) { await reader.cancel(); return response(413, { error: 'request_too_large' }); }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return response(400, { error: 'invalid_json' }); }
    if (typeof data?.message !== 'string' || !data.message.trim() || data.message.length > 600 || !Array.isArray(data.history || [])) return response(400, { error: 'invalid_message' });
    const history = (data.history || []).slice(-10);
    if (history.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 2000) || history.reduce((n, m) => n + m.content.length, 0) > 9000) return response(400, { error: 'invalid_history' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4.1-mini', instructions: FACTS,
          input: [...history, { role: 'user', content: data.message.trim() }], store: false, max_output_tokens: 650,
          text: { format: { type: 'json_schema', name: 'portfolio_reply', strict: true,
            schema: { type: 'object', properties: { reply: { type: 'string' }, action: { type: 'string', enum: [...ALLOWED_ACTIONS] } }, required: ['reply', 'action'], additionalProperties: false } } }
        })
      });
      if (!upstream.ok) return response(502, { error: 'ai_unavailable' });
      const result = await upstream.json();
      const output = result.output?.flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('');
      const answer = JSON.parse(output || 'null');
      if (typeof answer?.reply !== 'string' || !answer.reply.trim() || answer.reply.length > 2000 || !ALLOWED_ACTIONS.has(answer.action)) return response(502, { error: 'invalid_ai_response' });
      return response(200, { reply: answer.reply, action: answer.action });
    } catch { return response(502, { error: 'ai_unavailable' }); }
    finally { clearTimeout(timer); }
  }
};
