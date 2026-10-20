/* =========================================================
   Săn Sêu PVM – Front-end logic
   ========================================================= */
(() => {
    'use strict';

    const CONFIG = window.__PVM__ || {};
    const CART_STORAGE_KEY = 'pvm_virtual_cart_v1';

    /** Cột hiển thị ở Module 2 (đúng thứ tự yêu cầu). */
    const COLUMNS = [
        { key: 'ma_he_thong', label: 'Mã hệ thống', type: 'code' },
        { key: 'barcode', label: 'Barcode', type: 'code' },
        { key: 'ten', label: 'Tên hệ thống', type: 'name' },
        { key: 'dvt', label: 'ĐVT', type: 'text' },
        { key: 'gia_thuong', label: 'Giá bán thường (-VAT)', type: 'money' },
        { key: 'gia_thuong_vat', label: 'Giá bán thường (+VAT)', type: 'money-old' },
        { key: 'gia_km', label: 'Giá bán KM (-VAT)', type: 'money' },
        { key: 'gia_km_vat', label: 'Giá bán KM (+VAT)', type: 'money-km' },
        { key: 'qua_tang', label: 'Quà tặng kèm', type: 'gift' },
        { key: 'ti_le_giam', label: 'Tỉ lệ giảm giá bán', type: 'percent' },
        { key: 'gia_tri_giam', label: 'Giá trị giảm giá bán', type: 'discount' },
        { key: 'ngay_bat_dau', label: 'Ngày bắt đầu KM', type: 'date' },
        { key: 'ngay_ket_thuc', label: 'Ngày kết thúc KM', type: 'date' },
    ];

    const state = {
        data: null,
        items: [],
        huntSort: { key: null, dir: 1 },
        cart: { name: '', qty: {} },
        file: null,
    };

    /* ---------------- Helpers ---------------- */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
    const pf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isNum = (v) => typeof v === 'number' && isFinite(v);
    const money = (v) => (isNum(v) ? nf.format(Math.round(v)) : '');
    const vnd = (v) => `${nf.format(Math.round(v || 0))} ₫`;
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
    const fmtDate = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
        return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '');
    };
    const fmtDateTime = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const parseMoney = (v) => {
        const d = String(v ?? '').replace(/[^\d]/g, '');
        return d === '' ? null : Number(d);
    };
    const parsePercent = (v) => {
        const s = String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '');
        return s === '' || isNaN(parseFloat(s)) ? null : parseFloat(s);
    };
    const dash = '<span class="dash">—</span>';

    function toast(msg, type = 'ok', ms = 3500) {
        const el = document.createElement('div');
        el.className = `toast ${type === 'err' ? 'toast--err' : type === 'warn' ? 'toast--warn' : ''}`;
        el.textContent = msg;
        $('#toasts').appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
    }

    /* ---------------- Data ---------------- */
    function setData(data) {
        state.data = data && Array.isArray(data.items) ? data : null;
        state.items = state.data ? state.data.items.map((it) => ({
            ...it,
            _search: norm(`${it.ten} ${it.ma_he_thong} ${it.barcode} ${it.qua_tang}`),
        })) : [];
        // Bỏ các sản phẩm không còn tồn tại khỏi giỏ hàng đã lưu
        const ids = new Set(state.items.map((i) => i.id));
        Object.keys(state.cart.qty).forEach((id) => { if (!ids.has(id)) delete state.cart.qty[id]; });
    }

    /* ---------------- Filters (dùng chung) ---------------- */
    function filterPanelHTML(p, compact = false) {
        return `
        <div class="filters ${compact ? 'filters--compact' : ''}" data-filter="${p}">
            <div class="field field--search">
                <label for="${p}-q">Tìm kiếm</label>
                <div class="input-icon">
                    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <input id="${p}-q" class="input" type="search" placeholder="Tên, mã hệ thống, barcode, quà tặng...">
                </div>
            </div>
            <div class="field">
                <label for="${p}-pct-min">Tỉ lệ giảm giá bán (%)</label>
                <div class="range">
                    <input id="${p}-pct-min" class="input" inputmode="decimal" placeholder="Từ">
                    <span>–</span>
                    <input id="${p}-pct-max" class="input" inputmode="decimal" placeholder="Đến" aria-label="Tỉ lệ giảm đến">
                </div>
            </div>
            <div class="field">
                <label for="${p}-val-min">Giá trị giảm giá bán (₫)</label>
                <div class="range">
                    <input id="${p}-val-min" class="input" data-money inputmode="numeric" placeholder="Từ">
                    <span>–</span>
                    <input id="${p}-val-max" class="input" data-money inputmode="numeric" placeholder="Đến" aria-label="Giá trị giảm đến">
                </div>
            </div>
            <div class="field">
                <label for="${p}-price-min">Khoảng giá bán KM (+VAT) (₫)</label>
                <div class="range">
                    <input id="${p}-price-min" class="input" data-money inputmode="numeric" placeholder="Từ">
                    <span>–</span>
                    <input id="${p}-price-max" class="input" data-money inputmode="numeric" placeholder="Đến" aria-label="Giá bán KM đến">
                </div>
            </div>
            <div class="field">
                <label for="${p}-type">Loại KM</label>
                <select id="${p}-type" class="select">
                    <option value="">Tất cả</option>
                    <option value="discount">Có giảm giá</option>
                    <option value="gift">Có quà tặng</option>
                </select>
            </div>
            <div class="filters__chips">
                <span class="muted" style="font-size:12.5px">Lọc nhanh:</span>
                <button type="button" class="chip" id="${p}-chip-10" data-pct="10">Giảm ≥ 10%</button>
                <button type="button" class="chip" id="${p}-chip-20" data-pct="20">Giảm ≥ 20%</button>
                <button type="button" class="chip" id="${p}-chip-30" data-pct="30">Giảm ≥ 30%</button>
                <button type="button" class="chip" id="${p}-chip-u50" data-pmax="50000">Giá KM ≤ 50.000</button>
                <button type="button" class="chip" id="${p}-chip-u100" data-pmax="100000">Giá KM ≤ 100.000</button>
                <button type="button" class="chip chip--reset" id="${p}-reset">↺ Xoá bộ lọc</button>
            </div>
        </div>`;
    }

    function readFilter(p) {
        return {
            q: norm($(`#${p}-q`).value),
            pctMin: parsePercent($(`#${p}-pct-min`).value),
            pctMax: parsePercent($(`#${p}-pct-max`).value),
            valMin: parseMoney($(`#${p}-val-min`).value),
            valMax: parseMoney($(`#${p}-val-max`).value),
            priceMin: parseMoney($(`#${p}-price-min`).value),
            priceMax: parseMoney($(`#${p}-price-max`).value),
            type: $(`#${p}-type`).value,
        };
    }

    function inRange(v, min, max) {
        if (min === null && max === null) return true;
        if (!isNum(v)) return false;
        if (min !== null && v < min) return false;
        if (max !== null && v > max) return false;
        return true;
    }

    function applyFilter(items, f) {
        return items.filter((it) => {
            if (f.q && !f.q.split(/\s+/).every((w) => it._search.includes(w))) return false;
            if (!inRange(it.ti_le_giam ?? 0, f.pctMin, f.pctMax)) return false;
            if (!inRange(it.gia_tri_giam ?? 0, f.valMin, f.valMax)) return false;
            if (!inRange(it.gia_km_vat, f.priceMin, f.priceMax)) return false;
            if (f.type === 'discount' && !(it.ti_le_giam > 0)) return false;
            if (f.type === 'gift' && !it.qua_tang) return false;
            return true;
        });
    }

    function syncChips(p) {
        const pctMin = parsePercent($(`#${p}-pct-min`).value);
        const priceMax = parseMoney($(`#${p}-price-max`).value);
        $$(`[data-filter="${p}"] .chip[data-pct]`).forEach((c) => c.classList.toggle('is-active', pctMin === Number(c.dataset.pct)));
        $$(`[data-filter="${p}"] .chip[data-pmax]`).forEach((c) => c.classList.toggle('is-active', priceMax === Number(c.dataset.pmax)));
    }

    function mountFilter(container, p, onChange, compact) {
        container.innerHTML = filterPanelHTML(p, compact);
        let t;
        const fire = () => { clearTimeout(t); t = setTimeout(() => { syncChips(p); onChange(); }, 120); };
        $$('input, select', container).forEach((el) => {
            el.addEventListener('input', fire);
            el.addEventListener('change', fire);
        });
        $$('input[data-money]', container).forEach((el) => {
            el.addEventListener('blur', () => { const n = parseMoney(el.value); el.value = n === null ? '' : nf.format(n); });
        });
        $$('.chip[data-pct]', container).forEach((chip) => chip.addEventListener('click', () => {
            const input = $(`#${p}-pct-min`);
            input.value = chip.classList.contains('is-active') ? '' : chip.dataset.pct;
            fire();
        }));
        $$('.chip[data-pmax]', container).forEach((chip) => chip.addEventListener('click', () => {
            const input = $(`#${p}-price-max`);
            input.value = chip.classList.contains('is-active') ? '' : nf.format(Number(chip.dataset.pmax));
            fire();
        }));
        $(`#${p}-reset`).addEventListener('click', () => {
            $$('input', container).forEach((el) => { el.value = ''; });
            $(`#${p}-type`).value = '';
            fire();
        });
    }

    /* ---------------- Cell rendering ---------------- */
    function renderCell(col, it) {
        const v = it[col.key];
        switch (col.type) {
            case 'code': return `<td class="code nowrap">${v ? esc(v) : dash}</td>`;
            case 'name': return `<td class="name">${esc(v)}</td>`;
            case 'money': return `<td class="num">${isNum(v) ? money(v) : dash}</td>`;
            case 'money-old': return `<td class="num">${isNum(v) ? `<span class="${it.ti_le_giam > 0 ? 'price-old' : ''}">${money(v)}</span>` : dash}</td>`;
            case 'money-km': return `<td class="num price-km">${isNum(v) ? money(v) : dash}</td>`;
            case 'gift': return `<td>${v ? `<span class="gift">🎁 ${esc(v)}</span>` : dash}</td>`;
            case 'percent': return `<td class="center">${v > 0 ? `<span class="badge ${v >= 30 ? 'badge--hot' : ''}">-${pf.format(v)}%</span>` : dash}</td>`;
            case 'discount': return `<td class="num">${v > 0 ? `<span class="badge badge--soft">-${money(v)}</span>` : dash}</td>`;
            case 'date': return `<td class="nowrap">${v ? fmtDate(v) : dash}</td>`;
            default: return `<td class="nowrap">${v ? esc(v) : dash}</td>`;
        }
    }

    function sortItems(items, sort) {
        if (!sort.key) return items;
        const col = COLUMNS.find((c) => c.key === sort.key);
        const numeric = col && /money|percent|discount/.test(col.type);
        return [...items].sort((a, b) => {
            const x = a[sort.key], y = b[sort.key];
            if (numeric) return ((isNum(x) ? x : -Infinity) - (isNum(y) ? y : -Infinity)) * sort.dir;
            return String(x ?? '').localeCompare(String(y ?? ''), 'vi', { numeric: true }) * sort.dir;
        });
    }

    /* ---------------- Module 2: Săn Sêu PVM ---------------- */
    function renderStats() {
        const items = state.items;
        const maxPct = items.reduce((m, i) => Math.max(m, i.ti_le_giam || 0), 0);
        const gifts = items.filter((i) => i.qua_tang).length;
        const starts = items.map((i) => i.ngay_bat_dau).filter(Boolean).sort();
        const ends = items.map((i) => i.ngay_ket_thuc).filter(Boolean).sort();
        const period = starts.length ? `${fmtDate(starts[0])} – ${fmtDate(ends[ends.length - 1] || '')}` : '—';
        const avgPct = items.length ? items.reduce((s, i) => s + (i.ti_le_giam || 0), 0) / items.length : 0;

        $('#hunt-stats').innerHTML = `
            <div class="stat" style="--stat-accent:#067643"><div class="stat__label">Sản phẩm khuyến mãi</div><div class="stat__value stat__value--brand">${nf.format(items.length)}</div><div class="stat__sub">Note = Onpost</div></div>
            <div class="stat" style="--stat-accent:#3fa575"><div class="stat__label">Giảm sâu nhất</div><div class="stat__value stat__value--brand">${maxPct ? `-${pf.format(maxPct)}%` : '—'}</div><div class="stat__sub">Trung bình -${pf.format(avgPct)}%</div></div>
            <div class="stat" style="--stat-accent:#f2a516"><div class="stat__label">Có quà tặng kèm</div><div class="stat__value">${nf.format(gifts)}</div><div class="stat__sub">sản phẩm</div></div>
            <div class="stat" style="--stat-accent:#045530"><div class="stat__label">Thời gian khuyến mãi</div><div class="stat__value" style="font-size:18px;margin-top:10px">${period}</div></div>`;
    }

    function renderHuntHead() {
        $('#hunt-table thead').innerHTML = `<tr>${COLUMNS.map((c) => {
            const sorted = state.huntSort.key === c.key;
            const ind = sorted ? (state.huntSort.dir === 1 ? '▲' : '▼') : '⇅';
            const align = /money|discount/.test(c.type) ? ' class="sortable num' : ' class="sortable';
            return `<th${align}${sorted ? ' is-sorted' : ''}" data-key="${c.key}">${esc(c.label)}<span class="sort-ind">${ind}</span></th>`;
        }).join('')}</tr>`;
    }

    function renderHunt() {
        const hasData = state.items.length > 0;
        $('#hunt-empty').hidden = hasData;
        $('#hunt-table').hidden = !hasData;
        $('#btn-open-cart').disabled = !hasData;
        $('#hunt-updated').textContent = state.data ? `Cập nhật lúc ${fmtDateTime(state.data.updated_at)}` : '';

        if (!hasData) {
            $('#hunt-count').textContent = '0';
            $('#hunt-empty-text').textContent = 'Chưa có dữ liệu khuyến mãi. Vui lòng tải file Excel ở mục "Cập nhật CTKM".';
            $('#btn-go-update').hidden = false;
            return;
        }

        const filtered = sortItems(applyFilter(state.items, readFilter('hunt')), state.huntSort);
        $('#hunt-count').textContent = nf.format(filtered.length);
        renderHuntHead();
        $('#hunt-table tbody').innerHTML = filtered.map((it) => `<tr>${COLUMNS.map((c) => renderCell(c, it)).join('')}</tr>`).join('');

        if (!filtered.length) {
            $('#hunt-empty').hidden = false;
            $('#hunt-empty-text').textContent = 'Không có sản phẩm nào phù hợp bộ lọc.';
            $('#btn-go-update').hidden = true;
        }
    }

    /* ---------------- Module 1: Cập nhật CTKM ---------------- */
    function renderCurrentData() {
        const d = state.data;
        $('#current-data').innerHTML = d ? `
            <div class="kv"><span>Số sản phẩm</span><span>${nf.format(d.count)}</span></div>
            <div class="kv"><span>File nguồn</span><span>${esc(d.source_file)}</span></div>
            <div class="kv"><span>Sheet</span><span>${esc(d.sheet)}</span></div>
            <div class="kv"><span>Cập nhật lúc</span><span>${fmtDateTime(d.updated_at)}</span></div>`
            : '<div class="kv"><span>Trạng thái</span><span>Chưa có dữ liệu</span></div>';
    }

    function renderPreview() {
        const items = state.items.slice(0, 15);
        $('#preview-panel').hidden = !items.length;
        $('#preview-note').textContent = state.items.length > 15 ? `(15 / ${nf.format(state.items.length)} dòng đầu)` : `(${state.items.length} dòng)`;
        $('#preview-table thead').innerHTML = `<tr>${COLUMNS.map((c) => `<th${/money|discount/.test(c.type) ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr>`;
        $('#preview-table tbody').innerHTML = items.map((it) => `<tr>${COLUMNS.map((c) => renderCell(c, it)).join('')}</tr>`).join('');
    }

    function setFile(file) {
        const dz = $('#dropzone');
        if (file && !/\.(xlsx|xlsm)$/i.test(file.name)) {
            toast('Vui lòng chọn file Excel .xlsx', 'err');
            file = null;
        }
        if (file && file.size > (CONFIG.maxUploadMb || 20) * 1024 * 1024) {
            toast(`File vượt quá ${CONFIG.maxUploadMb}MB`, 'err');
            file = null;
        }
        state.file = file || null;
        dz.classList.toggle('has-file', !!state.file);
        $('#dropzone-title').textContent = state.file ? state.file.name : 'Kéo thả file Excel vào đây';
        $('#dropzone-hint').innerHTML = state.file
            ? `${(state.file.size / 1024 / 1024).toFixed(2)} MB · <u>bấm để chọn file khác</u>`
            : `hoặc <u>bấm để chọn file</u> · .xlsx tối đa ${CONFIG.maxUploadMb}MB`;
        $('#btn-upload').disabled = !state.file;
    }

    function initUpload() {
        const dz = $('#dropzone');
        const input = $('#file-input');
        input.addEventListener('change', () => setFile(input.files[0]));
        ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-drag'); }));
        ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-drag'); }));
        dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]); });

        $('#upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!state.file) return;
            const pw = $('#upload-password');
            if (CONFIG.requirePassword && pw && !pw.value) { toast('Vui lòng nhập mật khẩu cập nhật', 'warn'); pw.focus(); return; }
            if (state.data && !confirm(`Dữ liệu cũ (${state.data.count} sản phẩm) sẽ bị xoá và thay bằng dữ liệu từ file mới. Tiếp tục?`)) return;

            const fd = new FormData();
            fd.append('file', state.file);
            if (pw) fd.append('password', pw.value);

            const btn = $('#btn-upload');
            const bar = $('#upload-progress');
            const result = $('#upload-result');
            btn.disabled = true;
            bar.hidden = false;
            bar.classList.remove('is-indeterminate');
            $('span', bar).style.width = '0';
            result.innerHTML = '';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api.php?action=upload');
            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) $('span', bar).style.width = `${(ev.loaded / ev.total) * 100}%`;
            };
            xhr.upload.onload = () => { $('span', bar).style.width = ''; bar.classList.add('is-indeterminate'); };
            xhr.onload = () => {
                bar.hidden = true;
                btn.disabled = false;
                let res;
                try { res = JSON.parse(xhr.responseText); } catch (err) {
                    res = { ok: false, error: `Máy chủ trả về dữ liệu không hợp lệ: ${xhr.responseText.replace(/<[^>]+>/g, ' ').slice(0, 200)}` };
                }
                if (res.ok) {
                    setData(res.data);
                    saveCart();
                    renderAll();
                    result.innerHTML = `<div class="result result--ok">✅ Đã cập nhật <b>${nf.format(res.data.count)}</b> sản phẩm khuyến mãi (Note = Onpost) từ sheet <b>${esc(res.data.sheet)}</b>. Dữ liệu cũ đã được thay thế.</div>`;
                    toast(`Cập nhật thành công ${res.data.count} sản phẩm`);
                    input.value = '';
                    setFile(null);
                } else {
                    result.innerHTML = `<div class="result result--err">⚠️ ${esc(res.error || 'Có lỗi xảy ra')}</div>`;
                    toast('Cập nhật thất bại', 'err');
                }
            };
            xhr.onerror = () => {
                bar.hidden = true;
                btn.disabled = false;
                result.innerHTML = '<div class="result result--err">⚠️ Không kết nối được máy chủ.</div>';
            };
            xhr.send(fd);
        });
    }

    /* ---------------- Giỏ hàng săn sale ảo ---------------- */
    function loadCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || 'null');
            if (saved && typeof saved === 'object') {
                state.cart.name = String(saved.name || '');
                state.cart.qty = saved.qty && typeof saved.qty === 'object' ? saved.qty : {};
            }
        } catch (e) { /* ignore */ }
    }
    function saveCart() {
        try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart)); } catch (e) { /* ignore */ }
    }

    const itemById = (id) => state.items.find((i) => i.id === id);
    const lineTotal = (it, q) => (isNum(it.gia_km_vat) ? it.gia_km_vat : 0) * q;

    function cartSummary() {
        let lines = 0, qty = 0, total = 0, original = 0;
        Object.entries(state.cart.qty).forEach(([id, q]) => {
            const it = itemById(id);
            if (!it || q <= 0) return;
            lines++;
            qty += q;
            total += lineTotal(it, q);
            original += (isNum(it.gia_thuong_vat) ? it.gia_thuong_vat : (it.gia_km_vat || 0)) * q;
        });
        return { lines, qty, total, saving: Math.max(0, original - total) };
    }

    function openModal() {
        $('#cart-modal').hidden = false;
        document.body.classList.add('no-scroll');
        showNameStep();
    }
    function closeModal() {
        $('#cart-modal').hidden = true;
        document.body.classList.remove('no-scroll');
    }
    function showNameStep() {
        $('#step-cart').hidden = true;
        $('#step-name').hidden = false;
        $('#cart-name-error').hidden = true;
        const input = $('#cart-name');
        input.value = state.cart.name;
        setTimeout(() => { input.focus(); input.select(); }, 50);
    }
    function confirmName() {
        const name = $('#cart-name').value.trim();
        if (!name) {
            $('#cart-name-error').hidden = false;
            $('#cart-name').focus();
            return;
        }
        state.cart.name = name;
        saveCart();
        $('#cart-owner').textContent = name;
        $('#step-name').hidden = true;
        $('#step-cart').hidden = false;
        renderCart();
        updateCartFooter(false);
    }

    function renderCart() {
        const onlySelected = $('#only-selected').checked;
        let items = applyFilter(state.items, readFilter('cart'));
        if (onlySelected) items = items.filter((it) => (state.cart.qty[it.id] || 0) > 0);

        $('#cart-table thead').innerHTML = `<tr>
            <th>Sản phẩm</th><th>ĐVT</th>
            <th class="num">Giá thường (+VAT)</th><th class="num">Giá KM (+VAT)</th>
            <th class="center">Giảm</th><th class="center">Số lượng</th><th class="num">Thành tiền</th></tr>`;

        $('#cart-table tbody').innerHTML = items.map((it) => {
            const q = state.cart.qty[it.id] || 0;
            return `<tr data-id="${esc(it.id)}" class="${q > 0 ? 'is-selected' : ''}">
                <td class="name">
                    ${esc(it.ten)}
                    <div class="product-meta">${it.ma_he_thong ? `<span class="code">#${esc(it.ma_he_thong)}</span>` : ''}${it.barcode ? `<span class="code">${esc(it.barcode)}</span>` : ''}${it.ngay_ket_thuc ? `<span>đến ${fmtDate(it.ngay_ket_thuc)}</span>` : ''}</div>
                    ${it.qua_tang ? `<span class="gift">🎁 ${esc(it.qua_tang)}</span>` : ''}
                </td>
                <td class="nowrap">${esc(it.dvt) || dash}</td>
                <td class="num">${isNum(it.gia_thuong_vat) ? `<span class="${it.ti_le_giam > 0 ? 'price-old' : ''}">${money(it.gia_thuong_vat)}</span>` : dash}</td>
                <td class="num price-km">${isNum(it.gia_km_vat) ? money(it.gia_km_vat) : dash}</td>
                <td class="center">${it.ti_le_giam > 0 ? `<span class="badge ${it.ti_le_giam >= 30 ? 'badge--hot' : ''}">-${pf.format(it.ti_le_giam)}%</span>` : dash}</td>
                <td class="center">
                    <div class="qty">
                        <button type="button" data-act="dec" aria-label="Giảm">−</button>
                        <input type="text" inputmode="numeric" value="${q}" aria-label="Số lượng ${esc(it.ten)}">
                        <button type="button" data-act="inc" aria-label="Tăng">+</button>
                    </div>
                </td>
                <td class="num line-total">${q > 0 ? money(lineTotal(it, q)) : dash}</td>
            </tr>`;
        }).join('');

        $('#cart-empty').hidden = items.length > 0;
        $('#cart-visible-count').textContent = `Hiển thị ${nf.format(items.length)} / ${nf.format(state.items.length)} sản phẩm`;
    }

    function setQty(id, q) {
        q = Math.max(0, Math.min(9999, Math.floor(Number(q) || 0)));
        if (q > 0) state.cart.qty[id] = q; else delete state.cart.qty[id];
        saveCart();

        const row = $(`#cart-table tr[data-id="${CSS.escape(id)}"]`);
        const it = itemById(id);
        if (row && it) {
            row.classList.toggle('is-selected', q > 0);
            const input = $('.qty input', row);
            if (document.activeElement !== input || input.value !== String(q)) input.value = q;
            $('.line-total', row).innerHTML = q > 0 ? money(lineTotal(it, q)) : dash;
        }
        updateCartFooter(true);
    }

    function updateCartFooter(animate) {
        const s = cartSummary();
        $('#cart-lines').textContent = nf.format(s.lines);
        $('#cart-qty').textContent = nf.format(s.qty);
        const totalEl = $('#cart-total');
        totalEl.textContent = vnd(s.total);
        $('#cart-saving').textContent = s.saving > 0 ? `Tiết kiệm ${vnd(s.saving)} so với giá thường` : '';
        $('#btn-export').disabled = s.lines === 0;
        if (animate) {
            totalEl.classList.remove('bump');
            void totalEl.offsetWidth;
            totalEl.classList.add('bump');
            setTimeout(() => totalEl.classList.remove('bump'), 250);
        }
    }

    function initCart() {
        $('#btn-open-cart').addEventListener('click', openModal);
        $('#btn-name-ok').addEventListener('click', confirmName);
        $('#cart-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmName(); });
        $('#btn-rename').addEventListener('click', showNameStep);
        $$('#cart-modal [data-close]').forEach((el) => el.addEventListener('click', closeModal));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#cart-modal').hidden) closeModal(); });
        $('#only-selected').addEventListener('change', renderCart);
        $('#btn-clear-cart').addEventListener('click', () => {
            if (!Object.keys(state.cart.qty).length) return;
            if (!confirm('Xoá toàn bộ sản phẩm trong giỏ hàng?')) return;
            state.cart.qty = {};
            saveCart();
            renderCart();
            updateCartFooter(true);
        });

        const tbody = $('#cart-table tbody');
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.qty button');
            if (!btn) return;
            const id = btn.closest('tr').dataset.id;
            const cur = state.cart.qty[id] || 0;
            setQty(id, btn.dataset.act === 'inc' ? cur + 1 : cur - 1);
        });
        tbody.addEventListener('input', (e) => {
            if (!e.target.matches('.qty input')) return;
            e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
            setQty(e.target.closest('tr').dataset.id, e.target.value);
        });
        tbody.addEventListener('focusin', (e) => { if (e.target.matches('.qty input')) e.target.select(); });

        mountFilter($('#cart-filters'), 'cart', renderCart, true);
        $('#btn-export').addEventListener('click', exportCart);
    }

    function exportCart() {
        if (typeof XLSX === 'undefined') { toast('Chưa tải được thư viện xuất Excel. Kiểm tra kết nối mạng.', 'err'); return; }
        const rows = Object.entries(state.cart.qty)
            .map(([id, q]) => ({ it: itemById(id), q }))
            .filter((r) => r.it && r.q > 0);
        if (!rows.length) { toast('Giỏ hàng đang trống', 'warn'); return; }

        const s = cartSummary();
        const now = new Date();
        const header = ['STT', 'Mã hệ thống', 'Barcode', 'Tên hệ thống', 'ĐVT', 'Giá bán thường (+VAT)', 'Giá bán KM (+VAT)', 'Tỉ lệ giảm (%)', 'Quà tặng kèm', 'Ngày bắt đầu KM', 'Ngày kết thúc KM', 'Số lượng', 'Thành tiền'];
        const aoa = [
            ['GIỎ HÀNG SĂN SALE ẢO - PAVEL MART'],
            [`Khách hàng: ${state.cart.name}`],
            [`Ngày tạo: ${now.toLocaleString('vi-VN')}`],
            [],
            header,
            ...rows.map(({ it, q }, i) => [
                i + 1, it.ma_he_thong, it.barcode, it.ten, it.dvt,
                isNum(it.gia_thuong_vat) ? Math.round(it.gia_thuong_vat) : '',
                isNum(it.gia_km_vat) ? Math.round(it.gia_km_vat) : '',
                it.ti_le_giam > 0 ? Number(it.ti_le_giam.toFixed(1)) : '',
                it.qua_tang || '', fmtDate(it.ngay_bat_dau), fmtDate(it.ngay_ket_thuc),
                q, Math.round(lineTotal(it, q)),
            ]),
            [],
            ['', '', '', 'TỔNG TẠM TÍNH', '', '', '', '', '', '', '', s.qty, Math.round(s.total)],
            ['', '', '', 'Tiết kiệm so với giá thường', '', '', '', '', '', '', '', '', Math.round(s.saving)],
        ];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [6, 14, 16, 50, 8, 18, 18, 12, 36, 15, 15, 10, 16].map((w) => ({ wch: w }));
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
        // Định dạng số tiền
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let r = 5; r <= range.e.r; r++) {
            [5, 6, 12].forEach((c) => {
                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                if (cell && cell.t === 'n') cell.z = '#,##0';
            });
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gio hang');
        const slug = norm(state.cart.name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'khach';
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        XLSX.writeFile(wb, `GioHangSanSale_${slug}_${stamp}.xlsx`);
        toast('Đã xuất file Excel giỏ hàng');
    }

    /* ---------------- Tabs & init ---------------- */
    function switchTab(targetId) {
        $$('.tab').forEach((t) => {
            const active = t.dataset.target === targetId;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-selected', String(active));
        });
        $$('.module').forEach((m) => m.classList.toggle('is-active', m.id === targetId));
        history.replaceState(null, '', targetId === 'module-update' ? '#cap-nhat' : '#san-sale');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderAll() {
        renderStats();
        renderHunt();
        renderCurrentData();
        renderPreview();
    }

    function init() {
        loadCart();
        setData(CONFIG.data);

        mountFilter($('#hunt-filters'), 'hunt', renderHunt, false);
        $('#hunt-table thead').addEventListener('click', (e) => {
            const th = e.target.closest('th[data-key]');
            if (!th) return;
            const key = th.dataset.key;
            state.huntSort = state.huntSort.key === key
                ? (state.huntSort.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 })
                : { key, dir: 1 };
            renderHunt();
        });

        $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.target)));
        $('#brand-link').addEventListener('click', (e) => { e.preventDefault(); switchTab('module-hunt'); });
        $('#btn-go-update').addEventListener('click', () => switchTab('module-update'));
        $('#btn-view-hunt').addEventListener('click', () => switchTab('module-hunt'));

        initUpload();
        initCart();
        renderAll();
        $('#preview-panel').hidden = true; // chỉ hiện sau khi vừa tải file

        if (location.hash === '#cap-nhat' || !state.items.length) switchTab('module-update');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
