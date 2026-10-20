<?php
/**
 * Chuyển file Excel CTKM thành danh sách khuyến mãi.
 * Chỉ lấy các dòng có cột "Note" (cột 30 / AD) = "Onpost".
 */
declare(strict_types=1);

class PromotionImporter
{
    /** Vị trí cột trong file Excel (bắt đầu từ 1). */
    public const COLUMN_MAP = [
        'ma_he_thong'    => 6,  // F  - Mã hệ thống
        'barcode'        => 7,  // G  - Barcode
        'ten'            => 8,  // H  - Tên hệ thống
        'dvt'            => 9,  // I  - ĐVT
        'gia_thuong'     => 19, // S  - Giá bán thường (-VAT)
        'gia_thuong_vat' => 20, // T  - Giá bán thường (+VAT)
        'gia_km'         => 21, // U  - Giá bán KM (-VAT)
        'gia_km_vat'     => 22, // V  - Giá bán KM (+VAT)
        'qua_tang'       => 23, // W  - Quà tặng kèm
        'ti_le_giam'     => 26, // Z  - Tỉ lệ giảm giá bán
        'gia_tri_giam'   => 27, // AA - Giá trị giảm giá bán
        'ngay_bat_dau'   => 28, // AB - Ngày bắt đầu KM
        'ngay_ket_thuc'  => 29, // AC - Ngày kết thúc KM
    ];
    public const NOTE_COLUMN = 30; // AD - Note
    public const NOTE_VALUE  = 'onpost';

    /**
     * Đọc mọi sheet, chọn sheet có nhiều dòng "Onpost" nhất.
     * @return array{sheet: string, items: array<int, array<string, mixed>>}
     */
    public static function import(string $path): array
    {
        $reader = new XlsxReader($path);
        $best = null;

        foreach ($reader->getSheets() as $sheet) {
            $rows = $reader->getRows($sheet['path']);
            $items = [];
            foreach ($rows as $rowNum => $cells) {
                if (!self::isOnpost($cells[self::NOTE_COLUMN] ?? null)) {
                    continue;
                }
                $item = self::buildItem($cells, (int) $rowNum);
                if ($item !== null) {
                    $items[] = $item;
                }
            }
            unset($rows);

            if ($best === null || count($items) > count($best['items'])) {
                $best = ['sheet' => $sheet['name'], 'items' => $items];
            }
        }

        if ($best === null || count($best['items']) === 0) {
            throw new RuntimeException('Không tìm thấy dòng nào có cột "Note" (cột 30 - cột AD) là "Onpost". Vui lòng kiểm tra lại file.');
        }

        $best['items'] = self::assignIds($best['items']);
        return $best;
    }

    private static function isOnpost(?string $value): bool
    {
        if ($value === null) {
            return false;
        }
        $normalized = preg_replace('/\s+/u', '', mb_strtolower(trim($value), 'UTF-8'));
        return $normalized === self::NOTE_VALUE;
    }

    /**
     * @param array<int, string> $cells
     * @return array<string, mixed>|null
     */
    private static function buildItem(array $cells, int $rowNum): ?array
    {
        $get = static function (string $key) use ($cells): ?string {
            return $cells[self::COLUMN_MAP[$key]] ?? null;
        };

        $item = [
            'row'            => $rowNum,
            'ma_he_thong'    => self::code($get('ma_he_thong')),
            'barcode'        => self::code($get('barcode')),
            'ten'            => self::text($get('ten')),
            'dvt'            => self::text($get('dvt')),
            'gia_thuong'     => self::money($get('gia_thuong')),
            'gia_thuong_vat' => self::money($get('gia_thuong_vat')),
            'gia_km'         => self::money($get('gia_km')),
            'gia_km_vat'     => self::money($get('gia_km_vat')),
            'qua_tang'       => self::text($get('qua_tang')),
            'ti_le_giam'     => self::percent($get('ti_le_giam')),
            'gia_tri_giam'   => self::money($get('gia_tri_giam'), true),
            'ngay_bat_dau'   => self::date($get('ngay_bat_dau')),
            'ngay_ket_thuc'  => self::date($get('ngay_ket_thuc')),
        ];

        if ($item['ma_he_thong'] === '' && $item['barcode'] === '' && $item['ten'] === '') {
            return null;
        }
        return $item;
    }

    /** Gán id duy nhất cho mỗi sản phẩm (dùng cho giỏ hàng). */
    private static function assignIds(array $items): array
    {
        $used = [];
        foreach ($items as &$item) {
            $base = $item['ma_he_thong'] !== '' ? $item['ma_he_thong']
                : ($item['barcode'] !== '' ? 'BC' . $item['barcode'] : 'R' . $item['row']);
            $id = $base;
            $n = 2;
            while (isset($used[$id])) {
                $id = $base . '-' . $n++;
            }
            $used[$id] = true;
            $item['id'] = $id;
        }
        unset($item);
        return $items;
    }

    private static function text(?string $value): string
    {
        if ($value === null) {
            return '';
        }
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    /** Mã/barcode: tránh dạng số khoa học 8.85E+12. */
    private static function code(?string $value): string
    {
        $value = self::text($value);
        if ($value !== '' && is_numeric($value) && stripos($value, 'e') !== false) {
            $value = sprintf('%.0f', (float) $value);
        }
        if (preg_match('/^\d+\.0+$/', $value)) {
            $value = (string) preg_replace('/\.0+$/', '', $value);
        }
        return $value;
    }

    private static function number(?string $value): ?float
    {
        $value = self::text($value);
        if ($value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        // Dạng văn bản như "102,000" hoặc "102.000 đ"
        $negative = strpos($value, '-') !== false;
        $digits = preg_replace('/[^\d]/', '', $value);
        if ($digits === '') {
            return null;
        }
        return $negative ? -(float) $digits : (float) $digits;
    }

    private static function money(?string $value, bool $absolute = false): ?float
    {
        $n = self::number($value);
        if ($n === null) {
            return null;
        }
        if ($absolute) {
            $n = abs($n);
        }
        return round($n, 2);
    }

    /** Tỉ lệ giảm giá => phần trăm dương (VD: -0.3147 => 31.47). */
    private static function percent(?string $value): ?float
    {
        $raw = self::text($value);
        if ($raw === '') {
            return null;
        }
        $hasPercentSign = strpos($raw, '%') !== false;
        if ($hasPercentSign) {
            $n = (float) str_replace(',', '.', preg_replace('/[^\d.,\-]/', '', $raw));
        } else {
            $n = self::number($raw);
            if ($n === null) {
                return null;
            }
            if (abs($n) <= 1) {
                $n *= 100;
            }
        }
        return round(abs($n), 2);
    }

    /** Ngày: số serial Excel hoặc chuỗi dd/mm/yyyy => yyyy-mm-dd. */
    private static function date(?string $value): string
    {
        $value = self::text($value);
        if ($value === '') {
            return '';
        }
        if (is_numeric($value)) {
            $serial = (float) $value;
            if ($serial > 0 && $serial < 2958466) {
                return gmdate('Y-m-d', (int) round(($serial - 25569) * 86400));
            }
            return $value;
        }
        if (preg_match('#^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})#', $value, $m)) {
            $year = strlen($m[3]) === 2 ? 2000 + (int) $m[3] : (int) $m[3];
            if (checkdate((int) $m[2], (int) $m[1], $year)) {
                return sprintf('%04d-%02d-%02d', $year, (int) $m[2], (int) $m[1]);
            }
        }
        if (preg_match('#^(\d{4})-(\d{2})-(\d{2})#', $value, $m)) {
            return $m[0];
        }
        return $value;
    }
}
