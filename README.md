# Hồng Gia Bảo — Portfolio

Website tĩnh, tiếng Việt, tối ưu PC và mobile. Không cần build, API, secret hoặc thư viện chạy từ CDN.

## Chạy dự án

```sh
cd /workspace/gioithieu
python3 -m http.server 8000 --bind 127.0.0.1
```

Có thể triển khai trực tiếp thư mục này lên GitHub Pages. Giữ `index.html`, `styles.css`, `effects.css`, `app.js`, `interactions.js` và `avatar.jpg` cùng cấp.

## Chỉnh sửa

- `index.html`: nội dung, thông tin cá nhân, liên kết và hình minh họa SVG của bốn dự án.
- `styles.css`: màu sắc, typography và bố cục responsive.
- `effects.css`, `interactions.js`: aurora, lưới, hạt kết nối, ánh sáng theo chuột, nghiêng thẻ dự án, quét ảnh, nút từ tính, tia sáng khi bấm và đánh dấu mục đang xem.
- `app.js`: timeline dựng giao diện của từng khu vực. Mỗi thành phần dùng tiến độ riêng theo vị trí trong viewport; sáu con trỏ phân công viết chữ, kéo khung, đặt hình và căn chỉnh.

Mỗi thành phần giữ tiến độ cao nhất đã xem. Cuộn ngược không xóa nội dung; nút **Dựng lại** đưa về đầu trang và đặt lại timeline. Các thao tác `moveTo`, `dragFrame`, `placeElement`, `revealText`, `alignElement`, `finishSection` không dùng timer chạy đuổi. Chỉ vẽ lại khi cuộn hoặc kích thước thay đổi.

Các lớp con trỏ không nhận tương tác. Focus bàn phím hoặc điều hướng bằng anchor hoàn thiện ngay phần liên quan. Có thể tắt hiệu ứng; tùy chọn được lưu nếu trình duyệt cho phép. `prefers-reduced-motion` (chế độ giảm chuyển động) sẽ hiện toàn bộ nội dung. Khi tắt JavaScript, website vẫn đọc và sử dụng được.

## Kiểm tra

Kiểm tra cú pháp:

```sh
node --check app.js
```

Trong môi trường có Playwright và Chromium, khởi động server rồi chạy:

```sh
node tests/smoke.cjs
node tests/cursors.cjs
node tests/interactions.cjs
```

Có thể đặt `BASE_URL` và `CHROMIUM_PATH` để dùng server hoặc Chromium khác. Bộ kiểm tra gồm cuộn thuận/ngược, dừng cuộn, dựng lại, bật/tắt và lưu tùy chọn, deep link, focus bàn phím, chiều cao bố cục, sáu kích thước màn hình (320–1440 px), JavaScript tắt và giảm chuyển động. Không kiểm tra nội dung của các website bên ngoài.

Các hiệu ứng phụ không chạy khi tắt hiệu ứng hoặc bật giảm chuyển động. Canvas tự dừng khi tab bị ẩn; trên mobile dùng ít hạt hơn. Hiệu ứng nghiêng thẻ và nút từ tính chỉ dùng với chuột, không cản thao tác cảm ứng.
