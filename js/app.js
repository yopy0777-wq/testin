// ============================================
// グローバル変数
// ============================================
let map;
let markers = [];
let allLocations = [];
let isSelectingLocation = false; //  NEW: マップ選択モードを追跡するフラグ
const TABLE_NAME = 'firewood_locations';

const SUPABASE_URL = 'https://plmbomjfhfzpucrexqpp.supabase.co'; // ステップ1-3で確認
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWJvbWpmaGZ6cHVjcmV4cXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzk5NTIsImV4cCI6MjA4MDc1NTk1Mn0.09UMcHdN2pdW7CVHb4X5WFL6obm1qw7cXdUhHS-RMC0'; // ステップ1-1で取得

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initServiceWorker();
    initEventListeners();
    loadLocations();
});

// ============================================
// Service Worker登録
// ============================================
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// ============================================
// 地図初期化
// ============================================
function initMap() {
    // デフォルトは日本の中心付近
    const defaultLat = 36.5;
    const defaultLng = 138.0;
    const defaultZoom = 6;

// 🟢 1. 最大境界 (Max Bounds) の定義
    // (北端(90), 西端(-180)) と (南端(-90), 東端(180)) を設定し、地球全体をカバー
    const southWest = L.latLng(-90, -180);
    const northEast = L.latLng(90, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    // 🟢 2. L.map() の初期化オプションに maxBounds を追加 (worldCopyJump: false は維持)
    map = L.map('map', {
        worldCopyJump: false, // 地図の無限ラップ（左右の繰り返し）を無効にする (念のため維持)
        maxBounds: bounds,      // 地図のドラッグ可能範囲を地球全体に制限
        maxBoundsViscosity: 1.0 // 境界線でぴったり止まるように粘性を設定
    }).setView([defaultLat, defaultLng], defaultZoom);

    // OpenStreetMapタイルレイヤー（無料）
    // 🟢 3. タイルレイヤーに noWrap: true を追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        noWrap: true // タイル画像を繰り返さないように設定
    }).addTo(map);

// 🟢 修正：ここでマップクリックリスナーを登録する
    map.on('click', async function(e) {
        // マップ選択モードがONの時のみ動作する
        if (isSelectingLocation) {
            // 1. 座標を取得してフォームにセット
            // 修正済み: e.latlng.lng.lng を e.latlng.lng に変更
            document.getElementById('latitude').value = e.latlng.lat.toFixed(6);
            document.getElementById('longitude').value = e.latlng.lng.toFixed(6); 
            
            showToast('座標を取得しました。住所を検索中...', 'info');
            
            // 2. 選択モードをOFFに戻す
            isSelectingLocation = false;
            
            // 3. モーダルを「リセットせずに」再表示する (ここを修正)
            // 🔴 openAddModal() の代わりに、モーダルを開く処理だけを実行する
            document.getElementById('addModal').classList.add('active');
            document.body.style.overflow = 'hidden';

            // 4. ユーザーに通知
            showToast(`座標（${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}）を取得し、フォームに反映しました`, 'success');
        }
    });

    // 現在地取得を試みる
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                
                // 現在地マーカー
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'current-location-marker',
                        html: '<div style="background: #2196F3; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map).bindPopup('現在地');
            },
            error => {
                console.log('位置情報取得エラー:', error);
            }
        );
    }
}

// ============================================
// イベントリスナー初期化
// ============================================
function initEventListeners() {
    // 新規登録ボタン
    document.getElementById('addLocationBtn').addEventListener('click', () => {
        openAddModal();
    });

    // モーダル閉じる
    document.getElementById('closeModalBtn').addEventListener('click', closeAddModal);
    document.getElementById('cancelBtn').addEventListener('click', closeAddModal);
    document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);

    // モーダル外クリック
    document.getElementById('addModal').addEventListener('click', (e) => {
        if (e.target.id === 'addModal') closeAddModal();
    });
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeDetailModal();
    });

   // 🟢 新しいボタンのリスナーを追加
    document.getElementById('selectFromMapBtn').addEventListener('click', startMapSelection);
    


    // フォーム送信
    document.getElementById('addLocationForm').addEventListener('submit', handleSubmit);

    // 現在地取得
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);

    // フィルター
    document.getElementById('filterToggle').addEventListener('click', toggleFilter);
    document.getElementById('applyFilter').addEventListener('click', applyFilter);
    document.getElementById('clearFilter').addEventListener('click', clearFilter);

