import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

type SvgPathDrawingTextAnimationProps = {
  text: string
  fromColor?: string
  toColor?: string
  strokeWidth?: number
  durationSec?: number
  loop?: boolean
  viewBoxWidth?: number
  viewBoxHeight?: number
  fontSize?: number
  className?: string
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('svg raster failed'))
    img.src = url
  })
}

function countOpaque(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const data = ctx.getImageData(0, 0, w, h).data
  let n = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 12) n += 1
  }
  return n
}

async function rasterInk(source: SVGSVGElement, apply: (text: SVGTextElement) => void): Promise<number> {
  const clone = source.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const text = clone.querySelector('text')
  if (!text) return 0
  apply(text as SVGTextElement)
  text.setAttribute('stroke', '#ffffff')
  ;(text as SVGTextElement).style.stroke = '#ffffff'

  const vb = source.viewBox.baseVal
  const w = Math.max(1, Math.round(vb.width || 800))
  const h = Math.max(1, Math.round(vb.height || 160))
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const xml = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const cw = Math.max(1, Math.round(w * 0.45))
    const ch = Math.max(1, Math.round(h * 0.45))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 0
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)
    return countOpaque(ctx, cw, ch)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function measureExactDashLength(svg: SVGSVGElement): Promise<number> {
  const full = await rasterInk(svg, (text) => {
    text.style.strokeDasharray = 'none'
    text.style.strokeDashoffset = '0'
  })
  if (full <= 0) throw new Error('empty ink')

  const covered = async (dash: number) => {
    const ink = await rasterInk(svg, (text) => {
      text.style.strokeDasharray = `${dash} 100000`
      text.style.strokeDashoffset = '0'
    })
    return ink >= full * 0.994
  }

  let hi = 64
  while (hi < 24000 && !(await covered(hi))) hi *= 2
  let lo = 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (await covered(mid)) hi = mid
    else lo = mid + 1
  }
  return Math.max(1, lo)
}

function SvgPathDrawingTextAnimation({
  text,
  fromColor = '#0891b2',
  toColor = '#2563eb',
  strokeWidth = 2,
  durationSec = 5.5,
  loop = true,
  viewBoxWidth = 800,
  viewBoxHeight = 160,
  fontSize = 88,
  className,
}: SvgPathDrawingTextAnimationProps) {
  const reactId = useId().replace(/:/g, '')
  const gradientId = `pathGradient-${reactId}`
  const svgRef = useRef<SVGSVGElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const [dashLength, setDashLength] = useState(0)
  const reduceMotion = useReducedMotion()
  const display = text.trim()

  useEffect(() => {
    if (!display || reduceMotion) return
    const svg = svgRef.current
    if (!svg) return
    let cancelled = false
    const run = async () => {
      try {
        await document.fonts.ready
        if (cancelled || !svgRef.current) return
        const dash = await measureExactDashLength(svgRef.current)
        if (!cancelled) setDashLength(dash)
      } catch {
        const el = textRef.current
        if (!el || cancelled) return
        const width = el.getComputedTextLength() || display.length * fontSize * 0.62
        setDashLength(Math.max(1, Math.ceil(width * 1.15)))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [display, fontSize, viewBoxWidth, strokeWidth, reduceMotion])

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    if (reduceMotion || dashLength <= 0) {
      el.style.strokeDashoffset = '0'
      el.style.strokeDasharray = 'none'
      return
    }
    el.style.strokeDasharray = `${dashLength} ${dashLength}`
    el.style.strokeDashoffset = String(dashLength)
    const drawMs = Math.max(0.8, durationSec) * 1000
    const unitsPerMs = dashLength / drawMs
    let offset = dashLength
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      offset -= unitsPerMs * dt
      if (offset <= 0) {
        if (!loop) {
          el.style.strokeDashoffset = '0'
          return
        }
        offset = dashLength
      }
      el.style.strokeDashoffset = String(offset)
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [dashLength, durationSec, loop, reduceMotion])

  if (!display) return null
  const ready = dashLength > 0 || Boolean(reduceMotion)

  return (
    <div className={cn('flex min-h-[180px] w-full items-center justify-center', className)}>
      <svg
        ref={svgRef}
        width="1000"
        height="420"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={display}
        style={{ visibility: ready ? 'visible' : 'hidden' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={fromColor} />
            <stop offset="100%" stopColor={toColor} />
          </linearGradient>
        </defs>
        <text
          ref={textRef}
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="Arial, Helvetica, sans-serif"
          letterSpacing="0.02em"
        >
          {display}
        </text>
      </svg>
    </div>
  )
}

export type PathDrawingPortfolioHeroProps = {
  brand: string
  tagline?: string
  eyebrow?: string
  fromColor?: string
  toColor?: string
  children?: ReactNode
  className?: string
  compact?: boolean
}

export default function PathDrawingPortfolioHero({
  brand,
  tagline = 'Quantum Resource Engine',
  eyebrow = 'Platform',
  fromColor,
  toColor,
  children,
  className,
  compact = false,
}: PathDrawingPortfolioHeroProps) {
  const name = brand.trim()
  const reduceMotion = useReducedMotion()
  const theme = useResolvedTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  if (!name) return null

  const instant = Boolean(reduceMotion) || !ready
  const gradFrom = fromColor ?? (theme === 'dark' ? '#22d3ee' : '#0891b2')
  const gradTo = toColor ?? (theme === 'dark' ? '#818cf8' : '#2563eb')

  return (
    <section
      data-path-drawing-hero
      className={cn(
        'relative flex w-full flex-col items-center justify-center bg-transparent',
        compact ? 'min-h-0 py-8' : 'min-h-[420px] py-12',
        'text-neutral-900 dark:text-white',
        className,
      )}
    >
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-6 text-center sm:px-10">
        {eyebrow ? (
          <motion.p
            className="mb-4 text-[0.7rem] font-medium uppercase tracking-[0.35em] text-cyan-700/80 dark:text-cyan-300/70 sm:text-xs"
            initial={instant ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {eyebrow}
          </motion.p>
        ) : null}

        <h1 className="sr-only">{name}</h1>
        <motion.div
          className="w-full"
          initial={instant ? false : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <SvgPathDrawingTextAnimation
            text={name}
            fromColor={gradFrom}
            toColor={gradTo}
            className="w-full min-h-[160px] sm:min-h-[220px] md:min-h-[280px]"
            fontSize={name.length > 12 ? 72 : name.length > 8 ? 96 : 120}
            viewBoxWidth={name.length > 8 ? 1100 : 860}
            viewBoxHeight={name.length > 8 ? 200 : 240}
            strokeWidth={2.4}
            durationSec={5.5}
            loop
          />
        </motion.div>

        {tagline ? (
          <motion.p
            className="mt-2 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base"
            initial={instant ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {tagline}
          </motion.p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
