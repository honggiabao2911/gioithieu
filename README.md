# Hồng Gia Bảo — Portfolio

Website tĩnh tiếng Việt, chạy được trên GitHub Pages, giữ nguyên ảnh cá nhân, thông tin, liên hệ và bốn dự án.

```sh
cd /workspace/gioithieu
python3 -m http.server 8000 --bind 127.0.0.1
```

## Giao diện và font

Dùng Be Vietnam Pro được lưu tại `assets/fonts/`: Regular, SemiBold, Bold, đầy đủ dấu tiếng Việt, giấy phép OFL đi kèm. Không tải font từ CDN khi khách truy cập. Font được kiểm tra bằng bảng ký tự và bằng Chrome DevTools Protocol: tiêu đề/đoạn có chữ đậm thực sự dùng font đi kèm, không trộn glyph serif từ font hệ thống.

Giao diện giảm chuyển động: bỏ nền hạt, halo, glitch, vệt đuôi và nhãn công việc bay liên tục. Chữ lớn hơn, khoảng cách thoáng, màu nhấn tiết chế. Ảnh và các minh họa dự án giữ nguyên.

## Mở đầu màn đen, tự dựng và tự cuộn

Toàn bộ tài liệu dùng nền đen thật (#000), kể cả các phần chưa tới lượt ở phía dưới. Khi mở từ đầu, toàn trang không có chữ, ảnh, đường phân cách hay bảng điều khiển. Khoảng một giây đầu giữ trống; sau đó con trỏ vẽ khung trên nền đen, từng phần nội dung mới được dựng, không bỏ một lớp phủ để lộ giao diện có sẵn. Lớp đen được áp dụng ngay trong head để tránh chớp nội dung trước khi JavaScript dựng trang. Có timeout 3,5 giây tự gỡ nếu script chính không tải được. Sau đó chỉ những thành phần trong vùng nhìn thấy mới nhận con trỏ và bắt đầu dựng trong bố cục đã dành chỗ. Mỗi thao tác chính mặc định kéo dài khoảng 6,4 giây: tiếp cận → vẽ khung → đặt ảnh/viết từng dòng → căn chỉnh/thu dọn; các nhóm làm song song. Header là khung trống trước, logo và từng liên kết được dựng riêng sau đó. Khung chân dung, ảnh và chú thích cũng là các công việc riêng; ảnh không xuất hiện trước khi khung xong. Footer được dựng khi tới cuối trang. Nhãn nhỏ kéo dài khoảng 2,1 giây. Bảng điều khiển chỉ hiện dần khi nội dung chính bắt đầu xuất hiện hoặc người dùng chủ động tương tác. Có chọn Chậm/Rất chậm/Nhanh và nút Hiện ngay cho vùng đang xem. Phần hoàn toàn ngoài màn hình giữ nguyên tiến độ, không tự dựng hết khi mở trang. Mỗi thành phần đã có kích thước bố cục đầy đủ; clip-path/transform tạo hiệu ứng kéo khung, đặt ảnh, viết chữ theo dòng và căn hàng. Dựng xong vùng đang xem thì nghỉ 1,3 giây, tự cuộn nhẹ khoảng 62% chiều cao màn hình trong 2,5 giây rồi dựng vùng kế tiếp. Trong lúc cuộn không dựng đuổi; kết thúc tại cuối trang. Không đổi nội dung hoặc bấm liên kết. Cuộn chuột, chạm, bấm chuột, nhấn phím, resize khi đang dựng/cuộn, focus nội dung hay mở link tới mục đều dừng trình diễn ngay; tự cuộn không tự bật lại. Có nút Dừng tự cuộn và Xem lại từ đầu · Tự cuộn. Link tới một mục, khôi phục vị trí cũ, chế độ đã tắt hiệu ứng, giảm chuyển động và JavaScript tắt không chạy màn đen/tự cuộn. Tab ẩn tạm dừng cả đồng hồ trình diễn.

Mặc định 4 con trỏ trên PC, 2 trên mobile. Chỉ một nhãn ngắn xuất hiện trên PC khi đang dựng; hoàn tất thì đường căn/con trỏ tự ẩn. Cuộn ngược không dựng lại. Cuộn nhanh hoàn thiện các phần đã đi qua, không tích hàng đợi chạy đuổi. Khi đang nhập chat hoặc chọn chữ, quá trình dựng tạm dừng, không tự hoàn thiện phần đang xem; đóng chat/thoát vùng nhập sẽ tiếp tục. Focus do bàn phím chỉ hoàn thiện đúng nhóm đang được focus và các khung cha để thao tác; không hoàn thiện các nhóm bên cạnh hoặc cả section. Focus chuột/native anchor không tự cho hiện nội dung. Bấm menu/mở link tới mục sẽ dựng tại điểm đến, không âm thầm cho hiện hết trước khi tới. Link #skills/#projects cũng được che trước khi app tải xong để không chớp header. Phần phía trên chưa từng xem vẫn chưa dựng; riêng header luôn giữ tiến độ thực khi đi khỏi màn hình, kể cả cuộn nhanh. Quay lên thì con trỏ mới tiếp tục dựng logo, từng mục menu và dòng trạng thái.

Bảng Hiệu ứng có bật/tắt, mật độ, tùy chọn đi theo chuột (mặc định tắt) và hai lựa chọn xem lại: vùng đang xem hoặc từ đầu có tự cuộn. Một vòng animation, delta time giới hạn, cache tọa độ cập nhật theo cuộn/resize/đổi bố cục; ngừng vòng lặp khi không còn việc. Tab ẩn tạm dừng; giảm chuyển động hoặc tắt JavaScript vẫn hiện nội dung đầy đủ. Các tùy chọn giao diện được lưu riêng ở `hb-display-v9`: giữ lựa chọn bật/tắt và mật độ từ bản cũ, đặt lại nhịp Chậm và tắt bay theo chuột cho lần chuyển sang kiểu dựng này. Các lựa chọn mới tiếp tục được lưu. Chuyển động dùng easing bậc năm cho khung, ảnh và cuộn; con trỏ có đoạn quay về đầu dòng thay vì nhảy. Đo dòng chữ bằng DOM Range sau khi font sẵn sàng, không ước lượng số dòng chỉ từ line-height. Không vẽ sẵn toàn bộ khung đích trước khi thao tác.

## Bảo Bot và thời tiết không cần AI

Bảo Bot trả lời cục bộ các câu cơ bản về Bảo, việc học, kỹ năng, dự án, liên hệ, giờ và lịch, kể cả khi không có endpoint AI. Khi chưa bật mô hình hoặc backend, `conversation.js` cung cấp phản hồi trò chuyện cơ bản cho câu như “tôi buồn”, chào hỏi/cảm ơn và một số lượt hỏi tiếp. Luôn ghi nhãn Phản hồi cơ bản, không nhận đó là mô hình AI. Câu “Bảo là ai?” dùng đúng dữ liệu trong portfolio. Không bịa trình độ/thành tích. Hội thoại chỉ lưu lâu dài khi khách chủ động chọn.

Tab **Thời tiết** và câu hỏi như “Chiều nay ở Thủ Đức có mưa không?” gọi Open-Meteo trực tiếp từ trình duyệt, không cần backend hay API key AI. Các khu vực phổ biến ở Việt Nam có tọa độ trung tâm kèm chú thích độ đại diện; địa danh khác dùng geocoding của Open-Meteo. Khách có thể nhập tên nơi hoặc chủ động bấm dùng vị trí. Không xin vị trí khi tải trang.

Hiển thị điều kiện hiện tại, nhiệt độ, lượng mưa, thời điểm cập nhật, forecast theo giờ, xác suất và nguồn. Xác suất mưa không khẳng định hiện đang mưa; dữ liệu mô hình không phải cảm biến tại chỗ. Có timeout, cache tối đa 5 phút, từ chối current data quá 2 giờ và báo lỗi rõ nếu API/mạng lỗi. Không để kết quả cũ trong panel sau yêu cầu thất bại. Các đích mạng công khai cần truy cập: `api.open-meteo.com`, `geocoding-api.open-meteo.com`.

Giờ dùng đồng hồ thiết bị + IANA timezone (mặc định Asia/Ho_Chi_Minh). Lịch cục bộ vẫn hỗ trợ thêm/sửa/tìm/xóa, xem trước trước khi lưu đề xuất và xuất `.ics`. Chỉ báo thành công sau khi bộ nhớ ghi được. Chưa đồng bộ Google/Microsoft và không có nhắc nền khi đóng trang.

## AI trên máy, không phí gọi API

Trong chat, mở **AI trên máy · Không phí API**, đọc yêu cầu rồi bấm **Bật và tải mô hình**. Không tự tải model hoặc xin GPU khi mở trang. Cần HTTPS/localhost, WebGPU và khoảng 2 GB bộ nhớ GPU; máy yếu/điện thoại có thể không hỗ trợ. Lần đầu tải nhiều tệp mô hình lớn, nên dùng Wi-Fi. Người dùng vẫn chịu tài nguyên máy và kết nối mạng của họ; không có phí gọi API AI từ chức năng này.

Dùng WebLLM 0.2.87 (Apache-2.0), Qwen2.5-1.5B-Instruct q4f16 khi có shader-f16, q4f32 nếu không. Engine chạy trong Web Worker để không chiếm vòng animation giao diện. Mô hình nhỏ không ngang các mô hình lớn, có thể trả lời sai và không tự tra web. Thời tiết/giờ/lịch tiếp tục dùng công cụ riêng. Có tiến độ tải, hủy tải, dừng trả lời và tắt model. Tắt giải phóng worker/GPU; tệp model có thể vẫn ở cache trình duyệt để tải lại nhanh hơn (có thể xóa qua dữ liệu trang trong cài đặt trình duyệt).

Thư viện 6,8 MB được lưu trong `assets/vendor`, nhưng chỉ import sau khi khách chủ động bật. Đã kiểm tra SHA-512 gói NPM chính thức; giấy phép và nguồn đi kèm. Các URL tải model/runtime sử dụng cấu hình mặc định của WebLLM (Hugging Face/GitHub); không tắt xác minh thư viện. Không gửi hội thoại đến máy chủ inference trong chế độ trên máy. Lịch sử vẫn chỉ lưu lâu dài khi khách chọn.

Browser kiểm thử cloud không có WebGPU adapter thực. Đã import thư viện thật và xác minh factory/model ID trong Chrome, không có tải model hoặc gọi inference tự động. Luồng bật/tải/hủy/dừng/chuyển chế độ đã kiểm bằng engine giả lập; **chưa tải trọng số hoặc xác minh câu trả lời Qwen thực** trong môi trường này. Chỉ hiển thị “AI trên máy sẵn sàng” sau khi factory WebLLM tải xong thật trên thiết bị người dùng. Máy không hỗ trợ nhận thông báo rõ và giữ chế độ cơ bản.

AI backend với tìm kiếm web/soạn lịch bằng công cụ vẫn là lựa chọn riêng, chưa được triển khai và có thể có phí API. Không cần backend này để dùng AI trên máy. Không giấu trạng thái hoặc giả câu trả lời AI. Cấu hình endpoint công khai trong `config.js`; khóa chỉ ở backend. Xem [server/README.md](server/README.md). Backend live chưa được triển khai bằng khóa trong phiên này.

## Tệp chính

- `index.html`, `styles.css`, `living.css`, `refine.css`: bố cục, giao diện gọn, font và hiệu ứng dựng.
- `local-ai.js`, `local-ai-worker.mjs`, `assets/vendor/`: model tùy chọn chạy trên thiết bị, không API key.
- `conversation.js`: phản hồi cơ bản, có giới hạn, không phải mô hình AI.
- `app.js`, `interactions.js`: dựng theo viewport, con trỏ và đánh dấu mục điều hướng; trình diễn tự cuộn qua từng vùng, không dựng phần ngoài màn hình hoặc thêm nền hạt.
- `weather.js`: Open-Meteo trực tiếp, địa danh/vị trí, nguồn, cache và lỗi.
- `chat.js`, `calendar.js`, `tools.js`, `config.js`: chat, lịch, giờ/múi giờ, ICS và backend tùy chọn.
- `server/`: backend AI/công cụ tùy chọn được giữ nguyên.

## Kiểm tra

Server đang chạy; cần Playwright + Chromium cho browser tests, thêm pngjs để đọc pixel ảnh chụp trong black-canvas.cjs. Có thể đặt `BASE_URL`, `CHROMIUM_PATH`.

```sh
node tests/header.cjs
node tests/black-canvas.cjs
node tests/tour.cjs
node tests/startup.cjs
node tests/smoke.cjs
node tests/cursors.cjs
node tests/interactions.cjs
node tests/weather.cjs
node tests/local-ai.cjs
node tests/conversation.test.cjs
node tests/chat.cjs
node tests/calendar.cjs
node tests/tools.test.cjs
node server/tests/worker.test.mjs
```

`header.cjs` kiểm tra đầu trang trống cả khi app tải chậm với #skills, quay lên dựng từng phần, focus chuột/native không hoàn thiện header, focus bàn phím chỉ đúng nhóm và cuộn ngược trên desktop/mobile giả lập. `black-canvas.cjs` kiểm tra pixel ảnh chụp toàn trang đen sau khi gỡ intro và vùng ngoài màn hình chưa dựng, trên desktop/mobile giả lập; kiểm tra khung và ảnh riêng, giữ bố cục và chuyển thiết lập cũ. `tour.cjs` kiểm tra màn đen đầu tiên, nhịp dựng trước tự cuộn, dừng ngay bằng wheel/touch/nút, xem lại, cả hành trình tới cuối trang (đồng hồ trình duyệt tăng tốc), bố cục ổn định, mobile, deep link, giảm chuyển động và fallback khi app.js lỗi. `startup.cjs` dừng tự cuộn bằng thao tác người dùng rồi kiểm tra ban đầu trống, nhịp dựng chậm, chat chỉ tạm dừng, Hiện ngay và chỉ dựng phần đang nhìn thấy, phần ngoài màn hình không tự hoàn thiện, font thực tế trong Chrome, không lặp khi cuộn ngược và không đổi chiều cao bố cục. Các bài khác kiểm tra sáu chiều rộng, deep link, nhập chữ, tắt/giảm hiệu ứng, JavaScript tắt, chat/AI lỗi/thử lại, lịch và tải ICS.

Thời tiết được kiểm tra bằng HTTP giả lập trong browser: endpoint AI để trống, current/forecast/source, câu hỏi mưa, geocoding, chỉ dùng GPS khi bấm, API lỗi và dữ liệu cũ. Backend OpenAI cũng dùng giả lập. **Không coi các kiểm tra này là xác minh API live**: lần kiểm tra mạng trực tiếp tới Open-Meteo trong môi trường cloud bị proxy trả 403; cần môi trường có quyền truy cập hai domain trên để kiểm tra live. Việc này không thay đổi URL API trong website phục vụ người dùng.
