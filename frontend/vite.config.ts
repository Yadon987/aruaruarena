import path from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// 共通設定: プラグインとパスエイリアス
export const sharedConfig = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  ...sharedConfig,
  server: {
    host: true, // WSL2等のネットワーク環境からアクセス可能に
    port: 5173,
    proxy: {
      // 開発環境でのバックエンドAPIプロキシ設定
      // セキュリティ上、/api パスのみプロキシ（任意のリクエスト転送を防止）
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
