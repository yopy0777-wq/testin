import { defineConfig } from 'vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  plugins: [
    obfuscator({
      compact: true,
      controlFlowFlattening: true, // 制御フローの平坦化（解析を難しくする）
      controlFlowFlatteningThreshold: 0.75,
      numbersToExpressions: true,  // 数値を計算式に変換
      simplify: true,
      stringArray: true,           // 文字列を配列に隠蔽
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false
    }),
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 本番公開時にconsole.logを消す
      }
    }
  }
});