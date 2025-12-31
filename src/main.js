// グローバル変数
let map;
let markers = [];
let allLocations = [];
let isSelectingLocation = false;
let isListCollapsed = true;
let markerClusterGroup;

// 定数
const CONFIG = {
    TABLE_NAME: 'firewood_locations',
    SUPABASE_URL: 'https://plmbomjfhfzpucrexqpp.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWJvbWpmaGZ6cHVjcmV4cXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzk5NTIsImV4cCI6MjA4MDc1NTk1Mn0.09UMcHdN2pdW7CVHb4X5WFL6obm1qw7cXdUhHS-RMC0',
    DEFAULT_CENTER: [36.5, 138.0],
    DEFAULT_ZOOM: 6,
    REPORT_THRESHOLD: 20
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initServiceWorker();
    initEventListeners();
    loadLocations();
    setFillHeight();
});

// Service Worker登録
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
}

// 地図初期化
function initMap() {
    const bounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

    map = L.map('map', {
        worldCopyJump: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false
    }).setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        noWrap: true
    }).addTo(map);

    map.on('click', handleMapClick);
    map.on('moveend', updateListFromMap);

    // 現在地取得を試みる
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 12);
                
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'current-location-marker',
                        html: '<div style="background: #2196F3; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map);
            },
            err => console.log('位置情報取得エラー:', err)
        );
    }
}

// マップクリック処理
async function handleMapClick(e) {
    if (!isSelectingLocation) return;
    
    document.getElementById('latitude').value = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').value = e.latlng.lng.toFixed(6);
    
    isSelectingLocation = false;
    document.body.classList.remove('selecting-mode');
    
    openModal('addModal');
    showToast(`座標（${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}）を取得しました`, 'success');
}

// イベントリスナー初期化
function initEventListeners() {
    const listeners = {
        'addLocationBtn': openAddModal,
        'closeModalBtn': closeAddModal,
        'cancelBtn': closeAddModal,
        'closeDetailBtn': closeDetailModal,
        'selectFromMapBtn': startMapSelection,
        'addLocationForm': handleSubmit,
        'getCurrentLocation': getCurrentLocation,
        'filterToggle': toggleFilter,
        'applyFilter': applyFilter,
        'clearFilter': clearFilter,
        'helpBtn': () => openHelpModal(),
        'refreshBtn': () => loadLocations(),
        'execSearchBtn': searchAddress,
        'locateBtn': handleLocateBtn
    };

    Object.entries(listeners).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) {
            const event = id === 'addLocationForm' ? 'submit' : 'click';
            el.addEventListener(event, handler);
        }
    });

    // リスト開閉
    ['listToggle', 'list-header'].forEach(selector => {
        const el = selector.includes('-') ? document.querySelector(`.${selector}`) : document.getElementById(selector);
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
}

// ヘルプモーダル制御
window.openHelpModal = function() {
    openModal('helpModal');
};

window.closeHelpModal = function() {
    closeModal('helpModal');
};

// 現在地取得ボタン処理
function handleLocateBtn() {
    if (!navigator.geolocation) {
        showToast('位置情報に対応していません', 'error');
        return;
    }
    showLoading();
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 15);
            hideLoading();
            showToast('現在地を取得しました');
        },
        (error) => {
            hideLoading();
            showToast('取得失敗: ' + error.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

// データ読み込み
async function loadLocations(filters = {}) {
    showLoading();
    try {
        let url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?select=*&report_count=lt.${CONFIG.REPORT_THRESHOLD}`;
        
        if (filters.search) {
            url += `&location_name=ilike.*${encodeURIComponent(filters.search)}*`;
        }
        
        const response = await fetch(url, {
            headers: {
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
            }
        });
        const result = await response.json();
        
        allLocations = result || [];
        
        let filteredLocations = allLocations;
        if (filters.woodType) {
            filteredLocations = filteredLocations.filter(loc => 
                loc.wood_type?.toLowerCase().includes(filters.woodType.toLowerCase())
            );
        }
        
        displayLocationsOnMap(filteredLocations);
        updateListFromMap();
        
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        showToast('データの読み込みに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// 地図にマーカー表示
function displayLocationsOnMap(locations) {
    if (markerClusterGroup) {
        map.removeLayer(markerClusterGroup);
    }
    markers = [];

    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 40,
        DisposableClusteringAtZoom: 16,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });

    const locationGroups = groupLocationsByCoords(locations);

    for (const key in locationGroups) {
        const group = locationGroups[key];
        const first = group[0];

        const marker = L.marker([first.latitude, first.longitude], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<i class="fas fa-fire"></i>',
                iconSize: [40, 40]
            }),
            id: first.id
        });

        marker.bindPopup(createPopupContent(group));
        markerClusterGroup.addLayer(marker);
        markers.push(marker);
    }

    map.addLayer(markerClusterGroup);

    if (markers.length > 0 && locations.length <= 50) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// 座標でグループ化
function groupLocationsByCoords(locations) {
    const groups = {};
    locations.forEach(loc => {
        if (loc.latitude && loc.longitude) {
            const key = `${loc.latitude}_${loc.longitude}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(loc);
        }
    });
    return groups;
}

