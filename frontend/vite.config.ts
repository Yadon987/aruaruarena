import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // WSL2等のネットワーク環境からアクセス可能に
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
