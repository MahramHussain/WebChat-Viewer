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

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // Get or create the favicon <link> tag
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  let frame = 0
  const FPS = 60
  const PULSE_SPEED = 1.5   // beats per second

  function drawHeart(scale) {
    ctx.clearRect(0, 0, SIZE, SIZE)

    const pixW = Math.round((SIZE / COLS) * scale)
    const pixH = Math.round((SIZE / ROWS) * scale)
    const offsetX = Math.round((SIZE - pixW * COLS) / 2)
    const offsetY = Math.round((SIZE - pixH * ROWS) / 2)

    // Deep red core with a hot-pink highlight for the pixelated look
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!HEART[r][c]) continue
        // Top-left quarter gets a lighter pink highlight
        const isHighlight = r < 3 && c < 4
        ctx.fillStyle = isHighlight ? '#ff6b8a' : '#e8003a'
        ctx.fillRect(
          offsetX + c * pixW,
          offsetY + r * pixH,
          pixW,
          pixH
        )
      }
    }
  }

  function tick() {
    frame++
    // Sine wave: oscillates between 0.68 (small) and 0.85 (large) — compact
    const t = (Math.sin((frame / FPS) * PULSE_SPEED * Math.PI * 2) + 1) / 2
    const scale = 0.68 + t * 0.17

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
