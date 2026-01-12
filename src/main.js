/**
 * 薪マップアプリケーション - メインファイル
 * リファクタリング版
 */

// モジュールのインポート
import { CONFIG } from './constants.js';
import {
    showToast,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    resetForm,
    toggleFilter,
    setFillHeight,
    clearSearchResults,
    selectSearchResult
} from './utils.js';
import {
    fetchLocations,
    fetchLocationById,
    addLocation,
    updateLocation,
    deleteLocation,
    incrementReportCount,
    searchAddress as apiSearchAddress,
    sendContact
} from './api.js';
import {
    initMap,
    setMapClickHandler,
    setMapMoveEndHandler,
    displayLocationsOnMap,
    startMapSelection,
    endMapSelection,
    handleLocateBtn,
    focusOnMap,
    getCurrentLocation,
    getLocationsInView,
    map,
    selectionState
} from './map.js';

// アプリケーションの状態管理
let allLocations = [];
let isListCollapsed = true;

// ======================
// 初期化
// ======================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * アプリケーション全体を初期化
 */
function initializeApp() {
    initMap();
    initServiceWorker();
    initEventListeners();
    loadLocations();
    setFillHeight();
    setupGlobalFunctions();
}

/**
 * Service Workerを登録
 */
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
}

/**
 * グローバル関数を設定（window経由でHTMLから呼び出せるようにする）
 */
function setupGlobalFunctions() {
    // ユーティリティ
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.showToast = showToast;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.selectSearchResult = selectSearchResult;

    // 地図関連
    window.focusOnMap = focusOnMap;

    // アプリケーション機能
    window.viewDetails = viewDetails;
    window.reportLocation = reportLocation;
    window.openEditModal = openEditModal;
    window.openHelpModal = openHelpModal;
    window.closeHelpModal = closeHelpModal;
}

// ======================
// イベントリスナー
// ======================

/**
 * イベントリスナーを初期化
 */
function initEventListeners() {
    // ボタン類のイベント
    const listeners = {
        'addLocationBtn': openAddModal,
        'closeModalBtn': closeAddModal,
        'cancelBtn': closeAddModal,
        'closeDetailBtn': closeDetailModal,
        'selectFromMapBtn': () => startMapSelection(),
        'addLocationForm': handleSubmit,
        'getCurrentLocation': () => getCurrentLocation(),
        'filterToggle': toggleFilter,
        'applyFilter': applyFilter,
        'clearFilter': clearFilter,
        'helpBtn': openHelpModal,
        'refreshBtn': () => loadLocations(),
        'execSearchBtn': searchAddress,
        'locateBtn': () => handleLocateBtn(),
        'openContactBtn': () => openModal('contactModal'),
        'closeContactModalBtn': () => closeModal('contactModal'),
        'cancelContactBtn': () => closeModal('contactModal'),
        'contactForm': handleContactSubmit
    };

    Object.entries(listeners).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) {
            const event = (id.includes('Form')) ? 'submit' : 'click';
            el.addEventListener(event, handler);
        }
    });

    // リスト開閉
    ['listToggle', 'list-header'].forEach(selector => {
        const el = selector.includes('-')
            ? document.querySelector(`.${selector}`)
            : document.getElementById(selector);
        el?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleList();
        });
    });

    // モーダル外クリックで閉じる
    window.addEventListener('click', (e) => {
        if (e.target.id === 'addModal') closeAddModal();
        if (e.target.id === 'detailModal') closeDetailModal();
        if (e.target.id === 'helpModal') closeHelpModal();
    });

    // 地図イベント
    setMapClickHandler(handleMapClick);
    setMapMoveEndHandler(updateListFromMap);

    // リサイズイベント
    window.addEventListener('resize', setFillHeight);
}

// ======================
// 地図操作
// ======================

/**
 * 地図クリック時の処理
 */
async function handleMapClick(e) {
    if (!selectionState.isSelecting) return;

    document.getElementById('latitude').value = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').value = e.latlng.lng.toFixed(6);

    // 選択モードを終了
    endMapSelection();

    openModal('addModal');
    showToast(`座標（${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}）を取得しました`, 'success');
}

// ======================
// データ読み込み
// ======================

/**
 * 場所データを読み込む
 */
