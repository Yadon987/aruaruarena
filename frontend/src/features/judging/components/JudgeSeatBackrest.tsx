import { useId } from 'react'

export type JudgeSeatBackrestVariant = 'royal-crown' | 'royal-tufted' | 'royal-marquee'

interface JudgeSeatBackrestProps {
  variant?: JudgeSeatBackrestVariant
}

const TUFT_POINTS = [
  { x: 88, y: 120 },
  { x: 140, y: 116 },
  { x: 192, y: 120 },
  { x: 244, y: 116 },
  { x: 114, y: 166 },
  { x: 166, y: 162 },
  { x: 218, y: 166 },
  { x: 140, y: 210 },
  { x: 192, y: 210 },
] as const

const MARQUEE_BULBS = [
  { cx: 28, cy: 250 },
  { cx: 24, cy: 214 },
  { cx: 24, cy: 176 },
  { cx: 28, cy: 138 },
  { cx: 36, cy: 100 },
  { cx: 52, cy: 68 },
  { cx: 74, cy: 42 },
  { cx: 100, cy: 24 },
  { cx: 132, cy: 12 },
  { cx: 166, cy: 10 },
  { cx: 200, cy: 14 },
  { cx: 232, cy: 26 },
  { cx: 258, cy: 44 },
  { cx: 280, cy: 70 },
  { cx: 296, cy: 102 },
  { cx: 304, cy: 138 },
  { cx: 308, cy: 176 },
  { cx: 308, cy: 214 },
  { cx: 304, cy: 250 },
] as const

function buildClassName(baseClassName: string): string {
  return `judge-seat-backrest-svg ${baseClassName}`
}

