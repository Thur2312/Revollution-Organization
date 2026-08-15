"use client"
import { useEffect, useRef } from 'react'

const COLORS = ['#c9a26b', '#430f1c', '#e5504a', '#2f8f5b', '#3f7fd1', '#8b5fbf']

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
}

// Self-contained canvas burst — no external library. Mounts full-screen,
// runs a couple seconds of confetti falling under gravity with a little
// air drag, then calls onDone so the caller can unmount it.
export function Confetti({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 3,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
    }))

    const duration = 3200
    const start = performance.now()
    let frame = 0

    function tick(now: number) {
      const elapsed = now - start
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      for (const p of particles) {
        p.vy += 0.05
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        const fade = elapsed > duration - 500 ? Math.max(0, (duration - elapsed) / 500) : 1
        ctx!.save()
        ctx!.globalAlpha = fade
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.rotation)
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx!.restore()
      }
      if (elapsed < duration) {
        frame = requestAnimationFrame(tick)
      } else {
        onDone?.()
      }
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true" />
}
