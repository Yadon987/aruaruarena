import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import { useState } from 'react'
import reactLogo from './assets/react.svg'
// eslint-disable-next-line import/no-unresolved
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <QueryClientProvider client={queryClient}>
      <>
        {/* Tailwind CSS動作確認テストセクション */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Tailwind CSS 動作確認</h2>

          {/* テスト1: 基本的なユーティリティクラス */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary-500 mb-2">
              1. 基本クラス（文字色・太字）
            </h3>
            <p className="text-blue-500 font-bold">
              これは青い太字テキストです（text-blue-500 font-bold）
            </p>
          </div>

          {/* テスト2: カスタムカラー */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary-500 mb-2">2. カスタムカラー</h3>
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-primary-500 text-white rounded">プライマリ</div>
              <div className="px-4 py-2 bg-secondary-500 text-white rounded">セカンダリ</div>
              <div className="px-4 py-2 bg-error-500 text-white rounded">エラー</div>
            </div>
          </div>

          {/* テスト3: レスポンシブ */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary-500 mb-2">
              3. レスポンシブ（画面幅640px以上でフォントサイズ拡大）
            </h3>
            <p className="text-sm md:text-lg text-gray-700">
              このテキストは画面幅640px以上で大きくなります（text-sm md:text-lg）
            </p>
          </div>

          {/* テスト4: ボタン */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary-500 mb-2">4. インタラクティブ要素</h3>
            <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors">
              ホバーで色が変わるボタン
            </button>
          </div>

          {/* テスト5: スペースとパディング */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary-500 mb-2">5. スペースとパディング</h3>
            <div className="p-4 m-2 bg-gray-100 rounded border-2 border-primary-300">
              パディング4、マージン2、背景グレー、丸角、ボーダー
            </div>
          </div>
        </div>

        {/* 既存のVite + Reactサンプル */}
        <div className="text-center">
          <div className="flex justify-center gap-8 mb-4">
            <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
              <img src={viteLogo} className="logo" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </div>
          <h1 className="text-4xl font-bold mb-4">Vite + React</h1>
          <div className="card">
            <button onClick={() => setCount((count) => count + 1)} className="bg-gray-800">
              count is {count}
            </button>
            <p className="mt-4 text-gray-600">
              Edit <code>src/App.tsx</code> and save to test HMR
            </p>
          </div>
          <p className="read-the-docs mt-4">Click on the Vite and React logos to learn more</p>
        </div>
      </>
      {import.meta.env.DEV && process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

export default App
