<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$initialData = Storage::load();
$requirePassword = UPLOAD_PASSWORD !== '';
$columnMap = PromotionImporter::COLUMN_MAP;
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Săn Sêu PVM – Khuyến mãi Pavel Mart</title>
    <meta name="description" content="Săn Sêu PVM: tra cứu chương trình khuyến mãi Onpost của Pavel Mart, lọc theo % giảm giá, giá trị giảm, khoảng giá và tạo giỏ hàng săn sale ảo.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <meta name="theme-color" content="#067643">
    <link rel="icon" type="image/svg+xml" href="assets/img/icon-pavelmart.svg?v=1">
    <link rel="apple-touch-icon" href="assets/img/icon-pavelmart.svg?v=1">
    <link rel="stylesheet" href="assets/css/style.css?v=3">
</head>
<body>

<header class="topbar">
    <div class="container topbar__inner">
        <a class="brand" href="#" id="brand-link" aria-label="Pavel Mart – Trang chủ">
            <img class="brand__logo" src="assets/img/logo-green.svg" alt="Pavel Mart" width="168" height="38">
            <span class="brand__divider"></span>
            <span class="brand__tag">Promotion Hub<small>Khuyến mãi Onpost</small></span>
        </a>
        <nav class="tabs" role="tablist" aria-label="Chọn module">
            <button class="tab is-active" id="tab-hunt" role="tab" data-target="module-hunt" aria-selected="true">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 10.5 11C10.5 7 12 2 12 2Z"/></svg>
                Săn Sêu PVM
            </button>
            <button class="tab" id="tab-update" role="tab" data-target="module-update" aria-selected="false">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"/></svg>
                Cập nhật CTKM
            </button>
        </nav>
    </div>
</header>

<main class="container">
    <!-- ================= MODULE 2: SĂN SÊU PVM ================= -->
    <section id="module-hunt" class="module is-active" role="tabpanel" aria-labelledby="tab-hunt">
        <div class="hero">
            <div>
                <span class="eyebrow"><span class="pulse"></span>Khuyến mãi Onpost đang cập nhật</span>
                <h1>Săn Sêu <span class="hero__accent">PVM</span></h1>
                <p class="hero__sub">Tra cứu toàn bộ sản phẩm khuyến mãi, lọc theo mức giảm và tạo giỏ hàng săn sale ảo để ước tính chi phí.</p>
            </div>
            <button id="btn-open-cart" class="btn btn--light btn--lg">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21h.01M17 21h.01"/></svg>
                Tạo giỏ hàng săn sale ảo
            </button>
        </div>

        <div class="stats" id="hunt-stats"></div>

        <div class="panel" id="hunt-filters"></div>

        <div class="panel panel--flush">
            <div class="table-toolbar">
                <div><strong id="hunt-count">0</strong> sản phẩm</div>
                <div class="muted" id="hunt-updated"></div>
            </div>
            <div class="table-wrap table-wrap--tall">
                <table class="data-table" id="hunt-table">
                    <thead></thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="empty" id="hunt-empty" hidden>
                <div class="empty__icon">🛍️</div>
                <p id="hunt-empty-text">Chưa có dữ liệu khuyến mãi.</p>
                <button class="btn btn--ghost" id="btn-go-update">Đi tới Cập nhật CTKM</button>
            </div>
        </div>
    </section>

    <!-- ================= MODULE 1: CẬP NHẬT CTKM ================= -->
    <section id="module-update" class="module" role="tabpanel" aria-labelledby="tab-update">
        <div class="hero">
            <div>
                <span class="eyebrow">Quản trị dữ liệu</span>
                <h2 class="h1">Cập nhật <span class="hero__accent">CTKM</span></h2>
                <p class="hero__sub">Tải file Excel CTKM Onpost. Hệ thống chỉ lấy các dòng có cột <b>Note = "Onpost"</b> và <b>thay thế toàn bộ</b> dữ liệu cũ.</p>
            </div>
        </div>

        <div class="grid-2">
            <div class="panel">
                <form id="upload-form" novalidate>
                    <label class="dropzone" id="dropzone" for="file-input">
                        <input type="file" id="file-input" name="file" accept=".xlsx,.xlsm" hidden>
                        <div class="dropzone__icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13l2 2 4-4"/></svg>
                        </div>
                        <div class="dropzone__title" id="dropzone-title">Kéo thả file Excel vào đây</div>
                        <div class="dropzone__hint" id="dropzone-hint">hoặc <u>bấm để chọn file</u> · .xlsx tối đa <?= (int) MAX_UPLOAD_MB ?>MB</div>
                    </label>

                    <div class="field" id="password-field"<?= $requirePassword ? '' : ' hidden' ?>>
                        <label for="upload-password">Mật khẩu cập nhật</label>
                        <input type="password" id="upload-password" name="password" class="input" autocomplete="current-password">
                    </div>

                    <div class="progress" id="upload-progress" hidden><span></span></div>

                    <button type="submit" id="btn-upload" class="btn btn--primary btn--block" disabled>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5"/></svg>
                        Cập nhật dữ liệu mới
                    </button>
                </form>
                <div id="upload-result"></div>
            </div>

            <aside class="panel">
                <h3 class="panel__title">Dữ liệu hiện tại</h3>
                <div id="current-data" class="current-data"></div>

                <h3 class="panel__title">Cột được ghi nhận</h3>
                <ul class="col-map">
                    <?php
                    $labels = [
                        'ma_he_thong' => 'Mã hệ thống', 'barcode' => 'Barcode', 'ten' => 'Tên hệ thống', 'dvt' => 'ĐVT',
                        'gia_thuong' => 'Giá bán thường (-VAT)', 'gia_thuong_vat' => 'Giá bán thường (+VAT)',
                        'gia_km' => 'Giá bán KM (-VAT)', 'gia_km_vat' => 'Giá bán KM (+VAT)', 'qua_tang' => 'Quà tặng kèm',
                        'ti_le_giam' => 'Tỉ lệ giảm giá bán', 'gia_tri_giam' => 'Giá trị giảm giá bán',
                        'ngay_bat_dau' => 'Ngày bắt đầu KM', 'ngay_ket_thuc' => 'Ngày kết thúc KM',
                    ];
                    $letter = static function (int $n): string {
                        $s = '';
                        while ($n > 0) { $m = ($n - 1) % 26; $s = chr(65 + $m) . $s; $n = intdiv($n - 1, 26); }
                        return $s;
                    };
                    foreach ($columnMap as $key => $col): ?>
                        <li><span class="col-badge"><?= $col ?> · <?= $letter($col) ?></span><?= htmlspecialchars($labels[$key]) ?></li>
                    <?php endforeach; ?>
                    <li class="col-map__note"><span class="col-badge col-badge--hot"><?= PromotionImporter::NOTE_COLUMN ?> · <?= $letter(PromotionImporter::NOTE_COLUMN) ?></span>Note = "Onpost" (điều kiện lọc)</li>
                </ul>
            </aside>
        </div>

        <div class="panel panel--flush" id="preview-panel" hidden>
            <div class="table-toolbar">
                <div><strong>Xem trước dữ liệu vừa cập nhật</strong> <span class="muted" id="preview-note"></span></div>
                <button class="btn btn--ghost btn--sm" id="btn-view-hunt">Xem trong Săn Sêu PVM →</button>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="preview-table"><thead></thead><tbody></tbody></table>
            </div>
        </div>
    </section>
