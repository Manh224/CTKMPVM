<?php
/**
 * API JSON:
 *   GET  api.php?action=list    => dữ liệu khuyến mãi hiện hành
 *   POST api.php?action=upload  => tải file Excel, thay thế dữ liệu cũ
 */
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function uploadErrorMessage(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'File vượt quá dung lượng cho phép của máy chủ.';
        case UPLOAD_ERR_PARTIAL:
            return 'File chỉ được tải lên một phần, vui lòng thử lại.';
        case UPLOAD_ERR_NO_FILE:
            return 'Vui lòng chọn file Excel.';
        default:
            return 'Lỗi tải file (mã ' . $code . ').';
    }
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

try {
    if ($action === 'list') {
        respond(['ok' => true, 'data' => Storage::load()]);
    }

    if ($action === 'upload') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Phương thức không hợp lệ.'], 405);
        }
        if (UPLOAD_PASSWORD !== '' && !hash_equals(UPLOAD_PASSWORD, (string) ($_POST['password'] ?? ''))) {
            respond(['ok' => false, 'error' => 'Mật khẩu cập nhật không đúng.'], 403);
        }
        if (empty($_FILES['file'])) {
            respond(['ok' => false, 'error' => 'Không nhận được file. Có thể file vượt quá giới hạn post_max_size của máy chủ.'], 400);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(['ok' => false, 'error' => uploadErrorMessage((int) $file['error'])], 400);
        }
        $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xlsx', 'xlsm'], true)) {
            respond(['ok' => false, 'error' => 'Chỉ hỗ trợ file .xlsx / .xlsm. Với file .xls cũ, hãy mở bằng Excel và "Lưu thành" .xlsx.'], 400);
        }
        if ($file['size'] > MAX_UPLOAD_MB * 1024 * 1024) {
            respond(['ok' => false, 'error' => 'File lớn hơn ' . MAX_UPLOAD_MB . 'MB.'], 400);
        }

        $result = PromotionImporter::import($file['tmp_name']);
        $data = [
            'updated_at'  => date('c'),
            'source_file' => (string) $file['name'],
            'sheet'       => $result['sheet'],
            'count'       => count($result['items']),
            'items'       => $result['items'],
        ];
        Storage::save($data); // Xoá dữ liệu cũ, thay bằng dữ liệu mới

        respond(['ok' => true, 'data' => $data]);
    }

    respond(['ok' => false, 'error' => 'Hành động không hợp lệ.'], 400);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
