<?php
/**
 * Trình đọc file .xlsx tối giản, không cần thư viện ngoài (chỉ cần extension zip của PHP).
 * Trả về các dòng dạng [chỉ số dòng => [chỉ số cột (bắt đầu từ 1) => giá trị]].
 */
declare(strict_types=1);

class XlsxReader
{
    private const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    /** @var ZipArchive */
    private $zip;
    /** @var bool */
    private $opened = false;
    /** @var string[] */
    private $sharedStrings = [];

    public function __construct(string $path)
    {
        if (!class_exists('ZipArchive')) {
            throw new RuntimeException('Máy chủ PHP chưa bật extension "zip". Hãy bật extension=zip trong php.ini.');
        }
        $this->zip = new ZipArchive();
        if ($this->zip->open($path) !== true) {
            throw new RuntimeException('Không thể đọc file. Vui lòng chọn đúng file Excel định dạng .xlsx.');
        }
        $this->opened = true;
        $this->loadSharedStrings();
    }

    public function __destruct()
    {
        if ($this->opened) {
            $this->zip->close();
        }
    }

    /**
     * Danh sách sheet theo thứ tự trong workbook.
     * @return array<int, array{name: string, path: string, state: string}>
     */
    public function getSheets(): array
    {
        $workbook = $this->readXml('xl/workbook.xml');
        if ($workbook === null) {
            throw new RuntimeException('File Excel không hợp lệ (thiếu workbook.xml).');
        }

        $targets = [];
        $rels = $this->readXml('xl/_rels/workbook.xml.rels');
        if ($rels !== null) {
            foreach ($rels->Relationship as $rel) {
                $target = (string) $rel['Target'];
                $target = substr($target, 0, 1) === '/' ? ltrim($target, '/') : 'xl/' . $target;
                $targets[(string) $rel['Id']] = $target;
            }
        }

        $sheets = [];
        if (isset($workbook->sheets)) {
            foreach ($workbook->sheets->sheet as $sheet) {
                $rid = (string) $sheet->attributes(self::NS_REL)['id'];
                if (isset($targets[$rid])) {
                    $sheets[] = [
                        'name'  => (string) $sheet['name'],
                        'path'  => $targets[$rid],
                        'state' => (string) $sheet['state'],
                    ];
                }
            }
        }
        return $sheets;
    }

    /**
     * @return array<int, array<int, string>>
     */
    public function getRows(string $sheetPath): array
    {
        $xml = $this->readXml($sheetPath);
        if ($xml === null || !isset($xml->sheetData)) {
            return [];
        }

        $rows = [];
        $lastRow = 0;
        foreach ($xml->sheetData->row as $row) {
            $rowNum = (int) $row['r'];
            if ($rowNum <= 0) {
                $rowNum = $lastRow + 1;
            }
            $lastRow = $rowNum;

            $cells = [];
            $colIdx = 0;
            foreach ($row->c as $cell) {
                $ref = (string) $cell['r'];
                if ($ref !== '' && preg_match('/^([A-Z]+)/', $ref, $m)) {
                    $colIdx = self::columnIndex($m[1]);
                } else {
                    $colIdx++;
                }
                $value = $this->cellValue($cell);
                if ($value !== null && $value !== '') {
                    $cells[$colIdx] = $value;
                }
            }
            $rows[$rowNum] = $cells;
        }
        return $rows;
    }

    public static function columnIndex(string $letters): int
    {
        $n = 0;
        $len = strlen($letters);
        for ($i = 0; $i < $len; $i++) {
            $n = $n * 26 + (ord($letters[$i]) - 64);
        }
        return $n;
    }

    private function cellValue(SimpleXMLElement $cell): ?string
    {
        $type = (string) $cell['t'];
        switch ($type) {
            case 's':
                $idx = (int) $cell->v;
                return $this->sharedStrings[$idx] ?? '';
            case 'inlineStr':
                return isset($cell->is) ? $this->richText($cell->is) : '';
            case 'b':
                return ((string) $cell->v) === '1' ? 'TRUE' : 'FALSE';
            case 'e':
                return null; // Lỗi công thức (#N/A, #REF!...) => coi như rỗng
            default:
                return isset($cell->v) ? (string) $cell->v : null;
        }
    }

    private function richText(SimpleXMLElement $node): string
    {
        if (isset($node->t)) {
            return (string) $node->t;
        }
        $text = '';
        foreach ($node->r as $run) {
            $text .= (string) $run->t;
        }
        return $text;
    }

    private function loadSharedStrings(): void
    {
        $xml = $this->readXml('xl/sharedStrings.xml');
        if ($xml === null) {
            return;
        }
        foreach ($xml->si as $si) {
            $this->sharedStrings[] = $this->richText($si);
        }
    }

    private function readXml(string $name): ?SimpleXMLElement
    {
        $content = $this->zip->getFromName($name);
        if ($content === false) {
            return null;
        }
        $xml = simplexml_load_string($content, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_COMPACT | LIBXML_PARSEHUGE);
        return $xml === false ? null : $xml;
    }
}