</main>

<footer class="footer">
    <div class="container footer__inner">
        <img class="footer__logo" src="assets/img/logo-white.svg" alt="Pavel Mart" width="132" height="30">
        <span>© <?= date('Y') ?> Pavel Mart · Săn Sêu PVM</span>
    </div>
</footer>

<!-- ================= POPUP GIỎ HÀNG ================= -->
<div class="modal" id="cart-modal" hidden>
    <div class="modal__backdrop" data-close></div>

    <div class="modal__dialog modal__dialog--sm" id="step-name" role="dialog" aria-modal="true" aria-labelledby="step-name-title">
        <div class="modal__head modal__head--brand">
            <h3 id="step-name-title">🛒 Tạo giỏ hàng săn sale ảo</h3>
            <button class="icon-btn" data-close aria-label="Đóng">×</button>
        </div>
        <div class="modal__body">
            <img class="name-logo" src="assets/img/logo-green.svg" alt="Pavel Mart" width="150" height="34">
            <label for="cart-name" class="label">Nhập tên của bạn</label>
            <input id="cart-name" class="input input--lg" maxlength="60" placeholder="VD: Nguyễn Văn A" autocomplete="name">
            <p class="field-error" id="cart-name-error" hidden>Vui lòng nhập tên để tạo giỏ hàng.</p>
        </div>
        <div class="modal__foot">
            <button class="btn btn--ghost" data-close>Hủy</button>
            <button class="btn btn--primary" id="btn-name-ok">OK</button>
        </div>
    </div>

    <div class="modal__dialog modal__dialog--xl" id="step-cart" role="dialog" aria-modal="true" aria-labelledby="cart-title" hidden>
        <div class="modal__head modal__head--brand">
            <div class="modal__brand">
                <img class="modal__logo" src="assets/img/logo-white.svg" alt="Pavel Mart" width="132" height="30">
                <div>
                    <h3 id="cart-title">Giỏ hàng của <span class="cart-owner" id="cart-owner"></span></h3>
                    <small class="muted">Chọn số lượng sản phẩm khuyến mãi bạn muốn mua</small>
                </div>
            </div>
            <div class="modal__head-actions">
                <button class="btn btn--ghost btn--sm" id="btn-rename">Đổi tên</button>
                <button class="icon-btn" data-close aria-label="Đóng">×</button>
            </div>
        </div>
        <div class="modal__body modal__body--cart">
            <div id="cart-filters"></div>
            <div class="cart-toolbar">
                <label class="switch">
                    <input type="checkbox" id="only-selected">
                    <span class="switch__track"></span>
                    Chỉ hiện sản phẩm đã chọn
                </label>
                <span class="muted" id="cart-visible-count"></span>
                <button class="btn btn--ghost btn--sm" id="btn-clear-cart">Xoá giỏ hàng</button>
            </div>
            <div class="table-wrap table-wrap--fill">
                <table class="data-table cart-table" id="cart-table"><thead></thead><tbody></tbody></table>
                <div class="empty empty--sm" id="cart-empty" hidden><p>Không có sản phẩm phù hợp bộ lọc.</p></div>
            </div>
        </div>
        <div class="modal__foot cart-foot">
            <div class="cart-total">
                <span class="cart-total__label">Tạm tính · <b id="cart-lines">0</b> mặt hàng · <b id="cart-qty">0</b> sản phẩm</span>
                <strong class="cart-total__value" id="cart-total">0 ₫</strong>
                <span class="cart-total__saving" id="cart-saving"></span>
            </div>
            <button class="btn btn--success btn--lg" id="btn-export">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16"/></svg>
                Xuất Excel
            </button>
        </div>
    </div>
</div>

<div class="toasts" id="toasts" aria-live="polite"></div>

<script>
    window.__PVM__ = {
        data: <?= json_encode($initialData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,
        requirePassword: <?= $requirePassword ? 'true' : 'false' ?>,
        maxUploadMb: <?= (int) MAX_UPLOAD_MB ?>
    };
</script>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" defer></script>
<script src="assets/js/app.js?v=4" defer></script>
</body>
</html>
