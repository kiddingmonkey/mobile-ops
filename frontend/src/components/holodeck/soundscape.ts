/**
 * 环境音景引擎（程序化生成，零外部资源）
 * - white: 白噪音
 * - rain: 雨声（白噪音 + 低通 + 随机滴声）
 * - deep-space: 深空（粉噪 + 低频调制 + 随机滴答）
 * - lofi-cafe: 咖啡厅（粉噪 + 低通 + 蒸汽脉冲）
 */

export type SoundScapeId = 'off' | 'white' | 'rain' | 'deep-space' | 'lofi-cafe'

export interface SoundScapeSpec {
  id: SoundScapeId
  name: string
  desc: string
}

export const SCAPES: SoundScapeSpec[] = [
  { id: 'off', name: '静默', desc: '关闭所有环境音' },
  { id: 'white', name: '数据流', desc: '纯白噪音·专注' },
  { id: 'rain', name: '深夜加班', desc: '雨声·舒缓' },
  { id: 'deep-space', name: '太空巡航', desc: '深空静默滴答' },
  { id: 'lofi-cafe', name: 'Lo-fi 咖啡厅', desc: '轻柔环境音' },
]

const STORAGE_KEY = 'holodeck_soundscape_v1'

interface Runtime {
  ctx: AudioContext
  master: GainNode
  cleanup: () => void
}

let runtime: Runtime | null = null

function createNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink', durationSec = 4): AudioBuffer {
  const len = ctx.sampleRate * durationSec
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else {
    // Voss-McCartney 近似粉噪
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buf
}

function startWhite(ctx: AudioContext, master: GainNode): () => void {
  const src = ctx.createBufferSource()
  src.buffer = createNoiseBuffer(ctx, 'white')
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 4000
  const g = ctx.createGain()
  g.gain.value = 0.15
  src.connect(lp).connect(g).connect(master)
  src.start()
  return () => { try { src.stop() } catch {} }
}

function startRain(ctx: AudioContext, master: GainNode): () => void {
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 'white')
  noise.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 200
  const g = ctx.createGain()
  g.gain.value = 0.22
  noise.connect(lp).connect(hp).connect(g).connect(master)
  noise.start()

  // 随机雨滴
  let dropTimer: number | null = null
  const scheduleDrop = () => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 400 + Math.random() * 1200
    const dg = ctx.createGain()
    dg.gain.setValueAtTime(0, ctx.currentTime)
    dg.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.005)
    dg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
    osc.connect(dg).connect(master)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    dropTimer = window.setTimeout(scheduleDrop, 40 + Math.random() * 250)
  }
  scheduleDrop()

  return () => {
    try { noise.stop() } catch {}
    if (dropTimer !== null) clearTimeout(dropTimer)
  }
}

function startDeepSpace(ctx: AudioContext, master: GainNode): () => void {
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 'pink')
  noise.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const g = ctx.createGain()
  g.gain.value = 0.28
  noise.connect(lp).connect(g).connect(master)
  noise.start()

  // 低频调制振荡
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.08
  lfo.connect(lfoGain).connect(g.gain)
  lfo.start()

  // 稀疏电磁滴答
  let tickTimer: number | null = null
  const scheduleTick = () => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 900 + Math.random() * 500
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0, ctx.currentTime)
    tg.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.002)
    tg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05)
    osc.connect(tg).connect(master)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
    tickTimer = window.setTimeout(scheduleTick, 800 + Math.random() * 3500)
  }
  scheduleTick()

  return () => {
    try { noise.stop() } catch {}
    try { lfo.stop() } catch {}
    if (tickTimer !== null) clearTimeout(tickTimer)
  }
}

function startLofiCafe(ctx: AudioContext, master: GainNode): () => void {
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 'pink')
  noise.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1200
  const g = ctx.createGain()
  g.gain.value = 0.20
  noise.connect(lp).connect(g).connect(master)
  noise.start()

  // 稀疏"蒸汽"脉冲
  let steamTimer: number | null = null
  const scheduleSteam = () => {
    const src = ctx.createBufferSource()
    src.buffer = createNoiseBuffer(ctx, 'white', 0.6)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3000
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0, ctx.currentTime)
    sg.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1)
    sg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55)
    src.connect(hp).connect(sg).connect(master)
    src.start()
    src.stop(ctx.currentTime + 0.7)
    steamTimer = window.setTimeout(scheduleSteam, 12000 + Math.random() * 18000)
  }
  steamTimer = window.setTimeout(scheduleSteam, 3000)

  return () => {
    try { noise.stop() } catch {}
    if (steamTimer !== null) clearTimeout(steamTimer)
  }
}

export function playSoundscape(id: SoundScapeId, volume = 0.6) {
  stopSoundscape()
  if (id === 'off') {
    localStorage.setItem(STORAGE_KEY, id)
    return
  }

  const AC = (window.AudioContext || (window as any).webkitAudioContext)
  if (!AC) return
  const ctx: AudioContext = new AC()
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)

  let cleanup: () => void = () => {}
  if (id === 'white') cleanup = startWhite(ctx, master)
  else if (id === 'rain') cleanup = startRain(ctx, master)
  else if (id === 'deep-space') cleanup = startDeepSpace(ctx, master)
  else if (id === 'lofi-cafe') cleanup = startLofiCafe(ctx, master)

  runtime = {
    ctx,
    master,
    cleanup: () => {
      cleanup()
      try { ctx.close() } catch {}
    },
  }

  localStorage.setItem(STORAGE_KEY, id)
}

export function stopSoundscape() {
  if (runtime) {
    runtime.cleanup()
    runtime = null
  }
}

export function setSoundscapeVolume(v: number) {
  if (runtime) runtime.master.gain.value = Math.max(0, Math.min(1, v))
  localStorage.setItem('holodeck_soundscape_volume', String(v))
}

export function getCurrentScape(): SoundScapeId {
  const v = localStorage.getItem(STORAGE_KEY) as SoundScapeId | null
  return v || 'off'
}

export function getCurrentVolume(): number {
  const v = parseFloat(localStorage.getItem('holodeck_soundscape_volume') || '0.6')
  return isNaN(v) ? 0.6 : v
}
