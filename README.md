# Hồng Gia Bảo — Living Portfolio

Portfolio tiếng Việt, tương thích GitHub Pages. Nội dung, ảnh và bốn liên kết dự án luôn có sẵn trong HTML. Không cần cuộn để dựng nội dung; không cần build hay API key để chạy website và chat giới thiệu.

## Chạy

```sh
cd /workspace/gioithieu
python3 -m http.server 8000 --bind 127.0.0.1
```

GitHub Pages phục vụ các tệp ở thư mục gốc, gồm HTML, CSS, JavaScript và `avatar.jpg`. Thư mục `server/` là backend tùy chọn riêng, không chạy trên GitHub Pages.

## Đàn con trỏ tự hoạt động

Mặc định 10 con trên PC, 4 trên mobile/thiết bị ít tài nguyên; chọn Nhẹ/Thường/Sôi động trong bảng điều khiển góc trái. PC có 8/10/12 con, mobile có 3/4/6. Có công tắc bật/tắt toàn bộ hiệu ứng, đi theo chuột thật và tự làm khi rảnh. Tùy chọn lưu ở `localStorage` nếu trình duyệt cho phép.

Mỗi con có vận tốc, gia tốc, giới hạn tốc độ, tính cách và lịch nghỉ riêng. Đàn dùng lực hút, lực tách và quán tính; 65% có thể đi theo chuột, số còn lại khám phá mục tiêu. Chạm trên mobile cũng gọi đàn tới gần. Nhập chữ/chọn văn bản khiến đàn nhường ra mép màn hình. Chúng không tự bấm liên kết hay nhập dữ liệu.

Sau 2,5 giây không tương tác, bộ điều phối chọn các mục tiêu trong vùng nhìn thấy và phân công nhóm hai con. Có sáu loại việc: dựng khung, đặt nhãn, nối mạng, viết đoạn mã trang trí, tạo wireframe và kiểm tra viền. Chúng là lớp trang trí tạm, không sửa nội dung, liên kết hoặc kích thước bố cục thật. Mỗi mục tiêu có cooldown và tránh lặp thao tác ngay; sau khi hoàn thành, đội tiếp tục nhận nhiệm vụ mới. Tối đa hai nhiệm vụ đồng thời trên PC, một trên mobile/chế độ Nhẹ.

Cuộn/resize chỉ cập nhật tọa độ và hủy mục tiêu rời màn hình. Không có timeline theo cuộn. Một `requestAnimationFrame` dùng chung cho vật lý, công việc, vệt đuôi và nền hạt; delta time vật lý được giới hạn, tạm dừng khi tab ẩn. Canvas có giới hạn DPR/số hạt, vệt đuôi hữu hạn, nhật ký tối đa sáu dòng. Lớp trang trí không chặn click và ẩn khỏi trình đọc màn hình.

`prefers-reduced-motion` tắt đàn và các hiệu ứng phụ. Tắt JavaScript vẫn đọc và dùng được website.

## Bảo Bot

Linh vật góc phải mở chat không tự bật. Mặc định hiển thị **Giới thiệu tự động · Dữ liệu portfolio**: trả lời cục bộ về việc học, kỹ năng, dự án và liên hệ, không gọi mô hình AI và không bịa thông tin. Các nút đưa khách tới mục tương ứng; chỉ người dùng mới kích hoạt điều hướng.

Chat có lịch sử tối đa 24 tin trong `sessionStorage`, nút xóa/đóng, phím Escape, câu hỏi gợi ý, giới hạn 600 ký tự và chống gửi liên tục. Tin nhắn luôn hiển thị bằng `textContent`; đầu ra backend chỉ được dùng với danh sách action đã định nghĩa, không thực thi HTML hay JavaScript.

Để bật AI thật, triển khai Worker trong [server/README.md](server/README.md), đặt secret ở backend và điền URL HTTPS thực tế vào `config.js`. Không có API key trong frontend/Git. Nếu lỗi kết nối, timeout hoặc bị giới hạn, chat chuyển rõ ràng về giới thiệu tự động. Backend thật chưa được triển khai/kiểm tra bằng khóa live trong lần nâng cấp này.

## Tệp chính

- `index.html`, `styles.css`, `living.css`: nội dung, bố cục, sân chơi, bộ điều khiển và chat.
- `app.js`: vật lý, trạng thái, bộ điều phối công việc và đồng hồ hoạt ảnh dùng chung.
- `interactions.js`, `effects.css`: nền hạt, aurora, thẻ nghiêng, quét ảnh và tương tác nút.
- `chat.js`, `config.js`: chat giới thiệu, kết nối endpoint tùy chọn và điều hướng an toàn.
- `server/worker.mjs`, `server/wrangler.toml`: backend AI tùy chọn, CORS, rate limit, giới hạn đầu vào và timeout.

## Kiểm tra

Trong môi trường có Playwright và Chromium, khởi động server rồi chạy:

```sh
node tests/smoke.cjs
node tests/cursors.cjs
node tests/interactions.cjs
node tests/chat.cjs
node server/tests/worker.test.mjs
```

Các bài kiểm tra trình duyệt nhận `BASE_URL` và `CHROMIUM_PATH`. Bao gồm: đàn bay theo/đổi hướng, nhiều nhiệm vụ liên tục khi không cuộn, người dùng ngắt việc, nhường chỗ khi nhập, tạm dừng tab ẩn, cuộn/resize, thao tác cảm ứng, sáu chiều rộng màn hình, tắt hiệu ứng, bàn phím, không JavaScript và giảm chuyển động. Chat kiểm tra giới thiệu đúng dữ liệu, điều hướng, lịch sử/xóa, chống gửi liên tục, text an toàn và endpoint giả lập thành công/429. Worker kiểm tra CORS, input/body limit, rate limit và phản hồi upstream giả lập. Không gọi OpenAI thật trong kiểm thử.