// ポップアップコンテンツ作成
function createPopupContent(group) {
    let html = `<div style="min-width: 220px; max-height: 300px; overflow-y: auto;">`;
    
    if (group.length > 1) {
        html += `<p style="margin: 0 0 8px 0; font-weight: bold; border-bottom: 2px solid #8B4513;">📍 この場所に ${group.length} 件あります</p>`;
    }

    group.forEach((loc, index) => {
        html += `
            <div style="${index > 0 ? 'margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;' : ''}">
                <h3 style="margin: 0 0 0.5rem 0; color: #8B4513; font-size: 1.1rem;">${loc.location_name || '名称未設定'}</h3>
                <p style="margin: 0.3rem 0;"><strong>🪵 種類:</strong> ${loc.wood_type || '未設定'}</p>
                <p style="margin: 0.3rem 0;"><strong>💰 価格:</strong> ${loc.price || '未設定'}円</p>
                <button onclick="showDetail('${loc.id}')" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #8B4513; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                    詳細を見る
                </button>
            </div>
        `;
    });
    
    const first = group[0];
    const escapedName = (first.location_name || '').replace(/'/g, "\\'");
    html += `
        <hr style="margin: 12px 0 8px; border: 0; border-top: 1px solid #eee;">
        <button onclick="window.addAtThisLocation(${first.latitude}, ${first.longitude}, '${escapedName}')" class="btn-copy-add">
            <i class="fas fa-plus-circle"></i> この場所に追加登録
        </button>
    </div>`;

    return html;
}

// リストに表示
function displayLocationsList(locations) {
    const listContainer = document.getElementById('locationList');
    
    if (locations.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marker-alt"></i>
                <p>この表示範囲内に薪の販売場所はありません</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = locations.map(loc => `
        <div class="location-card" onclick="focusOnMarker('${loc.id}', ${loc.latitude}, ${loc.longitude})">
            <div class="location-card-header">
                <div class="location-card-title">${loc.location_name || '名称未設定'}</div>
            </div>
            <div class="location-card-info">
                <p><i class="fas fa-tree"></i> ${loc.wood_type || '未設定'}</p>
                <p><i class="fas fa-yen-sign"></i> ${loc.price || '未設定'}円</p>
                ${loc.address ? `<p><i class="fas fa-map-marker-alt"></i> ${loc.address}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// マーカーにフォーカス
function focusOnMarker(id, lat, lng) {
    map.flyTo([lat, lng], 11, { duration: 0.7 });

    setTimeout(() => {
        const targetMarker = markers.find(m => m.options.id === id);
        targetMarker?.openPopup();
    }, 1100);
}

// 地図範囲内のリスト更新
function updateListFromMap() {
    const bounds = map.getBounds();
    const visibleLocations = allLocations.filter(loc => {
        if (!loc.latitude || !loc.longitude) return false;
        return bounds.contains(L.latLng(loc.latitude, loc.longitude));
    });
    displayLocationsList(visibleLocations);
}

// 詳細表示
window.showDetail = async function(locationId) {
    showLoading();
    
    try {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${locationId}&select=*`;
        
        const response = await fetch(url, {
             headers: {
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}` 
            }
        });
        
        if (!response.ok) throw new Error(`詳細の取得に失敗しました`);

        const result = await response.json();
        const location = result[0];
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
                <h3><i class="fas fa-yen-sign"></i> 価格</h3>
                <p>${location.price || '未設定'}円</p>
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
                <button class="btn btn-primary" onclick="focusOnMap(${location.latitude}, ${location.longitude})">
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
                
                <button onclick="window.reportLocation('${location.id}')" 
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
};

// 地図にフォーカス
window.focusOnMap = function(lat, lng) {
    closeDetailModal();
    map.setView([lat, lng], 15);
    document.getElementById('listPanel').classList.add('collapsed');
};

// フォーム送信
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
        const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                ...formData,
                updated_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            showToast('登録が完了しました！', 'success');
            closeAddModal();
            document.getElementById('addLocationForm').reset();
            loadLocations();
        } else {
            throw new Error('登録に失敗しました');
        }
    } catch (error) {
        console.error('登録エラー:', error);
        showToast('登録に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// フォームデータ取得
function getFormData() {
    return {
        location_name: document.getElementById('locationName').value,
        wood_type: document.getElementById('woodType').value,
        price: parseInt(document.getElementById('price').value) || null,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        notes: document.getElementById('notes').value || ''
    };
}

// バリデーション
function validateFormData(data) {
    if (!data.location_name) return { valid: false, message: '場所名を入力してください' };
    if (!data.wood_type) return { valid: false, message: '薪の種類を選択してください' };
    if (data.price === null) return { valid: false, message: '価格を入力してください' };
    if (data.location_name.length > 40) return { valid: false, message: '場所名は40文字以内で入力してください' };
    if (data.price < 0 || data.price > 100000) return { valid: false, message: '価格は0〜100,000円の範囲で入力してください' };
    if (data.notes.length > 100) return { valid: false, message: '備考は100文字以内で入力してください' };
    if (isNaN(data.latitude) || isNaN(data.longitude)) return { valid: false, message: '緯度と経度が数値ではありません' };
    
    return { valid: true };
}

// 通報関数
window.reportLocation = async function(id) {
    if (!confirm('この情報を不適切として通報しますか？\n(一定数の通報が寄せられると自動的に非表示になります)')) return;

    showLoading();
    try {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${id}&select=report_count`, {
            headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}` }
        });
        const data = await res.json();
        const currentCount = data[0]?.report_count || 0;

        const updateRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ report_count: currentCount + 1 })
        });

        if (!updateRes.ok) throw new Error();

        showToast('通報ありがとうございます');
        
        if (currentCount + 1 >= CONFIG.REPORT_THRESHOLD) {
            closeDetailModal();
            loadLocations(); 
        }
    } catch (e) {
        showToast('エラーが発生しました', 'error');
    } finally {
        hideLoading();
    }
};

