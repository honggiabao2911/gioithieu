# Be Vietnam Pro

Nguồn chính thức: Google Fonts, SIL Open Font License 1.1, xem `OFL.txt`.

- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-SemiBold.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf

Các file gốc được tải với kiểm tra TLS, chuyển sang WOFF bằng FontTools (không subset, không bỏ ký tự). Đã đối chiếu cmap trước/sau chuyển đổi: đầy đủ ký tự tiếng Việt U+1EA0–U+1EF9 và ă â đ ê ô ơ ư cùng chữ hoa. Ba độ đậm gốc là 400, 600, 700. CSS ánh xạ các độ đậm trung gian về cùng các face này, không tổng hợp hoặc trộn font hệ thống cho chữ có dấu.

Chrome được kiểm tra bằng `CSS.getPlatformFontsForNode` trên tên Hồng Gia Bảo và đoạn văn có chữ đậm trong `tests/startup.cjs`.
