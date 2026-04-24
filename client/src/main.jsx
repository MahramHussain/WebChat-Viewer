import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Animated pixelated throbbing heart favicon ──────────────────────────────
;(function startHeartFavicon() {
  const SIZE = 32

  // 9×9 square pixel-art heart bitmap (1 = filled, 0 = transparent)
  const HEART = [
    [0,1,1,0,0,0,1,1,0],
    [1,1,1,1,0,1,1,1,1],
    [1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
  ]

  const ROWS = HEART.length        // 9
  const COLS = HEART[0].length     // 9

  // Pre-render heart once at native 1px-per-cell onto a tiny offscreen canvas
  const offscreen = document.createElement('canvas')
  offscreen.width  = COLS
  offscreen.height = ROWS
  const offCtx = offscreen.getContext('2d')
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!HEART[r][c]) continue
      offCtx.fillStyle = (r < 3 && c < 4) ? '#ff6b8a' : '#e8003a'
      offCtx.fillRect(c, r, 1, 1)
    }
  }

  // Display canvas — written to favicon each frame
  const canvas = document.createElement('canvas')
  canvas.width  = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false   // nearest-neighbour = crisp pixel art

  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  let frame = 0
  const FPS         = 60
  const PULSE_SPEED = 2.2   // beats per second

  function drawHeart(scale) {
    ctx.clearRect(0, 0, SIZE, SIZE)
    // Continuous (non-rounded) size → smooth throb, no snapping
    const heartPx = SIZE * scale
    const offset  = (SIZE - heartPx) / 2
    ctx.drawImage(offscreen, offset, offset, heartPx, heartPx)
  }

  function tick() {
    frame++
    // Sine wave: 0.55 (small) → 0.85 (large) — wide range = visible throb
    const t = (Math.sin((frame / FPS) * PULSE_SPEED * Math.PI * 2) + 1) / 2
    const scale = 0.55 + t * 0.30

    drawHeart(scale)
    link.href = canvas.toDataURL('image/png')
  }

  setInterval(tick, 1000 / FPS)
})()
// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