// --- 🟢 リスト開閉のリスナーをここから差し替え ---
    const listToggleBtn = document.getElementById('listToggle');
    const listHeader = document.querySelector('.list-header');

    // △ボタンとヘッダー全体、どちらを押しても toggleList が動くようにする
    [listToggleBtn, listHeader].forEach(el => {
        if (el) {
            el.addEventListener('click', (e) => {
                // △ボタンをクリックした際、親要素（ヘッダー）のイベントも
                // 同時に発生して「開いてすぐ閉じる」現象を防ぐ
                e.stopPropagation();
                toggleList();
            });
        }
    });
}

// ============================================
// データ読み込み
// ============================================
async function loadLocations(filters = {}) {
    showLoading();
    
    try {
        let url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=*`;
        
        if (filters.search) {
            url += `&search=${encodeURIComponent(filters.search)}`;
        }
        
        const response = await fetch(url, {
            // --- 認証キーをヘッダーに追加 ---
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                // 🟢 読み込みにも Authorization を追加
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const result = await response.json();
        
        allLocations = result || [];
        
        // クライアントサイドでフィルタリング
        let filteredLocations = allLocations;
        
        if (filters.woodType) {
            filteredLocations = filteredLocations.filter(loc => 
                loc.wood_type && loc.wood_type.toLowerCase().includes(filters.woodType.toLowerCase())
            );
        }
        
        displayLocationsOnMap(filteredLocations);
        displayLocationsList(filteredLocations);
        
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        showToast('データの読み込みに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// 地図にマーカー表示
// ============================================
function displayLocationsOnMap(locations) {
    // 既存のマーカーをクリア
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    locations.forEach(location => {
        if (location.latitude && location.longitude) {
            const marker = L.marker([location.latitude, location.longitude], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<i class="fas fa-fire"></i>',
                    iconSize: [40, 40]
                })
            }).addTo(map);

            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #8B4513; font-size: 1.1rem;">${location.location_name || '名称未設定'}</h3>
                    <p style="margin: 0.3rem 0;"><strong>🪵 種類:</strong> ${location.wood_type || '未設定'}</p>
                    <p style="margin: 0.3rem 0;"><strong>💰 価格:</strong> ${location.price || '未設定'}円</p>
                    <button onclick="showDetail('${location.id}')" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #8B4513; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                        詳細を見る
                    </button>
                </div>
            `);

            marker.on('click', () => {
                map.setView([location.latitude, location.longitude], 15);
            });

            markers.push(marker);
        }
    });

    // マーカーがある場合は地図を調整
    if (markers.length > 0 && locations.length <= 50) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// ============================================