// 編集モーダル操作
window.openEditModal = function(id) {
    closeDetailModal();
    showLoading();

    const locationToEdit = allLocations.find(loc => loc.id === id);

    if (locationToEdit) {
        document.getElementById('locationName').value = locationToEdit.location_name || '';
        document.getElementById('woodType').value = locationToEdit.wood_type || '';
        document.getElementById('price').value = locationToEdit.price || '';
        document.getElementById('latitude').value = locationToEdit.latitude || '';
        document.getElementById('longitude').value = locationToEdit.longitude || '';
        document.getElementById('notes').value = locationToEdit.notes || '';

        const form = document.getElementById('addLocationForm');
        form.removeEventListener('submit', handleSubmit);
        form.removeEventListener('submit', handleUpdate);
        form.addEventListener('submit', handleUpdate);
        form.dataset.editId = id;
        
        document.querySelector('#addModal .modal-header h2').textContent = '薪販売場所の編集';
        document.querySelector('#addModal button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> 更新';
        
        openModal('addModal');
    } else {
        showToast('編集対象のデータが見つかりません', 'error');
    }
    hideLoading();
};

// 座標引き継ぎ登録
window.addAtThisLocation = function(lat, lng, name) {
    openAddModal();

    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const nameInput = document.getElementById('locationName');
    
    if (latInput && lngInput) {
        latInput.value = Number(lat).toFixed(6);
        lngInput.value = Number(lng).toFixed(6);
    }
    
    if (nameInput && name) {
        nameInput.value = name;
    }

    showToast('場所の情報を引き継ぎました', 'success');
    document.body.classList.remove('selecting-mode');
    isSelectingLocation = false;
};

// フォーム更新
async function handleUpdate(e) {
    e.preventDefault();
    
    const formData = getFormData();
    const validation = validateFormData(formData);
    
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }
    
    showLoading();
    
    const idToUpdate = document.getElementById('addLocationForm').dataset.editId;
    if (!idToUpdate) {
        showToast('更新対象のIDが見つかりません', 'error');
        hideLoading();
        return;
    }
    
    try {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${idToUpdate}`;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                ...formData,
                updated_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            showToast('更新が完了しました！', 'success');
            closeAddModal();
            loadLocations();
        } else {
            throw new Error('更新に失敗しました');
        }
    } catch (error) {
        console.error('更新エラー:', error);
        showToast('更新に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// マップ選択モード
function startMapSelection() {
    closeAddModal();
    isSelectingLocation = true;
    document.body.classList.add('selecting-mode');
    
    if (map) {
        setTimeout(() => map.invalidateSize(), 50);
    }
    showToast('地図上の場所をクリックしてください。ピンの裏も選べます。', 'info');
}

// 現在地取得
async function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('お使いのブラウザは位置情報に対応していません', 'error');
        return;
    }

    showLoading();
    
    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            
            document.getElementById('latitude').value = latitude.toFixed(6);
            document.getElementById('longitude').value = longitude.toFixed(6);
            
            showToast('現在地を取得しました', 'success');
            hideLoading();
        },
        error => {
            console.error('位置情報取得エラー:', error);
            showToast('位置情報の取得に失敗しました', 'error');
            hideLoading();
        }
    );
}

// 住所検索
async function searchAddress() {
    const query = document.getElementById('placeSearch').value;
    if (!query) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=jp`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        //const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';

        if (data.length === 0) {
            showToast('場所が見つかりませんでした', 'error');
            return;
        }

        data.forEach(place => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = place.display_name;
            div.onclick = () => {
                const lat = parseFloat(place.lat);
                const lon = parseFloat(place.lon);
                map.setView([lat, lon], 16);
                
                document.getElementById('latitude').value = lat;
                document.getElementById('longitude').value = lon;
                
                if(!document.getElementById('locationName').value) {
                    document.getElementById('locationName').value = place.name || '';
                }

                resultsContainer.innerHTML = '';
                showToast('地図を移動しました');
            };
            resultsContainer.appendChild(div);
        });
    } catch (error) {
        console.error('Search error:', error);
        showToast('検索中にエラーが発生しました', 'error');
    }
}

