/**
 * 地図関連の処理
 */

import { CONFIG, MAP_CONFIG, GEOLOCATION_OPTIONS, UI_CONFIG, ICONS } from './constants.js';
import { groupLocationsByCoords, createPopupContent, showToast } from './utils.js';

// 地図関連のグローバル変数
export let map = null;
export let markers = [];
export let markerClusterGroup = null;

// 選択モードの状態を管理するオブジェクト
export const selectionState = {
    isSelecting: false
};

/**
 * 地図を初期化
 * @returns {Object} 地図オブジェクト
 */
export function initMap() {
    const bounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

    map = L.map('map', {
        worldCopyJump: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false
    }).setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer(MAP_CONFIG.TILE_URL, {
        attribution: MAP_CONFIG.ATTRIBUTION,
        maxZoom: MAP_CONFIG.MAX_ZOOM,
        noWrap: true
    }).addTo(map);

    // 現在地取得を試みる
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], UI_CONFIG.INITIAL_ZOOM_WITH_LOCATION);

                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'current-location-marker',
                        html: `<div style="${ICONS.CURRENT_LOCATION_STYLE}"></div>`,
                        iconSize: [20, 20]
                    })
                }).addTo(map);
            },
            err => console.log('位置情報取得エラー:', err)
        );
    }

    return map;
}

/**
 * マップにクリックイベントを設定
 * @param {Function} handler - クリックハンドラー
 */
export function setMapClickHandler(handler) {
    if (map) {
        map.on('click', handler);
    }
}

/**
 * マップに移動終了イベントを設定
 * @param {Function} handler - 移動終了ハンドラー
 */
export function setMapMoveEndHandler(handler) {
    if (map) {
        map.on('moveend', handler);
    }
}

/**
 * 地図にマーカーを表示
 * @param {Array} locations - 場所の配列
 * @param {boolean} preventReset - マップのリセットを防ぐかどうか
 */
export function displayLocationsOnMap(locations, preventReset = false) {
    if (markerClusterGroup) {
        map.removeLayer(markerClusterGroup);
    }
    markers = [];

    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: MAP_CONFIG.CLUSTER_RADIUS,
        DisposableClusteringAtZoom: MAP_CONFIG.CLUSTERING_ZOOM_THRESHOLD,
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
                html: ICONS.MARKER,
                iconSize: [40, 40]
            }),
            id: first.id
        });

        marker.bindPopup(createPopupContent(group));

        // 選択モード時のマーカークリック処理
        marker.on('click', function (e) {
            if (selectionState.isSelecting) {
                L.DomEvent.stopPropagation(e);
                const latlng = e.latlng;
                document.getElementById('latitude').value = latlng.lat.toFixed(6);
                document.getElementById('longitude').value = latlng.lng.toFixed(6);

                // 場所名も設定（最初の場所の名前を使用）
                if (first.location_name) {
                    const locationNameField = document.getElementById('locationName');
                    if (locationNameField) {
                        locationNameField.value = first.location_name;
                    }
                }

                // 選択モードを終了
                selectionState.isSelecting = false;
                document.body.classList.remove('selecting-mode');

                // addModalを開く（グローバル関数を使用）
                if (window.openModal) {
                    window.openModal('addModal');
                }

                showToast(`座標（${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}）と場所名を取得しました`, 'success');
            }
        });

        markers.push(marker);
        markerClusterGroup.addLayer(marker);
    }

    map.addLayer(markerClusterGroup);

    if (!preventReset && markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * 地図から選択モードを開始
 */
export function startMapSelection() {
    selectionState.isSelecting = true;
    document.body.classList.add('selecting-mode');

    // モーダルを閉じる（グローバル関数を使用）
    if (window.closeModal) {
        window.closeModal('addModal');
    }

    showToast('地図上の場所をクリックしてください', 'info');
}

/**
 * 選択モードを終了
 */
export function endMapSelection() {
    selectionState.isSelecting = false;
    document.body.classList.remove('selecting-mode');
}

/**
 * 現在地を取得してマップを移動
 */
export function handleLocateBtn() {
    if (!navigator.geolocation) {
        showToast('位置情報に対応していません', 'error');
        return;
    }

    // ローディング表示（グローバル関数を使用）
    if (window.showLoading) {
        window.showLoading();
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], UI_CONFIG.LOCATE_ZOOM);

            if (window.hideLoading) {
                window.hideLoading();
            }
            showToast('現在地を取得しました');
        },
        (error) => {
            if (window.hideLoading) {
                window.hideLoading();
            }
            showToast('取得失敗: ' + error.message, 'error');
        },
        GEOLOCATION_OPTIONS
    );
}

/**
 * 地図上の特定位置にフォーカス
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 */
export function focusOnMap(lat, lng) {
    if (map) {
        map.setView([lat, lng], 15);
    }
}

/**
 * フォーム用に現在地の座標を取得
 */
export function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('位置情報に対応していません', 'error');
        return;
    }

    if (window.showLoading) {
        window.showLoading();
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            document.getElementById('latitude').value = latitude.toFixed(6);
            document.getElementById('longitude').value = longitude.toFixed(6);

            if (window.hideLoading) {
                window.hideLoading();
            }
            showToast('現在地を取得しました', 'success');
        },
        (error) => {
            if (window.hideLoading) {
                window.hideLoading();
            }
            showToast('位置情報の取得に失敗しました', 'error');
            console.error(error);
        },
        GEOLOCATION_OPTIONS
    );
}

/**
 * マップの表示範囲内の場所を取得
 * @param {Array} allLocations - 全場所の配列
 * @returns {Array} 表示範囲内の場所の配列
 */
export function getLocationsInView(allLocations) {
    if (!map) return [];

    const bounds = map.getBounds();
    return allLocations.filter(loc => {
        return bounds.contains([loc.latitude, loc.longitude]);
    });
}
