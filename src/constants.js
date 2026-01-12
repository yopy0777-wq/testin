/**
 * アプリケーション全体で使用する定数
 */

// Supabase設定
export const CONFIG = {
    TABLE_NAME: 'firewood_locations',
    SUPABASE_URL: 'https://plmbomjfhfzpucrexqpp.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWJvbWpmaGZ6cHVjcmV4cXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzk5NTIsImV4cCI6MjA4MDc1NTk1Mn0.09UMcHdN2pdW7CVHb4X5WFL6obm1qw7cXdUhHS-RMC0',
    DEFAULT_CENTER: [36.5, 138.0],
    DEFAULT_ZOOM: 6,
    REPORT_THRESHOLD: 20
};

// マップ設定
export const MAP_CONFIG = {
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© OpenStreetMap contributors | <b>App By ゆきぬ</b>',
    MAX_ZOOM: 19,
    CLUSTER_RADIUS: 40,
    CLUSTERING_ZOOM_THRESHOLD: 16
};

// 位置情報設定
export const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
};

// UI設定
export const UI_CONFIG = {
    TOAST_DURATION: 3000,
    INITIAL_ZOOM_WITH_LOCATION: 12,
    LOCATE_ZOOM: 15
};

// カラー定数（CSS変数と対応）
export const COLORS = {
    PRIMARY: '#8B4513',
    PRIMARY_DARK: '#6B3410',
    SECONDARY: '#D2691E',
    SUCCESS: '#4CAF50',
    DANGER: '#f44336',
    WARNING: '#ff9800',
    INFO: '#2196F3'
};

// アイコン設定
export const ICONS = {
    MARKER: '<i class="fas fa-fire"></i>',
    CURRENT_LOCATION_STYLE: 'background: #2196F3; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);'
};
