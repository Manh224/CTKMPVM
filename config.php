<?php
/**
 * Cấu hình chung cho website Săn Sêu PVM.
 */
declare(strict_types=1);

date_default_timezone_set('Asia/Ho_Chi_Minh');

// File lưu dữ liệu khuyến mãi hiện hành (bị thay thế hoàn toàn mỗi lần cập nhật).
define('DATA_FILE', __DIR__ . '/data/promotions.json');

// Mật khẩu cho Module "Cập nhật CTKM". Để trống '' = không yêu cầu mật khẩu.
define('UPLOAD_PASSWORD', '');

// Dung lượng file tối đa cho phép tải lên (MB).
define('MAX_UPLOAD_MB', 20);

require_once __DIR__ . '/lib/XlsxReader.php';
require_once __DIR__ . '/lib/PromotionImporter.php';
require_once __DIR__ . '/lib/Storage.php';
