# Săn Sêu PVM – Website khuyến mãi Pavel Mart

Website PHP gồm 2 module:

| Module | Chức năng |
|---|---|
| **Cập nhật CTKM** | Tải file Excel CTKM (.xlsx), chỉ lấy các dòng có cột *Note* (cột 30 – AD) = `Onpost`, **thay thế toàn bộ** dữ liệu cũ. |
| **Săn Sêu PVM** | Bảng khuyến mãi (13 cột), lọc nâng cao (tỉ lệ giảm, giá trị giảm, khoảng giá KM, tìm kiếm, loại KM), sắp xếp theo cột, và **giỏ hàng săn sale ảo** có xuất Excel. |

## Yêu cầu máy chủ

- PHP **7.4+** (khuyên dùng 8.x) với extension `zip`, `mbstring`, `simplexml` (thường đã bật sẵn).
- Thư mục `data/` phải **có quyền ghi**.
- Không cần Composer hay database.

## Cài đặt

**Chạy trên máy (XAMPP/Laragon):** chép cả thư mục vào `htdocs` rồi mở `http://localhost/<ten-thu-muc>/`.

**Chạy nhanh bằng PHP CLI:**
```bash
php -S localhost:8080
```

**Hosting:** upload toàn bộ file lên `public_html`. File `.htaccess` trong `data/` và `lib/` chặn truy cập trực tiếp (Apache).

## Cấu hình – `config.php`

| Hằng số | Ý nghĩa |
|---|---|
| `UPLOAD_PASSWORD` | Đặt mật khẩu để chỉ người có quyền mới cập nhật CTKM (để trống = không cần). |
| `MAX_UPLOAD_MB` | Dung lượng file tối đa (cần ≤ `upload_max_filesize` / `post_max_size` trong php.ini). |

Vị trí các cột Excel được khai báo trong `lib/PromotionImporter.php` (`COLUMN_MAP`, `NOTE_COLUMN`) nếu mẫu file thay đổi.

## Cấu trúc

```
index.php                 Giao diện (2 module + popup giỏ hàng)
api.php                   API: list / upload
config.php                Cấu hình
lib/XlsxReader.php        Đọc .xlsx không cần thư viện ngoài
lib/PromotionImporter.php Lọc dòng Onpost, chuẩn hoá giá / % / ngày
lib/Storage.php           Lưu JSON (giữ 1 bản sao lưu promotions.backup.json)
assets/css/style.css      Giao diện
assets/js/app.js          Lọc, giỏ hàng, xuất Excel (SheetJS)
data/                     Dữ liệu khuyến mãi
```

## Ghi chú

- File tải lên: hệ thống tự chọn sheet có nhiều dòng `Onpost` nhất (bỏ qua sheet ẩn/khác).
- Tỉ lệ & giá trị giảm được hiển thị dạng số dương (VD `-0,3147` → `-31,5%`).
- Giỏ hàng lưu trong trình duyệt (localStorage) của từng người dùng; thành tiền tính theo **Giá bán KM (+VAT)**.