async function loadLocations(filters = {}, preventReset = false) {
    showLoading();
    try {
        const result = await fetchLocations(filters);
        allLocations = result || [];

        let filteredLocations = allLocations;
        if (filters.woodType) {
            filteredLocations = filteredLocations.filter(loc =>
                loc.wood_type?.toLowerCase().includes(filters.woodType.toLowerCase())
            );
        }

        displayLocationsOnMap(filteredLocations, preventReset);
        updateListFromMap();

    } catch (error) {
        console.error('データ読み込みエラー:', error);
        showToast('データの読み込みに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// リスト表示
// ======================

/**
 * 地図の表示範囲に基づいてリストを更新
 */
function updateListFromMap() {
    const visibleLocations = getLocationsInView(allLocations);
    const listContent = document.getElementById('listContent');
    const listHeader = document.querySelector('.list-header h2');

    if (listHeader) {
        listHeader.innerHTML = `<i class="fas fa-list"></i> 表示中の場所 (${visibleLocations.length})`;
    }

    if (visibleLocations.length === 0) {
        listContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <p>この範囲に薪販売場所はありません</p>
            </div>
        `;
        return;
    }

    listContent.innerHTML = visibleLocations.map(loc => `
        <div class="location-card" onclick="viewDetails(${loc.id})">
            <div class="location-card-header">
                <div class="location-card-title">${loc.location_name || '名称未設定'}</div>
            </div>
            <div class="location-card-info">
                <p><i class="fas fa-tree"></i> ${loc.wood_type || '種類未設定'}</p>
                <p><i class="fas fa-yen-sign"></i> ${loc.price || '価格未設定'}円${loc.amount ? ' / ' + loc.amount : ''}</p>
            </div>
        </div>
    `).join('');
}

/**
 * リストパネルの開閉
 */
function toggleList() {
    const listPanel = document.getElementById('listPanel');
    isListCollapsed = !isListCollapsed;
    listPanel.classList.toggle('collapsed', isListCollapsed);
}

// ======================
// モーダル操作
// ======================

/**
 * 追加モーダルを開く
 */
function openAddModal() {
    resetForm('addLocationForm');
    clearSearchResults();
    openModal('addModal');
}

/**
 * 追加モーダルを閉じる
 */
function closeAddModal() {
    closeModal('addModal');
    resetForm('addLocationForm');
}

/**
 * 詳細モーダルを閉じる
 */
function closeDetailModal() {
    closeModal('detailModal');
}

/**
 * ヘルプモーダルを開く
 */
function openHelpModal() {
    openModal('helpModal');
}

/**
 * ヘルプモーダルを閉じる
 */
function closeHelpModal() {
    closeModal('helpModal');
}

// ======================
// 詳細表示
// ======================

/**
 * 場所の詳細を表示
 */
async function viewDetails(id) {
    showLoading();
    try {
        const location = await fetchLocationById(id);
        if (!location) throw new Error("Location not found");

        const lastUpdate = location.updated_at
            ? new Date(location.updated_at).toLocaleDateString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            }) : '不明';

        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <div class="detail-section">
                <h3><i class="fas fa-store"></i> 場所名</h3>
                <p>${location.location_name || '未設定'}</p>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-tree"></i> 薪の種類</h3>
                <p>${location.wood_type || '未設定'}</p>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-yen-sign"></i> 価格 / 数量</h3>
                <p>${location.price || '未設定'}円 ${location.amount ? ' / ' + location.amount : ''}</p>
            </div>

            <div class="detail-section">
                <h3><i class="fas fa-map"></i> 位置情報</h3>
                <p>緯度: ${location.latitude}, 経度: ${location.longitude}</p>
            </div>

            ${location.notes ? `
                <div class="detail-section">
                    <h3><i class="fas fa-sticky-note"></i> 備考</h3>
                    <p style="white-space: pre-wrap;">${location.notes}</p>
                </div>
            ` : ''}

            <div class="detail-section detail-actions">
                <button class="btn btn-primary" onclick="focusOnMap(${location.latitude}, ${location.longitude}); closeModal('detailModal'); document.getElementById('listPanel').classList.add('collapsed');">
                    <i class="fas fa-map-marked-alt"></i> 地図
                </button>

                <a href="https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}" target="_blank" class="btn btn-outline" style="margin-left: 10px;">
                    <i class="fab fa-google"></i> Googleマップで開く
                </a>

                <button class="btn btn-secondary" onclick="openEditModal('${location.id}')">
                    <i class="fas fa-edit"></i> 編集
                </button>
            </div>

            <div class="detail-section last-update-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
                <div>
                    <h3><i class="fas fa-history"></i> 最終更新日</h3>
                    <p>${lastUpdate}</p>
                </div>

                <button onclick="reportLocation('${location.id}')"
                        style="background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; cursor: pointer; margin-left: auto;">
                    <i class="fas fa-flag" style="font-size: 1.5rem !important; color: #d35400 !important;"></i> 通報
                </button>
            </div>
        `;

        openModal('detailModal');

    } catch (error) {
        console.error('詳細取得エラー:', error);
        showToast('詳細情報の取得に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// フォーム送信
// ======================

/**
 * フォームデータを取得
 */
function getFormData() {
    return {
        location_name: document.getElementById('locationName').value.trim(),
        wood_type: document.getElementById('woodType').value.trim(),
        price: document.getElementById('price').value.trim(),
        amount: document.getElementById('amount').value.trim(),
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        notes: document.getElementById('notes').value.trim(),
        sales_period: document.getElementById('salesPeriod').value.trim(),
        contact_info: document.getElementById('contactInfo').value.trim(),
        description: document.getElementById('description').value.trim()
    };
}

/**
 * フォームデータを検証
 */
function validateFormData(data) {
    if (!data.location_name) {
        return { valid: false, message: '場所名を入力してください' };
    }
    if (!data.wood_type) {
        return { valid: false, message: '薪の種類を入力してください' };
    }
    if (!data.price) {
        return { valid: false, message: '価格を入力してください' };
    }
    if (isNaN(data.latitude) || isNaN(data.longitude)) {
        return { valid: false, message: '有効な座標を入力してください' };
    }
    if (data.latitude < -90 || data.latitude > 90) {
        return { valid: false, message: '緯度は-90から90の範囲で入力してください' };
    }
    if (data.longitude < -180 || data.longitude > 180) {
        return { valid: false, message: '経度は-180から180の範囲で入力してください' };
    }
    return { valid: true };
}

/**
 * フォーム送信処理
 */
async function handleSubmit(e) {
    e.preventDefault();

    const formData = getFormData();
    const validation = validateFormData(formData);

    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }

    showLoading();
    try {
        await addLocation(formData);
        showToast('登録が完了しました！', 'success');
        closeAddModal();
        await loadLocations({}, true);
    } catch (error) {
        console.error('登録エラー:', error);
        showToast('登録に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// 編集機能
// ======================

/**
 * 編集モーダルを開く
 */
async function openEditModal(id) {
    showLoading();
    try {
        const location = await fetchLocationById(id);
        if (!location) throw new Error("Location not found");

        // 編集フォームに値を設定
        document.getElementById('editId').value = location.id;
        document.getElementById('editLocationName').value = location.location_name || '';
        document.getElementById('editWoodType').value = location.wood_type || '';
        document.getElementById('editPrice').value = location.price || '';
        document.getElementById('editAmount').value = location.amount || '';
        document.getElementById('editLatitude').value = location.latitude || '';
        document.getElementById('editLongitude').value = location.longitude || '';
        document.getElementById('editNotes').value = location.notes || '';
        document.getElementById('editSalesPeriod').value = location.sales_period || '';
        document.getElementById('editContactInfo').value = location.contact_info || '';
        document.getElementById('editDescription').value = location.description || '';

        closeModal('detailModal');
        openModal('editModal');

    } catch (error) {
        console.error('編集データ取得エラー:', error);
        showToast('データの取得に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// 編集フォーム関連のイベントリスナーを追加で設定
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editLocationForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }

    const closeEditBtn = document.getElementById('closeEditModalBtn');
    if (closeEditBtn) {
        closeEditBtn.addEventListener('click', () => closeModal('editModal'));
    }

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => closeModal('editModal'));
    }

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDelete);
    }
});

/**
 * 編集フォーム送信処理
 */
async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const updates = {
        location_name: document.getElementById('editLocationName').value.trim(),
        wood_type: document.getElementById('editWoodType').value.trim(),
        price: document.getElementById('editPrice').value.trim(),
        amount: document.getElementById('editAmount').value.trim(),
        latitude: parseFloat(document.getElementById('editLatitude').value),
        longitude: parseFloat(document.getElementById('editLongitude').value),
        notes: document.getElementById('editNotes').value.trim(),
        sales_period: document.getElementById('editSalesPeriod').value.trim(),
        contact_info: document.getElementById('editContactInfo').value.trim(),
        description: document.getElementById('editDescription').value.trim(),
        updated_at: new Date().toISOString()
    };

    showLoading();
    try {
        await updateLocation(id, updates);
        showToast('更新が完了しました！', 'success');
        closeModal('editModal');
        await loadLocations({}, true);
    } catch (error) {
        console.error('更新エラー:', error);
        showToast('更新に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 削除処理
 */
async function handleDelete() {
    const id = document.getElementById('editId').value;

    if (!confirm('本当にこの場所を削除しますか？')) {
        return;
    }

    showLoading();
    try {
        await deleteLocation(id);
        showToast('削除が完了しました', 'success');
        closeModal('editModal');
        await loadLocations({}, true);
    } catch (error) {
        console.error('削除エラー:', error);
        showToast('削除に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// フィルター機能
// ======================

/**
 * フィルターを適用
 */
async function applyFilter() {
    const woodType = document.getElementById('filterWoodType').value.trim();
    const search = document.getElementById('filterSearch').value.trim();

    await loadLocations({ woodType, search }, true);
    showToast('フィルターを適用しました', 'success');
}

/**
 * フィルターをクリア
 */
async function clearFilter() {
    document.getElementById('filterWoodType').value = '';
    document.getElementById('filterSearch').value = '';
    await loadLocations({}, true);
    showToast('フィルターをクリアしました', 'info');
}

// ======================
// 住所検索
// ======================

/**
 * 住所を検索
 */
async function searchAddress() {
    const query = document.getElementById('addressInput').value.trim();
    if (!query) {
        showToast('住所を入力してください', 'error');
        return;
    }

    showLoading();
    try {
        const results = await apiSearchAddress(query);

        const resultsList = document.getElementById('searchResults');
        resultsList.innerHTML = '';

        if (results.length === 0) {
            showToast('検索結果が見つかりませんでした', 'info');
            return;
        }

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = result.display_name;
            item.onclick = () => selectSearchResult(result.lat, result.lon, result.display_name);
            resultsList.appendChild(item);
        });

        resultsList.style.display = 'block';
        showToast(`${results.length}件の結果が見つかりました`, 'success');

    } catch (error) {
        console.error('住所検索エラー:', error);
        showToast('住所検索に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// 通報機能
// ======================

/**
 * 場所を通報
 */
async function reportLocation(id) {
    if (!confirm('この場所を通報しますか？\n（不適切な情報や虚偽の情報の場合のみ通報してください）')) {
        return;
    }

    showLoading();
    try {
        const location = await fetchLocationById(id);
        const currentCount = location.report_count || 0;

        await incrementReportCount(id, currentCount);

        if (currentCount + 1 >= CONFIG.REPORT_THRESHOLD) {
            showToast('通報を受け付けました。この場所は非表示になります。', 'success');
        } else {
            showToast('通報を受け付けました', 'success');
        }

        closeModal('detailModal');
        await loadLocations({}, true);

    } catch (error) {
        console.error('通報エラー:', error);
        showToast('通報に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ======================
// お問い合わせ
// ======================

/**
 * お問い合わせフォーム送信
 */
async function handleContactSubmit(e) {
    e.preventDefault();

    const contactData = {
        name: document.getElementById('contactName').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        message: document.getElementById('contactMessage').value.trim(),
        created_at: new Date().toISOString()
    };

    if (!contactData.name || !contactData.email || !contactData.message) {
        showToast('全ての項目を入力してください', 'error');
        return;
    }

    showLoading();
    try {
        await sendContact(contactData);
        showToast('お問い合わせを送信しました', 'success');
        closeModal('contactModal');
        resetForm('contactForm');
    } catch (error) {
        console.error('お問い合わせ送信エラー:', error);
        showToast('送信に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}
