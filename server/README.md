# Endpoint AI riêng (Cloudflare Worker)

Frontend vẫn chạy hoàn toàn trên GitHub Pages. Mặc định chat dùng **Giới thiệu tự động**, không gọi API và không giả vờ đã kết nối AI. Worker chỉ cần triển khai nếu bạn muốn bật AI thật. Chưa có Worker nào được triển khai bởi bản nâng cấp này.

## Cấu hình và triển khai

Cần tài khoản Cloudflare có quyền Workers, Node.js 20+ và khóa OpenAI có quyền dùng Responses API/model đã chọn.

```sh
cd server
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Nhập khóa vào lời nhắc bảo mật của Wrangler hoặc mục Secrets trong Cloudflare Dashboard. Không ghi khóa vào `config.js`, HTML, `wrangler.toml`, file commit hay chat. Chỉ `ALLOWED_ORIGIN` và `OPENAI_MODEL` là cấu hình không bí mật.

Sau khi deploy, lấy URL HTTPS Worker thực tế, điền vào `window.PORTFOLIO_CHAT_CONFIG.endpoint` trong `config.js`, rồi đẩy thay đổi frontend lên GitHub. Không thêm khóa vào URL. Endpoint công khai chỉ cho phép origin `https://honggiabao2911.github.io` (origin không chứa đường dẫn `/gioithieu/`). Đổi `ALLOWED_ORIGIN` khi dùng tên miền khác.

`CHAT_RATE_LIMITER` bắt buộc: binding trong `wrangler.toml` giới hạn 8 yêu cầu/phút/IP. Worker không chạy nếu thiếu binding hoặc secret. Bạn vẫn nên đặt hạn mức chi phí trên tài khoản OpenAI trước khi mở endpoint công khai; CORS không phải cơ chế xác thực cho endpoint công khai.

## Giao thức

POST JSON `{ "message": "Gia Bảo đang học gì?", "history": [] }`. Tin nhắn tối đa 600 ký tự; lịch sử tối đa 10 lượt được sử dụng, giới hạn tổng 9000 ký tự; body tối đa 16 KB. Phản hồi `{ "reply": "...", "action": "school" }`. Action chỉ là một trong `none`, `projects`, `about`, `contact`, `school`; trình duyệt hiển thị nút, chỉ điều hướng khi người xem bấm. Nội dung trả lời hiển thị bằng `textContent`, không thực thi HTML/JavaScript.

Có CORS theo origin cụ thể, rate limit, timeout, kiểm tra kiểu/kích thước dữ liệu. Không ghi hội thoại hay khóa ra log; request Responses dùng `store: false`. Frontend lưu tối đa 24 tin trong `sessionStorage`, có nút xóa; backend chỉ nhận tin khi cấu hình endpoint. Không gửi dữ liệu nhạy cảm vào chat.

## Kiểm tra không cần khóa

```sh
node tests/worker.test.mjs
```

Các bài kiểm tra dùng upstream giả lập: không gọi OpenAI, không tiêu tốn API. Chúng không xác nhận quyền truy cập model hay deployment thật. Muốn kiểm tra end-to-end thật cần triển khai và cấu hình khóa hợp lệ.
