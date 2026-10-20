<?php
/**
 * Lưu / đọc dữ liệu khuyến mãi dạng JSON.
 * Mỗi lần lưu sẽ thay thế toàn bộ dữ liệu cũ (bản cũ được giữ lại 1 bản sao lưu).
 */
declare(strict_types=1);

class Storage
{
    public static function load(): ?array
    {
        if (!is_file(DATA_FILE)) {
            return null;
        }
        $data = json_decode((string) file_get_contents(DATA_FILE), true);
        return is_array($data) ? $data : null;
    }

    public static function save(array $data): void
    {
        $dir = dirname(DATA_FILE);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Không tạo được thư mục lưu dữ liệu: ' . $dir);
        }

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            throw new RuntimeException('Không mã hoá được dữ liệu: ' . json_last_error_msg());
        }

        if (is_file(DATA_FILE)) {
            @copy(DATA_FILE, $dir . '/promotions.backup.json');
        }

        $tmp = DATA_FILE . '.tmp';
        if (file_put_contents($tmp, $json, LOCK_EX) === false) {
            throw new RuntimeException('Không ghi được dữ liệu. Hãy cấp quyền ghi cho thư mục "data".');
        }
        if (!@rename($tmp, DATA_FILE)) {
            // Windows không cho rename đè file đang tồn tại
            @unlink(DATA_FILE);
            if (!rename($tmp, DATA_FILE)) {
                throw new RuntimeException('Không thay thế được file dữ liệu cũ.');
            }
        }
    }
}