function CrownBackrest({ uid }: { uid: string }) {
  return (
    <div className="judge-seat-back judge-seat-backrest-shell" aria-hidden="true">
      <svg
        viewBox="0 0 332 280"
        className={buildClassName('judge-seat-backrest-crown')}
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-velvet`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#982041" />
            <stop offset="48%" stopColor="#7a1230" />
            <stop offset="100%" stopColor="#4f091f" />
          </linearGradient>
          <linearGradient id={`${uid}-gold`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="52%" stopColor="#f0c86f" />
            <stop offset="100%" stopColor="#af6c14" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="50%" cy="20%" r="72%">
            <stop offset="0%" stopColor="rgba(255,235,178,0.45)" />
            <stop offset="100%" stopColor="rgba(255,235,178,0)" />
          </radialGradient>
        </defs>
        <path
          d="M22 262V122c0-24 14-41 36-49 6-33 27-61 54-61 19 0 37 13 54 34 17-21 35-34 54-34 27 0 48 28 54 61 22 8 36 25 36 49v140Z"
          fill={`url(#${uid}-gold)`}
        />
        <path
          d="M36 256V126c0-17 10-29 27-35 5-25 20-46 42-46 15 0 30 11 46 31 16-20 31-31 46-31 22 0 37 21 42 46 17 6 27 18 27 35v130Z"
          fill={`url(#${uid}-velvet)`}
        />
        <path
          d="M48 246V138c0-12 8-20 20-24 5-18 16-34 30-34 13 0 26 11 39 28 13-17 26-28 39-28 14 0 25 16 30 34 12 4 20 12 20 24v108Z"
          fill={`url(#${uid}-glow)`}
        />
        {TUFT_POINTS.map((dot) => (
          <g key={`crown-${dot.x}-${dot.y}`}>
            <circle cx={dot.x} cy={dot.y} r="7" fill={`url(#${uid}-gold)`} />
            <circle cx={dot.x} cy={dot.y} r="3" fill="#ffe7a0" />
          </g>
        ))}
        <path
          d="M44 252h244"
          stroke="rgba(255,227,155,0.65)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function TuftedBackrest({ uid }: { uid: string }) {
  return (
    <div className="judge-seat-back judge-seat-backrest-shell" aria-hidden="true">
      <svg
        viewBox="0 0 332 280"
        className={buildClassName('judge-seat-backrest-tufted')}
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-velvet`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9f2445" />
            <stop offset="50%" stopColor="#7a1230" />
            <stop offset="100%" stopColor="#4b091d" />
          </linearGradient>
          <linearGradient id={`${uid}-gold`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff6d0" />
            <stop offset="52%" stopColor="#f2cb74" />
            <stop offset="100%" stopColor="#ac6812" />
          </linearGradient>
          <pattern
            id={`${uid}-diamond`}
            x="0"
            y="0"
            width="42"
            height="42"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M21 0L42 21L21 42L0 21Z"
              fill="none"
              stroke="rgba(255,221,147,0.2)"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <path
          d="M24 262V108c0-21 16-38 41-45 5-33 27-57 57-57h88c30 0 52 24 57 57 25 7 41 24 41 45v154Z"
          fill={`url(#${uid}-gold)`}
        />
        <path
          d="M40 256V116c0-14 11-26 29-30 5-25 21-43 43-43h108c22 0 38 18 43 43 18 4 29 16 29 30v140Z"
          fill={`url(#${uid}-velvet)`}
        />
        <path d="M52 248V126h228v122Z" fill={`url(#${uid}-diamond)`} />
        {TUFT_POINTS.map((dot) => (
          <g key={`tufted-${dot.x}-${dot.y}`}>
            <circle cx={dot.x} cy={dot.y} r="7.2" fill={`url(#${uid}-gold)`} />
            <circle cx={dot.x} cy={dot.y} r="2.8" fill="#ffefc1" />
          </g>
        ))}
        <path
          d="M50 252h232"
          stroke="rgba(255,228,160,0.7)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function MarqueeBackrest({ uid }: { uid: string }) {
  return (
    <div className="judge-seat-back judge-seat-backrest-shell" aria-hidden="true">
      <svg
        viewBox="0 0 332 280"
        className={buildClassName('judge-seat-backrest-marquee')}
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-velvet`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a6284b" />
            <stop offset="46%" stopColor="#7a1230" />
            <stop offset="100%" stopColor="#4b091d" />
          </linearGradient>
          <linearGradient id={`${uid}-gold`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff5cb" />
            <stop offset="52%" stopColor="#efc66a" />
            <stop offset="100%" stopColor="#ad6914" />
          </linearGradient>
          <radialGradient id={`${uid}-spot`} cx="50%" cy="24%" r="66%">
            <stop offset="0%" stopColor="rgba(255,241,193,0.52)" />
            <stop offset="100%" stopColor="rgba(255,241,193,0)" />
          </radialGradient>
        </defs>
        <path d="M18 262V134c0-64 46-116 148-116s148 52 148 116v128Z" fill={`url(#${uid}-gold)`} />
        <path
          d="M34 254V138c0-56 38-102 132-102s132 46 132 102v116Z"
          fill={`url(#${uid}-velvet)`}
        />
        <path d="M48 246V144c0-48 31-87 118-87s118 39 118 87v102Z" fill={`url(#${uid}-spot)`} />
        {MARQUEE_BULBS.map((bulb, index) => (
          <circle
            key={`marquee-bulb-${index}`}
            cx={bulb.cx}
            cy={bulb.cy}
            r="6.4"
            className="judge-seat-backrest-bulb"
            style={{ ['--marquee-delay' as string]: `${index * 90}ms` }}
            fill={`url(#${uid}-gold)`}
          />
        ))}
        {TUFT_POINTS.map((dot) => (
          <g key={`marquee-${dot.x}-${dot.y}`}>
            <circle cx={dot.x} cy={dot.y} r="6.8" fill={`url(#${uid}-gold)`} />
            <circle cx={dot.x} cy={dot.y} r="2.8" fill="#ffefc1" />
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * 王道ゴールド×ベルベットの背もたれ装飾（SVG）
 * 3案を同一コンポーネントで切り替えられるようにしている
 */
export function JudgeSeatBackrest({ variant = 'royal-crown' }: JudgeSeatBackrestProps) {
  const uid = useId().replace(/:/g, '')

  if (variant === 'royal-tufted') return <TuftedBackrest uid={uid} />
  if (variant === 'royal-marquee') return <MarqueeBackrest uid={uid} />
  return <CrownBackrest uid={uid} />
}