// UI制御関数
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function openAddModal() {
    document.querySelector('#addModal .modal-header h2').textContent = '薪販売場所の登録';
    document.querySelector('#addModal button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> 登録';
    
    const form = document.getElementById('addLocationForm');
    form.removeEventListener('submit', handleUpdate);
    form.removeEventListener('submit', handleSubmit);
    form.addEventListener('submit', handleSubmit);
    delete form.dataset.editId;
    
    openModal('addModal');
}

function closeAddModal() {
    closeModal('addModal');
    document.getElementById('addLocationForm').reset();
    //document.getElementById('searchResults').innerHTML = '';
}

function closeDetailModal() {
    closeModal('detailModal');
}

function toggleFilter() {
    document.getElementById('filterContent').classList.toggle('active');
}

function toggleList() {
    document.getElementById('listPanel').classList.toggle('collapsed');
}

function applyFilter() {
    const filters = {
        woodType: document.getElementById('woodTypeFilter').value,
        search: document.getElementById('searchQuery').value
    };
    loadLocations(filters);
}

function clearFilter() {
    document.getElementById('woodTypeFilter').value = '';
    document.getElementById('searchQuery').value = '';
    loadLocations();
}

function showLoading() {
    document.getElementById('loading').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

function setFillHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    window.addEventListener('resize', () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    });
}

// HTMLのイベントリスナーやonclickから呼び出せるようにグローバルに公開する
window.toggleFilter = toggleFilter;
window.toggleList = toggleList;
window.applyFilter = applyFilter;
window.clearFilter = clearFilter;
window.closeHelpModal = closeHelpModal;
window.openHelpModal = openHelpModal;
window.showDetail = showDetail;
window.focusOnMap = focusOnMap;
window.reportLocation = reportLocation;
window.openEditModal = openEditModal;
window.addAtThisLocation = addAtThisLocation;