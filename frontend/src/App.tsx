import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Tailwind CSS 動作確認</h2>

        {/* 1. 基本クラス */}
        <div className="mb-6 p-4 border rounded shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">
            1. 基本クラス
          </h3>
          <div className="space-y-2">
            <p className="text-gray-600">
              比較用：これは標準の太さのテキストです (font-normal)
            </p>
            <p className="text-blue-500 font-bold">
              検証用：これは青い太字テキストです (text-blue-500 font-bold)
            </p>
          </div>
        </div>

        {/* 2. カスタムカラー */}
        <div className="mb-6 p-4 border rounded shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">
            2. カスタムカラー
          </h3>
          <div className="flex gap-4">
            <span className="px-4 py-2 bg-primary-500 text-white rounded">Primary</span>
            <span className="px-4 py-2 bg-secondary-500 text-white rounded">Secondary</span>
            <span className="px-4 py-2 bg-error-500 text-white rounded">Error</span>
          </div>
        </div>

        {/* 3. レスポンシブ */}
        <div className="mb-6 p-4 border rounded shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">
            3. レスポンシブ
          </h3>
          <p className="text-sm md:text-lg bg-gray-100 p-2 rounded">
            画面幅でサイズ変 (text-sm &rarr; md:text-lg) <br />
            <span className="text-xs text-gray-500">※ウィンドウ幅を変えて確認してください</span>
          </p>
        </div>

        {/* 4. インタラクティブ */}
        <div className="mb-6 p-4 border rounded shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-1">
            4. インタラクティブ
          </h3>
          <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors duration-200">
            ホバーしてみてください
          </button>
        </div>

        {/* 5. スペース・パディング */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            5. スペース・パディング (検証用ボックス)
          </h3>
          <p className="text-sm text-gray-600 mb-2">※外枠の点線と、内側のボックスの間に隙間(マージン)があれば成功です</p>
          <div className="border-2 border-dashed border-gray-300 bg-yellow-50 inline-block">
             <div className="p-4 m-2 bg-white rounded border-2 border-primary-300 text-center shadow-sm">
               p-4 m-2
             </div>
          </div>
        </div>

        {/* 6. アニメーション (追加リクエスト) */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            6. アニメーション動作確認
          </h3>
          <div className="flex items-center justify-center p-6 bg-gray-50 border rounded">
            <a href="https://react.dev" target="_blank" rel="noreferrer">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">
            ロゴが回転していれば成功です (animation: logo-spin)
          </p>
        </div>

      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
