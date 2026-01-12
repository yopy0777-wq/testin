/**
 * Supabase API関連の処理
 */

import { CONFIG } from './constants.js';

/**
 * 共通のヘッダーを取得
 * @returns {Object} APIリクエスト用のヘッダー
 */
function getHeaders() {
    return {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };
}

/**
 * 場所データを全件取得
 * @param {Object} filters - フィルター条件
 * @returns {Promise<Array>} 場所データの配列
 */
export async function fetchLocations(filters = {}) {
    let url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?select=*&report_count=lt.${CONFIG.REPORT_THRESHOLD}`;

    if (filters.search) {
        url += `&location_name=ilike.*${encodeURIComponent(filters.search)}*`;
    }

    const response = await fetch(url, {
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * 特定IDの場所データを取得
 * @param {number} id - 場所のID
 * @returns {Promise<Object>} 場所データ
 */
export async function fetchLocationById(id) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${id}`;

    const response = await fetch(url, {
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data[0];
}

/**
 * 新しい場所を追加
 * @param {Object} locationData - 場所データ
 * @returns {Promise<Object>} レスポンス
 */
export async function addLocation(locationData) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(locationData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
}

/**
 * 場所データを更新
 * @param {number} id - 場所のID
 * @param {Object} updates - 更新するデータ
 * @returns {Promise<Object>} レスポンス
 */
export async function updateLocation(id, updates) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${id}`;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updates)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
}

/**
 * 場所を削除
 * @param {number} id - 場所のID
 * @returns {Promise<Object>} レスポンス
 */
export async function deleteLocation(id) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}?id=eq.${id}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
}

/**
 * レポート数を増やす
 * @param {number} id - 場所のID
 * @param {number} currentCount - 現在のレポート数
 * @returns {Promise<Object>} レスポンス
 */
export async function incrementReportCount(id, currentCount) {
    return await updateLocation(id, { report_count: currentCount + 1 });
}

/**
 * Nominatim APIで住所から座標を検索
 * @param {string} query - 検索クエリ
 * @returns {Promise<Array>} 検索結果の配列
 */
export async function searchAddress(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=jp&limit=5`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'FirewoodMapApp/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * お問い合わせを送信
 * @param {Object} contactData - お問い合わせデータ
 * @returns {Promise<Object>} レスポンス
 */
export async function sendContact(contactData) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/contacts`;

    const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(contactData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
}
