
Review and Improve Plan
# 審査員アバター画像作成マニュアル（確定版）

このマニュアルでは「あるあるアリーナ」の3人の審査員（ひろゆき風・デヴィ夫人風・中尾彬風）のアニメーション用画像を、最も手軽かつ高品質に作成・実装する手順を解説します。

複雑な関節アニメーションは使わず「口パク」と「瞬き」のみに特化し、**1キャラにつき3枚の画像を丸ごと切り替える方式**を採用します。パーツの切り抜き作業は不要です。

---

## 🎯 方式の概要

### なぜ「丸ごと切り替え」方式か

旧来のパーツ重ね方式（口だけ・目だけを透過PNGで切り抜いて重ねる）は、切り抜き作業に手間がかかる上、Framer Motionで微振動アニメーションを加えた際に複数レイヤーがズレるリスクがあります。

**丸ごと切り替え方式**は常に1枚の画像を表示し、状態に応じて画像を瞬時に差し替えるだけです。120〜150msの高速切り替え中は人間の目が差分を認識できないため、パーツ切り抜きの精度を一切気にする必要がありません。

### 用意する画像（1キャラにつき3枚・512×512px・背景透過PNG）

| ファイル名 | 目の状態 | 口の状態 | 用途 |
|---|---|---|---|
| `[name]_base.png` | 開いている | 閉じている | 通常表示・待機中 |
| `[name]_mouth_open.png` | 開いている | 開いている | 口パク中（120ms交互） |
| `[name]_eye_closed.png` | 閉じている | 閉じている | 瞬き中（150ms） |