// リストに表示
// ============================================
function displayLocationsList(locations) {
    const listContainer = document.getElementById('locationList');
    
    
    
    if (locations.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marker-alt"></i>
                <p>登録された薪の販売場所がありません</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = locations.map(location => `
        <div class="location-card" onclick="showDetail('${location.id}')">
            <div class="location-card-header">
                <div class="location-card-title">${location.location_name || '名称未設定'}</div>
            </div>
            <div class="location-card-info">
                <p><i class="fas fa-tree"></i> ${location.wood_type || '未設定'}</p>
                <p><i class="fas fa-yen-sign"></i> ${location.price || '未設定'}円</p>
                ${location.address ? `<p><i class="fas fa-map-marker-alt"></i> ${location.address}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// ============================================
// 詳細表示
// ============================================
window.showDetail = async function(locationId) {
    showLoading();
    
    try {
        // 🟢 データを取得するためのURLを構築
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${locationId}&select=*`;
        
        // 🟢 Supabaseへの fetch リクエスト
        const response = await fetch(url, {
             headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
            }
        });
        
        // 🟢 レスポンスが成功したかチェック
        if (!response.ok) {
            // サーバーからエラーが返された場合
            const errorBody = await response.text();
            console.error('APIエラーレスポンス:', errorBody);
            throw new Error(`詳細の取得に失敗しました: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const location = result[0];
        
        if (!location) throw new Error("Location not found");

        const detailContent = document.getElementById('detailContent');
        
        // window.showDetail 内の修正
        const lastUpdate = location.updated_at 
            ? new Date(location.updated_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }) 
            : '不明';
        
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
            
            <!--
            ${location.address ? `
                <div class="detail-section">
                    <h3><i class="fas fa-map-marker-alt"></i> 住所</h3>
                    <p>${location.address}</p>
                </div>
            ` : ''}-->
            
            <div class="detail-section">
                <h3><i class="fas fa-map"></i> 位置情報</h3>
                <p>緯度: ${location.latitude}, 経度: ${location.longitude}</p>
            </div>
            
            <!--
            ${location.contact ? `
                <div class="detail-section">
                    <h3><i class="fas fa-phone"></i> 連絡先</h3>
                    <p>${location.contact}</p>
                </div>
            ` : ''}-->
            
            ${location.notes ? `
                <div class="detail-section">
                    <h3><i class="fas fa-sticky-note"></i> 備考</h3>
                    <p style="white-space: pre-wrap;">${location.notes}</p>
                </div>
            ` : ''}
            
            <div class="detail-section detail-actions"> 
                <button class="btn btn-primary" onclick="focusOnMap(${location.latitude}, ${location.longitude})">
                    <i class="fas fa-map-marked-alt"></i> 地図で確認
                </button>
                
                <a href="https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}" target="_blank" class="btn btn-outline" style="margin-left: 10px;">
                    <i class="fab fa-google"></i> Googleマップで開く
                </a>
                
                <button class="btn btn-secondary" onclick="openEditModal('${location.id}')">
                    <i class="fas fa-edit"></i> 編集
                </button>
            </div>
            
            <div class="detail-section">
                            <h3><i class="fas fa-history"></i> 最終更新日</h3>
                <p>${lastUpdate}</p>
            </div>

        `;
        
        openDetailModal();
        
    } catch (error) {
        console.error('詳細取得エラー:', error);
        showToast('詳細情報の取得に失敗しました', 'error');
    } finally {
        hideLoading();
    }
};

// ============================================
// 地図にフォーカス
// ============================================
window.focusOnMap = function(lat, lng) {
    closeDetailModal();
    map.setView([lat, lng], 15);
    
    // リストパネルを折りたたむ
    document.getElementById('listPanel').classList.add('collapsed');
};


// ============================================
// フォーム送信 (handleSubmit)
// ============================================
async function handleSubmit(e) {
    e.preventDefault();
    
    const priceInput = document.getElementById('price').value;
    const priceValue = parseInt(priceInput);
    const locationName = document.getElementById('locationName').value;
    const notes = document.getElementById('notes').value;
    const woodType = document.getElementById('woodType').value;

    //入力チェック---------
    if (!locationName) {
        showToast('場所名を入力してください', 'error');
        return;
    }
    if (!woodType) {
        showToast('薪の種類を選択してください', 'error');
        return;
    }
    if (priceInput === "") {
        showToast('価格を入力してください', 'error');
        return;
    }

    // --- 既存のバリデーション（文字数や数値範囲） ---
    if (locationName.length > 40) {
        showToast('場所名は40文字以内で入力してください', 'error');
        return;
    }

    if (isNaN(priceValue) || priceValue < 0) {
        showToast('価格には0以上の数字を入力してください', 'error');
        return;
    }
    if (priceValue > 100000) {
        showToast('価格は10万円以内で入力してください', 'error');
        return;
    }

    if (notes.length > 100) {
        showToast('備考は100文字以内で入力してください', 'error');
        return;
    }
    //--------------
    showLoading();

    //const addressValue = document.getElementById('address').value;
    let latValue = document.getElementById('latitude').value;
    let lngValue = document.getElementById('longitude').value;
    
    let latitude;
    let longitude;
    
       
        // 2. 緯度・経度が入力されている場合は、その値を使用
        latitude = parseFloat(latValue);
        longitude = parseFloat(lngValue);
    //}
    
    // 3. 最終バリデーション
    if (isNaN(latitude) || isNaN(longitude)) {
        showToast('緯度と経度が数値ではありません。手動で入力してください。', 'error');
        hideLoading();
        return; 
    }
    // ----------------------------------

    const formData = {
        location_name: document.getElementById('locationName').value,
        wood_type: document.getElementById('woodType').value,
        //price: document.getElementById('price').value,
        // 🟢 修正: 価格を数値に変換（NaNはnullまたは0として扱う）
        price: parseInt(document.getElementById('price').value) || null,
        //address: addressValue || '', // 住所の変数を使用
        latitude: latitude,     
        longitude: longitude,   
        //contact: document.getElementById('contact').value || '',
        notes: document.getElementById('notes').value || '',
        updated_at: new Date().toISOString()
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showToast('登録が完了しました！', 'success');
            closeAddModal();
            document.getElementById('addLocationForm').reset();
            loadLocations();
        } else {
            // 失敗時の詳細デバッグ
            const errorText = await response.text(); 
            console.error('APIエラーレスポンス:', errorText);
            throw new Error('登録に失敗しました');
        }
    } catch (error) {
        console.error('登録エラー:', error);
        showToast('登録に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}
// ============================================
// フォーム更新 (編集)
// ============================================
async function handleUpdate(e) {
    e.preventDefault();
    
    const priceInput = document.getElementById('price').value;
    const priceValue = parseInt(priceInput);
    const locationName = document.getElementById('locationName').value;
    const notes = document.getElementById('notes').value;
    const woodType = document.getElementById('woodType').value;

    //入力チェック----------
    if (!locationName) {
        showToast('場所名を入力してください', 'error');
        return;
    }
    if (!woodType) {
        showToast('薪の種類を選択してください', 'error');
        return;
    }
    if (priceInput === "") {
        showToast('価格を入力してください', 'error');
        return;
    }

    // --- 既存のバリデーション（文字数や数値範囲） ---
    if (locationName.length > 40) {
        showToast('場所名は40文字以内で入力してください', 'error');
        return;
    }

    if (isNaN(priceValue) || priceValue < 0) {
        showToast('価格には0以上の数字を入力してください', 'error');
        return;
    }
    if (priceValue > 100000) {
        showToast('価格は10万円以内で入力してください', 'error');
        return;
    }

    if (notes.length > 100) {
        showToast('備考は100文字以内で入力してください', 'error');
        return;
    }
    //----------------
    
    showLoading();
    
    // フォームに保持したIDを取得
    const idToUpdate = document.getElementById('addLocationForm').dataset.editId; 
    if (!idToUpdate) {
        showToast('更新対象のIDが見つかりません', 'error');
        hideLoading();
        return;
    }

    // 🟢 ジオコーディングに必要な値を取得
    //const addressValue = document.getElementById('address').value;
    let latValue = document.getElementById('latitude').value;
    let lngValue = document.getElementById('longitude').value;
    
    let latitude;
    let longitude;
        
        // 2. 緯度・経度が入力されている場合は、その値を使用
        latitude = parseFloat(latValue);
        longitude = parseFloat(lngValue);
    //}

    // 3. 最終バリデーション
    if (isNaN(latitude) || isNaN(longitude)) {
        showToast('緯度と経度が数値ではありません。手動で入力してください。', 'error');
        hideLoading();
        return; 
    }
    // ----------------------------------------------------
    
    // 4. formDataの作成（更新後の座標を使用）
    const formData = {
        location_name: document.getElementById('locationName').value,
        wood_type: document.getElementById('woodType').value,
        //price: document.getElementById('price').value,
        // 🟢 修正: 価格を数値に変換（NaNはnullまたは0として扱う）
        price: parseInt(document.getElementById('price').value) || null,
        //address: addressValue || '',
        latitude: latitude,
        longitude: longitude,
        //contact: document.getElementById('contact').value || '',
        notes: document.getElementById('notes').value || '',
        updated_at: new Date().toISOString()
    };
    
    try {
        // URLにID指定のクエリを追加
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${idToUpdate}`;
        
        const response = await fetch(url, {
            method: 'PATCH', // メソッドは PATCH で更新
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showToast('更新が完了しました！', 'success');
            closeAddModal();
            loadLocations(); // データ再読み込み
        } else {
            const errorText = await response.text(); 
            console.error('更新エラー:', errorText);
            throw new Error('更新に失敗しました');
        }
    } catch (error) {
        console.error('更新エラー:', error);
        showToast('更新に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// マップ選択モード制御
// ============================================
function startMapSelection() {
    // 1. モーダルを閉じる
    closeAddModal();
    
    // 2. 選択モードをONにする
    isSelectingLocation = true;
    
    // 🟢 修正点：マップのサイズを再計算し、再描画を強制する
    if (map) {
        // 少し遅延させることで、モーダルが完全に閉じてから実行することを保証
        setTimeout(() => {
            map.invalidateSize(); 
            // ズームレベルはそのままに、表示位置だけ再中央寄せしたい場合は次の行も有効にできます
            // map.panTo(map.getCenter());
        }, 50); // 50ミリ秒遅延
    }
    
    // 3. ユーザーに通知し、マップの操作を促す
    showToast('地図上の登録したい場所をクリックしてください', 'info');
}



// ============================================
// 編集モーダル操作
// ============================================
window.openEditModal = function(id) {
    closeDetailModal(); // 詳細モーダルを閉じる
    showLoading();

    // 編集対象のデータをallLocationsから探す
    const locationToEdit = allLocations.find(loc => loc.id === id);

    if (locationToEdit) {
        // フォームにデータをロード
        document.getElementById('locationName').value = locationToEdit.location_name || '';
        document.getElementById('woodType').value = locationToEdit.wood_type || '';
        document.getElementById('price').value = locationToEdit.price || '';
        //document.getElementById('address').value = locationToEdit.address || '';
        document.getElementById('latitude').value = locationToEdit.latitude || '';
        document.getElementById('longitude').value = locationToEdit.longitude || '';
        //document.getElementById('contact').value = locationToEdit.contact || '';
        document.getElementById('notes').value = locationToEdit.notes || '';

        // フォーム送信時に実行する処理を、登録 (handleSubmit) から更新 (handleUpdate) に変更
        const form = document.getElementById('addLocationForm');
        form.removeEventListener('submit', handleSubmit); // 古いリスナーを削除
        form.removeEventListener('submit', handleUpdate);

        // 🟢 フォームにIDを一時的に保持
        form.addEventListener('submit', handleUpdate);
        form.dataset.editId = id; 
        
        // 🟢 handleUpdateを呼び出す新しいリスナーを追加
        //form.addEventListener('submit', handleUpdate); 

        // ヘッダーを「編集」に変更
        document.querySelector('#addModal .modal-header h2').textContent = '薪販売場所の編集';
        document.querySelector('#addModal button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> 更新';
        
        // 🟢 モーダルを開く処理を直接記述（openAddModalを呼ばない）
        document.getElementById('addModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        
        //openAddModal(); // 既存のモーダルを開く
    } else {
        showToast('編集対象のデータが見つかりません', 'error');
    }
    hideLoading();
};

// ============================================
// 現在地取得 (getCurrentLocation 関数) 
// ============================================
async function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('お使いのブラウザは位置情報に対応していません', 'error');
        return;
    }

    showLoading();
    
    navigator.geolocation.getCurrentPosition(
        async position => { // 👈 修正: async を追加
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            document.getElementById('latitude').value = lat.toFixed(6);
            document.getElementById('longitude').value = lng.toFixed(6);
            
            showToast('現在地を取得しました。住所を検索中...', 'info');
            
            
            hideLoading();
        },
        error => {
            console.error('位置情報取得エラー:', error);
            showToast('位置情報の取得に失敗しました', 'error');
            hideLoading();
        }
    );
}
// ============================================
// フィルター関連
// ============================================
function toggleFilter() {
    const filterContent = document.getElementById('filterContent');
    filterContent.classList.toggle('active');
}

function applyFilter() {
    const woodType = document.getElementById('woodTypeFilter').value;
    const search = document.getElementById('searchQuery').value;
    
    loadLocations({
        woodType,
        search
    });
    
    showToast('フィルターを適用しました', 'success');
}

function clearFilter() {
    document.getElementById('woodTypeFilter').value = '';
    document.getElementById('searchQuery').value = '';
    loadLocations();
    showToast('フィルターをクリアしました', 'success');
}

// ============================================
// リスト開閉
// ============================================
function toggleList() {
    document.getElementById('listPanel').classList.toggle('collapsed');
}

// ============================================
// モーダル操作
// ============================================
function openAddModal() {
    const form = document.getElementById('addLocationForm');
    
    // フォームを新規登録モードにリセットし、リスナーを handleSubmit に戻す
    form.removeEventListener('submit', handleUpdate); 
    form.addEventListener('submit', handleSubmit); // 登録用リスナーを設定
    form.dataset.editId = ''; // 編集IDをクリア
    form.reset(); // フォーム内容を空にする

    // ヘッダーとボタンを新規登録用に設定
    document.querySelector('#addModal .modal-header h2').textContent = '薪販売場所の登録';
    document.querySelector('#addModal button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> 登録';

    document.getElementById('addModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAddModal() {
    // リスナーの切り替えは openAddModal と openEditModal に任せるため、ここはシンプルに戻す
    document.getElementById('addModal').classList.remove('active');
    document.body.style.overflow = '';
}

function openDetailModal() {
    document.getElementById('detailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================
// ローディング表示
// ============================================
function showLoading() {
    document.getElementById('loading').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
}

// ============================================
// トースト通知
// ============================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}
