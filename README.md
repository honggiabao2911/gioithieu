# Hồng Gia Bảo — Portfolio

Website tĩnh tiếng Việt, chạy được trên GitHub Pages, giữ nguyên ảnh cá nhân, thông tin, liên hệ và bốn dự án.

```sh
cd /workspace/gioithieu
python3 -m http.server 8000 --bind 127.0.0.1
```

## Giao diện và font

Dùng Be Vietnam Pro được lưu tại `assets/fonts/`: Regular, SemiBold, Bold, đầy đủ dấu tiếng Việt, giấy phép OFL đi kèm. Không tải font từ CDN khi khách truy cập. Font được kiểm tra bằng bảng ký tự và bằng Chrome DevTools Protocol: tiêu đề/đoạn có chữ đậm thực sự dùng font đi kèm, không trộn glyph serif từ font hệ thống.

Giao diện giảm chuyển động: bỏ nền hạt, halo, glitch, vệt đuôi và nhãn công việc bay liên tục. Chữ lớn hơn, khoảng cách thoáng, màu nhấn tiết chế. Ảnh và các minh họa dự án giữ nguyên.

## Cuộn tới đâu, dựng tới đó

Chỉ những thành phần trong vùng nhìn thấy mới nhận con trỏ và bắt đầu dựng. Phần hoàn toàn ngoài màn hình giữ nguyên tiến độ, không tự dựng hết khi mở trang. Mỗi thành phần đã có kích thước bố cục đầy đủ; clip-path/transform tạo hiệu ứng kéo khung, đặt ảnh, viết chữ theo dòng và căn hàng. Không tự cuộn, không đổi nội dung hoặc bấm liên kết.

Mặc định 4 con trỏ trên PC, 2 trên mobile. Chỉ một nhãn ngắn xuất hiện trên PC khi đang dựng; hoàn tất thì đường căn/con trỏ tự ẩn. Cuộn ngược không dựng lại. Cuộn nhanh hoàn thiện các phần đã đi qua, không tích hàng đợi chạy đuổi. Khi đang nhập hoặc chọn chữ, con trỏ nhường hoàn toàn. Focus bàn phím hoặc mở link tới mục cho phép đọc/thao tác ngay.

Bảng Hiệu ứng có bật/tắt, mật độ, tùy chọn đi theo chuột (mặc định tắt) và xem lại hiệu ứng ở vùng đang xem. Một vòng animation, delta time giới hạn, cache tọa độ cập nhật theo cuộn/resize/đổi bố cục; ngừng vòng lặp khi không còn việc. Tab ẩn tạm dừng; giảm chuyển động hoặc tắt JavaScript vẫn hiện nội dung đầy đủ. Các tùy chọn giao diện được lưu riêng ở `hb-display-v6` để không áp lại chế độ 12 con trỏ cũ.

## Bảo Bot và thời tiết không cần AI

Bảo Bot trả lời cục bộ các câu cơ bản về Bảo, việc học, kỹ năng, dự án, liên hệ, giờ và lịch, kể cả khi không có endpoint AI. Câu “Bảo là ai?” dùng đúng dữ liệu trong portfolio. Không bịa trình độ/thành tích. Hội thoại chỉ lưu lâu dài khi khách chủ động chọn.

Tab **Thời tiết** và câu hỏi như “Chiều nay ở Thủ Đức có mưa không?” gọi Open-Meteo trực tiếp từ trình duyệt, không cần backend hay API key AI. Các khu vực phổ biến ở Việt Nam có tọa độ trung tâm kèm chú thích độ đại diện; địa danh khác dùng geocoding của Open-Meteo. Khách có thể nhập tên nơi hoặc chủ động bấm dùng vị trí. Không xin vị trí khi tải trang.

Hiển thị điều kiện hiện tại, nhiệt độ, lượng mưa, thời điểm cập nhật, forecast theo giờ, xác suất và nguồn. Xác suất mưa không khẳng định hiện đang mưa; dữ liệu mô hình không phải cảm biến tại chỗ. Có timeout, cache tối đa 5 phút, từ chối current data quá 2 giờ và báo lỗi rõ nếu API/mạng lỗi. Không để kết quả cũ trong panel sau yêu cầu thất bại. Các đích mạng công khai cần truy cập: `api.open-meteo.com`, `geocoding-api.open-meteo.com`.

Giờ dùng đồng hồ thiết bị + IANA timezone (mặc định Asia/Ho_Chi_Minh). Lịch cục bộ vẫn hỗ trợ thêm/sửa/tìm/xóa, xem trước trước khi lưu đề xuất và xuất `.ics`. Chỉ báo thành công sau khi bộ nhớ ghi được. Chưa đồng bộ Google/Microsoft và không có nhắc nền khi đóng trang.

AI hỏi đáp tổng quát/tìm kiếm web/soạn lịch tự nhiên vẫn cần backend riêng. Không giấu trạng thái hoặc giả câu trả lời AI. Cấu hình endpoint công khai trong `config.js`; khóa chỉ ở backend. Xem [server/README.md](server/README.md). Backend live chưa được triển khai bằng khóa trong phiên này.

## Tệp chính

- `index.html`, `styles.css`, `living.css`, `refine.css`: bố cục, giao diện gọn, font và hiệu ứng dựng.
- `app.js`, `interactions.js`: dựng theo viewport, con trỏ và đánh dấu mục điều hướng; không có startup dựng toàn trang hoặc nền hạt.
- `weather.js`: Open-Meteo trực tiếp, địa danh/vị trí, nguồn, cache và lỗi.
- `chat.js`, `calendar.js`, `tools.js`, `config.js`: chat, lịch, giờ/múi giờ, ICS và backend tùy chọn.
- `server/`: backend AI/công cụ tùy chọn được giữ nguyên.

## Kiểm tra

Server đang chạy; cần Playwright + Chromium cho browser tests. Có thể đặt `BASE_URL`, `CHROMIUM_PATH`.

```sh
node tests/startup.cjs
node tests/smoke.cjs
node tests/cursors.cjs
node tests/interactions.cjs
node tests/weather.cjs
node tests/chat.cjs
node tests/calendar.cjs
node tests/tools.test.cjs
node server/tests/worker.test.mjs
```

`startup.cjs` nay kiểm tra chỉ dựng phần đang nhìn thấy, phần ngoài màn hình không tự hoàn thiện, font thực tế trong Chrome, không lặp khi cuộn ngược và không đổi chiều cao bố cục. Các bài khác kiểm tra sáu chiều rộng, deep link, nhập chữ, tắt/giảm hiệu ứng, JavaScript tắt, chat/AI lỗi/thử lại, lịch và tải ICS.

Thời tiết được kiểm tra bằng HTTP giả lập trong browser: endpoint AI để trống, current/forecast/source, câu hỏi mưa, geocoding, chỉ dùng GPS khi bấm, API lỗi và dữ liệu cũ. Backend OpenAI cũng dùng giả lập. **Không coi các kiểm tra này là xác minh API live**: lần kiểm tra mạng trực tiếp tới Open-Meteo trong môi trường cloud bị proxy trả 403; cần môi trường có quyền truy cập hai domain trên để kiểm tra live. Việc này không thay đổi URL API trong website phục vụ người dùng.