「目閉じ＆口開き」の第4パターンは不要です。瞬きと口パクが同時に発生する確率は極めて低く、実装側で瞬きを優先するため省略できます。

 │ 合計枚数       │ 9枚                                 │
     ├────────────────┼─────────────────────────────────────┤
     │ ファイルサイズ │ 1枚あたり200KB以下（目標）          │
     ├────────────────┼─────────────────────────────────────┤
     │ 配置場所       │ frontend/public/images/             │
     └────────────────┴─────────────────────────────────────┘
     2. ファイル命名規則

     frontend/public/images/
     ├── hiroyuki/
     │   ├── base.png        # 通常表情（口閉じ・目開き）
     │   ├── mouth_open.png  # 口開き（口パク用）
     │   └── eye_closed.png  # 目閉じ（瞬き用）
     ├── dewi/
     │   ├── base.png
     │   ├── mouth_open.png
     │   └── eye_closed.png
     └── nakao/
         ├── base.png
         ├── mouth_open.png
         └── eye_closed.png

     3. アニメーション仕様
     ┌──────────────────────┬──────────┬───────────────┬──────────────────────────────┐
     │  アニメーション種別  │ 継続時間 │     間隔      │             備考             │
     ├──────────────────────┼──────────┼───────────────┼──────────────────────────────┤
     │ 口パク（mouth_open） │ 120ms    │ ランダム2-4秒 │ 審査員がコメント表示中に同期 │
     ├──────────────────────┼──────────┼───────────────┼──────────────────────────────┤
     │ 瞬き（eye_closed）   │ 150ms    │ ランダム3-5秒 │ 常時ランダム実行             │
     ├──────────────────────┼──────────┼───────────────┼──────────────────────────────┤
     │ 同時発生時の優先度   │ -        │ -             │ 瞬きを優先（eye_closed表示） │
     └──────────────────────┴──────────┴───────────────┴──────────────────────────────┘
     [!NOTE]
     間隔は2-4秒、3-5秒の範囲でランダムに変化させることで、機械的な印象を避け、より人間らしい自然なアニメーシ
     ョンを実現します。

     4. 状態遷移図

     状態遷移図:

          +-------+
          | base  |<-----------------------+
          +-------+                        |
              |                            |
              | 瞬きトリガー               | 口パク終了
              v                            |
         +------------+                    |
         | eye_closed |----+               |
         +------------+    |               |
              |            | 150ms経過     |
              | 発話中     +---------------+
              v
         +------------+
         | mouth_open |
         +------------+
              |
              | 120ms経過 または isSpeaking=false
              v
         +-------+
         | base  |
         +-------+

     ルール:
     1. eye_closed状態中はmouth_openへの遷移をブロック（瞬き優先）
     2. mouth_open状態中に瞬きトリガーが発生した場合、即座にeye_closedへ遷移
     3. isSpeaking=falseになった場合、即座にbaseへ遷移
     4. prefersReducedMotion=trueの場合、すべてのアニメーションを停止

     5. 画像品質評価基準
     ┌────────────────────┬──────────────────────────────────────────────┬─────────────────────────────┐
     │      評価項目      │                     基準                     │          確認方法           │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ キャラクター一貫性 │ 同一キャラクターの3画像が同一人物に見える    │ 目視確認（3枚を重ねて表示） │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ 背景透過           │ エッジにノイズがない、背景色に影響されない   │ 白/黒背景での確認           │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ 解像度             │ 512×512px ±0                                 │ 画像プロパティ確認          │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ ファイルサイズ     │ 200KB以下                                    │ ls -la で確認               │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ 色彩一貫性         │ 各キャラクターのテーマカラーが維持されている │ デザインガイドライン照合    │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ 表情の自然さ       │ mouth_open/eye_closedが不自然でない          │ アニメーション確認          │
     ├────────────────────┼──────────────────────────────────────────────┼─────────────────────────────┤
     │ 位置整合性         │ 同一キャラの3画像で顔の位置が一致する        │ 重ね合わせチェック          │
     └────────────────────┴──────────────────────────────────────────────┴─────────────────────────────┘
     ---
     実装詳細

     ディレクトリ構成

     frontend/
     ├── public/
     │   └── images/
     │       └── avatars/           # 新規作成
     │           ├── hiroyuki/
     │           │   ├── base.png
     │           │   ├── mouth_open.png
     │           │   └── eye_closed.png
     │           ├── dewi/
     │           │   ├── base.png
     │           │   ├── mouth_open.png
     │           │   └── eye_closed.png
     │           └── nakao/
     │               ├── base.png
     │               ├── mouth_open.png
     │               └── eye_closed.png
     ├── src/
     │   ├── shared/
     │   │   ├── constants/
     │   │   │   ├── animations.ts
     │   │   │   ├── avatar.ts        # 新規追加
     │   │   │   ├── index.ts         # 更新（再エクスポート追加）
     │   │   │   └── validation.ts
     │   │   └── hooks/
     │   │       ├── useJudgeAvatar.ts    # 新規追加
     │   │       ├── useAvatarImages.ts   # 新規追加
     │   │       ├── useReducedMotion.ts
     │   │       └── __tests__/
     │   │           ├── useJudgeAvatar.test.ts    # 新規追加
     │   │           └── useAvatarImages.test.ts   # 新規追加
     │   └── features/
     │       └── judging/
     │           └── components/
     │               ├── JudgeAvatar.tsx    # 新規追加
     │               └── JudgeAvatars.tsx   # 新規追加

     Critical Files
     ┌───────────────────────────────────────────────────────────┬──────────┬─────────────────────────────────
     ─┐
     │                         ファイル                          │   操作   │               説明
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/constants/avatar.ts                   │ 新規作成 │ アバター関連の定数と型定義
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/hooks/useJudgeAvatar.ts               │ 新規作成 │ アバターアニメーション制御フック
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/hooks/useAvatarImages.ts              │ 新規作成 │ 画像プリロードフック
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/features/judging/components/JudgeAvatar.tsx  │ 新規作成 │ 単一審査員アバターコンポーネント
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/features/judging/components/JudgeAvatars.tsx │ 新規作成 │ 3人の審査員を表示するコンテナ
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/constants/index.ts                    │ 更新     │ avatar.tsの再エクスポート追加
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/types/domain.ts                       │ 参照     │ JudgePersona型を再利用
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/constants/validation.ts               │ 参照     │ JUDGE.PERSONAS定数を再利用
      │
     ├───────────────────────────────────────────────────────────┼──────────┼─────────────────────────────────
     ─┤
     │ frontend/src/shared/hooks/useReducedMotion.ts             │ 参照     │ Reduced Motion検知フックを再利用
      │
     └───────────────────────────────────────────────────────────┴──────────┴─────────────────────────────────
     ─┘







     コード実装詳細

     1. avatar.ts（定数と型定義）

     // frontend/src/shared/constants/avatar.ts

     import type { JudgePersona } from '@shared/types/domain'

     /** アバターの状態 */
     export type AvatarState = 'base' | 'mouth_open' | 'eye_closed'

     /** 審査員の表示名 */
     export const JUDGE_LABELS: Record<JudgePersona, string> = {
       hiroyuki: 'ひろゆき風',
       dewi: 'デヴィ婦人風',
       nakao: '中尾彬風',
     } as const

     /** アバターアニメーション設定 */
     export const AVATAR_ANIMATION = {
       /** 口パクの継続時間（ms） */
       MOUTH_DURATION_MS: 120,
       /** 瞬きの継続時間（ms） */
       BLINK_DURATION_MS: 150,
       /** 口パクの最小間隔（ms） */
       MOUTH_INTERVAL_MIN_MS: 2000,
       /** 口パクの最大間隔（ms） */
       MOUTH_INTERVAL_MAX_MS: 4000,
       /** 瞬きの最小間隔（ms） */
       BLINK_INTERVAL_MIN_MS: 3000,
       /** 瞬きの最大間隔（ms） */
       BLINK_INTERVAL_MAX_MS: 5000,
     } as const

     /** アバター画像のベースパス */
     export const AVATAR_BASE_PATH = '/images/avatars' as const

     /**
      * アバター画像のパスを生成する
      */
     export function getAvatarImagePath(persona: JudgePersona, state: AvatarState): string {
       return `${AVATAR_BASE_PATH}/${persona}/${state}.png`
     }

     /**
      * 審査員のaria-labelを生成する
      */
     export function getJudgeAriaLabel(persona: JudgePersona, state: AvatarState): string {
       const label = JUDGE_LABELS[persona]
       const stateLabel = state === 'base' ? '' : state === 'mouth_open' ? '（発話中）' : '（瞬き中）'
       return `${label}の審査員アバター${stateLabel}`
     }

     /**
      * 全アバター画像のパス一覧を取得する（プリロード用）
      */
     export function getAllAvatarImagePaths(): string[] {
       const personas: JudgePersona[] = ['hiroyuki', 'dewi', 'nakao']
       const states: AvatarState[] = ['base', 'mouth_open', 'eye_closed']

       return personas.flatMap((persona) =>
         states.map((state) => getAvatarImagePath(persona, state))
       )
     }

     2. useAvatarImages.ts（画像プリロードフック）

     // frontend/src/shared/hooks/useAvatarImages.ts

     import { useState, useEffect } from 'react'
     import { getAllAvatarImagePaths } from '@shared/constants/avatar'

     export type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

     interface AvatarImagesState {
       status: ImageLoadStatus
       loadedCount: number
       totalCount: number
       errorPaths: string[]
     }

     const TOTAL_IMAGE_COUNT = 9

     /**
      * アバター画像をプリロードするフック
      *
      * 口パク・瞬きの切り替え時に画像がチラつくのを防ぐため、
      * コンポーネントのマウント時に全9枚をブラウザキャッシュに格納する。
      */
     export function useAvatarImages(): AvatarImagesState {
       const [state, setState] = useState<AvatarImagesState>({
         status: 'idle',
         loadedCount: 0,
         totalCount: TOTAL_IMAGE_COUNT,
         errorPaths: [],
       })

       useEffect(() => {
         let mounted = true
         const paths = getAllAvatarImagePaths()

         setState((prev) => ({ ...prev, status: 'loading' }))

         const loadPromises = paths.map(
           (path) =>
             new Promise<{ path: string; success: boolean }>((resolve) => {
               const img = new Image()
               img.onload = () => resolve({ path, success: true })
               img.onerror = () => resolve({ path, success: false })
               img.src = path
             })
         )

         Promise.all(loadPromises).then((results) => {
           if (!mounted) return

           const loadedCount = results.filter((r) => r.success).length
           const errorPaths = results.filter((r) => !r.success).map((r) => r.path)
           const hasErrors = errorPaths.length > 0

           setState({
             status: hasErrors ? 'error' : 'loaded',
             loadedCount,
             totalCount: TOTAL_IMAGE_COUNT,
             errorPaths,
           })

           if (hasErrors) {
             console.error('[Avatar] 画像読み込みエラー:', errorPaths)
           }
         })

         return () => {
           mounted = false
         }
       }, [])

       return state
     }

     3. useJudgeAvatar.ts（アニメーション制御フック）

     // frontend/src/shared/hooks/useJudgeAvatar.ts

     import { useEffect, useRef, useState, useCallback } from 'react'
     import { useReducedMotion } from './useReducedMotion'
     import {
       AVATAR_ANIMATION,
       getAvatarImagePath,
       type AvatarState,
     } from '@shared/constants/avatar'
     import type { JudgePersona } from '@shared/types/domain'

     interface UseJudgeAvatarOptions {
       persona: JudgePersona
       isSpeaking?: boolean
     }

     interface JudgeAvatarState {
       currentImage: string
       currentState: AvatarState
       isLoaded: boolean
     }

     /**
      * 指定範囲のランダムな整数を生成する
      */
     function getRandomInRange(min: number, max: number): number {
       return Math.floor(Math.random() * (max - min + 1)) + min
     }

     /**
      * 審査員アバターのアニメーションを制御するフック
      */
     export function useJudgeAvatar({
       persona,
       isSpeaking = false,
     }: UseJudgeAvatarOptions): JudgeAvatarState {
       const prefersReducedMotion = useReducedMotion()
       const [currentState, setCurrentState] = useState<AvatarState>('base')
       const [isLoaded, setIsLoaded] = useState(false)

       const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
       const mouthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
       const lastBlinkTimeRef = useRef<number>(Date.now())
       const isAnimatingRef = useRef(true)

       // タイマーのクリーンアップ
       const clearAllTimers = useCallback(() => {
         if (blinkTimeoutRef.current) {
           clearTimeout(blinkTimeoutRef.current)
           blinkTimeoutRef.current = null
         }
         if (mouthTimeoutRef.current) {
           clearTimeout(mouthTimeoutRef.current)
           mouthTimeoutRef.current = null
         }
       }, [])

       // 画像のプリロード確認
       useEffect(() => {
         const img = new Image()
         img.onload = () => setIsLoaded(true)
         img.onerror = () => {
           console.error(`[Avatar] 画像読み込み失敗: ${persona}`)
           setIsLoaded(true)
         }
         img.src = getAvatarImagePath(persona, 'base')
       }, [persona])

       // 瞬きアニメーション
       useEffect(() => {
         if (prefersReducedMotion || !isLoaded) {
           return
         }

         const scheduleBlink = () => {
           if (!isAnimatingRef.current) return

           const now = Date.now()
           const elapsed = now - lastBlinkTimeRef.current
           const nextInterval = getRandomInRange(
             AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS,
             AVATAR_ANIMATION.BLINK_INTERVAL_MAX_MS
           )

           // 累積遅延を考慮した次のタイミング計算
           const delay = Math.max(0, nextInterval - elapsed)

           blinkTimeoutRef.current = setTimeout(() => {
             if (!isAnimatingRef.current) return

             setCurrentState('eye_closed')
             lastBlinkTimeRef.current = Date.now()

             setTimeout(() => {
               if (isAnimatingRef.current) {
                 setCurrentState('base')
                 scheduleBlink()
               }
             }, AVATAR_ANIMATION.BLINK_DURATION_MS)
           }, delay)
         }

         scheduleBlink()

         return () => {
           if (blinkTimeoutRef.current) {
             clearTimeout(blinkTimeoutRef.current)
           }
         }
       }, [prefersReducedMotion, isLoaded])

       // 口パクアニメーション（発話中のみ）
       useEffect(() => {
         if (prefersReducedMotion || !isLoaded || !isSpeaking) {
           return
         }

         const scheduleMouth = () => {
           if (!isAnimatingRef.current) return

           const nextInterval = getRandomInRange(
             AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS,
             AVATAR_ANIMATION.MOUTH_INTERVAL_MAX_MS
           )

           mouthTimeoutRef.current = setTimeout(() => {
             if (!isAnimatingRef.current || !isSpeaking) return

             // 瞬き中は口パクをスキップ（瞬き優先）
             setCurrentState((prev) => {
               if (prev === 'eye_closed') return prev
               return 'mouth_open'
             })

             setTimeout(() => {
               if (isAnimatingRef.current && isSpeaking) {
                 setCurrentState((prev) => {
                   if (prev === 'mouth_open') return 'base'
                   return prev
                 })
                 scheduleMouth()
               }
             }, AVATAR_ANIMATION.MOUTH_DURATION_MS)
           }, nextInterval)
         }

         scheduleMouth()

         return () => {
           if (mouthTimeoutRef.current) {
             clearTimeout(mouthTimeoutRef.current)
           }
         }
       }, [prefersReducedMotion, isLoaded, isSpeaking])

       // アンマウント時のクリーンアップ
       useEffect(() => {
         return () => {
           isAnimatingRef.current = false
           clearAllTimers()
         }
       }, [clearAllTimers])

       // isSpeakingがfalseになったら口を閉じる
       useEffect(() => {
         if (!isSpeaking && currentState === 'mouth_open') {
           setCurrentState('base')
         }
       }, [isSpeaking, currentState])

       return {
         currentImage: getAvatarImagePath(persona, currentState),
         currentState,
         isLoaded,
       }
     }

     4. JudgeAvatar.tsx（コンポーネント）

     // frontend/src/features/judging/components/JudgeAvatar.tsx

     import { useJudgeAvatar } from '@shared/hooks/useJudgeAvatar'
     import { JUDGE_LABELS, getJudgeAriaLabel } from '@shared/constants/avatar'
     import type { JudgePersona } from '@shared/types/domain'

     interface JudgeAvatarProps {
       persona: JudgePersona
       isSpeaking?: boolean
       className?: string
     }

     /**
      * 審査員アバターコンポーネント
      */
     export function JudgeAvatar({
       persona,
       isSpeaking = false,
       className = ''
     }: JudgeAvatarProps) {
       const { currentImage, currentState, isLoaded } = useJudgeAvatar({
         persona,
         isSpeaking,
       })

       if (!isLoaded) {
         return (
           <div
             className={`animate-pulse bg-gray-200 rounded-full ${className}`}
             style={{ width: 128, height: 128 }}
             aria-label={`${JUDGE_LABELS[persona]}読み込み中`}
           />
         )
       }

       return (
         <img
           src={currentImage}
           alt={getJudgeAriaLabel(persona, currentState)}
           className={`w-32 h-32 object-contain ${className}`}
           aria-hidden={currentState !== 'base'}
           draggable={false}
         />
       )
     }

     5. JudgeAvatars.tsx（コンテナコンポーネント）

     // frontend/src/features/judging/components/JudgeAvatars.tsx

     import { JudgeAvatar } from './JudgeAvatar'
     import { useAvatarImages } from '@shared/hooks/useAvatarImages'
     import { JUDGE_LABELS } from '@shared/constants/avatar'
     import { JUDGE } from '@shared/constants/validation'
     import type { JudgePersona } from '@shared/types/domain'

     interface JudgeAvatarsProps {
       speakingJudge?: JudgePersona | null
       className?: string
     }

     /**
      * 3人の審査員アバターを表示するコンテナコンポーネント
      */
     export function JudgeAvatars({
       speakingJudge = null,
       className = ''
     }: JudgeAvatarsProps) {
       const { status, loadedCount, totalCount } = useAvatarImages()

       if (status === 'loading') {
         return (
           <div
             role="status"
             aria-live="polite"
             className={`flex items-center justify-center gap-2 ${className}`}
           >
             <p className="text-sm text-gray-600">
               審査員を読み込み中...
             </p>
             <progress
               value={loadedCount}
               max={totalCount}
               className="w-24"
             />
           </div>
         )
       }

       return (
         <div
           role="region"
           aria-label="審査員一覧"
           className={`flex justify-center gap-8 ${className}`}
         >
           {JUDGE.PERSONAS.map((persona) => (
             <div key={persona} className="flex flex-col items-center gap-2">
               <JudgeAvatar
                 persona={persona}
                 isSpeaking={speakingJudge === persona}
               />
               <span className="text-sm font-medium">
                 {JUDGE_LABELS[persona]}
               </span>
             </div>
           ))}
         </div>
       )
     }

     ---
     テスト計画

     単体テスト（Vitest + Testing Library）

     配置先: frontend/src/shared/hooks/__tests__/useJudgeAvatar.test.ts
     ┌───────────────────────────────────────────────────┬───────────────────────────────────────────┐
     │                   テストケース                    │                 検証内容                  │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ 初期状態はbase画像を返す                          │ currentState === 'base'                   │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ 瞬きアニメーションが実行される                    │ Fake Timerで時間経過後にeye_closedに遷移  │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ isSpeaking=trueで口パクアニメーションが実行される │ Fake Timerでmouth_openに遷移              │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ 瞬き中は口パクに遷移しない（瞬き優先）            │ eye_closed状態中はmouth_openにならない    │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ アンマウント時にタイマーがクリアされる            │ unmount後もエラーが発生しない             │
     ├───────────────────────────────────────────────────┼───────────────────────────────────────────┤
     │ Reduced Motion時はアニメーション無効              │ prefersReducedMotion=trueで状態遷移しない │
     └───────────────────────────────────────────────────┴───────────────────────────────────────────┘
     テストパターン（Fake Timer使用）:

     import { renderHook, act } from '@testing-library/react'
     import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
     import { useJudgeAvatar } from '../useJudgeAvatar'
     import * as avatarConstants from '@shared/constants/avatar'

     // Imageのモック
     const mockImage = {
       onload: null as (() => void) | null,
       onerror: null as (() => void) | null,
       src: '',
     }

     vi.stubGlobal('Image', vi.fn(() => mockImage))

     // useReducedMotionのモック
     vi.mock('./useReducedMotion', () => ({
       useReducedMotion: () => false,
     }))

     describe('useJudgeAvatar', () => {
       beforeEach(() => {
         vi.useFakeTimers()
         vi.clearAllMocks()
       })

       afterEach(() => {
         vi.useRealTimers()
       })

       it('初期状態はbase画像を返す', async () => {
         const { result } = renderHook(() =>
           useJudgeAvatar({ persona: 'hiroyuki' })
         )

         act(() => {
           mockImage.onload?.()
         })

         expect(result.current.currentState).toBe('base')
         expect(result.current.currentImage).toContain('hiroyuki/base.png')
       })

       it('瞬きアニメーションが実行される', async () => {
         const { result } = renderHook(() =>
           useJudgeAvatar({ persona: 'hiroyuki' })
         )

         act(() => {
           mockImage.onload?.()
         })

         act(() => {
           vi.advanceTimersByTime(avatarConstants.AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS)
         })

         expect(result.current.currentState).toBe('eye_closed')

         act(() => {
           vi.advanceTimersByTime(avatarConstants.AVATAR_ANIMATION.BLINK_DURATION_MS)
         })

         expect(result.current.currentState).toBe('base')
       })
     })

     E2Eテスト（Playwright）

     配置先: frontend/e2e/judge-avatar.spec.ts
     ┌──────────────────────────────────────┬─────────────────────────────────────────────────┐
     │             テストケース             │                    検証内容                     │
     ├──────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ 審査中画面にアバター画像が表示される │ 3つの<img>要素が存在すること                    │
     ├──────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ 各画像のsrcが正しい形式か            │ /images/avatars/[name]/base.pngの形式であること │
     └──────────────────────────────────────┴─────────────────────────────────────────────────┘
     ---
     受入条件

     機能要件

     - 3人の審査員アバター画像（各3表情、計9枚）が生成されている
     - 審査中画面で3人のアバターが表示される
     - ランダムな間隔で瞬きアニメーションが実行される
     - 審査員が発話中に口パクアニメーションが実行される
     - 瞬きと口パクが同時発生時は瞬きが優先される
     - 画像がプリロードされる
     - 画像読み込み失敗時にクラッシュしない

     非機能要件

     - Reduced Motion設定に対応する
     - 画像ファイルサイズが200KB以下
     - タイマーのメモリリークがない
     - スクリーンリーダーで適切に読み上げられる

     テスト要件

     - 単体テストカバレッジ90%以上
     - Fake Timerを使用したタイマーテスト

     ---
     実装順序

     1. Phase 1: 定数と型定義
       - avatar.tsの作成
       - AvatarState型のエクスポート
       - index.tsの更新
     2. Phase 2: カスタムフック
       - useAvatarImages.tsの実装
       - useJudgeAvatar.tsの実装
       - 単体テストの作成（Fake Timer使用）
     3. Phase 3: コンポーネント
       - JudgeAvatar.tsxの実装
       - JudgeAvatars.tsxの実装
     4. Phase 4: 画像生成と配置
       - AI生成による画像作成
       - 品質評価（評価基準に従う）
       - 配置と確認
     5. Phase 5: 統合
       - App.tsxの審査中画面セクションに統合
       - isTalking状態とテキスト表示の連動
       - E2Eテストの追加

     ---
     検証手順

     1. テスト実行
     cd frontend && npx vitest run src/shared/hooks/__tests__/useJudgeAvatar.test.ts
     cd frontend && npx vitest run src/shared/hooks/__tests__/useAvatarImages.test.ts
     2. 型チェック
     cd frontend && npx tsc --noEmit
     3. Lint
     cd frontend && npx eslint src/shared/hooks/useJudgeAvatar.ts src/shared/hooks/useAvatarImages.ts
     4. ブラウザでの目視確認
       - 審査中画面を表示
       - 瞬きアニメーションの自然さを確認
       - 口パクアニメーションの自然さを確認
       - 画像切り替え時のチラつきがないことを確認

     ---
     ⚡ パフォーマンス考慮事項

     画像キャッシュ戦略
     ┌────────────────────┬─────────────────────────────────┬──────────────────────────────┐
     │   多段キャッシュ   │              手段               │             効果             │
     ├────────────────────┼─────────────────────────────────┼──────────────────────────────┤
     │ ブラウザキャッシュ │ Cache-Control: max-age=31536000 │ 2回目以降のロードが即座      │
     ├────────────────────┼─────────────────────────────────┼──────────────────────────────┤
     │ CDNキャッシュ      │ CloudFront                      │ オリジンへのリクエスト削減   │
     ├────────────────────┼─────────────────────────────────┼──────────────────────────────┤
     │ プリロード         │ useAvatarImages                 │ 初回表示前にキャッシュに格納 │
     └────────────────────┴─────────────────────────────────┴──────────────────────────────┘
     パフォーマンス指標の目安
     ┌────────────────┬─────────┬──────────────────────────────────┐
     │      指標      │ 目標値  │               根拠               │
     ├────────────────┼─────────┼──────────────────────────────────┤
     │ 画像合計サイズ │ < 1.5MB │ 9枚×150KB。モバイル4Gでも3秒以内 │
     ├────────────────┼─────────┼──────────────────────────────────┤
     │ 口パク切り替え │ 120ms   │ 人間の知覚閾値以下               │
     ├────────────────┼─────────┼──────────────────────────────────┤
     │ 瞬き切り替え   │ 150ms   │ 自然な瞬きの速度                 │
     ├────────────────┼─────────┼──────────────────────────────────┤
     │ タイマー精度   │ ±20ms   │ setInterval の標準精度範囲内     │
     ├────────────────┼─────────┼──────────────────────────────────┤
     │ 初回ロード時間 │ < 2秒   │ プリロード完了までの時間         │
     └────────────────┴─────────┴──────────────────────────────────┘
     prefers-reduced-motion 対応

     アクセシビリティのため、ユーザーが「アニメーションを減らす」設定をしている場合は微振動・呼吸感アニメーシ
     ョンのみ停止し、口パク・瞬きは維持します（静止画では不自然なため）。

     import { useReducedMotion } from '@shared/hooks/useReducedMotion'

     // JudgeAvatar内
     const shouldReduceMotion = useReducedMotion()

     // shouldReduceMotion === true の場合、タイマーを開始しない
     // ただし、画像の初期表示（base）は行う

     [!NOTE]
     プロジェクトには既に useReducedMotion フックが shared/hooks/useReducedMotion.ts に存在します。

     ---
     🔗 親コンポーネントとの統合

     審査中画面での使用

     現在の App.tsx の審査中画面セクションに統合します。

     import { JudgeAvatars } from '@/features/judging/components/JudgeAvatars'

     // App コンポーネント内
     // isTalking状態の管理
     // 各審査員の発話状態を個別に管理する
     const [talkingJudge, setTalkingJudge] = useState<JudgePersona | null>(null)

     審査中画面の表示パターン:
     ┌────────────────────────┬────────────┬────────────┬────────────┬──────────────────────┐
     │          状態          │  ひろゆき  │ デヴィ夫人 │   中尾彬   │         説明         │
     ├────────────────────────┼────────────┼────────────┼────────────┼──────────────────────┤
     │ 審査中（全員待機）     │ 呼吸アニメ │ 呼吸アニメ │ 呼吸アニメ │ 口癖をランダム表示中 │
     ├────────────────────────┼────────────┼────────────┼────────────┼──────────────────────┤
     │ 口癖表示中（ひろゆき） │ 口パク     │ 待機       │ 待機       │ テキスト表示と連動   │
     ├────────────────────────┼────────────┼────────────┼────────────┼──────────────────────┤
     │ 審査完了               │ 待機       │ 待機       │ 待機       │ 結果モーダルへ遷移   │
     └────────────────────────┴────────────┴────────────┴────────────┴──────────────────────┘
     [!NOTE]
     現在の App.tsx は審査中画面でテキストベースのシンプルな表示を行っています。アバター実装時にはこの部分を置
     き換えますが、既存のポーリングロジックやサウンドシステムとの統合は変更不要です。isTalking
     状態は口癖テキスト表示のタイミングと連動させるだけです。

     isTalkingとの連動パターン

     テキスト表示（タイプライター演出）との連動例：

     // 口癖テキスト表示と連動
     const displayCatchphrase = async (judge: JudgePersona, text: string) => {
       setTalkingJudge(judge)

       // タイプライター演出でテキスト表示
       for (const char of text) {
         await new Promise((r) => setTimeout(r, 50))
         // 1文字ずつ表示
       }

       // 表示完了後、少し間を置いて口パク停止
       await new Promise((r) => setTimeout(r, 300))
       setTalkingJudge(null)
     }

     // JSX内
     <JudgeAvatars speakingJudge={talkingJudge} />

     ---
     🧪 テスト計画（詳細版）

     ユニットテスト（Vitest + Testing Library）

     配置先: frontend/src/features/judging/__tests__/JudgeAvatar.test.tsx
     テストケース: base 画像が初期表示される
     検証内容: isTalking=false で _base.png がレンダリングされること
     ────────────────────────────────────────
     テストケース: mouth_open 画像に切り替わる
     検証内容: isTalking=true で120ms後に _mouth_open.png に切り替わること
     ────────────────────────────────────────
     テストケース: 口パク停止で base に戻る
     検証内容: isTalking を false に変更すると _base.png に戻ること
     ────────────────────────────────────────
     テストケース: 瞬き時に eye_closed が表示される
     検証内容: 瞬きタイマー発火後に _eye_closed.png が表示されること
     ────────────────────────────────────────
     テストケース: 瞬き中に口パクが無視される
     検証内容: isBlinking=true の間は isTalking=true でも eye_closed が表示されること
     ────────────────────────────────────────
     テストケース: アンマウント時にタイマーがクリアされる
     検証内容: コンポーネントをアンマウント後、setIsBlinking が呼ばれないこと
     ────────────────────────────────────────
     テストケース: 各ペルソナ名で正しいパスが生成される
     検証内容: hiroyuki, dewi, nakao それぞれで正しいパスが返ること
     ────────────────────────────────────────
     テストケース: Reduced Motion時はアニメーション停止
     検証内容: prefersReducedMotion=true でタイマーが開始されないこと
     ────────────────────────────────────────
     テストケース: 画像読み込み失敗時にクラッシュしない
     検証内容: onerror が呼ばれてもコンポーネントがクラッシュしないこと
     テスト実行コマンド:
     cd frontend && npx vitest run src/features/judging/__tests__/JudgeAvatar.test.tsx

     プリロードフックのテスト

     配置先: frontend/src/shared/hooks/__tests__/useAvatarImages.test.ts
     ┌──────────────────────────────────┬──────────────────────────────────────────────────────┐
     │           テストケース           │                       検証内容                       │
     ├──────────────────────────────────┼──────────────────────────────────────────────────────┤
     │ 全9枚の画像がプリロードされる    │ new Image() が9回呼ばれ、各 src が正しいこと         │
     ├──────────────────────────────────┼──────────────────────────────────────────────────────┤
     │ 二重プリロードされない           │ フックが2回レンダリングされても Image() は9回のみ    │
     ├──────────────────────────────────┼──────────────────────────────────────────────────────┤
     │ 読み込み成功時にloaded状態になる │ 全画像のonload後に status === 'loaded' になること    │
     ├──────────────────────────────────┼──────────────────────────────────────────────────────┤
     │ 読み込み失敗時にerror状態になる  │ 1枚でもonerrorがあると status === 'error' になること │
     ├──────────────────────────────────┼──────────────────────────────────────────────────────┤
     │ loadedCount/totalCountが正しい   │ 読み込み進捗が正しくカウントされること               │
     └──────────────────────────────────┴──────────────────────────────────────────────────────┘
     テスト実行コマンド:
     cd frontend && npx vitest run src/shared/hooks/__tests__/useAvatarImages.test.ts

     E2Eテスト（Playwright）

     配置先: frontend/e2e/judge-avatar.spec.ts
     ┌──────────────────────────────────────┬──────────────────────────────────────────────────┐
     │             テストケース             │                     検証内容                     │
     ├──────────────────────────────────────┼──────────────────────────────────────────────────┤
     │ 審査中画面にアバター画像が表示される │ 審査中画面に3つの <img> 要素が存在すること       │
     ├──────────────────────────────────────┼──────────────────────────────────────────────────┤
     │ 各画像のsrcが正しい形式か            │ /images/[name]/base.png の形式であること         │
     ├──────────────────────────────────────┼──────────────────────────────────────────────────┤
     │ アクセシビリティ属性が設定されている │ role="region" と aria-label が存在すること       │
     ├──────────────────────────────────────┼──────────────────────────────────────────────────┤
     │ 画像読み込み中表示が切り替わる       │ ローディング状態からアバター表示に切り替わること │
     └──────────────────────────────────────┴──────────────────────────────────────────────────┘
     テスト実行コマンド:
     cd frontend && npx playwright test e2e/judge-avatar.spec.ts

     ---
     📋 作業チェックリスト

     【画像生成】
       [ ] hiroyuki：base / mouth_open / eye_closed
       [ ] dewi    ：base / mouth_open / eye_closed
       [ ] nakao   ：base / mouth_open / eye_closed

     【加工】
       [ ] 背景透過（aianime.io / remove.bg）
       [ ] 512×512リサイズ（bulkresizephotos.com / ImageMagick）
       [ ] 圧縮（tinypng.com）
       [ ] ファイルリネーム（命名規則に統一）
       [ ] 品質チェック（重ね合わせ・透過確認）

     【配置・実装】
       [ ] frontend/public/images/ ディレクトリ作成
       [ ] 各キャラクターのサブディレクトリ作成
       [ ] 9枚の画像を配置
       [ ] shared/constants/avatar.ts 作成
       [ ] shared/hooks/useAvatarImages.ts 作成
       [ ] shared/hooks/useJudgeAvatar.ts 作成
       [ ] features/judging/components/JudgeAvatar.tsx 作成
       [ ] features/judging/components/JudgeAvatars.tsx 作成
       [ ] App.tsx の審査中画面セクションに統合
       [ ] isTalking をテキスト表示（口癖演出）と連動

     【テスト】
       [ ] JudgeAvatar ユニットテスト
       [ ] useJudgeAvatar ユニットテスト
       [ ] useAvatarImages ユニットテスト
       [ ] E2Eテスト（基本表示の確認）
       [ ] ブラウザでの目視確認（口パク・瞬きの自然さ）
       [ ] アクセシビリティ確認（スクリーンリーダー）

     ---
     🔮 将来の拡張可能性
     ┌────────────────────────────────────┬────────────┬───────────────────────────────┐
     │               拡張案               │ 実装難易度 │             効果              │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ WebP形式への変換                   │ 低         │ ファイルサイズ30-40%削減      │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ 口パクパターンの増加（半開き追加） │ 中         │ より自然な発話アニメーション  │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ 審査員ごとの瞬き頻度パラメータ化   │ 低         │ キャラクターの個性を表現      │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ Spine/Live2D統合                   │ 高         │ 滑らかな全身アニメーション    │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ <canvas> ベースのレンダリング      │ 中         │ DOM操作を削減、60fps維持      │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ 審査員の追加（4人目以降）          │ 低         │ JUDGE.PERSONAS に追加するだけ │
     ├────────────────────────────────────┼────────────┼───────────────────────────────┤
     │ 音声合成との同期                   │ 中         │ 口パクを音声波形と同期        │
     └────────────────────────────────────┴────────────┴───────────────────────────────┘
     ---
     関連資料

     - 画面設計書: docs/screen_design.md
     - 既存型定義: frontend/src/shared/types/domain.ts
     - 既存定数: frontend/src/shared/constants/validation.ts
     - アニメーション定数: frontend/src/shared/constants/animations.ts
     - DB設計書: docs/db_schema.md
     - API仕様書: docs/api_spec.md