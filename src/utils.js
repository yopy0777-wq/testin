/**
 * ユーティリティ関数集
 */

import { UI_CONFIG } from './constants.js';

/**
 * 座標で場所をグループ化
 * @param {Array} locations - 場所の配列
 * @returns {Object} 座標をキーとしたグループ化されたオブジェクト
 */
export function groupLocationsByCoords(locations) {
    const groups = {};
    locations.forEach(loc => {
        const key = `${loc.latitude},${loc.longitude}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(loc);
    });
    return groups;
}

/**
 * ポップアップコンテンツを作成
 * @param {Array} locations - 同じ座標の場所の配列
 * @returns {string} HTMLコンテンツ
 */
export function createPopupContent(locations) {
    let html = '<div style="max-height: 300px; overflow-y: auto; min-width: 250px;">';

    locations.forEach((loc, index) => {
        const isFirst = index === 0;

        html += `
            <div style="${index > 0 ? 'margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;' : ''} ${!isFirst ? 'margin-left: 10px;' : ''}">
                ${isFirst
                    ? `<h3 style="margin: 0 0 0.5rem 0; color: #8B4513; font-size: 1.1rem; font-weight: bold; text-align: center;">${loc.location_name || '名称未設定'}</h3>`
                    : ''
                }
                <p style="margin: 0.2rem 0; font-size: 0.9rem;"><strong>🪵 種類:</strong> ${loc.wood_type || '未設定'}</p>
                <p style="margin: 0.2rem 0; font-size: 0.9rem;"><strong>💰 価格:</strong> ${loc.price || '未設定'}円${loc.amount ? ' / ' + loc.amount : ''}</p>

                ${loc.description || loc.notes
                    ? `<p style="margin: 0.2rem 0; font-size: 0.85rem; color: #666;"><strong>📝 詳細:</strong> ${loc.description || loc.notes}</p>`
                    : ''
                }

                ${loc.sales_period
                    ? `<p style="margin: 0.2rem 0; font-size: 0.85rem;"><strong>📅 販売時期:</strong> ${loc.sales_period}</p>`
                    : ''
                }

                ${loc.contact_info
                    ? `<p style="margin: 0.2rem 0; font-size: 0.85rem;"><strong>📞 連絡先:</strong> ${loc.contact_info}</p>`
                    : ''
                }

                <button
                    onclick="window.viewDetails(${loc.id})"
                    style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; background-color: #8B4513; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; width: 100%;">
                    詳細を見る
                </button>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

/**
 * 表示高さを設定（モバイル対応）
 */
export function setFillHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/**
 * トーストメッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - トーストのタイプ ('success', 'error', 'info')
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} active`;

    setTimeout(() => {
        toast.classList.remove('active');
    }, UI_CONFIG.TOAST_DURATION);
}

/**
 * ローディング表示
 */
export function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('active');
}

/**
 * ローディング非表示
 */
export function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('active');
}

/**
 * モーダルを開く
 * @param {string} modalId - モーダルのID
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

/**
 * モーダルを閉じる
 * @param {string} modalId - モーダルのID
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

/**
 * フォームをリセット
 * @param {string} formId - フォームのID
 */
export function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
}

/**
 * フィルターパネルを開閉
 */
export function toggleFilter() {
    const content = document.querySelector('.filter-content');
    if (content) content.classList.toggle('active');
}

/**
 * 住所検索結果をクリア
 */
export function clearSearchResults() {
    const resultsList = document.getElementById('searchResults');
    if (resultsList) {
        resultsList.innerHTML = '';
        resultsList.style.display = 'none';
    }
}

/**
 * 検索結果項目をクリックした際の処理
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {string} displayName - 表示名
 */
export function selectSearchResult(lat, lon, displayName) {
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lon;
    document.getElementById('addressInput').value = displayName;
    clearSearchResults();
    showToast('住所を選択しました', 'success');
}

/**
 * 要素にイベントリスナーを一括設定
 * @param {Object} listeners - {id: handlerFunction} の形式
 */
export function setupEventListeners(listeners) {
    Object.entries(listeners).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) {
            const event = (id.includes('Form')) ? 'submit' : 'click';
            el.addEventListener(event, handler);
        }
    });
}
