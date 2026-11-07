# Hồng Gia Bảo — Portfolio & Bảo Bot

Website tĩnh tiếng Việt, tương thích GitHub Pages, giữ ảnh, thông tin cá nhân và bốn dự án gốc. Không cần build hoặc secret để chạy frontend.

```sh
cd /workspace/gioithieu
python3 -m http.server 8000 --bind 127.0.0.1
```

## Luồng con trỏ

`BUILDING → FINISHING → FOLLOWING ↔ IDLE_WORKING`

Mở trang: 8–12 con trỏ trên PC tự dựng menu, tiêu đề, ảnh, nội dung và cả những phần ngoài màn hình trong khoảng 4–6 giây, không phụ thuộc cuộn/di chuột. Có tiến độ tổng thể và nút **Hoàn thiện ngay**. Các nhóm thao tác đồng thời, con trỏ/đường vẽ bám thành phần. Mọi phần được dành sẵn không gian nên không nhảy bố cục, không tự cuộn. Focus vào nội dung hoặc mở chat trong lúc dựng sẽ hoàn thiện ngay để thao tác bình thường.

Xong: thu dọn, hiện “Website ready”, tập hợp ngắn rồi mới bay theo người dùng. Khoảng ba giây không thao tác sẽ tự chia nhóm nhận nhiệm vụ trang trí mới liên tục. Khi di chuyển lại, công việc thu dọn và chuyển về theo chuột. Không tự bấm/nhập hoặc sửa nội dung thật. Mobile/thiết bị yếu giảm số con trỏ.

Bảng góc trái có bật/tắt, mức hoạt động, đi theo, tự làm và **Dựng lại**. Một vòng animation dùng chung cho startup, vật lý và nền; delta time có giới hạn, cache tọa độ cập nhật khi cuộn/resize/bố cục thay đổi, dừng khi tab ẩn. Các chi tiết tạm, nhiệm vụ, log và vệt đuôi có giới hạn. Lớp trang trí xuyên click, không đọc bởi screen reader. Tôn trọng giảm chuyển động; tắt JavaScript vẫn đọc toàn bộ portfolio.

## Trợ lý, giờ, thời tiết và lịch

Bảo Bot không tự mở chat. Mặc định **Chưa kết nối AI**, không giả AI bằng các câu soạn sẵn. Câu hỏi giờ cơ bản dùng đồng hồ thiết bị + IANA timezone thực (mặc định Asia/Ho_Chi_Minh), ghi rõ nguồn cục bộ; có đổi timezone và giải quyết ngày tương đối. Thông tin portfolio cục bộ được ghi nhãn riêng.

Khi cấu hình backend, AI có thể trò chuyện rộng, giữ ngữ cảnh và dùng web search có nguồn, công cụ thời gian/thời tiết và đề xuất lịch có cấu trúc. Chat có tiến độ công cụ, dừng/thử lại, lịch sử trong bộ nhớ, Markdown/code/nguồn an toàn và nút xóa. **Chỉ lưu hội thoại lâu dài khi khách chọn checkbox.** Không tự xin vị trí; chỉ khi bấm “Dùng vị trí của tôi”, có thể bỏ và nhập địa danh thay thế.

Tab **Lịch của tôi** hoạt động ngay trên frontend: xem/tìm/thêm/sửa/xóa, múi giờ từng sự kiện, xuất `.ics`. Bản lịch AI tạo chỉ là dự thảo, cần xác nhận trước khi lưu. Chỉ báo lưu thành công sau khi localStorage ghi được. Không đồng bộ Google/Microsoft, không lời mời hoặc nhắc nền khi đóng trang. Chưa có OAuth/dịch vụ lịch bên ngoài. Có kiểm tra ngày không tồn tại và giờ trùng/không tồn tại khi DST.

AI thật, web search và thời tiết qua công cụ cần backend đã cấu hình. Nếu thiếu cấu hình, API lỗi/timeout hoặc nguồn thời tiết cũ: báo rõ, không bịa kết quả. Hướng dẫn đầy đủ và biến môi trường nằm trong [server/README.md](server/README.md). Backend chưa được deploy bằng khóa live trong phiên nâng cấp này.

## Tệp chính

- `app.js`, `styles.css`, `living.css`, `effects.css`, `interactions.js`, `index.html`: startup, đàn con trỏ, bố cục và hiệu ứng.
- `tools.js`: thời gian, timezone, ngày tương đối, xác thực sự kiện và xuất ICS; dùng chung browser/backend.
- `calendar.js`, `chat.js`, `config.js`: lịch cục bộ, giao diện chat, công cụ cục bộ và endpoint công khai tùy chọn.
- `server/worker.mjs`, `server/services.mjs`, `server/wrangler.toml`, `server/env.example`: backend AI và công cụ; API key chỉ ở secret store backend.

## Kiểm tra

Cần Playwright và Chromium cho các bài browser, server frontend đang chạy. Có thể đặt `BASE_URL`, `CHROMIUM_PATH`.

```sh
node tests/startup.cjs
node tests/smoke.cjs
node tests/cursors.cjs
node tests/interactions.cjs
node tests/chat.cjs
node tests/calendar.cjs
node tests/tools.test.cjs
node server/tests/worker.test.mjs
```

Kiểm tra browser gồm tự dựng khi đứng yên, phần ngoài màn hình, không đi theo trước khi xong, bỏ qua/dựng lại, quán tính/đổi hướng, nhiệm vụ liên tục, cuộn/resize, tạm dừng tab ẩn, cảm ứng, bàn phím, sáu kích thước màn hình, reduced motion và JavaScript tắt. Chat/lịch kiểm tra giờ thực, trạng thái chưa kết nối, API lỗi/dừng/thử lại, hỏi địa điểm, preview/xác nhận, CRUD và file ICS. Kiểm tra backend dùng HTTP/model giả lập cho tool loop, nguồn web, thời tiết và lỗi; không gọi AI live.
