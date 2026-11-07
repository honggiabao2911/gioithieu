# Bảo Bot — backend AI và công cụ

Frontend tiếp tục chạy trên GitHub Pages. Backend Cloudflare Worker chạy riêng; không có backend hoặc khóa live nào được triển khai trong bản nâng cấp này. Website hiển thị **Chưa kết nối AI** cho đến khi nhận được phản hồi hợp lệ. Giờ, lịch và thông tin portfolio vẫn dùng cục bộ. Thời tiết frontend hiện gọi Open-Meteo trực tiếp, không cần backend AI. Phần backend bên dưới chỉ cần cho AI hỏi đáp rộng, web search và công cụ trong hội thoại AI; cấu hình thiếu không chặn tab Thời tiết.

## Cấu hình bắt buộc

| Tên | Nơi cấu hình | Vai trò |
| --- | --- | --- |
| `OPENAI_API_KEY` | Worker Secret | Khóa OpenAI có quyền Responses API và công cụ web search |
| `OPENAI_MODEL` | Worker Variable | Model hỗ trợ function calling và `web_search`; mặc định `gpt-4.1-mini` |
| `ALLOWED_ORIGIN` | Worker Variable | Origin frontend, mặc định `https://honggiabao2911.github.io`, không thêm `/gioithieu/` |
| `CHAT_RATE_LIMITER` | Binding trong `wrangler.toml` | 8 yêu cầu/phút/IP, bắt buộc |
| `PORTFOLIO_CHAT_CONFIG.endpoint` | `config.js` trên frontend | URL HTTPS Worker đã deploy, chỉ URL công khai, không chứa khóa |

`env.example` chỉ chứa placeholder. Không commit khóa vào file này hoặc bất kỳ file frontend/Git nào. Weather dùng Open-Meteo công khai, không cần khóa riêng trong cấu hình hiện tại. Tìm kiếm web dùng công cụ OpenAI và có phí API theo tài khoản backend.

## Chạy và deploy

Cần Node 20+, tài khoản Cloudflare Workers và khóa OpenAI có quyền phù hợp:

```sh
cd server
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Nhập khóa qua lời nhắc bảo mật hoặc Cloudflare Dashboard Secrets, không gửi khóa trong chat. Để thử local, dùng `npx wrangler dev` và cấu hình secret local bằng file `.dev.vars` bị Git bỏ qua; đặt `ALLOWED_ORIGIN` đúng origin của server frontend local (ví dụ `http://127.0.0.1:8000`). Khi deploy thật, khôi phục origin GitHub Pages.

Điền URL Worker thực tế vào `config.js` rồi cập nhật frontend. Không đặt khóa trong URL. Chỉ chạy lệnh deploy khi bạn đã cấu hình tài khoản/secret đúng; các lệnh trên là hướng dẫn, chưa được thực thi để triển khai backend trong phiên nâng cấp.

## Công cụ thực tế

- `get_time`: đồng hồ server, IANA timezone, ngày/giờ/thứ, ngày mai và offset. Context mỗi request có thời điểm xử lý thật để giải quyết “hôm nay”, “ngày mai”, “thứ Sáu tới”. Frontend dùng đồng hồ thiết bị cho câu hỏi giờ cơ bản và ghi rõ nguồn cục bộ.
- `get_weather`: geocoding từ `geocoding-api.open-meteo.com`, điều kiện hiện tại + dự báo giờ từ `api.open-meteo.com`. Địa điểm thiếu/không tìm được thì hỏi lại. Tọa độ chỉ được chấp nhận nếu trùng với context mà khách chủ động cho phép. Dữ liệu hiện tại cũ hơn hai giờ/không hợp lệ sẽ bị từ chối. Trả về địa điểm, timezone, giờ cập nhật, nhiệt độ, lượng mưa hiện tại và xác suất theo giờ, kèm nguồn. Xác suất không xác nhận hiện đang mưa; dữ liệu mô hình không phải cảm biến tại chỗ. Forecast hỗ trợ bảy ngày, không bịa cho ngày ngoài khoảng.
- `web_search`: công cụ Responses API thật. Chỉ đánh dấu tra cứu khi có `web_search_call` hoàn tất; nguồn lấy từ `url_citation` thật, không từ URL tùy tiện trong văn bản mô hình.
- `prepare_calendar`: kiểm tra đầy đủ tên/ngày/giờ/thời lượng/timezone/ghi chú, trả bản dự thảo. **Không lưu lịch.** Frontend hiển thị để khách tự xác nhận lưu trên thiết bị.
- `query_calendar`: tạo điều kiện tra cứu, trình duyệt mới đọc lịch cục bộ; backend không nhận toàn bộ lịch. Kết quả thực hiển thị riêng bởi frontend.
- `show_portfolio_section`: chỉ đề xuất một mục trong danh sách cố định. Không thực thi mã hoặc tự bấm liên kết.

Nếu mô hình thiếu dữ liệu thiết yếu hoặc thời điểm mơ hồ, chỉ dẫn yêu cầu hỏi lại. Chuyển giờ địa phương sang UTC kiểm tra round-trip, từ chối giờ không tồn tại/trùng khi DST. Lịch cục bộ không đồng bộ Google/Microsoft, không có lời mời và không có nhắc nền khi đóng trang. Chưa có OAuth cho dịch vụ lịch bên ngoài.

## Giao thức và giới hạn

POST JSON: `{ "message": "Chiều nay ở Thủ Đức có mưa không?", "history": [], "timezone": "Asia/Ho_Chi_Minh", "sentAt": "..." }`. `sentAt` là thông tin từ client; backend lấy giờ hiện tại của server làm mốc, không tin client để xác định giờ thực. `location` chỉ gửi cho yêu cầu thời tiết sau khi khách chủ động bật, gồm `consented:true`, latitude/longitude được làm tròn.

Tin nhắn tối đa 1500 ký tự, lịch sử sử dụng tối đa 10 lượt/9000 ký tự, body tối đa 24 KB. Mỗi request tối đa bốn lượt gọi model, năm function calls, timeout tổng 30 giây. Có CORS theo origin, rate limit, schema/kiểm tra tham số và danh sách công cụ cố định. CORS không phải đăng nhập cho endpoint công khai; cấu hình ngân sách API phù hợp trên tài khoản backend.

Phản hồi JSON có `reply`, `sources`, `tools`, `evidence`, `generatedAt`, `timezone`. Với `Accept: application/x-ndjson`, trả các sự kiện `progress` (thinking/search/weather/calendar/tools), `result` hoặc `error`. Frontend có thể dừng request; luồng gửi lỗi rõ ràng nếu backend mất kết nối, không thay kết quả bằng thông tin giả.

Không log khóa/hội thoại. Responses dùng `store:false`; chỉ gửi lịch sử được giới hạn để giữ ngữ cảnh. Nội dung web được coi là dữ liệu tham khảo, không phải quyền/chỉ dẫn. Frontend render Markdown bằng DOM/textContent, chỉ cho URL HTTP(S) an toàn và action đã định nghĩa. Không thực thi JavaScript hay shell từ mô hình.

## Kiểm tra

```sh
node tests/worker.test.mjs
node ../tests/tools.test.cjs
```

Các bài kiểm tra mock upstream OpenAI/Open-Meteo: không gọi model thật, không tiêu tốn API. Có kiểm tra schema, thời gian/múi giờ/DST, CORS, rate limit, body limit, tool loop, NDJSON, nguồn tìm kiếm, thời tiết cũ/lỗi và bản xem trước lịch. Chưa xác minh bằng khóa/model live hoặc deployment Cloudflare thật.
